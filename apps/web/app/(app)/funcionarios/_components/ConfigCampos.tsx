import type { ObjetoConfig } from "@nucleos/contracts";
const objeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
export function ConfigCampos({ schema, config }: { schema: ObjetoConfig; config: ObjetoConfig }) {
  const props = schema["properties"];
  if (!objeto(props) || Object.keys(props).length === 0)
    return (
      <label>
        Configuração (JSON)
        <textarea name="config" defaultValue={JSON.stringify(config, null, 2)} />
      </label>
    );
  return (
    <>
      {Object.entries(props).map(([nome, s]) => {
        if (!objeto(s)) return null;
        const tipo = s["type"];
        const valor = config[nome] ?? s["default"];
        const titulo = typeof s["title"] === "string" ? s["title"] : nome;
        if (Array.isArray(s["enum"]))
          return (
            <label key={nome}>
              {titulo}
              <select
                name={`cfg:${nome}:${tipo === "number" || tipo === "integer" ? tipo : "string"}`}
                defaultValue={
                  typeof valor === "string" || typeof valor === "number" ? String(valor) : ""
                }
              >
                {s["enum"].map((v: unknown) => (
                  <option key={String(v)} value={String(v)}>
                    {String(v)}
                  </option>
                ))}
              </select>
            </label>
          );
        if (tipo === "boolean")
          return (
            <label key={nome}>
              {titulo}
              <select name={`cfg:${nome}:boolean`} defaultValue={valor === true ? "true" : "false"}>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </label>
          );
        if (tipo === "number" || tipo === "integer")
          return (
            <label key={nome}>
              {titulo}
              <input
                name={`cfg:${nome}:${tipo}`}
                type="number"
                step={tipo === "integer" ? "1" : "any"}
                defaultValue={typeof valor === "number" ? valor : undefined}
                required
              />
            </label>
          );
        if (tipo === "string")
          return (
            <label key={nome}>
              {titulo}
              <input
                name={`cfg:${nome}:string`}
                defaultValue={typeof valor === "string" ? valor : ""}
              />
            </label>
          );
        return (
          <label key={nome}>
            {titulo} (JSON)
            <textarea
              name={`cfg:${nome}:json`}
              defaultValue={JSON.stringify(valor ?? null, null, 2)}
            />
          </label>
        );
      })}
    </>
  );
}
