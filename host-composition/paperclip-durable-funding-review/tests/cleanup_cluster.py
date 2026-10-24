"""Linux-only cleanup: retain uncertain clusters and signal only verified pidfds."""

import argparse
import json
import os
import select
import shutil
import signal
from pathlib import Path


def cleanup(work: Path, postgres: Path, attempted: bool, timeout: float) -> dict:
    supplied_symlink = work.is_symlink()
    work = work.resolve()
    result = {"workspace": str(work), "stopped": False, "removed": False, "reason": "unknown"}
    if not work.name.startswith("native-pg-qualification.") or supplied_symlink:
        result["reason"] = "invalid_workspace"
        return result
    if not attempted:
        result.update(stopped=True, reason="never_started")
    else:
        try:
            pid = int((work / "db/postmaster.pid").read_text().splitlines()[0])
        except FileNotFoundError:
            result["reason"] = "missing_pid_after_start"
            return result
        except (ValueError, IndexError, OSError):
            result["reason"] = "unreadable_pid"
            return result
        try:
            fd = os.pidfd_open(pid)
        except ProcessLookupError:
            result["reason"] = "recorded_process_absent_uncertain"
            return result
        except OSError:
            result["reason"] = "pidfd_unavailable"
            return result
        else:
            try:
                try:
                    executable = Path(os.readlink(f"/proc/{pid}/exe")).resolve()
                    argv = Path(f"/proc/{pid}/cmdline").read_bytes().decode().split("\0")
                    matched = executable == postgres.resolve() and any(
                        arg == "-D" and i + 1 < len(argv) and argv[i + 1] == str(work / "db")
                        for i, arg in enumerate(argv)
                    )
                except (OSError, UnicodeError):
                    matched = False
                if not matched:
                    result["reason"] = "pid_identity_mismatch"
                    return result
                # pidfd cannot be redirected to a recycled/unrelated PID between check and signal.
                try:
                    signal.pidfd_send_signal(fd, signal.SIGINT)
                except ProcessLookupError:
                    pass
                except OSError:
                    result["reason"] = "stop_signal_failed"
                    return result
                if not select.select([fd], [], [], timeout)[0]:
                    result["reason"] = "stop_timeout"
                    return result
                result.update(stopped=True, reason="verified_owned_process_exited")
            finally:
                os.close(fd)
    if result["stopped"]:
        try:
            shutil.rmtree(work)
            result["removed"] = True
        except OSError:
            result["reason"] = "workspace_removal_failed"
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("work", type=Path)
    parser.add_argument("postgres", type=Path)
    parser.add_argument("attempted", choices=["true", "false"])
    parser.add_argument("receipt", type=Path)
    args = parser.parse_args()
    try:
        result = cleanup(args.work, args.postgres, args.attempted == "true", 10)
    except Exception as error:
        result = {
            "workspace": str(args.work),
            "stopped": False,
            "removed": False,
            "reason": "cleanup_exception",
            "error_type": type(error).__name__,
        }
    args.receipt.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))
    return 0 if result["stopped"] and result["removed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
