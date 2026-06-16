"use client";

import { useMemo } from "react";
import type { KPIsData, SerieData, ScatterData, RotasData, HeatmapData, FrotaNacional, SdrResumo, OcorrenciasData } from "@/lib/types";

interface Finding {
  icon:    string;
  text:    string;
  tone:    "info" | "positive" | "negative" | "alert";
}

interface Props {
  kpis?:     KPIsData;
  serie?:    SerieData;
  scatter?:  ScatterData;
  rotas?:    RotasData;
  heatmap?:  HeatmapData;
  frota?:    FrotaNacional;
  sdr?:      SdrResumo;
  ocorr?:    OcorrenciasData;
  aeroporto: string;
  anoIni:    number;
  anoFim:    number;
}

const METRO_GROUPS = [
  { name: "Grande São Paulo",      airports: ["SBGR", "SBSP", "SBKP"] },
  { name: "Grande Rio de Janeiro", airports: ["SBGL", "SBRJ", "SBJR"] },
];

const TONE_STYLE: Record<Finding["tone"], { bg: string; border: string; icon: string }> = {
  info:     { bg: "bg-slate-50",   border: "border-l-slate-300",  icon: "text-slate-400" },
  positive: { bg: "bg-emerald-50", border: "border-l-emerald-500", icon: "text-emerald-600" },
  negative: { bg: "bg-rose-50",    border: "border-l-rose-500",    icon: "text-rose-600" },
  alert:    { bg: "bg-amber-50",   border: "border-l-amber-500",   icon: "text-amber-600" },
};

