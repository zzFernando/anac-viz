"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { AdsResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

/** Quebra texto em linhas que cabem dentro de um círculo de raio r.
 *  Usa a corda real em cada posição vertical para calcular maxWidth. */
function wrapInCircle(
  words: string[],
  r: number,
  fontSize: number,
  maxLines = 3,
): string[] {
  const charW  = fontSize * 0.55;   // largura média por caractere
  const lineH  = fontSize * 1.3;
  const lines: string[] = [];
  let cur = "";

  for (const word of words) {
    const lineIdx = lines.length;
    if (lineIdx >= maxLines) break;
    // corda no centro desta linha (y relativo ao centro do círculo)
    const yOffset = (lineIdx - (maxLines - 1) / 2) * lineH;
    const chord   = 2 * Math.sqrt(Math.max(0, r * r - yOffset * yOffset)) * 0.88;
    const maxChars = Math.floor(chord / charW);

    const candidate = cur ? `${cur} ${word}` : word;
    if (candidate.length <= maxChars) {
      cur = candidate;
    } else {
      if (cur) { lines.push(cur); cur = ""; }
      // próxima linha
      const nextIdx   = lines.length;
      const yOff2     = (nextIdx - (maxLines - 1) / 2) * lineH;
      const chord2    = 2 * Math.sqrt(Math.max(0, r * r - yOff2 * yOff2)) * 0.88;
      const maxChars2 = Math.floor(chord2 / charW);
      cur = word.length > maxChars2 ? word.slice(0, maxChars2 - 1) + "…" : word;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

export default function AdsPackedBubbles({ data }: { data: AdsResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_sistemas?.length) return;

    const items = data.top_sistemas.slice(0, expanded ? 20 : 14).map((d, i) => ({
      ...d,
      full:  d.sistema,
      color: paletteColor(i),
    }));

    const W = wrap.current.clientWidth;
    const H = expanded ? 700 : 480;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    // clipPath defs — um por bolha para cortar texto que sai da borda
    const defs = svg.append("defs");

    const root = d3.hierarchy({ children: items } as any).sum((d: any) => d.n ?? 0);
    d3.pack<any>().size([W - 4, H - 4]).padding(5)(root);

    const leaves = root.leaves();

    // Registra clipPaths antes de criar os nós
    leaves.forEach((d: any, i: number) => {
      defs.append("clipPath")
        .attr("id", `ads-clip-${i}`)
        .append("circle")
        .attr("r", d.r * 0.92);   // margem interna de 8%
    });

    const node = svg.selectAll("g.node")
      .data(leaves)
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => `translate(${d.x + 2},${d.y + 2})`);

    // Círculo
    node.append("circle")
      .attr("r", 0)
      .attr("fill", (d: any) => d.data.color)
      .attr("opacity", 0.85)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .transition().duration(550).delay((_, i) => i * 35)
      .ease(d3.easeCubicOut)
      .attr("r", (d: any) => d.r);

    // Tooltip nativo
    node.append("title")
      .text((d: any) => `${d.data.full}\n${d.data.n.toLocaleString("pt-BR")} regras vigentes`);

    // Labels — só bolhas grandes o suficiente para ter pelo menos 1 palavra
    node.filter((d: any) => d.r > (expanded ? 20 : 16))
      .each(function(d: any, i: number) {
        const r        = d.r;
        const fontSize = Math.min(Math.max(r * 0.26, 7.5), expanded ? 12 : 10.5);
        const lineH    = fontSize * 1.3;
        const hasVal   = r > (expanded ? 34 : 27);
        const maxLines = hasVal ? 3 : 3;

        const lines = wrapInCircle(d.data.full.split(" "), r * 0.9, fontSize, maxLines);
        const totalRows = lines.length + (hasVal ? 1 : 0);
        const blockH    = totalRows * lineH;
        const startY    = -blockH / 2 + lineH * 0.75;

        const g = d3.select(this).append("g")
          .attr("clip-path", `url(#ads-clip-${i})`)
          .attr("pointer-events", "none");

        const text = g.append("text").attr("text-anchor", "middle").attr("fill", "#fff");

        lines.forEach((line, li) => {
          text.append("tspan")
            .attr("x", 0).attr("y", startY + li * lineH)
            .attr("font-size", fontSize).attr("font-weight", 700)
            .text(line);
        });

        if (hasVal) {
          text.append("tspan")
            .attr("x", 0).attr("y", startY + lines.length * lineH)
            .attr("font-size", fontSize * 0.82)
            .attr("fill", "rgba(255,255,255,0.72)")
            .attr("font-weight", 400)
            .text(d.data.n.toLocaleString("pt-BR"));
        }
      });

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ads" className="w-full" />
    </div>
  );
}
