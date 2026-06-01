"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_GEMINI_MODEL,
  TOKEN_TIER_STYLES,
  getModelGuide,
  type GeminiModelOption,
  type TokenUsageTier,
} from "@/lib/agent/models";
import type { AgentStreamEvent } from "@/lib/agent/stream-events";

const AGENT_TIMEOUT_MS = 280_000;

type MessageAttachment = {
  fileName:   string;
  mimeType:   string;
  sheets:     string[];
  rowCount:   number;
  parsedText: string;
  truncated?: boolean;
};

type ToolCall = {
  name:   string;
  result: string;
};

type Message = {
  id:           string;
  role:         "user" | "assistant";
  content:      string;
  toolCalls?:   ToolCall[] | null;
  attachments?: MessageAttachment[] | null;
  streaming?:   boolean;
  status?:      string;
};

function describeAgentError(err: unknown, timedOut: boolean): string {
  if (timedOut) {
    return "Request timed out. If you asked for a big change (e.g. delete all holdings), reopen this chat from history — your message was saved and the action may have completed.";
  }
  if (err instanceof Error) {
    if (err.name === "AbortError") return "Request cancelled.";
    return err.message;
  }
  return "Connection error. Check your network and try again.";
}

function parseSseBlocks(buffer: string): { events: AgentStreamEvent[]; rest: string } {
  const events: AgentStreamEvent[] = [];
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    const line = block.trim();
    if (!line.startsWith("data:")) continue;
    try {
      events.push(JSON.parse(line.slice(5).trim()) as AgentStreamEvent);
    } catch {
      /* skip malformed chunk */
    }
  }
  return { events, rest };
}

type PendingAttachment = MessageAttachment & { id: string };

type ChatSummary = {
  id:           string;
  title:        string;
  model:        string;
  updatedAt:    string;
  messageCount: number;
  preview:      string;
};

const MODEL_STORAGE_KEY = "vault-agent-model";

const WELCOME: Message = {
  id:      "welcome",
  role:    "assistant",
  content: "Hi! I'm Vault. I know your portfolio and can update it too — just tell me what you need.",
};

const STARTER_PROMPTS = [
  "What's my total portfolio value?",
  "When is my next SIP?",
  "Show my open action items",
  "Run this month's snapshot",
];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function modelLabel(models: GeminiModelOption[], id: string): string {
  return models.find((m) => m.id === id)?.label ?? id;
}

function UsageBadge({ tier, label }: { tier: TokenUsageTier; label: string }) {
  const s = TOKEN_TIER_STYLES[tier];
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 font-mono text-[8px] leading-tight"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {label}
    </span>
  );
}

function ModelOptionDetails({ m, compact }: { m: GeminiModelOption; compact?: boolean }) {
  return (
    <>
      <div
        className={`font-mono leading-snug ${compact ? "text-[8px]" : "text-[9px]"}`}
        style={{ color: "var(--text-dim)" }}
      >
        <span style={{ color: "var(--text-muted)" }}>Best for: </span>
        {m.bestFor}
      </div>
      <div className={`${compact ? "mt-1" : "mt-1.5"}`}>
        <UsageBadge tier={m.tokenUsage.tier} label={m.tokenUsage.label} />
      </div>
    </>
  );
}

