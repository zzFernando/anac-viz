#!/usr/bin/env python3
"""
api.py — FastAPI backend do dashboard de aviação doméstica brasileira.

Uso:
    uvicorn src.api:app --port 8000 --reload
"""

from __future__ import annotations

import math
import warnings
from pathlib import Path
from typing import Optional

import networkx as nx
import numpy as np
import pandas as pd
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

warnings.filterwarnings("ignore")

ROOT  = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "processed"

# ── Constantes ────────────────────────────────────────────────────────────────

EMPRESA_LABEL = {
    "TAM": "LATAM/TAM", "GLO": "Gol", "AZU": "Azul",
    "VRG": "Gol (VRG)",  "ONE": "Avianca BR", "AVI": "Avianca",
    "PTB": "Passaredo",  "MAP": "MAP",
}
CORES = {
    "TAM": "#E31837", "GLO": "#FF6B00", "AZU": "#3780D0",
    "VRG": "#FFA040", "ONE": "#7B2D2D", "AVI": "#A52A2A",
    "PTB": "#C89600",  "MAP": "#9467BD",
}
AIRLINE_COLORS = {
    "TAM": "#E1051E", "GLO": "#FF6B00", "AZU": "#2C5CC5",
    "VRG": "#FF8C00", "ONE": "#7B2D2D", "PTB": "#C89600",
}
MESES_BR = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
ANAC_BLUE  = "#003F7F"
ANAC_LIGHT = "#0066CC"
GOLD       = "#C89600"

# ── Carga de dados (colunas mínimas + dtypes eficientes → cabe em 512 MB) ─────

print("Carregando parquets…", flush=True)

# stats_v2: 12 colunas originais → 7 usadas; strings como category
DF = pd.read_parquet(
    CACHE / "stats_v2.parquet",
    columns=["EMPRESA_SIGLA", "ANO", "MES", "DATA",
             "AEROPORTO_DE_ORIGEM_SIGLA", "AEROPORTO_DE_DESTINO_SIGLA",
             "PASSAGEIROS_PAGOS"],
    engine="pyarrow",
).assign(
    EMPRESA_SIGLA=lambda d: d["EMPRESA_SIGLA"].astype("category"),
    AEROPORTO_DE_ORIGEM_SIGLA=lambda d: d["AEROPORTO_DE_ORIGEM_SIGLA"].astype("category"),
    AEROPORTO_DE_DESTINO_SIGLA=lambda d: d["AEROPORTO_DE_DESTINO_SIGLA"].astype("category"),
    PASSAGEIROS_PAGOS=lambda d: d["PASSAGEIROS_PAGOS"].astype("int32"),
)

# aerodromos: pequeno, carrega tudo
DFA = pd.read_parquet(CACHE / "aerodromos.parquet")

# percentuais_mes: 12 colunas originais → 5 usadas; 652 MB → ~60 MB
DFP = pd.read_parquet(
    CACHE / "percentuais_mes.parquet",
    columns=["Empresa_Aerea", "Aeroporto_Origem_Designador_OACI",
             "Percentuais_de_Atrasos_superiores_a_30_minutos", "ano", "mes"],
    engine="pyarrow",
)
DFP.columns = DFP.columns.str.strip()
DFP["sigla"] = DFP["Empresa_Aerea"].str.extract(r"^([A-Z0-9]{2,4})\s*-")
DFP = DFP.drop(columns=["Empresa_Aerea"])
DFP["Aeroporto_Origem_Designador_OACI"] = (
    DFP["Aeroporto_Origem_Designador_OACI"].astype("category")
)
DFP["sigla"] = DFP["sigla"].astype("category")
DFP["Percentuais_de_Atrasos_superiores_a_30_minutos"] = (
    DFP["Percentuais_de_Atrasos_superiores_a_30_minutos"].astype("float32")
)

ANO_MIN = int(DF["ANO"].min())
ANO_MAX = int(DF["ANO"].max())

