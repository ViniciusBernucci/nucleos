# EP-04 — Tickets

Regras globais: [../README.md](../README.md).

<a id="ent-iso-001"></a>
## ENT-ISO-001 — Baseline do host (Ansible)

**Sprint** S01 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Infraestrutura
**Depende de:** DEC-005 · **Bloqueia:** ISO-003, FND-006, GATE-004
**Referências:** ADR 4.1, ADR-010; ASSUNÇÃO A-02: VPS Ubuntu LTS provisionada pelo responsável.

**Especificação técnica** (playbooks idempotentes em `infrastructure/ansible/`)
- Usuário administrativo nominal com `sudo`; `root` e senha por SSH desabilitados (`PermitRootLogin no`, `PasswordAuthentication no`, `AllowUsers`); chaves ed25519; `MaxAuthTries` baixo; porta SSH restrita por firewall a IPs/VPN do administrador quando possível.
- Firewall **default-deny** (nftables/ufw coerente com a decisão de DEC-005): permitir 80/443 de entrada; SSH restrito; demais negado. Garantir que o Docker **não** publique portas fora de 127.0.0.1/rede interna sem decisão explícita.
- `unattended-upgrades` para segurança do SO, janela de reinício controlada, `needrestart`; `fail2ban`/equivalente; sincronização de tempo (chrony) — relevante para tokens com `exp` curto.
- Docker Engine da versão suportada pelo repositório oficial; `daemon.json` versionado: `userns-remap` ou rootless conforme ADR-019, `no-new-privileges: true` por padrão, `log-driver` com rotação, `live-restore`, `icc: false`, `iptables: true` com regras de ISO-003, `default-ulimits`.
- Parâmetros de kernel (`sysctl`): `kernel.unprivileged_userns_clone` conforme decisão, `net.ipv4.ip_forward` controlado, `rp_filter`, `accept_redirects=0`, desativar IPv6 se não filtrado.
- Disco: partição/volume para dados do Docker e PostgreSQL com alerta de espaço; `noexec,nosuid` em `/tmp` quando compatível; swap definida (ou ausência documentada) para evitar OOM do host.
- Diretório de segredos do host `/etc/nucleos/secrets` (0700, root) conforme ADR-020.
- Auditoria: `auditd` mínimo (alterações em `/etc/nucleos`, `docker.sock`, `sudoers`), envio para log externo quando disponível (OBS-001).
- Manual de acesso: VPN/túnel para painéis administrativos.

**Fora do escopo.** Hardening CIS completo (registrar lacunas em RISK); rede entre tenants (ISO-003).

**Critérios de aceite**
- [ ] Playbook roda 2× sem mudanças na segunda (idempotência).
- [ ] Varredura externa (nmap) mostra apenas portas esperadas.
- [ ] Login SSH por senha e como root falha.
- [ ] `docker info` confirma as opções de segurança definidas no ADR-019.

**Testes.** `ansible-lint`, `molecule` (container/VM de teste) quando viável, verificação por script pós-aplicação (`make host-verify`).

---

<a id="ent-iso-002"></a>
## ENT-ISO-002 — Perfil de hardening de containers + policy-as-code

**Sprint** S02 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Segurança
**Depende de:** DEC-005, FND-004 · **Bloqueia:** ISO-003, PRV-002
**Referências:** ADR seção 7 ("Configuração mínima dos runtimes").

**Especificação técnica**
- Fragmento Compose/spec reutilizável `tenant-runtime-hardening`: `user: "10001:10001"`, `read_only: true`, `tmpfs` limitados (`/tmp`, `/run`) com `noexec,nosuid`, `cap_drop: [ALL]` (adições por allowlist justificada), `security_opt: [no-new-privileges:true, seccomp=default, apparmor=docker-default]`, `pids_limit`, `mem_limit`/`memswap_limit`, `cpus` (padrão 1,0, reserva ~0,25), `ulimits` (nofile, fsize), `init: true`, `healthcheck`, `restart: unless-stopped`, `stop_grace_period`, `logging` com rotação.
- **Policy-as-code** (OPA/Conftest ou validador próprio) que **rejeita** a spec renderizada se contiver: `privileged`, `pid: host`, `network_mode: host`, `ipc: host`, mounts de `/`, `/proc`, `/sys`, `/var/run/docker.sock` ou `/run/containerd`, `devices`, `cap_add` fora da allowlist, imagem sem digest, usuário root, volume compartilhado entre tenants, variável de ambiente com padrão de segredo.
- A validação roda (a) no CI sobre os overlays e (b) **no provisioner antes de qualquer `up`** (ISO é *gate* de implantação, não só de CI).
- Documentar exceções (nenhuma no MVP) e o processo de aprovação.

**Critérios de aceite**
- [ ] Specs maliciosas de teste (uma por regra) são todas rejeitadas, com mensagem clara.
- [ ] Spec padrão do runtime passa e sobe com `read_only`.
- [ ] `docker inspect` do container mostra `Privileged=false`, `CapDrop=[ALL]`, `NoNewPrivileges`.

**Testes.** Unitários de política (casos positivos/negativos); integração subindo container real.

