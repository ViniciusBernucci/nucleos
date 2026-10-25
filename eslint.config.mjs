// ESLint (flat config) com regras type-aware. Ver documentacoes/engenharia (FND-002).
import js from "@eslint/js";
import security from "eslint-plugin-security";
import tseslint from "typescript-eslint";

// O runner de regressao (tools/qualidade/regressao.mjs) liga esta variavel para lintar os
// arquivos que DEVEM falhar; no uso normal eles ficam ignorados.
const regressao = process.env.NUCLEOS_LINT_REGRESSAO === "1";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.run/**",
      "**/node_modules/**",
      "**/next-env.d.ts", // gerado pelo Next.js (REVIEW-004): versionado, nao linta
      ...(regressao ? [] : ["tools/qualidade/regressao/**"]), // fixtures que DEVEM falhar
      "skills/**",
      ".claude/**",
      ".agents/**",
      ".agent/**",
    ],
  },
  {
    files: [
      "apps/**/*.{ts,tsx}",
      "packages/**/*.ts",
      ...(regressao ? ["tools/qualidade/regressao/ts/*.ts"] : []),
    ],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      security.configs.recommended,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Proibe any explicito e todo fluxo de any (implicito ou vindo de libs).
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      // Proibe eval / new Function / setTimeout(string) e equivalentes.
      "no-eval": "error",
      "no-new-func": "error",
      "no-implied-eval": "off",
      "@typescript-eslint/no-implied-eval": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // node:test devolve Promise nos registros de teste; nao e promessa esquecida.
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            { from: "package", package: "node:test", name: ["test", "it", "describe", "suite"] },
          ],
        },
      ],
    },
  },
  {
    // Controllers/modulos NestJS usam decorators e classes sem estado por design.
    files: ["apps/api/**/*.ts"],
    rules: { "@typescript-eslint/no-extraneous-class": "off" },
  },
  {
    // Testes indexam objetos de fixtures conhecidos; a regra gera ruido sem risco real.
    files: ["**/*.test.ts"],
    rules: {
      "security/detect-object-injection": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
);