_AERO_COORDS = (
    DFA.drop_duplicates(subset="Código OACI")
    .set_index("Código OACI")[["lat", "lon", "Nome", "UF", "Município"]]
    .to_dict("index")
)

_pax_top120 = (
    DF.groupby("AEROPORTO_DE_ORIGEM_SIGLA")["PASSAGEIROS_PAGOS"]
    .sum().nlargest(120).index.tolist()
)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Aviação BR API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _f(df: pd.DataFrame, ano_ini: int, ano_fim: int) -> pd.DataFrame:
    return df[(df["ANO"] >= ano_ini) & (df["ANO"] <= ano_fim)]

def _fp(dfp: pd.DataFrame, ano_ini: int, ano_fim: int) -> pd.DataFrame:
    return dfp[(dfp["ano"] >= ano_ini) & (dfp["ano"] <= ano_fim)]

def _c(icao: str, field: str, default=""):
    return _AERO_COORDS.get(icao, {}).get(field, default)

def _safe(v):
    if v is None: return None
    if isinstance(v, float) and math.isnan(v): return None
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (np.floating,)): return float(v)
    if isinstance(v, pd.Timestamp): return v.strftime("%Y-%m-%d")
    return v

def _records(df: pd.DataFrame) -> list[dict]:
    rows = []
    for rec in df.to_dict("records"):
        rows.append({k: _safe(v) for k, v in rec.items()})
    return rows

def _great_circle_path(lat1, lon1, lat2, lon2, n=20):
    la1, lo1, la2, lo2 = np.radians([lat1, lon1, lat2, lon2])
    v1 = np.array([np.cos(la1)*np.cos(lo1), np.cos(la1)*np.sin(lo1), np.sin(la1)])
    v2 = np.array([np.cos(la2)*np.cos(lo2), np.cos(la2)*np.sin(lo2), np.sin(la2)])
    omega = np.arccos(np.clip(v1 @ v2, -1.0, 1.0))
    if omega < 1e-8:
        return [lat1, lat2], [lon1, lon2]
    t = np.linspace(0, 1, n)
    s = np.sin(omega)
    pts = np.outer(np.sin((1-t)*omega)/s, v1) + np.outer(np.sin(t*omega)/s, v2)
    lats = np.degrees(np.arcsin(np.clip(pts[:, 2], -1, 1)))
    lons = np.degrees(np.arctan2(pts[:, 1], pts[:, 0]))
    return lats.tolist(), lons.tolist()

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/filters")
def get_filters():
    opts = []
    for icao in sorted(_pax_top120):
        info = _AERO_COORDS.get(icao, {})
        mun, uf = info.get("Município", ""), info.get("UF", "")
        label = f"{icao} — {mun}/{uf}" if mun else icao
        opts.append({"value": icao, "label": label})
    return {"ano_min": ANO_MIN, "ano_max": ANO_MAX, "aeroportos": opts}


