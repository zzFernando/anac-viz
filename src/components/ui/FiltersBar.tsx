"use client";

import type { FiltersData } from "@/lib/types";

interface Props {
  filters: FiltersData | undefined;
  anoIni: number;
  anoFim: number;
  aeroporto: string;
  setAnoIni: (v: number) => void;
  setAnoFim: (v: number) => void;
  setAeroporto: (v: string) => void;
  nomeAeroporto?: string;
}

export default function FiltersBar({
  filters, anoIni, anoFim, aeroporto,
  setAnoIni, setAnoFim, setAeroporto, nomeAeroporto,
}: Props) {
  const anoMin = filters?.ano_min ?? 2000;
  const anoMax = filters?.ano_max ?? 2026;
  const anos   = Array.from({ length: anoMax - anoMin + 1 }, (_, i) => anoMin + i);

  return (
    <div className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-gray-200/80 -mx-3 md:-mx-5 px-3 md:px-5 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 md:gap-5 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">Período</span>
          <select
            value={anoIni}
            onChange={e => setAnoIni(Math.min(+e.target.value, anoFim - 1))}
            className="bg-white border border-gray-200 rounded-md text-sm px-2 py-1 focus:outline-none focus:border-anac-light"
          >
            {anos.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-slate-400">→</span>
          <select
            value={anoFim}
            onChange={e => setAnoFim(Math.max(+e.target.value, anoIni + 1))}
            className="bg-white border border-gray-200 rounded-md text-sm px-2 py-1 focus:outline-none focus:border-anac-light"
          >
            {anos.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">Aeroporto</span>
          <select
            value={aeroporto}
            onChange={e => setAeroporto(e.target.value)}
            className="bg-white border border-gray-200 rounded-md text-sm px-2 py-1 focus:outline-none focus:border-anac-light min-w-[200px]"
          >
            {filters?.aeroportos.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {nomeAeroporto && (
          <div className="text-xs text-slate-500 hidden md:block">
            <span className="font-semibold text-slate-700">{nomeAeroporto}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span>{anoIni}–{anoFim}</span>
          </div>
        )}
      </div>
    </div>
  );
}
