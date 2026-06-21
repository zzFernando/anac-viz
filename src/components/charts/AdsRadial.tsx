"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { AdsResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

export default function AdsRadial({ data }: { data: AdsResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.top_sistemas?.length) return;

    const items = data.top_sistemas
      .slice(0, expanded ? 14 : 10)
      .sort((a, b) => b.n - a.n)
      .map((d, i) => ({ ...d, color: paletteColor(i) }));

    const W      = wrap.current.clientWidth;
    const H      = expanded ? 520 : 300;
    const cx     = W / 2, cy = H / 2;
    const outerR = Math.min(cx, cy) - (expanded ? 80 : 60);
    const innerR = outerR * 0.25;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    const maxN      = d3.max(items, d => d.n) ?? 1;
    const total     = d3.sum(items, d => d.n);
    const angleStep = (2 * Math.PI) / items.length;
    const gap       = 0.06;
    const rScale    = d3.scaleLinear().domain([0, maxN]).range([innerR, outerR]);

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
    [0.33, 0.66, 1].forEach(pct => {
      g.append("circle")
        .attr("r", innerR + (outerR - innerR) * pct)
        .attr("fill", "none").attr("stroke", UI.grid).attr("stroke-dasharray", "3,3");
    });

    // Fatias
    const slices = g.selectAll("path.slice")
      .data(items).enter().append("path")
      .attr("d", (d, i) => arc(d, i) ?? "")
      .attr("fill", d => d.color).attr("opacity", 0.88)
      .style("cursor", "pointer")
      .attr("transform", "scale(0)")
      .transition().duration(600).delay((_, i) => i * 50).ease(d3.easeCubicOut)
      .attr("transform", "scale(1)");

    // Centro interativo
    const center = g.append("g");
    center.append("text").attr("class", "lbl")
      .attr("text-anchor", "middle").attr("y", -10)
      .attr("font-size", 8).attr("fill", UI.axisText).text("hover para ver");
    center.append("text").attr("class", "val")
      .attr("text-anchor", "middle").attr("y", 8)
      .attr("font-size", 14).attr("font-weight", 700).attr("fill", UI.textHi);
    center.append("text").attr("class", "pct")
      .attr("text-anchor", "middle").attr("y", 22)
      .attr("font-size", 10).attr("fill", UI.axisText);

    g.selectAll("path.slice")
      .on("mouseenter", function(_, d: any) {
        d3.select(this).raise().transition().duration(120)
          .attr("d", (d2: any, i2: number) => arcHover(d2, items.indexOf(d2)) ?? "");
        center.select("text.val").text(d.n.toLocaleString("pt-BR"));
        center.select("text.pct").text(`${((d.n / total) * 100).toFixed(0)}%`);
        const short = d.sistema.length > 16 ? d.sistema.slice(0, 15) + "…" : d.sistema;
        center.select("text.lbl").text(short);
      })
      .on("mouseleave", function(_, d: any) {
        d3.select(this).transition().duration(120)
          .attr("d", (d2: any) => arc(d2, items.indexOf(d2)) ?? "");
        center.select("text.val").text("");
        center.select("text.pct").text("");
        center.select("text.lbl").text("hover para ver");
      });

    // Labels externos
    items.forEach((d, i) => {
      const mid  = (i + 0.5) * angleStep - Math.PI / 2;
      const lr   = rScale(d.n) + (expanded ? 20 : 14);
      const lx   = Math.cos(mid) * lr, ly = Math.sin(mid) * lr;
      const anc  = Math.abs(lx) < 8 ? "middle" : lx > 0 ? "start" : "end";
      const words = d.sistema.split(" ").slice(0, 3).join(" ");
      const short = words.length > 14 ? words.slice(0, 13) + "…" : words;

      g.append("text").attr("x", lx).attr("y", ly - 2)
        .attr("text-anchor", anc).attr("font-size", expanded ? 8.5 : 7.5)
        .attr("font-weight", 600).attr("fill", UI.labelDark).text(short)
        .append("title").text(d.sistema);

      g.append("text").attr("x", lx).attr("y", ly + 10)
        .attr("text-anchor", anc).attr("font-size", expanded ? 8 : 7)
        .attr("fill", d.color).text(d.n.toLocaleString("pt-BR"));
    });

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ads" className="w-full" />
    </div>
  );
}