@app.get("/api/kpis")
def get_kpis(
    ano_ini: int = Query(2016),
    ano_fim: int = Query(ANO_MAX),
    aeroporto: str = Query("SBPA"),
):
    df  = _f(DF, ano_ini, ano_fim)
    dfp = _fp(DFP, ano_ini, ano_fim)
    info = _AERO_COORDS.get(aeroporto, {})
    nome = info.get("Município", aeroporto)

    df_aero  = df[df["AEROPORTO_DE_ORIGEM_SIGLA"] == aeroporto]
    pax_aero = float(df_aero["PASSAGEIROS_PAGOS"].sum())
    pax_str  = f"{pax_aero/1e6:.1f} M" if pax_aero >= 500_000 else f"{pax_aero/1e3:.0f} K"

    df_all = DF[DF["AEROPORTO_DE_ORIGEM_SIGLA"] == aeroporto]
    meses_disp = sorted(df_all[df_all["ANO"] == ano_fim]["MES"].unique())
    pax_cur = float(df_all[df_all["ANO"] == ano_fim]["PASSAGEIROS_PAGOS"].sum())

    if meses_disp and pax_cur > 0:
        mes_max  = max(meses_disp)
        pax_cur  = float(df_all[(df_all["ANO"] == ano_fim) & (df_all["MES"] <= mes_max)]["PASSAGEIROS_PAGOS"].sum())
        pax_prev = float(df_all[(df_all["ANO"] == ano_fim-1) & (df_all["MES"] <= mes_max)]["PASSAGEIROS_PAGOS"].sum())
        var     = (pax_cur / pax_prev - 1) * 100 if pax_prev > 0 else 0
        var_str  = f"{'+' if var >= 0 else ''}{var:.1f}%"
        var_sub  = f"jan–{MESES_BR[mes_max-1]} {ano_fim} vs. {ano_fim-1}"
    else:
        anos_aero = df_all.groupby("ANO")["PASSAGEIROS_PAGOS"].sum()
        anos_ok   = sorted(a for a, v in anos_aero.items() if v > 10_000 and a != ano_fim)
        if len(anos_ok) >= 2:
            y1, y2  = anos_ok[-2], anos_ok[-1]
            p1, p2  = float(anos_aero[y1]), float(anos_aero[y2])
            var     = (p2/p1 - 1)*100
            var_str = f"{'+' if var >= 0 else ''}{var:.1f}%"
            var_sub = f"ano completo {y1} → {y2}"
            pax_cur = float(anos_aero.get(y2, 0))
        else:
            var, var_str, var_sub, pax_cur = 0, "n/d", "dados insuficientes", 0.0

    if not df_aero.empty:
        lider_sig = df_aero.groupby("EMPRESA_SIGLA")["PASSAGEIROS_PAGOS"].sum().idxmax()
        lider     = EMPRESA_LABEL.get(lider_sig, lider_sig)
        lider_share = df_aero[df_aero["EMPRESA_SIGLA"] == lider_sig]["PASSAGEIROS_PAGOS"].sum() / max(pax_aero, 1) * 100
    else:
        lider, lider_sig, lider_share = "—", "—", 0.0

    dfp_aero = dfp[dfp["Aeroporto_Origem_Designador_OACI"] == aeroporto]
    if not dfp_aero.empty:
        atraso_med = float(dfp_aero["Percentuais_de_Atrasos_superiores_a_30_minutos"].mean())
        pont_str = f"{100 - atraso_med:.1f}%"
        pont_sub = f"{atraso_med:.1f}% dos voos atrasam >30 min"
    else:
        pont_str, pont_sub = "—", "sem dados"

    return {
        "nome": nome,
        "pax": {"value": pax_str, "sub": "no período selecionado"},
        "variacao": {"value": var_str, "sub": var_sub, "positive": var >= 0},
        "lider": {"value": lider, "sub": f"{lider_share:.0f}% do mercado local"},
        "pontualidade": {"value": pont_str, "sub": pont_sub},
    }


@app.get("/api/serie")
def get_serie(
    ano_ini: int = Query(2016),
    ano_fim: int = Query(ANO_MAX),
    aeroporto: str = Query("SBPA"),
):
    df = _f(DF, ano_ini, ano_fim)

    nacional = df.groupby("DATA")["PASSAGEIROS_PAGOS"].sum().reset_index()
    nacional["mm24"] = nacional["PASSAGEIROS_PAGOS"].rolling(24, center=True, min_periods=10).mean()
    nacional["date"] = nacional["DATA"].dt.strftime("%Y-%m-%d")

    aero_df = (df[df["AEROPORTO_DE_ORIGEM_SIGLA"] == aeroporto]
               .groupby("DATA")["PASSAGEIROS_PAGOS"].sum().reset_index())
    aero_df["mm24"] = aero_df["PASSAGEIROS_PAGOS"].rolling(24, center=True, min_periods=10).mean()
    aero_df["date"] = aero_df["DATA"].dt.strftime("%Y-%m-%d")

    aero_max = float(aero_df["PASSAGEIROS_PAGOS"].max()) if not aero_df.empty else 0
    scale    = "K" if aero_max < 500_000 else "M"
    div      = 1e3  if aero_max < 500_000 else 1e6

    info = _AERO_COORDS.get(aeroporto, {})

    return {
        "nacional": [
            {"date": r["date"], "pax": r["PASSAGEIROS_PAGOS"]/1e6,
             "mm24": _safe(r["mm24"]/1e6 if r["mm24"] else None)}
            for r in _records(nacional)
        ],
        "aeroporto": [
            {"date": r["date"], "pax": r["PASSAGEIROS_PAGOS"]/div,
             "mm24": _safe(r["mm24"]/div if r["mm24"] else None)}
            for r in _records(aero_df)
        ],
        "aeroporto_nome": info.get("Município", aeroporto),
        "scale": scale,
        "ano_ini": ano_ini,
        "ano_fim": ano_fim,
    }


