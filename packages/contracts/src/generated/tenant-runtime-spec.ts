/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.
// Fonte: packages/contracts/schemas/tenant-runtime-spec.schema.json

/**
 * Renderizada pelo provisioner (EP-09/PRV-002). Imagens somente por digest; segredos somente por referencia; nenhum valor de segredo no spec.
 */
export interface TenantRuntimeSpec {
  /**
   * Versao semantica do contrato (major.minor). Campo opcional novo = minor; remocao/mudanca = major.
   */
  schema_version: "1.0";
  tenant_id: string;
  images: {
    runtime: string;
    sidecar: string;
  };
  resources: {
    cpu_millis: number;
    memory_mib: number;
    pids: number;
    tmpfs_mib: number;
  };
  network: {
    name: string;
    /**
     * CIDR IPv4 privado (RFC 1918).
     */
    subnet: string;
  };
  /**
   * @maxItems 16
   */
  volumes:
    | []
    | [
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ]
    | [
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        },
        {
          name: string;
          mount_path: string;
        }
      ];
  /**
   * @maxItems 32
   */
  secrets: {
    name: string;
    /**
     * Referencia opaca; o valor nunca trafega no spec.
     */
    ref: string;
  }[];
  /**
   * @maxItems 64
   */
  modules: string[];
  limits: {
    max_concurrency: number;
    budget_minor: number;
  };
  /**
   * @maxItems 16
   */
  endpoints:
    | []
    | [
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ]
    | [
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        },
        {
          name: string;
          url: string;
        }
      ];
}
