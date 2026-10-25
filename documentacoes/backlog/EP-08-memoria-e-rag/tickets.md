# EP-08 — Tickets

Regras globais: [../README.md](../README.md).

<a id="ent-rag-001"></a>
## ENT-RAG-001 — Pipeline de ingestão de documentos

**Sprint** S07 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Feature
**Depende de:** DAT-004, DAT-006, AIG-001, RUN-004 · **Bloqueia:** RAG-002..004

**Especificação técnica**
- Fluxo: upload por URL assinada (DAT-006) → registro `documents(status=uploaded)` → job `document.ingest` → runtime baixa **via Tool Gateway** (URL curta) → valida tipo/tamanho → extrai texto → *chunking* → embeddings (AI Gateway `/v1/embeddings`) → grava `document_chunks` → `status=indexed`; erros → `failed` com `error_code` sem conteúdo.
- **Formatos do MVP**: `txt`, `md`, `csv` e `pdf` com texto (sem OCR). Verificação por *magic bytes*; recusar o restante com mensagem clara.
- **Limites rígidos**: tamanho do arquivo (ex.: 20 MB), páginas, número de chunks, tempo e memória por job; execução em subprocesso do próprio runtime com `rlimit` (CPU/memória) para conter parsers; PDF sem scripts/JS; sem resolução de links externos.
- *Chunking* configurável (tamanho/overlap por tokens), preservando metadados (`document_id`, página, ordinal, hash do chunk); deduplicação por `sha256` de conteúdo.
- Embeddings em lotes com controle de orçamento (AIG-002); dimensão e modelo registrados por documento (`embedding_model`).
- Idempotência: reprocessar o mesmo `document_id` substitui chunks de forma atômica.
- Conteúdo extraído é **não confiável** (marcação de proveniência para TGW-006).
- Progresso emitido como evento (`document.indexing_progress`).

**Critérios de aceite**
- [ ] PDF malformado/bomba de descompressão é rejeitado dentro dos limites sem derrubar o runtime (teste com amostras).
- [ ] Re-ingestão não duplica chunks (idempotência).
- [ ] Custo de embeddings é contabilizado em `token_usage` e respeita orçamento.
- [ ] Documento do tenant A nunca é lido/escrito fora do database de A (verificação por teste de DAT-005).

**Testes.** Unitários (chunking), integração, SEC (arquivos maliciosos), carga leve (RUN-007 mede memória).

---

<a id="ent-rag-002"></a>
## ENT-RAG-002 — Recuperação híbrida (vetorial + texto)

**Sprint** S07 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Feature
**Depende de:** RAG-001, TGW-003 · **Bloqueia:** RAG-003

**Especificação técnica**
- Função `app.search_chunks(query_embedding vector, query_text text, department text[], top_k int)` chamada pelo role `…_tools`: combina similaridade por cosseno (HNSW) e `tsvector` (`ts_rank`), com fusão (RRF) e limites; `top_k` ≤ 20; `department` **derivado da autorização do agente**.
- Índices: HNSW com parâmetros (`m`, `ef_construction`) e `hnsw.ef_search` calibrados por teste de recall/latência no volume alvo; GIN no `tsv`; configuração de idioma (`portuguese`) validada.
- Reranking opcional via modelo (AI Gateway) desativado por padrão (custo).
- **Cache de retrieval** desativado no MVP; se habilitado, chave composta por `tenant`, hash da consulta e versão do índice, com TTL curto, e testado contra vazamento cruzado.
- Resposta traz `document_id`, trecho e pontuação para citação; resultados abaixo do limiar são descartados.
- Autorização por documento: `documents.department_code` e regras do agente filtram **no SQL**, não após a recuperação.

**Critérios de aceite**
- [ ] Recall@10 ≥ meta definida em conjunto de avaliação interno (registrar meta e resultado).
- [ ] p95 da busca dentro do orçamento com 100 mil chunks (valor medido registrado).
- [ ] Agente sem acesso ao departamento X não recebe chunks de X (teste).

---

<a id="ent-rag-003"></a>
## ENT-RAG-003 — Isolamento do RAG e suíte de prompt injection (SEC-05/06/10)

**Sprint** S08 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Segurança/Testes
**Depende de:** RAG-002, TGW-006 · **Bloqueia:** GATE-001

**Especificação técnica**
- Fixture com tenants A e B, cada um com documentos contendo **sentinelas** únicas (incluindo documento de B com instruções maliciosas e documento de A "envenenado" pedindo dados de B).
- SEC-05: modelo falso de A solicita via Tool Gateway documentos de B (IDs, nomes, `tenant_id` forjado, caminhos de storage) → negado.
- SEC-06: consultas semânticas de A projetadas para colidir com embeddings de B → nenhum chunk de B (impossível por database distinto; o teste comprova inclusive com `search_path`/nomes qualificados e funções).
- SEC-10: e-mail/documento com injeção indireta pede segredos de B e chaves de integração → nenhum segredo/dado de B exposto; evento de segurança gerado.
- Variações: Unicode/ofuscação, instruções em outros idiomas, *multi-step* (encadear ferramentas), exfiltração via link/imagem na resposta.
- Executar com modelo falso "obediente" (pior caso) e, em amostra, com modelo real em conta de teste (não bloqueante).

**Critérios de aceite**
- [ ] Zero sentinelas de B nas respostas, logs, traces e `tool_calls` de A.
- [ ] Resultados e versão do corpus anexados ao dossiê.
- [ ] Teste de mutação: remover verificação de política em ambiente de teste faz a suíte falhar.

---

<a id="ent-rag-004"></a>
## ENT-RAG-004 — Ciclo de vida: reindexação, exclusão e retenção

**Sprint** S09 · **Prioridade** Média · **Tam.** S · **Risco** MÉDIO · **Tipo** Feature
**Depende de:** RAG-001 · **Bloqueia:** PRV-010
**Referências:** ADR 10 (retenção), DEC-011.

**Especificação técnica**
- Exclusão de documento: remove objeto no storage, chunks, embeddings e memória derivada em transação lógica compensável; registro de auditoria.
- Reindexação em lote ao trocar modelo de embedding/estratégia de chunking (job de manutenção, sem janela de indisponibilidade: indexar em nova versão e trocar).
- Retenção configurável por tenant; expurgo de documentos expirados.
- Exportação de documentos do tenant (insumo de offboarding PRV-010).
- Métrica de integridade: chunks órfãos, documentos sem arquivo.

**Critérios de aceite**
- [ ] Após exclusão, busca não retorna o conteúdo e o objeto não existe no storage.
- [ ] Reindexação preserva disponibilidade das buscas.
