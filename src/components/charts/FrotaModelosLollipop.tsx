"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { FrotaModelo } from "@/lib/types";
import { UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

// Verde → amarelo → vermelho conforme idade média
const AGE_COLOR = d3.scaleThreshold<number, string>()
  .domain([8, 18])
  .range(["#0E7B6E", "#C89600", "#B83232"]);

function ageLabel(anos: number | null): string {
  if (anos == null) return "";
  if (anos < 8)  return "frota nova";
  if (anos < 18) return "frota média";
  return "frota antiga";
}

export default function FrotaModelosLollipop({ data }: { data: FrotaModelo[] }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.length) return;
    const items = [...data].slice(0, expanded ? 16 : 8);
    const W  = wrap.current.clientWidth;
    const ML = 90, MR = 110, MT = 8, MB = 26;
    const H  = items.length * (expanded ? 40 : 26) + MT + MB + 8;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const xMax = (d3.max(items, d => d.n) ?? 1) * 1.18;
    const x = d3.scaleLinear().domain([0, xMax]).range([0, iW]);
    const y = d3.scaleBand().domain(items.map(d => d.modelo)).range([0, iH]).padding(0.38);
    const cy = (d: FrotaModelo) => y(d.modelo)! + y.bandwidth() / 2;

    // Grid
    g.append("g")
      .call(d3.axisTop(x).ticks(4).tickSize(-iH).tickFormat(() => ""))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", UI.grid));

    // Linha do lollipop (x=0 → x=valor), animada
    g.selectAll("line.stem")
      .data(items)
      .enter().append("line")
      .attr("class", "stem")
      .attr("x1", 0).attr("x2", 0)
      .attr("y1", d => cy(d)).attr("y2", d => cy(d))
      .attr("stroke", d => AGE_COLOR(d.idade_media ?? 0))
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.55)
      .transition().duration(500).delay((_, i) => i * 55)
      .attr("x2", d => x(d.n));

    // Círculo no fim da linha
    g.selectAll("circle.dot")
      .data(items)
      .enter().append("circle")
      .attr("cx", 0)
      .attr("cy", d => cy(d))
      .attr("r", 6)
      .attr("fill", d => AGE_COLOR(d.idade_media ?? 0))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .transition().duration(500).delay((_, i) => i * 55)
      .attr("cx", d => x(d.n));

    // Tooltip nativo
    g.selectAll("title.tip")
      .data(items)
      .enter().append("title")
      .text(d => `${d.modelo}${d.fabricante ? " — " + d.fabricante : ""}\n${d.n} aeronaves · ${d.idade_media ?? "?"} anos · ${ageLabel(d.idade_media)}`);

    // Valor numérico à direita do círculo
    g.selectAll("text.val")
      .data(items)
      .enter().append("text")
      .attr("class", "val")
      .attr("x", d => x(d.n) + 10)
      .attr("y", d => cy(d) + 4)
      .attr("font-size", 10).attr("font-weight", 700)
      .attr("fill", UI.labelDark)
      .attr("opacity", 0)
      .text(d => d.n)
      .transition().delay((_, i) => i * 55 + 300).duration(150)
      .attr("opacity", 1);

    // Idade média após o valor
    g.selectAll("text.idade")
      .data(items)
      .enter().append("text")
      .attr("class", "idade")
      .attr("x", d => x(d.n) + 10 + String(d.n).length * 7 + 2)
      .attr("y", d => cy(d) + 4)
      .attr("font-size", 9).attr("font-style", "italic")
      .attr("fill", d => AGE_COLOR(d.idade_media ?? 0))
      .attr("opacity", 0)
      .text(d => d.idade_media != null ? `${d.idade_media} anos` : "")
      .transition().delay((_, i) => i * 55 + 300).duration(150)
      .attr("opacity", 1);

    // Y axis (nomes dos modelos)
    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text")
        .attr("font-size", 10).attr("fill", UI.labelDark).attr("dx", -4))
      .selectAll("text")
      .append("title")
      .text(d => {
        const it = items.find(i => i.modelo === d);
        return it?.fabricante ? `${it.modelo} — ${it.fabricante}` : String(d);
      });

    // X axis
    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(4))
      .call(s => s.select(".domain").attr("stroke", UI.axisDomain))
      .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", UI.axisText));

    // Legenda de cores de idade
    const legendData = [
      { label: "< 8 anos",  color: "#0E7B6E" },
      { label: "8–18 anos", color: "#C89600" },
      { label: "> 18 anos", color: "#B83232" },
    ];
    const lx = W - MR + 8;
    legendData.forEach((d, i) => {
      svg.append("circle")
        .attr("cx", lx + 5).attr("cy", MT + 10 + i * 16)
        .attr("r", 5).attr("fill", d.color);
      svg.append("text")
        .attr("x", lx + 14).attr("y", MT + 14 + i * 16)
        .attr("font-size", 8).attr("fill", UI.labelDim)
        .text(d.label);
    });
  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-frota-modelos" className="w-full" />
    </div>
  );
}
