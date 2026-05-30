"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginCard() {
  const params      = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: "var(--bg)" }}>

      {/* Atmospheric glow blobs */}
      <div className="absolute top-[-20%] left-[30%] w-[600px] h-[400px] rounded-full opacity-20"
           style={{ background: "radial-gradient(ellipse, rgba(201,168,76,0.15), transparent 70%)", filter: "blur(60px)" }} />
      <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] rounded-full opacity-10"
           style={{ background: "radial-gradient(ellipse, rgba(0,200,150,0.12), transparent 70%)", filter: "blur(80px)" }} />

      <div className="relative z-10 w-full max-w-sm px-6 animate-slide-up">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)" }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L3 6v8l7 4 7-4V6L10 2z" stroke="#c9a84c" strokeWidth="1.5" fill="none"/>
                <path d="M10 8v6M7 9.5l3-1.5 3 1.5" stroke="#c9a84c" strokeWidth="1.2"/>
              </svg>
            </div>
            <span className="font-display text-2xl tracking-wide"
                  style={{ color: "var(--text)" }}>
              Vault
            </span>
          </div>
          <p className="font-mono text-xs tracking-widest uppercase"
             style={{ color: "var(--text-muted)" }}>
            Portfolio Command Centre
          </p>
        </div>

        {/* Card */}
        <div className="card card-gold p-8">
          <h1 className="font-display text-xl mb-1" style={{ color: "var(--text)" }}>
            Welcome back
          </h1>
          <p className="text-sm mb-8" style={{ color: "var(--text-dim)" }}>
            Sign in to access your portfolio dashboard.
          </p>

          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-3 px-4 font-medium text-sm transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "var(--text)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.09)";
              e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
              <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" fill="#34A853"/>
              <path d="M4.5 10.48A4.84 4.84 0 0 1 4.5 7.5V5.43H1.83a8 8 0 0 0 0 7.14L4.5 10.48z" fill="#FBBC05"/>
              <path d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8 8 0 0 0 1.83 5.43L4.5 7.5c.66-1.97 2.52-3.92 4.48-3.92z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
            Access restricted to authorised accounts only.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center mt-6 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
          PRIVATE · PERSONAL FINANCE
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
