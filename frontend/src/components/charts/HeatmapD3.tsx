"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { HeatmapData } from "@/lib/types";

interface Tip { x: number; y: number; html: string }

export default function HeatmapD3({ data }: { data: HeatmapData }) {
  const ref = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    if (!ref.current || !wrap.current || !data || !data.data.length) return;
    const W = wrap.current.clientWidth;
    const ML = 42, MR = 80, MT = 10, MB = 30;
    const cols = 12, rows = data.anos.length;
    const cellW = (W - ML - MR) / cols;
    const cellH = Math.max(16, Math.min(28, 340 / rows));
    const H = rows * cellH + MT + MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const colorScale = d3.scaleSequential(d3.interpolateRgbBasis([
      "#22C55E", "#A3E635", "#FCD34D", "#F97316", "#DC2626"
    ])).domain([0, data.zmax]);

    // Cells
    const dataMap = new Map(data.data.map(d => [`${d.ano}-${d.mes}`, d.pct_atraso]));
    for (let ri = 0; ri < rows; ri++) {
      const ano = data.anos[ri];
      for (let ci = 0; ci < cols; ci++) {
        const mes = ci + 1;
        const val = dataMap.get(`${ano}-${mes}`);
        const x = ci * cellW, y = ri * cellH;

        g.append("rect")
          .attr("x", x + 1).attr("y", y + 1)
          .attr("width", cellW - 2).attr("height", cellH - 2)
          .attr("rx", 2)
          .attr("fill", val != null ? colorScale(val) : "#F1F5F9")
          .attr("opacity", val != null ? 1 : 0.4)
          .on("mousemove", (ev: MouseEvent) => {
            if (val == null) return;
            setTip({
              x: ev.clientX + 12, y: ev.clientY - 8,
              html: `<b>${ano} — ${data.meses[ci]}</b><br>${val.toFixed(1)}% atrasados >30 min`,
            });
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

    // Highlight special rows
    for (const [ano, color] of [[2020, "#DC2626"], [2024, "#EA580C"]] as [number, string][]) {
      const ri = data.anos.indexOf(ano);
      if (ri < 0) continue;
      g.append("rect")
        .attr("x", -1).attr("y", ri * cellH - 1)
        .attr("width", cols * cellW + 2).attr("height", cellH + 2)
        .attr("fill", "none").attr("stroke", color)
        .attr("stroke-width", 2).attr("rx", 3).attr("pointer-events", "none");
    }

    // X axis (months)
    const xAxis = g.append("g").attr("transform", `translate(0,${rows * cellH})`);
    data.meses.forEach((m, i) => {
      xAxis.append("text")
        .attr("x", i * cellW + cellW / 2).attr("y", 16)
        .attr("text-anchor", "middle").attr("font-size", 9).attr("fill", "#64748B")
        .text(m);
    });

    // Y axis (years)
    data.anos.forEach((ano, i) => {
      g.append("text")
        .attr("x", -6).attr("y", i * cellH + cellH / 2 + 3.5)
        .attr("text-anchor", "end").attr("font-size", 9).attr("fill", "#64748B")
        .text(ano);
    });

    // Color bar
    const barH = rows * cellH;
    const barScale = d3.scaleLinear().domain([0, data.zmax]).range([barH, 0]);
    const barGrad = svg.append("defs").append("linearGradient")
      .attr("id", "hm-colorbar").attr("x1","0%").attr("x2","0%").attr("y1","100%").attr("y2","0%");
    ["#22C55E","#A3E635","#FCD34D","#F97316","#DC2626"].forEach((c, i, arr) => {
      barGrad.append("stop").attr("offset", `${(i/(arr.length-1))*100}%`).attr("stop-color", c);
    });
    const barG = svg.append("g").attr("transform", `translate(${W - MR + 10},${MT})`);
    barG.append("rect").attr("width", 12).attr("height", barH)
      .attr("fill", "url(#hm-colorbar)").attr("rx", 2);
    barG.append("g").attr("transform", "translate(16,0)")
      .call(d3.axisRight(barScale).ticks(5).tickFormat(v => `${v}%`))
      .call(g2 => g2.select(".domain").remove())
      .call(g2 => g2.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"))
      .call(g2 => g2.selectAll("line").remove());
  }, [data]);

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
