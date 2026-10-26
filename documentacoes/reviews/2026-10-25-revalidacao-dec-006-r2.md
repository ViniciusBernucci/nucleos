# Revalidacao focal DEC-006 rodada 2 (modo seguranca, QA independente)

- Tarefa: DEC-006 (gestao de segredos, PoC). Item revalidado: OBS-1 de `2026-10-25-qa-dec-006.md` (create aceitava KEK errada).
- Repositorio/worktree: `/home/vinicius/nucleos-worktrees/tarefa/dec-006`, branch `tarefa/dec-006`.
- Correcao revisada: `507ad2cd83a1858e8773c8d240553fe49a08b485` (pai `9a500a43d0c97bb1ace603be2cffd9ec619b4414`). Arvore da worktree limpa antes e depois (`git status --short` vazio).
- Arquivos cobertos: `documentacoes/arquitetura/poc/dec-006/broker.mjs`, `poc.test.mjs`, ADR-020 (trecho do canario), leitura de `seal/open/loadStore/saveStore`. Sem edicao de codigo.
- Revisor distinto do implementador; nenhuma autorrevisao.

## Veredito OBS-1: RESOLVIDO

Nenhum achado novo de severidade media ou alta. Duas observacoes baixas abaixo (nao bloqueantes, ambas ja admitidas ou equivalentes a limitacoes declaradas).

## Verificacoes executadas

1. Teste oficial: `node --test documentacoes/arquitetura/poc/dec-006/poc.test.mjs` (Node 24.22.1, Docker, `--network none`): 9 testes, pass 9, fail 0, 67,4 s (inclui os 2 testes novos de OBS-1). Containers/volumes do teste destruidos (`docker ps -a` sem sobras `qa006`/poc).
2. Meus ataques independentes: `scratchpad/r2/atk.mjs` (fora do repo), executado em container `node:22-alpine --network none --rm` com o `broker.mjs` do commit, em tmpfs. Saida `scratchpad/r2/out.txt` (sha256 `65cf8939e25a839be7f8f042a6bdc889305a6af21b2fd3fcabcaddf6f319509c`): 117 PASS, 2 FAIL, ambos erro do meu harness (ver "Nota de harness").

## Analise criptografica do canario

Codigo: `requireKek` abre `st.kekCanary` com `open(key, canary, "kek-canary:v1")`; se ausente, grava `seal(key, randomBytes(16), "kek-canary:v1")`.

- Nonce: o canario passa por `seal()`, que gera IV aleatorio de 12 bytes por chamada. NAO ha nonce constante. O que e fixo e a AAD (`kek-canary:v1`), o que e correto e desejavel (separacao de dominio em relacao a `dek:<t>`). Plaintext: 16 bytes aleatorios gerados uma vez por store, nao um bloco fixo conhecido; o bloco "fixo" e fixo apenas durante a vida do store.
- Prova empirica: 20 stores novos geraram 20 canarios, 20 IVs e 20 ciphertexts distintos; o IV do canario difere dos IVs das DEKs embrulhadas. Logo nao ha reuso de par (chave, nonce) entre canario e `wrappedDek`. Com IV aleatorio de 96 bits, o canario apenas soma uma mensagem sob a KEK; o limite de colisao (birthday, ~2^32 mensagens) permanece muito distante para o PoC.
- Vazamento: o plaintext e aleatorio e independente de KEK/segredos; nao ha oraculo novo (quem tem o store ja tem `wrappedDek`, que serve igual de oraculo offline para um atacante que adivinhe uma KEK de 256 bits, inviavel). Tag GCM de 128 bits: probabilidade de uma KEK errada abrir o canario e desprezivel. Saidas do broker (stdout/stderr) em todos os ataques nao continham sentinela, KEK (hex/base64) nem o canario; as mensagens de erro sao genericas.
- Adulteracao do canario por quem escreve no store: `{}`, `[]`, `123`, `"!!!"` e blob de bytes fixos falham fechado (create exit 1, nada alterado). `null`/`0` (falsy) caem no caminho legado (valida pela DEK do primeiro tenant ativo); com KEK errada ainda falham. Quem escreve no store ja adultera tudo (limitacao REVIEW-005/009 declarada); sem ganho para o atacante.

