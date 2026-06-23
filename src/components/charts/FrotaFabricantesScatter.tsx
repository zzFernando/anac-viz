"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { FrotaFabricante } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";
import { useTheme } from "@/lib/themeContext";

interface LabelLayout extends FrotaFabricante {
  lx: number;
  ly: number;
  anchor: "start" | "end";
}

function spreadLabels(labels: LabelLayout[], minY: number, maxY: number, minGap = 14) {
  const sorted = [...labels].sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].ly - sorted[i - 1].ly < minGap) {
      sorted[i].ly = sorted[i - 1].ly + minGap;
    }
  }

  const overflow = sorted.at(-1)?.ly != null ? sorted.at(-1)!.ly - maxY : 0;
  if (overflow > 0) sorted.forEach(label => { label.ly -= overflow; });

  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i + 1].ly - sorted[i].ly < minGap) {
      sorted[i].ly = sorted[i + 1].ly - minGap;
    }
  }

  const underflow = sorted[0]?.ly != null ? minY - sorted[0].ly : 0;
  if (underflow > 0) sorted.forEach(label => { label.ly += underflow; });
}

export default function FrotaFabricantesScatter({ data }: { data: FrotaFabricante[] }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();
  const { theme } = useTheme();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.length) return;
    const isDark = theme === "dark";
    const dotStroke = isDark ? "#E2E8F0" : "#fff";
    const labelStroke = isDark ? "#1E293B" : "#fff";
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
      .attr("stroke", dotStroke)
      .attr("stroke-width", 1.5)
      .style("cursor", "default");

    dots.transition().duration(500).delay((_, i) => i * 60)
      .attr("r", 7);

    const labels: LabelLayout[] = items.map((item) => {
      const cx = x(item.idade_media);
      const anchor = cx > iW * 0.55 ? "end" : "start";
      return {
        ...item,
        anchor,
        lx: anchor === "end" ? cx - 10 : cx + 10,
        ly: y(item.n) + 4,
      };
    });
    spreadLabels(labels.filter(label => label.anchor === "start"), 10, iH - 8);
    spreadLabels(labels.filter(label => label.anchor === "end"), 10, iH - 8);

    // Labels com posicionamento inteligente (evita sobreposição simples)
    g.selectAll("text.lbl")
      .data(labels)
      .enter().append("text")
      .attr("class", "lbl")
      .attr("x", d => d.lx)
      .attr("y", d => d.ly)
      .attr("text-anchor", d => d.anchor)
      .attr("font-size", 9)
      .attr("font-weight", 600)
      .attr("fill", UI.labelDark)
      .attr("stroke", labelStroke)
      .attr("stroke-width", 3)
      .attr("stroke-linejoin", "round")
      .attr("paint-order", "stroke")
      .attr("opacity", 0)
      .text(d => d.nome.split(" ")[0])   // primeira palavra do nome
      .transition().delay((_, i) => i * 60 + 300).duration(200)
      .attr("opacity", 1);

    // Tooltip nativo SVG com nome completo + detalhes
    dots.append("title")
      .text(d => `${d.nome}\n${d.n} aeronaves · ${d.idade_media} anos de idade média`);

  }, [data, expanded, theme]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-frota-fabricantes" className="w-full" />
    </div>
  );
}
