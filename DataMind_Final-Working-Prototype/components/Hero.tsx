import { SectionGlow } from "@/components/SectionGlow";

export function Hero() {
  return (
    <section id="top" className="relative flex min-h-screen items-center overflow-hidden bg-ink-950">
      {/* Background: a restrained, slowly drifting data-grid + glow motif
          standing in for the reference's large photographic imagery */}
      <SectionGlow />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-ink-950/70" />

      <div className="section relative z-10 py-40">
        <p className="eyebrow animate-fade-up mb-6">Question → Query → Data → Insight</p>
        <h1 className="animate-fade-up max-w-4xl font-display text-5xl leading-[1.05] text-ink-100 sm:text-6xl md:text-7xl">
          Ask your database
          <br />
          <span className="italic text-accent-400">in plain English.</span>
        </h1>
        <p
          className="animate-fade-up mt-8 max-w-xl text-lg leading-relaxed text-ink-300"
          style={{ animationDelay: "0.1s" }}
        >
          Turn natural-language questions into real PostgreSQL queries and get
          answers directly from your database — not fabricated ones.
        </p>
        <div className="animate-fade-up mt-10 flex flex-wrap items-center gap-4" style={{ animationDelay: "0.2s" }}>
          <a href="#ask" className="btn-primary">
            Ask Database
          </a>
          <a href="#how-it-works" className="btn-ghost">
            How It Works
          </a>
        </div>
        <p className="animate-fade-up mt-14 text-xs uppercase tracking-widest2 text-ink-500" style={{ animationDelay: "0.3s" }}>
          Your database is the source of truth.
        </p>
      </div>
    </section>
  );
}
