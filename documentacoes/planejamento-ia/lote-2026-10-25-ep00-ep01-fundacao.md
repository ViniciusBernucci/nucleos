# Lote 2026-10-25 — EP-00 e EP-01 (decisões e fundação)

> **Estado do lote:** planejado, **não executado**. Planejar não autoriza implementar. Para executar: "execute orquestrador-fluxo-ia com este manifesto".
> **Identificador:** `lote-2026-10-25-ep00-ep01-fundacao` · **Data/fuso:** 2026-10-25, America/Sao_Paulo (planejado às 16:41) · **Branch de revisão:** `revisao/2026-10-25-ep00-ep01-fundacao`
> **Estado persistente:** [estado.json](lote-2026-10-25-ep00-ep01-fundacao-estado.json) · **Prompts:** [prompts](lote-2026-10-25-ep00-ep01-fundacao-prompts.md) · **Especificação nova (LOC-001):** [loc-001](lote-2026-10-25-ep00-ep01-fundacao-loc-001.md)

## 1. Demandas

| Incluídas | Origem (especificação canônica) |
| --- | --- |
| EP-00 — 12 de 13 tickets (DEC-001..004, 006..013) | [EP-00/tickets.md](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md) |
| EP-01 — 9 tickets (FND-001..009) | [EP-01/tickets.md](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md) |
| LOC-001 — alinhar `CLAUDE.md`/`AGENTS.md`/lessons à stack TypeScript+Python (nova, decisão do usuário em Q-01) | [loc-001](lote-2026-10-25-ep00-ep01-fundacao-loc-001.md) |

**Excluída do fluxo:** DEC-005 (PoC de rede no host alvo) — `BLOQUEADA_NO_PLANEJAMENTO` por falta de VPS (A-02/Q-03). Permanece no backlog; nenhum ticket do lote depende dela.
**Fora do lote:** EP-02..EP-12. **Sem ID externo** (nenhum vínculo ClickUp; chaves locais = IDs `ENT-*` do backlog).

Convenção de critérios: `AC-n` = n-ésimo item da lista "Critérios de aceite" do ticket na especificação canônica (nada é copiado aqui).

## 2. Decisões da entrevista (origem: usuário, 2026-10-25)

| ID | Decisão | Origem |
| --- | --- | --- |
| D-1 | **Stack vigente = TypeScript (+ Python)**. `CLAUDE.md` e a documentação associada devem ser atualizados (→ LOC-001). Isto também confirma Q-07: ADR de 2026-10-25 substitui a stack .NET. | Resposta direta |
| D-2 | EP-00: tickets documentais/PoC locais agora; PoC de host (DEC-005) bloqueado; DEC-011 e DEC-012 entregues como rascunho. | Resposta direta |
| D-3 | ADR-016..026 nascem **propostos**; só o usuário aceita. Tickets dependentes aguardam o aceite. | Resposta direta |
| D-4 | CI = GitHub Actions (H-04 confirmada; remoto é GitHub). Revisor independente de segurança/threat model = o usuário. | Resposta direta |
| H-1 | Hipótese: "adaptar lessons" (D-1) significa trilha TS/Python/Docker/PostgreSQL/segurança no lugar de C#/.NET. Detalhes em LOC-001; validar com o usuário se discordar. | Inferida — **não aprovada** |
| H-2 | Hipótese: DEC-011 exige responsável legal/DPO ainda não indicado (Q-05, parte legal); o rascunho é entregável, a aceitação não. | Inferida |

Questões abertas (não bloqueiam o lote): Q-02 (equipe/cadência), Q-03 (VPS → DEC-005), Q-05 parte legal, Q-06 (pagamento), Q-08 (aceite de ADR-025: tratado em DEC-013), Q-09 (orçamento de IA, fora do lote).

## 3. Tarefas

Perfis conforme [perfis de risco](../../skills/skills/_shared/perfis-de-risco.md). Spikes que decidem autenticação, dados, identidade, segredos, rede ou contrato entre camadas e infraestrutura de impacto amplo = **critico**; demais = padrao; mudança localizada de documentação/qualidade = simples. Origem do perfil: classificação do planejador (a validar na execução; escopo descoberto pode só elevar).

