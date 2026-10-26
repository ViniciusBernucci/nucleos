# Acesso da UI aos dados do tenant e posição do Tool Gateway (DEC-013) — 2026-10-26

## 1. Metadados

- **Domínio:** arquitetura
- **Tarefa/solicitação:** [ENT-DEC-013](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-013) (lote 2026-10-25-ep00-ep01-fundacao; perfil CRÍTICO, documental)
- **Branch:** `tarefa/dec-013`
- **Base / commit inicial:** `d00e8dff92f468044558d85d80bd464eef09d32a` (informada pelo coordenador; `HEAD` inicial idêntico)
- **Estado da árvore no início:** limpa (worktree nova)
- **Estado da entrega:** pronta para revisão independente. ADR-025 permanece **Proposto**: o aceite (Q-08) é do usuário, portanto o AC-1 ("ADR-025 aceito") **não está cumprido** por decisão de processo.
- **Autores conhecidos:** Claude Sonnet 5.5 (executor)

## 2. Objetivo, contexto e escopo

- **Objetivo:** decidir (propor) como a UI lê dados privados do tenant e onde roda o Tool Gateway, com a matriz de quem detém cada credencial.
- **Contexto:** o consolidado (4, 6.1.9, 8.2, 14) é ambíguo sobre os dois pontos; ADR-016/017/018/020 já aceitos fixam sessão, bancos, identidade de serviço e segredos.
- **Escopo:** ADR-025 (Proposto) com diagrama, matriz de credenciais, papéis PostgreSQL com privilégios exatos, rede, fluxo ponta a ponta com 11 pontos de autorização, orçamento de RAM, impacto em SEC-02/05/09 e lista de decisões humanas; PoC efêmero dos privilégios; lesson 09; índices.
- **Fora do escopo:** código de produto; alteração do ADR-018 (aceito; o ADR-025 propõe um adendo); definição do inventário real de tabelas (DAT-001/002); medição real de RAM do sidecar; ticket de RISK-013; alteração do consolidado.

## 3. Resumo da implementação

Proposta 1-A + 2-Y: o CP faz proxy para uma Tenant API somente leitura do runtime, usando uma asserção de leitura de usuário (JWT EdDSA, audiência única `tenant-api:<tenant>`, TTL ≤ 60 s); o Tool Gateway é um sidecar por tenant com o papel PostgreSQL `tools`, as credenciais de integração e a chave de storage apenas daquele tenant, recebendo política, JWKS e revogação por bundle assinado empurrado pelo CP (fail-closed após `max_staleness`). Quatro papéis por tenant (`owner`, `migrator`, `app`, `tools`) foram verificados em PostgreSQL 16.15 efêmero: 40 verificações, `PASS=40 FAIL=0`. Orçamento de RAM com sidecar de 128 MiB (hipótese): 11,13 GiB com 5 tenants, teto de 14 tenants até 70% de RAM.

## 4. Mudanças por arquivo

| Arquivo | Tipo | Descrição |
| --- | --- | --- |
| `documentacoes/arquitetura/adr/0025-acesso-da-ui-aos-dados-do-tenant-e-posicao-do-tool-gateway.md` | doc (novo) | ADR-025, status Proposto |
| `documentacoes/arquitetura/adr/README.md` | doc | linha do ADR-025 no índice |
| `documentacoes/arquitetura/poc/dec-013/run.sh` | PoC descartável (novo) | provisiona 2 tenants sintéticos e 1 banco de controle e executa as verificações de privilégio |
| `documentacoes/arquitetura/poc/dec-013/README.md` | doc (novo) | como reproduzir, limites do PoC, achado de `CONNECT` em `postgres`/`template1` |
| `documentacoes/arquitetura/poc/dec-013/evidencia/saida.txt` | evidência (novo) | saída real da execução final |
| `lessons/09 - Papeis e privilegios minimos no PostgreSQL.md` | lesson (nova) | numeração provisória |
| `lessons/README.md` | doc | entrada da lesson 09 |
| `documentacoes/arquitetura/2026-10-26-dec-013-acesso-ui-e-tool-gateway.md` e `...-diffs.md` | doc (novos) | este registro e o patch do script |

Sem alteração de configuração, banco real ou migração.

## 5. Decisões técnicas, alternativas e consequências

Detalhadas no ADR-025 (alternativas 1-B, 1-C, 1-D, 2-X, 2-Z e pull com identidade própria rejeitadas ou adiadas). Pontos que merecem atenção do revisor:

- Duas **exceções** ao critério "nenhum componente compartilhado detém credencial de banco de múltiplos tenants": provisioner (papel administrativo e `migrator` em lote) e broker de segredos (ADR-020). Foram declaradas em vez de escondidas; o aceite do critério depende de H-2.
- O sidecar não tem identidade no CP: o bundle assinado (push) dispensa novo `sub` no ADR-018 e egress para o CP.
- Asserções de usuário são um tipo novo (`typ=nucleos-ui-read+jwt`) que exige adendo ao ADR-018 (H-3); duas asserções por requisição de conteúdo preservam "audiência única".
- RISK-013 não é resolvido: o ADR dá o ponto de aplicação e o campo `ator`, não a regra de reavaliação na execução assíncrona.

