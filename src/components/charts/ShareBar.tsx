import type { ScatterPoint } from "@/lib/types";

interface Props {
  points: ScatterPoint[] | undefined;
}

/**
 * Mini barra empilhada horizontal mostrando market share das principais empresas
 * no aeroporto. Top 4 nominais + "Outras" agregadas. Usado nos KPIs.
 */
export default function ShareBar({ points }: Props) {
  if (!points || points.length === 0) return null;

  const sorted = [...points].sort((a, b) => b.market_share - a.market_share);
  const top = sorted.slice(0, 4);
  const outrosShare = sorted.slice(4).reduce((s, p) => s + p.market_share, 0);

  type Segment = { sig: string; label: string; share: number; color: string };
  const segments: Segment[] = top.map(p => ({
    sig: p.sig, label: p.label, share: p.market_share, color: p.color,
  }));
  if (outrosShare > 0.5) {
    segments.push({ sig: "OUT", label: "Outras", share: outrosShare, color: "#94A3B8" });
  }
  const total = segments.reduce((s, x) => s + x.share, 0) || 1;

  return (
    <div className="mt-1.5">
      <div className="flex h-1.5 rounded-sm overflow-hidden bg-slate-100">
        {segments.map(s => (
          <div
            key={s.sig}
            style={{ width: `${(s.share / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${s.share.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
        {segments.slice(0, 3).map(s => (
          <span key={s.sig} className="flex items-center gap-1 text-[0.55rem] text-slate-500">
            <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span>{s.label} {s.share.toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
