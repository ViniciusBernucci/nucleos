# Auditoria de review — DEC-012 (ADR-026 / SubscriptionEvent)

- **Relatório de origem:** `documentacoes/reviews/2026-10-25-review-dec-012.md` (sha256 `84c16899f4e5967208691963afecafdd23274528598c3fe97cd5038d708acc7b`; veredito do revisor preservado: APPROVED WITH NOTES)
- **Tarefa:** ENT-DEC-012 (AC-1, AC-2) · **Branch:** tarefa/dec-012 · **Worktree:** /home/vinicius/nucleos-worktrees/tarefa/dec-012 (somente leitura)
- **Base revisada:** 4be3ce391a51b9e24cd85f7c894d841636dcd50f · **HEAD:** a790676ea63133ceb13f9fd891e62993a16fd1e3 (HEAD atual idêntico; sem mudanças desde a revisão; `git status` da worktree limpo)
- **Auditor:** sessão independente (não implementou nem revisou). Namespace dos IDs: REVIEW-001..007 deste relatório/tarefa.
- **Local de gravação:** `documentacoes/reviews/` (regra do projeto; o SKILL cita `docs/historico/reviews/`, que não existe neste repositório). Nenhum código editado, nenhum commit.

## Verificações do auditor

- `python3 documentacoes/arquitetura/contratos-propostos/validar.py` -> `RESULTADO: TUDO CONFORME`.
- Script próprio (scratchpad `.../scratchpad/aud.py`, `python3 -I`, jsonschema 3.2.0), derivado do exemplo válido 03:
  - REVIEW-004 REPRODUZIDO: `payment.failure_code: ""` ACEITO; também `subscription.provider_status: ""` e `raw_payload_ref: ""` ACEITOS.
  - REVIEW-005 REPRODUZIDO e AMPLIADO: `provider_event_id: "abc\n"` ACEITO; o mesmo vale para `plan_code: "a\n"` e `currency: "USD\n"` (três campos com `$`, não um). Em Python `re.match(r"^[a-z]+$","ab\n")` casa e `re.fullmatch` não. Em ECMA-262 (sem flag `m`) `$` só casa no fim da entrada, então o schema está correto para ajv/FND-003; o desvio é do motor Python usado em `validar.py`.
- Não executado: ajv/validador ECMA (sem ajv instalado; não instalei dependências); fontes externas (Stripe/Mercado Pago/Asaas) não reabertas, confiei nas conferências do revisor. Spec lida: `tickets.md#ent-dec-012` (AC-1 schema compatível com simulador; AC-2 matriz evento do provedor -> transição).

## Decisões por achado

### REVIEW-001 — MÉDIO (original) / MÉDIO (avaliada) — APLICAR (plano corrigido)
- **Evidência:** ADR Decisão 4 diz que o CP reconcilia "antes de agir quando houver dúvida" apenas para `payment.succeeded`, `subscription.suspended_by_provider`, `subscription.canceled`. O schema não tem sequência/versão, então "dúvida" não é verificável. A lista do ADR também está incompleta frente à própria matriz: `subscription.activated` (G,S -> ACTIVE) e `subscription.resumed` (S,G -> ACTIVE) também mudam acesso. Não é regra de negócio nova: reforça a invariante já escrita (evento fora de ordem não pode reabrir/suspender indevidamente).
- **Plano mínimo (somente ADR-026, texto; matriz e schema inalterados):** na Decisão 4, trocar "quando houver dúvida" por regra obrigatória: antes de aplicar qualquer transição que altere acesso (`payment.succeeded`, `subscription.activated`, `subscription.resumed` com destino ACTIVE; `subscription.suspended_by_provider` com destino SUSPENDED; `subscription.canceled` com destino CANCELED_RETAINED) o CP consulta o estado atual da assinatura (API do provedor, ou o simulador no MVP) e só aplica se for coerente com o evento; se a consulta falhar, registra o evento, não aplica e reenfileira (nenhum caminho apaga dados). Anotar o custo no Trade-offs (já cita reconciliação) e que a implementação é de EP-09.
- **Teste esperado:** cenário de reordenação (par de eventos invertido, ex.: `resumed` seguido de `suspended_by_provider` obsoleto) como caso de FND-003/EP-09 contra o simulador; não exigir no `validar.py` (sem lógica de runtime). Esse teste fica ADIADO com a condição: abrir quando FND-003/EP-09 existirem.
- **Risco da alteração:** baixo (documental).

### REVIEW-002 — BAIXO / BAIXO — ADIAR
- **Evidência:** dois Events Stripe com ids distintos para o mesmo fato passam pela chave `(provider, provider_event_id)`; o efeito é contido pela matriz (maioria dos pares vira UNCHANGED, e a carência só abre na transição A -> G). Resta apenas aviso repetido ao responsável, efeito colateral do adaptador.
- **Motivo de não fazer agora:** dedupe secundário é detalhe do adaptador Stripe, não do contrato; sem impacto em aceite nem em dados.
- **Retomada:** ao implementar o adaptador (EP-09) ou escolher Stripe em Q-06: dedupe por (id do objeto, tipo) e avisos idempotentes por transição.

### REVIEW-003 — BAIXO / BAIXO — REJEITAR
- **Evidência:** AC-2 é satisfeito por composição de dois passos: o ADR traz o mapeamento Stripe evento do provedor -> evento normalizado (prosa, com fonte [S2]) e a matriz total 12 x 7 de normalizado -> transição, validada por script. Asaas/Mercado Pago "não verificado" é declaração honesta; criar mapeamento para eles seria inventar fatos. O contrato é deliberadamente provedor-agnóstico (AC-1).
- **Nota:** se o humano quiser leitura estrita, converter a prosa em tabela é opcional e pode ocorrer junto de REVIEW-006 sem custo; não é defeito.

