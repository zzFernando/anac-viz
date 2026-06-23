"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { SdrResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function AtaDonut({ data }: { data: SdrResumo }) {
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
    const innerR = outerR * 0.52;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    const total = d3.sum(items, d => d.n);

    const pie = d3.pie<typeof items[0]>()
      .value(d => d.n)
      .sort(null)
      .padAngle(0.018);

    const arc = d3.arc<d3.PieArcDatum<typeof items[0]>>()
      .innerRadius(innerR)
      .outerRadius(outerR)
      .cornerRadius(3);

    const arcHover = d3.arc<d3.PieArcDatum<typeof items[0]>>()
      .innerRadius(innerR)
      .outerRadius(outerR + 8)
      .cornerRadius(3);

    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    const slices = g.selectAll("path.slice")
      .data(pie(items))
      .enter().append("path")
      .attr("class", "slice")
      .attr("d", arc)
      .attr("fill", d => d.data.color)
      .attr("opacity", 0)
      .style("cursor", "pointer");

    slices.transition().duration(500).delay((_, i) => i * 40)
      .attr("opacity", 0.88);

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

    // Legenda à esquerda
    const rowH    = Math.min(H / items.length, expanded ? 28 : 22);
    const offsetY = (H - items.length * rowH) / 2;
    const fs      = expanded ? 9 : 8;
    const maxChars = Math.floor((LEG - 32) / (fs * 0.6));

    function highlightSlice(idx: number | null) {
      slices.transition().duration(100)
        .attr("opacity", idx === null ? 0.88 : (_, j) => j === idx ? 1 : 0.18)
        .attr("d", (d2, j) => (idx === null ? arc(d2) : j === idx ? arcHover(d2) : arc(d2)) ?? "");
      const item = idx !== null ? items[idx] : null;
      center.select("text.val").text(item ? item.n.toLocaleString("pt-BR") : "");
      center.select("text.pct").text(item ? `${((item.n / total) * 100).toFixed(0)}%` : "");
      center.select("text.lbl").text(item ? (item.nome.length > 14 ? item.nome.slice(0, 13) + "…" : item.nome) : "");
      legRows.transition().duration(100)
        .attr("opacity", idx === null ? 1 : (_, j) => j === idx ? 1 : 0.35);
    }

    slices
      .on("mouseenter", function(_, d) { highlightSlice(items.indexOf(d.data)); })
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