---

<a id="ent-iso-003"></a>
## ENT-ISO-003 — Redes por tenant e bloqueio entre tenants

**Sprint** S03 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Segurança de rede
**Depende de:** ISO-001, ISO-002, DEC-005 · **Bloqueia:** ISO-004..008, PRV-005
**Referências:** ADR-014, seção 7 ("Cada runtime em sua rede segregada"), SEC-04.

**Especificação técnica** (conforme ADR-019)
- Uma rede *bridge* **por tenant** (`nuc_t_<hex8>`, sub-rede alocada de bloco reservado, controlada pelo catálogo de recursos do banco de controle para evitar colisão) com `enable_icc=false`; rede `nuc_infra` para serviços compartilhados; rede `nuc_edge` somente para proxy ↔ web/API.
- Regras de host **fora do controle do Docker** (chain `DOCKER-USER` com `iptables-nft` ou conjunto nftables dedicado), carregadas por unidade systemd com ordem após `docker.service` e reaplicadas em evento de reinício do daemon:
  - `DROP` de tráfego entre qualquer par de sub-redes de tenant;
  - tenant → `nuc_infra`: **allowlist** por destino/porta (Dispatcher, AI Gateway, DNS interno, sidecar quando fora da rede local do tenant);
  - tenant → PostgreSQL somente na porta 5432 e **apenas** do IP do runtime/sidecar do próprio tenant; banco de controle e Redis **não** alcançáveis por redes de tenant;
  - tenant → host (gateway da bridge, serviços do host, metadados `169.254.169.254`) negado.
- Conjunto de IPs dinâmico (nft sets) atualizado pelo provisioner por **API restrita** (função `registerTenantNetwork(tenantId, subnet)`), nunca por comando livre vindo da API.
- Recurso do catálogo registra `network_name`, `subnet`, `state`; reconciliador (PRV-012) detecta divergência entre regras desejadas e efetivas.
- Documentar o caminho de leitura da UI: Control Plane → Tenant API do runtime (ADR-025) como **única** exceção de entrada, por regra explícita e porta fixa.
- IPv6: desativado nos containers ou filtrado de forma equivalente.

**Critérios de aceite**
- [ ] Sonda no runtime A não alcança IP/porta/DNS de B por nenhuma rota testada em DEC-005 (SEC-04).
- [ ] Regras presentes e efetivas após `systemctl restart docker` e reboot.
- [ ] Runtime A não alcança `nucleos_control`, Redis nem portas do host.
- [ ] Criar o 6º tenant não exige edição manual de regras.

**Testes.** Suíte de sondas (container atacante) — base do ISO-008; teste de reinício.

---

<a id="ent-iso-005"></a>
## ENT-ISO-005 — Exposição mínima de serviços internos

**Sprint** S03 · **Prioridade** Alta · **Tam.** S · **Risco** ALTO · **Tipo** Segurança
**Depende de:** ISO-003 · **Bloqueia:** GATE-004

**Especificação técnica**
- PostgreSQL, Redis, MinIO/S3 local, Dispatcher, AI Gateway, Tool Gateway e APIs privadas dos runtimes **sem `ports:` publicados**; apenas redes internas.
- Redis com `requirepass`/ACL por serviço, `protected-mode yes`, comandos perigosos desabilitados (`FLUSHALL`, `CONFIG`, `KEYS`), *namespacing* por serviço/tenant e **sem segredos permanentes**.
- Inventário automático de portas: comparação `ss -lntup` + `docker ps` com lista aprovada (fonte da verdade em arquivo versionado).
- Teste de varredura externa e interna (de um container de tenant) no CI de staging.

**Critérios de aceite**
- [ ] Varredura externa: somente 80/443/SSH(restrito).
- [ ] De dentro de um tenant, portas de PostgreSQL de outros databases e do Redis fecham/negam conforme a allowlist.
- [ ] Mudança que publique porta não aprovada falha o CI (inventário).

---

<a id="ent-iso-007"></a>
## ENT-ISO-007 — Cadeia de suprimentos de imagens

**Sprint** S03 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Segurança/Plataforma
**Depende de:** FND-005 · **Bloqueia:** RUN-002, PRV-005
**Referências:** ADR seção 7 ("Imagens imutáveis/versionadas, scan... assinatura").

**Especificação técnica**
- `Dockerfile`s *multi-stage*; base mínima (distroless/slim) fixada por digest; usuário não-root; sem ferramentas de build na imagem final; `HEALTHCHECK`; `LABEL` com commit e versão.
- Registro de imagens (privado) com *tags* imutáveis; implantação **por digest**.
- SBOM (CycloneDX) por imagem; `trivy image` com limite de severidade que bloqueia; `hadolint`.
- Assinatura com `cosign` (chave em segredo do CI ou *keyless* conforme provedor) e **verificação de assinatura no provisioner** antes de implantar um runtime; proveniência (SLSA nível alcançável) registrada.
- Política de atualização de dependências (Renovate/Dependabot) com revisão obrigatória em dependências de segurança do runtime/gateways; *pinning* de hashes (`uv.lock`, `pnpm-lock`).
- Todas as imagens de runtime de todos os tenants são **a mesma imagem versionada** (ADR seção 14).

