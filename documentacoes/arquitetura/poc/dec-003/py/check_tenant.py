"""Acesso do runtime Python ao banco do tenant: psycopg 3 async, SQL explicito, conexao por uso."""
import asyncio
import json
import os
import pathlib

import psycopg
from psycopg import sql

SNAPSHOT = json.loads((pathlib.Path(__file__).parent.parent / "evidencia" / "schema-snapshot.json").read_text())


async def main() -> None:
    assert os.environ["PGHOST"] == "127.0.0.1"
    # nomes de banco vem de allowlist interna; identificadores nunca por f-string
    for dbname in ("poc_tenant_02", "poc_tenant_07"):
        async with await psycopg.AsyncConnection.connect(dbname=dbname) as conn:
            cur = await conn.execute("SELECT version FROM schema_migrations ORDER BY version")
            versions = [r[0] for r in await cur.fetchall()]
            assert versions == ["0001", "0002", "0003"], versions
            cur = await conn.execute(
                "SELECT table_name, column_name, data_type, udt_name, is_nullable FROM information_schema.columns "
                "WHERE table_schema='public' ORDER BY table_name, ordinal_position"
            )
            cols = [dict(zip(("table_name", "column_name", "data_type", "udt_name", "is_nullable"), r)) for r in await cur.fetchall()]
            assert cols == SNAPSHOT, "esquema Python diverge do snapshot gerado a partir do SQL"
            await conn.execute(
                "INSERT INTO documento (id, titulo, conteudo, embedding) VALUES (gen_random_uuid(), %s, %s, %s::vector)",
                ("py", "texto de teste do runtime", "[0,0,1]"),
            )
            cur = await conn.execute(
                "SELECT titulo FROM documento ORDER BY embedding <=> %s::vector LIMIT 1", ("[0,0,1]",)
            )
            assert (await cur.fetchone())[0] == "py"
            cur = await conn.execute(
                sql.SQL("SELECT count(*) FROM {t} WHERE tsv @@ websearch_to_tsquery('portuguese', %s)").format(t=sql.Identifier("documento")),
                ("teste",),
            )
            assert (await cur.fetchone())[0] == 1
            print(f"{dbname}: versoes={versions} esquema==snapshot vetor=ok tsvector=ok identificador via sql.Identifier")


asyncio.run(main())
