"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { RotasData } from "@/lib/types";

const ANAC_BLUE  = "#003F7F";
const ANAC_LIGHT = "#0066CC";

export default function BarChartD3({ data }: { data: RotasData }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !wrap.current || !data || !data.rotas.length) return;
    const W = wrap.current.clientWidth;
    const H = 280;
    const ML = 140, MR = 64, MT = 10, MB = 30;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const rotas = [...data.rotas].reverse();
    const xMax  = (d3.max(rotas, d => d.pax) ?? 1) * 1.18;

    const x = d3.scaleLinear().domain([0, xMax]).range([0, iW]);
    const y = d3.scaleBand()
      .domain(rotas.map(d => d.label))
      .range([0, iH]).padding(0.3);

    // Grid
    g.append("g").attr("class", "grid")
      .call(d3.axisTop(x).ticks(4).tickSize(-iH).tickFormat(() => ""))
      .call(g2 => g2.select(".domain").remove())
      .call(g2 => g2.selectAll("line").attr("stroke", "#F1F5F9"));

    // Bars
    g.selectAll("rect.bar")
      .data(rotas)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("y", d => y(d.label)!)
      .attr("height", y.bandwidth())
      .attr("x", 0)
      .attr("width", 0)
      .attr("fill", (_, i) => i === rotas.length - 1 ? ANAC_BLUE : ANAC_LIGHT)
      .attr("rx", 3)
      .transition().duration(500).delay((_, i) => i * 60)
      .attr("width", d => x(d.pax));

    // Value labels
    g.selectAll("text.val")
      .data(rotas)
      .enter().append("text")
      .attr("class", "val")
      .attr("y", d => y(d.label)! + y.bandwidth() / 2 + 4)
      .attr("x", d => x(d.pax) + 6)
      .attr("font-size", 11).attr("font-weight", 600)
      .attr("fill", "#334155")
      .text(d => `${d.pax.toFixed(data.unit === "M" ? 1 : 0)}${data.unit}`);

    // Y axis (labels)
    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(g2 => g2.select(".domain").remove())
      .call(g2 => {
        g2.selectAll("text").attr("font-size", 10).attr("fill", "#334155").attr("dx", -4);
      });

    // X axis
    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(v => `${v}${data.unit}`))
      .call(g2 => g2.select(".domain").attr("stroke", "#E2E8F0"))
      .call(g2 => g2.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"));
  }, [data]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-bar" className="w-full" />
    </div>
  );
}
