import{NATIVE_GAP_REVIEW_ARTIFACT_SCHEMA}from'./native-gap-review.mjs';
import {NATIVE_PACKET_REVIEW_ARTIFACT_SCHEMA} from './native-packet-review.mjs';
/** Exact public CandidateReview JSON contract, with nested references inlined for a tool property. Identity is never model input. */
export const NATIVE_REVIEW_ARTIFACT_SCHEMA = {
  "additionalProperties": false,
  "properties": {
    "candidate_hash": {
      "title": "Candidate Hash",
      "type": "string"
    },
    "evidence_set_hash": {
      "title": "Evidence Set Hash",
      "type": "string"
    },
    "findings": {
      "items": {
        "additionalProperties": false,
        "properties": {
          "claim_end": {
            "title": "Claim End",
            "type": "integer"
          },
          "claim_start": {
            "title": "Claim Start",
            "type": "integer"
          },
          "excerpt": {
            "minLength": 1,
            "title": "Excerpt",
            "type": "string"
          },
          "rationale": {
            "minLength": 1,
            "title": "Rationale",
            "type": "string"
          },
          "support": {
            "enum": [
              "supported",
              "partial",
              "unsupported",
              "contradicted"
            ],
            "title": "Support",
            "type": "string"
          }
        },
        "required": [
          "claim_start",
          "claim_end",
          "support",
          "excerpt",
          "rationale"
        ],
        "title": "ReviewFinding",
        "type": "object"
      },
      "title": "Findings",
      "type": "array"
    },
    "requirement_hash": {
      "title": "Requirement Hash",
      "type": "string"
    },
    "requirement_supported": {
      "title": "Requirement Supported",
      "type": "boolean"
    },
    "rubric_version": {
      "minLength": 1,
      "title": "Rubric Version",
      "type": "string"
    }
  },
  "required": [
    "candidate_hash",
    "requirement_hash",
    "evidence_set_hash",
    "rubric_version",
    "findings",
    "requirement_supported"
  ],
  "title": "CandidateReview",
  "type": "object"
};

export const NATIVE_WHOLE_PACKET_REVIEW_ARTIFACT_SCHEMA={oneOf:[NATIVE_REVIEW_ARTIFACT_SCHEMA,NATIVE_PACKET_REVIEW_ARTIFACT_SCHEMA,NATIVE_GAP_REVIEW_ARTIFACT_SCHEMA]};