**Critérios de aceite**
- [ ] Imagem sem assinatura válida é recusada pelo provisioner (teste).
- [ ] Vulnerabilidade crítica sintética bloqueia o pipeline.
- [ ] SBOM anexado a cada release.

---

<a id="ent-iso-004"></a>
## ENT-ISO-004 — Controle de egress e proteção contra SSRF

**Sprint** S04 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Segurança de rede
**Depende de:** ISO-003 · **Bloqueia:** TGW-005, TGW-006, AIG-001, GATE-001
**Referências:** ADR seção 7 ("Saída para internet..."), SEC-12.

**Especificação técnica**
- **Camada de rede**: tenants não têm rota direta à internet; saída apenas via **proxy de egress** (`nuc_infra`) com allowlist por serviço/domínio (AI Gateway, APIs de integração autorizadas); regras nftables negam destinos RFC1918, loopback, link-local (`169.254.0.0/16`), CGNAT (`100.64.0.0/10`), multicast e IPv6 equivalentes.
- **Camada de aplicação** (biblioteca `ssrf-guard` em TS e Python, usada por Tool Gateway e conectores): resolver DNS **uma vez**, validar todos os IPs resolvidos contra a lista de bloqueio e **conectar ao IP validado** (anti DNS rebinding); revalidar em cada redirecionamento (limite de saltos); permitir somente `https`, portas allowlist, tamanho máximo de resposta, *timeout*; proibir esquemas `file:`, `gopher:` etc.; normalização de URL (formas decimais/octais/IPv6-mapped/Unicode).
- Metadados de nuvem e `localhost` bloqueados por teste explícito, incluindo variações de codificação.
- Log de egress negado como evento de segurança (sem URL completa com *query*).
- Proxy de egress também aplica limites de taxa e de banda por tenant.

**Critérios de aceite**
- [ ] Corpus de ≥ 40 URLs maliciosas (decimais, `0x7f.1`, `[::ffff:127.0.0.1]`, redirecionamento para IP interno, rebinding simulado) é totalmente bloqueado (SEC-12).
- [ ] Tenant não alcança internet sem passar pelo proxy.
- [ ] Destino permitido legítimo funciona (teste positivo).

**Testes.** Corpus de SSRF em TS e Python; testes de integração com servidor DNS controlado (rebinding); testes de rede (sondas).

---

<a id="ent-iso-006"></a>
## ENT-ISO-006 — Volumes e quotas por tenant

**Sprint** S06 · **Prioridade** Média · **Tam.** M · **Risco** MÉDIO · **Tipo** Infraestrutura
**Depende de:** ISO-003 · **Bloqueia:** PRV-005

**Especificação técnica**
- Layout `/var/lib/nucleos/tenants/<tenant_id>/{data,tmp}` com dono `10001` (ou UID remapeado), modo 0700; **volume nomeado exclusivo por tenant**, nunca compartilhado; sem *bind mount* de diretório pai.
- Quota de disco por tenant: avaliar quotas de projeto (XFS/ext4 `prjquota`) ou *loop devices*; se indisponível, limitar por `tmpfs size`/monitor + alerta e registrar risco.
- Limite de inodes e tamanho de arquivo (`ulimit fsize`); limpeza de `tmp` no reinício.
- Backup de volumes persistentes (se existirem) integrado a DAT-007.
- Teste de ocupação: tenant que enche disco não afeta PostgreSQL nem outros tenants.

**Critérios de aceite**
- [ ] Runtime A não enxerga diretório/volume de B (teste de montagem).
- [ ] Escrita excedendo a quota falha com erro controlado sem afetar o host.

---

<a id="ent-iso-008"></a>
## ENT-ISO-008 — Suíte automatizada de isolamento host/rede

**Sprint** S08 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Segurança/Testes
**Depende de:** ISO-003..006, PRV-005 · **Bloqueia:** GATE-001
**Referências:** SEC-04, SEC-11, SEC-12, SEC-16.

**Especificação técnica**
- Container "atacante" executado **com a mesma spec de um runtime de tenant** (mesma rede, usuário, capabilities), roda a matriz: A→B (IP, DNS, portas, volumes), A→control DB/Redis, A→host/gateway/metadados, A→Docker socket (`/var/run/docker.sock` ausente; API TCP 2375/2376 inalcançável), tentativa de `--privileged` não aplicável ao tenant, `mount`, `ptrace`, `unshare`, escrita no rootfs (read-only), carregamento de módulo de kernel.
- Verificação de configuração estática de todos os containers em execução (`docker inspect`) contra a política de ISO-002.
- Executa **após** `docker restart`/reboot (job noturno em staging).
- Relatório de evidências (JUnit + markdown) para o dossiê GATE-001.

**Critérios de aceite**
- [ ] Todos os testes de rede/host passam em staging após reinício do daemon.
- [ ] Container de tenant "adulterado" (spec com `privileged`) é detectado pelo inspetor estático.
- [ ] Resultado anexado à matriz de SEC-04/11/12/16.
