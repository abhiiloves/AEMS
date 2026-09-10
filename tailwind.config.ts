import type { Config } from "tailwindcss";

// Design tokens for AEMS v2. This is an internal, data-dense
// industrial tool (asset registers, permission tables, audit logs) —
// the previous system's navy-header / clean-white-card language is
// kept deliberately (per project decision: keep what was decided to
// stay the same), not reinvented for its own sake. The one deliberate
// departure: a warmer, more confident navy + a single amber accent
// reserved only for "needs attention" states (overdue PM, pending
// scrap review) so it actually means something instead of decorating.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0b1930",
          900: "#0f2440",
          800: "#16335c",
          700: "#1e4272",
        },
        accent: {
          DEFAULT: "#2f6fed",
          hover: "#255cc9",
        },
        attention: {
          DEFAULT: "#c9822a",
          bg: "#fbf1e2",
          border: "#eecfa0",
        },
        danger: {
          DEFAULT: "#c9432f",
          bg: "#fbeae7",
          border: "#f0c3ba",
        },
        success: {
          DEFAULT: "#2f8659",
          bg: "#eaf6ef",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f6f7f9",
          border: "#e4e7ec",
        },
        ink: {
          900: "#151a23",
          600: "#4a5262",
          400: "#8a93a3",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 36, 64, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