@app.get("/api/mapa")
def get_mapa(
    ano_ini: int = Query(2016),
    ano_fim: int = Query(ANO_MAX),
):
    df  = _f(DF, ano_ini, ano_fim)
    pax = (df.groupby("AEROPORTO_DE_ORIGEM_SIGLA")["PASSAGEIROS_PAGOS"]
           .sum().reset_index()
           .rename(columns={"AEROPORTO_DE_ORIGEM_SIGLA": "icao", "PASSAGEIROS_PAGOS": "pax"}))
    pax = pax[pax["pax"] > 0]
    pax_max = float(pax["pax"].max())

    airports = []
    for _, r in pax.iterrows():
        icao = r["icao"]
        c = _AERO_COORDS.get(icao, {})
        if not c.get("lat"):
            continue
        sz = float((r["pax"] / pax_max) ** 0.4 * 36)
        sz = max(4, min(36, sz))
        airports.append({
            "icao": icao, "pax": float(r["pax"]),
            "lat": float(c["lat"]), "lon": float(c["lon"]),
            "nome": c.get("Nome", ""), "mun": c.get("Município", ""), "uf": c.get("UF", ""),
            "sz": round(sz, 1),
        })
    return {"airports": airports}


@app.get("/api/heatmap")
def get_heatmap(
    ano_ini: int = Query(2016),
    ano_fim: int = Query(ANO_MAX),
    aeroporto: str = Query("SBPA"),
):
    dfp = _fp(DFP, ano_ini, ano_fim)
    sub = dfp[dfp["Aeroporto_Origem_Designador_OACI"] == aeroporto]
    if sub.empty:
        return {"data": [], "anos": [], "aeroporto_nome": aeroporto}

    pivot = (sub.groupby(["ano", "mes"])
             ["Percentuais_de_Atrasos_superiores_a_30_minutos"]
             .mean().reset_index())

    col_pct = sub["Percentuais_de_Atrasos_superiores_a_30_minutos"].dropna()
    p80     = float(col_pct.quantile(0.80)) if not col_pct.empty else 20
    zmax    = max(10, min(round(p80 / 2) * 2, 30))

    anos_disp = sorted(pivot["ano"].unique().tolist(), reverse=True)
    info = _AERO_COORDS.get(aeroporto, {})

    return {
        "data": [
            {"ano": int(r["ano"]), "mes": int(r["mes"]),
             "pct_atraso": round(float(r["Percentuais_de_Atrasos_superiores_a_30_minutos"]), 2)}
            for _, r in pivot.iterrows()
        ],
        "anos": anos_disp,
        "zmax": zmax,
        "meses": MESES_BR,
        "aeroporto_nome": info.get("Município", aeroporto),
    }