export default function KeyFindings(props: Props) {
  const findings = useMemo(() => computeFindings(props), [props]);

  if (!findings.length) return null;

  return (
    <div className="bg-white rounded-card shadow-card border border-gray-100 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gold text-sm">✦</span>
        <span className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-slate-700">
          Principais achados
        </span>
        <span className="text-[0.6rem] text-slate-400 italic">
          calculados dinamicamente a partir dos filtros
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {findings.map((f, i) => {
          const style = TONE_STYLE[f.tone];
          return (
            <div
              key={i}
              className={`${style.bg} border-l-2 ${style.border} rounded-sm px-2.5 py-1.5 text-[0.75rem] leading-snug text-slate-700 flex items-start gap-2`}
            >
              <span className={`${style.icon} font-bold leading-none mt-0.5`}>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function computeFindings({ kpis, scatter, rotas, heatmap, frota, sdr, ocorr, aeroporto, anoIni, anoFim }: Props): Finding[] {
  const out: Finding[] = [];
  const nome = kpis?.nome ?? aeroporto;

  // 1. Variação YTD — usa o subtítulo já calculado pelo backend
  if (kpis?.variacao && kpis.variacao.value !== "—" && kpis.variacao.value !== "n/d") {
    const positive = kpis.variacao.positive;
    out.push({
      icon: positive ? "▲" : "▼",
      tone: positive ? "positive" : "negative",
      text: `${nome} ${positive ? "cresceu" : "caiu"} ${kpis.variacao.value} (${kpis.variacao.sub}).`,
    });
  }

  // 2. Concentração metropolitana no top rotas
  if (rotas?.rotas?.length && rotas.total_raw) {
    for (const group of METRO_GROUPS) {
      const groupRotas = rotas.rotas.filter(r => group.airports.includes(r.dest));
      if (groupRotas.length >= 2) {
        const pax = groupRotas.reduce((s, r) => s + r.pax_raw, 0);
        const pct = (pax / rotas.total_raw) * 100;
        out.push({
          icon: "●",
          tone: pct > 50 ? "alert" : "info",
          text: `${pct.toFixed(0)}% das partidas concentram-se na ${group.name} (${groupRotas.length} aeroportos).`,
        });
        break;   // só destaca o primeiro grupo encontrado
      }
    }
  }

  // 3. Estrutura de mercado a partir do scatter
  if (scatter?.points?.length) {
    const top3 = [...scatter.points]
      .sort((a, b) => b.market_share - a.market_share)
      .slice(0, 3);
    if (top3.length >= 2) {
      const lead = top3[0];
      const second = top3[1];
      const gap = lead.market_share - second.market_share;
      if (gap < 5 && top3.length >= 3) {
        // mercado pulverizado entre top 3
        const shares = top3.map(p => `${p.label} (${p.market_share.toFixed(0)}%)`).join(", ");
        out.push({
          icon: "●",
          tone: "info",
          text: `Mercado pulverizado: ${shares} — sem dominante claro.`,
        });
      } else {
        out.push({
          icon: "★",
          tone: "info",
          text: `${lead.label} lidera com ${lead.market_share.toFixed(0)}% do mercado, ${gap.toFixed(0)}pp à frente de ${second.label}.`,
        });
      }
    }
  }

  // 4. Tendência de pontualidade (heatmap) — compara APENAS os meses presentes
  // em ambos os anos (last e prev). Evita viés sazonal de 2026 parcial (jan-mar)
  // vs 2025 completo.
  if (heatmap?.data?.length && heatmap.anos.length >= 2) {
    const anos = Array.from(new Set(heatmap.data.map(p => p.ano))).sort((a, b) => a - b);
    const last = anos[anos.length - 1];
    const prev = anos[anos.length - 2];
    const monthsLast = new Set(heatmap.data.filter(p => p.ano === last).map(p => p.mes));
    const monthsPrev = new Set(heatmap.data.filter(p => p.ano === prev).map(p => p.mes));
    const commonMonths = Array.from(monthsLast).filter(m => monthsPrev.has(m)).sort((a, b) => a - b);
    if (commonMonths.length >= 2) {
      const valsLast = heatmap.data.filter(p => p.ano === last && commonMonths.includes(p.mes)).map(p => p.pct_atraso);
      const valsPrev = heatmap.data.filter(p => p.ano === prev && commonMonths.includes(p.mes)).map(p => p.pct_atraso);
      const avgLast = valsLast.reduce((s, v) => s + v, 0) / valsLast.length;
      const avgPrev = valsPrev.reduce((s, v) => s + v, 0) / valsPrev.length;
      const delta = avgLast - avgPrev;
      if (Math.abs(delta) >= 1) {
        const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
        const m0 = MESES[(commonMonths[0] - 1)] ?? "";
        const m1 = MESES[(commonMonths[commonMonths.length - 1] - 1)] ?? "";
        const janela = m0 === m1 ? m0 : `${m0}–${m1}`;
        out.push({
          icon: delta > 0 ? "▼" : "▲",
          tone: delta > 0 ? "negative" : "positive",
          text: `Pontualidade ${delta > 0 ? "piorou" : "melhorou"} em ${janela}/${last} (${avgLast.toFixed(1)}% atrasos) vs mesmo período de ${prev} (${avgPrev.toFixed(1)}%).`,
        });
      }
    }
  }

  // 5. Idade da frota — comparativo entre líder e concorrentes
  if (scatter?.points?.length) {
    const comFrota = scatter.points
      .filter(p => p.idade_frota != null)
      .sort((a, b) => (a.idade_frota! - b.idade_frota!));
    if (comFrota.length >= 2) {
      const newest = comFrota[0];
      const oldest = comFrota[comFrota.length - 1];
      if (oldest.idade_frota! - newest.idade_frota! >= 2) {
        const diff = ((oldest.idade_frota! / newest.idade_frota!) - 1) * 100;
        out.push({
          icon: "✦",
          tone: "info",
          text: `${newest.label} opera com frota ${diff.toFixed(0)}% mais nova que ${oldest.label} (${newest.idade_frota}a vs ${oldest.idade_frota}a).`,
        });
      }
    }
  }

  // 5b. CA vigente — alerta se alguma cia operando no aeroporto tem conformidade baixa
  if (scatter?.points?.length) {
    const comCA = scatter.points.filter(p => p.pct_ca_vigente != null);
    if (comCA.length) {
      const baixo = comCA.filter(p => p.pct_ca_vigente! < 50);
      if (baixo.length) {
        const exemplos = baixo
          .sort((a, b) => a.pct_ca_vigente! - b.pct_ca_vigente!)
          .slice(0, 2)
          .map(p => `${p.label} (${p.pct_ca_vigente!.toFixed(0)}%)`)
          .join(" e ");
        out.push({
          icon: "▲",
          tone: "alert",
          text: `Conformidade RAB baixa: ${exemplos} tem menos da metade da frota com CA vigente.`,
        });
      } else {
        const top = comCA.sort((a, b) => b.pct_ca_vigente! - a.pct_ca_vigente!)[0];
        if (top.pct_ca_vigente! >= 85) {
          out.push({
            icon: "✓",
            tone: "positive",
            text: `${top.label} mantém ${top.pct_ca_vigente!.toFixed(0)}% da frota com Certificado de Aeronavegabilidade vigente.`,
          });
        }
      }
    }
  }

  // 5c. Componente mais problemático (SDR)
  if (sdr?.top_ata?.length) {
    const top = sdr.top_ata[0];
    out.push({
      icon: "⚠",
      tone: "alert",
      text: `Componente mais reportado em SDRs no Brasil: ${top.nome} (${top.n.toLocaleString("pt-BR")} ocorrências, capítulo ATA ${top.ata}).`,
    });
  }

  // 5d. Ocorrências por fase
  if (ocorr?.resumo?.por_fase?.length) {
    const top = ocorr.resumo.por_fase.filter(f => f.fase && f.fase !== "DESCONHECIDA")[0];
    if (top) {
      out.push({
        icon: "●",
        tone: "info",
        text: `Fase de operação com mais ocorrências: ${top.fase.toLowerCase()} (${top.n.toLocaleString("pt-BR")} eventos no histórico).`,
      });
    }
  }

  // 6. Frota nacional — contexto
  if (frota?.transporte && out.length < 6) {
    const t = frota.transporte;
    const top = t.top_fabricantes?.[0];
    if (top) {
      out.push({
        icon: "✈",
        tone: "info",
        text: `Frota nacional de transporte: ${t.total.toLocaleString("pt-BR")} aeronaves · idade média ${t.idade_media}a · ${top.nome} lidera com ${top.n}.`,
      });
    }
  }

  // Período disponível como achado base se nada mais foi gerado
  if (out.length === 0) {
    out.push({
      icon: "ℹ",
      tone: "info",
      text: `Sem dados suficientes para o período ${anoIni}–${anoFim} em ${nome}.`,
    });
  }

  return out.slice(0, 8);
}
