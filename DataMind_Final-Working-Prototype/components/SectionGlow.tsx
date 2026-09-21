/**
 * Purely decorative background dressing reused behind the Hero, the Ask
 * section, and the closing CTA — a faint data-grid plus a couple of slowly
 * drifting, blurred accent blobs. Absolutely positioned and
 * pointer-events-none, so it never affects layout or interaction.
 */
export function SectionGlow({
  variant = "default",
}: {
  variant?: "default" | "reverse";
}) {
  const primaryPos = variant === "reverse" ? "-top-32 left-[-8%]" : "-top-40 right-[-10%]";
  const secondaryPos = variant === "reverse" ? "bottom-[-15%] right-[-5%]" : "bottom-[-20%] left-[-5%]";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="bg-grid absolute inset-0 opacity-[0.06]" />
      <div className={`bg-blob absolute ${primaryPos} h-[560px] w-[560px] animate-drift-slow`} />
      <div
        className={`bg-blob absolute ${secondaryPos} h-[380px] w-[380px] animate-drift-slow-reverse`}
        style={{ background: "rgb(var(--accent-300) / 0.10)" }}
      />
    </div>
  );
}
