# Revalidacao focal r1 - DEC-001 e DEC-011 - 2026-10-25

Revisor independente (nao implementou). Nada editado nos repositorios revisados; sem commit.

## DEC-001 (tarefa/dec-001, correcao 3fb8aa7, pai b85ecb0)
HEAD confirmado 3fb8aa7e87a631a1a730561e17d34088f3b4e80c; arvore limpa. Diff 4 arquivos em documentacoes/seguranca/.
- Script: `python3 -I documentacoes/seguranca/...verificar.py .` => rc=0 (117 ameacas, 19 fronteiras, 14 abusos, 14 RISK, SEC 18/18). sha256 do script f915fb35...8d2e5c e 8423 bytes, coincide com a entrega.
- Teste negativo proprio (copia via git archive em scratchpad): removi T-F13-D, injetei ticket ZZZ-999 e troquei Responsavel/Estado dos RISK => rc=1, 31 falhas (F13 sem D, ticket inexistente, RISK sem pendente/proposto). O script detecta.
- Fidelidade aos tickets (leitura de PRV-007/009/010, DAT-008/009, MSG-002/006, OBS-001, AIG-003, TGW-002): controles de F13..F19 citam o que os tickets especificam; sem ameaca/controle inventado. Itens sem controle estao rotulados "sem controle no backlog"/"Proposto, sem ticket" com RISK.

| ID | Decisao | Resultado |
| --- | --- | --- |
| REV-001 | APLICAR | RESOLVIDO: F13 (6 linhas, PRV-008, DEC-012, PRV-001), AB-13, atacante provedor na secao 1 |
| REV-002 | APLICAR | RESOLVIDO: F14/F15; SEC-13 -> T-F14-R/I e R; SEC-14 -> T-F15-T/I/E; AB-09/10 citam F14/F15 |
| REV-003 | APLICAR | RESOLVIDO: F16/F17 citam MSG-006, AIG-002, ISO-005, RUN-006; T-F17-I2 cache |
| REV-004 | APLICAR (plano corrigido) | RESOLVIDO: T-F4-E e AB-03 "Proposto, sem ticket" + RISK-013; secao 7 item 5 propoe ajuste sem alterar backlog |
| REV-005 | APLICAR | RESOLVIDO: F18 (RUN-003) e F19 (PRV-009/010, DAT-009), AB-14, RISK-014 para janela residual |
| REV-006 | APLICAR | RESOLVIDO: T-F1-I2 (WEB-008, TGW-006, RAG-003); AB-04/AB-07 ampliados |
| REV-007 | APLICAR | RESOLVIDO: IDs T-Fn-X unicos, matriz 6.1 e 6.2 (ameaca->ticket->teste), RISK com Responsavel "pendente (AC-2; decisao humana)" e Estado "proposto"; AC-2/AC-3 mantidos pendentes |
| REV-008 | APLICAR parcial | RESOLVIDO: F3-E sem SEC (DEC-003, IAM-002); F12-E "sem teste SEC; RISK-001"; F12-T sem SEC-16 (PRV-012, ISO-001); F5-I mantido SEC-04 (rejeicao respeitada) |
| REV-009 | APLICAR parcial | PARCIAL, ver abaixo. F9-E (RAG-001; ADR-013), F11-E (ADR 10; principio geral), F8-R (pgaudit avaliada, nao garantida) e convencao 16.n na secao 1: RESOLVIDOS; 16.1/16.10 mantidos (rejeicao respeitada). **Sub-item F3-T: AINDA PRESENTE + REGRESSAO** |
| REV-010 | APLICAR | RESOLVIDO: script versionado, referenciado na secao 8 e na entrega; saida real registrada; "82" removido |

### Achado novo (REV-009 F3-T) - severidade BAIXO
Linha `T-F3-T` (modelo, secao 3/F3, linha 85) esta malformada: tem 7 colunas de conteudo em vez de 8. O texto "Membership e a fonte do tenant (5.1)" foi colocado na coluna Ativo (A3 perdido) e "Metadados minimos (6.1.9)" permanece em "Controle do ADR". Logo a citacao 6.1.9 que a auditoria mandou trocar por ADR 5.1 continua, e a troca gerou desalinhamento de colunas (regressao de formatacao). O script nao detecta (nao valida numero de colunas). Correcao minima: `| T-F3-T | T | Alteracao de membership/politica | A3 | Membership e a fonte do tenant (5.1) | Migrations por identidade propria; historico imutavel | IAM-002, IAM-006 | SEC-03 |`. Opcional: acrescentar no script verificacao de 8 colunas nas tabelas de secao 3.
Demais linhas da secao 3 (todas as 8 colunas) conferidas por contagem: nenhuma outra malformada.

## DEC-011 (tarefa/dec-011, correcao f8f6c30, pai 3fa2560)
HEAD confirmado f8f6c3003355e4a93a0c43a31684b7458bbb1f47; arvore limpa. Diff: 2 arquivos (rascunho +7/-1; entrega +9).
- REVIEW-001: RESOLVIDO. WebFetch proprio de openrouter.ai/docs/guides/features/zdr em 2026-10-25: Anthropic "Removes first-party Anthropic endpoints (Bedrock and Vertex remain available)"; OpenAI "...(Azure remains available)"; Google "Removes AI Studio endpoints (Vertex remains available)"; SpaceXAI "Removes non-ZDR SpaceXAI endpoints (the ZDR SpaceXAI endpoint remains available)"; other "Removes all other non-ZDR endpoints"; campos enforce_zdr_{anthropic,openai,google,xai,other}. A lista por escopo do rascunho e fiel; a frase generica incorreta foi removida. Nota menor: "endpoints com politica ZDR continuam disponiveis" em `other` e inferencia coerente, nao citacao literal (sem acao necessaria).
- REVIEW-002, REVIEW-003, REVIEW-004: nao tocados (diff nao altera as linhas de DPA, Q-03/provider-logging, nem o campo `enforce_zdr_xai`); rejeicoes respeitadas. A mencao ao rotulo "SpaceXAI" e adicao inofensiva e correta.
- Sem regressao.

## Veredito
DEC-011: aprovado (REVIEW-001 RESOLVIDO).
DEC-001: REV-001..008 e REV-010 RESOLVIDOS; REV-009 PARCIAL (F3-T AINDA PRESENTE/REGRESSAO de formatacao, baixo). Requer uma correcao textual de uma linha antes do fechamento; AC-2 e AC-3 humanos seguem pendentes.
