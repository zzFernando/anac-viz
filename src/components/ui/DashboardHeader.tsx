"use client";

interface Props {
  downloading: boolean;
  onExportAll: () => void;
}

export default function DashboardHeader({ downloading, onExportAll }: Props) {
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
          <button
            onClick={onExportAll}
            disabled={downloading}
            title="Baixar gráficos como PNG"
            className="flex items-center gap-1.5 text-xs font-semibold text-white/80
                       bg-white/10 hover:bg-white/20 border border-white/20
                       rounded-full px-3 py-1.5 transition-all disabled:opacity-50
                       disabled:cursor-wait"
          >
            {downloading ? (
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : (
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a.75.75 0 0 1 .75.75v6.69l1.97-1.97a.75.75 0 1 1 1.06 1.06L8 11.31l-3.78-3.78a.75.75 0 0 1 1.06-1.06L7.25 8.44V1.75A.75.75 0 0 1 8 1Zm-5.25 9.5a.75.75 0 0 1 .75.75v1.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-1.5a.75.75 0 0 1 1.5 0v1.5A2 2 0 0 1 12 15H4a2 2 0 0 1-2-2v-1.5a.75.75 0 0 1 .75-.75Z"/>
              </svg>
            )}
            {downloading ? "Baixando…" : "Baixar gráficos"}
          </button>
          <span className="text-[0.7rem] font-semibold text-white/90 bg-white/10 border border-white/20 rounded-full px-3 py-1 tracking-widest">
            ANAC
          </span>
          <span className="text-blue-200/50 text-xs">PPGC · UFRGS</span>
        </div>
      </div>
    </div>
  );
}
