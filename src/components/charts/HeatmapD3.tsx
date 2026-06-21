"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { HeatmapData } from "@/lib/types";
import { eventsForAirport } from "@/lib/events";
import { useExpanded } from "@/lib/expandedContext";

interface Tip { x: number; y: number; html: string }

interface Props {
  data: HeatmapData;
  /** ICAO do aeroporto pra contextualizar células vazias e marcar anos de eventos. */
  aeroporto?: string;
}

export default function HeatmapD3({ data, aeroporto }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data || !data.data.length) return;
    const W = wrap.current.clientWidth;
    const ML = 42, MR = 80, MT = 10, MB = 36;
    const cols = 12, rows = data.anos.length;
    const cellW = (W - ML - MR) / cols;
    const cellH = expanded ? Math.max(28, Math.min(52, 600 / rows)) : Math.max(16, Math.min(28, 340 / rows));
    const H = rows * cellH + MT + MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    // SVG <pattern> — hachura diagonal pra células sem dados
    const defs = svg.append("defs");
    const pattern = defs.append("pattern")
      .attr("id", "hatch-empty")
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", 5).attr("height", 5)
      .attr("patternTransform", "rotate(45)");
    pattern.append("rect").attr("width", 5).attr("height", 5).attr("fill", "#E2E8F0");
    pattern.append("line")
      .attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 5)
      .attr("stroke", "#94A3B8").attr("stroke-width", 1.2);

    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const colorScale = d3.scaleSequential(d3.interpolateRgbBasis([
      "#22C55E", "#A3E635", "#FCD34D", "#F97316", "#DC2626"
    ])).domain([0, data.zmax]);

    // Eventos contextuais aplicáveis ao aeroporto
    const evts = aeroporto ? eventsForAirport(aeroporto) : [];

    // Determina, p/ cada célula nula, se há evento ativo que justifique (regional)
    function emptyContext(ano: number, mes: number): string | null {
      for (const ev of evts) {
        if (ev.scope !== "regional") continue;
        const start = new Date(ev.date);
        const end   = new Date(ev.dateEnd ?? ev.date);
        const cell  = new Date(ano, mes - 1, 15);
        if (cell >= start && cell <= end) {
          return `Aeroporto sem operação ou sem dados — ${ev.label}`;
        }
      }
      return null;
    }

    const dataMap = new Map(data.data.map(d => [`${d.ano}-${d.mes}`, d.pct_atraso]));
    for (let ri = 0; ri < rows; ri++) {
      const ano = data.anos[ri];
      for (let ci = 0; ci < cols; ci++) {
        const mes = ci + 1;
        const val = dataMap.get(`${ano}-${mes}`);
        const x = ci * cellW, y = ri * cellH;
        const missing = val == null;
        const ctx = missing ? emptyContext(ano, mes) : null;

        g.append("rect")
          .attr("x", x + 1).attr("y", y + 1)
          .attr("width", cellW - 2).attr("height", cellH - 2)
          .attr("rx", 2)
          .attr("fill", missing ? "url(#hatch-empty)" : colorScale(val!))
          .on("mousemove", (ev: MouseEvent) => {
            const html = missing
              ? `<b>${ano} — ${data.meses[ci]}</b><br>${ctx ?? "Sem dados disponíveis"}`
              : `<b>${ano} — ${data.meses[ci]}</b><br>${val!.toFixed(1).replace(".", ",")}% dos voos atrasaram mais de 30 min`;
            setTip({ x: ev.clientX + 12, y: ev.clientY - 8, html });
          })
          .on("mouseleave", () => setTip(null));

        if (val != null && cellH > 18) {
          g.append("text")
            .attr("x", x + cellW / 2).attr("y", y + cellH / 2 + 3.5)
            .attr("text-anchor", "middle").attr("font-size", 8)
            .attr("fill", val > data.zmax * 0.55 ? "white" : "#334155")
            .text(val.toFixed(0));
        }
      }
    }

    // Highlight de anos com eventos contextuais (deriva de events.ts ao invés de hardcode)
    const eventYears = new Map<number, string>();
    for (const ev of evts) {
      const startY = parseInt(ev.date.slice(0, 4), 10);
      eventYears.set(startY, ev.color);
    }
    Array.from(eventYears.entries()).forEach(([ano, color]) => {
      const ri = data.anos.indexOf(ano);
      if (ri < 0) return;
      g.append("rect")
        .attr("x", -1).attr("y", ri * cellH - 1)
        .attr("width", cols * cellW + 2).attr("height", cellH + 2)
        .attr("fill", "none").attr("stroke", color)
        .attr("stroke-width", 2).attr("rx", 3).attr("pointer-events", "none");
    });

    // X axis (meses)
    const xAxis = g.append("g").attr("transform", `translate(0,${rows * cellH})`);
    data.meses.forEach((m, i) => {
      xAxis.append("text")
        .attr("x", i * cellW + cellW / 2).attr("y", 16)
        .attr("text-anchor", "middle").attr("font-size", 9).attr("fill", "#64748B")
        .text(m);
    });

    // Y axis (anos)
    data.anos.forEach((ano, i) => {
      g.append("text")
        .attr("x", -6).attr("y", i * cellH + cellH / 2 + 3.5)
        .attr("text-anchor", "end").attr("font-size", 9).attr("fill", "#64748B")
        .text(ano);
    });

    // Colorbar
    const barH = rows * cellH;
    const barScale = d3.scaleLinear().domain([0, data.zmax]).range([barH, 0]);
    const barGrad = defs.append("linearGradient")
      .attr("id", "hm-colorbar").attr("x1","0%").attr("x2","0%").attr("y1","100%").attr("y2","0%");
    ["#22C55E","#A3E635","#FCD34D","#F97316","#DC2626"].forEach((c, i, arr) => {
      barGrad.append("stop").attr("offset", `${(i/(arr.length-1))*100}%`).attr("stop-color", c);
    });
    const barG = svg.append("g").attr("transform", `translate(${W - MR + 10},${MT})`);
    barG.append("rect").attr("width", 12).attr("height", barH)
      .attr("fill", "url(#hm-colorbar)").attr("rx", 2);
    barG.append("g").attr("transform", "translate(16,0)")
      .call(d3.axisRight(barScale).ticks(5).tickFormat(v => `${v}%`))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"))
      .call(s => s.selectAll("line").remove());

    // Subtítulo + legenda da hachura (canto inferior esquerdo)
    const footerG = svg.append("g").attr("transform", `translate(${ML}, ${MT + barH + 28})`);
    footerG.append("text")
      .attr("x", 0).attr("y", 0)
      .attr("font-size", 8).attr("font-style", "italic").attr("fill", "#64748B")
      .text("Verde = menos atrasos · Vermelho = mais atrasos");
    // Swatch de hachura na legenda
    footerG.append("rect")
      .attr("x", 240).attr("y", -8)
      .attr("width", 10).attr("height", 10)
      .attr("fill", "url(#hatch-empty)")
      .attr("rx", 1);
    footerG.append("text")
      .attr("x", 254).attr("y", 0)
      .attr("font-size", 8).attr("fill", "#64748B")
      .text("sem operação ou sem dados");
  }, [data, aeroporto, expanded]);

  return (
    <div ref={wrap} className="w-full relative">
      <svg ref={ref} id="chart-heatmap" className="w-full" />
      {tip && (
        <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }}
          dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}
    </div>
  );
}
