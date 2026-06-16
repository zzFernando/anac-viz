/**
 * Agregações client-side a partir dos JSONs consolidados em `public/data`.
 */
import type {
  FiltersData, KPIsData, SerieData, MapaData,
  HeatmapData, ScatterData, ScatterPoint, RotasData,
  RouteArcsData, Arc, AirportNode,
} from "./types";
import { type Dataset, MESES_BR, empresaLabel, empresaColor } from "./dataset";

function round2(v: number): number { return Math.round(v * 100) / 100; }
function round1(v: number): number { return Math.round(v * 10) / 10; }

function yearFilterSubset(idx: number[], years: number[], anoIni: number, anoFim: number): number[] {
  const out: number[] = [];
  for (const i of idx) {
    if (years[i] >= anoIni && years[i] <= anoFim) out.push(i);
  }
  return out;
}

/** Quantil linear (mesma interpolação default do pandas/numpy). */
function quantile(sortedArr: number[], q: number): number {
  const n = sortedArr.length;
  if (n === 1) return sortedArr[0];
  const pos = q * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (pos - lo);
}

/** rolling(window, center=True, min_periods) — janela posicional, não calendário. */
function rollingCenteredMean(values: number[], window: number, minPeriods: number): (number | null)[] {
  const n = values.length;
  const offsetRight = Math.floor(window / 2);
  const offsetLeft = window - 1 - offsetRight;
  const out: (number | null)[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - offsetLeft);
    const hi = Math.min(n - 1, i + offsetRight);
    let sum = 0, count = 0;
    for (let j = lo; j <= hi; j++) { sum += values[j]; count++; }
    out[i] = count >= minPeriods ? sum / count : null;
  }
  return out;
}

function groupSumByDate(idx: number[], ds: Dataset): { dates: string[]; sums: number[] } {
  const { DATA, PASSAGEIROS_PAGOS } = ds.stats;
  const map = new Map<string, number>();
  for (const i of idx) map.set(DATA[i], (map.get(DATA[i]) ?? 0) + PASSAGEIROS_PAGOS[i]);
  const dates = [...map.keys()].sort();
  return { dates, sums: dates.map((d) => map.get(d)!) };
}

// ── /api/filters ──────────────────────────────────────────────────────────

export function getFilters(ds: Dataset): FiltersData {
  const aeroportos = [...ds.pax120].sort().map((icao) => {
    const info = ds.aeroCoords.get(icao);
    const mun = info?.municipio ?? "";
    const uf = info?.uf ?? "";
    return { value: icao, label: mun ? `${icao} — ${mun}/${uf}` : icao };
  });
  return { ano_min: ds.anoMin, ano_max: ds.anoMax, aeroportos };
}

// ── /api/kpis ─────────────────────────────────────────────────────────────

