"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { AdsResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

// Avião simples virado para a direita
const PLANE_PATH = "M-6,0 L4,-3 L6,0 L4,3 Z M-6,-2 L0,0 L-6,2 Z M-1,-4 L2,0 L-1,4 Z";

export default function AdsPictogram({ data }: { data: AdsResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_sistemas?.length) return;

    const items = data.top_sistemas.slice(0, expanded ? 14 : 10).map((d, i) => ({
      ...d, color: paletteColor(i),
    }));

    const W      = wrap.current.clientWidth;
    const ML     = 200;
    const rowH   = expanded ? 38 : 30;
    const iconSz = expanded ? 11 : 9;   // escala do ícone
    const iconW  = iconSz * 2 + 2;      // largura efetiva por ícone
    const MT     = 8, MB = 24;
    const availW = W - ML - 8;
    const maxIcons = Math.floor(availW / iconW);

    const total    = d3.sum(items, d => d.n);
    const maxN     = d3.max(items, d => d.n) ?? 1;
    // cada ícone representa: escala proporcional ao max com maxIcons colunas
    const unitSize = Math.ceil(maxN / maxIcons);

    const H = items.length * rowH + MT + MB;
    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    items.forEach((item, row) => {
      const count = Math.max(1, Math.round(item.n / unitSize));
      const cy    = MT + row * rowH + rowH / 2;

      // Label à esquerda
      const MAX_LBL = Math.floor((ML - 10) / 6.0);
      const lbl = item.sistema.length > MAX_LBL
        ? item.sistema.slice(0, MAX_LBL - 1) + "…"
        : item.sistema;

      svg.append("text")
        .attr("x", ML - 8).attr("y", cy + 4)
        .attr("text-anchor", "end")
        .attr("font-size", expanded ? 9 : 8)
        .attr("fill", UI.labelDark)
        .text(lbl)
        .append("title").text(item.sistema);

      // Grupo de ícones por linha
      const rowG = svg.append("g");

      const paths = rowG.selectAll("path")
        .data(d3.range(count))
        .enter().append("path")
        .attr("d", PLANE_PATH)
        .attr("transform", (_, j) =>
          `translate(${ML + j * iconW + iconW / 2}, ${cy}) scale(${iconSz / 8})`)
        .attr("fill", item.color)
        .attr("opacity", 0);

      // Tooltip no grupo
      paths.append("title")
        .text(`${item.sistema}\n${item.n.toLocaleString("pt-BR")} regras (1 ✈ ≈ ${unitSize} regras)`);

      // Animação
      paths.transition()
        .duration(250)
        .delay((_, j) => j * 12 + row * 35)
        .attr("opacity", 0.88);

      // Valor numérico após os ícones
      svg.append("text")
        .attr("x", ML + count * iconW + 6)
        .attr("y", cy + 4)
        .attr("font-size", expanded ? 9 : 8)
        .attr("font-weight", 700)
        .attr("fill", item.color)
        .attr("opacity", 0)
        .text(item.n.toLocaleString("pt-BR"))
        .transition()
        .delay(count * 12 + row * 35 + 150)
        .duration(150)
        .attr("opacity", 1);
    });

    // Nota de escala
    svg.append("text")
      .attr("x", ML).attr("y", H - 6)
      .attr("font-size", 7.5).attr("fill", UI.labelDim)
      .text(`✈ ≈ ${unitSize.toLocaleString("pt-BR")} regras vigentes`);

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ads" className="w-full" />
    </div>
  );
}
