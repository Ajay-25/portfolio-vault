import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:      "#020812",
        "bg-1":  "#060e1f",
        "bg-2":  "#0a1628",
        "bg-3":  "#0f1d34",
        gold:    "#c9a84c",
        "gold-l":"#e4c97a",
        teal:    "#00c896",
        crimson: "#f53859",
        blue:    "#4896f5",
        purple:  "#9b7ff5",
        "text-dim": "#7a8aaa",
        "text-muted": "#3d4f6e",
      },
      fontFamily: {
        display: ["Cormorant Garamond", "Georgia", "serif"],
        mono:    ["IBM Plex Mono", "Fira Mono", "monospace"],
        sans:    ["Outfit", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #c9a84c, #e4c97a)",
        "card-glow": "radial-gradient(ellipse at top, rgba(201,168,76,0.06), transparent 70%)",
      },
      boxShadow: {
        "gold-sm": "0 0 0 1px rgba(201,168,76,0.3)",
        "glow":    "0 0 40px rgba(201,168,76,0.08), 0 8px 32px rgba(0,0,0,0.4)",
        "card":    "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 8px 32px rgba(0,0,0,0.3)",
      },
      animation: {
        "count-up": "count-up 1.2s ease-out forwards",
        "fade-in":  "fade-in 0.4s ease-out forwards",
        "slide-up": "slide-up 0.5s ease-out forwards",
      },
      keyframes: {
        "fade-in":  { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
