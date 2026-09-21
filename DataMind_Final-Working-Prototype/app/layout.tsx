import type { Metadata } from "next";
import { Source_Serif_4, Source_Sans_3, JetBrains_Mono } from "next/font/google";
import { Grain } from "@/components/Grain";
import { SessionGuard } from "@/components/SessionGuard";
import "./globals.css";

// Runs before hydration so the right theme is painted on the very first
// frame (no light-flash-then-dark, or vice versa). Reads the same
// localStorage key ThemeToggle writes to, falling back to the OS
// preference, then to dark.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('datamind:theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`;

// Reinterprets the reference site's Droid Serif / Source Sans Pro pairing
// with actively-maintained Google Fonts.
const display = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "DataMind — Ask Your Database in Plain English",
  description:
    "Turn natural-language questions into real PostgreSQL queries and explore the answers directly from your database.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-ink-950 text-ink-100 font-sans antialiased" suppressHydrationWarning>
        <Grain />
        <SessionGuard />
        {children}
      </body>
    </html>
  );
}
