# ADR-020 — Gestão de segredos do MVP

- **Status:** Proposto (somente o usuário pode torná-lo Aceito)
- **Data:** 2026-10-25
- **Decisores:** usuário (pendente)
- **Origem:** [ENT-DEC-006](../../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-006); [ADR consolidado, seção 10](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md)

## Contexto

O MVP roda em uma VPS com Docker Compose (ADR-010), runtime dedicado por tenant (ADR-002) e database por tenant (ADR-003). Há três classes de segredo: (a) da plataforma, (b) credenciais por tenant geradas pelo provisioner, (c) credenciais de integração fornecidas pelo cliente. Segredos não podem aparecer em `docker inspect`, variáveis de ambiente, logs nem imagens; a rotação e a revogação devem ser por tenant, sem reiniciar os demais. Orçamento de RAM e de operação é mínimo (sem HA no MVP).

## Problema

Qual mecanismo armazena, entrega, rotaciona e revoga esses segredos no MVP, e como a chave que protege tudo é recuperada após um desastre?

## Decisão

1. **Entrega por arquivo, nunca por ambiente.** Segredo de tenant é entregue como arquivo `0400` em volume `tmpfs` montado somente-leitura no container do tenant, usando apenas o subdiretório daquele tenant (`volume-subpath`). Política: variável de ambiente, `command`, argumento e `ENV`/`ARG` de imagem nunca carregam segredo (apenas caminhos `*_FILE`).
2. **Hierarquia de chaves (criptografia envelope):**
   - **Chave mestra (KEK)**: 32 bytes aleatórios, fora do banco e fora de qualquer imagem/repositório; existe em claro apenas no `tmpfs` (0400) do broker/provisioner e é injetada por stdin.
   - **Chave de dados por tenant (DEK)**: AES-256-GCM, gerada na criação do tenant, guardada somente embrulhada pela KEK (AAD = `dek:<tenant>`).
   - **Segredo**: cifrado com a DEK (AAD = `secret:<tenant>:<versão>`); só o texto cifrado persiste (classe (c) e credenciais de (b)). Segredos da plataforma (a) em repositório usam SOPS+age (recomendação a validar no FND-006; não exercitado neste PoC).
3. **Rotação com janela dupla:** a rotação grava `current` (nova versão) e mantém `previous`; o consumidor lê ambos; o broker aposenta `previous` ao fim da janela. Nenhum container é reiniciado.
4. **Revogação por crypto-shredding:** descarta DEK embrulhada e textos cifrados do tenant e remove os arquivos entregues; os demais tenants não são tocados.
5. **Auditoria:** o broker grava um evento (sem valores) por criar/rotacionar/aposentar/revogar/backup/restauração. Leitura pelo tenant **não** é auditada (ver limitações).
6. **Backup e recuperação da chave mestra:** a KEK é exportada embrulhada por `scrypt(frase)` + AES-256-GCM em um blob guardado **fora da VPS** (e separado da frase, que fica sob guarda de pessoas distintas/cofre pessoal). Procedimento de recuperação: (i) provisionar broker novo, (ii) restaurar o blob com a frase, (iii) rodar `verify-store`, (iv) reentregar os arquivos dos tenants a partir do store. Perdida a KEK sem backup, todos os segredos cifrados são irrecuperáveis (aceito; o cliente reinforma as integrações). Rotação da KEK (re-embrulhar DEKs) é trabalho derivado. Ensaio de recuperação a cada release e após qualquer troca de custodiante.
7. **Teste de CI:** o teste do PoC (varredura de `docker inspect`, `env`, `/proc/1/environ`, logs e volumes com valores sentinela) vira gate de CI no ambiente de teste (FND-005/FND-006).

## Alternativas

| Alternativa | Por que foi considerada | Por que não foi escolhida |
| --- | --- | --- |
| Docker/Compose secrets | Nativo; arquivos em `/run/secrets` ([doc Docker, consultada em 2026-10-25](https://docs.docker.com/compose/how-tos/use-secrets/): secrets montados como arquivos, entrega por bind mount de arquivo único em Linux) | Declarados estaticamente no Compose; não resolvem criação dinâmica por tenant sem reescrever/recarregar o compose, nem hierarquia de chaves, nem rotação com janela dupla. Pode ser o transporte de segredos da plataforma. |
| SOPS+age | Segredos da plataforma versionados cifrados | Não é entrega dinâmica por tenant nem auditoria; fica restrito à classe (a). |
| OpenBao/Vault | Vault real: segredos dinâmicos, leases, revogação em árvore, trilha de auditoria ([OpenBao, consultado em 2026-10-25](https://openbao.org/docs/what-is-openbao/)) | Custo de operação (unseal, HA, backup do storage) e RAM acima do orçamento do MVP; avaliado como destino de evolução, não descartado. |
| Infisical | Gestão de segredos com UI | Não avaliado no PoC (sem fonte consultada); reavaliar no gatilho abaixo. |
| Variáveis de ambiente | Simplicidade | Aparecem em `docker inspect`, `/proc/*/environ` e vazam em dumps; proibido. |

## Benefícios

Sem dependência de terceiros e sem serviço novo de peso; tenants isolados por montagem (um tenant não enxerga o diretório de outro); rotação e revogação por tenant sem reinício; segredos em repouso cifrados; ausência em `env`/`inspect`/logs provada por teste reproduzível.

## Trade-offs

- O broker é componente crítico caseiro (código de criptografia próprio, embora só use primitivas padrão do `node:crypto`): exige revisão de segurança independente antes de aceitar.
- Chave mestra única; custódia humana do backup e da frase é ponto de falha.

## Consequências

Limitações frente a um vault real (**sem equivalência**): sem auditoria de leitura pelo tenant; sem leases/TTL nem segredos dinâmicos; sem políticas/RBAC próprios, sem Shamir/seal-unseal, sem HSM; o segredo em claro existe no tmpfs (RAM do host) e é legível por root do host e por quem tem acesso ao socket Docker, e `docker exec` no tenant lê o arquivo; risco de swap fora do tmpfs/memória do processo não tratado; a KEK em claro reside no tmpfs do broker; sem HA do broker; sem rotação automatizada da KEK; PoC com um host e sem rede, sem teste de carga. Trabalho derivado: FND-006 (formato final de configuração), PRV-004, TGW-004, DAT-009 consomem este desenho.

## Quando revisar

- Segundo host/VPS, HA ou exigência contratual/regulatória de auditoria de leitura de segredos.
- Mais de ~100 tenants ou rotação automática exigida por integração.
- Incidente de vazamento de segredo ou achado crítico na revisão do broker.
- Orçamento de RAM/operação que comporte OpenBao.

## Referências

- Documento da entrega: [2026-10-25-dec-006-gestao-de-segredos.md](../../seguranca/2026-10-25-dec-006-gestao-de-segredos.md)
- PoC e saída: [poc/dec-006](../poc/dec-006/README.md), [saida-execucao.txt](../poc/dec-006/saida-execucao.txt)
- Relacionados: ADR-002, ADR-003, ADR-010, ADR-012, ADR-014
