"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { SerieData } from "@/lib/types";

const ANAC_BLUE  = "#003F7F";
const ANAC_LIGHT = "#0066CC";
const GOLD       = "#C89600";
const RED_EV     = "#DC2626";
const ORG_EV     = "#EA580C";

interface TooltipState {
  x: number; y: number;
  content: { date: string; nacional: number | null; aero: number | null };
}

export default function SerieTemporalD3({ data }: { data: SerieData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data) return;
    const container = containerRef.current;
    const W = container.clientWidth;
    const H = 260;
    const MX = 14, MY = 20, MB = 36, subW = (W - MX * 3) / 2;

    const svg = d3.select(svgRef.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    for (const [id, color] of [["grad-nat", ANAC_LIGHT], ["grad-aero", GOLD]] as const) {
      const g = defs.append("linearGradient").attr("id", id).attr("x1", "0%").attr("x2", "0%").attr("y1", "0%").attr("y2", "100%");
      g.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.22);
      g.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0.01);
    }

    const parseDate = d3.timeParse("%Y-%m-%d");
    const natData  = data.nacional.map(d => ({ date: parseDate(d.date)!, pax: d.pax, mm24: d.mm24 }));
    const aeroData = data.aeroporto.map(d => ({ date: parseDate(d.date)!, pax: d.pax, mm24: d.mm24 }));

    const events: [string, string, string][] = [
      ["2020-03-01", "COVID-19", RED_EV],
      ["2024-05-01", "Enchentes RS", ORG_EV],
    ];

    const renderPanel = (
      g: d3.Selection<SVGGElement, unknown, null, undefined>,
      dataset: typeof natData,
      color: string,
      gradId: string,
      yLabel: string,
      w: number,
    ) => {
      const ML = 46, MR = 8, MT = 28, MBp = 28;
      const iW = w - ML - MR, iH = H - MT - MBp - MY;

      const x = d3.scaleTime().domain(d3.extent(dataset, d => d.date) as [Date, Date]).range([0, iW]);
      const yMax = d3.max(dataset, d => d.pax) ?? 0;
      const y = d3.scaleLinear().domain([0, yMax * 1.08]).range([iH, 0]);

      const inner = g.append("g").attr("transform", `translate(${ML},${MT})`);

      // Grid
      inner.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(4).tickSize(-iW).tickFormat(() => ""))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#F1F5F9").attr("stroke-width", 1));

      // Area
      const area = d3.area<typeof dataset[0]>()
        .x(d => x(d.date)).y0(iH).y1(d => y(d.pax))
        .curve(d3.curveCatmullRom.alpha(0.5));
      inner.append("path").datum(dataset)
        .attr("d", area).attr("fill", `url(#${gradId})`);

      // Main line
      const line = d3.line<typeof dataset[0]>()
        .x(d => x(d.date)).y(d => y(d.pax)).curve(d3.curveCatmullRom.alpha(0.5));
      inner.append("path").datum(dataset)
        .attr("d", line).attr("fill", "none")
        .attr("stroke", color).attr("stroke-width", 1.5);

      // Moving average
      const mm = dataset.filter(d => d.mm24 != null);
      if (mm.length > 2) {
        const mm_line = d3.line<typeof dataset[0]>()
          .x(d => x(d.date)).y(d => y(d.mm24!)).curve(d3.curveCatmullRom.alpha(0.5));
        inner.append("path").datum(mm)
          .attr("d", mm_line).attr("fill", "none")
          .attr("stroke", color).attr("stroke-width", 2.5)
          .attr("stroke-dasharray", "5,3").attr("opacity", 0.6);
      }

      // Event lines
      for (const [dateStr, label, evColor] of events) {
        const ts = parseDate(dateStr);
        if (!ts || x(ts) < 0 || x(ts) > iW) continue;
        const xPos = x(ts);
        inner.append("line")
          .attr("x1", xPos).attr("x2", xPos)
          .attr("y1", 0).attr("y2", iH)
          .attr("stroke", evColor).attr("stroke-width", 1)
          .attr("stroke-dasharray", "3,2").attr("opacity", 0.7);
        inner.append("text")
          .attr("x", xPos + 3).attr("y", 10)
          .attr("fill", evColor).attr("font-size", 8).attr("font-weight", 700)
          .text(label);
      }

      // Axes
      inner.append("g").attr("transform", `translate(0,${iH})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d => d3.timeFormat("%Y")(d as Date)))
        .call(g => g.select(".domain").attr("stroke", "#E2E8F0"))
        .call(g => g.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"))
        .call(g => g.selectAll("line").attr("stroke", "#E2E8F0"));

      inner.append("g")
        .call(d3.axisLeft(y).ticks(4).tickFormat(v => `${+v < 0.1 ? (+v * 100).toFixed(0) : (+v).toFixed(1)}`))
        .call(g => g.select(".domain").attr("stroke", "#E2E8F0"))
        .call(g => g.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"))
        .call(g => g.selectAll("line").attr("stroke", "#E2E8F0"));

      inner.append("text")
        .attr("x", -ML + 4).attr("y", -8)
        .attr("fill", "#64748B").attr("font-size", 9)
        .text(yLabel);
    };

    // Left panel: Nacional
    const gNat = svg.append("g").attr("transform", `translate(${MX},${MY})`);
    gNat.append("text").attr("x", 46).attr("y", 14).attr("font-size", 9).attr("fill", "#64748B")
      .text("🇧🇷 Brasil — total doméstico");
    renderPanel(gNat, natData, ANAC_LIGHT, "grad-nat", "Pax (M)", subW);

    // Right panel: Aeroporto
    const gAero = svg.append("g").attr("transform", `translate(${MX * 2 + subW},${MY})`);
    gAero.append("text").attr("x", 46).attr("y", 14).attr("font-size", 9).attr("fill", "#64748B")
      .text(`✈ ${data.aeroporto_nome}`);
    renderPanel(gAero, aeroData, GOLD, "grad-aero", `Pax (${data.scale})`, subW);

    // Invisible hover overlay
    const bisect = d3.bisector<typeof natData[0], Date>(d => d.date).left;
    const panelW = subW;
    const ML2 = 46, iW2 = panelW - ML2 - 8;

    svg.append("rect")
      .attr("width", W).attr("height", H)
      .attr("fill", "transparent")
      .on("mousemove", (event: MouseEvent) => {
        const [mx] = d3.pointer(event, svgRef.current);
        const panel = mx < MX + panelW ? 0 : 1;
        const offsetX = panel === 0 ? mx - MX - ML2 : mx - (MX * 2 + subW) - ML2;
        if (offsetX < 0 || offsetX > iW2) { setTooltip(null); return; }
        const xScale = d3.scaleTime()
          .domain(d3.extent(natData, d => d.date) as [Date, Date])
          .range([0, iW2]);
        const x0 = xScale.invert(offsetX);
        const i = bisect(natData, x0, 1);
        const d = natData[Math.min(i, natData.length - 1)];
        const dA = aeroData[Math.min(i, aeroData.length - 1)];
        setTooltip({
          x: event.clientX + 14,
          y: event.clientY - 10,
          content: { date: d3.timeFormat("%b %Y")(d.date), nacional: d.pax, aero: dA?.pax ?? null },
        });
      })
      .on("mouseleave", () => setTooltip(null));
  }, [data]);

  return (
    <div ref={containerRef} className="w-full relative">
      <svg ref={svgRef} id="chart-serie" className="w-full" />
      {tooltip && (
        <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="font-semibold text-slate-700 mb-1">{tooltip.content.date}</div>
          <div style={{ color: ANAC_LIGHT }}>
            🇧🇷 {tooltip.content.nacional?.toFixed(2)} M pax
          </div>
          {tooltip.content.aero != null && (
            <div style={{ color: GOLD }}>
              ✈ {tooltip.content.aero?.toFixed(2)} {data.scale} pax
            </div>
          )}
        </div>
      )}
    </div>
  );
}