export function getKpis(ds: Dataset, anoIni: number, anoFim: number, aeroporto: string): KPIsData {
  const { ANO, MES, EMPRESA_SIGLA, PASSAGEIROS_PAGOS } = ds.stats;
  const info = ds.aeroCoords.get(aeroporto);
  const nome = info?.municipio || aeroporto;

  const aeroIdxAll = ds.idxByOrigin.get(aeroporto) ?? [];               // df_all — sem filtro de ano
  const aeroIdxRange = yearFilterSubset(aeroIdxAll, ANO, anoIni, anoFim); // df_aero

  let paxAero = 0;
  for (const i of aeroIdxRange) paxAero += PASSAGEIROS_PAGOS[i];
  const paxStr = paxAero >= 500_000 ? `${(paxAero / 1e6).toFixed(1)} M` : `${(paxAero / 1e3).toFixed(0)} K`;

  const mesesDisp = new Set<number>();
  let paxCur = 0;
  for (const i of aeroIdxAll) {
    if (ANO[i] === anoFim) { mesesDisp.add(MES[i]); paxCur += PASSAGEIROS_PAGOS[i]; }
  }

  let varVal = 0;
  let varStr: string;
  let varSub: string;

  if (mesesDisp.size > 0 && paxCur > 0) {
    const mesMax = Math.max(...mesesDisp);
    let paxCurMes = 0, paxPrevMes = 0;
    for (const i of aeroIdxAll) {
      if (ANO[i] === anoFim && MES[i] <= mesMax) paxCurMes += PASSAGEIROS_PAGOS[i];
      if (ANO[i] === anoFim - 1 && MES[i] <= mesMax) paxPrevMes += PASSAGEIROS_PAGOS[i];
    }
    varVal = paxPrevMes > 0 ? (paxCurMes / paxPrevMes - 1) * 100 : 0;
    varStr = `${varVal >= 0 ? "+" : ""}${varVal.toFixed(1)}%`;
    varSub = `jan–${MESES_BR[mesMax - 1]} ${anoFim} vs. ${anoFim - 1}`;
  } else {
    const anosAero = new Map<number, number>();
    for (const i of aeroIdxAll) anosAero.set(ANO[i], (anosAero.get(ANO[i]) ?? 0) + PASSAGEIROS_PAGOS[i]);
    const anosOk = [...anosAero.entries()]
      .filter(([a, v]) => v > 10_000 && a !== anoFim)
      .map(([a]) => a)
      .sort((a, b) => a - b);
    if (anosOk.length >= 2) {
      const y1 = anosOk[anosOk.length - 2], y2 = anosOk[anosOk.length - 1];
      const p1 = anosAero.get(y1)!, p2 = anosAero.get(y2)!;
      varVal = (p2 / p1 - 1) * 100;
      varStr = `${varVal >= 0 ? "+" : ""}${varVal.toFixed(1)}%`;
      varSub = `ano completo ${y1} → ${y2}`;
    } else {
      varStr = "n/d";
      varSub = "dados insuficientes";
    }
  }

  let lider = "—";
  let liderShare = 0;
  if (aeroIdxRange.length > 0) {
    const byEmpresa = new Map<string, number>();
    for (const i of aeroIdxRange) {
      byEmpresa.set(EMPRESA_SIGLA[i], (byEmpresa.get(EMPRESA_SIGLA[i]) ?? 0) + PASSAGEIROS_PAGOS[i]);
    }
    let liderSig = "", liderPax = -1;
    for (const [sig, v] of byEmpresa) if (v > liderPax) { liderPax = v; liderSig = sig; }
    lider = empresaLabel(liderSig);
    liderShare = (liderPax / Math.max(paxAero, 1)) * 100;
  }

  const pctIdxAll = ds.idxByOriginPct.get(aeroporto) ?? [];
  const pctIdxRange = yearFilterSubset(pctIdxAll, ds.percentuais.ano, anoIni, anoFim);
  const pctVals: number[] = [];
  for (const i of pctIdxRange) {
    const v = ds.percentuais.Percentuais_de_Atrasos_superiores_a_30_minutos[i];
    if (v != null) pctVals.push(v);
  }
  let pontStr = "—", pontSub = "sem dados";
  if (pctVals.length > 0) {
    const atrasoMed = pctVals.reduce((s, v) => s + v, 0) / pctVals.length;
    pontStr = `${(100 - atrasoMed).toFixed(1)}%`;
    pontSub = `${atrasoMed.toFixed(1)}% dos voos atrasam >30 min`;
  }

  return {
    nome,
    pax: { value: paxStr, sub: "no período selecionado" },
    variacao: { value: varStr, sub: varSub, positive: varVal >= 0 },
    lider: { value: lider, sub: `${liderShare.toFixed(0)}% do mercado local` },
    pontualidade: { value: pontStr, sub: pontSub },
  };
}

// ── /api/serie ────────────────────────────────────────────────────────────

