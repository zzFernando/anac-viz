"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { AdsResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function AdsWaffle({ data }: { data: AdsResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ro = new ResizeObserver(() => setTick(t => t + 1));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_sistemas?.length) return;

    const items = [...data.top_sistemas]
      .sort((a, b) => b.n - a.n)
      .slice(0, expanded ? 16 : 10)
      .map((d, i) => ({ ...d, color: paletteColor(i) }));

    const W       = wrap.current.clientWidth;
    const LEG_W   = 158;
    const GAP     = 1;
    const MT      = 8;
    const gridW   = W - LEG_W - 12;
    // Usa a altura real do container (preenchida pelo flex-1 do SectionCard)
    // com fallback para valores razoáveis
    const containerH = wrap.current.clientHeight;
    const targetH = containerH > 40
      ? containerH - 28          // subtrai label "▪ = 1 regra" + margem
      : expanded ? 280 : 160;

    // Total de regras = total de células
    const total = d3.sum(items, d => d.n);

    // Maior CELL que cabe total células em gridW × targetH
    // COLS = floor(gridW / (CELL+GAP)), ROWS = ceil(total/COLS)
    // Queremos ROWS*(CELL+GAP) <= targetH → resolve iterando de grande pra pequeno
    let CELL = Math.max(2, Math.floor(Math.sqrt((gridW * targetH) / total)));
    let COLS = Math.floor(gridW / (CELL + GAP));
    let ROWS = Math.ceil(total / Math.max(1, COLS));
    // Ajusta se ainda não couber na altura
    while (ROWS * (CELL + GAP) > targetH && CELL > 2) {
      CELL--;
      COLS = Math.floor(gridW / (CELL + GAP));
      ROWS = Math.ceil(total / Math.max(1, COLS));
    }

    // 1 célula por regra, na ordem maior→menor
    const cells: { color: string; sistema: string; n: number }[] = [];
    for (const item of items) {
      for (let k = 0; k < item.n; k++) {
        cells.push({ color: item.color, sistema: item.sistema, n: item.n });
      }
    }

    ROWS = Math.ceil(cells.length / COLS);
    const gridH = ROWS * (CELL + GAP);
    const H     = gridH + MT + 16;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H + 4);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(0,${MT})`);

    // Preenchimento por coluna: cima→baixo, depois próxima coluna à direita
    const rects = g.selectAll("rect.cell")
      .data(cells)
      .enter().append("rect")
      .attr("class", "cell")
      .attr("x", (_, i) => Math.floor(i / ROWS) * (CELL + GAP))
      .attr("y", (_, i) => (i % ROWS) * (CELL + GAP))
      .attr("width", CELL).attr("height", CELL)
      .attr("rx", 0.5)
      .attr("fill", d => d.color)
      .attr("opacity", 0);

    rects.append("title")
      .text(d => `${d.sistema} — 1 regra vigente`);

    // Animação por coluna
    rects.transition().duration(200)
      .delay((_, i) => Math.floor(i / ROWS) * 6)
      .attr("opacity", 0.88);

    // Legenda lateral
    const legX    = COLS * (CELL + GAP) + 12;
    const legG    = svg.append("g").attr("transform", `translate(${legX},${MT})`);
    const legRowH = Math.min((H - MT) / items.length, expanded ? 26 : 20);

    items.forEach((d, i) => {
      const rowY = i * legRowH;

      legG.append("rect")
        .attr("x", 0).attr("y", rowY + legRowH / 2 - 5)
        .attr("width", 10).attr("height", 10).attr("rx", 2)
        .attr("fill", d.color);

      const maxChars = Math.floor((LEG_W - 52) / 6);
      const label = d.sistema.length > maxChars
        ? d.sistema.slice(0, maxChars - 1) + "…"
        : d.sistema;

      legG.append("text")
        .attr("x", 14).attr("y", rowY + legRowH / 2 + 4)
        .attr("font-size", expanded ? 9 : 8).attr("fill", UI.labelDark)
        .text(label)
        .append("title").text(`${d.sistema} — ${d.n.toLocaleString("pt-BR")} regras`);

      legG.append("text")
        .attr("x", LEG_W - 2).attr("y", rowY + legRowH / 2 + 4)
        .attr("text-anchor", "end")
        .attr("font-size", expanded ? 9 : 8).attr("font-weight", 700)
        .attr("fill", d.color)
        .text(d.n.toLocaleString("pt-BR"));
    });

    svg.append("text")
      .attr("x", 0).attr("y", H + 2)
      .attr("font-size", 7.5).attr("fill", UI.labelDim)
      .text("▪ = 1 regra vigente");

  }, [data, expanded, tick]);


  return (
    <div ref={wrap} className="w-full h-full">
      <svg ref={ref} id="chart-ads" className="w-full" style={{ display: "block" }} />
    </div>
  );
}
