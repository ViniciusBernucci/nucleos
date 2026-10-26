#!/usr/bin/env bash
# PoC descartavel DEC-013: papeis PostgreSQL por tenant (owner, migrator, app, tools).
# Container efemero, SEM porta publicada (acesso so por docker exec), sem dados reais.
# Senhas aleatorias geradas aqui, nunca impressas. Destroi o container ao final.
set -uo pipefail
IMG="${PG_IMAGE:-postgres:16-alpine}"
NAME="dec013-pg-$$"
PASS=0; FAIL=0
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1; }
trap cleanup EXIT
rnd() { openssl rand -hex 16; }
ADMINPW=$(rnd)
declare -A PW
for t in ta tb; do for r in migrator app tools; do PW[${t}_$r]=$(rnd); done; done
PW[nucleos_cp]=$(rnd)

docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$ADMINPW" "$IMG" >/dev/null || exit 2
for i in $(seq 1 60); do
  docker exec "$NAME" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1 && break; sleep 1
done
sleep 2
HOST=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$NAME")
echo "# imagem: $IMG ; $(docker exec "$NAME" postgres --version)"

# admin: papel do provisioner (no PoC, o superuser do container descartavel)
adm() { docker exec -i -e PGPASSWORD="$ADMINPW" "$NAME" psql -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -U postgres "$@"; }
# como um papel de tenant: $1=papel $2=database ; SQL em stdin; retorna codigo do psql
as() { local role="$1" db="$2"; shift 2
  docker exec -i -e PGPASSWORD="${PW[$role]}" "$NAME" psql -v ON_ERROR_STOP=1 -q -t -A -h "$HOST" -U "${role}" -d "$db" "$@"; }

adm -d postgres <<SQL
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
CREATE ROLE nucleos_cp LOGIN PASSWORD '${PW[nucleos_cp]}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE DATABASE nucleos_control OWNER nucleos_cp;
REVOKE ALL ON DATABASE nucleos_control FROM PUBLIC;
SQL

