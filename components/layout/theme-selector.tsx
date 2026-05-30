"use client";

import { useEffect, useState } from "react";

const THEMES = [
  { id: "obsidian", name: "Obsidian", type: "dark", dot: "#c9a84c", desc: "Navy · gold" },
  { id: "midnight", name: "Midnight", type: "dark", dot: "#a78bfa", desc: "Indigo · lavender" },
  { id: "graphite", name: "Graphite", type: "dark", dot: "#58a6ff", desc: "Carbon · blue" },
  { id: "aurora", name: "Aurora", type: "dark", dot: "#00d2b4", desc: "Teal · cyan" },
  { id: "forest", name: "Forest", type: "dark", dot: "#b48c3c", desc: "Green · amber" },
  { id: "ocean", name: "Ocean", type: "dark", dot: "#00b4dc", desc: "Navy · aqua" },
  { id: "rose", name: "Rose", type: "dark", dot: "#e0788a", desc: "Plum · rose" },
  { id: "slate", name: "Slate", type: "dark", dot: "#64a0c8", desc: "Grey · cyan" },
  { id: "ember", name: "Ember", type: "dark", dot: "#dc8228", desc: "Black · amber" },
  { id: "mocha", name: "Mocha", type: "dark", dot: "#c89850", desc: "Brown · cream" },
  { id: "ivory", name: "Ivory", type: "light", dot: "#b8732a", desc: "Cream · amber" },
  { id: "pearl", name: "Pearl", type: "light", dot: "#6366f1", desc: "White · indigo" },
  { id: "copper", name: "Copper", type: "light", dot: "#b45228", desc: "Cream · copper" },
  { id: "arctic", name: "Arctic", type: "light", dot: "#0078c8", desc: "White · ice blue" },
  { id: "sand", name: "Sand", type: "light", dot: "#b46438", desc: "Beige · terracotta" },
];

const DARK_THEMES = [
  "obsidian",
  "midnight",
  "graphite",
  "aurora",
  "forest",
  "ocean",
  "rose",
  "slate",
  "ember",
  "mocha",
];

export function ThemeSelector() {
  const [current, setCurrent] = useState("obsidian");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("vaulted-theme") || "obsidian";
    setCurrent(saved);
  }, []);

  const apply = (id: string) => {
    setCurrent(id);
    setOpen(false);
    localStorage.setItem("vaulted-theme", id);
    document.documentElement.setAttribute("data-theme", id);
    if (DARK_THEMES.includes(id)) {
      document.documentElement.classList.add("theme-dark");
    } else {
      document.documentElement.classList.remove("theme-dark");
    }
  };

  const activeTheme = THEMES.find((t) => t.id === current) ?? THEMES[0];

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150"
        style={{ color: "var(--text-dim)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: activeTheme.dot,
            flexShrink: 0,
          }}
        />
        <span className="font-sans text-[13px] flex-1 text-left">
          {activeTheme.name}
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: "var(--text-muted)" }}
        >
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div
          className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden max-h-[min(70vh,420px)] overflow-y-auto"
          style={{
            background: "var(--bg-2)",
            border: "1px solid var(--border-gold)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            zIndex: 100,
          }}
        >
          {["dark", "light"].map((type) => {
            const grouped = THEMES.filter((t) => t.type === type);
            return (
              <div key={type}>
                <div
                  className="px-3 pt-3 pb-1 font-mono text-[9px] tracking-[0.15em] uppercase flex items-center justify-between"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span>{type}</span>
                  <span>{grouped.length}</span>
                </div>
                {grouped.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => apply(theme.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 transition-all duration-100"
                    style={{
                      background:
                        current === theme.id
                          ? "rgba(255,255,255,0.06)"
                          : "transparent",
                      color:
                        current === theme.id
                          ? "var(--gold-l)"
                          : "var(--text-dim)",
                    }}
                    onMouseEnter={(e) => {
                      if (current !== theme.id)
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      if (current !== theme.id)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: theme.dot,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div className="font-sans text-[13px]">{theme.name}</div>
                      <div
                        className="font-mono text-[10px]"
                        style={{ color: "var(--text-muted)", marginTop: 1 }}
                      >
                        {theme.desc}
                      </div>
                    </div>
                    {current === theme.id ? (
                      <span
                        className="font-mono text-[10px]"
                        style={{ color: "var(--gold)" }}
                      >
                        ✓
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            );
          })}
          <div style={{ height: "6px" }} />
        </div>
      ) : null}
    </div>
  );
}
