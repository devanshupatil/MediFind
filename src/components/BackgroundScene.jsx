/**
 * Animated background: dot grid + 5 drifting orbs with unique paths and timings.
 * Fixed-position so it stays put while content scrolls.
 */
export function BackgroundScene() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Dot grid */}
      <div className="absolute inset-0 bg-dots opacity-50" />

      {/* ── Large slow orbs ─────────────────────────────────────────────────── */}
      {/* Top-left blue */}
      <div className="absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full
        bg-blue-400/10 blur-[120px] animate-orb-1" />

      {/* Bottom-right violet */}
      <div className="absolute -bottom-48 -right-40 w-[580px] h-[580px] rounded-full
        bg-violet-400/10 blur-[110px] animate-orb-2" />

      {/* Centre indigo */}
      <div className="absolute top-[35%] left-[38%] w-[480px] h-[480px] rounded-full
        bg-indigo-300/7 blur-[90px] animate-orb-3" />

      {/* ── Small fast accent orbs ──────────────────────────────────────────── */}
      {/* Upper-right cyan */}
      <div className="absolute top-[15%] right-[18%] w-[220px] h-[220px] rounded-full
        bg-cyan-400/9 blur-[55px] animate-orb-4" />

      {/* Lower-left purple */}
      <div className="absolute bottom-[25%] left-[15%] w-[270px] h-[270px] rounded-full
        bg-purple-400/9 blur-[65px] animate-orb-5" />
    </div>
  )
}
