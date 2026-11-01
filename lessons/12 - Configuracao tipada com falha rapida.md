# 12 - Configuracao tipada com falha rapida

Criada em 2026-10-26. Ultima atualizacao: 2026-11-01 (rodada de correcao 1: exemplo Python tipado, verificado com `mypy --strict`). Numeracao PROVISORIA (o coordenador reconcilia a posicao na trilha). Exemplos executados com Node 24.22.1 (TypeScript por remocao de tipos nativa, `zod` 4.6.7, tipos conferidos com TypeScript 5.9.3) e Python 3.13 (`pydantic` 2.14.1, `pydantic-settings` 2.16.1).

## Objetivo, pre-requisitos e posicao

Aprender a ler a configuracao de um servico **uma vez, na subida**, converter texto em tipos (porta, duracao, tamanho, URL) e **recusar iniciar** se algo faltar ou for invalido, sem repetir o valor recebido na mensagem. Pre-requisitos: TypeScript `strict` e Python tipado (bloco 1 e 3 do [indice](README.md)). Posicao: bloco 7 (seguranca) logo antes de [13 - Segredos por arquivo e verificacao de vazamento](13%20-%20Segredos%20por%20arquivo%20e%20verificacao%20de%20vazamento.md).

## Modelo mental

- Variavel de ambiente e **texto nao confiavel** vindo de fora do codigo. O esquema e a fronteira: depois dele, o resto do programa so ve tipos validos (`port: number`, `timeoutMs: number`).
- **Falha rapida**: errar na subida (exit 1, antes de abrir a porta) e barato; errar na primeira requisicao, em producao, nao.
- A mensagem de erro e **saida**: ela vai para log e terminal. Por isso lista so o **nome** da variavel e um motivo fixo, nunca o valor (um valor invalido pode ser, por engano, um segredo colado no campo errado).
- Regras que dependem do ambiente (`staging`/`production` exigem banco) ficam no esquema, nao espalhadas pelo codigo.

## Do minimo ao padrao do projeto

Minimo (inseguro): `const port = Number(process.env.PORT ?? 3001)` aceita `"abc"` (vira `NaN`) e `"99999"`.

Padrao do projeto, em TypeScript (`packages/config`, zod):

```ts
import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  PORT: z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().int().min(1).max(65535)).default(3001),
});

function load(env: Record<string, string | undefined>) {
  const r = schema.safeParse(env);
  if (!r.success) {
    // so o caminho do campo e a mensagem do esquema; nunca issue.input
    throw new Error("configuracao invalida: " + r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return r.data;
}

console.log(load({ PORT: "8080" }));          // { APP_ENV: 'local', PORT: 8080 }
try { load({ PORT: "99999-SEGREDO" }); } catch (e) { console.log((e as Error).message); } // sem "SEGREDO"
```

O repositorio acrescenta a isso: duracoes (`30s`), tamanhos (`1mb`), URL sem senha embutida, segredos por ambiente ou arquivo com fontes mutuamente exclusivas (lesson 13). Em Python o equivalente e `pydantic-settings`:

```python
from typing import Literal

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(frozen=True, hide_input_in_errors=True)

    APP_ENV: Literal["local", "staging", "production"] = "local"
    PORT: int = Field(8000, ge=1, le=65535)

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return (init_settings,)  # so o mapa explicito; nao le os.environ por acidente


try:
    Settings.model_validate({"PORT": "99999-SEGREDO"})
except ValidationError as exc:
    print([(e["loc"], e["msg"]) for e in exc.errors(include_input=False)])
```

Detalhe: `BaseSettings` le o ambiente do processo por padrao; restringir as fontes torna o carregamento **testavel** (passa-se um dicionario).

## Conexao com a entrega

`packages/config` (TS) e `packages/config-py` (Python) implementam o esquema; `apps/api/src/main.ts` chama `loadApiConfig()` e sai com codigo 1 em `ConfigError`. Detalhes e evidencias: [documento da entrega](../documentacoes/infraestrutura/2026-10-26-fnd-006-configuracao-tipada-e-ambientes.md).

## Erros comuns e trade-offs

- Ecoar o valor no erro (`received "..."`): vaza segredo colado errado. Teste com um valor sentinela.
- `Number("")` e `0`: trate string vazia como ausente.
- Validar so no uso (tarde demais) ou em varios lugares (divergencia). Valide uma vez e passe o objeto tipado.
- Nao se aplica a dado de negocio da requisicao (use DTOs/contratos) nem a configuracao dinamica por tenant (banco).

## Verificacao e exercicios

- `make test-ts` (8 testes em `packages/config`) e `make test-py` (12 em `packages/config-py`).
- Exercicio 1: acrescente `LOG_LEVEL` (`debug|info|warn|error`) ao esquema e escreva o teste do valor invalido.
- Exercicio 2: por que a mensagem de erro de `DATABASE_URL: "postgres://u:senha@h/db"` nao pode citar a URL?
- Pergunta: o que muda se `PORT` for lida de dentro de um handler em vez de na subida?

## Ambiente tradicional sem perder a validacao

No MVP, a origem do segredo e independente da validacao. A API carrega o .env da raiz antes
de validar; um mapa passado explicitamente ao loader nao consulta esse arquivo. Isso permite
testes deterministas. O valor exportado pelo processo tem precedencia sobre o arquivo.
Python continua recebendo um mapa explicito (por exemplo, os.environ).

Exemplo TypeScript executavel com os pacotes compilados (Node 24 / TS 5.9):

```ts
import { loadApiConfig } from "@nucleos/config";
const config = loadApiConfig({ DATABASE_PASSWORD: "exemplo-didatico" });
console.log(JSON.stringify(config)); // senha aparece como [REDACTED]
```

Nao coloque a senha na URL nem imprima process.env. Teste tambem valor direto + *_FILE
simultaneos (deve falhar), campo vazio (ausente) e erros sem valor sentinela.
Exercicio: por que um .env ignorado pelo Git ainda exige controle de acesso ao host?
Veja a [entrega de .env](../documentacoes/transversal/2026-11-01-configuracao-env-mvp.md).

## Configuracao valida nao garante conexao valida

O esquema valida tipos e campos obrigatorios; ele nao sabe se a senha corresponde ao banco
que esta rodando. Um /healthz 200 confirma o processo HTTP, mas uma rota que consulta o banco
ainda pode falhar. No diagnostico, separe tres camadas: configuracao carregada, autenticacao
no servico e consulta dos dados. SELECT 1 testa conexao sem ler dados de negocio.

O ambiente e carregado na inicializacao do processo. Depois de mudar o .env, reinicie o
consumidor. Em um monorepo, o .env da raiz carregado por next.config pode nao ser observado
pelo watcher do diretorio apps/web: recarregar o navegador nao substitui reiniciar o web.

Um volume PostgreSQL preserva o banco existente. Gerar outro arquivo de credenciais de
desenvolvimento nao muda a senha desse banco. Alinhe a credencial do consumidor ao servico,
valide a conexao sem imprimir valores e preserve o volume. Nao use reset de dados como
correcao de autenticacao. Exercicios: por que o backend pode responder /healthz e falhar no
painel? Qual processo precisa reiniciar quando muda DATABASE_PASSWORD? E VENDAS_API_KEY?

Caso real e validacoes: [continuacao operacional](../documentacoes/financeiro/2026-11-01-atualizacao-manual-hotmart.md#continuacao-operacional-painel-sem-dados-2026-11-01).
