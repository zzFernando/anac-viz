"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { SdrResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function AtaDotPlot({ data }: { data: SdrResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_ata?.length) return;
    const items = data.top_ata.slice(0, expanded ? 20 : 10);
    const rowH  = expanded ? 32 : 22;
    const W  = wrap.current.clientWidth;
    const ML = 180, MR = 60, MT = 16, MB = 26;
    const H  = items.length * rowH + MT + MB;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const xMax = (d3.max(items, d => d.n) ?? 1) * 1.15;
    const x = d3.scaleLinear().domain([0, xMax]).range([0, iW]);
    const y = d3.scaleBand()
      .domain(items.map(d => `${d.ata} · ${d.nome}`))
      .range([0, iH]).padding(0.35);
    const cy = (d: typeof items[0]) => y(`${d.ata} · ${d.nome}`)! + y.bandwidth() / 2;

    // Linha de referência pontilhada horizontal por item
    g.selectAll("line.ref")
      .data(items)
      .enter().append("line")
      .attr("x1", 0).attr("x2", iW)
      .attr("y1", d => cy(d)).attr("y2", d => cy(d))
      .attr("stroke", UI.grid).attr("stroke-dasharray", "3,3");

    // Linha do zero ao dot (fina, discreta)
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
      .style("cursor", "default")
      .transition().duration(480).delay((_, i) => i * 35)
      .attr("cx", d => x(d.n));

    // Valor à direita do dot
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

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text")
        .attr("font-size", 9).attr("fill", UI.labelDark).attr("dx", -6));

    // X axis — só ticks no topo, discreto
    g.append("g")
      .call(d3.axisTop(x).ticks(4))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", "none"))
      .call(s => s.selectAll("text").attr("font-size", 8).attr("fill", UI.axisText));

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ata" className="w-full" />
    </div>
  );
}