| Chave | Título | Camada | Perfil · justificativa | Depende de (no lote) | Pré-condição humana | Onda | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FND-001 | Scaffolding do monorepo | monorepo | padrao · base de todo o código, sem regra de negócio | — | toolchain (ver §6) | 1 | PRONTA_PARA_ORQUESTRAR |
| FND-008 | Estrutura documental e ADRs importados | docs | simples · só documentação, reversível | — | — | 1 | PRONTA_PARA_ORQUESTRAR |
| LOC-001 | Atualizar CLAUDE.md/AGENTS.md/lessons para TS+Python | docs/regras | padrao · regras vigentes para todas as sessões | — | — | 1 | PRONTA_PARA_ORQUESTRAR |
| DEC-001 | Threat model STRIDE | docs | critico · ancora todos os controles de segurança | FND-008 | revisão por você | 2 | PRONTA_PARA_ORQUESTRAR |
| DEC-002 | Autenticação (ADR-016) | docs+PoC | critico · autenticação | FND-008 | aceite ADR-016 | 2 | PRONTA_PARA_ORQUESTRAR |
| DEC-003 | Dados e migrations (ADR-017) | docs+PoC | critico · dados/migrations | FND-008 | aceite ADR-017 | 2 | PRONTA_PARA_ORQUESTRAR |
| DEC-004 | Identidade de serviço (ADR-018) | docs+PoC | critico · autenticação entre serviços, caminho crítico | FND-008 | aceite ADR-018 | 2 | PRONTA_PARA_ORQUESTRAR |
| DEC-006 | Gestão de segredos (ADR-020) | docs+PoC | critico · exposição de segredo | FND-008 | aceite ADR-020 | 2 | PRONTA_PARA_ORQUESTRAR |
| DEC-011 | LGPD e provedores de LLM | docs | padrao · rascunho não jurídico | FND-008 | revisão legal/DPO (H-2) | 2 | PRONTA_PARA_ORQUESTRAR |
| DEC-012 | Provedor de pagamento (ADR-026) | docs | padrao · não bloqueia o MVP | FND-008 | aceite ADR-026 | 2 | PRONTA_PARA_ORQUESTRAR |
| FND-002 | Qualidade, linters e hooks | monorepo | simples · tooling local, reversível | FND-001 | — | 2 | PRONTA_PARA_ORQUESTRAR |
| FND-004 | Ambiente local Docker Compose | infra | padrao · ambiente descartável, só 127.0.0.1 | FND-001 | — | 2 | PRONTA_PARA_ORQUESTRAR |
| FND-009 | Baseline de observabilidade | monorepo | padrao · redação de dados sensíveis testada | FND-001 | — | 2 | PRONTA_PARA_ORQUESTRAR |
| FND-005 | Pipeline de CI bloqueante | infra | critico · infraestrutura de impacto amplo (gate de merge, segredos) | FND-001, FND-002 | branch protection é ação manual no GitHub | 3 | PRONTA_PARA_ORQUESTRAR |
| DEC-010 | Telemetria e redação (ADR-024) | docs+PoC | padrao | FND-009 | aceite ADR-024 | 3 | PRONTA_PARA_ORQUESTRAR |
| DEC-007 | Orquestração durável (ADR-021) | docs+PoC | padrao · spike com PoC descartável | DEC-003, DEC-004 | **ADR-017 e ADR-018 aceitos** | 3 | PRONTA_AGUARDA_ACEITE_ADR |
| DEC-009 | Storage e autorização (ADR-023) | docs+PoC | critico · isolamento de dados (SEC-08) | DEC-006 | **ADR-020 aceito** | 3 | PRONTA_AGUARDA_ACEITE_ADR |
| DEC-013 | Acesso da UI e Tool Gateway (ADR-025) | docs | critico · modelo de credenciais e contrato | DEC-004 | **ADR-018 aceito**; Q-08 | 3 | PRONTA_AGUARDA_ACEITE_ADR |
| FND-003 | Contratos TS/Python | contratos | critico · contrato entre camadas | FND-001, DEC-003, DEC-004 | **ADR-017 e ADR-018 aceitos** | 3 | PRONTA_AGUARDA_ACEITE_ADR |
| FND-006 | Configuração tipada e ambientes | infra | critico · segredos e configuração de produção | FND-004, DEC-006 | **ADR-020 aceito** | 3 | PRONTA_AGUARDA_ACEITE_ADR |
| DEC-008 | Framework de agentes (ADR-022) | docs+PoC | padrao · spike | DEC-004, DEC-007 | **ADR-018 e ADR-021 aceitos** | 4 | PRONTA_AGUARDA_ACEITE_ADR |
| FND-007 | Borda: proxy, TLS, cabeçalhos | infra | critico · superfície pública | FND-006 | — | 4 | PRONTA_AGUARDA_ACEITE_ADR (herda FND-006) |
| DEC-005 | PoC de isolamento de rede no host | host | critico · isolamento entre tenants | — | **VPS alvo (Q-03)** | — | BLOQUEADA_NO_PLANEJAMENTO |

"PRONTA_AGUARDA_ACEITE_ADR": critérios, contratos, plano e validação estão definidos; a execução só começa depois que o usuário muda o ADR indicado para "aceito". Isso é prontidão técnica, não autorização.

## 4. Grafo e ordem

Sem ciclos (verificado: toda dependência aponta para onda anterior).

```
Onda 1: FND-001  FND-008  LOC-001
Onda 2: DEC-001 DEC-002 DEC-003 DEC-004 DEC-006 DEC-011 DEC-012   (← FND-008)
        FND-002 FND-004 FND-009                                    (← FND-001)
Onda 3: FND-005 (← 001,002)   DEC-010 (← FND-009)
        DEC-007 (← 003,004)   DEC-009 (← 006)   DEC-013 (← 004)   FND-003 (← 001,003,004)   FND-006 (← 004,006)
Onda 4: DEC-008 (← 004,007)   FND-007 (← FND-006)
```

