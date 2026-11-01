"use client";

import { useState } from "react";
import { MOCK_AGENT_CONVERSATIONS, type MockChatMessage } from "../../lib/mock-enterprise-data.ts";
import {
  registerIdempotentMutation,
  sanitizeAgentMessageContent,
} from "../../lib/mock-security.ts";

export function AgentChatAndSecurityPanel() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    MOCK_AGENT_CONVERSATIONS[0]?.agentId ?? "agt-fin-01",
  );
  const [draftPrompt, setDraftPrompt] = useState<string>("");
  const [customMessages, setCustomMessages] = useState<readonly MockChatMessage[]>([]);
  const [idempotencyKeys, setIdempotencyKeys] = useState<readonly string[]>([]);
  const [lastIdempotencyNotice, setLastIdempotencyNotice] = useState<string | null>(null);
  const [revealedBlockedUrls, setRevealedBlockedUrls] = useState<readonly string[]>([]);

  const activeConversation =
    MOCK_AGENT_CONVERSATIONS.find((c) => c.agentId === selectedAgentId) ??
    MOCK_AGENT_CONVERSATIONS[0];

  const messages: readonly MockChatMessage[] = activeConversation
    ? [...activeConversation.messages, ...customMessages]
    : customMessages;

  function handleSendPrompt(promptText: string): void {
    const trimmed = promptText.trim();
    if (!trimmed || !activeConversation) {
      return;
    }

    const check = registerIdempotentMutation(
      idempotencyKeys,
      activeConversation.agentId,
      trimmed,
      "send-chat-job",
    );

    if (!check.allowed) {
      setLastIdempotencyNotice(
        `Mutação duplicada bloqueada por Idempotency-Key (${check.idempotencyKey}) — WEB-002.`,
      );
      return;
    }

    setIdempotencyKeys(check.updatedKeys);
    setLastIdempotencyNotice(`Job criado com Idempotency-Key: ${check.idempotencyKey}`);

    const userMsg: MockChatMessage = {
      id: `msg-usr-${String(customMessages.length + 100)}`,
      sender: "user",
      authorLabel: "Você (Sessão Mockada)",
      timestampLabel: "agora",
      rawContent: trimmed,
      toolSteps: [],
      citations: [],
      costTokens: 95,
    };

    const agentReply: MockChatMessage = {
      id: `msg-agt-${String(customMessages.length + 101)}`,
      sender: "agent",
      authorLabel: activeConversation.agentName,
      timestampLabel: "agora (stream simulado)",
      rawContent:
        `Recebi sua solicitação: "${trimmed}".\n` +
        "Consultei os índices autorizados do tenant e gerei o parecer preliminar sem executar mutações externas sem aprovação.",
      toolSteps: [
        {
          stepId: `stp-sim-${String(customMessages.length + 1)}`,
          toolName: "tenant_rag.hybrid_search",
          policyDecision: "ALLOW",
          durationMs: 54,
          summary: "Busca vetorial + textual restrita ao tenant_id ativo",
        },
      ],
      citations: [
        {
          documentId: "doc-rag-01",
          documentTitle: "Política de Alçadas e Pagamentos Industriais v4.2.pdf",
          sectionLabel: "Seção 1.1 — Escopo de operação",
        },
      ],
      costTokens: 610,
    };

    setCustomMessages((prev) => [...prev, userMsg, agentReply]);
    setDraftPrompt("");
  }

  return (
    <section className="panel-card" aria-labelledby="chat-security-heading">
      <div className="panel-header">
        <div>
          <h2 id="chat-security-heading">
            Conversas com Agentes, Execução de Ferramentas &amp; Sanitização (WEB-004 + WEB-008)
          </h2>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.86rem",
              color: "var(--text-secondary)",
            }}
          >
            Histórico com passos do Tool Gateway, citações do RAG, chave de idempotência contra
            duplo clique e neutralização de XSS/imagens remotas.
          </p>
        </div>

        <div className="control-group">
          <label htmlFor="chat-agent-select">Agente em conversa</label>
          <select
            id="chat-agent-select"
            className="control-select"
            value={selectedAgentId}
            onChange={(e) => {
              setSelectedAgentId(e.target.value);
              setCustomMessages([]);
              setLastIdempotencyNotice(null);
            }}
          >
            {MOCK_AGENT_CONVERSATIONS.map((conv) => (
              <option key={conv.agentId} value={conv.agentId}>
                {conv.agentName} — {conv.departmentName} ({conv.modelName})
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul className="item-list" aria-label="Mensagens da conversa com o agente">
        {messages.map((msg) => {
          const sanitized = sanitizeAgentMessageContent(msg.rawContent);

          return (
            <li key={msg.id} className="item-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <strong>{msg.authorLabel}</strong>{" "}
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    ({msg.timestampLabel})
                  </span>
                </div>
                <span className="demo-badge demo-badge--info">{msg.costTokens} tokens</span>
              </div>

              {sanitized.blockedXssCount > 0 ? (
                <div
                  role="alert"
                  className="demo-badge demo-badge--danger"
                  style={{ alignSelf: "flex-start" }}
                >
                  WEB-008: {sanitized.blockedXssCount} payload(s) XSS/script neutralizado(s) antes
                  da renderização
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  marginTop: "0.25rem",
                }}
              >
                {sanitized.safeSegments.map((seg, idx) => {
                  const segKey = `${msg.id}-seg-${String(idx)}`;
                  if (seg.kind === "code") {
                    return (
                      <code key={segKey} className="code-preview">
                        {seg.content}
                      </code>
                    );
                  }
                  if (seg.kind === "blocked_xss") {
                    return (
                      <div key={segKey} className="code-preview">
                        [Trecho bloqueado pelo sanitizador WEB-008: {seg.content}]
                      </div>
                    );
                  }
                  if (seg.kind === "blocked_remote_image") {
                    return (
                      <div
                        key={segKey}
                        className="code-preview"
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span>
                          Imagem remota bloqueada automaticamente (evita exfiltração por query
                          string).
                        </span>
                        <button
                          type="button"
                          className="btn btn--secondary"
                          onClick={() => {
                            setRevealedBlockedUrls((prev) =>
                              prev.includes(seg.content) ? prev : [...prev, seg.content],
                            );
                          }}
                        >
                          Inspecionar URL bloqueada (sem carregar imagem)
                        </button>
                        {revealedBlockedUrls.includes(seg.content) ? (
                          <div style={{ width: "100%", fontSize: "0.75rem" }}>
                            marcador retido: {seg.content}
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  return (
                    <p key={segKey} style={{ margin: 0, fontSize: "0.88rem" }}>
                      {seg.content}
                    </p>
                  );
                })}
              </div>

              {msg.toolSteps.length > 0 ? (
                <div
                  style={{
                    marginTop: "0.5rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid var(--border-subtle)",
                    fontSize: "0.8rem",
                  }}
                >
                  <strong>Ferramentas acionadas via Tool Gateway:</strong>
                  <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.2rem" }}>
                    {msg.toolSteps.map((step) => (
                      <li key={step.stepId}>
                        <code>{step.toolName}</code> — Decisão:{" "}
                        <strong>{step.policyDecision}</strong> ({step.durationMs}
                        ms) · {step.summary}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {msg.citations.length > 0 ? (
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  <strong>Citações autorizadas (RAG):</strong>{" "}
                  {msg.citations.map((cit) => (
                    <span key={cit.documentId} style={{ marginRight: "0.75rem" }}>
                      [{cit.documentTitle} — {cit.sectionLabel}]
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div
        style={{
          marginTop: "1rem",
          paddingTop: "1rem",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "flex-end",
        }}
      >
        <div className="control-group" style={{ flex: "1 1 320px" }}>
          <label htmlFor="agent-chat-input">
            Enviar instrução ao agente (simula criação de job com Idempotency-Key)
          </label>
          <input
            id="agent-chat-input"
            type="text"
            className="control-input"
            placeholder="Ex.: Verificar divergências fiscais do lote de outubro..."
            value={draftPrompt}
            onChange={(e) => {
              setDraftPrompt(e.target.value);
            }}
          />
        </div>

        <button
          type="button"
          className="btn btn--approve"
          onClick={() => {
            handleSendPrompt(draftPrompt);
          }}
        >
          Enviar mensagem ao agente
        </button>

        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            handleSendPrompt("Teste de repetição idempotente para o lote BR-442");
          }}
        >
          Testar proteção de duplo clique (Idempotência WEB-002)
        </button>
      </div>

      {lastIdempotencyNotice ? (
        <p
          role="status"
          style={{
            marginTop: "0.6rem",
            fontSize: "0.82rem",
            color: "var(--status-warn-text)",
          }}
        >
          {lastIdempotencyNotice}
        </p>
      ) : null}
    </section>
  );
}
