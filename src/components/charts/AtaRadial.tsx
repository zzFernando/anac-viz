"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { SdrResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function AtaRadial({ data }: { data: SdrResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_ata?.length) return;

    const items = data.top_ata.slice(0, expanded ? 16 : 10).map((d, i) => ({
      ...d,
      color: paletteColor(i),
    }));

    const W    = wrap.current.clientWidth;
    const H    = expanded ? 420 : 280;
    const LEG  = expanded ? 160 : 140;
    const cx   = LEG + (W - LEG) / 2;
    const cy   = H / 2;
    const outerR = Math.min((W - LEG) / 2, cy) - (expanded ? 20 : 14);
    const innerR = outerR * 0.38;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    const total = d3.sum(items, d => d.n);
    const maxN  = d3.max(items, d => d.n) ?? 1;

    const rScale = d3.scaleLinear().domain([0, maxN]).range([innerR, outerR]);
    const angleStep = (2 * Math.PI) / items.length;
    const gap = 0.06;

    const arc = d3.arc<typeof items[0]>()
      .innerRadius(innerR)
      .outerRadius(d => rScale(d.n))
      .startAngle((_, i) => i * angleStep + gap / 2 - Math.PI / 2)
      .endAngle((_, i) => (i + 1) * angleStep - gap / 2 - Math.PI / 2)
      .cornerRadius(3);

    const arcHover = d3.arc<typeof items[0]>()
      .innerRadius(innerR)
      .outerRadius(d => rScale(d.n) + 8)
      .startAngle((_, i) => i * angleStep + gap / 2 - Math.PI / 2)
      .endAngle((_, i) => (i + 1) * angleStep - gap / 2 - Math.PI / 2)
      .cornerRadius(3);

    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    // Círculos de referência
    [0.25, 0.5, 0.75, 1].forEach(pct => {
      g.append("circle")
        .attr("r", innerR + (outerR - innerR) * pct)
        .attr("fill", "none")
        .attr("stroke", pct === 1 ? "#CBD5E1" : "#E2E8F0")
        .attr("stroke-width", pct === 1 ? 1.5 : 1);
    });

    const slices = g.selectAll("path.slice")
      .data(items)
      .enter().append("path")
      .attr("class", "slice")
      .attr("d", (d, i) => arc(d, i) ?? "")
      .attr("fill", d => d.color)
      .attr("opacity", 0.88)
      .style("cursor", "pointer");

    slices
      .attr("transform", "scale(0)")
      .transition().duration(600).delay((_, i) => i * 50)
      .ease(d3.easeCubicOut)
      .attr("transform", "scale(1)");

    // Centro
    const center = g.append("g");
    center.append("text").attr("class", "lbl")
      .attr("text-anchor", "middle").attr("y", -10)
      .attr("font-size", 9).attr("fill", UI.axisText);
    center.append("text").attr("class", "val")
      .attr("text-anchor", "middle").attr("y", 8)
      .attr("font-size", 15).attr("font-weight", 700).attr("fill", UI.textHi);
    center.append("text").attr("class", "pct")
      .attr("text-anchor", "middle").attr("y", 24)
      .attr("font-size", 11).attr("fill", UI.axisText);

    // Legenda
    const rowH    = Math.min(H / items.length, expanded ? 28 : 22);
    const offsetY = (H - items.length * rowH) / 2;
    const fs      = expanded ? 9 : 8;
    const maxChars = Math.floor((LEG - 32) / (fs * 0.6));

    function highlightSlice(idx: number | null) {
      const st = slices.transition().duration(100);
      if (idx === null) {
        st.attr("opacity", 0.88)
          .attr("d", (d2, j) => arc(d2, j) ?? "");
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (st as any)
          .attr("opacity", (_: unknown, j: number) => j === idx ? 1 : 0.18)
          .attr("d", (d2: typeof items[0], j: number) =>
            (j === idx ? arcHover(d2, j) : arc(d2, j)) ?? "");
      }
      const item = idx !== null ? items[idx] : null;
      center.select("text.val").text(item ? item.n.toLocaleString("pt-BR") : "");
      center.select("text.pct").text(item ? `${((item.n / total) * 100).toFixed(0)}%` : "");
      center.select("text.lbl").text(item ? (item.nome.length > 14 ? item.nome.slice(0, 13) + "…" : item.nome) : "");
      const lt = legRows.transition().duration(100);
      if (idx === null) {
        lt.attr("opacity", 1);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (lt as any).attr("opacity", (_: unknown, j: number) => j === idx ? 1 : 0.35);
      }
    }

    slices
      .on("mouseenter", (_, d) => highlightSlice(items.indexOf(d)))
      .on("mouseleave", () => highlightSlice(null));

    const legG = svg.append("g").attr("transform", "translate(0,0)");

    const legRows = legG.selectAll("g.leg-row")
      .data(items)
      .enter().append("g")
      .attr("class", "leg-row")
      .attr("transform", (_, i) => `translate(0, ${offsetY + i * rowH})`)
      .style("cursor", "pointer")
      .on("mouseenter", (_, d) => highlightSlice(items.indexOf(d)))
      .on("mouseleave", () => highlightSlice(null));

    legRows.append("rect")
      .attr("x", 0).attr("y", rowH / 2 - 5)
      .attr("width", 9).attr("height", 9).attr("rx", 2)
      .attr("fill", d => d.color);

    legRows.append("text")
      .attr("x", 13).attr("y", rowH / 2 + 4)
      .attr("font-size", fs).attr("fill", UI.labelDark)
      .text(d => {
        const lbl = `${d.ata} · ${d.nome}`;
        return lbl.length > maxChars ? lbl.slice(0, maxChars - 1) + "…" : lbl;
      })
      .append("title").text(d => `${d.ata} · ${d.nome}`);

    legRows.append("text")
      .attr("x", LEG - 2).attr("y", rowH / 2 + 4)
      .attr("text-anchor", "end")
      .attr("font-size", fs).attr("font-weight", 700)
      .attr("fill", d => d.color)
      .text(d => d.n.toLocaleString("pt-BR"));

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ata" className="w-full" />
    </div>
  );
}
