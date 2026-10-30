"""Persist an exact prepared-case fixture for the real chunk duplex test."""
import hashlib
import json
import sys
from dataclasses import asdict
from pathlib import Path

backend, directory = Path(sys.argv[1]), Path(sys.argv[2])
sys.path[:0] = [str(backend / "src"), str(backend / "tests")]
from test_native_case_preparation_parallel import prepared_candidate
from test_native_preparation_review import artifact_for
from test_native_review_stdio import Duplex
from dfw_incentives.models import ApplicationArtifact, ApplicationPacket
from dfw_incentives.native_case_review_stdio import run as review_run
from dfw_incentives.native_packet import packet_service


db, config, actors, tasks, prepared, saved, dispatched = prepared_candidate(directory)
producer = actors[0]
reviewer = {**asdict(producer), "agent_id": config.reviewer.agent_id,
            "principal_id": config.reviewer.principal_id, "run_id": "artifact-reviewer-run", "role": "reviewer"}
facts = dict(company_id=producer.company_id, project_id=producer.project_id,
             issue_id=producer.issue_id, interaction_id="artifact-interaction", decision_id="artifact-decision",
             producer_agent_id=producer.agent_id, producer_run_id=producer.run_id,
             reviewer_agent_id=reviewer["agent_id"], reviewer_run_id=reviewer["run_id"])
task = {**asdict(tasks[0]), "active_run_id": reviewer["run_id"], "status": "in_review"}


class CaseDuplex(Duplex):
    def __init__(self, op, params):
        super().__init__(op, params, None, facts)
        self.incoming.clear()
        self.incoming.append(self.encode({"version": "dfw-native-case-review-v1", "op": op, "params": params}))

    def write(self, value):
        frame = json.loads(value)
        kind = frame["type"]
        self.frames.append(frame)
        if kind in {"context", "native_assignment", "case_task"}:
            self.callback_ids.append(frame["id"])
            response = {"type": kind, "id": frame["id"],
                        **({"context": reviewer} if kind == "context" else
                           {"assignment": facts} if kind == "native_assignment" else {"task": task})}
            self.incoming.append(self.encode(response))
        return len(value)


stream = CaseDuplex("context", {})
current = review_run(config, stream, stream)
artifact = artifact_for(current)
artifact["artifact"]["findings"][0]["excerpt"] = current["context"]["request"]["data"]["candidate"]["evidence_snapshot"][0]["evidence_text"][:80]
stream = CaseDuplex("admit", artifact)
review_run(config, stream, stream)
rendered = prepared.render()["result"]
assert rendered["state"] == "registered", rendered
binding, _, public, _ = prepared._prepared(create=False)
body = b"independently generated supporting attachment fixture\n" * 85000
with db.session() as session:
    packet = session.get(ApplicationPacket, rendered["manifest"]["packet_id"])
    path = Path(packet.output_directory) / "supporting-document.pdf"
path.write_bytes(body)
with db.session() as session:
    session.add(ApplicationArtifact(packet_id=rendered["manifest"]["packet_id"],
                artifact_key="supporting_document", artifact_type="attachment", file_path=str(path),
                content_hash=hashlib.sha256(body).hexdigest(), status="draft", placeholders=[]))
packet_service(db, binding, public, producer.run_id).register(rendered["manifest"]["packet_id"])
(directory / "case-config.json").write_text(config.model_dump_json())
(directory / "metadata.json").write_text(json.dumps({"actor": asdict(producer), "task": asdict(tasks[0]),
    "size": len(body), "hash": hashlib.sha256(body).hexdigest()}))
