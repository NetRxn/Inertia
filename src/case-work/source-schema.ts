// Generated from DFW native_case_source.SOURCE_MODELS; domain owns these model definitions.
export const sourceDefinitions={
  "FieldAssertion": {
    "additionalProperties": false,
    "properties": {
      "field": {
        "enum": [
          "title",
          "sponsor",
          "description",
          "eligible_applicant_types",
          "geography",
          "themes",
          "activities",
          "requirements",
          "required_artifacts",
          "cost_sharing",
          "match_required",
          "required_partners",
          "strategy",
          "access_mode",
          "funding_mechanism",
          "portal_url",
          "application_package",
          "ineligible_applicant_types",
          "required_registrations",
          "field_inventory_status",
          "field_inventory_verified_on",
          "field_inventory_source_url",
          "field_inventory_notes",
          "package_sources",
          "evaluation_criteria",
          "hard_gates",
          "project_period_months",
          "cost_share_percent_of_federal",
          "indirect_cost_notes"
        ],
        "title": "Field",
        "type": "string"
      },
      "value": {
        "title": "Value"
      },
      "evidence": {
        "items": {
          "$ref": "#/$defs/Passage"
        },
        "maxItems": 20,
        "minItems": 1,
        "title": "Evidence",
        "type": "array"
      }
    },
    "required": [
      "field",
      "value",
      "evidence"
    ],
    "title": "FieldAssertion",
    "type": "object"
  },
  "Passage": {
    "additionalProperties": false,
    "properties": {
      "source_document_id": {
        "maxLength": 200,
        "minLength": 1,
        "pattern": "^[^\\s\\x00-\\x1f\\x7f]+$",
        "title": "Source Document Id",
        "type": "string"
      },
      "start": {
        "minimum": 0,
        "title": "Start",
        "type": "integer"
      },
      "end": {
        "minimum": 1,
        "title": "End",
        "type": "integer"
      },
      "quote": {
        "maxLength": 100000,
        "minLength": 1,
        "title": "Quote",
        "type": "string"
      }
    },
    "required": [
      "source_document_id",
      "start",
      "end",
      "quote"
    ],
    "title": "Passage",
    "type": "object"
  },
  "RequirementAssertion": {
    "additionalProperties": false,
    "properties": {
      "requirement": {
        "$ref": "#/$defs/SponsorFieldRequirement"
      },
      "evidence": {
        "$ref": "#/$defs/Passage"
      }
    },
    "required": [
      "requirement",
      "evidence"
    ],
    "title": "RequirementAssertion",
    "type": "object"
  },
  "SponsorConcernGate": {
    "additionalProperties": false,
    "description": "One explicit, independently resolvable concern attached to a sponsor field.",
    "properties": {
      "key": {
        "maxLength": 255,
        "pattern": "^[A-Za-z0-9_.:-]+$",
        "title": "Key",
        "type": "string"
      },
      "message": {
        "maxLength": 10000,
        "minLength": 1,
        "title": "Message",
        "type": "string"
      },
      "severity": {
        "default": "blocking",
        "enum": [
          "blocking",
          "advisory"
        ],
        "title": "Severity",
        "type": "string"
      },
      "resolution_answer_key": {
        "anyOf": [
          {
            "maxLength": 255,
            "pattern": "^[A-Z0-9_.:-]+$",
            "type": "string"
          },
          {
            "type": "null"
          }
        ],
        "default": null,
        "title": "Resolution Answer Key"
      },
      "evidence_required": {
        "default": true,
        "title": "Evidence Required",
        "type": "boolean"
      }
    },
    "required": [
      "key",
      "message"
    ],
    "title": "SponsorConcernGate",
    "type": "object"
  },
  "SponsorFieldRequirement": {
    "additionalProperties": false,
    "description": "Source-grounded contract for one sponsor field, rule, or attachment.",
    "properties": {
      "key": {
        "maxLength": 255,
        "pattern": "^[A-Za-z0-9_.:-]+$",
        "title": "Key",
        "type": "string"
      },
      "owner_role": {
        "default": "unassigned",
        "enum": [
          "dao",
          "lead_applicant",
          "shared",
          "unassigned"
        ],
        "title": "Owner Role",
        "type": "string"
      },
      "sponsor_language": {
        "maxLength": 100000,
        "minLength": 1,
        "title": "Sponsor Language",
        "type": "string"
      },
      "language_kind": {
        "default": "faithful_summary",
        "enum": [
          "exact_quote",
          "faithful_summary",
          "operator_note"
        ],
        "title": "Language Kind",
        "type": "string"
      },
      "source_url": {
        "default": "",
        "maxLength": 2000,
        "title": "Source Url",
        "type": "string"
      },
      "source_locator": {
        "anyOf": [
          {
            "maxLength": 2000,
            "type": "string"
          },
          {
            "type": "null"
          }
        ],
        "default": null,
        "title": "Source Locator"
      },
      "portal_field": {
        "anyOf": [
          {
            "maxLength": 1000,
            "type": "string"
          },
          {
            "type": "null"
          }
        ],
        "default": null,
        "title": "Portal Field"
      },
      "response_type": {
        "default": "narrative",
        "enum": [
          "narrative",
          "short_text",
          "integer",
          "decimal",
          "currency",
          "date",
          "choice",
          "certification",
          "attachment"
        ],
        "title": "Response Type",
        "type": "string"
      },
      "answer_key": {
        "anyOf": [
          {
            "maxLength": 255,
            "pattern": "^[A-Z0-9_.:-]+$",
            "type": "string"
          },
          {
            "type": "null"
          }
        ],
        "default": null,
        "title": "Answer Key"
      },
      "max_characters": {
        "anyOf": [
          {
            "maximum": 10000000,
            "minimum": 1,
            "type": "integer"
          },
          {
            "type": "null"
          }
        ],
        "default": null,
        "title": "Max Characters"
      },
      "max_words": {
        "anyOf": [
          {
            "maximum": 1000000,
            "minimum": 1,
            "type": "integer"
          },
          {
            "type": "null"
          }
        ],
        "default": null,
        "title": "Max Words"
      },
      "required_attachment": {
        "anyOf": [
          {
            "maxLength": 1000,
            "type": "string"
          },
          {
            "type": "null"
          }
        ],
        "default": null,
        "title": "Required Attachment"
      },
      "validation_rules": {
        "items": {
          "type": "string"
        },
        "maxItems": 100,
        "title": "Validation Rules",
        "type": "array"
      },
      "evidence_requirements": {
        "items": {
          "type": "string"
        },
        "maxItems": 100,
        "title": "Evidence Requirements",
        "type": "array"
      },
      "unresolved_concerns": {
        "items": {
          "$ref": "#/$defs/SponsorConcernGate"
        },
        "maxItems": 100,
        "title": "Unresolved Concerns",
        "type": "array"
      },
      "required": {
        "default": true,
        "title": "Required",
        "type": "boolean"
      },
      "confidence": {
        "default": 0.5,
        "maximum": 1,
        "minimum": 0,
        "title": "Confidence",
        "type": "number"
      },
      "verification_status": {
        "default": "unverified",
        "enum": [
          "verified",
          "observed",
          "unverified"
        ],
        "title": "Verification Status",
        "type": "string"
      },
      "content_sha256": {
        "anyOf": [
          {
            "pattern": "^[0-9a-f]{64}$",
            "type": "string"
          },
          {
            "type": "null"
          }
        ],
        "default": null,
        "title": "Content Sha256"
      },
      "verified_on": {
        "anyOf": [
          {
            "format": "date",
            "type": "string"
          },
          {
            "type": "null"
          }
        ],
        "default": null,
        "title": "Verified On"
      }
    },
    "required": [
      "key",
      "sponsor_language"
    ],
    "title": "SponsorFieldRequirement",
    "type": "object"
  }
} as const;
export const domainSourceParameters={
  "source_context": {
    "additionalProperties": false,
    "properties": {
      "view": {
        "default": "record",
        "enum": [
          "record",
          "proposal",
          "contract"
        ],
        "title": "View",
        "type": "string"
      },
      "proposal_hash": {
        "anyOf": [
          {
            "pattern": "^[0-9a-f]{64}$",
            "type": "string"
          },
          {
            "type": "null"
          }
        ],
        "default": null,
        "title": "Proposal Hash"
      }
    },
    "title": "SourceContext",
    "type": "object"
  },
  "source_links": {
    "additionalProperties": false,
    "properties": {
      "offset": {
        "default": 0,
        "minimum": 0,
        "title": "Offset",
        "type": "integer"
      },
      "limit": {
        "default": 20,
        "maximum": 50,
        "minimum": 1,
        "title": "Limit",
        "type": "integer"
      },
      "context_hash": {
        "anyOf": [
          {
            "pattern": "^[0-9a-f]{64}$",
            "type": "string"
          },
          {
            "type": "null"
          }
        ],
        "default": null,
        "title": "Context Hash"
      }
    },
    "title": "SourceLinks",
    "type": "object"
  },
  "source_capture": {
    "additionalProperties": false,
    "properties": {
      "url": {
        "maxLength": 2000,
        "minLength": 1,
        "title": "Url",
        "type": "string"
      }
    },
    "required": [
      "url"
    ],
    "title": "SourceCapture",
    "type": "object"
  },
  "source_propose": {
    "additionalProperties": false,
    "properties": {
      "context_hash": {
        "pattern": "^[0-9a-f]{64}$",
        "title": "Context Hash",
        "type": "string"
      },
      "fields": {
        "items": {
          "$ref": "#/$defs/FieldAssertion"
        },
        "maxItems": 32,
        "title": "Fields",
        "type": "array"
      },
      "requirements": {
        "items": {
          "$ref": "#/$defs/RequirementAssertion"
        },
        "maxItems": 100,
        "minItems": 1,
        "title": "Requirements",
        "type": "array"
      }
    },
    "required": [
      "context_hash",
      "fields",
      "requirements"
    ],
    "title": "SourceProposal",
    "type": "object"
  },
  "source_review": {
    "additionalProperties": false,
    "properties": {
      "proposal_hash": {
        "pattern": "^[0-9a-f]{64}$",
        "title": "Proposal Hash",
        "type": "string"
      },
      "decision": {
        "enum": [
          "accept",
          "reject"
        ],
        "title": "Decision",
        "type": "string"
      },
      "findings": {
        "items": {
          "maxLength": 5000,
          "minLength": 1,
          "type": "string"
        },
        "maxItems": 100,
        "title": "Findings",
        "type": "array"
      }
    },
    "required": [
      "proposal_hash",
      "decision",
      "findings"
    ],
    "title": "SourceReview",
    "type": "object"
  },
  "source_receipt": {
    "additionalProperties": false,
    "properties": {
      "proposal_hash": {
        "pattern": "^[0-9a-f]{64}$",
        "title": "Proposal Hash",
        "type": "string"
      }
    },
    "required": [
      "proposal_hash"
    ],
    "title": "SourceReceipt",
    "type": "object"
  },
  "source_settlement": {
    "additionalProperties": false,
    "properties": {
      "proposal_hash": {
        "pattern": "^[0-9a-f]{64}$",
        "title": "Proposal Hash",
        "type": "string"
      },
      "findings": {
        "items": {
          "maxLength": 5000,
          "minLength": 1,
          "type": "string"
        },
        "maxItems": 100,
        "minItems": 1,
        "title": "Findings",
        "type": "array"
      }
    },
    "required": [
      "proposal_hash",
      "findings"
    ],
    "title": "SourceSettlement",
    "type": "object"
  }
} as const;
