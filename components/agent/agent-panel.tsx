"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id:      string;
  role:    "user" | "assistant";
  content: string;
};

const STARTER_PROMPTS = [
  "What's my total portfolio value?",
  "When is my next SIP?",
  "Show my open action items",
  "Run this month's snapshot",
];

export function AgentPanel() {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const messagesEndRef          = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      if (messages.length === 0) {
        setMessages([{
          id:      "welcome",
          role:    "assistant",
          content: "Hi! I'm Vault. I know your portfolio and can update it too — just tell me what you need.",
        }]);
      }
    }
  }, [open, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const apiMessages = [...messages, userMsg]
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res  = await fetch("/api/agent", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [...prev, {
          id:      Date.now().toString() + "-err",
          role:    "assistant",
          content: data.error ?? "Sorry, something went wrong.",
        }]);
      } else {
        setMessages((prev) => [...prev, {
          id:      Date.now().toString() + "-reply",
          role:    "assistant",
          content: data.reply ?? "Sorry, something went wrong.",
        }]);
        if (data.refreshed) router.refresh();
      }
    } catch {
      setMessages((prev) => [...prev, {
        id:      Date.now().toString() + "-err",
        role:    "assistant",
        content: "Connection error. Please try again.",
      }]);
    }
    setLoading(false);
  };

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
            width:      380,
            height:     520,
            maxWidth:   "calc(100vw - 48px)",
            background: "var(--bg-1)",
            border:     "1px solid var(--border-gold)",
            boxShadow:  "0 24px 64px rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="flex flex-shrink-0 items-center gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}
          >
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)" }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M10 2L3 6v8l7 4 7-4V6L10 2z" stroke="var(--gold)" strokeWidth="1.5" fill="none" />
                <path d="M10 8v5M7 9.5l3-1.5 3 1.5" stroke="var(--gold)" strokeWidth="1.2" />
              </svg>
            </div>
            <div>
              <div className="font-sans text-sm font-medium" style={{ color: "var(--text)" }}>Vault</div>
              <div className="font-mono text-[9px] tracking-wider" style={{ color: "var(--text-muted)" }}>
                AI PORTFOLIO ASSISTANT
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="live-dot" />
              <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>LIVE</span>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm"
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
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-3"
                  style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}
                >
                  <span className="spinner" style={{ width: 12, height: 12 }} />
                  <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                    Thinking...
                  </span>
                </div>
              </div>
            )}

            {messages.length === 1 && !loading && (
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

          <div
            className="flex-shrink-0 p-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Update units, ask about portfolio..."
                disabled={loading}
                className="flex-1 bg-transparent font-sans text-sm outline-none"
                style={{ color: "var(--text)" }}
              />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all"
                style={{
                  background: input.trim() ? "var(--gold)" : "var(--bg-3)",
                  opacity:    loading ? 0.5 : 1,
                }}
                aria-label="Send message"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path
                    d="M2 6h8M7 3l3 3-3 3"
                    stroke={input.trim() ? "#111" : "var(--text-muted)"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex justify-center">
              <span className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
                Powered by Gemini · Actions are real and immediate
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
