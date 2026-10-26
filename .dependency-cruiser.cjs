/** Regras de arquitetura de imports (ENT-FND-002). Executar: pnpm run lint:arch */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "web-nao-importa-api",
      comment: "apps/web nao pode importar de apps/api (acoplamento so via packages/contracts).",
      severity: "error",
      from: { path: "^apps/web/" },
      to: { path: "^apps/api/" },
    },
    {
      name: "api-nao-importa-web",
      comment: "apps/api nao pode importar de apps/web.",
      severity: "error",
      from: { path: "^apps/api/" },
      to: { path: "^apps/web/" },
    },
    {
      name: "apps-nao-importam-outros-apps",
      comment: "Apps so compartilham codigo via packages/contracts (ou packages/sdk).",
      severity: "error",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/([^/]+)/", pathNot: "^apps/$1/" },
    },
    {
      name: "contracts-nao-depende-de-apps",
      comment: "packages/contracts e folha: nao importa apps nem outros packages.",
      severity: "error",
      from: { path: "^packages/contracts/" },
      to: { path: "^(apps|packages/(?!contracts/))" },
    },
    {
      name: "packages-nao-importam-apps",
      comment: "Pacotes compartilhados nunca dependem de aplicacoes.",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "provisioner-so-no-tenant-provisioner",
      comment:
        "SDK/codigo do provisioner nao e importado por outros apps (ver tenant-runtime em Python).",
      severity: "error",
      from: { path: "^apps/(?!tenant-provisioner/)" },
      to: { path: "^apps/tenant-provisioner/" },
    },
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|\\.next|\\.turbo|node_modules)/|\\.d\\.ts$" },
    tsConfig: { fileName: "tsconfig.base.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".json"],
    },
    moduleSystems: ["es6", "cjs"],
  },
};
