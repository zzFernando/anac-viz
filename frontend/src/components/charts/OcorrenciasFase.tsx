"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { OcorrenciaResumo } from "@/lib/types";

const GOLD = "#C89600";
const ANAC_LIGHT = "#0066CC";

/**
 * Bar horizontal — fase da operação onde ocorrências mais acontecem.
 * Pousa? Decolagem? Cruzeiro? Mostra onde o risco está concentrado.
 */
export default function OcorrenciasFase({ data }: { data: OcorrenciaResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.por_fase?.length) return;
    const items = data.por_fase.filter(d => d.fase && d.fase !== "DESCONHECIDA").slice(0, 8);
    const W = wrap.current.clientWidth;
    const ML = 140, MR = 56, MT = 6, MB = 26;
    const H = items.length * 26 + MT + MB + 4;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const xMax = (d3.max(items, d => d.n) ?? 1) * 1.18;
    const x = d3.scaleLinear().domain([0, xMax]).range([0, iW]);
    const y = d3.scaleBand().domain(items.map(d => d.fase)).range([0, iH]).padding(0.28);

    g.append("g")
      .call(d3.axisTop(x).ticks(4).tickSize(-iH).tickFormat(() => ""))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", "#F1F5F9"));

    g.selectAll("rect.bar")
      .data(items)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("y", d => y(d.fase)!)
      .attr("height", y.bandwidth())
      .attr("x", 0).attr("width", 0)
      .attr("fill", (_, i) => i === 0 ? GOLD : ANAC_LIGHT)
      .attr("opacity", 0.88)
      .attr("rx", 3)
      .transition().duration(500).delay((_, i) => i * 50)
      .attr("width", d => x(d.n));

    g.selectAll("text.n")
      .data(items)
      .enter().append("text")
      .attr("class", "n")
      .attr("y", d => y(d.fase)! + y.bandwidth() / 2 + 4)
      .attr("x", d => x(d.n) + 6)
      .attr("font-size", 10).attr("font-weight", 600)
      .attr("fill", "#334155")
      .text(d => d.n.toLocaleString("pt-BR"));

    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text").attr("font-size", 10).attr("fill", "#334155").attr("dx", -4));

    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(4))
      .call(s => s.select(".domain").attr("stroke", "#E2E8F0"))
      .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"));
  }, [data]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ocorr-fase" className="w-full" />
    </div>
  );
}
