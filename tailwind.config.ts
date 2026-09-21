import type { Config } from "tailwindcss";

// Reads each color from a CSS custom property (defined per-theme in
// globals.css) so every existing `bg-ink-950` / `text-accent-400` class in
// the app automatically repaints for light/dark — no component changes
// needed. Falls back gracefully if Tailwind's opacity modifier is used
// (e.g. `bg-ink-950/60`).
//
// This is Tailwind's own documented pattern for CSS-variable-backed colors
// with opacity support. The `Config["theme"]` type just models colors as
// strings/nested-string-maps and doesn't account for Tailwind's runtime
// support for a `({ opacityValue }) => string` color function, so the
// object is cast at the boundary — the shape Tailwind receives at runtime
// is unchanged and behaves exactly as documented.
type ThemeColorFn = (helpers: { opacityValue?: string }) => string;

function themedColor(variable: string): ThemeColorFn {
  return ({ opacityValue }) =>
    opacityValue === undefined ? `rgb(var(${variable}))` : `rgb(var(${variable}) / ${opacityValue})`;
}

const themedColors = {
  ink: {
    50: themedColor("--ink-50"),
    100: themedColor("--ink-100"),
    200: themedColor("--ink-200"),
    300: themedColor("--ink-300"),
    400: themedColor("--ink-400"),
    500: themedColor("--ink-500"),
    600: themedColor("--ink-600"),
    700: themedColor("--ink-700"),
    800: themedColor("--ink-800"),
    900: themedColor("--ink-900"),
    950: themedColor("--ink-950"),
  },
  accent: {
    300: themedColor("--accent-300"),
    400: themedColor("--accent-400"),
    500: themedColor("--accent-500"),
    600: themedColor("--accent-600"),
    // Fixed, theme-independent near-black — used only for text sitting
    // directly on top of an accent-colored surface (e.g. buttons), so
    // that surface keeps the same crisp contrast in both themes.
    contrast: themedColor("--accent-contrast"),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: themedColors,
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      letterSpacing: {
        widest2: "0.2em",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        drift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(3%, 4%) scale(1.06)" },
          "66%": { transform: "translate(-2%, 2%) scale(0.97)" },
        },
        driftReverse: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(-4%, -2%) scale(0.96)" },
          "66%": { transform: "translate(2%, -3%) scale(1.05)" },
        },
        spinSlow: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        grain: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-1%, -2%)" },
          "20%": { transform: "translate(-3%, 1%)" },
          "30%": { transform: "translate(2%, -3%)" },
          "40%": { transform: "translate(-2%, 3%)" },
          "50%": { transform: "translate(-3%, 1%)" },
          "60%": { transform: "translate(2%, 2%)" },
          "70%": { transform: "translate(3%, -1%)" },
          "80%": { transform: "translate(-1%, 2%)" },
          "90%": { transform: "translate(1%, -2%)" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fadeIn 0.5s ease-out both",
        "drift-slow": "drift 22s ease-in-out infinite",
        "drift-slow-reverse": "driftReverse 26s ease-in-out infinite",
        "spin-slow": "spinSlow 14s linear infinite",
        grain: "grain 8s steps(8) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
