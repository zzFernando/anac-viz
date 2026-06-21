"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { FrotaFabricante } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function FrotaFabricantesScatter({ data }: { data: FrotaFabricante[] }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.length) return;
    const items = [...data].slice(0, 8);
    const W = wrap.current.clientWidth;
    const H = expanded ? 500 : 240;
    const ML = 52, MR = 16, MT = 16, MB = 40;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const xExt = d3.extent(items, d => d.idade_media) as [number, number];
    const yExt = d3.extent(items, d => d.n)           as [number, number];
    const xPad = (xExt[1] - xExt[0]) * 0.18 || 2;
    const yPad = (yExt[1] - yExt[0]) * 0.22 || 10;

    const x = d3.scaleLinear().domain([xExt[0] - xPad, xExt[1] + xPad]).range([0, iW]);
    const y = d3.scaleLinear().domain([yExt[0] - yPad, yExt[1] + yPad]).range([iH, 0]);

    // Grid
    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickSize(-iW).tickFormat(() => ""))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", UI.grid));

    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(-iH).tickFormat(() => ""))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", UI.grid));

    // Eixos
    g.append("g")
      .call(d3.axisLeft(y).ticks(4))
      .call(s => s.select(".domain").attr("stroke", UI.axisDomain))
      .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", UI.axisText));

    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(v => `${v} anos`))
      .call(s => s.select(".domain").attr("stroke", UI.axisDomain))
      .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", UI.axisText));

    // Rótulos dos eixos
    g.append("text")
      .attr("x", iW / 2).attr("y", iH + 34)
      .attr("text-anchor", "middle")
      .attr("font-size", 9).attr("fill", UI.axisText)
      .text("Idade média da frota (anos)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -iH / 2).attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("font-size", 9).attr("fill", UI.axisText)
      .text("Aeronaves");

    // Pontos — animados de escala 0 → 1
    const dots = g.selectAll("circle.dot")
      .data(items)
      .enter().append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.idade_media))
      .attr("cy", d => y(d.n))
      .attr("r", 0)
      .attr("fill", (_, i) => paletteColor(i))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("cursor", "default");

    dots.transition().duration(500).delay((_, i) => i * 60)
      .attr("r", 7);

    // Labels com posicionamento inteligente (evita sobreposição simples)
    g.selectAll("text.lbl")
      .data(items)
      .enter().append("text")
      .attr("class", "lbl")
      .attr("x", (d, i, arr) => {
        const cx = x(d.idade_media);
        // se perto da margem direita, vai para a esquerda
        return cx > iW * 0.75 ? cx - 10 : cx + 10;
      })
      .attr("y", d => y(d.n) + 4)
      .attr("text-anchor", (d) => x(d.idade_media) > iW * 0.75 ? "end" : "start")
      .attr("font-size", 9)
      .attr("font-weight", 600)
      .attr("fill", UI.labelDark)
      .attr("opacity", 0)
      .text(d => d.nome.split(" ")[0])   // primeira palavra do nome
      .transition().delay((_, i) => i * 60 + 300).duration(200)
      .attr("opacity", 1);

    // Tooltip nativo SVG com nome completo + detalhes
    dots.append("title")
      .text(d => `${d.nome}\n${d.n} aeronaves · ${d.idade_media} anos de idade média`);

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-frota-fabricantes" className="w-full" />
    </div>
  );
}
