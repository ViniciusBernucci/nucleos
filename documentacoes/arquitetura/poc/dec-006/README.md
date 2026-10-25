# PoC DEC-006 — gestão de segredos do MVP

Descartável. Sem dependências de terceiros (apenas `node:crypto`, `node:fs`, `node:test`), logo sem lock file próprio. Containers sem rede (`--network none`), sem portas, imagem local `node:22-alpine`, valores 100% sintéticos gerados a cada execução, tudo destruído ao final.

Executar (Node 24.22.1 do usuário em `~/.local/opt`, Docker local):

    export PATH="$HOME/.local/opt/node-v24.22.1-linux-x64/bin:$PATH"
    node --test documentacoes/arquitetura/poc/dec-006/poc.test.mjs

- `broker.mjs`: hierarquia chave mestra -> DEK por tenant -> segredo (AES-256-GCM), entrega 0400, rotação com janela dupla, revogação por crypto-shredding, backup/recuperação da chave mestra.
- `tenant-app.mjs`: tenant sintético; loga apenas metadados e prova o valor via HMAC.
- `poc.test.mjs`: ciclo de vida, scan de `env`/`inspect`/logs, controle negativo, backup/recuperação.
- `saida-execucao.txt`: saída real da última execução.

ADR: [ADR-020](../../adr/0020-gestao-de-segredos-do-mvp.md).