Execução recomendada em **duas passagens** do orquestrador (a aceitação de ADR é humana e o orquestrador não tem checkpoints):
1. **Passagem A:** ondas 1 e 2, mais FND-005 e DEC-010. Ao final, o usuário revisa e aceita ADR-016/017/018/020 (e demais) e o threat model (DEC-001).
2. **Passagem B:** DEC-007, DEC-009, DEC-013, FND-003, FND-006, depois DEC-008 e FND-007.

**Integração:** commits locais nas branches de tarefa; merge sequencial na ordem das ondas em `revisao/2026-10-25-ep00-ep01-fundacao` (um grupo; sem incompatibilidade, não há sufixo `-2`). Perfil do grupo = critico (maior membro).

**Pontos de contenção (resolver na integração):** `Makefile` e configs de raiz (FND-001/002/004/005/009: cada tarefa só acrescenta seu bloco); `documentacoes/arquitetura/adr/` (cada DEC cria só seu arquivo ADR); `packages/contracts` (somente FND-003; DEC-004 entrega o schema como proposta em `documentacoes/` e FND-003 o importa); `CLAUDE.md`/`AGENTS.md` (somente LOC-001).

## 5. Base e branches

| Item | Valor |
| --- | --- |
| Repositório | `nucleos` (raiz `/home/vinicius/nucleos`, camada monorepo) |
| Base | branch `developer` @ `c3c0ba4db42694b847fe0ac2a58f6b7ff7a3d9a7`, árvore limpa no planejamento |
| Branch por tarefa | `tarefa/<chave-minúscula>`, ex.: `tarefa/fnd-001`, `tarefa/dec-004` |
| Worktrees | `/home/vinicius/nucleos-worktrees/tarefa/<chave-minúscula>` (pasta ainda não existe) |
| Ondas 2+ | base = `revisao/2026-10-25-ep00-ep01-fundacao` no SHA após integrar as dependências |
| Proibido | main/master, push, PR, publicação externa, commits fora do pedido explícito de execução |

## 6. Recursos e riscos

| # | Item | Situação verificada | Ação |
| --- | --- | --- | --- |
| R-1 | Toolchain | Docker 29.8.1, Node v22.23.3, `make` presentes; **Python 3.10.12 (ADR exige ≥ 3.12); `pnpm` e `uv` ausentes** | FND-001 instala/fixa versões sem alterar o sistema global às escondidas (via corepack/`uv python install`); se não for possível, FND-001 fica BLOQUEADA com evidência. Registrar versões reais. |
| R-2 | Dados/serviços | Não há banco nem serviço declarado. PoCs usam apenas containers descartáveis em `127.0.0.1`, sem dados reais | LOC-001 declara isso em `CLAUDE.md` ("Dados"); sem a declaração mergeada, PoCs com banco não rodam (executar LOC-001 antes — está na onda 1). |
| R-3 | Config de contexto divergente | `.contexto/project.json` ainda aponta `docs/planejamento/ia` e fuso UTC; `scripts/contexto-projeto.json` (versionado) aponta `documentacoes/planejamento-ia` e America/Sao_Paulo | `CLAUDE.md` prevalece (este manifesto segue `documentacoes/`). Sugestão: rodar `bash scripts/instalar-contexto.sh` antes de executar; não feito no planejamento. |
| R-4 | `lessons/` não existe | `CLAUDE.md` exige `lessons/README.md` | LOC-001 cria a trilha; FND-001 cria só `lessons/.gitkeep` e não toca em `lessons/README.md`. |
| R-5 | Cadeia de aceite humano | ADR-017/018/020 travam 6 tickets | Passagens A/B; priorizar o aceite de ADR-018 (caminho crítico) |
| R-6 | Branch protection e revisores | Exige configuração manual no GitHub (FND-005) | Entregar instruções; não executar via API sem pedido |
| R-7 | Validação de código | Nenhum comando de build/teste existe até FND-001 | FND-001 declara os comandos reais em `CLAUDE.md`; antes disso gates de código = BLOCKED (docs-only = NA com justificativa) |
| R-8 | Datas dos spikes | Versões de Node/NestJS/Next.js/provedores mudam | Cada tarefa registra versão e data consultadas; sem memória |

## 7. Registro desta etapa de planejamento

Nenhum código, ADR, regra ou backlog de tarefa foi alterado, exceto a nota de replanejamento em [backlog/README.md](../backlog/README.md#8-replanejamento-do-lote-2026-10-25) (decisões Q-01/Q-04/Q-05/Q-07). Nenhum commit criado nesta tarefa; arquivos novos: este manifesto, o estado, os prompts e a especificação LOC-001. Como a etapa é só planejamento, não há lessons nem documento de entrega a produzir.
