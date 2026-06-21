"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { SdrResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function AtaLollipop({ data }: { data: SdrResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_ata?.length) return;
    const items = data.top_ata.slice(0, expanded ? 20 : 10);
    const rowH  = expanded ? 34 : 24;
    const W  = wrap.current.clientWidth;
    const ML = 180, MR = 70, MT = 8, MB = 26;
    const H  = items.length * rowH + MT + MB + 4;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const xMax = (d3.max(items, d => d.n) ?? 1) * 1.18;
    const x = d3.scaleLinear().domain([0, xMax]).range([0, iW]);
    const y = d3.scaleBand()
      .domain(items.map(d => `${d.ata} · ${d.nome}`))
      .range([0, iH]).padding(0.4);
    const cy = (d: typeof items[0]) => y(`${d.ata} · ${d.nome}`)! + y.bandwidth() / 2;

    // Grid
    g.append("g")
      .call(d3.axisTop(x).ticks(4).tickSize(-iH).tickFormat(() => ""))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", UI.grid));

    // Stems
    g.selectAll("line.stem")
      .data(items)
      .enter().append("line")
      .attr("class", "stem")
      .attr("x1", 0).attr("x2", 0)
      .attr("y1", d => cy(d)).attr("y2", d => cy(d))
      .attr("stroke", (_, i) => paletteColor(i))
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.45)
      .transition().duration(500).delay((_, i) => i * 40)
      .attr("x2", d => x(d.n));

    // Dots
    g.selectAll("circle.dot")
      .data(items)
      .enter().append("circle")
      .attr("cx", 0).attr("cy", d => cy(d))
      .attr("r", 6)
      .attr("fill", (_, i) => paletteColor(i))
      .attr("stroke", "#fff").attr("stroke-width", 1.5)
      .transition().duration(500).delay((_, i) => i * 40)
      .attr("cx", d => x(d.n));

    // Valor
    g.selectAll("text.val")
      .data(items)
      .enter().append("text")
      .attr("x", d => x(d.n) + 10)
      .attr("y", d => cy(d) + 4)
      .attr("font-size", 10).attr("font-weight", 700)
      .attr("fill", UI.labelDark)
      .attr("opacity", 0)
      .text(d => d.n.toLocaleString("pt-BR"))
      .transition().delay((_, i) => i * 40 + 300).duration(150)
      .attr("opacity", 1);

    // Y axis
    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text")
        .attr("font-size", 9).attr("fill", UI.labelDark).attr("dx", -4));

    // X axis
    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(4))
      .call(s => s.select(".domain").attr("stroke", UI.axisDomain))
      .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", UI.axisText));

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ata" className="w-full" />
    </div>
  );
}
