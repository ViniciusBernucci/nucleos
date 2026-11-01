#!/usr/bin/env python3
"""Token Observatory v1 - CLI Claude/Codex observability; only Python stdlib.

No model API calls. No prompts, model responses, tool arguments, or raw OTLP payloads stored.
"""
import argparse
from contextlib import contextmanager, closing
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
import uuid
from urllib.parse import quote

VERSION = '2.1.0'
SCHEMA = '''
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, project TEXT NOT NULL, batch TEXT, ticket TEXT,
  role TEXT, skill TEXT, provider TEXT NOT NULL, source TEXT NOT NULL,
  cwd TEXT, project_root TEXT, started_at TEXT NOT NULL, finished_at TEXT,
  status TEXT NOT NULL, exit_code INTEGER, notes TEXT
);
CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id),
  source TEXT NOT NULL, source_key TEXT NOT NULL,
  provider TEXT NOT NULL, model TEXT, session_id TEXT, request_id TEXT,
  skill TEXT, role TEXT, agent TEXT, query_source TEXT,
  input_uncached INTEGER, cache_read INTEGER, cache_write INTEGER,
  output_tokens INTEGER, reasoning_tokens INTEGER,
  duration_ms INTEGER, recorded_at TEXT NOT NULL,
  UNIQUE(source, source_key)
);
CREATE INDEX IF NOT EXISTS idx_usage_run ON usage_events(run_id);
CREATE INDEX IF NOT EXISTS idx_run_ticket ON runs(ticket);
CREATE INDEX IF NOT EXISTS idx_run_batch ON runs(batch);
CREATE TABLE IF NOT EXISTS tool_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE, tool_type TEXT NOT NULL,
  success INTEGER, recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT,
  kind TEXT NOT NULL, detail TEXT, recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS process_events (
  source_key TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id),
  skill TEXT, role TEXT, agent TEXT, stage TEXT, session TEXT, parent TEXT,
  status TEXT NOT NULL, duration_ms INTEGER, recorded_at TEXT NOT NULL
);
'''


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def db_path():
    """One central database across projects; override with TOKEN_OBSERVATORY_DB."""
    if os.environ.get('TOKEN_OBSERVATORY_DB'):
        return Path(os.environ['TOKEN_OBSERVATORY_DB']).expanduser().resolve()
    if os.environ.get('TOKEN_OBSERVATORY_HOME'):
        home = Path(os.environ['TOKEN_OBSERVATORY_HOME']).expanduser().resolve()
    else:
        home = Path.home() / '.token-observatory'
    return home / 'data' / 'token-observatory.sqlite'


def execution_dir(path=None):
    folder = Path(path).expanduser().resolve() if path else Path.cwd().resolve()
    if not folder.is_dir():
        raise ValueError(f'A pasta do projeto não existe: {folder}')
    return str(folder)


def project_root(path=None):
    """Canonical project identity: main repository for all linked Git worktrees.

    Execution still happens in the original worktree directory, never in main.
    """
    folder = Path(execution_dir(path))
    try:
        git = subprocess.run(['git', '-C', str(folder), 'rev-parse', '--git-common-dir'],
                             capture_output=True, text=True, timeout=5, check=False)
        if git.returncode == 0 and git.stdout.strip():
            common = Path(git.stdout.strip())
            if not common.is_absolute():
                common = folder / common
            common = common.resolve()
            if common.name == '.git':
                return str(common.parent)
            if common.is_dir():
                # Bare or nonstandard Git layouts use the shared metadata path as identity.
                return str(common)
    except (OSError, subprocess.TimeoutExpired):
        pass
    return str(folder)


def project_identity(directory, label=None):
    root = project_root(directory)
    # Hash prevents two unrelated folders with the same basename from collapsing.
    default_label = Path(root).name + '-' + hashlib.sha256(os.path.normcase(root).encode()).hexdigest()[:8]
    return (label or default_label), root



def conn():
    p = db_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    # Keep generated records out of the skills repository without editing its root .gitignore.
    if p.parent.name == '.runtime':
        local_ignore = p.parent / '.gitignore'
        if not local_ignore.exists():
            local_ignore.write_text('*\n!.gitignore\n', encoding='utf-8')
    con = sqlite3.connect(str(p), timeout=15)
    con.execute('PRAGMA foreign_keys=ON')
    con.execute('PRAGMA busy_timeout=15000')
    con.executescript(SCHEMA)
    # Compatible migration of a v1 shared database, preserving existing runs.
    cols = {r[1] for r in con.execute('PRAGMA table_info(runs)')}
    if 'project_root' not in cols:
        con.execute('ALTER TABLE runs ADD COLUMN project_root TEXT')
    con.execute('CREATE INDEX IF NOT EXISTS idx_run_project_root ON runs(project_root)')
    process_cols = {r[1] for r in con.execute('PRAGMA table_info(process_events)')}
    if 'metrics' not in process_cols:
        con.execute("ALTER TABLE process_events ADD COLUMN metrics TEXT NOT NULL DEFAULT '{}'")
    return con