## Ataques repetidos (resultado)

KEKs testadas: 32 B aleatoria, 16 B, 0 B, 33 B, 64 B, 32 B zeros, KEK correta + 1 byte, KEK correta com 1 bit trocado, e KEK ausente. Para cada uma: `create <novo>`, `create <existente>`, `rotate`, `retire-previous`: todos falham (exit != 0; 32 B erradas com `kek invalida: nao abre o store existente (nada foi gravado)`, tamanho errado com `kek invalida (tamanho)`); hash de store+audit+arquivos entregues identico antes/depois (falha fechado antes de qualquer gravacao). `redeliver-all` e `verify-store` (global e por tenant) com KEK errada: exit 2, `{"ok":false,"reason":"kek-invalida"}`, nada tocado. KEK ausente: todos falham, nada alterado. KEK correta restaurada: operacao normal.

- redeliver-all com DEK corrompida de 1 tenant (store com canario): exit 2, `{"ok":false,"reason":"tenants-com-falha","delivered":2,"failed":["tb"]}`; ta e tc entregues, tb nao recebe segredo; `verify-store` global reporta `failed:["tb"]`, `verify-store ta` ok. `create` de outro tenant continua permitido (comportamento documentado na ADR, item iii).
- Store legado (sem canario): KEK errada em create/rotate falha sem gravar canario; verify exit 2; redeliver-all `kek-invalida`; com KEK certa o rotate funciona e grava o canario.
- Race: 4 `create` concorrentes com KEK certa: houve perda de atualizacao (r2 sumiu do store, 4 de 5 tenants), UIDs sem duplicata, canario presente, `verify-store` ok. E a limitacao REVIEW-005 (sem lock) ja declarada; o canario nao agrava (qualquer escritor concorrente so grava canario selado pela KEK que o validou ou pelo mesmo caminho de store novo).
- Regressao dos achados anteriores: UID nao reutilizado em revoke/recreate (10001 -> novo); `../x`, `..`, `a/b`, `A`, `-x`, `.hidden`, 64 chars, vazio, `a b`, `__proto__`, `/etc` rejeitados sem E/S; KDF: frase curta rejeitada, N=2^20, N=2^10, r=1, p=100, `pbkdf2` rejeitados, restore legitimo ok; scanner (testes de AC-2 e controle negativo) passou no teste oficial.

## Observacoes (BAIXO, nao bloqueantes)

- OBS-R2-1 (BAIXO): store legado (sem canario) com todos os tenants revogados aceita qualquer KEK no `create` e grava canario com ela (nao ha DEK para validar). Observado: create exit 0, canario gravado. Impacto restrito: nao existe DEK ativa a perder; equivale a primeiro uso. Sugestao: registrar na ADR junto ao item (iv) ou fixar o canario na migracao.
- OBS-R2-2 (BAIXO): em store legado sem canario, se o primeiro tenant ativo estiver corrompido, `redeliver-all` aborta tudo com `kek-invalida` (sem isolamento por tenant) e `create` falha. Observado exatamente isso. Ja declarado na ADR (item iv) como falha fechada com intervencao. Uso real: apos qualquer escrita bem-sucedida o canario existe e o problema desaparece.
- Detalhe de implementacao (informativo): `create`/`rotate` releem `master.key` (`mk()`) depois de `requireKek` em vez de reutilizar a chave validada; TOCTOU de substituicao do arquivo da KEK entre as leituras exige escrita em tmpfs 0400 da KEK, ja fora do modelo de ameaca do PoC.

## Nota de harness (nao e bug do produto)

2 FAIL do meu script: o nome `constructor` e valido pela allowlist `^[a-z0-9][a-z0-9-]{0,62}$` (minusculas), entao o create foi aceito de forma legitima e o snapshot "nada alterado" seguinte mudou; `Object.hasOwn` impede heranca de prototipo (`__proto__` e rejeitado pela allowlist). Primeira execucao abortou por NUL em argv (impossivel em processos reais); removido e repetido.

## Pendencias

Nenhuma para OBS-1. Permanece a decisao humana do ADR-020 (AC-1a) e as limitacoes ja registradas (sem lock/atomicidade, auditoria adulteravel, KEK unica).
