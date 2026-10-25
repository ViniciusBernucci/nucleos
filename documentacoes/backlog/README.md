# Backlog — NÚCLEOS Enterprise (primeira parte: MVP, Cenário A)

> **Fonte:** [ADR de arquitetura SaaS multi-tenant (2026-10-25)](../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md) · **Data:** 2026-10-25 · **Estado:** proposta de planejamento — nenhum item afirma implementação (o repositório não possui código; `back/` e `front/` estão vazios).
> **Escopo:** Entregas 1 a 5 do ADR (seção 17) para até 5 empresas em 1 VPS com Docker Compose, terminando no **gate de segurança SEC-01..18 e no go/no-go** do primeiro cliente real. A Entrega 6 (escala) está em [futuro.md](futuro.md).

## 1. Visão geral

| Item | Valor |
| --- | ---: |
| Épicos | 13 (EP-00 a EP-12) |
| Tickets | 110 (13 decisões/PoCs e 97 de construção, qualidade e operação) |
| Sprints | 12 (S00–S11), lotes de escopo sem datas |
| Marcos | 5 (M1–M5, alinhados às Entregas 1–5 do ADR) |
| Testes de gate cobertos | 18 de 18 ([rastreabilidade](rastreabilidade.md)) |
| ADRs novos a produzir | 11 (ADR-016 a ADR-026) |

**Prioridade absoluta herdada do ADR:** impedir acesso entre tenants, inclusive por agentes de IA e ferramentas, por camadas independentes (identidade, autorização, banco, storage, filas, ferramentas, rede, testes) e nunca por instrução de prompt.

## 2. Épicos

| Épico | Pasta | Prefixo | Tickets | Sprints |
| --- | --- | --- | ---: | --- |
| EP-00 Decisões, PoCs e threat model | [EP-00](EP-00-decisoes-pocs-e-threat-model/README.md) | DEC | 13 | S00–S07 |
| EP-01 Fundação do monorepo, ambientes e CI | [EP-01](EP-01-fundacao-monorepo-ambientes-ci/README.md) | FND | 9 | S00–S04 |
| EP-02 Control Plane: identidade e autorização | [EP-02](EP-02-control-plane-identidade-e-autorizacao/README.md) | IAM | 10 | S01–S09 |
| EP-03 Dados segregados: PostgreSQL, storage, backup | [EP-03](EP-03-dados-segregados-postgres-storage-backup/README.md) | DAT | 9 | S02–S07 |
| EP-04 Isolamento de host, containers e rede | [EP-04](EP-04-isolamento-host-containers-e-rede/README.md) | ISO | 8 | S01–S08 |
| EP-05 Dispatcher, filas e eventos | [EP-05](EP-05-dispatcher-filas-e-eventos/README.md) | MSG | 7 | S04–S08 |
| EP-06 Tenant Runtime e agentes | [EP-06](EP-06-tenant-runtime-e-agentes/README.md) | RUN | 7 | S04–S06 |
| EP-07 Tool Gateway e AI Gateway | [EP-07](EP-07-tool-gateway-e-ai-gateway/README.md) | TGW / AIG | 9 | S05–S07 |
| EP-08 Memória e RAG | [EP-08](EP-08-memoria-e-rag/README.md) | RAG | 4 | S07–S09 |
| EP-09 Provisionamento ponta a ponta | [EP-09](EP-09-provisionamento-ponta-a-ponta/README.md) | PRV | 12 | S07–S10 |
| EP-10 Interface web e prédio 3D | [EP-10](EP-10-interface-web-e-predio-3d/README.md) | WEB | 9 | S04–S10 |
| EP-11 Observabilidade e operação | [EP-11](EP-11-observabilidade-e-operacao/README.md) | OBS | 5 | S07–S09 |
| EP-12 Gate de segurança e go/no-go | [EP-12](EP-12-gate-de-seguranca-e-go-no-go/README.md) | GATE | 8 | S10–S11 |

Cada pasta contém `README.md` (objetivo, escopo, tabela de tickets, critério de saída, riscos) e `tickets.md` (especificação técnica de cada ticket). Outros documentos: [plano-de-sprints.md](plano-de-sprints.md) · [rastreabilidade.md](rastreabilidade.md) · [futuro.md](futuro.md).

## 3. Como ler um ticket

Cabeçalho: sprint, prioridade (Crítica/Alta/Média/Baixa), tamanho (S/M/L, **complexidade relativa, não horas**; XL deve ser dividido antes de entrar em sprint), risco (BAIXO/MÉDIO/ALTO/CRÍTICO) e tipo. Em seguida: dependências, referências (ADR/SEC), objetivo, **especificação técnica**, fora do escopo, **critérios de aceite** observáveis, testes e riscos. Os IDs completos são `ENT-<PREFIXO>-<NNN>`; nas tabelas e dependências usa-se a forma curta (ex.: `DAT-002`).

