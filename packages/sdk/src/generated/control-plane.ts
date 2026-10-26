/* eslint-disable */
// GERADO por packages/contracts/scripts/gerar.mjs a partir de packages/contracts - NAO EDITAR. Regenerar: make contracts-gen.
// Fonte: packages/contracts/openapi/control-plane.openapi.json

export interface paths {
    readonly "/healthz": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Saude do componente */
        readonly get: operations["getHealth"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        readonly ProblemDetails: components["schemas"]["problem-details.schema"];
        readonly HealthResponse: {
            /** @constant */
            readonly status: "ok";
            readonly service: string;
        };
        /**
         * ProblemDetails - erro HTTP (RFC 9457)
         * @description Corpo de erro da API (application/problem+json). Sem stack trace, SQL, segredos nem PII. additionalProperties=false: extensoes novas entram por versao do contrato.
         */
        readonly "problem-details.schema": {
            readonly type: string;
            readonly title: string;
            readonly status: number;
            readonly detail?: string;
            readonly instance?: string;
            readonly code?: string;
            readonly correlation_id?: string;
            readonly errors?: readonly {
                readonly pointer: string;
                readonly detail: string;
            }[];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    readonly getHealth: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Componente saudavel */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["HealthResponse"];
                };
            };
            /** @description Erro */
            readonly default: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/problem+json": components["schemas"]["problem-details.schema"];
                };
            };
        };
    };
}
