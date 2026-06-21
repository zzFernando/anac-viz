"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { AdsResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function AdsDotPlot({ data }: { data: AdsResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_sistemas?.length) return;
    const MAX_LBL = 30;
    const items = data.top_sistemas.slice(0, expanded ? 20 : 10).map(d => ({
      ...d,
      full:    d.sistema,
      sistema: d.sistema.length > MAX_LBL ? d.sistema.slice(0, MAX_LBL - 1) + "…" : d.sistema,
    }));
    const rowH  = expanded ? 32 : 22;
    const W  = wrap.current.clientWidth;
    const ML = 230, MR = 60, MT = 16, MB = 26;
    const H  = items.length * rowH + MT + MB;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const xMax = (d3.max(items, d => d.n) ?? 1) * 1.15;
    const x = d3.scaleLinear().domain([0, xMax]).range([0, iW]);
    const y = d3.scaleBand()
      .domain(items.map(d => d.sistema))
      .range([0, iH]).padding(0.35);
    const cy = (d: typeof items[0]) => y(d.sistema)! + y.bandwidth() / 2;

    // Linha de referência por item
    g.selectAll("line.ref")
      .data(items)
      .enter().append("line")
      .attr("x1", 0).attr("x2", iW)
      .attr("y1", d => cy(d)).attr("y2", d => cy(d))
      .attr("stroke", UI.grid).attr("stroke-dasharray", "3,3");

    // Linha base discreta
    g.selectAll("line.base")
      .data(items)
      .enter().append("line")
      .attr("x1", 0).attr("x2", 0)
      .attr("y1", d => cy(d)).attr("y2", d => cy(d))
      .attr("stroke", (_, i) => paletteColor(i))
      .attr("stroke-width", 1).attr("opacity", 0.25)
      .transition().duration(480).delay((_, i) => i * 35)
      .attr("x2", d => x(d.n));

    // Dots
    g.selectAll("circle.dot")
      .data(items)
      .enter().append("circle")
      .attr("cx", 0).attr("cy", d => cy(d))
      .attr("r", expanded ? 7 : 5.5)
      .attr("fill", (_, i) => paletteColor(i))
      .attr("stroke", "#fff").attr("stroke-width", 1.5)
      .transition().duration(480).delay((_, i) => i * 35)
      .attr("cx", d => x(d.n));

    // Tooltip nativo no dot
    g.selectAll("circle.dot").append("title")
      .text((d: unknown) => {
        const item = d as typeof items[0];
        return `${item.full}\n${item.n.toLocaleString("pt-BR")} regras vigentes`;
      });

    // Valor à direita
    g.selectAll("text.val")
      .data(items)
      .enter().append("text")
      .attr("x", d => x(d.n) + (expanded ? 13 : 10))
      .attr("y", d => cy(d) + 4)
      .attr("font-size", expanded ? 10 : 9)
      .attr("font-weight", 700)
      .attr("fill", UI.labelDark)
      .attr("opacity", 0)
      .text(d => d.n.toLocaleString("pt-BR"))
      .transition().delay((_, i) => i * 35 + 280).duration(150)
      .attr("opacity", 1);

    // Y axis com tooltip no hover
    const yAxis = g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text")
        .attr("font-size", 8).attr("fill", UI.labelDark).attr("dx", -6));

    yAxis.selectAll("text").append("title")
      .text(d => { const it = items.find(i => i.sistema === d); return it?.full ?? String(d); });

    // X axis topo
    g.append("g")
      .call(d3.axisTop(x).ticks(4))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", "none"))
      .call(s => s.selectAll("text").attr("font-size", 8).attr("fill", UI.axisText));

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ads" className="w-full" />
    </div>
  );
}
