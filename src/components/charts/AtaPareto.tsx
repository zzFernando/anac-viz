"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { SdrResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function AtaPareto({ data }: { data: SdrResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_ata?.length) return;

    const raw   = data.top_ata.slice(0, expanded ? 20 : 12);
    const total = d3.sum(raw, d => d.n);
    let cum = 0;
    const items = raw.map(d => {
      cum += d.n;
      return { ...d, pct: (cum / total) * 100 };
    });

    const W  = wrap.current.clientWidth;
    const H  = expanded ? 440 : 280;
    const ML = 42, MR = 46, MT = 16, MB = 64;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const x = d3.scaleBand()
      .domain(items.map(d => `${d.ata}`))
      .range([0, iW]).padding(0.22);

    const yLeft = d3.scaleLinear()
      .domain([0, (d3.max(items, d => d.n) ?? 1) * 1.15])
      .range([iH, 0]);

    const yRight = d3.scaleLinear().domain([0, 100]).range([iH, 0]);

    // Grid
    g.append("g")
      .call(d3.axisLeft(yLeft).ticks(4).tickSize(-iW).tickFormat(() => ""))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", UI.grid));

    // Barras
    g.selectAll("rect.bar")
      .data(items)
      .enter().append("rect")
      .attr("x", d => x(d.ata)!)
      .attr("width", x.bandwidth())
      .attr("y", iH).attr("height", 0)
      .attr("fill", (_, i) => paletteColor(i))
      .attr("rx", 2)
      .transition().duration(500).delay((_, i) => i * 30)
      .attr("y", d => yLeft(d.n))
      .attr("height", d => iH - yLeft(d.n));

    // Linha acumulada
    const line = d3.line<typeof items[0]>()
      .x(d => x(d.ata)! + x.bandwidth() / 2)
      .y(d => yRight(d.pct))
      .curve(d3.curveMonotoneX);

    const path = g.append("path")
      .datum(items)
      .attr("fill", "none")
      .attr("stroke", UI.labelDark)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,3")
      .attr("d", line);

    const len = (path.node() as SVGPathElement).getTotalLength();
    path.attr("stroke-dashoffset", len)
      .transition().duration(800).delay(200)
      .attr("stroke-dashoffset", 0)
      .attr("stroke-dasharray", `${len}`);

    // Pontos na linha
    g.selectAll("circle.pt")
      .data(items)
      .enter().append("circle")
      .attr("cx", d => x(d.ata)! + x.bandwidth() / 2)
      .attr("cy", d => yRight(d.pct))
      .attr("r", 3.5)
      .attr("fill", "#fff")
      .attr("stroke", UI.labelDark)
      .attr("stroke-width", 1.5)
      .attr("opacity", 0)
      .transition().delay(900).duration(200)
      .attr("opacity", 1);

    // Linha 80%
    g.append("line")
      .attr("x1", 0).attr("x2", iW)
      .attr("y1", yRight(80)).attr("y2", yRight(80))
      .attr("stroke", "#B83232").attr("stroke-width", 1)
      .attr("stroke-dasharray", "6,3").attr("opacity", 0.6);
    g.append("text")
      .attr("x", iW + 4).attr("y", yRight(80) + 4)
      .attr("font-size", 8).attr("fill", "#B83232").attr("font-weight", 700)
      .text("80%");

    // Eixo X — labels ATA + nome embaixo
    const xAxis = g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).tickSize(4))
      .call(s => s.select(".domain").attr("stroke", UI.axisDomain))
      .call(s => s.selectAll("text")
        .attr("font-size", expanded ? 9 : 8)
        .attr("fill", UI.labelDark)
        .attr("dy", "1em"));

    // Nome do componente em segunda linha (rotacionado)
    g.selectAll("text.nome")
      .data(items)
      .enter().append("text")
      .attr("class", "nome")
      .attr("transform", d =>
        `translate(${x(d.ata)! + x.bandwidth() / 2},${iH + (expanded ? 28 : 22)}) rotate(-30)`)
      .attr("text-anchor", "end")
      .attr("font-size", expanded ? 8 : 7)
      .attr("fill", UI.axisText)
      .text(d => d.nome.length > 18 ? d.nome.slice(0, 17) + "…" : d.nome)
      .append("title").text(d => d.nome);

    // Eixo Y esquerdo
    g.append("g")
      .call(d3.axisLeft(yLeft).ticks(4))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text").attr("font-size", 8).attr("fill", UI.axisText));

    // Eixo Y direito (%)
    g.append("g").attr("transform", `translate(${iW},0)`)
      .call(d3.axisRight(yRight).ticks(4).tickFormat(v => `${v}%`))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text").attr("font-size", 8).attr("fill", UI.axisText));

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ata" className="w-full" />
    </div>
  );
}