@contextmanager
def opened():
    database = conn()
    try:
        with database:
            yield database
    finally:
        database.close()


def begin_run(*, project, batch, ticket, role, skill, provider, source, cwd, project_root_value=None, run_id=None):
    run_id = run_id or str(uuid.uuid4())
    with opened() as con:
        con.execute('''INSERT INTO runs(id,project,batch,ticket,role,skill,provider,source,cwd,project_root,started_at,status)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING''',
            (run_id, project, batch, ticket, role, skill, provider, source, cwd, project_root_value, now(), 'RUNNING'))
    return run_id


def finish_run(run_id, code, status=None):
    with opened() as con:
        con.execute('UPDATE runs SET finished_at=?,status=?,exit_code=? WHERE id=?',
                    (now(), status or ('COMPLETE' if code == 0 else 'FAILED'), code, run_id))


def positive_int(value):
    if value is None or value == '':
        return None
    try:
        i = int(value)
    except (TypeError, ValueError):
        return None
    return i if i >= 0 else None


def anyvalue(v):
    if not isinstance(v, dict):
        return v
    for k in ('stringValue', 'intValue', 'doubleValue', 'boolValue'):
        if k in v:
            return v[k]
    return None


def attrs(entries):
    return {e.get('key'): anyvalue(e.get('value')) for e in (entries or []) if isinstance(e, dict) and e.get('key')}


