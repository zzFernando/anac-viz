"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { AdsResumo } from "@/lib/types";
import { UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function AdsHeatmap({ data }: { data: AdsResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_sistemas?.length) return;

    const items = data.top_sistemas.slice(0, expanded ? 20 : 12);
    const W   = wrap.current.clientWidth;
    const rowH = expanded ? 30 : 22;
    const ML   = 200, MR = 70, MT = 8, MB = 20;
    const BAR  = W - ML - MR;
    const H    = items.length * rowH + MT + MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const maxN  = d3.max(items, d => d.n) ?? 1;
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, maxN]);

    const y = d3.scaleBand()
      .domain(items.map(d => d.sistema))
      .range([0, items.length * rowH]).padding(0.12);

    // Células
    g.selectAll("rect.cell")
      .data(items).enter().append("rect")
      .attr("x", 0)
      .attr("y", d => y(d.sistema)!)
      .attr("width", 0)
      .attr("height", y.bandwidth())
      .attr("fill", d => color(d.n))
      .attr("rx", 3)
      .transition().duration(500).delay((_, i) => i * 30)
      .attr("width", d => (d.n / maxN) * BAR);

    // Valor dentro da barra
    g.selectAll("text.val")
      .data(items).enter().append("text")
      .attr("x", d => Math.max((d.n / maxN) * BAR - 6, 6))
      .attr("y", d => y(d.sistema)! + y.bandwidth() / 2 + 4)
      .attr("text-anchor", d => (d.n / maxN) > 0.15 ? "end" : "start")
      .attr("font-size", expanded ? 10 : 9)
      .attr("font-weight", 700)
      .attr("fill", d => (d.n / maxN) > 0.45 ? "#fff" : UI.labelDark)
      .attr("opacity", 0)
      .text(d => d.n.toLocaleString("pt-BR"))
      .transition().delay((_, i) => i * 30 + 300).duration(150)
      .attr("opacity", 1);

    // Eixo Y — nomes completos
    const MAX_LBL = Math.floor(ML / 6.5);
    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text")
        .attr("font-size", expanded ? 9 : 8)
        .attr("fill", UI.labelDark)
        .attr("dx", -6)
        .text((d: any) => {
          const t = String(d);
          return t.length > MAX_LBL ? t.slice(0, MAX_LBL - 1) + "…" : t;
        }))
      .selectAll("text").append("title").text((d: any) => String(d));

    // Escala de cor à direita (gradiente)
    const defs  = svg.append("defs");
    const grad  = defs.append("linearGradient")
      .attr("id", "ads-hm-grad").attr("x1", "0%").attr("x2", "0%")
      .attr("y1", "100%").attr("y2", "0%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", d3.interpolateBlues(0.1));
    grad.append("stop").attr("offset", "100%").attr("stop-color", d3.interpolateBlues(1));

    const scaleX = ML + BAR + 16;
    const scaleH = Math.min(items.length * rowH, 100);
    svg.append("rect")
      .attr("x", scaleX).attr("y", MT)
      .attr("width", 10).attr("height", scaleH)
      .attr("fill", "url(#ads-hm-grad)").attr("rx", 2);

    svg.append("text").attr("x", scaleX + 14).attr("y", MT + 8)
      .attr("font-size", 7.5).attr("fill", UI.axisText)
      .text(maxN.toLocaleString("pt-BR"));
    svg.append("text").attr("x", scaleX + 14).attr("y", MT + scaleH)
      .attr("font-size", 7.5).attr("fill", UI.axisText).text("0");

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ads" className="w-full" />
    </div>
  );
}
