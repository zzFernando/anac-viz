"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { AdsResumo } from "@/lib/types";
import { paletteColor } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function AdsBar({ data }: { data: AdsResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_sistemas?.length) return;

    const items = [...data.top_sistemas]
      .sort((a, b) => b.n - a.n)
      .slice(0, expanded ? 16 : 10);

    const W = wrap.current.clientWidth;
    const ML = 160, MR = 56, MT = 6, MB = 26;
    const H = items.length * (expanded ? 38 : 26) + MT + MB + 4;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const xMax = (d3.max(items, d => d.n) ?? 1) * 1.18;
    const x = d3.scaleLinear().domain([0, xMax]).range([0, iW]);
    const y = d3.scaleBand().domain(items.map(d => d.sistema)).range([0, iH]).padding(0.28);

    g.append("g")
      .call(d3.axisTop(x).ticks(4).tickSize(-iH).tickFormat(() => ""))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", "#F1F5F9"));

    g.selectAll("rect.bar")
      .data(items)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("y", d => y(d.sistema)!)
      .attr("height", y.bandwidth())
      .attr("x", 0).attr("width", 0)
      .attr("fill", (_, i) => paletteColor(i))
      .attr("opacity", 0.88)
      .attr("rx", 3)
      .transition().duration(500).delay((_, i) => i * 50)
      .attr("width", d => x(d.n));

    g.selectAll("text.n")
      .data(items)
      .enter().append("text")
      .attr("class", "n")
      .attr("y", d => y(d.sistema)! + y.bandwidth() / 2 + 4)
      .attr("x", d => x(d.n) + 6)
      .attr("font-size", 10).attr("font-weight", 600)
      .attr("fill", "#334155")
      .text(d => d.n.toLocaleString("pt-BR"));

    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text")
        .attr("font-size", expanded ? 9 : 8).attr("fill", "#334155").attr("dx", -4)
        .each(function(d) {
          const el = d3.select(this);
          const str = d as string;
          if (str.length > 22) el.text(str.slice(0, 21) + "…").append("title").text(str);
        }));

    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(4))
      .call(s => s.select(".domain").attr("stroke", "#E2E8F0"))
      .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"));
  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ads" className="w-full" />
    </div>
  );
}