### REVIEW-004 — BAIXO / BAIXO — APLICAR
- **Evidência:** reproduzido (acima). `payment.failed` exige `failure_code`, mas `""` satisfaz; o ticket pede dados de falha utilizáveis (dunning). Correção barata e sem efeito colateral.
- **Plano mínimo:** em `subscription-event.schema.json` adicionar `"minLength": 1` a `payment.failure_code`, `subscription.provider_status` e `raw_payload_ref`; criar `exemplos/invalidos/12-failure-code-vazio.json` (derivado do válido 03). Nenhum válido existente tem string vazia (validar.py segue verde se for assim; reconfirmar).
- **Teste esperado:** `validar.py` com 12 invalidos rejeitados, 6 válidos aceitos, exit 0; mutação: remover o minLength faz o novo inválido ser aceito e o script falhar.
- **Risco:** nulo para consumidores (contrato ainda PROPOSTO, sem implementação).

### REVIEW-005 — BAIXO / BAIXO — APLICAR (parcial) + ADIAR (ajv)
- **Evidência:** reproduzido e ampliado a `plan_code` e `currency`. Plano do revisor está confuso: `\z` não existe em ECMA-262 e `\Z` é Python; **alterar o schema é errado** (o schema é correto em ECMA). O defeito real está na prova: `validar.py` aceita o que o contrato (lido por ajv/FND-003) rejeita, então a evidência "pattern rejeitado" não vale para o motor de destino.
- **APLICAR (mínimo, só `validar.py` + exemplo):** no `validar.py`, estender o `Draft7Validator` com `pattern` baseado em `re.fullmatch` (para estes padrões `^...$` equivale a ECMA), via `jsonschema.validators.extend`; documentar no docstring a divergência. Adicionar `exemplos/invalidos/13-event-id-com-quebra-de-linha.json` (`provider_event_id: "abc\n"`).
- **Teste esperado:** o inválido 13 rejeitado; mutação: voltar ao `pattern` nativo faz o script falhar.
- **ADIAR (tarefa de FND-003):** executar a mesma suíte com validador ECMA (ajv) no pacote `packages/contracts`; condição de retomada: criação de FND-003. Não adicionar dependência Node agora.
- **Risco:** baixo; alteração só no script de evidência.

### REVIEW-006 — BAIXO / BAIXO — APLICAR
- **Evidência:** ADR "Mapeamento Stripe ilustrativo" liga `unpaid`/`paused` -> `suspended_by_provider` com citação [S2], mas a fonte (segundo o revisor, WebFetch) não prescreve esse mapeamento e `unpaid` depende de configuração do Dashboard. Atribuição indevida de decisão de projeto à fonte. Não reabri [S2]; aceito a evidência do revisor e a condiciono à releitura pelo implementador.
- **Plano mínimo:** rotular a linha como inferência do projeto, citar a dependência de configuração do Dashboard e manter [S2] só para os nomes de evento/estado. Sem mudança em schema/matriz.

### REVIEW-007 — BAIXO / BAIXO — APLICAR
- **Evidência:** a tabela do ADR afirma "URL de teste separada com credenciais de teste" para o Mercado Pago; a página só recomenda URLs distintas e credenciais de teste.
- **Plano mínimo:** reescrever como "recomenda URLs separadas para teste e credenciais de teste [M1]"; sem outro impacto.

## Resumo e plano de aplicação

| ID | Original | Avaliada | Decisão |
| --- | --- | --- | --- |
| REVIEW-001 | MÉDIO | MÉDIO | APLICAR (reconciliação obrigatória; lista corrigida; teste de reordenação adiado a FND-003/EP-09) |
| REVIEW-002 | BAIXO | BAIXO | ADIAR (adaptador/EP-09) |
| REVIEW-003 | BAIXO | BAIXO | REJEITAR (AC-2 coberto por composição; lacuna declarada) |
| REVIEW-004 | BAIXO | BAIXO | APLICAR (schema minLength + inválido 12) |
| REVIEW-005 | BAIXO | BAIXO | APLICAR parcial (validar.py fullmatch + inválido 13; schema NÃO muda) / ADIAR ajv para FND-003 |
| REVIEW-006 | BAIXO | BAIXO | APLICAR (rotular inferência) |
| REVIEW-007 | BAIXO | BAIXO | APLICAR (redação) |

IDs APLICAR para o review-loop-driver: REVIEW-001, 004, 005 (parte validar.py), 006, 007. Pontos de edição: `adr/0026-provedor-de-assinatura-e-contrato-subscriptionevent.md`, `contratos-propostos/subscription-event.schema.json`, `contratos-propostos/validar.py`, dois novos inválidos. Após a correção, atualizar o documento de entrega (`documentacoes/faturamento/2026-10-25-dec-012-adr-026-subscription-event.md`) com os novos diffs e totais (12 inválidos + 6 válidos), e `adr/README.md` segue pendência do coordenador. Revalidação por revisor independente.

## Veredito

**CORRECOES_NECESSARIAS.** Não há bloqueio de aceite nem vulnerabilidade; porém REVIEW-001 (MÉDIO) deve ser resolvido no ADR antes da aceitação humana, e REVIEW-004/005 são defeitos reais e reproduzidos na evidência do contrato. O veredito original do revisor (APPROVED WITH NOTES) permanece; o gate consolidado depende da correção e da revalidação.

## Não reabrir sem fato novo
REVIEW-003 (REJEITAR) e REVIEW-002 / ajv de REVIEW-005 / teste de reordenação de REVIEW-001 (ADIAR).