@app.get("/api/scatter")
def get_scatter(
    ano_ini: int = Query(2016),
    ano_fim: int = Query(ANO_MAX),
    aeroporto: str = Query("SBPA"),
):
    df  = _f(DF, ano_ini, ano_fim)
    dfp = _fp(DFP, ano_ini, ano_fim)

    df_a = df[df["AEROPORTO_DE_ORIGEM_SIGLA"] == aeroporto]
    if df_a.empty:
        return {"points": [], "med_ms": 0, "med_pont": 0}

    pax_total = df_a["PASSAGEIROS_PAGOS"].sum()
    ms = (df_a.groupby("EMPRESA_SIGLA")["PASSAGEIROS_PAGOS"].sum() / pax_total * 100).reset_index()
    ms.columns = ["sig", "market_share"]
    ms = ms[ms["market_share"] >= 0.5]

    dfp_a = dfp[dfp["Aeroporto_Origem_Designador_OACI"] == aeroporto]
    pont  = (dfp_a.groupby("sigla")["Percentuais_de_Atrasos_superiores_a_30_minutos"]
             .mean().reset_index())
    pont.columns = ["sig", "pct_atraso"]
    pont["pontualidade"] = 100 - pont["pct_atraso"]
    pont["sig"] = pont["sig"].str.strip()

    merged = ms.merge(pont, on="sig", how="inner")
    if merged.empty:
        return {"points": [], "med_ms": 0, "med_pont": 0}

    points = []
    for _, r in merged.iterrows():
        sig = r["sig"]
        points.append({
            "sig": sig,
            "label": EMPRESA_LABEL.get(sig, sig),
            "market_share": round(float(r["market_share"]), 2),
            "pontualidade": round(float(r["pontualidade"]), 2),
            "color": CORES.get(sig, "#94A3B8"),
        })

    return {
        "points": sorted(points, key=lambda x: -x["market_share"]),
        "med_ms":   round(float(merged["market_share"].mean()), 2),
        "med_pont": round(float(merged["pontualidade"].mean()), 2),
    }


@app.get("/api/top-rotas")
def get_top_rotas(
    ano_ini: int = Query(2016),
    ano_fim: int = Query(ANO_MAX),
    aeroporto: str = Query("SBPA"),
):
    df = _f(DF, ano_ini, ano_fim)
    df_a = df[df["AEROPORTO_DE_ORIGEM_SIGLA"] == aeroporto]
    if df_a.empty:
        return {"rotas": [], "unit": "M", "aeroporto": aeroporto}

    top = (df_a.groupby("AEROPORTO_DE_DESTINO_SIGLA")["PASSAGEIROS_PAGOS"]
           .sum().nlargest(5).reset_index())
    pax_max_val = float(top["PASSAGEIROS_PAGOS"].max())
    unit    = "K" if pax_max_val < 500_000 else "M"
    unit_div = 1e3 if unit == "K" else 1e6

    rotas = []
    for _, r in top.iterrows():
        dest = r["AEROPORTO_DE_DESTINO_SIGLA"]
        info = _AERO_COORDS.get(dest, {})
        mun  = info.get("Município", "")
        uf   = info.get("UF", "")
        rotas.append({
            "dest": dest,
            "label": f"{dest} · {mun}/{uf}" if mun else dest,
            "pax": round(float(r["PASSAGEIROS_PAGOS"]) / unit_div, 2),
            "pax_raw": float(r["PASSAGEIROS_PAGOS"]),
        })
    return {"rotas": rotas, "unit": unit, "aeroporto": aeroporto}


