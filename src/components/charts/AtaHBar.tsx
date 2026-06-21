"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { SdrResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function AtaHBar({ data }: { data: SdrResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_ata?.length) return;

    const items = data.top_ata
      .slice(0, expanded ? 20 : 12)
      .sort((a, b) => b.n - a.n);

    const total = d3.sum(items, d => d.n);
    const maxN  = items[0].n;

    const W   = wrap.current.clientWidth;
    const ROW = expanded ? 24 : 20;
    const ML  = expanded ? 160 : 130;   // largura do label à esquerda
    const MR  = 52;                      // espaço para valor à direita
    const MT  = 8;
    const H   = items.length * ROW + MT + 4;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    const barW = W - ML - MR;
    const x = d3.scaleLinear().domain([0, maxN]).range([0, barW]);

    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    // Grid lines verticais
    x.ticks(4).forEach(t => {
      g.append("line")
        .attr("x1", x(t)).attr("x2", x(t))
        .attr("y1", 0).attr("y2", items.length * ROW)
        .attr("stroke", UI.grid).attr("stroke-width", 0.5);
    });

    const rows = g.selectAll("g.row")
      .data(items)
      .enter().append("g")
      .attr("class", "row")
      .attr("transform", (_, i) => `translate(0, ${i * ROW})`);

    // Barra de fundo (% do total — tom suave)
    rows.append("rect")
      .attr("x", 0).attr("y", ROW * 0.15)
      .attr("height", ROW * 0.7).attr("rx", 2)
      .attr("fill", (_, i) => paletteColor(i))
      .attr("opacity", 0.1)
      .attr("width", d => x(d.n / total * maxN));   // escala relativa ao max

    // Barra principal
    rows.append("rect")
      .attr("x", 0).attr("y", ROW * 0.15)
      .attr("height", ROW * 0.7).attr("rx", 2)
      .attr("fill", (_, i) => paletteColor(i))
      .attr("opacity", 0.85)
      .attr("width", 0)
      .transition().duration(400).delay((_, i) => i * 25)
      .attr("width", d => x(d.n));

    // Label ATA (código) — à esquerda, negrito
    svg.selectAll("text.ata-code")
      .data(items)
      .enter().append("text")
      .attr("class", "ata-code")
      .attr("x", ML - 8)
      .attr("y", (_, i) => MT + i * ROW + ROW * 0.5 + 1)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("font-size", expanded ? 8 : 7)
      .attr("font-weight", 700)
      .attr("fill", (_, i) => paletteColor(i))
      .text(d => d.ata);

    // Label nome do componente — à esquerda, normal
    svg.selectAll("text.ata-nome")
      .data(items)
      .enter().append("text")
      .attr("class", "ata-nome")
      .attr("x", ML - 8 - (expanded ? 26 : 22))
      .attr("y", (_, i) => MT + i * ROW + ROW * 0.5 + 1)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("font-size", expanded ? 8.5 : 7.5)
      .attr("fill", UI.labelDark)
      .text(d => {
        const maxC = Math.floor((ML - (expanded ? 38 : 32)) / (expanded ? 5.5 : 4.8));
        return d.nome.length > maxC ? d.nome.slice(0, maxC - 1) + "…" : d.nome;
      })
      .append("title").text(d => `ATA ${d.ata} · ${d.nome}`);

    // Valor absoluto no final da barra
    rows.append("text")
      .attr("x", d => x(d.n) + 5)
      .attr("y", ROW / 2 + 1)
      .attr("dominant-baseline", "middle")
      .attr("font-size", expanded ? 8.5 : 7.5)
      .attr("font-weight", 700)
      .attr("fill", (_, i) => paletteColor(i))
      .text(d => d.n.toLocaleString("pt-BR"));

    // % do total — mais apagado, após o valor
    rows.append("text")
      .attr("x", d => x(d.n) + (expanded ? 28 : 24))
      .attr("y", ROW / 2 + 1)
      .attr("dominant-baseline", "middle")
      .attr("font-size", expanded ? 7.5 : 6.5)
      .attr("fill", UI.labelDim)
      .text(d => `${((d.n / total) * 100).toFixed(0)}%`);

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ata" className="w-full" style={{ display: "block" }} />
    </div>
  );
}
