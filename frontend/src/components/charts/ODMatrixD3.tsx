"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { ODMatrixData } from "@/lib/types";

const GOLD = "#C89600";

interface Tip { x: number; y: number; html: string }

export default function ODMatrixD3({ data }: { data: ODMatrixData }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    if (!ref.current || !wrap.current || !data || !data.airports.length) return;
    const W  = wrap.current.clientWidth;
    const n  = data.airports.length;
    const ML = 48, MR = 90, MT = 60, MB = 10;
    const cell = Math.floor((W - ML - MR) / n);
    const H = n * cell + MT + MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const zMax = d3.max(data.z.flat()) ?? 1;
    const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, zMax]);

    // Collect all non-zero cells for top-20 labels
    const allCells: { i: number; j: number; val: number }[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val = data.z[i][j];
        if (val > 0) allCells.push({ i, j, val });
      }
    }
    const top20 = new Set(
      [...allCells].sort((a, b) => b.val - a.val).slice(0, 20).map(c => `${c.i},${c.j}`)
    );

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val = data.z[i][j];
        g.append("rect")
          .attr("x", j * cell + 1).attr("y", i * cell + 1)
          .attr("width", cell - 2).attr("height", cell - 2)
          .attr("rx", 2)
          .attr("fill", val > 0 ? colorScale(val) : "#F8FAFC")
          .on("mousemove", (ev: MouseEvent) => {
            if (val <= 0) return;
            setTip({
              x: ev.clientX + 12, y: ev.clientY - 8,
              html: `<b>${data.airports[i]} → ${data.airports[j]}</b><br/>${val.toFixed(2)} M passageiros`,
            });
          })
          .on("mouseleave", () => setTip(null));

        // Value label on top-20 cells
        if (top20.has(`${i},${j}`) && cell >= 18) {
          const textColor = val / zMax > 0.55 ? "white" : "#1E3A5F";
          const label = val >= 1 ? val.toFixed(1) : (val * 1000).toFixed(0) + "K";
          g.append("text")
            .attr("x", j * cell + cell / 2).attr("y", i * cell + cell / 2 + 3.5)
            .attr("text-anchor", "middle")
            .attr("font-size", Math.max(7, Math.min(10, cell * 0.38)))
            .attr("font-weight", 600)
            .attr("fill", textColor)
            .attr("pointer-events", "none")
            .text(label);
        }
      }
    }

    // Gold highlight for reference airport row and column
    if (data.aeroporto_idx >= 0) {
      const i = data.aeroporto_idx;
      g.append("rect")
        .attr("x", -1).attr("y", i * cell - 1)
        .attr("width", n * cell + 2).attr("height", cell + 2)
        .attr("fill", "none").attr("stroke", GOLD).attr("stroke-width", 2).attr("rx", 2)
        .attr("pointer-events", "none");
      g.append("rect")
        .attr("x", i * cell - 1).attr("y", -1)
        .attr("width", cell + 2).attr("height", n * cell + 2)
        .attr("fill", "none").attr("stroke", GOLD).attr("stroke-width", 2).attr("rx", 2)
        .attr("pointer-events", "none");
    }

    // Row labels (left)
    for (let i = 0; i < n; i++) {
      g.append("text").attr("x", -5).attr("y", i * cell + cell / 2 + 3.5)
        .attr("text-anchor", "end").attr("font-size", 9).attr("fill", "#334155")
        .attr("font-weight", i === data.aeroporto_idx ? 700 : 400)
        .text(data.airports[i]);
    }

    // Column labels (top) — rotate -45°
    for (let i = 0; i < n; i++) {
      g.append("text")
        .attr("transform", `translate(${i * cell + cell / 2 + 3},${-6})rotate(-45)`)
        .attr("text-anchor", "start").attr("font-size", 9).attr("fill", "#334155")
        .attr("font-weight", i === data.aeroporto_idx ? 700 : 400)
        .text(data.airports[i]);
    }

    // Color bar
    const barH = n * cell;
    const barX = n * cell + 14;
    const barScale = d3.scaleLinear().domain([0, zMax]).range([barH, 0]);
    const defs = svg.append("defs");
    const barGrad = defs.append("linearGradient")
      .attr("id", "od-cbar").attr("x1", "0%").attr("x2", "0%").attr("y1", "100%").attr("y2", "0%");
    d3.range(10).forEach(i => {
      barGrad.append("stop")
        .attr("offset", `${i * 10}%`)
        .attr("stop-color", colorScale(zMax * i / 9));
    });
    const barG = g.append("g").attr("transform", `translate(${barX},0)`);
    barG.append("rect").attr("width", 12).attr("height", barH)
      .attr("fill", "url(#od-cbar)").attr("rx", 2);
    barG.append("g").attr("transform", "translate(16,0)")
      .call(d3.axisRight(barScale).ticks(4).tickFormat(v => {
        const n = +v;
        return n < 1 ? `${(n * 1000).toFixed(0)}K` : `${n.toFixed(1)}M`;
      }))
      .call(g2 => g2.select(".domain").remove())
      .call(g2 => g2.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"))
      .call(g2 => g2.selectAll("line").remove());
  }, [data]);

  return (
    <div ref={wrap} className="w-full relative">
      <svg ref={ref} id="chart-od" className="w-full overflow-visible" />
      {tip && (
        <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }}
          dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}
    </div>
  );
}
