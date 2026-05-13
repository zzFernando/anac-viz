"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { ScatterData } from "@/lib/types";

interface Tip { x: number; y: number; html: string }

export default function ScatterD3({ data }: { data: ScatterData }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    if (!ref.current || !wrap.current || !data || !data.points.length) return;
    const W = wrap.current.clientWidth;
    const H = 300;
    const ML = 50, MR = 24, MT = 20, MB = 36;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const pts = data.points;
    const xMax = (d3.max(pts, d => d.market_share) ?? 50) * 1.15;
    const yMin = Math.max(30, (d3.min(pts, d => d.pontualidade) ?? 60) - 5);

    const x = d3.scaleLinear().domain([0, xMax]).range([0, iW]);
    const y = d3.scaleLinear().domain([yMin, 100]).range([iH, 0]);

    const mx = data.med_ms, my = data.med_pont;

    // Quadrant fills
    const quad = [
      [0, mx, my, 100, "rgba(34,197,94,0.05)"],
      [mx, xMax, my, 100, "rgba(37,99,235,0.05)"],
      [0, mx, yMin, my, "rgba(251,191,36,0.05)"],
      [mx, xMax, yMin, my, "rgba(220,38,38,0.05)"],
    ] as const;
    for (const [x0, x1, y0, y1, fill] of quad) {
      g.append("rect")
        .attr("x", x(x0)).attr("y", y(y1))
        .attr("width", x(x1)-x(x0)).attr("height", y(y0)-y(y1))
        .attr("fill", fill);
    }

    // Quadrant lines
    g.append("line").attr("x1", x(mx)).attr("x2", x(mx)).attr("y1", 0).attr("y2", iH)
      .attr("stroke", "#CBD5E1").attr("stroke-width", 1).attr("stroke-dasharray", "4,3");
    g.append("line").attr("x1", 0).attr("x2", iW).attr("y1", y(my)).attr("y2", y(my))
      .attr("stroke", "#CBD5E1").attr("stroke-width", 1).attr("stroke-dasharray", "4,3");

    // Quadrant labels
    for (const [qx, qy, label] of [
      [mx * 0.35, my + (100 - my) * 0.75, "pontual · nicho"],
      [mx + (xMax - mx) * 0.45, my + (100 - my) * 0.75, "pontual · dominante"],
      [mx * 0.35, yMin + (my - yMin) * 0.2, "atrasada · nicho"],
      [mx + (xMax - mx) * 0.45, yMin + (my - yMin) * 0.2, "atrasada · dominante"],
    ] as [number, number, string][]) {
      g.append("text").attr("x", x(qx)).attr("y", y(qy))
        .attr("text-anchor", "middle").attr("font-size", 8)
        .attr("fill", "#94A3B8").text(label);
    }

    // Grid
    g.append("g").attr("class", "grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-iW).tickFormat(() => ""))
      .call(g2 => g2.select(".domain").remove())
      .call(g2 => g2.selectAll("line").attr("stroke", "#F1F5F9"));

    // Axes
    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(v => `${v}%`))
      .call(g2 => g2.select(".domain").attr("stroke", "#E2E8F0"))
      .call(g2 => g2.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"));
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(v => `${v}%`))
      .call(g2 => g2.select(".domain").attr("stroke", "#E2E8F0"))
      .call(g2 => g2.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"));

    g.append("text").attr("x", iW/2).attr("y", iH+28)
      .attr("text-anchor","middle").attr("font-size",9).attr("fill","#64748B")
      .text("Market share (%)");
    g.append("text").attr("transform","rotate(-90)")
      .attr("x", -iH/2).attr("y", -38)
      .attr("text-anchor","middle").attr("font-size",9).attr("fill","#64748B")
      .text("Pontualidade (%)");

    const top5 = new Set(pts.slice(0, 5).map(d => d.sig));

    // Bubbles
    g.selectAll("circle.pt")
      .data(pts)
      .enter().append("circle")
      .attr("class", "pt")
      .attr("cx", d => x(d.market_share))
      .attr("cy", d => y(d.pontualidade))
      .attr("r", 8)
      .attr("fill", d => d.color)
      .attr("stroke", "white").attr("stroke-width", 1.5)
      .attr("opacity", 0.88)
      .on("mousemove", (ev: MouseEvent, d) => {
        setTip({
          x: ev.clientX + 12, y: ev.clientY - 8,
          html: `<b>${d.label}</b><br>Market share: ${d.market_share.toFixed(1)}%<br>Pontualidade: ${d.pontualidade.toFixed(1)}%`,
        });
      })
      .on("mouseleave", () => setTip(null));

    // Labels for top 5
    g.selectAll("text.lbl")
      .data(pts.filter(d => top5.has(d.sig)))
      .enter().append("text")
      .attr("class", "lbl")
      .attr("x", d => x(d.market_share))
      .attr("y", d => y(d.pontualidade) - 11)
      .attr("text-anchor", "middle").attr("font-size", 9).attr("font-weight", 600)
      .attr("fill", d => d.color)
      .text(d => d.label);
  }, [data]);

  return (
    <div ref={wrap} className="w-full relative">
      <svg ref={ref} id="chart-scatter" className="w-full" />
      {tip && (
        <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }}
          dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}
    </div>
  );
}