export function getSerie(ds: Dataset, anoIni: number, anoFim: number, aeroporto: string): SerieData {
  const { ANO } = ds.stats;
  const fullIdx: number[] = [];
  for (let i = 0; i < ANO.length; i++) if (ANO[i] >= anoIni && ANO[i] <= anoFim) fullIdx.push(i);

  const { dates: datesNac, sums: sumsNac } = groupSumByDate(fullIdx, ds);
  const mm24Nac = rollingCenteredMean(sumsNac, 24, 10);

  const aeroIdxAll = ds.idxByOrigin.get(aeroporto) ?? [];
  const aeroIdx = yearFilterSubset(aeroIdxAll, ANO, anoIni, anoFim);
  const { dates: datesAero, sums: sumsAero } = groupSumByDate(aeroIdx, ds);
  const mm24Aero = rollingCenteredMean(sumsAero, 24, 10);

  const aeroMax = sumsAero.length ? Math.max(...sumsAero) : 0;
  const scale: "K" | "M" = aeroMax < 500_000 ? "K" : "M";
  const div = scale === "K" ? 1e3 : 1e6;

  const info = ds.aeroCoords.get(aeroporto);

  return {
    nacional: datesNac.map((date, i) => ({
      date, pax: sumsNac[i] / 1e6,
      mm24: mm24Nac[i] ? mm24Nac[i]! / 1e6 : null,
    })),
    aeroporto: datesAero.map((date, i) => ({
      date, pax: sumsAero[i] / div,
      mm24: mm24Aero[i] ? mm24Aero[i]! / div : null,
    })),
    aeroporto_nome: info?.municipio || aeroporto,
    scale,
    ano_ini: anoIni,
    ano_fim: anoFim,
  };
}

// ── /api/mapa ─────────────────────────────────────────────────────────────

export function getMapa(ds: Dataset, anoIni: number, anoFim: number): MapaData {
  const { ANO, AEROPORTO_DE_ORIGEM_SIGLA, PASSAGEIROS_PAGOS } = ds.stats;
  const byAirport = new Map<string, number>();
  for (let i = 0; i < ANO.length; i++) {
    if (ANO[i] < anoIni || ANO[i] > anoFim) continue;
    const icao = AEROPORTO_DE_ORIGEM_SIGLA[i];
    byAirport.set(icao, (byAirport.get(icao) ?? 0) + PASSAGEIROS_PAGOS[i]);
  }
  let paxMax = 0;
  for (const v of byAirport.values()) if (v > paxMax) paxMax = v;

  const airports: MapaData["airports"] = [];
  for (const [icao, paxVal] of byAirport) {
    if (paxVal <= 0) continue;
    const c = ds.aeroCoords.get(icao);
    if (!c || c.lat == null) continue;
    const sz = Math.max(4, Math.min(36, Math.pow(paxVal / paxMax, 0.4) * 36));
    airports.push({
      icao, pax: paxVal, lat: c.lat, lon: c.lon!,
      nome: c.nome, mun: c.municipio, uf: c.uf,
      sz: round1(sz),
    });
  }
  return { airports };
}

// ── /api/heatmap ──────────────────────────────────────────────────────────

export function getHeatmap(ds: Dataset, anoIni: number, anoFim: number, aeroporto: string): HeatmapData {
  const { ano, mes, Percentuais_de_Atrasos_superiores_a_30_minutos: pctCol } = ds.percentuais;
  const idxAll = ds.idxByOriginPct.get(aeroporto) ?? [];
  const idx = yearFilterSubset(idxAll, ano, anoIni, anoFim);
  const info = ds.aeroCoords.get(aeroporto);
  const aeroportoNome = info?.municipio || aeroporto;

  if (idx.length === 0) {
    return { data: [], anos: [], zmax: 20, meses: MESES_BR, aeroporto_nome: aeroportoNome };
  }

  const groups = new Map<string, { sum: number; count: number; ano: number; mes: number }>();
  const validVals: number[] = [];
  for (const i of idx) {
    const v = pctCol[i];
    const key = `${ano[i]}-${mes[i]}`;
    let g = groups.get(key);
    if (!g) { g = { sum: 0, count: 0, ano: ano[i], mes: mes[i] }; groups.set(key, g); }
    if (v != null) { g.sum += v; g.count += 1; validVals.push(v); }
  }

  const data = [...groups.values()]
    .filter((g) => g.count > 0)
    .map((g) => ({ ano: g.ano, mes: g.mes, pct_atraso: round2(g.sum / g.count) }));

  validVals.sort((a, b) => a - b);
  const p80 = validVals.length ? quantile(validVals, 0.80) : 20;
  const zmax = Math.max(10, Math.min(Math.round(p80 / 2) * 2, 30));

  const anos = [...new Set(data.map((d) => d.ano))].sort((a, b) => b - a);

  return { data, anos, zmax, meses: MESES_BR, aeroporto_nome: aeroportoNome };
}