provision() { local t="$1"
adm -d postgres <<SQL
CREATE ROLE ${t}_owner    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE ${t}_migrator LOGIN PASSWORD '${PW[${t}_migrator]}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
CREATE ROLE ${t}_app      LOGIN PASSWORD '${PW[${t}_app]}'      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 10;
CREATE ROLE ${t}_tools    LOGIN PASSWORD '${PW[${t}_tools]}'    NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 10;
GRANT ${t}_owner TO ${t}_migrator WITH INHERIT FALSE, SET TRUE;
CREATE DATABASE ${t} OWNER ${t}_owner;
REVOKE ALL ON DATABASE ${t} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${t} TO ${t}_migrator, ${t}_app, ${t}_tools;
ALTER ROLE ${t}_app   SET statement_timeout = '30s';
ALTER ROLE ${t}_tools SET statement_timeout = '30s';
SQL
# esquema do tenant: aplicado como migrator -> SET ROLE owner (objetos pertencem ao owner)
PGPASSWORD="${PW[${t}_migrator]}" docker exec -i -e PGPASSWORD="${PW[${t}_migrator]}" "$NAME" \
  psql -v ON_ERROR_STOP=1 -q -h "$HOST" -U ${t}_migrator -d ${t} <<SQL
SET ROLE ${t}_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ${t}_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE SCHEMA runtime; CREATE SCHEMA content; CREATE SCHEMA audit;
CREATE TABLE runtime.conversations (id uuid PRIMARY KEY, user_id uuid NOT NULL, title text NOT NULL);
CREATE TABLE runtime.messages (id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES runtime.conversations(id), role text NOT NULL, body text NOT NULL);
CREATE TABLE runtime.executions (id uuid PRIMARY KEY, status text NOT NULL, started_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE content.documents (id uuid PRIMARY KEY, title text NOT NULL, status text NOT NULL, body_ref text NOT NULL);
CREATE TABLE content.chunks (id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES content.documents(id), chunk_text text NOT NULL);
CREATE TABLE audit.tool_invocations (id bigserial PRIMARY KEY, execution_id uuid, tool text NOT NULL, actor text NOT NULL, outcome text NOT NULL, at timestamptz NOT NULL DEFAULT now());
CREATE VIEW runtime.documents_listing AS SELECT id, title, status FROM content.documents;
-- app: so o esquema runtime; sem DELETE; sem acesso a content; leitura da auditoria
GRANT USAGE ON SCHEMA runtime TO ${t}_app;
GRANT SELECT, INSERT, UPDATE ON runtime.conversations, runtime.messages, runtime.executions TO ${t}_app;
GRANT SELECT ON runtime.documents_listing TO ${t}_app;
GRANT USAGE ON SCHEMA audit TO ${t}_app;
GRANT SELECT ON audit.tool_invocations TO ${t}_app;
-- tools: so content e escrita append-only na auditoria; sem acesso a runtime
GRANT USAGE ON SCHEMA content TO ${t}_tools;
GRANT SELECT, INSERT, UPDATE, DELETE ON content.documents, content.chunks TO ${t}_tools;
GRANT USAGE ON SCHEMA audit TO ${t}_tools;
GRANT INSERT ON audit.tool_invocations TO ${t}_tools;
GRANT USAGE ON SEQUENCE audit.tool_invocations_id_seq TO ${t}_tools;
RESET ROLE;
SQL
adm -d ${t} <<SQL
SET ROLE ${t}_owner;
INSERT INTO runtime.conversations VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000aa','demo');
INSERT INTO runtime.messages VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','user','ola');
INSERT INTO content.documents VALUES ('00000000-0000-0000-0000-000000000003','doc','ready','ref');
INSERT INTO content.chunks VALUES ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','texto sintetico');
SQL
}
provision ta && provision tb || { echo "provisionamento falhou"; exit 2; }

# expect_ok / expect_deny: $1 descricao ; $2 papel ; $3 db ; $4 SQL
expect_ok()   { if out=$(as "$2" "$3" -c "$4" 2>&1); then echo "PASS  $1"; PASS=$((PASS+1)); else echo "FAIL  $1 -> $out"; FAIL=$((FAIL+1)); fi; }
# expect_deny: o SQL deve falhar COM a mensagem esperada ($5, regex; padrao: permission denied|password authentication failed)
expect_deny() { local re="${5:-permission denied|password authentication failed}"
  if out=$(as "$2" "$3" -c "$4" 2>&1); then echo "FAIL  $1 (era para negar)"; FAIL=$((FAIL+1))
  elif grep -Eqi "$re" <<<"$out"; then echo "PASS  $1 [negado: $(echo "$out" | head -1 | sed 's/^psql: error: //' | cut -c1-90)]"; PASS=$((PASS+1))
  else echo "FAIL  $1 (falhou por motivo inesperado: $(echo "$out" | head -1 | cut -c1-120))"; FAIL=$((FAIL+1)); fi; }
# expect_eq: o SQL (-t -A) deve devolver exatamente $5
expect_eq() { if out=$(as "$2" "$3" -c "$4" 2>&1) && [ "$out" = "$5" ]; then echo "PASS  $1 [= $5]"; PASS=$((PASS+1)); else echo "FAIL  $1 (obtido: $(echo "$out" | head -1 | cut -c1-100); esperado: $5)"; FAIL=$((FAIL+1)); fi; }

echo "== controle positivo/negativo do harness"
expect_ok   "app lê runtime.messages"                      ta_app ta "SELECT count(*) FROM runtime.messages"
PW_BAD=${PW[ta_app]}; PW[ta_app]=errada
expect_deny "senha errada é negada (harness detecta negação)" ta_app ta "SELECT 1"
PW[ta_app]=$PW_BAD

echo "== app (runtime): escopo operacional"
expect_ok   "app INSERT em runtime.executions"            ta_app ta "INSERT INTO runtime.executions(id,status) VALUES (gen_random_uuid(),'running')"
expect_ok   "app UPDATE em runtime.executions"            ta_app ta "UPDATE runtime.executions SET status='done'"
expect_deny "app DELETE em runtime.messages"              ta_app ta "DELETE FROM runtime.messages"
expect_ok   "app lê a listagem de documentos (view)"      ta_app ta "SELECT id,title,status FROM runtime.documents_listing"
expect_deny "app lê content.chunks"                       ta_app ta "SELECT * FROM content.chunks"
expect_deny "app lê content.documents"                    ta_app ta "SELECT * FROM content.documents"
expect_ok   "app lê audit.tool_invocations"               ta_app ta "SELECT count(*) FROM audit.tool_invocations"
expect_deny "app INSERT em audit.tool_invocations"        ta_app ta "INSERT INTO audit.tool_invocations(tool,actor,outcome) VALUES ('x','y','z')"
expect_deny "app CREATE TABLE no schema public"           ta_app ta "CREATE TABLE public.x(i int)"
expect_deny "app SET ROLE owner"                          ta_app ta "SET ROLE ta_owner"

echo "== tools (sidecar): escopo de ferramentas"
expect_ok   "tools lê content.chunks"                     ta_tools ta "SELECT count(*) FROM content.chunks"
expect_ok   "tools escreve content.documents"             ta_tools ta "UPDATE content.documents SET status='indexed'"
expect_deny "tools lê runtime.messages"                   ta_tools ta "SELECT * FROM runtime.messages"
expect_deny "tools lê runtime.conversations"              ta_tools ta "SELECT * FROM runtime.conversations"
expect_ok   "tools INSERT em audit.tool_invocations"      ta_tools ta "INSERT INTO audit.tool_invocations(tool,actor,outcome) VALUES ('buscar_documento','user:aa','allowed')"
expect_deny "tools lê audit.tool_invocations"             ta_tools ta "SELECT * FROM audit.tool_invocations"
expect_deny "tools UPDATE em audit (append-only)"         ta_tools ta "UPDATE audit.tool_invocations SET outcome='x'"
expect_deny "tools DELETE em audit (append-only)"         ta_tools ta "DELETE FROM audit.tool_invocations"
expect_deny "tools CREATE TABLE no schema content"        ta_tools ta "CREATE TABLE content.y(i int)"

echo "== migrator: DDL somente via owner, sem login em outro tenant"
expect_ok   "migrator SET ROLE owner + CREATE no schema runtime" ta_migrator ta "SET ROLE ta_owner; CREATE TABLE runtime.m_probe(i int); DROP TABLE runtime.m_probe"
expect_deny "migrator sem SET ROLE não cria em runtime"   ta_migrator ta "CREATE TABLE runtime.m_probe2(i int)"

echo "== SEC-02 / SEC-03: fronteira entre bancos"
for r in app tools migrator; do
  expect_deny "ta_$r conecta ao banco tb (SEC-02)"        ta_$r tb "SELECT 1"
  expect_deny "ta_$r conecta ao nucleos_control (SEC-03)" ta_$r nucleos_control "SELECT 1"
  expect_deny "ta_$r conecta ao banco postgres"           ta_$r postgres "SELECT 1"
  expect_deny "ta_$r conecta ao template1"                ta_$r template1 "SELECT 1"
done
expect_deny "tb_app conecta ao banco ta"                  tb_app ta "SELECT 1"
expect_deny "nucleos_cp conecta ao banco ta (CP sem papel de leitura no tenant: rejeita opção 1-B)" nucleos_cp ta "SELECT 1"
expect_ok   "CP conecta ao seu banco de controle"         nucleos_cp nucleos_control "SELECT 1"

echo "== controles de configuração (REVIEW-006): limites, timeout, PUBLIC, privilégios padrão"
expect_eq   "app: statement_timeout = 30s"                ta_app   ta "SHOW statement_timeout" "30s"
expect_eq   "tools: statement_timeout = 30s"              ta_tools ta "SHOW statement_timeout" "30s"
expect_eq   "PUBLIC sem USAGE no schema public (REVOKE ALL ON SCHEMA public aplicado; o padrão do PG 16 é USAGE)" ta_app ta "SELECT has_schema_privilege('public','public','USAGE')" "f"
# CONNECTION LIMIT 2 do migrator: duas sessões ocupadas, a terceira deve falhar
( as ta_migrator ta -c "SELECT pg_sleep(8)" >/dev/null 2>&1 ) & ( as ta_migrator ta -c "SELECT pg_sleep(8)" >/dev/null 2>&1 ) &
for i in $(seq 1 20); do n=$(adm -d postgres -t -A -c "SELECT count(*) FROM pg_stat_activity WHERE usename='ta_migrator' AND state='active'"); [ "$n" = "2" ] && break; sleep 0.5; done
expect_deny "migrator: 3ª conexão simultânea excede CONNECTION LIMIT 2" ta_migrator ta "SELECT 1" "too many connections for role"
wait
# ALTER DEFAULT PRIVILEGES: função nova do owner não é executável por app sem GRANT (sem o ADP, PUBLIC teria EXECUTE)
as ta_migrator ta -c "SET ROLE ta_owner; CREATE FUNCTION runtime.f_probe() RETURNS int LANGUAGE sql AS 'SELECT 1'" >/dev/null 2>&1
expect_deny "app não executa função nova do owner sem GRANT" ta_app ta "SELECT runtime.f_probe()" "permission denied for function"

echo "== provisioner sem superuser (REVIEW-002): bootstrap vs operação"
BOOT=$(adm -d postgres -t -A -c "SELECT count(*) FROM pg_database d, LATERAL aclexplode(d.datacl) a WHERE d.datname IN ('postgres','template1') AND a.grantee=0 AND a.privilege_type='CONNECT'")
if [ "$BOOT" = "0" ]; then echo "PASS  bootstrap (superuser): datacl de postgres/template1 sem CONNECT para PUBLIC"; PASS=$((PASS+1)); else echo "FAIL  datacl de postgres/template1 ainda concede CONNECT a PUBLIC ($BOOT)"; FAIL=$((FAIL+1)); fi
PW[prov]=$(rnd)
adm -d postgres -c "CREATE ROLE prov LOGIN PASSWORD '${PW[prov]}' NOSUPERUSER CREATEDB CREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS"
adm -d postgres -c "GRANT CONNECT ON DATABASE postgres TO prov"   # bootstrap: banco de manutencao do provisioner (a revogacao de PUBLIC o deixou sem acesso)
expect_eq   "provisioner não é superuser"                 prov postgres "SELECT rolsuper::text FROM pg_roles WHERE rolname=current_user" "false"
# operação do provisioner: cria papéis/database do tenant tc; precisa de SET no owner (CREATE DATABASE ... OWNER)
expect_ok   "prov cria owner e app de tc"                 prov postgres "CREATE ROLE tc_owner NOLOGIN NOINHERIT; CREATE ROLE tc_app LOGIN PASSWORD '${PW[prov]}x' NOSUPERUSER NOINHERIT"
expect_deny "prov: CREATE DATABASE ... OWNER sem SET no owner falha" prov postgres "CREATE DATABASE tc OWNER tc_owner" "must be able to SET ROLE"
expect_ok   "prov concede SET TRUE no owner a si mesmo (ADMIN do criador)" prov postgres "GRANT tc_owner TO prov WITH SET TRUE, INHERIT FALSE"
expect_ok   "prov cria database de tc com OWNER e revoga PUBLIC" prov postgres "CREATE DATABASE tc OWNER tc_owner"
expect_ok   "prov (como owner) revoga PUBLIC e concede CONNECT ao app" prov postgres "SET ROLE tc_owner; REVOKE ALL ON DATABASE tc FROM PUBLIC; GRANT CONNECT ON DATABASE tc TO tc_app"
PW[tc_app]="${PW[prov]}x"
expect_ok   "tc_app conecta ao seu database"              tc_app tc "SELECT 1"
expect_deny "tc_app não conecta a ta"                     tc_app ta "SELECT 1"
expect_deny "prov não conecta ao database de outro tenant (ta) sem membership" prov ta "SELECT 1"
expect_deny "prov sem superuser não consegue revogar CONNECT de PUBLIC em template1 (precisa do bootstrap)" prov postgres "REVOKE CONNECT ON DATABASE template1 FROM PUBLIC" "permission denied for database template1|must be owner"

echo "== atributos dos papéis (nenhum privilegiado)"
BAD=$(adm -d postgres -t -A -c "SELECT count(*) FROM pg_roles WHERE rolname ~ '^t[ab]_' AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit)")
if [ "$BAD" = "0" ]; then echo "PASS  nenhum papel de tenant tem superuser/createdb/createrole/replication/bypassrls/inherit"; PASS=$((PASS+1)); else echo "FAIL  papéis com atributo indevido: $BAD"; FAIL=$((FAIL+1)); fi
MEM=$(adm -d postgres -t -A -c "SELECT string_agg(r.rolname||'->'||m.rolname, ',' ORDER BY r.rolname) FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.member JOIN pg_roles m ON m.oid=am.roleid WHERE r.rolname ~ '^t[ab]_'")
echo "INFO  membros (efetivo): $MEM"
[ "$MEM" = "ta_migrator->ta_owner,tb_migrator->tb_owner" ] && { echo "PASS  única associação: migrator->owner do próprio tenant (SET, sem INHERIT)"; PASS=$((PASS+1)); } || { echo "FAIL  associações inesperadas"; FAIL=$((FAIL+1)); }

echo "== resumo: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ]
