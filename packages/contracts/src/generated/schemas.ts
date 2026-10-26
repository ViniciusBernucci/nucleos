/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.

export type SchemaName = "ai-completion-request" | "ai-completion-response" | "handshake" | "job-envelope" | "problem-details" | "realtime-event" | "runtime-token" | "subscription-event" | "tenant-runtime-spec" | "tool-call-request" | "tool-call-response";

export const SCHEMA_NAMES: readonly SchemaName[] = ["ai-completion-request","ai-completion-response","handshake","job-envelope","problem-details","realtime-event","runtime-token","subscription-event","tenant-runtime-spec","tool-call-request","tool-call-response"];

export const schemas: Readonly<Record<SchemaName, Readonly<Record<string, unknown>>>> = {
  "ai-completion-request": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://nucleos.invalid/contracts/ai-completion-request.schema.json",
  "x-schema-version": "1.0",
  "title": "AiCompletionRequest - pedido de completion ao AI Gateway",
  "description": "Sem campo de tenant (derivado da identidade, EP-07). model_alias e um alias logico resolvido pelo gateway, nunca o identificador do provedor.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "run_id",
    "agent_id",
    "step_seq",
    "idempotency_key",
    "model_alias",
    "messages"
  ],
  "properties": {
    "schema_version": {
      "const": "1.0",
      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
    },
    "run_id": {
      "$ref": "#/$defs/uuid"
    },
    "agent_id": {
      "$ref": "#/$defs/uuid"
    },
    "step_seq": {
      "type": "integer",
      "minimum": 0
    },
    "idempotency_key": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128,
      "pattern": "^[A-Za-z0-9_.:-]+$"
    },
    "model_alias": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_.-]{0,63}$"
    },
    "messages": {
      "type": "array",
      "minItems": 1,
      "maxItems": 512,
      "items": {
        "$ref": "#/$defs/message"
      }
    },
    "max_output_tokens": {
      "type": "integer",
      "minimum": 1,
      "maximum": 200000
    },
    "temperature": {
      "type": "number",
      "minimum": 0,
      "maximum": 2
    }
  },
  "$defs": {
    "uuid": {
      "type": "string",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    },
    "message": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "role",
        "content"
      ],
      "properties": {
        "role": {
          "enum": [
            "system",
            "user",
            "assistant",
            "tool"
          ]
        },
        "content": {
          "type": "string",
          "maxLength": 200000
        }
      }
    }
  }
},
  "ai-completion-response": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://nucleos.invalid/contracts/ai-completion-response.schema.json",
  "x-schema-version": "1.0",
  "title": "AiCompletionResponse - resposta de completion do AI Gateway",
  "description": "status=ok exige content, finish_reason e usage; status=error exige error.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "status"
  ],
  "properties": {
    "schema_version": {
      "const": "1.0",
      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
    },
    "status": {
      "enum": [
        "ok",
        "error"
      ]
    },
    "model_alias": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_.-]{0,63}$"
    },
    "content": {
      "type": "string",
      "maxLength": 200000
    },
    "finish_reason": {
      "enum": [
        "stop",
        "length",
        "tool_calls",
        "content_filter"
      ]
    },
    "usage": {
      "$ref": "#/$defs/usage"
    },
    "error": {
      "$ref": "#/$defs/error"
    }
  },
  "$defs": {
    "error": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "code",
        "message"
      ],
      "properties": {
        "code": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_]{0,63}$"
        },
        "message": {
          "type": "string",
          "minLength": 1,
          "maxLength": 1024
        }
      }
    },
    "usage": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "input_tokens",
        "output_tokens",
        "cost_micros"
      ],
      "properties": {
        "input_tokens": {
          "type": "integer",
          "minimum": 0
        },
        "output_tokens": {
          "type": "integer",
          "minimum": 0
        },
        "cost_micros": {
          "type": "integer",
          "minimum": 0,
          "description": "Custo em micro-unidades da moeda de faturamento (inteiro: sem ponto flutuante)."
        }
      }
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "status": {
            "const": "ok"
          }
        },
        "required": [
          "status"
        ]
      },
      "then": {
        "required": [
          "content",
          "finish_reason",
          "usage"
        ],
        "not": {
          "required": [
            "error"
          ]
        }
      },
      "else": {
        "required": [
          "error"
        ]
      }
    }
  ]
},
  "handshake": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://nucleos.invalid/contracts/handshake.schema.json",
  "x-schema-version": "1.0",
  "title": "Handshake - enrollment, emissao, JWKS e revogacao (ADR-018)",
  "description": "Mensagens entre runtime, Control Plane (CP) e servicos validadores. Transporte TLS; nenhuma mensagem carrega chave privada. Cada mensagem e validada por referencia a $defs/<nome>.",
  "$defs": {
    "uuid": {
      "type": "string",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    },
    "b64url": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]+$"
    },
    "jwk_publica": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kty",
        "crv",
        "x",
        "kid",
        "use",
        "alg"
      ],
      "properties": {
        "kty": {
          "const": "OKP"
        },
        "crv": {
          "const": "Ed25519"
        },
        "x": {
          "$ref": "#/$defs/b64url"
        },
        "kid": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]+$",
          "maxLength": 64
        },
        "use": {
          "const": "sig"
        },
        "alg": {
          "const": "EdDSA"
        }
      }
    },
    "enrollment_request": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "tenant_id",
        "enrollment_secret",
        "runtime_public_key"
      ],
      "properties": {
        "tenant_id": {
          "$ref": "#/$defs/uuid"
        },
        "enrollment_secret": {
          "type": "string",
          "minLength": 32,
          "description": "Uso unico, expira em minutos, gerado pelo provisioner; nunca logado."
        },
        "runtime_public_key": {
          "$ref": "#/$defs/jwk_publica"
        }
      }
    },
    "enrollment_response": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "tenant_id",
        "ver",
        "runtime_kid"
      ],
      "properties": {
        "tenant_id": {
          "$ref": "#/$defs/uuid"
        },
        "ver": {
          "type": "integer",
          "minimum": 1
        },
        "runtime_kid": {
          "type": "string"
        }
      }
    },
    "token_request": {
      "type": "object",
      "description": "client_assertion e um JWT EdDSA assinado com a chave privada do runtime (header kid = runtime_kid; claims: sub=runtime:<tenant_id>, aud=nucleos-control-plane, jti, iat, exp<=60 s).",
      "additionalProperties": false,
      "required": [
        "client_assertion",
        "audience",
        "scope"
      ],
      "properties": {
        "client_assertion": {
          "type": "string"
        },
        "audience": {
          "enum": [
            "dispatcher",
            "tool-gateway",
            "ai-gateway"
          ]
        },
        "scope": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "string"
          }
        }
      }
    },
    "token_response": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "access_token",
        "token_type",
        "expires_in"
      ],
      "properties": {
        "access_token": {
          "type": "string"
        },
        "token_type": {
          "const": "Bearer"
        },
        "expires_in": {
          "type": "integer",
          "minimum": 1,
          "maximum": 600
        }
      }
    },
    "jwks": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "keys"
      ],
      "properties": {
        "keys": {
          "type": "array",
          "minItems": 1,
          "maxItems": 3,
          "items": {
            "$ref": "#/$defs/jwk_publica"
          }
        }
      }
    },
    "revocation_state": {
      "type": "object",
      "description": "Estado consultavel pelos validadores (poll curto e/ou push de emergencia). Nunca consultado por requisicao.",
      "additionalProperties": false,
      "required": [
        "generated_at",
        "min_ver"
      ],
      "properties": {
        "generated_at": {
          "type": "integer",
          "minimum": 0
        },
        "min_ver": {
          "type": "object",
          "propertyNames": {
            "$ref": "#/$defs/uuid"
          },
          "additionalProperties": {
            "type": "integer",
            "minimum": 1
          }
        },
        "revoked_jti": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Opcional: revogacao pontual de jti ainda vivo."
        }
      }
    }
  }
},
  "job-envelope": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://nucleos.invalid/contracts/job-envelope.schema.json",
  "x-schema-version": "1.0",
  "title": "JobEnvelope - envelope de job do Dispatcher para o runtime",
  "description": "Contrato do job entregue ao runtime (EP-05). O runtime recusa envelope cujo tenant_id difira do seu proprio. assignment_signature assina os campos canonicos (definicao em MSG-001).",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "job_id",
    "tenant_id",
    "type",
    "idempotency_key",
    "attempt",
    "issued_at",
    "expires_at",
    "correlation_id",
    "assignment_signature"
  ],
  "properties": {
    "schema_version": {
      "const": "1.0",
      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
    },
    "job_id": {
      "$ref": "#/$defs/uuid"
    },
    "tenant_id": {
      "$ref": "#/$defs/uuid"
    },
    "type": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_.-]{0,63}$"
    },
    "idempotency_key": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128,
      "pattern": "^[A-Za-z0-9_.:-]+$"
    },
    "attempt": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    },
    "issued_at": {
      "type": "string",
      "format": "date-time"
    },
    "expires_at": {
      "type": "string",
      "format": "date-time"
    },
    "correlation_id": {
      "type": "string",
      "minLength": 8,
      "maxLength": 64,
      "pattern": "^[A-Za-z0-9_-]+$"
    },
    "assignment_signature": {
      "$ref": "#/$defs/assignment_signature"
    },
    "payload": {
      "type": "object",
      "description": "Corpo especifico do tipo de job; validado pelo contrato do tipo (fora deste envelope)."
    }
  },
  "$defs": {
    "uuid": {
      "type": "string",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    },
    "assignment_signature": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kid",
        "alg",
        "value"
      ],
      "properties": {
        "kid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 64,
          "pattern": "^[A-Za-z0-9_-]+$"
        },
        "alg": {
          "const": "EdDSA"
        },
        "value": {
          "type": "string",
          "minLength": 1,
          "pattern": "^[A-Za-z0-9_-]+$"
        }
      }
    }
  }
},
  "problem-details": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://nucleos.invalid/contracts/problem-details.schema.json",
  "x-schema-version": "1.0",
  "title": "ProblemDetails - erro HTTP (RFC 9457)",
  "description": "Corpo de erro da API (application/problem+json). Sem stack trace, SQL, segredos nem PII. additionalProperties=false: extensoes novas entram por versao do contrato.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "type",
    "title",
    "status"
  ],
  "properties": {
    "type": {
      "type": "string",
      "maxLength": 2048,
      "pattern": "^(about:blank|[A-Za-z][A-Za-z0-9+.-]*:[\\u0021-\\u007e]*|/[\\u0021-\\u007e]*)$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256
    },
    "status": {
      "type": "integer",
      "minimum": 400,
      "maximum": 599
    },
    "detail": {
      "type": "string",
      "maxLength": 2048
    },
    "instance": {
      "type": "string",
      "maxLength": 2048,
      "pattern": "^[\\u0021-\\u007e]+$"
    },
    "code": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]{0,63}$"
    },
    "correlation_id": {
      "type": "string",
      "minLength": 8,
      "maxLength": 64,
      "pattern": "^[A-Za-z0-9_-]+$"
    },
    "errors": {
      "type": "array",
      "maxItems": 64,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "pointer",
          "detail"
        ],
        "properties": {
          "pointer": {
            "type": "string",
            "maxLength": 512
          },
          "detail": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1024
          }
        }
      }
    }
  }
},
  "realtime-event": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://nucleos.invalid/contracts/realtime-event.schema.json",
  "x-schema-version": "1.0",
  "title": "RealtimeEvent - evento de tempo real para a interface",
  "description": "Payload minimo e sem conteudo privado (IDs, estados, rotulos); detalhes sao buscados por API autorizada (EP-05).",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "event_id",
    "type",
    "occurred_at",
    "tenant_id",
    "subject"
  ],
  "properties": {
    "schema_version": {
      "const": "1.0",
      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
    },
    "event_id": {
      "$ref": "#/$defs/uuid"
    },
    "type": {
      "enum": [
        "agent.status_changed",
        "run.started",
        "run.progress",
        "run.waiting_approval",
        "run.completed",
        "run.failed",
        "approval.requested",
        "approval.decided",
        "tenant.state_changed",
        "budget.threshold_reached"
      ]
    },
    "occurred_at": {
      "type": "string",
      "format": "date-time"
    },
    "tenant_id": {
      "$ref": "#/$defs/uuid"
    },
    "subject": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "id"
      ],
      "properties": {
        "kind": {
          "enum": [
            "agent",
            "run",
            "approval",
            "tenant",
            "budget"
          ]
        },
        "id": {
          "type": "string",
          "minLength": 1,
          "maxLength": 64,
          "pattern": "^[A-Za-z0-9_.:-]+$"
        }
      }
    },
    "state": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64,
      "pattern": "^[a-z][a-z0-9_.-]*$"
    },
    "data": {
      "type": "object",
      "maxProperties": 16,
      "propertyNames": {
        "pattern": "^[a-z][a-z0-9_]{0,31}$"
      },
      "additionalProperties": {
        "oneOf": [
          {
            "type": "string",
            "maxLength": 128
          },
          {
            "type": "integer"
          },
          {
            "type": "boolean"
          }
        ]
      },
      "description": "Apenas escalares curtos; nada de texto livre longo nem conteudo de usuario."
    }
  },
  "$defs": {
    "uuid": {
      "type": "string",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    }
  }
},
  "runtime-token": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://nucleos.invalid/contracts/runtime-token.schema.json",
  "x-schema-version": "1.0",
  "title": "RuntimeToken - header e claims do token de servico do runtime (ADR-018)",
  "description": "JWT EdDSA (Ed25519) de vida curta emitido pelo Control Plane. Este schema valida o header e os claims decodificados; assinatura, iss/aud/exp e demais checagens semanticas (sub == runtime:<tenant_id>, exp - iat <= 600) ficam no validador (ver runtimeTokenSemanticErrors).",
  "$defs": {
    "uuid": {
      "type": "string",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    },
    "audience": {
      "enum": [
        "dispatcher",
        "tool-gateway",
        "ai-gateway"
      ]
    },
    "header": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "alg",
        "typ",
        "kid"
      ],
      "properties": {
        "alg": {
          "const": "EdDSA"
        },
        "typ": {
          "const": "nucleos-runtime+jwt"
        },
        "kid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 64,
          "pattern": "^[A-Za-z0-9_-]+$"
        }
      }
    },
    "claims": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "iss",
        "sub",
        "aud",
        "scope",
        "tenant_id",
        "jti",
        "iat",
        "exp",
        "ver"
      ],
      "properties": {
        "iss": {
          "const": "nucleos-control-plane"
        },
        "sub": {
          "type": "string",
          "pattern": "^runtime:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "runtime:<tenant_id>; deve ser igual a runtime: + tenant_id (checagem semantica no validador)"
        },
        "aud": {
          "$ref": "#/$defs/audience",
          "description": "Uma unica audiencia por token; sem array."
        },
        "scope": {
          "type": "array",
          "minItems": 1,
          "maxItems": 16,
          "uniqueItems": true,
          "items": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]*:[a-z][a-z0-9_.-]*$"
          }
        },
        "tenant_id": {
          "$ref": "#/$defs/uuid"
        },
        "jti": {
          "type": "string",
          "minLength": 16,
          "maxLength": 64,
          "pattern": "^[A-Za-z0-9_-]+$"
        },
        "iat": {
          "type": "integer",
          "minimum": 0
        },
        "exp": {
          "type": "integer",
          "minimum": 0,
          "description": "exp - iat <= 600 (checagem semantica: TTL maximo 10 min; padrao 300 s)"
        },
        "ver": {
          "type": "integer",
          "minimum": 1,
          "description": "Versao da credencial do runtime; rejeitada se < ver_minima do tenant."
        }
      }
    }
  },
  "type": "object",
  "required": [
    "header",
    "claims"
  ],
  "additionalProperties": false,
  "properties": {
    "header": {
      "$ref": "#/$defs/header"
    },
    "claims": {
      "$ref": "#/$defs/claims"
    }
  }
},
  "subscription-event": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://nucleos.invalid/contracts/subscription-event.schema.json",
  "x-schema-version": "1.0",
  "title": "SubscriptionEvent - evento normalizado de assinatura (ADR-026)",
  "description": "Evento normalizado de assinatura emitido pelo adaptador do provedor (ou pelo simulador) ao Control Plane. Nao carrega dados de cartao nem PII; o payload bruto fica fora, referenciado por raw_payload_ref.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "provider",
    "provider_event_id",
    "event_type",
    "occurred_at",
    "received_at",
    "subscription",
    "simulated"
  ],
  "properties": {
    "schema_version": {
      "const": "1.0"
    },
    "provider": {
      "type": "string",
      "enum": [
        "simulator",
        "stripe",
        "asaas",
        "mercadopago"
      ]
    },
    "provider_event_id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128,
      "pattern": "^[A-Za-z0-9_.:-]+$",
      "description": "Chave de idempotencia junto com provider. Unique (provider, provider_event_id)."
    },
    "event_type": {
      "type": "string",
      "enum": [
        "subscription.created",
        "subscription.activated",
        "subscription.past_due",
        "subscription.suspended_by_provider",
        "subscription.resumed",
        "subscription.plan_changed",
        "subscription.canceled",
        "payment.succeeded",
        "payment.failed",
        "payment.action_required",
        "payment.refunded",
        "payment.disputed"
      ]
    },
    "occurred_at": {
      "type": "string",
      "format": "date-time",
      "description": "Informativo. NAO define ordem de aplicacao (ordem de entrega nao e garantida)."
    },
    "received_at": {
      "type": "string",
      "format": "date-time"
    },
    "simulated": {
      "type": "boolean"
    },
    "subscription": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "provider_subscription_id"
      ],
      "properties": {
        "provider_subscription_id": {
          "type": "string",
          "minLength": 1,
          "maxLength": 128
        },
        "provider_customer_id": {
          "type": "string",
          "minLength": 1,
          "maxLength": 128
        },
        "tenant_id": {
          "type": "string",
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "Presente quando o vinculo ja existe no Control Plane; senao o CP resolve por provider_subscription_id."
        },
        "plan_code": {
          "type": "string",
          "pattern": "^[a-z0-9][a-z0-9_-]{0,63}$"
        },
        "provider_status": {
          "type": "string",
          "minLength": 1,
          "maxLength": 64,
          "description": "Status bruto informado pelo provedor, so para auditoria."
        },
        "current_period_end": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "payment": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "amount_minor",
        "currency"
      ],
      "properties": {
        "provider_invoice_id": {
          "type": "string",
          "minLength": 1,
          "maxLength": 128
        },
        "amount_minor": {
          "type": "integer",
          "minimum": 0
        },
        "currency": {
          "type": "string",
          "pattern": "^[A-Z]{3}$"
        },
        "failure_code": {
          "type": "string",
          "minLength": 1,
          "maxLength": 64
        },
        "attempt_count": {
          "type": "integer",
          "minimum": 1
        },
        "next_retry_at": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "raw_payload_ref": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "description": "Referencia (chave/URI interna) ao payload bruto guardado fora do evento."
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "event_type": {
            "enum": [
              "payment.succeeded",
              "payment.failed",
              "payment.action_required",
              "payment.refunded",
              "payment.disputed"
            ]
          }
        },
        "required": [
          "event_type"
        ]
      },
      "then": {
        "required": [
          "payment"
        ]
      }
    },
    {
      "if": {
        "properties": {
          "event_type": {
            "const": "payment.failed"
          }
        },
        "required": [
          "event_type"
        ]
      },
      "then": {
        "properties": {
          "payment": {
            "type": "object",
            "required": [
              "failure_code",
              "attempt_count"
            ]
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "event_type": {
            "const": "subscription.plan_changed"
          }
        },
        "required": [
          "event_type"
        ]
      },
      "then": {
        "properties": {
          "subscription": {
            "type": "object",
            "required": [
              "provider_subscription_id",
              "plan_code"
            ]
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "provider": {
            "const": "simulator"
          }
        },
        "required": [
          "provider"
        ]
      },
      "then": {
        "properties": {
          "simulated": {
            "const": true
          }
        }
      },
      "else": {
        "properties": {
          "simulated": {
            "const": false
          }
        }
      }
    }
  ]
},
  "tenant-runtime-spec": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://nucleos.invalid/contracts/tenant-runtime-spec.schema.json",
  "x-schema-version": "1.0",
  "title": "TenantRuntimeSpec - especificacao declarativa do runtime de um tenant",
  "description": "Renderizada pelo provisioner (EP-09/PRV-002). Imagens somente por digest; segredos somente por referencia; nenhum valor de segredo no spec.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "tenant_id",
    "images",
    "resources",
    "network",
    "volumes",
    "secrets",
    "modules",
    "limits",
    "endpoints"
  ],
  "properties": {
    "schema_version": {
      "const": "1.0",
      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
    },
    "tenant_id": {
      "$ref": "#/$defs/uuid"
    },
    "images": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "runtime",
        "sidecar"
      ],
      "properties": {
        "runtime": {
          "type": "string",
          "maxLength": 300,
          "pattern": "^[a-z0-9][a-z0-9._/:-]*@sha256:[0-9a-f]{64}$"
        },
        "sidecar": {
          "type": "string",
          "maxLength": 300,
          "pattern": "^[a-z0-9][a-z0-9._/:-]*@sha256:[0-9a-f]{64}$"
        }
      }
    },
    "resources": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "cpu_millis",
        "memory_mib",
        "pids",
        "tmpfs_mib"
      ],
      "properties": {
        "cpu_millis": {
          "type": "integer",
          "minimum": 100,
          "maximum": 64000
        },
        "memory_mib": {
          "type": "integer",
          "minimum": 64,
          "maximum": 262144
        },
        "pids": {
          "type": "integer",
          "minimum": 16,
          "maximum": 65536
        },
        "tmpfs_mib": {
          "type": "integer",
          "minimum": 0,
          "maximum": 65536
        }
      }
    },
    "network": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "name",
        "subnet"
      ],
      "properties": {
        "name": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]{0,62}$"
        },
        "subnet": {
          "type": "string",
          "pattern": "^(10|172\\.(1[6-9]|2[0-9]|3[01])|192\\.168)\\.[0-9]{1,3}(\\.[0-9]{1,3}){0,2}/([0-9]|[12][0-9]|3[0-2])$",
          "description": "CIDR IPv4 privado (RFC 1918)."
        }
      }
    },
    "volumes": {
      "type": "array",
      "maxItems": 16,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "name",
          "mount_path"
        ],
        "properties": {
          "name": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]{0,62}$"
          },
          "mount_path": {
            "type": "string",
            "pattern": "^/[A-Za-z0-9_./-]{1,200}$",
            "not": {
              "pattern": "\\.\\."
            }
          }
        }
      }
    },
    "secrets": {
      "type": "array",
      "maxItems": 32,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "name",
          "ref"
        ],
        "properties": {
          "name": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]{0,62}$"
          },
          "ref": {
            "type": "string",
            "minLength": 1,
            "maxLength": 256,
            "pattern": "^secretref:[A-Za-z0-9_./-]+$",
            "description": "Referencia opaca; o valor nunca trafega no spec."
          }
        }
      }
    },
    "modules": {
      "type": "array",
      "uniqueItems": true,
      "maxItems": 64,
      "items": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9-]{0,62}$"
      }
    },
    "limits": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "max_concurrency",
        "budget_minor"
      ],
      "properties": {
        "max_concurrency": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10000
        },
        "budget_minor": {
          "type": "integer",
          "minimum": 0
        }
      }
    },
    "endpoints": {
      "type": "array",
      "maxItems": 16,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "name",
          "url"
        ],
        "properties": {
          "name": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]{0,62}$"
          },
          "url": {
            "type": "string",
            "maxLength": 256,
            "pattern": "^https?://[a-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9_./-]*)?$"
          }
        }
      }
    }
  },
  "$defs": {
    "uuid": {
      "type": "string",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    }
  }
},
  "tool-call-request": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://nucleos.invalid/contracts/tool-call-request.schema.json",
  "x-schema-version": "1.0",
  "title": "ToolCallRequest - invocacao de ferramenta no Tool Gateway",
  "description": "POST /v1/tools/{tool_name}/invoke. NAO existe campo de tenant: o tenant vem da identidade do sidecar/token (EP-07); additionalProperties=false rejeita qualquer tentativa de informa-lo.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "run_id",
    "agent_id",
    "step_seq",
    "idempotency_key",
    "arguments"
  ],
  "properties": {
    "schema_version": {
      "const": "1.0",
      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
    },
    "run_id": {
      "$ref": "#/$defs/uuid"
    },
    "agent_id": {
      "$ref": "#/$defs/uuid"
    },
    "step_seq": {
      "type": "integer",
      "minimum": 0
    },
    "idempotency_key": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128,
      "pattern": "^[A-Za-z0-9_.:-]+$"
    },
    "arguments": {
      "type": "object"
    }
  },
  "$defs": {
    "uuid": {
      "type": "string",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    }
  }
},
  "tool-call-response": {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://nucleos.invalid/contracts/tool-call-response.schema.json",
  "x-schema-version": "1.0",
  "title": "ToolCallResponse - resultado da invocacao de ferramenta",
  "description": "Resposta do Tool Gateway. status=ok exige result; status=error|denied exige error.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "status"
  ],
  "properties": {
    "schema_version": {
      "const": "1.0",
      "description": "Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major."
    },
    "status": {
      "enum": [
        "ok",
        "error",
        "denied"
      ]
    },
    "result": {
      "description": "Qualquer JSON; presente somente quando status=ok."
    },
    "error": {
      "$ref": "#/$defs/error"
    }
  },
  "$defs": {
    "error": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "code",
        "message"
      ],
      "properties": {
        "code": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_]{0,63}$"
        },
        "message": {
          "type": "string",
          "minLength": 1,
          "maxLength": 1024
        }
      }
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "status": {
            "const": "ok"
          }
        },
        "required": [
          "status"
        ]
      },
      "then": {
        "required": [
          "result"
        ],
        "not": {
          "required": [
            "error"
          ]
        }
      },
      "else": {
        "required": [
          "error"
        ],
        "not": {
          "required": [
            "result"
          ]
        }
      }
    }
  ]
},
};
