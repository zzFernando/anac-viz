"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { FrotaModelo } from "@/lib/types";

const ANAC_LIGHT = "#0066CC";

/**
 * Top modelos de aeronaves de transporte ativas no Brasil (RAB).
 * Bar horizontal · cor pelo gradient azul→cinza conforme idade média do modelo.
 */
export default function FrotaModelos({ data }: { data: FrotaModelo[] }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.length) return;
    const items = [...data].slice(0, 8);
    const W = wrap.current.clientWidth;
    const H = 240;
    const ML = 130, MR = 110, MT = 6, MB = 26;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const xMax    = (d3.max(items, d => d.n) ?? 1) * 1.18;
    const idadeMax = d3.max(items, d => d.idade_media ?? 0) ?? 30;

    const x = d3.scaleLinear().domain([0, xMax]).range([0, iW]);
    const y = d3.scaleBand().domain(items.map(d => d.modelo)).range([0, iH]).padding(0.28);
    const colorByIdade = d3.scaleLinear<string>()
      .domain([2, idadeMax])
      .range([ANAC_LIGHT, "#94A3B8"])
      .clamp(true);

    // Grid
    g.append("g")
      .call(d3.axisTop(x).ticks(4).tickSize(-iH).tickFormat(() => ""))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", "#F1F5F9"));

    // Barras
    g.selectAll("rect.bar")
      .data(items)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("y", d => y(d.modelo)!)
      .attr("height", y.bandwidth())
      .attr("x", 0)
      .attr("width", 0)
      .attr("fill", d => d.idade_media != null ? colorByIdade(d.idade_media) : ANAC_LIGHT)
      .attr("rx", 3)
      .transition().duration(500).delay((_, i) => i * 50)
      .attr("width", d => x(d.n));

    // Quantidade
    g.selectAll("text.n")
      .data(items)
      .enter().append("text")
      .attr("class", "n")
      .attr("y", d => y(d.modelo)! + y.bandwidth() / 2 + 4)
      .attr("x", d => x(d.n) + 6)
      .attr("font-size", 11).attr("font-weight", 600).attr("fill", "#334155")
      .text(d => `${d.n}`);

    // Idade média compacta após a quantidade
    g.selectAll("text.idade")
      .data(items)
      .enter().append("text")
      .attr("class", "idade")
      .attr("y", d => y(d.modelo)! + y.bandwidth() / 2 + 4)
      .attr("x", d => x(d.n) + 6 + String(d.n).length * 7 + 4)
      .attr("font-size", 9).attr("font-style", "italic").attr("fill", "#94A3B8")
      .text(d => d.idade_media != null ? `${d.idade_media}a` : "");

    // Y axis (modelos) — com tooltip nativo SVG mostrando fabricante completo
    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text").attr("font-size", 10).attr("fill", "#334155").attr("dx", -4))
      .selectAll("text")
      .append("title")
      .text(d => {
        const it = items.find(i => i.modelo === d);
        return it?.fabricante ? `${it.modelo} — ${it.fabricante}` : String(d);
      });

    // X axis
    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(4))
      .call(s => s.select(".domain").attr("stroke", "#E2E8F0"))
      .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"));

    // Legenda compacta
    svg.append("text")
      .attr("x", W - MR + 4).attr("y", MT + 10)
      .attr("font-size", 8).attr("fill", "#94A3B8").attr("font-style", "italic")
      .text("nº · idade média");
  }, [data]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-frota-modelos" className="w-full" />
    </div>
  );
}