def add_usage(run_id, *, source, key, provider, model=None, session=None, request=None,
              skill=None, role=None, agent=None, query_source=None,
              input_uncached=None, cache_read=None, cache_write=None,
              output_tokens=None, reasoning=None, duration=None):
    # A SQL UNIQUE constraint keeps exporter retries and imports idempotent.
    with opened() as con:
        con.execute('''INSERT OR IGNORE INTO usage_events
           (run_id,source,source_key,provider,model,session_id,request_id,skill,role,agent,query_source,
            input_uncached,cache_read,cache_write,output_tokens,reasoning_tokens,duration_ms,recorded_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
           (run_id,source,key,provider,model,session,request,skill,role,agent,query_source,
            positive_int(input_uncached),positive_int(cache_read),positive_int(cache_write),
            positive_int(output_tokens),positive_int(reasoning),positive_int(duration),now()))


def observation(run_id, kind, detail):
    with opened() as con:
        con.execute('INSERT INTO observations(run_id,kind,detail,recorded_at) VALUES(?,?,?,?)',
                    (run_id,kind,str(detail)[:250],now()))


def add_tool(run_id, key, kind, success=None):
    with opened() as con:
        con.execute('INSERT OR IGNORE INTO tool_events(run_id,source_key,tool_type,success,recorded_at) VALUES(?,?,?,?,?)',
                    (run_id,key,kind,success,now()))


def seed_or_otlp_run(run_id, properties, session_id, provider='claude'):
    if run_id:
        return run_id
    # Standalone collector: one run per provider session; attribution is unknown unless supplied.
    sid = session_id or 'unknown'
    rid = 'otel-' + hashlib.sha256((properties.get('service.name','') + ':' + sid).encode()).hexdigest()[:24]
    root = properties.get('observatory.project_root')
    return begin_run(project=properties.get('observatory.project','unattributed'),
       batch=properties.get('observatory.batch'), ticket=properties.get('observatory.ticket'),
       role=properties.get('observatory.role'), skill=properties.get('observatory.skill'),
       provider=provider, source='otel-standalone', cwd=root or '',
       project_root_value=root, run_id=rid)


def handle_otel(payload, explicit_run_id=None):
    """Accept OTLP/HTTP JSON logs. Never persist raw attributes or messages."""
    count=0
    for rl in payload.get('resourceLogs', []):
        resource = attrs(rl.get('resource', {}).get('attributes', []))
        for scope in rl.get('scopeLogs', []):
            for log in scope.get('logRecords', []):
                a = attrs(log.get('attributes', []))
                ev = a.get('event.name') or anyvalue(log.get('body'))
                ev = str(ev or '')
                session_id = a.get('session.id') or a.get('session_id') or resource.get('session.id')
                rid = seed_or_otlp_run(explicit_run_id, resource, session_id)
                seq = a.get('event.sequence')
                request = a.get('request_id') or a.get('client_request_id')
                if ev in ('api_request','claude_code.api_request'):
                    # Event sequence is per process; add session/request for correlation and replay dedup.
                    if seq is not None:
                        unique = f'{rid}:{session_id}:{seq}'
                    elif request:
                        unique = f'{rid}:{session_id}:{request}'
                    else:
                        unique = f'{rid}:{hashlib.sha256(json.dumps(a,sort_keys=True,default=str).encode()).hexdigest()}'
                    add_usage(rid,source='claude-otel',key=unique,provider='claude',
                        model=a.get('model'),session=session_id,request=request,
                        skill=a.get('skill.name') or ('(subagente sem skill)' if a.get('agent.name') else resource.get('observatory.skill')),
                        role=a.get('agent.name') or resource.get('observatory.role'),agent=a.get('agent.name'),
                        query_source=a.get('query_source'),input_uncached=a.get('input_tokens'),
                        cache_read=a.get('cache_read_tokens'),cache_write=a.get('cache_creation_tokens'),
                        output_tokens=a.get('output_tokens'),duration=a.get('duration_ms'))
                    count += 1
                elif ev in ('tool_result','claude_code.tool_result'):
                    unique=f'{rid}:{session_id}:tool:{seq or a.get("tool_use_id")}'
                    add_tool(rid, unique, str(a.get('tool_name') or 'tool'),
                        1 if str(a.get('success')).lower()=='true' else 0)
    return count


class Receiver(BaseHTTPRequestHandler):
    run_id = None
    def do_POST(self):
        if self.path not in ('/v1/logs','/v1/metrics'):
            self.send_error(404);return
        length = positive_int(self.headers.get('Content-Length'))
        if length is None or length > 2_000_000:
            self.send_error(413);return
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
            if not isinstance(data, dict): raise ValueError('Invalid payload')
            if self.path == '/v1/logs':
                handle_otel(data,self.run_id)
            # Metrics are deliberately not stored: api_request log counts are canonical.
            self.send_response(200)
            self.send_header('Content-Type','application/json')
            self.end_headers()
            self.wfile.write(b'{}')
        except (ValueError, TypeError) as exc:
            self.send_error(400, str(exc)[:100])
        except Exception:
            self.send_error(500, 'Collector error')
    def do_GET(self):
        if self.path != '/health':self.send_error(404);return
        self.send_response(200);self.end_headers();self.wfile.write(b'OK')
    def log_message(self,*args):
        pass


def serve(port, run_id=None):
    cls = type('BoundReceiver',(Receiver,),{'run_id':run_id})
    server=ThreadingHTTPServer(('127.0.0.1',port),cls)
    server.daemon_threads=True
    return server


def run_cli(args):
    command = list(args.command)
    if command and command[0]=='--': command.pop(0)
    if not command:
        raise SystemExit('Informe comando após -- (ex.: -- claude ou -- codex exec --json ...).')
    name=Path(command[0]).stem.lower()
    if name not in ('claude','codex','claude.exe','codex.exe'):
        raise SystemExit('Somente CLI claude/codex, não execução arbitrária.')
    if not name.startswith(args.provider):
        raise SystemExit('O provedor informado não corresponde ao comando.')
    if args.provider=='codex' and ('exec' not in command or '--json' not in command):
        raise SystemExit('Para Codex, use codex exec --json. Modo interativo não fornece JSONL por esta ferramenta.')
    if args.provider=='claude' and os.environ.get('ANTHROPIC_API_KEY'):
        raise SystemExit('ANTHROPIC_API_KEY está definido. Retire-o desta sessão antes de usar a assinatura Claude CLI, para evitar cobrança API inesperada.')
    if args.provider=='codex' and os.environ.get('OPENAI_API_KEY'):
        raise SystemExit('OPENAI_API_KEY está definido. Retire-o desta sessão antes de usar o login da assinatura no Codex CLI.')
    cwd = execution_dir(args.project_dir)
    label, root = project_identity(cwd, args.project)
    rid=begin_run(project=label,batch=args.batch,ticket=args.ticket,role=args.role,
                  skill=args.skill,provider=args.provider,source='wrapped-cli',cwd=cwd,
                  project_root_value=root)
    code=1
    server=None
    env=dict(os.environ)
    env.update({'CONTEXTO_PARENT': rid, 'CONTEXTO_PROVIDER': args.provider,
                'CONTEXTO_SESSION': env.get('CONTEXTO_SESSION') or rid})
    for key in ('batch', 'ticket', 'role', 'skill'):
        if getattr(args, key, None): env['CONTEXTO_' + key.upper()] = getattr(args, key)
    try:
        if args.provider=='claude':
            server=serve(0,rid)
            th=threading.Thread(target=server.serve_forever,daemon=True)
            th.start()
            port=server.server_address[1]
            env.update({
                'CLAUDE_CODE_ENABLE_TELEMETRY':'1',
                'OTEL_LOGS_EXPORTER':'otlp',
                'OTEL_METRICS_EXPORTER':'none',
                'OTEL_EXPORTER_OTLP_LOGS_PROTOCOL':'http/json',
                'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT':f'http://127.0.0.1:{port}/v1/logs',
                'OTEL_LOGS_EXPORT_INTERVAL':'1000',
                'OTEL_LOG_TOOL_DETAILS':'0',
                'OTEL_LOG_RAW_API_BODIES':'0',
                'OTEL_LOG_USER_PROMPTS':'0'
            })
            # Namespaced resource labels: attribute the native OTLP records to this batch.
            custom = {'observatory.run_id': rid, 'observatory.project': label,
                      'observatory.project_root': root, 'observatory.batch': args.batch, 'observatory.ticket': args.ticket,
                      'observatory.role': args.role, 'observatory.skill': args.skill}
            current = env.get('OTEL_RESOURCE_ATTRIBUTES','').strip(',')
            labels = [f'{k}={quote(str(v),safe="-_.~")}' for k,v in custom.items() if v]
            env['OTEL_RESOURCE_ATTRIBUTES'] = ','.join(([current] if current else []) + labels)
            # Use process-bound collector; do not forward to external OTLP endpoints.
            proc=subprocess.run(command, env=env, cwd=cwd, check=False)
            code=proc.returncode
            # Give the CLI exporter a chance to flush before receiver is stopped.
            time.sleep(1)
        else:
            proc=subprocess.Popen(command,env=env,cwd=cwd,stdout=subprocess.PIPE,stderr=None,
                                  text=True,encoding='utf-8',errors='replace',bufsize=1)
            idx=0
            thread_id=None
            turn_id=0
            for line in proc.stdout:
                if not args.quiet:sys.stdout.write(line);sys.stdout.flush()
                try:
                    event=json.loads(line)
                except json.JSONDecodeError:
                    continue
                idx+=1
                typ=event.get('type')
                if args.quiet and typ=='item.completed':
                    item_for_display=event.get('item') or {}
                    if item_for_display.get('type')=='agent_message':
                        message=str(item_for_display.get('text') or '')
                        if message:
                            print(message[:8000] + ('\n[resposta resumida pelo coletor]' if len(message)>8000 else ''),flush=True)
                if typ=='thread.started':thread_id=event.get('thread_id')
                if typ=='turn.started':turn_id+=1
                if typ=='turn.completed':
                    usage=event.get('usage') or {}
                    inp=positive_int(usage.get('input_tokens'))
                    cached=positive_int(usage.get('cached_input_tokens'))
                    uncached=None if inp is None or cached is None else max(0,inp-cached)
                    add_usage(rid,source='codex-jsonl',key=f'{rid}:line:{idx}',provider='codex',
                      session=thread_id,skill=args.skill,role=args.role,input_uncached=uncached,
                      cache_read=cached,cache_write=None,
                      output_tokens=usage.get('output_tokens'),reasoning=usage.get('reasoning_output_tokens'))
                if typ=='item.completed':
                    item=event.get('item') or {};kind=item.get('type') or item.get('item_type')
                    if kind in ('command_execution','mcp_tool_call','web_search','file_change'):
                        add_tool(rid,f'{rid}:{thread_id}:{turn_id}:{item.get("id",idx)}',kind)
            code=proc.wait()
        return code
    except FileNotFoundError:
        code=127
        observation(rid,'missing_cli',command[0])
        print('CLI não encontrado no PATH: '+command[0],file=sys.stderr)
        return 127
    except KeyboardInterrupt:
        code=130
        observation(rid,'interrupted','Interrupted by user')
        return 130
    finally:
        if server is not None:
            server.shutdown();server.server_close()
        sync_context(cwd, args)
        finish_run(rid,code)
        print(f'\n[Token Observatory] run={rid} | relatório: python "{Path(__file__).resolve()}" report --run {rid}',file=sys.stderr)


def import_codex(args):
    path=Path(args.file).expanduser().resolve()
    label, root = project_identity(args.project_dir, args.project)
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    rid='import-'+hashlib.sha256((digest + ':' + root).encode()).hexdigest()[:32]
    begin_run(project=label,batch=args.batch,ticket=args.ticket,role=args.role,
        skill=args.skill,provider='codex',source='import-jsonl',cwd=root,
        project_root_value=root,run_id=rid)
    thread_id=None; n=0; turn_id=0
    with path.open(encoding='utf-8',errors='replace') as fp:
        for idx,line in enumerate(fp,1):
            try: ev=json.loads(line)
            except json.JSONDecodeError: continue
            kind=ev.get('type')
            if kind=='thread.started':thread_id=ev.get('thread_id')
            if kind=='turn.started':turn_id+=1
            if kind=='turn.completed':
                u=ev.get('usage') or {}; inp=positive_int(u.get('input_tokens'))
                cached=positive_int(u.get('cached_input_tokens'))
                add_usage(rid,source='codex-import',key=f'{rid}:{idx}',provider='codex',
                  session=thread_id,skill=args.skill,role=args.role,
                  input_uncached=(max(0,inp-cached) if inp is not None and cached is not None else None),
                  cache_read=cached,cache_write=None,
                  output_tokens=u.get('output_tokens'),reasoning=u.get('reasoning_output_tokens'))
                n+=1
            if kind=='item.completed':
                item=ev.get('item') or {};itype=item.get('type') or item.get('item_type')
                if itype in ('command_execution','mcp_tool_call','web_search','file_change'):
                    add_tool(rid,f'{rid}:{thread_id}:{turn_id}:{item.get("id",idx)}',itype)
    finish_run(rid,0,'IMPORTED')
    print(f'Importação: {n} turnos encontrados; run={rid}; repetição é idempotente.')


DIMENSIONS={'skill':'COALESCE(u.skill,r.skill,\'(não atribuída)\')',
 'role':'COALESCE(u.role,r.role,\'(não atribuído)\')',
 'ticket':'COALESCE(r.ticket,\'(não atribuído)\')',
 'batch':'COALESCE(r.batch,\'(não atribuído)\')',
 'provider':'r.provider','model':'COALESCE(u.model,\'(não informado)\')',
 'run':'r.id','agent':'COALESCE(u.agent,\'(não identificado)\')',
 'project':'r.project','project-root':"COALESCE(r.project_root,'(desconhecido)')"}


def import_context(args):
    """Import only allowlisted process metadata, never prompts, logs or estimates."""
    source = Path(args.file).expanduser().resolve(strict=True)
    database = sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)
    try:
        root_row = database.execute("SELECT value FROM meta WHERE key='root'").fetchone()
        if not root_row: raise ValueError('Contexto sem identidade de raiz')
        cwd = execution_dir(args.project_dir or root_row[0])
        if os.path.normcase(str(Path(root_row[0]).resolve())) != os.path.normcase(cwd):
            raise ValueError('--project-dir deve coincidir com a raiz do banco Contexto')
        label, root = project_identity(cwd, args.project)
        rows = database.execute('SELECT id,body FROM process_events ORDER BY rowid').fetchall()
    finally:
        database.close()
    count = 0
    # One run per source/session preserves unknown token counts without minting usage.
    for event_id, body in rows:
        item = json.loads(body)
        if not isinstance(item, dict) or item.get('id') != event_id: raise ValueError('Evento Contexto inválido')
        for key in ('id', 'session', 'batch', 'task', 'ticket', 'skill', 'role', 'agent', 'stage', 'provider', 'parent'):
            if item.get(key) is not None and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,199}', str(item[key])):
                raise ValueError('Metadado Contexto inválido: ' + key)
        status = item.get('status')
        if status not in ('STARTED', 'PASS', 'FAIL', 'BLOCKED', 'OBSERVED'): raise ValueError('Status Contexto inválido')
        metrics = {}
        for field in ('findings_new', 'findings_resolved', 'criteria_proven'):
            if item.get(field) is not None:
                value = item[field]
                if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 100000: raise ValueError('Contador inválido')
                metrics[field] = value
        for field in ('base_sha', 'head_sha'):
            if item.get(field) is not None:
                if not re.fullmatch(r'[a-f0-9]{40}(?:[a-f0-9]{24})?', str(item[field])): raise ValueError('SHA inválido')
                metrics[field] = item[field]
        keys = item.get('file_keys', [])
        if not isinstance(keys, list) or len(keys) > 1000 or any(not re.fullmatch(r'[a-f0-9]{64}', str(k)) for k in keys): raise ValueError('file_keys inválido')
        metrics['file_keys'] = keys
        provider = item.get('provider') or 'unknown'
        if provider not in ('claude', 'codex', 'unknown'): raise ValueError('Provedor Contexto inválido')
        identity = json.dumps([os.path.normcase(cwd), item.get('session') or 'unknown', item.get('parent'),
                               item.get('batch') or args.batch, item.get('ticket') or args.ticket,
                               item.get('task'), provider], separators=(',', ':'))
        rid = 'contexto-' + hashlib.sha256(identity.encode()).hexdigest()[:32]
        begin_run(project=label, batch=item.get('batch') or args.batch, ticket=item.get('ticket') or args.ticket,
                  role=None, skill=None, provider=provider, source='contexto-process', cwd=cwd,
                  project_root_value=root, run_id=rid)
        key = hashlib.sha256((os.path.normcase(cwd) + ':' + event_id).encode()).hexdigest()
        with opened() as con:
            before = con.total_changes
            con.execute('''INSERT OR IGNORE INTO process_events
                (source_key,run_id,skill,role,agent,stage,session,parent,status,duration_ms,recorded_at,metrics)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''', (key, rid, item.get('skill'), item.get('role'), item.get('agent'),
                item.get('stage'), item.get('session'), item.get('parent'), status,
                positive_int(item.get('duration_ms')), str(item.get('at') or now())[:40], json.dumps(metrics, sort_keys=True)))
            count += con.total_changes - before
        finish_run(rid, 0, 'IMPORTED_METADATA')
    print(json.dumps({'imported_process_events': count, 'tokens_imported': False, 'note': 'Contadores de tokens permanecem nas fontes nativas; processos não são requests.'}, ensure_ascii=False))


def sync_context(cwd, args):
    candidates = [Path(cwd) / relative / 'context.sqlite' for relative in
                  ('.contexto', 'skills/_shared/.contexto', '.agents/skills/_shared/.contexto',
                   '.claude/skills/_shared/.contexto', '.agent/skills/_shared/.contexto')]
    existing = [p for p in candidates if p.is_file()]
    if not existing: return
    try:
        if len(existing) != 1: raise ValueError('Múltiplos bancos Contexto: importação automática recusada')
        with closing(sqlite3.connect(existing[0].as_uri() + '?mode=ro', uri=True)) as database:
            present = database.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='process_events'").fetchone()
        if present:
            import_context(argparse.Namespace(file=str(existing[0]), project_dir=cwd, project=args.project,
                                             batch=args.batch, ticket=args.ticket))
    except (OSError, ValueError, sqlite3.Error) as error:
        print('[Token Observatory] Metadados Contexto não importados: ' + type(error).__name__ + '. Execute import-context explicitamente para diagnóstico.', file=sys.stderr)


def process_report(args):
    columns = {'skill': 'p.skill', 'role': 'p.role', 'agent': 'p.agent', 'stage': 'p.stage',
               'provider': 'r.provider', 'session': 'p.session', 'project': 'r.project', 'parent': 'p.parent'}
    where, params = [], []
    for field in ('project', 'batch', 'ticket'):
        if getattr(args, field, None): where.append('r.' + field + '=?'); params.append(getattr(args, field))
    if args.project_dir: where.append('r.project_root=?'); params.append(project_root(args.project_dir))
    clause = ' AND '.join(where) or '1=1'
    with opened() as con:
        rows = con.execute(f'''SELECT COALESCE({columns[args.by]}, '(desconhecido)') label,
            COUNT(*) events, SUM(p.status='STARTED') starts, SUM(p.status='PASS') completed,
            SUM(p.status IN ('FAIL','BLOCKED')) failures,
            SUM(CASE WHEN p.status IN ('PASS','FAIL','BLOCKED') THEN p.duration_ms END) duration_ms
            FROM process_events p JOIN runs r ON r.id=p.run_id WHERE {clause}
            GROUP BY label ORDER BY events DESC LIMIT ?''', params + [args.limit]).fetchall()
    result = {'by': args.by, 'tokens': 'unknown; use report for native CLI counters',
              'rows': [dict(zip(('label', 'events', 'starts', 'completed', 'failures', 'duration_ms'), row)) for row in rows]}
    print(json.dumps(result, ensure_ascii=False, indent=2))


def quality_report(args):
    """Correlate only explicit metadata; never apportion a shared token bucket."""
    where, params = [], []
    for field in ('project', 'batch', 'ticket'):
        if getattr(args, field, None): where.append('r.' + field + '=?'); params.append(getattr(args, field))
    if args.project_dir: where.append('r.project_root=?'); params.append(project_root(args.project_dir))
    clause = ' AND '.join(where) or '1=1'
    with opened() as con:
        processes = con.execute(f'''SELECT p.skill,p.session,p.agent,p.metrics,r.project_root,r.provider FROM process_events p
             JOIN runs r ON r.id=p.run_id WHERE {clause} ORDER BY p.recorded_at,p.source_key''', params).fetchall()
        requests = con.execute(f'''SELECT u.id,u.run_id,u.session_id,u.agent,COALESCE(u.skill,r.skill),u.input_uncached,
             u.cache_read,u.cache_write,u.output_tokens,r.project_root,r.provider FROM usage_events u JOIN runs r ON r.id=u.run_id
             WHERE {clause} ORDER BY u.id''', params).fetchall()
    groups, reads = {}, {}
    for skill, session, agent, raw, project, provider in processes:
        key = (project, provider, skill, session, agent)
        group = groups.setdefault(key, {'project': project, 'provider': provider, 'skill': skill, 'session': session, 'agent': agent, 'findings_new': 0, 'findings_resolved': 0, 'criteria_proven': 0, 'sha_pairs': []})
        metrics = json.loads(raw)
        for field in ('findings_new', 'findings_resolved', 'criteria_proven'): group[field] += metrics.get(field, 0)
        if metrics.get('head_sha'):
            pair = {'base': metrics.get('base_sha'), 'head': metrics['head_sha']}
            if pair not in group['sha_pairs']: group['sha_pairs'].append(pair)
        for file_key in metrics.get('file_keys', []): reads[(*key, file_key)] = reads.get((*key, file_key), 0) + 1
    native = {}
    series = []
    for rid, run, session, agent, skill, uncached, read, write, output, project, provider in requests:
        complete = uncached is not None and read is not None and output is not None
        total = uncached + read + (write or 0) + output if complete else None
        series.append({'request': rid, 'run': run, 'project': project, 'provider': provider, 'session': session, 'agent': agent, 'skill': skill,
                       'input_new': uncached, 'cache_read': read, 'cache_write': write, 'output': output, 'total': total})
        if project and provider and session and skill and agent:
            key = (project, provider, skill, session, agent)
            native[key] = None if total is None or (key in native and native[key] is None) else native.get(key, 0) + total
    for key, group in groups.items():
        total = native.get(key)
        group['native_tokens_for_exact_skill_session'] = total
        group['tokens_per_resolved_finding'] = total / group['findings_resolved'] if total is not None and group['findings_resolved'] else None
        group['tokens_per_proven_criterion'] = total / group['criteria_proven'] if total is not None and group['criteria_proven'] else None
    print(json.dumps({'quality': list(groups.values()), 'requests': series,
        'repeated_file_reads': [{'project': k[0], 'provider': k[1], 'skill': k[2], 'session': k[3], 'agent': k[4], 'file_key': k[5], 'reads': n} for k, n in reads.items() if n > 1],
        'limitations': 'Razões descritivas somente com skill e sessão nativas coincidentes; não provam custo causal. Leituras fora do Contexto não são interceptadas. Não somar este relatório ao total de tokens.'}, ensure_ascii=False, indent=2))


def report(args):
    con=conn()
    where=[];params=[]
    for field in ('project','batch','ticket'):
        v=getattr(args,field,None)
        if v:where.append(f'r.{field}=?');params.append(v)
    if getattr(args, 'project_dir', None):
        where.append('r.project_root=?')
        params.append(project_root(args.project_dir))
    if args.run:where.append('r.id=?');params.append(args.run)
    clause=' AND '.join(where) if where else '1=1'
    dim=DIMENSIONS[args.by]
    rows=con.execute(f'''SELECT {dim} AS label,
     COUNT(u.id) requests,
     SUM(u.input_uncached) in_new, SUM(u.cache_read) cache_read, SUM(u.cache_write) cache_write,
     SUM(u.output_tokens) out_tokens,
     SUM(CASE WHEN u.input_uncached IS NOT NULL AND u.cache_read IS NOT NULL
              AND u.output_tokens IS NOT NULL THEN 1 ELSE 0 END) complete_rows
      FROM runs r JOIN usage_events u ON r.id=u.run_id
      WHERE {clause} GROUP BY label ORDER BY
       SUM(COALESCE(u.input_uncached,0)+COALESCE(u.cache_read,0)+COALESCE(u.cache_write,0)+COALESCE(u.output_tokens,0)) DESC
      LIMIT ?''', params+[args.limit]).fetchall()
    runs=con.execute(f'''SELECT COUNT(DISTINCT r.id),
      SUM(CASE WHEN r.status IN ('RUNNING','FAILED') THEN 1 ELSE 0 END)
      FROM runs r WHERE {clause}''',params).fetchone()
    if args.json:
        print(json.dumps({'by':args.by,'runs':runs[0],'unfinished_or_failed':runs[1],
          'rows':[{'label':q[0],'requests':q[1],'input_uncached':q[2],
                   'cache_read':q[3],'cache_write':q[4],'output':q[5],
                   'complete_rows':q[6]} for q in rows]},ensure_ascii=False,indent=2))
    else:
        print('Token Observatory v'+VERSION+' | banco: '+str(db_path()))
        print(f'Execuções: {runs[0]} | Em andamento/falhas: {runs[1]} | Agrupado por: {args.by}')
        print(f'{args.by:24} {"req":>6} {"entrada nova":>13} {"cache leitura":>14} {"cache escrita":>13} {"saída":>12} {"dados ok":>9}')
        for q in rows:
            print(f'{str(q[0])[:24]:24} {q[1]:6} {str(q[2] if q[2] is not None else "?"):>13} '
                  f'{str(q[3] if q[3] is not None else "?"):>14} '
                  f'{str(q[4] if q[4] is not None else "?"):>13} '
                  f'{str(q[5] if q[5] is not None else "?"):>12} {q[6]:>6}/{q[1]}')
        if not rows:
            print('Sem eventos de tokens neste filtro. Verifique se a telemetria está habilitada e recebendo dados.')
        print('Números representam tokens reportados pelos CLIs; não são cota de assinatura nem cobrança.')
    con.close()


def doctor(args):
    print('Token Observatory:',VERSION)
    print('Python:',sys.version.split()[0])
    print('SQLite:',sqlite3.sqlite_version)
    print('Banco:',db_path())
    print('Projeto inferido:', project_identity(getattr(args, 'project_dir', None))[0])
    print('Raiz lógica do projeto:', project_root(getattr(args, 'project_dir', None)))
    print('Diretório de execução:', execution_dir(getattr(args, 'project_dir', None)))
    for cmd in ('claude','codex','git'):
        print(f'{cmd}:',shutil.which(cmd) or '(não encontrado no PATH)')
    with opened() as con:
        print('Execuções registradas:',con.execute('SELECT COUNT(*) FROM runs').fetchone()[0])
        print('Eventos de uso:',con.execute('SELECT COUNT(*) FROM usage_events').fetchone()[0])


def add_context(p):
    p.add_argument('--project',default=None,help='Nome/alias do projeto; padrão: pasta + hash do caminho')
    p.add_argument('--project-dir',default=None,help='Raiz do projeto; padrão: Git root do diretório atual')
    p.add_argument('--batch',default=None,help='ID do lote')
    p.add_argument('--ticket',default=None,help='ID do ticket')
    p.add_argument('--role',default=None,help='Papel do agente')
    p.add_argument('--skill',default=None,help='Skill atribuída')


def main(argv=None):
    parser=argparse.ArgumentParser(description='Token Observatory: telemetria local Claude/Codex CLI, sem API')
    sp=parser.add_subparsers(dest='action',required=True)
    sp.add_parser('init',help='Cria SQLite')
    p=sp.add_parser('doctor',help='Diagnóstico do ambiente')
    p.add_argument('--project-dir')
    p=sp.add_parser('run',help='Executa Claude/Codex CLI com coleta')
    p.add_argument('--provider',choices=['claude','codex'],required=True)
    add_context(p)
    p.add_argument('--quiet',action='store_true',help='Codex: suprimir JSONL bruto no console')
    p.add_argument('command',nargs=argparse.REMAINDER,help='Comando CLI após --')
    p=sp.add_parser('import-codex',help='Importa JSONL de codex exec --json')
    p.add_argument('file');add_context(p)
    p=sp.add_parser('serve',help='Coletor local OTLP/HTTP JSON, para Claude interativo')
    p.add_argument('--port',type=int,default=4318)
    p=sp.add_parser('import-context',help='Importa metadados de todas as skills/processos do Contexto, sem duplicar tokens')
    p.add_argument('file'); add_context(p)
    p=sp.add_parser('process-report',help='Atividade por skill, agente, etapa e sessão; tokens não inferidos')
    add_context(p)
    p.add_argument('--by',choices=['skill','role','agent','stage','provider','session','project','parent'],default='skill')
    p.add_argument('--limit',type=int,default=100)
    p=sp.add_parser('quality-report',help='Achados, critérios, SHAs, leituras repetidas e evolução de requests')
    add_context(p)
    p=sp.add_parser('report',help='Relatórios por skill/ticket/role etc.')
    p.add_argument('--by',choices=list(DIMENSIONS),default='skill')
    p.add_argument('--project-dir',help='Filtra pelo caminho real do projeto/repositório')
    p.add_argument('--project');p.add_argument('--batch');p.add_argument('--ticket');p.add_argument('--run');p.add_argument('--limit',type=int,default=30)
    p.add_argument('--json',action='store_true')
    args=parser.parse_args(argv)
    if args.action=='init':
        with opened():pass
        print('SQLite inicializado:',db_path())
    elif args.action=='doctor':doctor(args)
    elif args.action=='run':return run_cli(args)
    elif args.action=='import-codex':import_codex(args)
    elif args.action=='import-context':import_context(args)
    elif args.action=='process-report':process_report(args)
    elif args.action=='quality-report':quality_report(args)
    elif args.action=='report':report(args)
    elif args.action=='serve':
        server=serve(args.port)
        print(f'Coletor HTTP JSON em http://127.0.0.1:{server.server_address[1]}/v1/logs (Ctrl+C encerra)')
        try:server.serve_forever()
        except KeyboardInterrupt:pass
        finally:server.server_close()
    return 0

if __name__=='__main__':sys.exit(main())
