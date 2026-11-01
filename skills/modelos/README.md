# Modelos mínimos de instruções

`CLAUDE.md` e `AGENTS.md` contêm o mesmo bloco essencial para o fluxo destas skills. São modelos para incorporar às regras de outro projeto, não configurações completas de aplicação.

## Como usar

1. Instale as skills conforme o README da distribuição, preservando `_shared/`, referências e scripts.
2. Para Claude, use o conteúdo de `CLAUDE.md`. Para um agente que lê `AGENTS.md`, use o conteúdo desse arquivo. Se o projeto usa ambos, mantenha o bloco consistente nos dois ou estabeleça uma fonte comum explicitamente referenciada.
3. Se o arquivo de destino já existe, acrescente o bloco e resolva conflitos com suas regras. **Não substitua o arquivo inteiro nem apague instruções existentes.** Os modelos ficam em `modelos/` para não se tornarem regras ativas na raiz desta distribuição.
4. Acrescente os fatos específicos do seu projeto descritos abaixo. A configuração muda no projeto; o código das skills permanece reutilizável.

## O que configurar em cada projeto

| Informação | O que declarar nas regras locais ou na configuração existente |
| --- | --- |
| Repositórios | Raízes e camadas; não presuma que backend e frontend estão na mesma raiz Git |
| Validação | Comandos reais de lint, build e testes; critérios e isolamento exigido para banco/serviços |
| Documentos e worktrees | Diretórios de planos, relatórios, entregas e worktrees; fuso operacional |
| Políticas locais | Regras de dependências, Git, dados e limites adicionais; permissões continuam sendo as do cliente |
| Contexto integrado | Node.js >=22.13/Git e configuração da raiz; a CLI já acompanha `_shared` |

O Contexto acompanha as skills em `_shared/contexto`; o agente executa a preparação automaticamente e o helper informa o caminho do project.json/SQLite dentro das skills locais. Configuração legada em `.contexto/project.json` é preservada. Workflow descreve caminhos, fuso e repositórios; não concede autorização nem substitui segurança. Não é necessário instalar/cadastrar MCP, configurar CONTEXTO_CLI nem executar init manualmente. Node/Git e executores independentes são recursos do host; gates que dependem de recursos ausentes ficam bloqueados.

Os modelos não incluem caminhos de máquina, nomes de empresa, framework obrigatório, banco específico, credenciais ou vínculo obrigatório com gerenciador de tarefas. Também não repetem os contratos completos de cada skill: eles continuam nos respectivos `SKILL.md` e referências.