### Definition of Ready

Um ticket entra em sprint quando: objetivo, escopo, aceite e dependências estão claros; os ADRs/decisões de que depende estão **aceitos** (não apenas propostos); contratos afetados identificados; implicações de segurança e testes definidos; pendências bloqueadoras resolvidas ou registradas como assunção.

### Definition of Done (todo ticket, além do aceite específico)

- Implementação e cenários de erro atendem ao ticket; testes relevantes, análise estática, formatação e build passam.
- **Isolamento**: se o ticket toca tenant, identidade, dados, rede, ferramentas ou filas, existe teste A/B (usar o harness de IAM-010 ou a suíte do épico) com sentinelas.
- Migrações versionadas, seguras e com estratégia de recuperação (roll-forward).
- Logs/métricas úteis sem segredos, prompts ou dados pessoais; redação testada.
- Contratos (`packages/contracts`) e documentação operacional atualizados; rollback descrito.
- Documentação de entrega e lessons conforme `CLAUDE.md` (ver Q-01 sobre adaptação à stack).
- Nenhuma refatoração alheia; nenhuma simulação apresentada como integração real; sem segredos em código, diff ou documentação.
- **Revisão independente**: o autor não aprova a própria entrega; componentes sob `CODEOWNERS` de segurança exigem segundo revisor.

### Estados

proposto → pronto para implementar → em andamento → pronto para revisão → em QA → concluído | bloqueado. Só marcar *concluído* com evidência dos critérios e testes executados.

## 4. Premissas, hipóteses e questões

### Assunções

| ID | Assunção | Impacto se falsa | Validar? |
| --- | --- | --- | --- |
| A-01 | Cenário A: até 5 tenants, 1 VPS Linux, Docker Compose (ADR seção 4) | Replanejar capacidade/isolamento | Não |
| A-02 | A VPS alvo (Ubuntu LTS) estará disponível e administrável até a S01 | DEC-005/ISO-001 atrasam o caminho crítico | **Sim** (Q-03) |
| A-03 | Sprints não têm duração definida; tamanhos são relativos | Datas só após medir velocidade | **Sim** (Q-02) |
| A-04 | Não há módulos de negócio reais nesta parte: agentes de demonstração, ferramentas internas e um conector *mock*; Hotmart/CRM/fiscal ficam para a segunda parte | Escopo cresceria | **Sim** (Q-07) |
| A-05 | Hipóteses de partida dos spikes (DEC-*) são pontos de partida, **não decisões**; só ADR aceito autoriza implementar | — | Não |
| A-06 | Existe ao menos uma pessoa independente para revisão de segurança e uma para revisão legal | GATE-004/007 bloqueiam | **Sim** (Q-05) |

Hipótese H-04: CI em GitHub Actions (FND-005), até confirmação (Q-04).

### Questões em aberto (decisão humana)

| ID | Questão | Quem decide | Bloqueia |
| --- | --- | --- | --- |
| Q-01 | `CLAUDE.md`, `AGENTS.md` e a trilha `lessons/` assumem **C#/.NET**; o ADR escolhe **TypeScript/NestJS/Next.js e Python**. As regras de documentação de entrega continuam aplicáveis; a trilha didática deve passar a cobrir TS/Python/Docker/PostgreSQL/segurança? | Vinícius | Definition of Done (lessons), FND-008 |
| Q-02 | Tamanho e dedicação da equipe e cadência das sprints | Vinícius | Datas e fatiamento final |
| Q-03 | Provedor, plano e acesso à VPS (o ADR cita preço de referência, não o contrato) | Vinícius | DEC-005, ISO-001 |
| Q-04 | Onde o repositório é hospedado (CI) | Vinícius | FND-005 |
| Q-05 | Quem será o revisor independente de segurança e o responsável legal/DPO | Vinícius | GATE-004, GATE-007, DEC-011 |
| Q-06 | Provedor de pagamento preferido (não bloqueia: MVP usa simulador) | Vinícius | DEC-012 |
| Q-07 | Confirmar que a Especificação Mestra e o backlog de 2026-09-22 (stack .NET) ficam **substituídos em stack** pelo ADR de 2026-10-25, mantendo-se como insumo de produto para a segunda parte | Vinícius | FND-008, planejamento da parte 2 |
| Q-08 | Aceita a hipótese do ADR-025 (UI lê via Tenant API do runtime; Tool Gateway como sidecar por tenant)? Implica RAM extra por tenant | Vinícius + arquiteto | RUN-001, TGW-001 |
| Q-09 | Orçamento mensal de IA padrão por tenant e política ao atingir 100% (bloqueio × degradação) | Vinícius | AIG-002 |