// ── /api/scatter ──────────────────────────────────────────────────────────

export function getScatter(ds: Dataset, anoIni: number, anoFim: number, aeroporto: string): ScatterData {
  const { ANO, EMPRESA_SIGLA, PASSAGEIROS_PAGOS } = ds.stats;
  const aeroIdxAll = ds.idxByOrigin.get(aeroporto) ?? [];
  const idx = yearFilterSubset(aeroIdxAll, ANO, anoIni, anoFim);
  if (idx.length === 0) return { points: [], med_ms: 0, med_pont: 0 };

  let paxTotal = 0;
  const byEmpresa = new Map<string, number>();
  for (const i of idx) {
    paxTotal += PASSAGEIROS_PAGOS[i];
    byEmpresa.set(EMPRESA_SIGLA[i], (byEmpresa.get(EMPRESA_SIGLA[i]) ?? 0) + PASSAGEIROS_PAGOS[i]);
  }
  const ms = new Map<string, number>();
  for (const [sig, v] of byEmpresa) {
    const share = (v / paxTotal) * 100;
    if (share >= 0.5) ms.set(sig, share);
  }

  const pctIdxAll = ds.idxByOriginPct.get(aeroporto) ?? [];
  const pctIdx = yearFilterSubset(pctIdxAll, ds.percentuais.ano, anoIni, anoFim);
  const pctByEmpresa = new Map<string, { sum: number; count: number }>();
  for (const i of pctIdx) {
    const sig = ds.percentuais.sigla[i].trim();
    const v = ds.percentuais.Percentuais_de_Atrasos_superiores_a_30_minutos[i];
    if (v == null) continue;
    let g = pctByEmpresa.get(sig);
    if (!g) { g = { sum: 0, count: 0 }; pctByEmpresa.set(sig, g); }
    g.sum += v; g.count += 1;
  }

  const points: ScatterPoint[] = [];
  const rawMs: number[] = [], rawPont: number[] = [];
  for (const [sig, marketShare] of ms) {
    const g = pctByEmpresa.get(sig);
    if (!g || g.count === 0) continue;          // inner join — só cias com ambos os dados
    const pontualidade = 100 - g.sum / g.count;
    const frota = ds.frotaBySig.get(sig);
    rawMs.push(marketShare);
    rawPont.push(pontualidade);
    points.push({
      sig,
      label: empresaLabel(sig),
      market_share: round2(marketShare),
      pontualidade: round2(pontualidade),
      color: empresaColor(sig),
      idade_frota: frota?.idade_media ?? null,
      n_aeronaves: frota?.n_aeronaves ?? null,
      pct_ca_vigente: frota?.pct_ca_vigente ?? null,
      modelo_top: frota?.modelo_top ?? null,
    });
  }
  if (points.length === 0) return { points: [], med_ms: 0, med_pont: 0 };

  points.sort((a, b) => b.market_share - a.market_share);
  const medMs = rawMs.reduce((s, v) => s + v, 0) / rawMs.length;
  const medPont = rawPont.reduce((s, v) => s + v, 0) / rawPont.length;

  return { points, med_ms: round2(medMs), med_pont: round2(medPont) };
}

// ── /api/top-rotas ────────────────────────────────────────────────────────