@app.get("/api/network")
def get_network(
    ano_ini: int = Query(2016),
    ano_fim: int = Query(ANO_MAX),
    n_airports: int = Query(80),
):
    df = _f(DF, ano_ini, ano_fim)
    top_icaos = set(
        df.groupby("AEROPORTO_DE_ORIGEM_SIGLA")["PASSAGEIROS_PAGOS"]
        .sum().nlargest(n_airports).index
    )
    od = (df.groupby(["AEROPORTO_DE_ORIGEM_SIGLA", "AEROPORTO_DE_DESTINO_SIGLA"])
          .agg(pax=("PASSAGEIROS_PAGOS", "sum")).reset_index())
    od = od[
        od["AEROPORTO_DE_ORIGEM_SIGLA"].isin(top_icaos) &
        od["AEROPORTO_DE_DESTINO_SIGLA"].isin(top_icaos) &
        (od["pax"] > 0)
    ].nlargest(500, "pax")

    pax_by_aero  = df.groupby("AEROPORTO_DE_ORIGEM_SIGLA")["PASSAGEIROS_PAGOS"].sum()
    pax_aero_max = float(pax_by_aero[pax_by_aero.index.isin(top_icaos)].max())
    pax_edge_max = float(od["pax"].max()) if not od.empty else 1.0

    dominant = (
        df[df["AEROPORTO_DE_ORIGEM_SIGLA"].isin(top_icaos)]
        .groupby(["AEROPORTO_DE_ORIGEM_SIGLA", "EMPRESA_SIGLA"])["PASSAGEIROS_PAGOS"]
        .sum().reset_index()
        .sort_values("PASSAGEIROS_PAGOS", ascending=False)
        .drop_duplicates("AEROPORTO_DE_ORIGEM_SIGLA")
        .set_index("AEROPORTO_DE_ORIGEM_SIGLA")["EMPRESA_SIGLA"]
    )

    # Build NetworkX graph for centrality metrics
    G = nx.Graph()
    G.add_nodes_from(top_icaos)
    for _, r in od.iterrows():
        src = r["AEROPORTO_DE_ORIGEM_SIGLA"]
        tgt = r["AEROPORTO_DE_DESTINO_SIGLA"]
        G.add_edge(src, tgt, weight=float(r["pax"]))

    betweenness = nx.betweenness_centrality(G, normalized=True, weight="weight")
    degree_map  = dict(G.degree())

    nodes, links = [], []
    for icao in top_icaos:
        c = _AERO_COORDS.get(icao, {})
        pax_node = float(pax_by_aero.get(icao, 0))
        size     = round(8 + (pax_node / pax_aero_max) ** 0.5 * 32, 1)
        emp      = dominant.get(icao, "Outros")
        color    = AIRLINE_COLORS.get(emp, "#64748B")
        mun, uf  = c.get("Município", ""), c.get("UF", "")
        nodes.append({
            "id": icao, "label": icao, "size": size, "color": color,
            "pax": pax_node, "nome": f"{mun}/{uf}" if uf else mun,
            "empresa": EMPRESA_LABEL.get(emp, emp),
            "betweenness": round(betweenness.get(icao, 0.0), 4),
            "degree": int(degree_map.get(icao, 0)),
        })

    for _, r in od.iterrows():
        value = round(0.5 + (r["pax"] / pax_edge_max) ** 0.5 * 5, 2)
        links.append({
            "source": r["AEROPORTO_DE_ORIGEM_SIGLA"],
            "target": r["AEROPORTO_DE_DESTINO_SIGLA"],
            "value": value, "pax": float(r["pax"]),
        })

    return {"nodes": nodes, "links": links}


