// A purely decorative, fixed full-viewport texture layer. It sits above
// every section (including their opaque backgrounds) and blends with
// mix-blend-mode, so it adds a bit of tactile "film grain" without needing
// any section to be transparent. No state, no logic — safe to mount once.
export function Grain() {
  return <div aria-hidden className="grain-overlay animate-grain" />;
}