## 5. Divergências e lacunas encontradas (arquiteto)

O ADR de 2026-10-25 **não foi alterado**. A decomposição revelou sete lacunas (L-01..L-07 em [rastreabilidade.md](rastreabilidade.md#4-lacunas-do-adr-encontradas-pela-decomposição)), as principais: caminho de leitura da UI aos dados privados do tenant e posição do Tool Gateway (DEC-013), escolha de autenticação (DEC-002), acesso do provisioner ao daemon Docker (PRV-003) e orçamento de RAM sem o sidecar (RUN-007). Cada uma tem ticket de decisão antes de qualquer implementação afetada. Decisão proposta **não** é decisão aceita: tickets que dependem de ADR novo só entram em execução depois dele.

## 6. Riscos principais do plano

| Risco | Prob. | Impacto | Mitigação |
| --- | --- | --- | --- |
| Decisões de S00/S01 (DEC-004, DEC-005, DEC-013) atrasam e travam o caminho crítico | MÉDIA | ALTO | Priorizar; timebox de spike; decisão humana explícita |
| Regras de firewall do Docker deixam de valer após reinício/atualização | MÉDIA | CRÍTICO | DEC-005, ISO-003, ISO-008 (teste pós-reinício noturno) |
| RAM da VPS insuficiente com sidecar + observabilidade | ALTA | MÉDIO | RUN-007, DEC-010, GATE-006; mover observabilidade para fora |
| Achados do pentest consomem as sprints finais | ALTA | ALTO | Folga em S10–S11; não comprimir o gate por data |
| Escopo de produto (3D) cresce sem controle | MÉDIA | MÉDIO | Orçamentos e modo 2D (WEB-007); dados reais só por eventos autorizados |
| Dependência de uma só pessoa em segurança | MÉDIA | ALTO | `CODEOWNERS` com dois revisores; documentação como entregável |
| Frameworks de IA mudam rápido (supply chain) | ALTA | MÉDIO | Interface `AgentEngine`, *lock files*, SBOM, ISO-007 |

## 7. Registro desta entrega (conforme `CLAUDE.md`)

| Campo | Valor |
| --- | --- |
| Domínio | `backlog` (planejamento transversal; pasta indicada pelo solicitante) |
| Solicitação | Criar o backlog em épicos e sprints, com especificação técnica por tarefa, a partir do ADR de 2026-10-25, usando a skill `arquiteto-de-software` |
| Branch / base | `developer` · `HEAD` = `cb1885c66831e06f5d16576443de05c29817df99` ("first commit") |
| Estado da árvore no início | Não rastreados: `documentacoes/.DS_Store`, o ADR de 2026-10-25 e `skills/` |
| Autores | Vinícius (produto e ADR), Claude (decomposição) |
| Commits criados | **Nenhum commit criado nesta tarefa** |
| Alterações de código/teste/config | Nenhuma. Apenas documentação nova em `documentacoes/backlog/` (por isso não há patch de código; os arquivos são novos e listados abaixo, conforme a regra de não reincluir diffs de `documentacoes/`) |
| Lessons | Não criadas: a entrega não introduz nem exercita conceito de C#/.NET (trilha atual) nem altera código; ver Q-01 |
| Validação | Script de verificação (contagem de tickets por épico e sprint, ordem de dependências entre sprints, consistência plano × tickets × READMEs, links relativos); resultado abaixo |
| Pendências | Q-01..Q-09 acima; ADR-016..026 ainda por produzir |

**Arquivos criados:** este `README.md`, `plano-de-sprints.md`, `rastreabilidade.md`, `futuro.md` e, em cada uma das 13 pastas de épico, `README.md` e `tickets.md` (30 arquivos).

**Resultado da verificação automática (2026-10-25):** 110 tickets em 13 épicos e 12 sprints; 0 dependências apontando para sprint posterior; lista de tickets de cada sprint em `plano-de-sprints.md` idêntica ao campo Sprint dos tickets; sprints das tabelas dos READMEs de épico consistentes; todos os links relativos resolvem. Não houve build/testes, pois não há código.

### Atualização em disco

Este backlog é um artefato vivo: ao replanejar, preservar os IDs, registrar a mudança e o motivo, e atualizar `plano-de-sprints.md`, `rastreabilidade.md` e o README do épico afetado no mesmo commit.
