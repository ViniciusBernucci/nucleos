# EP-08 — Memória e RAG por tenant

> Prefixo: `ENT-RAG` · Sprints: S07–S09 · Tickets: 4 · Detalhamento: [tickets.md](tickets.md)

## Objetivo

Ingestão, indexação e recuperação de documentos do tenant com `pgvector` **dentro do database do próprio tenant** (ADR-008, seção 6.1 item 8). Não existe índice vetorial global multiempresa nem cache de retrieval sem chave de isolamento conferida. Todo acesso passa pelo Tool Gateway.

## Tickets

| ID | Título | Sprint | Tam. | Risco | Depende de |
| --- | --- | --- | --- | --- | --- |
| [ENT-RAG-001](tickets.md#ent-rag-001) | Pipeline de ingestão de documentos | S07 | L | ALTO | DAT-004, DAT-006, AIG-001, RUN-004 |
| [ENT-RAG-002](tickets.md#ent-rag-002) | Recuperação híbrida (vetorial + texto) | S07 | M | ALTO | RAG-001, TGW-003 |
| [ENT-RAG-003](tickets.md#ent-rag-003) | Isolamento do RAG e suíte de prompt injection (SEC-05/06/10) | S08 | M | CRÍTICO | RAG-002, TGW-006 |
| [ENT-RAG-004](tickets.md#ent-rag-004) | Ciclo de vida: reindexação, exclusão e retenção | S09 | S | MÉDIO | RAG-001 |

## Critério de saída

SEC-06 e SEC-10 verdes; busca p95 dentro do orçamento medido; exclusão de documento remove arquivo, chunks, embeddings e memória derivada.

## Riscos

- Parsing de arquivos não confiáveis (PDF/Office) é vetor de ataque e consumo de memória: formatos limitados, limites rígidos e execução com recursos restritos.
- OCR, navegador e embeddings locais ficam **fora do MVP** (exigem sandbox/mais RAM).
- Troca de modelo de embedding implica reindexação completa (dimensão do vetor).