## 6. Validações

Ambiente: Docker 29.8.1; imagem `postgres:16-alpine` (PostgreSQL 16.15); sem porta publicada; container destruído ao final (`docker ps -a --filter name=dec013` retornou 0).

| Comando | Resultado |
| --- | --- |
| `PATH=$HOME/.local/bin:$PATH ./run.sh \| tee evidencia/saida.txt` (em `documentacoes/arquitetura/poc/dec-013`) | `== resumo: PASS=40 FAIL=0`, exit 0 |
| mesmo script, 1ª execução (antes de corrigir o harness) | `PASS=39 FAIL=1`: o loopback da imagem usa `trust`, então "senha errada" não era negada; corrigido conectando pelo IP do container e adicionado controle que prova `password authentication failed` |
| SQL do exemplo da lesson 09 extraído e executado em PostgreSQL 16 efêmero | `count 0`; `permission denied for table messages` e `permission denied for schema content`, como documentado |
| Conferência aritmética do orçamento de RAM (tabela do ADR) | recalculada à mão: 10,81 / 11,13 / 11,75 GiB; tetos 15 / 14 / 11 / 17 tenants |

Não executados: `make lint`/`make test`/`make build` (a entrega não altera código de produto nem os workspaces; sem alvo aplicável), `pnpm`, ESLint, ruff, mypy; validação de links por ferramenta (conferidos por `grep`/inspeção, ver seção 10). CI: entrega documental, NA com esta justificativa. Revisão independente e QA ficam com sessões separadas do orquestrador.

## 7. Impactos, riscos, compatibilidade, observabilidade e rollback

- **Impacto:** nenhum em runtime; desbloqueia o desenho de RUN-001, TGW-001/003, WEB-003/004, DAT-001/002/005 e PRV-004 após o aceite.
- **Riscos:** RAM do sidecar é hipótese; redes de controle por tenant e pools de endereços do Docker não foram validados; limites de conexão (22 por tenant) vs `max_connections`; CP continua capaz de ler dados de qualquer tenant pela Tenant API (inerente ao desenho 1-A).
- **Observabilidade:** o ADR exige métricas de rejeição (`revocation_state_stale`, asserção inválida) e trilha `audit.tool_invocations`; sem implementação nesta entrega.
- **Rollback:** reverter o commit; o ADR é Proposto e o consolidado não foi alterado.

## 8. Commits e diffs

- **Commit da implementação:** `aa09765` — `docs(arquitetura): ADR-025 acesso da UI aos dados do tenant e Tool Gateway (DEC-013)` (7 arquivos, 498 inserções). Um segundo commit local adiciona este documento e o de diffs; seu SHA consta no relatório de retorno e em `git log` (um documento não pode conter o SHA do commit que o cria).
- **Patch do script do PoC (único artefato executável):** [2026-10-26-dec-013-acesso-ui-e-tool-gateway-diffs.md](2026-10-26-dec-013-acesso-ui-e-tool-gateway-diffs.md).
- Os demais arquivos do commit são documentação em `documentacoes/` e `lessons/`; pela regra de não recursão do `CLAUDE.md` não têm patch embutido e estão listados na seção 4. `git diff --stat d00e8df..aa09765` os reproduz.

## 9. Lessons

Criada [lessons/09 - Papeis e privilegios minimos no PostgreSQL.md](../../lessons/09%20-%20Papeis%20e%20privilegios%20minimos%20no%20PostgreSQL.md) (numeração provisória; não existem 04 a 08 nesta branch) e indexada em [lessons/README.md](../../lessons/README.md). Conceitos de TypeScript, Python e Docker não foram exercitados além do uso de Docker como ambiente descartável do PoC; sem lesson adicional por não haver conceito novo. A lesson de identidade/JWT segue pendente para a entrega que implementar o ADR-018 (ver DEC-004).

## 10. Conferência final

Releitura feita após a última edição: ADR, README do PoC, lesson e este documento coerentes com a saída real (40 verificações, números de RAM recalculados). Links relativos conferidos por inspeção: `../../lessons/...` a partir de `documentacoes/arquitetura/`, `../../../lessons/...` a partir de `adr/`. Datas: 2026-10-26 (local, America/Sao_Paulo).

## 11. Pendências

- **Decisões humanas (H-1 a H-10 do ADR-025):** aceite 1-A + 2-Y (Q-08); interpretação do critério com as exceções E-1/E-2; adendo ao ADR-018 e chaves por finalidade; bundle por push e intervalos; reserva de RAM do sidecar; esquemas/tabelas e pooler; rede de controle; ticket do RISK-013; fluxo OAuth pelo CP; numeração dos testes novos.
- **AC-1** só se cumpre com o aceite do usuário; **AC-2** (orçamento de RAM) está revisado, mas com valor de sidecar não medido; **AC-3** (fluxo ponta a ponta com pontos de autorização) cumprido na tabela P1–P11.
- Medir o sidecar em RUN-001/TGW-001; validar redes por tenant em FND-004/PRV; revisão independente e QA.
