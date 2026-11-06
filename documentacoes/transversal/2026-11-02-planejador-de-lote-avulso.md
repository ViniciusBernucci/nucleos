# Planejador de lote avulso — 2026-11-02

Domínio: transversal. Pedido: recuperar o planejador clássico para uso sem compilador.
Branch: developer. HEAD inicial: c5427047db13c8bb84e3a635298e94e89105caea.
Base da comparação: bytes da árvore ao iniciar esta tarefa, preservando alterações
anteriores. Autor: Codex a pedido de Vinicius. Nenhum commit criado nesta tarefa.

## Entrega

Nova skill skills/skills/planejador-de-lote-avulso com SKILL.md, metadados de descoberta
e quatro referências locais: grill-me, tech-lead, worktree-planner e origem histórica.
Baseada no primeiro commit e18f2e3 do acervo original, anterior aos contratos Node V2
e à adaptação Go 35925ae. Preserva o encadeamento clássico; não é cópia byte a byte,
pois retira o acoplamento operacional e muda o nome para coexistir com o planejador atual.

Entrevista → especificação/tickets → plano de isolamento/integração quando pertinente
→ manifesto e prompts Markdown. Não exige manifesto executável JSON, workflow/bindings,
runtime Node, compilador, indexação ou MCP. Não inicia implementação, testes ou Git
de escrita. Referências próprias evitam herdar revisões das skills atuais acopladas ao fluxo.

AGENTS.md e CLAUDE.md recebem somente uma exceção explícita para esta escolha avulsa.
Regras de negócio, banco único, segurança, autorização e documentação permanecem.
O planejador-de-lote atual, seu gerador e os runs existentes não são modificados.
Fontes e espelhos .claude/skills, .agents/skills e .agent/skills são sincronizados.
[Diffs desta tarefa](2026-11-02-planejador-de-lote-avulso-diffs.md).

## Uso

No agente do projeto: Use $planejador-de-lote-avulso para planejar esta demanda em
Markdown, sem compilador e sem iniciar implementação.
A IA carrega uma etapa histórica por vez na mesma sessão; não abre agentes/terminais
para repetir o planejamento. Uma futura solicitação pode executar o plano diretamente.

## Validação

Frontmatter, identidade e links da skill validados. Referências operacionais limitadas
à própria variante; não importa contratos do planejador atual.
Sincronização das duas instalações e preservação do planejador existente: registro
final após instalação. Não foi iniciada IA de implementação nem teste de tela/aplicativo.

Build/lint/test do aplicativo e lessons/: NA. Só houve inclusão de instruções de
planejamento e exceção de seleção de skill, sem alteração de conceitos da trilha
TypeScript/Python/Docker/PostgreSQL/segurança da aplicação; índice de lessons preservado.

## Compatibilidade e rollback

Variante optativa: o fluxo enxuto padrão continua no planejador-de-lote.
Nenhum snapshot foi migrado e nenhuma proposta de correção do compilador foi executada.
Rollback: retirar somente os arquivos desta variante e a exceção local, sincronizando
as cópias; preservar os demais planos, skills e alterações da árvore.
Investigação sobre leitura de documentação continua separada, sem alterar o fluxo.

## Registro final

Skill e links validados; ambas as instalacoes com 17 skills, 87 arquivos por destino e zero divergencias nos tres espelhos. Archify extra preservada no Nucleos. Planejadores existentes conferidos por hash e preservados. A excecao avulsa tambem dispensa preparacao/indexacao Node, para impedir acoplamento indireto pelas instrucoes antigas. Nao houve commit, execucao de lote ou alteracao do compilador.
