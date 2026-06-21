"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { OcorrenciaResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function OcorrenciasFaseWaffle({ data }: { data: OcorrenciaResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.por_fase?.length) return;

    const items = [...data.por_fase]
      .filter(d => d.fase && d.fase !== "DESCONHECIDA")
      .sort((a, b) => b.n - a.n)
      .slice(0, expanded ? 14 : 10)
      .map((d, i) => ({ ...d, color: paletteColor(i) }));

    const W      = wrap.current.clientWidth;
    const COLS   = expanded ? 40 : 30;
    const CELL   = Math.floor((W - 155) / COLS);
    const GAP    = 1;
    const LEG_W  = 150;
    const MT     = 8;

    const total    = d3.sum(items, d => d.n);
    const unitSize = Math.ceil(total / (COLS * (expanded ? 16 : 10)));

    const cells: { color: string; fase: string; n: number }[] = [];
    for (const item of items) {
      const count = Math.round(item.n / unitSize);
      for (let k = 0; k < count; k++) cells.push({ color: item.color, fase: item.fase, n: item.n });
    }

    const ROWS = Math.ceil(cells.length / COLS);
    const gridH = ROWS * (CELL + GAP);
    const H     = gridH + MT + 4;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H + 12);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(0,${MT})`);

    const rects = g.selectAll("rect.cell")
      .data(cells)
      .enter().append("rect")
      .attr("class", "cell")
      .attr("x", (_, i) => (i % COLS) * (CELL + GAP))
      .attr("y", (_, i) => Math.floor(i / COLS) * (CELL + GAP))
      .attr("width", CELL).attr("height", CELL)
      .attr("rx", 1).attr("fill", d => d.color)
      .attr("opacity", 0);

    rects.append("title").text(d => `${d.fase}\n${d.n.toLocaleString("pt-BR")} ocorrências`);

    rects.transition().duration(300)
      .delay((_, i) => Math.floor(i / COLS) * 18 + (i % COLS) * 4)
      .attr("opacity", 0.88);

    const legX   = COLS * (CELL + GAP) + 12;
    const legG   = svg.append("g").attr("transform", `translate(${legX},${MT})`);
    const legRowH = Math.min((H - MT) / items.length, expanded ? 28 : 22);

    items.forEach((d, i) => {
      const rowY = i * legRowH;
      legG.append("rect")
        .attr("x", 0).attr("y", rowY + legRowH / 2 - 5)
        .attr("width", 10).attr("height", 10).attr("rx", 2)
        .attr("fill", d.color);

      const maxChars = Math.floor((LEG_W - 48) / 6);
      const lbl = d.fase.length > maxChars ? d.fase.slice(0, maxChars - 1) + "…" : d.fase;
      legG.append("text")
        .attr("x", 14).attr("y", rowY + legRowH / 2 + 4)
        .attr("font-size", expanded ? 9 : 8).attr("fill", UI.labelDark)
        .text(lbl)
        .append("title").text(`${d.fase} — ${d.n.toLocaleString("pt-BR")} ocorrências`);

      legG.append("text")
        .attr("x", LEG_W - 2).attr("y", rowY + legRowH / 2 + 4)
        .attr("text-anchor", "end")
        .attr("font-size", expanded ? 9 : 8).attr("font-weight", 700)
        .attr("fill", d.color)
        .text(d.n.toLocaleString("pt-BR"));
    });

    svg.append("text")
      .attr("x", 0).attr("y", H + 10)
      .attr("font-size", 7.5).attr("fill", UI.labelDim)
      .text(`Cada quadrado ≈ ${unitSize.toLocaleString("pt-BR")} ocorrências`);

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ocorr-fase" className="w-full" />
    </div>
  );
}