export function getTopRotas(ds: Dataset, anoIni: number, anoFim: number, aeroporto: string): RotasData {
  const { ANO, AEROPORTO_DE_DESTINO_SIGLA, PASSAGEIROS_PAGOS } = ds.stats;
  const aeroIdxAll = ds.idxByOrigin.get(aeroporto) ?? [];
  const idx = yearFilterSubset(aeroIdxAll, ANO, anoIni, anoFim);
  if (idx.length === 0) return { rotas: [], unit: "M", aeroporto, total_raw: 0 };

  let totalPax = 0;
  const byDest = new Map<string, number>();
  for (const i of idx) {
    totalPax += PASSAGEIROS_PAGOS[i];
    const d = AEROPORTO_DE_DESTINO_SIGLA[i];
    byDest.set(d, (byDest.get(d) ?? 0) + PASSAGEIROS_PAGOS[i]);
  }
  const top = [...byDest.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const paxMaxVal = top.length ? top[0][1] : 0;
  const unit: "K" | "M" = paxMaxVal < 500_000 ? "K" : "M";
  const unitDiv = unit === "K" ? 1e3 : 1e6;

  const rotas = top.map(([dest, paxVal]) => {
    const info = ds.aeroCoords.get(dest);
    const mun = info?.municipio ?? "";
    const uf = info?.uf ?? "";
    return {
      dest,
      label: mun ? `${dest} · ${mun}/${uf}` : dest,
      pax: round2(paxVal / unitDiv),
      pax_raw: paxVal,
    };
  });

  return { rotas, unit, aeroporto, total_raw: totalPax };
}

// ── /api/route-arcs ───────────────────────────────────────────────────────

export function getRouteArcs(
  ds: Dataset, anoIni: number, anoFim: number, aeroporto: string, maxRoutes = 200,
): RouteArcsData {
  const { ANO, AEROPORTO_DE_ORIGEM_SIGLA, AEROPORTO_DE_DESTINO_SIGLA, PASSAGEIROS_PAGOS } = ds.stats;
  const odMap = new Map<string, { origem: string; destino: string; pax: number }>();
  for (let i = 0; i < ANO.length; i++) {
    if (ANO[i] < anoIni || ANO[i] > anoFim) continue;
    const o = AEROPORTO_DE_ORIGEM_SIGLA[i], d = AEROPORTO_DE_DESTINO_SIGLA[i];
    const key = `${o}|${d}`;
    let g = odMap.get(key);
    if (!g) { g = { origem: o, destino: d, pax: 0 }; odMap.set(key, g); }
    g.pax += PASSAGEIROS_PAGOS[i];
  }

  const od = [...odMap.values()].filter((r) => r.pax > 0).sort((a, b) => b.pax - a.pax).slice(0, maxRoutes);
  const paxMax = od.length ? od[0].pax : 1.0;

  const focusOd = od.filter((r) => r.origem === aeroporto || r.destino === aeroporto);
  const focusPaxMax = focusOd.length ? Math.max(...focusOd.map((r) => r.pax)) : paxMax;

  const arcs: Arc[] = [];
  od.forEach((r, rank) => {
    const co = ds.aeroCoords.get(r.origem);
    const cd = ds.aeroCoords.get(r.destino);
    if (!co?.lat || !cd?.lat) return;
    const isFocus = r.origem === aeroporto || r.destino === aeroporto;
    const paxRatio = r.pax / paxMax;
    let tier: string;
    if (isFocus) {
      const focusRatio = r.pax / focusPaxMax;
      tier = focusRatio > 0.67 ? "hi" : focusRatio > 0.33 ? "mid" : "lo";
    } else {
      tier = rank < 10 ? "top10" : rank < 50 ? "top50" : "tail";
    }
    arcs.push({
      origem: r.origem, destino: r.destino,
      lat_o: co.lat, lon_o: co.lon!, lat_d: cd.lat, lon_d: cd.lon!,
      pax: r.pax, pax_ratio: paxRatio, is_focus: isFocus, tier,
      nome_o: co.municipio || r.origem, nome_d: cd.municipio || r.destino,
    });
  });

  const paxBy = new Map<string, number>();
  for (const a of arcs) {
    paxBy.set(a.origem, (paxBy.get(a.origem) ?? 0) + a.pax);
    paxBy.set(a.destino, (paxBy.get(a.destino) ?? 0) + a.pax);
  }
  const paxNodeMax = paxBy.size ? Math.max(...paxBy.values()) : 1.0;

  const allIcaos = new Set<string>();
  for (const a of arcs) { allIcaos.add(a.origem); allIcaos.add(a.destino); }

  const airports: AirportNode[] = [];
  for (const icao of allIcaos) {
    const c = ds.aeroCoords.get(icao);
    if (!c?.lat) continue;
    const paxN = paxBy.get(icao) ?? 0;
    const sz = round1(4 + Math.pow(paxN / paxNodeMax, 0.5) * 18);
    airports.push({
      icao, lat: c.lat, lon: c.lon!, pax: paxN,
      nome: c.municipio || icao, uf: c.uf, sz, is_ref: icao === aeroporto,
    });
  }

  return { arcs, airports, aeroporto };
}
