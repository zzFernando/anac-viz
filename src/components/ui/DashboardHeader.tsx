"use client";

export default function DashboardHeader() {
  return (
    <div
      className="rounded-card px-5 py-3.5 shadow-lift"
      style={{ background: "linear-gradient(125deg, #001F50 0%, #003F7F 55%, #0066CC 100%)" }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-white font-bold text-lg tracking-tight">
            <span className="text-gold">✈ </span>
            Panorama da Aviação Doméstica Brasileira
          </div>
          <div className="text-blue-200/60 text-xs mt-0.5">
            Dados públicos da ANAC · voos domésticos regulares · 2000–2026
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[0.7rem] font-semibold text-white/90 bg-white/10 border border-white/20 rounded-full px-3 py-1 tracking-widest">
            ANAC
          </span>
          <span className="text-blue-200/50 text-xs">PPGC · UFRGS</span>
        </div>
      </div>
    </div>
  );
}
