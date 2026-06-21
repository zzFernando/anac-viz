"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { SdrResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function AtaWaffle({ data }: { data: SdrResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_ata?.length) return;

    const items = data.top_ata.slice(0, expanded ? 16 : 10).map((d, i) => ({
      ...d,
      label: `${d.ata} · ${d.nome}`,
      color: paletteColor(i),
    }));

    const W      = wrap.current.clientWidth;
    const COLS   = expanded ? 50 : 40;
    const CELL   = Math.floor((W - 165) / COLS);
    const GAP    = 1;
    const LEG_W  = 160;
    const MT     = 8;

    const total    = d3.sum(items, d => d.n);
    const unitSize = Math.ceil(total / (COLS * (expanded ? 18 : 12)));

    const cells: { color: string; label: string; n: number }[] = [];
    for (const item of items) {
      const count = Math.round(item.n / unitSize);
      for (let k = 0; k < count; k++) cells.push({ color: item.color, label: item.label, n: item.n });
    }

    const ROWS = Math.ceil(cells.length / COLS);
    const gridH = ROWS * (CELL + GAP);
    const H     = gridH + MT + 4;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H + 12);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(0,${MT})`);

    g.selectAll("rect.cell")
      .data(cells)
      .enter().append("rect")
      .attr("class", "cell")
      .attr("x", (_, i) => (i % COLS) * (CELL + GAP))
      .attr("y", (_, i) => Math.floor(i / COLS) * (CELL + GAP))
      .attr("width", CELL).attr("height", CELL)
      .attr("rx", 1).attr("fill", d => d.color)
      .attr("opacity", 0);

    g.selectAll("rect.cell")
      .append("title").text((d: any) => `${d.label}\n${d.n.toLocaleString("pt-BR")} relatos`);

    g.selectAll("rect.cell")
      .transition().duration(300)
      .delay((_, i) => Math.floor(i / COLS) * 18 + (i % COLS) * 4)
      .attr("opacity", 0.88);

    // Legenda lateral
    const legX   = COLS * (CELL + GAP) + 12;
    const legG   = svg.append("g").attr("transform", `translate(${legX},${MT})`);
    const legRowH = Math.min((H - MT) / items.length, expanded ? 26 : 20);

    items.forEach((d, i) => {
      const rowY = i * legRowH;
      legG.append("rect")
        .attr("x", 0).attr("y", rowY + legRowH / 2 - 5)
        .attr("width", 10).attr("height", 10).attr("rx", 2)
        .attr("fill", d.color);

      const maxChars = Math.floor((LEG_W - 52) / 6);
      const lbl = d.label.length > maxChars ? d.label.slice(0, maxChars - 1) + "…" : d.label;
      legG.append("text")
        .attr("x", 14).attr("y", rowY + legRowH / 2 + 4)
        .attr("font-size", expanded ? 9 : 8).attr("fill", UI.labelDark)
        .text(lbl)
        .append("title").text(`${d.label} — ${d.n.toLocaleString("pt-BR")} relatos`);

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
      .text(`Cada quadrado ≈ ${unitSize.toLocaleString("pt-BR")} relatos`);

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ata" className="w-full" />
    </div>
  );
}