@app.get("/api/route-arcs")
def get_route_arcs(
    ano_ini: int = Query(2016),
    ano_fim: int = Query(ANO_MAX),
    aeroporto: str = Query("SBPA"),
    max_routes: int = Query(200),
):
    df = _f(DF, ano_ini, ano_fim)
    od = (df.groupby(["AEROPORTO_DE_ORIGEM_SIGLA", "AEROPORTO_DE_DESTINO_SIGLA"])
          .agg(pax=("PASSAGEIROS_PAGOS", "sum")).reset_index()
          .rename(columns={"AEROPORTO_DE_ORIGEM_SIGLA": "origem",
                            "AEROPORTO_DE_DESTINO_SIGLA": "destino"}))
    od = od[od["pax"] > 0].sort_values("pax", ascending=False).head(max_routes)
    pax_max = float(od["pax"].max()) if not od.empty else 1.0

    # Use focus airport's own max for relative tier classification
    focus_od = od[(od["origem"] == aeroporto) | (od["destino"] == aeroporto)]
    focus_pax_max = float(focus_od["pax"].max()) if not focus_od.empty else pax_max

    arcs = []
    for rank, (_, r) in enumerate(od.iterrows()):
        o, d = r["origem"], r["destino"]
        co = _AERO_COORDS.get(o, {})
        cd = _AERO_COORDS.get(d, {})
        if not (co.get("lat") and cd.get("lat")):
            continue
        is_focus = (o == aeroporto or d == aeroporto)
        pax_ratio = r["pax"] / pax_max
        if is_focus:
            focus_ratio = r["pax"] / focus_pax_max
            tier = "hi" if focus_ratio > 0.67 else ("mid" if focus_ratio > 0.33 else "lo")
        else:
            tier = "top10" if rank < 10 else ("top50" if rank < 50 else "tail")
        arcs.append({
            "origem": o, "destino": d,
            "lat_o": float(co["lat"]), "lon_o": float(co["lon"]),
            "lat_d": float(cd["lat"]), "lon_d": float(cd["lon"]),
            "pax": float(r["pax"]), "pax_ratio": float(pax_ratio),
            "is_focus": is_focus, "tier": tier,
            "nome_o": co.get("Município", o), "nome_d": cd.get("Município", d),
        })

    all_icaos = set(a["origem"] for a in arcs) | set(a["destino"] for a in arcs)
    pax_by = {}
    for a in arcs:
        pax_by[a["origem"]] = pax_by.get(a["origem"], 0) + a["pax"]
        pax_by[a["destino"]] = pax_by.get(a["destino"], 0) + a["pax"]
    pax_node_max = max(pax_by.values()) if pax_by else 1.0

    airports = []
    for icao in all_icaos:
        c = _AERO_COORDS.get(icao, {})
        if not c.get("lat"):
            continue
        pax_n = pax_by.get(icao, 0)
        sz    = round(4 + (pax_n / pax_node_max) ** 0.5 * 18, 1)
        airports.append({
            "icao": icao, "lat": float(c["lat"]), "lon": float(c["lon"]),
            "pax": float(pax_n), "nome": c.get("Município", icao),
            "uf": c.get("UF", ""), "sz": sz, "is_ref": (icao == aeroporto),
        })

    return {"arcs": arcs, "airports": airports, "aeroporto": aeroporto}


@app.get("/api/od-matrix")
def get_od_matrix(
    ano_ini: int = Query(2016),
    ano_fim: int = Query(ANO_MAX),
    aeroporto: str = Query("SBPA"),
):
    df = _f(DF, ano_ini, ano_fim)
    counts = (df["AEROPORTO_DE_ORIGEM_SIGLA"].value_counts()
              .add(df["AEROPORTO_DE_DESTINO_SIGLA"].value_counts(), fill_value=0))
    top15 = counts.nlargest(15).index.tolist()
    if aeroporto in top15:
        top15 = [aeroporto] + [a for a in top15 if a != aeroporto]

    od = (df.groupby(["AEROPORTO_DE_ORIGEM_SIGLA", "AEROPORTO_DE_DESTINO_SIGLA"])
          ["PASSAGEIROS_PAGOS"].sum().reset_index())
    od = od[
        od["AEROPORTO_DE_ORIGEM_SIGLA"].isin(top15) &
        od["AEROPORTO_DE_DESTINO_SIGLA"].isin(top15)
    ]
    pivot = (od.pivot_table(
        index="AEROPORTO_DE_ORIGEM_SIGLA",
        columns="AEROPORTO_DE_DESTINO_SIGLA",
        values="PASSAGEIROS_PAGOS", aggfunc="sum", fill_value=0
    ).reindex(index=top15, columns=top15, fill_value=0))

    z = (pivot.values / 1e6).round(2).tolist()
    aero_idx = top15.index(aeroporto) if aeroporto in top15 else -1

    return {"airports": top15, "z": z, "aeroporto": aeroporto, "aeroporto_idx": aero_idx}