function ToolCallsPanel({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="mt-1.5 rounded-lg"
      style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
        aria-expanded={open}
      >
        <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--gold)" }}>
          Actions taken ({toolCalls.length})
        </span>
        <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="border-t px-2.5 pb-2 pt-1" style={{ borderColor: "var(--border)" }}>
          {toolCalls.map((tc, i) => (
            <div
              key={`${tc.name}-${i}`}
              className="mt-1 font-mono text-[9px]"
              style={{ color: "var(--text-muted)" }}
            >
              <span style={{ color: "var(--text-dim)" }}>{tc.name}</span>
              {" → "}
              {tc.result.slice(0, 100)}
              {tc.result.length > 100 ? "…" : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentPanel() {
  const router = useRouter();
  const [open, setOpen]               = useState(false);
  const [view, setView]               = useState<"chat" | "history">("chat");
  const [messages, setMessages]       = useState<Message[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats]             = useState<ChatSummary[]>([]);
  const [models, setModels]           = useState<GeminiModelOption[]>([]);
  const [model, setModel]             = useState(DEFAULT_GEMINI_MODEL);
  const [modelOpen, setModelOpen]     = useState(false);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading]       = useState(false);
  const messagesEndRef                  = useRef<HTMLDivElement>(null);
  const textareaRef                     = useRef<HTMLTextAreaElement>(null);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/models");
      if (res.ok) {
        const data = await res.json();
        setModels(data.models ?? []);
      }
    } catch {
      /* keep fallback label from model id */
    }
  }, []);

  const loadChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const res = await fetch("/api/agent/chats");
      if (res.ok) {
        setChats(await res.json());
      }
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
    setMessages([WELCOME]);
    setView("chat");
    setInput("");
    setPendingFiles([]);
  }, []);

  const openChat = useCallback(async (chatId: string) => {
    setLoading(true);
    setView("chat");
    try {
      const res = await fetch(`/api/agent/chats/${chatId}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveChatId(data.id);
      setModel(data.model ?? DEFAULT_GEMINI_MODEL);
      setMessages(
        data.messages.length > 0
          ? data.messages.map((m: Message) => ({
              id:          m.id,
              role:        m.role,
              content:     m.content,
              toolCalls:   m.toolCalls as ToolCall[] | null,
              attachments: m.attachments as MessageAttachment[] | null,
            }))
          : [WELCOME],
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteChat = useCallback(async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this chat?")) return;
    await fetch(`/api/agent/chats/${chatId}`, { method: "DELETE" });
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (activeChatId === chatId) startNewChat();
  }, [activeChatId, startNewChat]);

  const selectedModelMeta = useMemo(
    () => models.find((m) => m.id === model) ?? getModelGuide(model),
    [models, model],
  );

  const modelOptions = models.length > 0 ? models : [getModelGuide(model)];

  useEffect(() => {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    if (saved) setModel(saved);
  }, []);

  useEffect(() => {
    if (open) {
      loadModels();
      loadChats();
      setTimeout(() => textareaRef.current?.focus(), 100);
      if (messages.length === 0) {
        setMessages([WELCOME]);
      }
    }
  }, [open, loadModels, loadChats, messages.length]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const selectModel = (id: string) => {
    setModel(id);
    localStorage.setItem(MODEL_STORAGE_KEY, id);
    setModelOpen(false);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/agent/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Upload failed");
        return;
      }
      setPendingFiles((prev) => [
        ...prev,
        {
          id:         `${Date.now()}-${file.name}`,
          fileName:   data.fileName,
          mimeType:   data.mimeType,
          sheets:     data.sheets,
          rowCount:   data.rowCount,
          parsedText: data.parsedText,
          truncated:  data.truncated,
        },
      ]);
    } catch {
      alert("Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && pendingFiles.length === 0) || loading) return;

    const attachments = pendingFiles.map(({ id: _id, ...rest }) => rest);
    const displayText =
      trimmed || `📎 ${pendingFiles.map((f) => f.fileName).join(", ")}`;

    const userMsg: Message = {
      id:          Date.now().toString(),
      role:        "user",
      content:     displayText,
      attachments: attachments.length ? attachments : undefined,
    };
    const streamId = `${Date.now()}-stream`;
    const streamMsg: Message = {
      id:        streamId,
      role:      "assistant",
      content:   "",
      streaming: true,
      status:    "Connecting…",
      toolCalls: [],
    };

    setMessages((prev) => [...prev, userMsg, streamMsg]);
    setInput("");
    setPendingFiles([]);
    setLoading(true);
    requestAnimationFrame(adjustTextareaHeight);

    const controller = new AbortController();
    let timedOut = false;
    let timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, AGENT_TIMEOUT_MS);

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, AGENT_TIMEOUT_MS);
    };

    const patchStream = (patch: Partial<Message>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === streamId ? { ...m, ...patch } : m)),
      );
    };

    let gotDone = false;

    try {
      const res = await fetch("/api/agent", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          message:     trimmed,
          chatId:      activeChatId,
          model,
          attachments: attachments.length ? attachments : undefined,
        }),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("text/event-stream")) {
        const data = contentType.includes("application/json")
          ? await res.json()
          : { error: `Request failed (${res.status})` };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      if (!res.body) throw new Error("No response stream from agent");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resetTimeout();
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseBlocks(buffer);
        buffer = rest;

        for (const event of events) {
          resetTimeout();
          switch (event.type) {
            case "status":
              patchStream({ status: event.message });
              break;
            case "text_delta":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamId
                    ? { ...m, content: m.content + event.text }
                    : m,
                ),
              );
              break;
            case "tool_end":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamId
                    ? {
                        ...m,
                        toolCalls: [
                          ...(m.toolCalls ?? []),
                          { name: event.name, result: event.result },
                        ],
                      }
                    : m,
                ),
              );
              break;
            case "done":
              gotDone = true;
              patchStream({
                content:   event.reply,
                toolCalls: event.toolCalls.length ? event.toolCalls : undefined,
                streaming: false,
                status:    undefined,
              });
              if (event.chatId) setActiveChatId((prev) => prev ?? event.chatId);
              if (event.refreshed) router.refresh();
              loadChats();
              break;
            case "error":
              gotDone = true;
              patchStream({
                content:   event.message,
                streaming: false,
                status:    undefined,
              });
              break;
            default:
              break;
          }
        }
      }

      if (!gotDone) {
        patchStream({
          content:   "Response ended unexpectedly. Reopen this chat from history to see if Vault replied.",
          streaming: false,
          status:    undefined,
        });
      }
    } catch (err) {
      patchStream({
        content:   describeAgentError(err, timedOut),
        streaming: false,
        status:    undefined,
      });
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const showStarters =
    view === "chat" &&
    !loading &&
    messages.length === 1 &&
    messages[0]?.id === "welcome" &&
    !activeChatId;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200"
        style={{
          background: "var(--gold)",
          boxShadow:  "0 4px 24px rgba(201,168,76,0.4)",
          transform:  open ? "rotate(45deg)" : "rotate(0deg)",
        }}
        title="Open Vault AI"
        aria-label={open ? "Close Vault AI" : "Open Vault AI"}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          {open ? (
            <path d="M4 4L16 16M16 4L4 16" stroke="#111" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <>
              <path d="M10 2L3 6v8l7 4 7-4V6L10 2z" stroke="#111" strokeWidth="1.5" fill="none" />
              <path d="M10 8v5M7 9.5l3-1.5 3 1.5" stroke="#111" strokeWidth="1.2" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden rounded-2xl"
          style={{
            width:      400,
            height:     560,
            maxWidth:   "calc(100vw - 48px)",
            background: "var(--bg-1)",
            border:     "1px solid var(--border-gold)",
            boxShadow:  "0 24px 64px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header */}
          <div
            className="flex flex-shrink-0 flex-col gap-2 px-3 py-2.5"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}
          >
            <div className="flex items-center gap-2">
              {view === "history" ? (
                <button
                  type="button"
                  onClick={() => setView("chat")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}
                  aria-label="Back to chat"
                >
                  ←
                </button>
              ) : (
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="M10 2L3 6v8l7 4 7-4V6L10 2z" stroke="var(--gold)" strokeWidth="1.5" fill="none" />
                  </svg>
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="truncate font-sans text-sm font-medium" style={{ color: "var(--text)" }}>
                  {view === "history" ? "Chat history" : "Vault"}
                </div>
                <div className="font-mono text-[9px] tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {view === "history" ? `${chats.length} conversations` : "AI PORTFOLIO ASSISTANT"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => { loadChats(); setView("history"); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-xs"
                style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}
                title="History"
                aria-label="Chat history"
              >
                ☰
              </button>
              <button
                type="button"
                onClick={startNewChat}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-sm"
                style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}
                title="New chat"
                aria-label="New chat"
              >
                +
              </button>
            </div>

            {view === "chat" && (
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setModelOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left"
                  style={{
                    background: "var(--bg-3)",
                    border:     "1px solid var(--border)",
                    color:      "var(--text-dim)",
                  }}
                >
                  <span className="font-mono text-[10px]">
                    Model: <span style={{ color: "var(--gold-l)" }}>{modelLabel(models, model)}</span>
                  </span>
                  <span className="text-[10px]">{modelOpen ? "▲" : "▼"}</span>
                </button>

                {!modelOpen && (
                  <div
                    className="mt-1.5 rounded-lg px-2 py-1.5"
                    style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}
                  >
                    <ModelOptionDetails m={selectedModelMeta} compact />
                  </div>
                )}

                {modelOpen && (
                  <div
                    className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg py-1"
                    style={{
                      background: "var(--bg-2)",
                      border:     "1px solid var(--border-gold)",
                      boxShadow:  "0 8px 24px rgba(0,0,0,0.35)",
                    }}
                  >
                    {modelOptions.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectModel(m.id)}
                        className="w-full border-b px-2.5 py-2.5 text-left transition-colors last:border-b-0"
                        style={{
                          background:  m.id === model ? "rgba(201,168,76,0.1)" : "transparent",
                          borderColor: "var(--border)",
                        }}
                      >
                        <div className="font-sans text-xs" style={{ color: "var(--text)" }}>
                          {m.label}
                          {m.id === DEFAULT_GEMINI_MODEL && (
                            <span className="ml-1 font-mono text-[9px]" style={{ color: "var(--gold)" }}>
                              default
                            </span>
                          )}
                        </div>
                        {m.description && (
                          <div className="mt-0.5 font-mono text-[9px] leading-snug" style={{ color: "var(--text-muted)" }}>
                            {m.description}
                          </div>
                        )}
                        <div className="mt-1.5">
                          <ModelOptionDetails m={m} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          {view === "history" ? (
            <div className="flex-1 overflow-y-auto p-3">
              {loadingChats && (
                <div className="py-8 text-center font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                  Loading...
                </div>
              )}
              {!loadingChats && chats.length === 0 && (
                <div className="py-8 text-center font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                  No chats yet. Start a conversation!
                </div>
              )}
              <div className="space-y-1.5">
                {chats.map((c) => (
                  <div
                    key={c.id}
                    className="group flex items-start gap-1 rounded-xl transition-all"
                    style={{
                      background: activeChatId === c.id ? "rgba(201,168,76,0.1)" : "var(--bg-2)",
                      border:     `1px solid ${activeChatId === c.id ? "rgba(201,168,76,0.3)" : "var(--border)"}`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openChat(c.id)}
                      className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left"
                    >
                      <div className="truncate font-sans text-xs font-medium" style={{ color: "var(--text)" }}>
                        {c.title}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
                        {c.preview || `${c.messageCount} messages`}
                      </div>
                      <div className="mt-1 font-mono text-[9px]" style={{ color: "var(--text-dim)" }}>
                        {modelLabel(models, c.model)} · {formatWhen(c.updatedAt)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => deleteChat(c.id, e)}
                      className="mr-2 mt-2 flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                      aria-label="Delete chat"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[88%]">
                    <div
                      className="rounded-xl px-3.5 py-2.5 text-sm"
                      style={{
                        background: msg.role === "user" ? "rgba(201,168,76,0.15)" : "var(--bg-3)",
                        border:     msg.role === "user"
                          ? "1px solid rgba(201,168,76,0.25)"
                          : "1px solid var(--border)",
                        color:      "var(--text)",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.55,
                      }}
                    >
                      {msg.streaming && !msg.content ? (
                        <span className="flex items-center gap-2">
                          <span className="spinner" style={{ width: 12, height: 12 }} />
                          <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                            {msg.status ?? "Working…"}
                          </span>
                        </span>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.streaming && msg.content && msg.status && (
                      <div
                        className="mt-1 flex items-center gap-1.5 font-mono text-[9px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span className="spinner" style={{ width: 8, height: 8 }} />
                        {msg.status}
                      </div>
                    )}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {msg.attachments.map((a) => (
                          <span
                            key={a.fileName}
                            className="rounded px-1.5 py-0.5 font-mono text-[8px]"
                            style={{
                              background: "var(--bg-2)",
                              border:     "1px solid var(--border)",
                              color:      "var(--text-muted)",
                            }}
                          >
                            📎 {a.fileName} ({a.rowCount} rows)
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <ToolCallsPanel toolCalls={msg.toolCalls} />
                    )}
                  </div>
                </div>
              ))}

              {showStarters && (
                <div className="mt-2 space-y-1.5">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => send(prompt)}
                      className="w-full rounded-xl px-3.5 py-2 text-left text-xs transition-all"
                      style={{
                        background: "var(--bg-2)",
                        border:     "1px solid var(--border)",
                        color:      "var(--text-dim)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)";
                        e.currentTarget.style.color = "var(--gold-l)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        e.currentTarget.style.color = "var(--text-dim)";
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input */}
          {view === "chat" && (
            <div
              className="flex-shrink-0 p-3"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                }}
              />

              {pendingFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {pendingFiles.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[9px]"
                      style={{
                        background: "rgba(201,168,76,0.1)",
                        border:     "1px solid rgba(201,168,76,0.25)",
                        color:      "var(--text-dim)",
                      }}
                    >
                      📎 {f.fileName}
                      <button
                        type="button"
                        onClick={() => removePendingFile(f.id)}
                        className="opacity-70 hover:opacity-100"
                        aria-label={`Remove ${f.fileName}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div
                className="flex items-end gap-2 rounded-xl px-3 py-2"
                style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || uploading}
                  className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg font-mono text-xs"
                  style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}
                  title="Attach Excel or CSV"
                  aria-label="Attach spreadsheet"
                >
                  {uploading ? "…" : "📎"}
                </button>
                <textarea
                  ref={textareaRef}
                  value={input}
                  rows={2}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Tab") {
                      e.preventDefault();
                      const el = e.currentTarget;
                      const start = el.selectionStart ?? 0;
                      const end = el.selectionEnd ?? 0;
                      const next = `${input.slice(0, start)}\t${input.slice(end)}`;
                      setInput(next);
                      requestAnimationFrame(() => {
                        el.selectionStart = el.selectionEnd = start + 1;
                      });
                      return;
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                      return;
                    }
                  }}
                  placeholder={"Ask about your portfolio…\nEnter to send · Shift+Enter for new line · Tab to indent"}
                  disabled={loading}
                  className="max-h-32 min-h-[2.75rem] flex-1 resize-none bg-transparent font-sans text-sm leading-relaxed outline-none"
                  style={{
                    color:       "var(--text)",
                    whiteSpace:  "pre-wrap",
                    tabSize:     4,
                  }}
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={loading || (!input.trim() && pendingFiles.length === 0)}
                  className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all"
                  style={{
                    background:
                      input.trim() || pendingFiles.length > 0 ? "var(--gold)" : "var(--bg-3)",
                    opacity: loading ? 0.5 : 1,
                  }}
                  aria-label="Send message"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path
                      d="M2 6h8M7 3l3 3-3 3"
                      stroke={
                        input.trim() || pendingFiles.length > 0
                          ? "#111"
                          : "var(--text-muted)"
                      }
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="mt-2 flex justify-center">
                <span className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
                  Enter to send · Shift+Enter new line · .xlsx/.csv up to 5 MB
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
