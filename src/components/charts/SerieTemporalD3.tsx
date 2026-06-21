"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { SerieData } from "@/lib/types";
import { eventsForAirport, type ContextualEvent } from "@/lib/events";
import { useExpanded } from "@/lib/expandedContext";

const ANAC_BLUE  = "#003F7F";
const ANAC_LIGHT = "#0066CC";
const GOLD       = "#C89600";

export type SerieMode = "absolute" | "indexed" | "share";

interface TooltipState {
  x: number; y: number;
  rows: { color: string; label: string; value: string }[];
  date: string;
}

interface Props {
  data: SerieData;
  /** "absolute" = dois painéis · "indexed" = base 100 · "share" = % nacional */
  mode?: SerieMode;
  /** ICAO do aeroporto pra filtrar eventos contextuais. */
  aeroporto: string;
}

interface Pt { date: Date; pax: number; mm24: number | null }

export default function SerieTemporalD3({ data, mode = "absolute", aeroporto }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data) return;
    const container = containerRef.current;
    const W = container.clientWidth;
    const H = expanded ? 520 : 260;
    const MX = 14, MY = 20;
    const fmtDecimal = (value: number, digits = 1) => value.toFixed(digits).replace(".", ",");

    const svg = d3.select(svgRef.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    // Gradients
    const defs = svg.append("defs");
    const mkGrad = (id: string, color: string) => {
      const g = defs.append("linearGradient").attr("id", id).attr("x1", "0%").attr("x2", "0%").attr("y1", "0%").attr("y2", "100%");
      g.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.22);
      g.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0.01);
    };
    mkGrad("grad-nat",  ANAC_LIGHT);
    mkGrad("grad-aero", GOLD);
    mkGrad("grad-share", ANAC_BLUE);

    const parseDate = d3.timeParse("%Y-%m-%d");
    const natRaw  = data.nacional.map(d => ({ date: parseDate(d.date)!, pax: d.pax, mm24: d.mm24 }));
    const aeroRaw = data.aeroporto.map(d => ({ date: parseDate(d.date)!, pax: d.pax, mm24: d.mm24 }));

    // Eventos relevantes ao aeroporto + janela do período
    const evts: ContextualEvent[] = eventsForAirport(aeroporto);

    // ── Modo ABSOLUTE — dois painéis lado a lado ────────────────────────────
    if (mode === "absolute") {
      const subW = (W - MX * 3) / 2;
      const renderPanel = (
        g: d3.Selection<SVGGElement, unknown, null, undefined>,
        dataset: Pt[],
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

        inner.append("g").attr("class", "grid")
          .call(d3.axisLeft(y).ticks(4).tickSize(-iW).tickFormat(() => ""))
          .call(s => s.select(".domain").remove())
          .call(s => s.selectAll("line").attr("stroke", "#F1F5F9").attr("stroke-width", 1));

        const area = d3.area<Pt>().x(d => x(d.date)).y0(iH).y1(d => y(d.pax)).curve(d3.curveCatmullRom.alpha(0.5));
        inner.append("path").datum(dataset).attr("d", area).attr("fill", `url(#${gradId})`);

        const line = d3.line<Pt>().x(d => x(d.date)).y(d => y(d.pax)).curve(d3.curveCatmullRom.alpha(0.5));
        inner.append("path").datum(dataset).attr("d", line).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.5);

        const mm = dataset.filter(d => d.mm24 != null);
        if (mm.length > 2) {
          const mmLine = d3.line<Pt>().x(d => x(d.date)).y(d => y(d.mm24!)).curve(d3.curveCatmullRom.alpha(0.5));
          inner.append("path").datum(mm).attr("d", mmLine).attr("fill", "none")
            .attr("stroke", color).attr("stroke-width", 2.5).attr("stroke-dasharray", "5,3").attr("opacity", 0.6);
        }

        // Eventos
        for (const ev of evts) {
          const ts = parseDate(ev.date);
          if (!ts || x(ts) < 0 || x(ts) > iW) continue;
          const xPos = x(ts);
          inner.append("line")
            .attr("x1", xPos).attr("x2", xPos).attr("y1", 0).attr("y2", iH)
            .attr("stroke", ev.color).attr("stroke-width", 1).attr("stroke-dasharray", "3,2").attr("opacity", 0.7);
          inner.append("text").attr("x", xPos + 3).attr("y", 10)
            .attr("fill", ev.color).attr("font-size", 8).attr("font-weight", 700).text(ev.short);
        }

        // Axes
        inner.append("g").attr("transform", `translate(0,${iH})`)
          .call(d3.axisBottom(x).ticks(5).tickFormat(d => d3.timeFormat("%Y")(d as Date)))
          .call(s => s.select(".domain").attr("stroke", "#E2E8F0"))
          .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"))
          .call(s => s.selectAll("line").attr("stroke", "#E2E8F0"));

        inner.append("g")
          .call(d3.axisLeft(y).ticks(4).tickFormat(v => {
            const value = +v < 0.1 ? (+v * 100).toFixed(0) : (+v).toFixed(1);
            return value.replace(".", ",");
          }))
          .call(s => s.select(".domain").attr("stroke", "#E2E8F0"))
          .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"))
          .call(s => s.selectAll("line").attr("stroke", "#E2E8F0"));

        inner.append("text").attr("x", -ML + 4).attr("y", -8)
          .attr("fill", "#64748B").attr("font-size", 9).text(yLabel);
      };

      const gNat = svg.append("g").attr("transform", `translate(${MX},${MY})`);
      gNat.append("text").attr("x", 46).attr("y", 14).attr("font-size", 9).attr("fill", "#64748B")
        .text("🇧🇷 Brasil — voos domésticos");
      renderPanel(gNat, natRaw, ANAC_LIGHT, "grad-nat", "Passageiros (mi)", subW);

      const gAero = svg.append("g").attr("transform", `translate(${MX * 2 + subW},${MY})`);
      gAero.append("text").attr("x", 46).attr("y", 14).attr("font-size", 9).attr("fill", "#64748B")
        .text(`✈ ${data.aeroporto_nome}`);
      renderPanel(gAero, aeroRaw, GOLD, "grad-aero", data.scale === "K" ? "Passageiros (mil)" : "Passageiros (mi)", subW);

      // Hover overlay (mesmo padrão original)
      const bisect = d3.bisector<Pt, Date>(d => d.date).left;
      const ML2 = 46, iW2 = subW - ML2 - 8;
      svg.append("rect")
        .attr("width", W).attr("height", H)
        .attr("fill", "transparent")
        .on("mousemove", (event: MouseEvent) => {
          const [mx] = d3.pointer(event, svgRef.current);
          const panel = mx < MX + subW ? 0 : 1;
          const offsetX = panel === 0 ? mx - MX - ML2 : mx - (MX * 2 + subW) - ML2;
          if (offsetX < 0 || offsetX > iW2) { setTooltip(null); return; }
          const xScale = d3.scaleTime().domain(d3.extent(natRaw, d => d.date) as [Date, Date]).range([0, iW2]);
          const x0 = xScale.invert(offsetX);
          const iNat  = bisect(natRaw,  x0, 1);
          const iAero = bisect(aeroRaw, x0, 1);
          const d  = natRaw[Math.min(iNat,  natRaw.length  - 1)];
          const dA = aeroRaw[Math.min(iAero, aeroRaw.length - 1)];
          setTooltip({
            x: event.clientX + 14,
            y: event.clientY - 10,
            date: d3.timeFormat("%b %Y")(d.date),
            rows: [
              { color: ANAC_LIGHT, label: "🇧🇷 Brasil", value: `${fmtDecimal(d.pax, 2)} mi passageiros` },
              ...(dA ? [{ color: GOLD, label: `✈ ${data.aeroporto_nome}`, value: `${fmtDecimal(dA.pax, 2)} ${data.scale === "K" ? "mil" : "mi"} passageiros` }] : []),
            ],
          });
        })
        .on("mouseleave", () => setTooltip(null));
      return;
    }

    // ── Modos INDEXED / SHARE — painel único de largura cheia ─────────────────
    const ML = 50, MR = 16, MT = 46, MB = 32;     // MT extra para a legenda no topo
    const iW = W - ML - MR, iH = H - MT - MB - MY;

    // Prepara séries conforme o modo
    let series: Array<{ key: string; label: string; color: string; gradId: string; data: Pt[]; tooltipFmt: (v: number) => string }>;
    let yLabelTxt: string;
    let yMax: number;

    if (mode === "indexed") {
      const firstNatPt  = natRaw.find(d => d.pax > 0);
      const firstAeroPt = aeroRaw.find(d => d.pax > 0);
      const firstNat  = firstNatPt?.pax  || 1;
      const firstAero = firstAeroPt?.pax || 1;
      const natIdx  = natRaw.map(d => ({ date: d.date, pax: (d.pax / firstNat)  * 100, mm24: d.mm24 != null ? (d.mm24 / firstNat)  * 100 : null }));
      const aeroIdx = aeroRaw.map(d => ({ date: d.date, pax: (d.pax / firstAero) * 100, mm24: d.mm24 != null ? (d.mm24 / firstAero) * 100 : null }));
      const baseDate = firstNatPt?.date ?? new Date();
      yLabelTxt = `Base 100 = ${d3.timeFormat("%b/%Y")(baseDate)}`;
      yMax = Math.max(d3.max(natIdx, d => d.pax) ?? 100, d3.max(aeroIdx, d => d.pax) ?? 100);
      series = [
        { key: "nat", label: "🇧🇷 Brasil",                  color: ANAC_LIGHT, gradId: "grad-nat",  data: natIdx,  tooltipFmt: v => `${fmtDecimal(v)} pontos` },
        { key: "aero", label: `✈ ${data.aeroporto_nome}`, color: GOLD,       gradId: "grad-aero", data: aeroIdx, tooltipFmt: v => `${fmtDecimal(v)} pontos` },
      ];
    } else {
      // share — único traço, % do aeroporto sobre o nacional
      const natDiv = 1e6;
      const aeroDiv = data.scale === "K" ? 1e3 : 1e6;
      const natByMs = new Map(natRaw.map(d => [d.date.getTime(), { pax: d.pax * natDiv, mm24: d.mm24 != null ? d.mm24 * natDiv : null }]));
      const shareData: Pt[] = aeroRaw.map(d => {
        const n = natByMs.get(d.date.getTime());
        const aeroBruto = d.pax * aeroDiv;
        return {
          date: d.date,
          pax: n && n.pax > 0 ? (aeroBruto / n.pax) * 100 : 0,
          mm24: d.mm24 != null && n?.mm24 ? ((d.mm24 * aeroDiv) / n.mm24) * 100 : null,
        };
      });
      yLabelTxt = "% dos passageiros do Brasil";
      yMax = (d3.max(shareData, d => d.pax) ?? 1) * 1.15;
      series = [
        { key: "share", label: `✈ ${data.aeroporto_nome}`, color: ANAC_BLUE, gradId: "grad-share", data: shareData, tooltipFmt: v => `${fmtDecimal(v, 2)}%` },
      ];
    }

    const allDates = series.flatMap(s => s.data.map(d => d.date));
    const x = d3.scaleTime().domain(d3.extent(allDates) as [Date, Date]).range([0, iW]);
    const y = d3.scaleLinear().domain([0, yMax * 1.06]).range([iH, 0]);

    // Plot deslocado 20px pra baixo para acomodar a legenda no topo
    const g = svg.append("g").attr("transform", `translate(${MX + ML - 12},${MY + 24})`);

    const inner = g;

    // Grid
    inner.append("g").attr("class", "grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-iW).tickFormat(() => ""))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", "#F1F5F9").attr("stroke-width", 1));

    // Linha base 100 (apenas modo indexed) — sem rótulo "base 100" porque
    // o eixo Y já carrega essa informação ("Índice (base 100 = ...)")
    if (mode === "indexed") {
      inner.append("line")
        .attr("x1", 0).attr("x2", iW).attr("y1", y(100)).attr("y2", y(100))
        .attr("stroke", "#94A3B8").attr("stroke-width", 1).attr("stroke-dasharray", "2,3").attr("opacity", 0.6);
    }

    // Render cada série
    for (const s of series) {
      const area = d3.area<Pt>().x(d => x(d.date)).y0(iH).y1(d => y(d.pax)).curve(d3.curveCatmullRom.alpha(0.5));
      inner.append("path").datum(s.data).attr("d", area).attr("fill", `url(#${s.gradId})`).attr("opacity", series.length > 1 ? 0.55 : 0.9);

      const line = d3.line<Pt>().x(d => x(d.date)).y(d => y(d.pax)).curve(d3.curveCatmullRom.alpha(0.5));
      inner.append("path").datum(s.data).attr("d", line).attr("fill", "none").attr("stroke", s.color).attr("stroke-width", 1.6);

      const mm = s.data.filter(d => d.mm24 != null);
      if (mm.length > 2) {
        const mmLine = d3.line<Pt>().x(d => x(d.date)).y(d => y(d.mm24!)).curve(d3.curveCatmullRom.alpha(0.5));
        inner.append("path").datum(mm).attr("d", mmLine).attr("fill", "none")
          .attr("stroke", s.color).attr("stroke-width", 2.4).attr("stroke-dasharray", "5,3").attr("opacity", 0.55);
      }
    }

    // Eventos (linhas verticais + labels)
    for (const ev of evts) {
      const ts = parseDate(ev.date);
      if (!ts || x(ts) < 0 || x(ts) > iW) continue;
      const xPos = x(ts);
      inner.append("line")
        .attr("x1", xPos).attr("x2", xPos).attr("y1", 0).attr("y2", iH)
        .attr("stroke", ev.color).attr("stroke-width", 1).attr("stroke-dasharray", "3,2").attr("opacity", 0.7);
      inner.append("text").attr("x", xPos + 3).attr("y", 10)
        .attr("fill", ev.color).attr("font-size", 8).attr("font-weight", 700).text(ev.short);
    }

    // X axis
    inner.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d => d3.timeFormat("%Y")(d as Date)))
      .call(s => s.select(".domain").attr("stroke", "#E2E8F0"))
      .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"))
      .call(s => s.selectAll("line").attr("stroke", "#E2E8F0"));

    // Y axis
    inner.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(v => mode === "share" ? `${+v}%` : `${+v}`))
      .call(s => s.select(".domain").attr("stroke", "#E2E8F0"))
      .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"))
      .call(s => s.selectAll("line").attr("stroke", "#E2E8F0"));

    inner.append("text").attr("x", -ML + 4).attr("y", iH + 22)
      .attr("font-size", 8).attr("fill", "#94A3B8").text(yLabelTxt);

    // Legenda no TOPO do chart (acima do plot, fora da área onde COVID/Enchentes ficam)
    if (series.length > 1) {
      const lg = svg.append("g").attr("transform", `translate(${MX + ML - 12}, ${MY + 4})`);
      series.forEach((s, i) => {
        const lx = i * 120;
        lg.append("line").attr("x1", lx).attr("x2", lx + 18).attr("y1", 6).attr("y2", 6)
          .attr("stroke", s.color).attr("stroke-width", 2.4)
          .attr("stroke-linecap", "round");
        lg.append("text").attr("x", lx + 22).attr("y", 9.5)
          .attr("font-size", 10).attr("font-weight", 600).attr("fill", "#334155")
          .text(s.label);
      });
    }

    // Hover overlay — alinhado com o plot deslocado
    const bisect = d3.bisector<Pt, Date>(d => d.date).left;
    svg.append("rect")
      .attr("transform", `translate(${MX + ML - 12},${MY + 24})`)
      .attr("width", iW).attr("height", iH)
      .attr("fill", "transparent")
      .on("mousemove", (event: MouseEvent) => {
        const [mx] = d3.pointer(event, svgRef.current);
        const offsetX = mx - (MX + ML - 12);
        if (offsetX < 0 || offsetX > iW) { setTooltip(null); return; }
        const x0 = x.invert(offsetX);
        const rows: TooltipState["rows"] = [];
        let dateStr = "";
        for (const s of series) {
          const i = bisect(s.data, x0, 1);
          const d = s.data[Math.min(i, s.data.length - 1)];
          if (!d) continue;
          dateStr = d3.timeFormat("%b %Y")(d.date);
          rows.push({ color: s.color, label: s.label, value: s.tooltipFmt(d.pax) });
        }
        setTooltip({
          x: event.clientX + 14, y: event.clientY - 10,
          date: dateStr, rows,
        });
      })
      .on("mouseleave", () => setTooltip(null));
  }, [data, mode, aeroporto, expanded]);

  return (
    <div ref={containerRef} className="w-full relative">
      <svg ref={svgRef} id="chart-serie" className="w-full" />
      {tooltip && (
        <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="font-semibold text-slate-700 mb-1">{tooltip.date}</div>
          {tooltip.rows.map((r, i) => (
            <div key={i} style={{ color: r.color }}>{r.label}: {r.value}</div>
          ))}
        </div>
      )}
    </div>
  );
}
