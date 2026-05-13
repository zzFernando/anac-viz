#!/usr/bin/env python3
"""
app.py — Dashboard Executivo: Panorama da Aviação Doméstica Brasileira
Painel único: série temporal, mapa de bolhas, heatmap de atrasos, scatter market share × pontualidade.

Uso:
    python src/app.py          # http://localhost:8050
"""

import warnings
from pathlib import Path

import networkx as nx
import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import dash
from dash import dcc, html, Input, Output
import dash_bootstrap_components as dbc
import dash_cytoscape as cyto
cyto.load_extra_layouts()

warnings.filterwarnings("ignore")

ROOT  = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "processed"

# ---------------------------------------------------------------------------
# Constantes visuais
# ---------------------------------------------------------------------------

ANAC_BLUE  = "#003F7F"
ANAC_LIGHT = "#0066CC"
GOLD       = "#C89600"
RED_EVENT  = "#DC2626"
ORANGE_EVENT = "#EA580C"

EMPRESA_LABEL = {
    "TAM": "LATAM/TAM", "GLO": "Gol", "AZU": "Azul",
    "VRG": "Gol (VRG)",  "ONE": "Avianca BR", "AVI": "Avianca",
    "PTB": "Passaredo",  "MAP": "MAP",
}
CORES = {
    "TAM": "#E31837", "GLO": "#FF6B00", "AZU": "#3780D0",
    "VRG": "#FFA040", "ONE": "#7B2D2D", "AVI": "#A52A2A",
    "PTB": "#C89600",  "MAP": "#9467BD", "Outros": "#BBBBBB",
}

LAYOUT_BASE = dict(
    font=dict(family="Inter, -apple-system, sans-serif", size=12, color="#1E293B"),
    plot_bgcolor="white",
    paper_bgcolor="white",
    hoverlabel=dict(bgcolor="white", font_size=12, bordercolor="#E2E8F0"),
    margin=dict(t=36, b=20, l=10, r=10),
)

DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
MESES_BR = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]

_TAB_STYLE = dict(
    fontFamily="Inter, -apple-system, sans-serif",
    fontSize="0.74rem", fontWeight=600,
    textTransform="uppercase", letterSpacing="0.06em",
    color="#64748B", border="none",
    borderBottom="2px solid transparent",
    borderRadius=0, padding="0.45rem 1rem",
    backgroundColor="transparent",
)
_TAB_SEL = {**_TAB_STYLE, "color": ANAC_BLUE, "borderBottom": f"2px solid {ANAC_BLUE}"}

# Cores por empresa dominante (para nós do grafo Cytoscape)
AIRLINE_COLORS = {
    "TAM": "#E1051E", "GLO": "#FF6B00", "AZU": "#2C5CC5",
    "VRG": "#FF8C00", "ONE": "#7B2D2D", "PTB": "#C89600",
}

CYTO_STYLESHEET = [
    {"selector": "node", "style": {
        "label": "data(label)",
        "width": "data(size)", "height": "data(size)",
        "background-color": "data(color)",
        "border-width": 2, "border-color": "white",
        "font-size": "9px", "color": "#0F172A",
        "text-valign": "center", "text-halign": "center",
        "text-outline-width": "1.5px",
        "text-outline-color": "rgba(255,255,255,0.9)",
        "cursor": "grab",
    }},
    {"selector": "edge", "style": {
        "width": "data(weight)",
        "line-color": "#94A3B8",
        "opacity": 0.35,
        "curve-style": "haystack",
    }},
    {"selector": "node:selected", "style": {
        "border-width": 4, "border-color": "#C89600",
        "z-compound-depth": "top",
    }},
    {"selector": "node:grabbed", "style": {
        "border-color": "#C89600", "cursor": "grabbing",
    }},
]

# ---------------------------------------------------------------------------
# Carregamento de dados
# ---------------------------------------------------------------------------

def _load_stats() -> pd.DataFrame:
    return pd.read_parquet(CACHE / "stats_v2.parquet")


def _load_percentuais() -> pd.DataFrame:
    df = pd.read_parquet(CACHE / "percentuais_mes.parquet")
    df.columns = df.columns.str.strip()
    if "sigla" not in df.columns:
        df["sigla"] = df["Empresa_Aerea"].str.extract(r"^([A-Z0-9]{2,4})\s*-")
    return df


def _load_aerodromos() -> pd.DataFrame:
    return pd.read_parquet(CACHE / "aerodromos.parquet")


print("Carregando dados…", flush=True)
DF  = _load_stats()
DFP = _load_percentuais()
DFA = _load_aerodromos()

ANO_MIN = int(DF["ANO"].min())
ANO_MAX = int(DF["ANO"].max())

_AERO_COORDS = (
    DFA.drop_duplicates(subset="Código OACI")
    .set_index("Código OACI")[["lat", "lon", "Nome", "UF", "Município"]]
    .to_dict("index")
)

print("Iniciando Dash…", flush=True)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _stats_sbpa(df: pd.DataFrame, aeroporto: str) -> pd.DataFrame:
    return df[df["AEROPORTO_DE_ORIGEM_SIGLA"] == aeroporto]


def _kpi(titulo: str, valor: str, sub: str, icon: str, color: str = ANAC_BLUE):
    return dbc.Col(
        dbc.Card(dbc.CardBody([
            html.Div(icon, className="kpi-icon"),
            html.Div(titulo, className="kpi-label"),
            html.Div(valor,  className="kpi-value"),
            html.Div(sub,    className="kpi-sub"),
        ]), style={"borderTop": f"3px solid {color}"}),
        xs=6, md=3, className="mb-2",
    )


def _section(title: str, *children):
    return html.Div([
        html.Div(title, className="section-title"),
        *children,
    ], className="section-card")


def build_route_graph(df, focus_airport=None, max_routes=200):
    """Aggregate O-D pairs with coords. Returns enriched OD DataFrame.

    √-scaling pax is used by callers for sizing (area ∝ volume, not radius).
    Routes capped at max_routes by descending passenger volume.
    """
    od = (
        df.groupby(["AEROPORTO_DE_ORIGEM_SIGLA", "AEROPORTO_DE_DESTINO_SIGLA"])
        .agg(pax=("PASSAGEIROS_PAGOS", "sum"))
        .reset_index()
        .rename(columns={
            "AEROPORTO_DE_ORIGEM_SIGLA": "origem",
            "AEROPORTO_DE_DESTINO_SIGLA": "destino",
        })
    )
    od = od[od["pax"] > 0].sort_values("pax", ascending=False).head(max_routes)

    def _c(icao, field, default=""):
        return _AERO_COORDS.get(icao, {}).get(field, default)

    for col, side in [("o", "origem"), ("d", "destino")]:
        od[f"lat_{col}"]  = od[side].apply(lambda x: _c(x, "lat"))
        od[f"lon_{col}"]  = od[side].apply(lambda x: _c(x, "lon"))
        od[f"nome_{col}"] = od[side].apply(lambda x: _c(x, "Município") or x)
        od[f"uf_{col}"]   = od[side].apply(lambda x: _c(x, "UF"))

    od = od.dropna(subset=["lat_o", "lon_o", "lat_d", "lon_d"])
    od["is_focus"] = (
        (od["origem"] == focus_airport) | (od["destino"] == focus_airport)
        if focus_airport else False
    )
    return od


def _great_circle_path(lat1, lon1, lat2, lon2, n=30):
    """Retorna (lats, lons) com n pontos ao longo do grande círculo entre dois pontos.

    Usa slerp (interpolação esférica) para curvar os arcos corretamente no Mercator.
    Sem isso, as rotas aparecem como retas que 'cortam' o Brasil em vez de curvarem.
    """
    la1, lo1, la2, lo2 = np.radians([lat1, lon1, lat2, lon2])
    v1 = np.array([np.cos(la1)*np.cos(lo1), np.cos(la1)*np.sin(lo1), np.sin(la1)])
    v2 = np.array([np.cos(la2)*np.cos(lo2), np.cos(la2)*np.sin(lo2), np.sin(la2)])
    omega = np.arccos(np.clip(v1 @ v2, -1.0, 1.0))
    if omega < 1e-8:
        return [lat1, lat2], [lon1, lon2]
    t = np.linspace(0, 1, n)
    s = np.sin(omega)
    pts = np.outer(np.sin((1 - t) * omega) / s, v1) + np.outer(np.sin(t * omega) / s, v2)
    lats = np.degrees(np.arcsin(np.clip(pts[:, 2], -1, 1)))
    lons = np.degrees(np.arctan2(pts[:, 1], pts[:, 0]))
    return lats.tolist(), lons.tolist()


# ---------------------------------------------------------------------------
# Aeroportos disponíveis (dropdown)
# ---------------------------------------------------------------------------

_pax_por_aero = (
    DF.groupby("AEROPORTO_DE_ORIGEM_SIGLA")["PASSAGEIROS_PAGOS"]
    .sum().nlargest(120).index.tolist()
)
AERO_OPTS = []
for icao in sorted(_pax_por_aero):
    info = _AERO_COORDS.get(icao, {})
    mun, uf = info.get("Município", ""), info.get("UF", "")
    label = f"{icao} — {mun}/{uf}" if mun else icao
    AERO_OPTS.append({"label": label, "value": icao})

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = dash.Dash(
    __name__,
    external_stylesheets=[
        dbc.themes.BOOTSTRAP,
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
    ],
    title="Panorama da Aviação — ANAC",
    meta_tags=[{"name": "viewport", "content": "width=device-width, initial-scale=1"}],
)
server = app.server

# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------

app.layout = dbc.Container([

    # ── Cabeçalho ──────────────────────────────────────────────────────────
    html.Div([
        dbc.Row([
            dbc.Col(html.Div([
                html.Span("✈ ", style={"color": GOLD}),
                html.Span("Panorama da Aviação Doméstica Brasileira",
                          className="header-title"),
            ])),
            dbc.Col([
                html.Span("Dados Abertos ANAC", className="badge-anac"),
                html.Span(" · 2000–2026", className="header-sub ms-2"),
            ], className="d-flex align-items-center justify-content-end"),
        ], align="center"),
    ], className="app-header mb-2"),

    # ── Filtros ────────────────────────────────────────────────────────────
    dbc.Card(dbc.CardBody(
        dbc.Row([
            dbc.Col([
                html.Div("Período de análise", className="filter-label"),
                dcc.RangeSlider(
                    id="sl-ano",
                    min=ANO_MIN, max=ANO_MAX, step=1,
                    value=[2016, ANO_MAX],
                    marks={y: {"label": str(y), "style": {"fontSize": "10px"}}
                           for y in range(ANO_MIN, ANO_MAX + 1, 4)},
                    tooltip={"placement": "bottom", "always_visible": False},
                    className="px-0",
                ),
            ], md=8),
            dbc.Col([
                html.Div("Aeroporto de referência", className="filter-label"),
                dcc.Dropdown(
                    id="dd-aero",
                    options=AERO_OPTS,
                    value="SBPA",
                    clearable=False,
                    style={"fontSize": "13px"},
                ),
            ], md=4),
        ], align="center"),
    ), className="filter-card mb-2"),

    # ── KPIs ───────────────────────────────────────────────────────────────
    dbc.Row(id="kpi-row", className="mb-2"),

    # ── Viz 2: Série Temporal ──────────────────────────────────────────────
    _section("Passageiros mensais — Nacional vs. aeroporto selecionado",
        dcc.Loading(
            dcc.Graph(id="g-serie", config={"displayModeBar": False}),
            type="dot", color=ANAC_LIGHT,
        ),
    ),

    # ── Viz 1 + Viz 3 ─────────────────────────────────────────────────────
    dbc.Row([
        dbc.Col(
            _section("Aeroportos — volume de passageiros",
                dcc.Loading(
                    dcc.Graph(id="g-mapa", config={"displayModeBar": False}),
                    type="dot", color=ANAC_LIGHT,
                ),
            ),
            md=6, className="pe-md-1",
        ),
        dbc.Col(
            _section("Atrasos no aeroporto selecionado — % voos >30 min por mês/ano",
                dcc.Loading(
                    dcc.Graph(id="g-heat", config={"displayModeBar": False}),
                    type="dot", color=ANAC_LIGHT,
                ),
            ),
            md=6, className="ps-md-1",
        ),
    ], className="mb-0"),

    # ── Viz 4 + Viz 5: Scatter e Top Rotas ────────────────────────────────
    dbc.Row([
        dbc.Col(
            _section("Market share × Pontualidade — empresas no aeroporto",
                dcc.Loading(
                    dcc.Graph(id="g-scatter", config={"displayModeBar": False}),
                    type="dot", color=ANAC_LIGHT,
                ),
            ),
            md=6, className="pe-md-1",
        ),
        dbc.Col(
            _section("Top 5 rotas a partir do aeroporto selecionado",
                dcc.Loading(
                    dcc.Graph(id="g-rotas", config={"displayModeBar": False}),
                    type="dot", color=ANAC_LIGHT,
                ),
            ),
            md=6, className="ps-md-1",
        ),
    ], className="mb-0"),

    # ── Viz 6–8: Rede de rotas ────────────────────────────────────────────
    _section("Rede de rotas — malha da aviação doméstica",
        dcc.Tabs(
            id="tabs-rede", value="tab-mapa",
            children=[
                dcc.Tab(
                    label="Mapa de rotas", value="tab-mapa",
                    children=dcc.Loading(
                        dcc.Graph(id="g-routemap", config={"displayModeBar": False}),
                        type="dot", color=ANAC_LIGHT,
                    ),
                    style=_TAB_STYLE, selected_style=_TAB_SEL,
                ),
                dcc.Tab(
                    label="Grafo de conexões", value="tab-network",
                    children=html.Div([
                        cyto.Cytoscape(
                            id="g-network",
                            layout={
                                "name": "cose-bilkent",
                                "nodeRepulsion": 4500,
                                "animate": True,
                                "animationDuration": 800,
                                "randomize": True,
                                "fit": True,
                                "padding": 20,
                            },
                            style={"width": "100%", "height": "520px"},
                            elements=[],
                            stylesheet=CYTO_STYLESHEET,
                            userPanningEnabled=True,
                            userZoomingEnabled=True,
                            autoungrabify=False,
                            minZoom=0.2,
                            maxZoom=3.0,
                        ),
                        html.Div(
                            "Clique em um nó para selecionar o aeroporto · Arraste para reorganizar · Scroll para zoom",
                            style={"fontSize": "0.68rem", "color": "#94A3B8",
                                   "textAlign": "center", "paddingTop": "4px"},
                        ),
                    ]),
                    style=_TAB_STYLE, selected_style=_TAB_SEL,
                ),
                dcc.Tab(
                    label="Matriz O-D", value="tab-sankey",
                    children=dcc.Loading(
                        dcc.Graph(id="g-sankey", config={"displayModeBar": False}),
                        type="dot", color=ANAC_LIGHT,
                    ),
                    style=_TAB_STYLE, selected_style=_TAB_SEL,
                ),
            ],
        ),
    ),

    # ── Rodapé ─────────────────────────────────────────────────────────────
    html.Footer(
        html.Div("Dados: ANAC — Agência Nacional de Aviação Civil · "
                 "Aviação doméstica regular · Dados públicos",
                 className="text-center footer-text"),
        className="app-footer mt-2",
    ),

], fluid=True, className="px-3 px-md-4 py-2")


# ---------------------------------------------------------------------------
# Callback único
# ---------------------------------------------------------------------------

@app.callback(
    Output("kpi-row",    "children"),
    Output("g-serie",    "figure"),
    Output("g-mapa",     "figure"),
    Output("g-heat",     "figure"),
    Output("g-scatter",  "figure"),
    Output("g-rotas",    "figure"),
    Output("g-routemap", "figure"),
    Output("g-network",  "elements"),
    Output("g-sankey",   "figure"),
    Input("sl-ano",  "value"),
    Input("dd-aero", "value"),
)
def update_all(anos, aeroporto):
    ano_ini, ano_fim = anos or [2016, ANO_MAX]
    aeroporto = aeroporto or "SBPA"

    df  = DF[(DF["ANO"] >= ano_ini) & (DF["ANO"] <= ano_fim)]
    dfp = DFP[(DFP["ano"] >= ano_ini) & (DFP["ano"] <= ano_fim)]

    kpis     = _build_kpis(df, dfp, aeroporto, ano_fim)
    serie    = _fig_serie(df, aeroporto, ano_ini, ano_fim)
    mapa     = _fig_mapa(df, aeroporto)
    heat     = _fig_heatmap(dfp, aeroporto, ano_ini, ano_fim)
    scatter  = _fig_scatter(df, dfp, aeroporto)
    rotas    = _fig_top_rotas(df, aeroporto)
    routemap = _fig_route_map(df, aeroporto)
    network  = _build_cyto_elements(df)
    od_mat   = _fig_od_matrix(df, aeroporto)

    return kpis, serie, mapa, heat, scatter, rotas, routemap, network, od_mat


@app.callback(
    Output("dd-aero", "value"),
    Input("g-network", "tapNodeData"),
    prevent_initial_call=True,
)
def on_node_click(node_data):
    if node_data and node_data.get("id") in {o["value"] for o in AERO_OPTS}:
        return node_data["id"]
    return dash.no_update


# ---------------------------------------------------------------------------
# KPIs
# ---------------------------------------------------------------------------

def _build_kpis(df, dfp, aeroporto, ano_fim):
    info = _AERO_COORDS.get(aeroporto, {})
    nome = info.get("Município", aeroporto)

    df_aero  = _stats_sbpa(df, aeroporto)
    pax_aero = int(df_aero["PASSAGEIROS_PAGOS"].sum())
    pax_str  = f"{pax_aero/1e6:.1f} M" if pax_aero >= 500_000 else f"{pax_aero/1e3:.0f} K"

    # Variação YTD: compara meses disponíveis no ano mais recente
    df_all = _stats_sbpa(DF, aeroporto)
    meses_disponiveis = sorted(df_all[df_all["ANO"] == ano_fim]["MES"].unique())
    pax_cur = float(df_all[df_all["ANO"] == ano_fim]["PASSAGEIROS_PAGOS"].sum())

    if meses_disponiveis and pax_cur > 0:
        mes_max  = max(meses_disponiveis)
        pax_cur  = float(df_all[(df_all["ANO"] == ano_fim) & (df_all["MES"] <= mes_max)]["PASSAGEIROS_PAGOS"].sum())
        pax_prev = float(df_all[(df_all["ANO"] == ano_fim - 1) & (df_all["MES"] <= mes_max)]["PASSAGEIROS_PAGOS"].sum())
        var     = (pax_cur / pax_prev - 1) * 100 if pax_prev > 0 else 0
        mes_nome = MESES_BR[mes_max - 1]
        var_str  = f"{'+' if var >= 0 else ''}{var:.1f}%"
        var_sub  = f"jan–{mes_nome} {ano_fim} vs. {ano_fim - 1}"
    else:
        # Fallback: variação entre os dois últimos anos completos com volume significativo
        anos_aero = df_all.groupby("ANO")["PASSAGEIROS_PAGOS"].sum()
        anos_ok   = sorted(a for a, v in anos_aero.items() if v > 10_000 and a != ano_fim)
        if len(anos_ok) >= 2:
            y1, y2  = anos_ok[-2], anos_ok[-1]
            p1, p2  = float(anos_aero[y1]), float(anos_aero[y2])
            var     = (p2 / p1 - 1) * 100
            var_str = f"{'+' if var >= 0 else ''}{var:.1f}%"
            var_sub = f"ano completo {y1} → {y2}"
        else:
            var, var_str = 0, "n/d"
            var_sub = "dados insuficientes"

    # Empresa líder no aeroporto (período)
    if not df_aero.empty:
        lider_sig = df_aero.groupby("EMPRESA_SIGLA")["PASSAGEIROS_PAGOS"].sum().idxmax()
        lider = EMPRESA_LABEL.get(lider_sig, lider_sig)
    else:
        lider, lider_sig = "—", "—"
    lider_share = (
        df_aero[df_aero["EMPRESA_SIGLA"] == lider_sig]["PASSAGEIROS_PAGOS"].sum()
        / max(pax_aero, 1) * 100
    )

    # Pontualidade no aeroporto (percentuais)
    dfp_aero = dfp[dfp["Aeroporto_Origem_Designador_OACI"] == aeroporto]
    if not dfp_aero.empty:
        atraso_med = dfp_aero["Percentuais_de_Atrasos_superiores_a_30_minutos"].mean()
        pont_str = f"{100 - atraso_med:.1f}%"
        pont_sub = f"{atraso_med:.1f}% dos voos atrasam >30 min"
    else:
        pont_str, pont_sub = "—", "sem dados"

    color_var = "#16A34A" if var >= 0 else RED_EVENT

    return [
        _kpi(f"Passageiros em {nome}", pax_str,
             "no período selecionado", "✈", ANAC_BLUE),
        _kpi("Variação ano a ano (YTD)", var_str,
             var_sub, "📈", color_var),
        _kpi("Empresa líder", lider,
             f"{lider_share:.0f}% do mercado local", "🏢", GOLD),
        _kpi("Pontualidade (partidas)", pont_str,
             pont_sub, "🕐", ANAC_LIGHT),
    ]


# ---------------------------------------------------------------------------
# Viz 2 — Série temporal: Nacional vs. aeroporto
# ---------------------------------------------------------------------------

def _fig_serie(df, aeroporto, ano_ini, ano_fim):
    nacional = df.groupby("DATA")["PASSAGEIROS_PAGOS"].sum().reset_index()
    nacional["mm24"] = nacional["PASSAGEIROS_PAGOS"].rolling(24, center=True, min_periods=10).mean()

    aero_df = _stats_sbpa(df, aeroporto).groupby("DATA")["PASSAGEIROS_PAGOS"].sum().reset_index()
    aero_df["mm24"] = aero_df["PASSAGEIROS_PAGOS"].rolling(24, center=True, min_periods=10).mean()

    info = _AERO_COORDS.get(aeroporto, {})
    nome_aero = info.get("Município", aeroporto)

    # Escala adaptativa: aeroportos pequenos (<500 K pax/mês) usam K em vez de M
    aero_max = float(aero_df["PASSAGEIROS_PAGOS"].max()) if not aero_df.empty else 0
    scale2   = 1e3 if aero_max < 500_000 else 1e6
    unit2    = "K"  if aero_max < 500_000 else "M"

    # Sem subplot_titles para não duplicar com o section-title externo
    fig = make_subplots(rows=1, cols=2, horizontal_spacing=0.06)

    # Rótulos internos dos subplots
    fig.add_annotation(x=0.23, y=0.96, xref="paper", yref="paper",
                       text="🇧🇷 Brasil — total doméstico", showarrow=False,
                       font=dict(size=9, color="#64748B"), xanchor="center", yanchor="top")
    fig.add_annotation(x=0.77, y=0.96, xref="paper", yref="paper",
                       text=f"✈ {aeroporto} / {nome_aero}", showarrow=False,
                       font=dict(size=9, color="#64748B"), xanchor="center", yanchor="top")

    for col, data, color, label, scale, unit in [
        (1, nacional, ANAC_LIGHT, "Nacional", 1e6,    "M"),
        (2, aero_df,  GOLD,       aeroporto,  scale2, unit2),
    ]:
        fill_color = f"rgba({int(color[1:3],16)},{int(color[3:5],16)},{int(color[5:7],16)},0.12)"
        fig.add_trace(go.Scatter(
            x=data["DATA"], y=data["PASSAGEIROS_PAGOS"] / scale,
            fill="tozeroy", mode="lines",
            line=dict(color=color, width=1.2),
            fillcolor=fill_color,
            name=label,
            hovertemplate=f"%{{x|%b/%Y}}  %{{y:.2f}} {unit} pax<extra></extra>",
            showlegend=False,
        ), row=1, col=col)

        fig.add_trace(go.Scatter(
            x=data["DATA"], y=data["mm24"] / scale,
            mode="lines",
            line=dict(color=color, width=2.5, dash="dot"),
            name=f"Tendência {label}",
            hovertemplate=f"%{{x|%b/%Y}}  %{{y:.2f}} {unit} (MM24)<extra></extra>",
            showlegend=False,
        ), row=1, col=col)

        # Faixas sombreadas em ambos os subplots
        if ano_ini <= 2020 <= ano_fim:
            fig.add_vrect(x0="2020-03-01", x1="2021-09-01",
                fillcolor="rgba(220,38,38,0.05)", layer="below", line_width=0,
                row=1, col=col)
        if ano_ini <= 2024 <= ano_fim:
            fig.add_vrect(x0="2024-05-01", x1="2025-01-01",
                fillcolor="rgba(234,88,12,0.07)", layer="below", line_width=0,
                row=1, col=col)

    # Linhas de evento em ambos os subplots
    for xref_ev in ["x", "x2"]:
        for data_str, ev_label in [
            ("2020-03-01", "COVID-19"),
            ("2024-05-01", "Enchentes RS"),
        ]:
            ts = pd.Timestamp(data_str)
            if not (pd.Timestamp(str(ano_ini)) <= ts <= pd.Timestamp(str(ano_fim))):
                continue
            color_ann = RED_EVENT if "COVID" in ev_label else ORANGE_EVENT
            fig.add_shape(
                type="line",
                xref=xref_ev, yref="paper",
                x0=ts, x1=ts, y0=0.0, y1=0.88,
                line=dict(color=color_ann, width=1.2, dash="dot"),
            )
            # Texto apenas no subplot esquerdo para não duplicar
            if xref_ev == "x":
                fig.add_annotation(
                    x=ts, y=0.89,
                    xref=xref_ev, yref="paper",
                    text=f" {ev_label}",
                    showarrow=False,
                    xanchor="left", yanchor="bottom",
                    font=dict(size=8, color=color_ann, weight=700),
                    bgcolor="rgba(255,255,255,0.85)",
                    borderpad=2,
                )

    # Legenda compacta das faixas sombreadas
    legend_parts = []
    if ano_ini <= 2020 <= ano_fim:
        legend_parts.append(f'<span style="color:{RED_EVENT}">▌</span> COVID-19')
    if ano_ini <= 2024 <= ano_fim:
        legend_parts.append(f'<span style="color:{ORANGE_EVENT}">▌</span> Enchentes RS')
    if legend_parts:
        fig.add_annotation(
            x=0.47, y=0.03,
            xref="paper", yref="paper",
            text="  ".join(legend_parts),
            showarrow=False,
            xanchor="right", yanchor="bottom",
            font=dict(size=8, color="#64748B"),
            bgcolor="rgba(255,255,255,0.88)",
            borderpad=3,
        )

    fig.update_layout(
        **LAYOUT_BASE, height=240, hovermode="x unified",
        yaxis=dict(title="Passageiros (M)", gridcolor="#F1F5F9", zeroline=False),
        yaxis2=dict(title=f"Passageiros ({unit2})", gridcolor="#F1F5F9", zeroline=False),
        xaxis=dict(showgrid=False),
        xaxis2=dict(showgrid=False),
    )
    return fig


# ---------------------------------------------------------------------------
# Viz 1 — Mapa de bolhas: passageiros por aeroporto
# ---------------------------------------------------------------------------

def _fig_mapa(df, aeroporto):
    pax = (df.groupby("AEROPORTO_DE_ORIGEM_SIGLA")["PASSAGEIROS_PAGOS"]
           .sum().reset_index()
           .rename(columns={"AEROPORTO_DE_ORIGEM_SIGLA": "icao",
                            "PASSAGEIROS_PAGOS": "pax"}))

    aero_df = DFA.rename(columns={"Código OACI": "icao"})
    merged  = aero_df.merge(pax, on="icao", how="inner")
    merged  = merged[merged["pax"] > 0]

    merged["is_ref"] = merged["icao"] == aeroporto

    # Tamanho proporcional a passageiros: escala cúbica (mais contraste que log)
    pax_max = merged["pax"].max()
    merged["marker_size"] = ((merged["pax"] / pax_max) ** 0.4 * 36).clip(4, 36)

    fig = go.Figure()

    # Outros aeroportos
    outros = merged[~merged["is_ref"]]
    fig.add_trace(go.Scattergeo(
        lat=outros["lat"], lon=outros["lon"],
        mode="markers",
        marker=dict(
            size=outros["marker_size"],
            color=ANAC_LIGHT,
            opacity=0.65,
            line=dict(color="white", width=0.5),
        ),
        text=outros.apply(lambda r: (
            f"<b>{r['icao']}</b> — {r['Nome']}<br>"
            f"{r['Município']}/{r['UF']}<br>"
            f"Passageiros: {r['pax']/1e6:.1f} M"
        ), axis=1),
        hoverinfo="text",
        showlegend=False,
    ))

    # Aeroporto de referência (dourado, maior)
    ref = merged[merged["is_ref"]]
    if not ref.empty:
        fig.add_trace(go.Scattergeo(
            lat=ref["lat"], lon=ref["lon"],
            mode="markers+text",
            marker=dict(
                size=ref["marker_size"] * 1.4,
                color=GOLD,
                opacity=1.0,
                line=dict(color="white", width=1.5),
                symbol="circle",
            ),
            text=ref["icao"],
            textposition="top right",
            textfont=dict(size=11, color=GOLD, family="Inter"),
            hovertext=ref.apply(lambda r: (
                f"<b>{r['icao']}</b> ★ Aeroporto selecionado<br>"
                f"{r['Nome']}<br>{r['Município']}/{r['UF']}<br>"
                f"Passageiros: {r['pax']/1e6:.1f} M"
            ), axis=1),
            hoverinfo="text",
            showlegend=False,
        ))

    fig.update_geos(
        scope="south america",
        showcountries=True, countrycolor="#DDD",
        showsubunits=True,  subunitcolor="#CCC",
        showland=True,      landcolor="#F8F9FA",
        showocean=True,     oceancolor="#EBF4FB",
        fitbounds="locations",
        projection_type="mercator",
    )
    fig.update_layout(
        **{**LAYOUT_BASE, "margin": dict(t=10, b=0, l=0, r=0)},
        height=390,
    )
    return fig


# ---------------------------------------------------------------------------
# Viz 3 — Heatmap: % atrasos >30 min por mês × ano no aeroporto
# ---------------------------------------------------------------------------

def _fig_heatmap(dfp, aeroporto, ano_ini, ano_fim):
    info = _AERO_COORDS.get(aeroporto, {})
    nome = info.get("Município", aeroporto)

    sub = dfp[dfp["Aeroporto_Origem_Designador_OACI"] == aeroporto].copy()

    if sub.empty:
        fig = go.Figure()
        fig.add_annotation(text="Sem dados de percentuais para este aeroporto.",
                           xref="paper", yref="paper", x=0.5, y=0.5, showarrow=False)
        fig.update_layout(**LAYOUT_BASE, height=390)
        return fig

    pivot = (sub.groupby(["ano", "mes"])["Percentuais_de_Atrasos_superiores_a_30_minutos"]
               .mean().unstack("mes")
               .reindex(columns=range(1, 13)))

    # Descending: 2026 no topo (mais recente), default plotly coloca o último item no topo
    anos_disp = sorted(pivot.index.tolist())           # ascendente [2016..2026]
    anos_desc = list(reversed(anos_disp))              # [2026..2016]
    z_values  = pivot.reindex(anos_desc).values        # reordena linhas

    # Escala dinâmica: usa p80 (não p95) — espalha mais cor na faixa típica
    col_pct = sub["Percentuais_de_Atrasos_superiores_a_30_minutos"].dropna()
    p80 = float(col_pct.quantile(0.80))
    zmax_dyn = max(10, min(round(p80 / 2) * 2, 30))   # múltiplo de 2, cap 30

    fig = go.Figure(go.Heatmap(
        z=z_values,
        x=MESES_BR,
        y=[str(a) for a in anos_desc],
        colorscale=[
            [0.0,  "#22C55E"],
            [0.3,  "#A3E635"],
            [0.55, "#FCD34D"],
            [0.78, "#F97316"],
            [1.0,  "#DC2626"],
        ],
        zmin=0, zmax=zmax_dyn,
        colorbar=dict(
            title=dict(text="% voos<br>atrasados<br>>30 min", font=dict(size=9)),
            thickness=12, len=0.85,
            tickvals=[0, zmax_dyn * 0.25, zmax_dyn * 0.5, zmax_dyn * 0.75, zmax_dyn],
            ticktext=["0%", f"{zmax_dyn*0.25:.0f}%", f"{zmax_dyn*0.5:.0f}%",
                      f"{zmax_dyn*0.75:.0f}%", f"{zmax_dyn:.0f}%"],
        ),
        hovertemplate="<b>%{y} — %{x}</b><br>%{z:.1f}% dos voos atrasaram >30 min<extra></extra>",
        xgap=2, ygap=2,
    ))

    # Marca anos especiais: shapes usam índice na lista anos_desc (desc)
    for ano_mark, color, label, dash in [
        (2024, ORANGE_EVENT, "Enchentes RS", "solid"),
        (2020, RED_EVENT,    "COVID-19",     "dot"),
    ]:
        if ano_mark not in anos_desc:
            continue
        idx = anos_desc.index(ano_mark)     # posição correta no eixo y descendente
        fig.add_shape(
            type="rect",
            x0=-0.5, x1=len(MESES_BR) - 0.5,
            y0=idx - 0.5, y1=idx + 0.5,
            line=dict(color=color, width=2, dash=dash),
            layer="above",
        )
        fig.add_annotation(
            x=len(MESES_BR) - 0.5, y=idx,
            text=f" {label}",
            showarrow=False,
            xanchor="left",
            font=dict(size=8, color=color, weight=700),
        )

    fig.update_layout(
        **{**LAYOUT_BASE, "margin": dict(t=10, b=30, l=44, r=90)},
        height=390,
        xaxis=dict(side="bottom"),
        yaxis=dict(
            type="category",
            tickmode="array",
            tickvals=[str(a) for a in anos_desc],
            ticktext=[str(a) for a in anos_desc],
        ),
    )
    return fig


# ---------------------------------------------------------------------------
# Viz 4 — Scatter: market share × pontualidade no aeroporto
# ---------------------------------------------------------------------------

def _fig_scatter(df, dfp, aeroporto):
    # Market share no aeroporto
    df_a = _stats_sbpa(df, aeroporto)
    if df_a.empty:
        fig = go.Figure()
        fig.add_annotation(text="Sem dados de estatísticas para este aeroporto.",
                           xref="paper", yref="paper", x=0.5, y=0.5, showarrow=False)
        fig.update_layout(**LAYOUT_BASE, height=340)
        return fig

    pax_total = df_a["PASSAGEIROS_PAGOS"].sum()
    ms = (df_a.groupby("EMPRESA_SIGLA")["PASSAGEIROS_PAGOS"].sum() / pax_total * 100).reset_index()
    ms.columns = ["sig", "market_share"]
    ms = ms[ms["market_share"] >= 0.5]

    # Pontualidade no aeroporto
    dfp_a = dfp[dfp["Aeroporto_Origem_Designador_OACI"] == aeroporto].copy()
    pont = (dfp_a.groupby("sigla")["Percentuais_de_Atrasos_superiores_a_30_minutos"]
            .mean().reset_index())
    pont.columns = ["sig", "pct_atraso"]
    pont["pontualidade"] = 100 - pont["pct_atraso"]
    pont["sig"] = pont["sig"].str.strip()

    merged = ms.merge(pont, on="sig", how="inner")
    if merged.empty:
        fig = go.Figure()
        fig.add_annotation(text="Não há dados suficientes para cruzar market share e pontualidade.",
                           xref="paper", yref="paper", x=0.5, y=0.5, showarrow=False)
        fig.update_layout(**LAYOUT_BASE, height=340)
        return fig

    med_ms   = merged["market_share"].mean()
    med_pont = merged["pontualidade"].mean()
    x_max    = merged["market_share"].max() * 1.12
    y_min    = max(30, merged["pontualidade"].min() - 5)
    y_max    = 100

    top5_sigs = set(merged.nlargest(5, "market_share")["sig"])

    fig = go.Figure()

    # Quadrantes (fundo suave)
    for x0, x1, y0, y1, color in [
        (-1,     med_ms,  med_pont, y_max, "rgba(34,197,94,0.06)"),
        (med_ms, x_max,   med_pont, y_max, "rgba(37,99,235,0.06)"),
        (-1,     med_ms,  y_min,    med_pont, "rgba(251,191,36,0.06)"),
        (med_ms, x_max,   y_min,    med_pont, "rgba(220,38,38,0.06)"),
    ]:
        fig.add_shape(type="rect", x0=x0, x1=x1, y0=y0, y1=y1,
                      fillcolor=color, line_width=0, layer="below")

    # Linhas de quadrante
    fig.add_hline(y=med_pont, line_dash="dash", line_color="#94A3B8", line_width=1)
    fig.add_vline(x=med_ms,   line_dash="dash", line_color="#94A3B8", line_width=1)

    # Labels de quadrante — y posicionado dentro do range visível
    y_top_label = med_pont + (y_max    - med_pont) * 0.75
    y_bot_label = y_min   + (med_pont  - y_min)    * 0.18
    x_left      = med_ms  * 0.4
    x_right     = med_ms  + (x_max - med_ms) * 0.5
    for x, y, txt in [
        (x_left,  y_top_label, "pontual · nicho"),
        (x_right, y_top_label, "pontual · dominante"),
        (x_left,  y_bot_label, "atrasada · nicho"),
        (x_right, y_bot_label, "atrasada · dominante"),
    ]:
        fig.add_annotation(x=x, y=y, text=txt, showarrow=False,
                           font=dict(size=8, color="#94A3B8"), xanchor="center")

    # Detecta pares próximos para alternar posição do texto
    def _text_pos(sig, ms, pont):
        # Encontra se outro ponto está perto (<4% MS e <3% pont)
        others = merged[(merged["sig"] != sig) &
                        (abs(merged["market_share"] - ms) < 4) &
                        (abs(merged["pontualidade"] - pont) < 3)]
        if others.empty:
            return "top center"
        # Se o ponto tem maior pontualidade que o vizinho próximo → "top center",
        # senão → "bottom center"
        return "top center" if pont >= others["pontualidade"].max() else "bottom center"

    # Pontos — texto apenas para as top-5 por market share (evita sobreposição no cluster pequeno)
    for _, row in merged.iterrows():
        sig        = row["sig"]
        label      = EMPRESA_LABEL.get(sig, sig)
        is_ref     = sig == "PTB"
        color      = CORES.get(sig, "#94A3B8")
        size       = 16 if is_ref else 12
        show_label = sig in top5_sigs
        tpos       = _text_pos(sig, row["market_share"], row["pontualidade"])

        fig.add_trace(go.Scatter(
            x=[row["market_share"]],
            y=[row["pontualidade"]],
            mode="markers+text" if show_label else "markers",
            marker=dict(size=size, color=color,
                        line=dict(color="white", width=1.5)),
            text=[label] if show_label else [""],
            textposition=tpos,
            textfont=dict(size=10, color=color),
            hovertemplate=(
                f"<b>{label}</b><br>"
                f"Market share: %{{x:.1f}}%<br>"
                f"Pontualidade: %{{y:.1f}}%<extra></extra>"
            ),
            showlegend=False,
        ))

    fig.update_layout(
        **LAYOUT_BASE,
        height=340,
        xaxis=dict(title="Market share (%)", gridcolor="#F1F5F9",
                   zeroline=False, range=[0, x_max]),
        yaxis=dict(title="Pontualidade (%)", gridcolor="#F1F5F9",
                   zeroline=False, range=[y_min, y_max]),
        hovermode="closest",
    )
    return fig


# ---------------------------------------------------------------------------
# Viz 5 — Top 5 rotas a partir do aeroporto selecionado
# ---------------------------------------------------------------------------

def _fig_top_rotas(df, aeroporto):
    df_a = df[df["AEROPORTO_DE_ORIGEM_SIGLA"] == aeroporto].copy()

    if df_a.empty:
        fig = go.Figure()
        fig.add_annotation(text="Sem dados para este aeroporto.",
                           xref="paper", yref="paper", x=0.5, y=0.5, showarrow=False)
        fig.update_layout(**LAYOUT_BASE, height=340)
        return fig

    top = (
        df_a.groupby("AEROPORTO_DE_DESTINO_SIGLA")["PASSAGEIROS_PAGOS"]
        .sum().nlargest(5).reset_index()
        .rename(columns={"AEROPORTO_DE_DESTINO_SIGLA": "dest",
                         "PASSAGEIROS_PAGOS": "pax"})
    )

    def _label(icao):
        info = _AERO_COORDS.get(icao, {})
        mun  = info.get("Município", "")
        uf   = info.get("UF", "")
        return f"{icao} · {mun}/{uf}" if mun else icao

    top["label"] = top["dest"].apply(_label)

    # Cores: destaque para o maior
    cores = [ANAC_BLUE if i == 0 else ANAC_LIGHT for i in range(len(top))]

    # Escala adaptativa: aeroportos pequenos usam K em vez de M
    pax_max_val = float(top["pax"].max())
    if pax_max_val < 500_000:
        unit_div   = 1_000
        title_axis = "Passageiros (K)"
        fmt_val    = lambda v: f"{v/1_000:.0f}K"
        hover_tmpl = "<b>%{y}</b><br>%{x:.0f} K passageiros<extra></extra>"
    else:
        unit_div   = 1_000_000
        title_axis = "Passageiros (M)"
        fmt_val    = lambda v: f"{v/1_000_000:.1f}M"
        hover_tmpl = "<b>%{y}</b><br>%{x:.2f} M passageiros<extra></extra>"

    fig = go.Figure(go.Bar(
        y=top["label"].iloc[::-1].values,
        x=top["pax"].iloc[::-1].values / unit_div,
        orientation="h",
        marker=dict(
            color=list(reversed(cores)),
            line=dict(width=0),
        ),
        text=top["pax"].iloc[::-1].apply(fmt_val).values,
        textposition="outside",
        textfont=dict(size=11, color="#334155"),
        hovertemplate=hover_tmpl,
    ))

    fig.update_layout(
        **{**LAYOUT_BASE, "margin": dict(t=10, b=30, l=10, r=55)},
        height=340,
        xaxis=dict(title=title_axis, gridcolor="#F1F5F9",
                   zeroline=False, showgrid=True),
        yaxis=dict(showgrid=False, automargin=True),
        bargap=0.35,
    )
    return fig


# ---------------------------------------------------------------------------
# Viz 6 — Mapa de rotas (arcos great-circle + hierarquia visual)
# ---------------------------------------------------------------------------

def _fig_route_map(df, aeroporto):
    od = build_route_graph(df, focus_airport=aeroporto)
    if od.empty:
        fig = go.Figure()
        fig.add_annotation(text="Sem dados de rotas para o período selecionado.",
                           xref="paper", yref="paper", x=0.5, y=0.5, showarrow=False,
                           font=dict(size=13, color="#64748B"))
        fig.update_layout(**LAYOUT_BASE, height=520)
        return fig

    pax_max = od["pax"].max()
    dim   = od[~od["is_focus"]].sort_values("pax", ascending=False).reset_index(drop=True)
    focus = od[od["is_focus"]].sort_values("pax").reset_index(drop=True)

    fig = go.Figure()

    # Rotas de fundo — hierarquia 3 tiers: top-10 visíveis, cauda quase invisível
    for sub, color, width, opacity in [
        (dim.iloc[:10],  "#475569", 0.8, 0.28),
        (dim.iloc[10:50],"#94A3B8", 0.5, 0.14),
        (dim.iloc[50:],  "#CBD5E1", 0.3, 0.06),
    ]:
        if sub.empty:
            continue
        lats, lons = [], []
        for _, r in sub.iterrows():
            al, aln = _great_circle_path(r["lat_o"], r["lon_o"], r["lat_d"], r["lon_d"], n=20)
            lats += al + [None]; lons += aln + [None]
        fig.add_trace(go.Scattergeo(
            lat=lats, lon=lons, mode="lines",
            line=dict(color=color, width=width),
            opacity=opacity, hoverinfo="none", showlegend=False,
        ))

    # Rotas do aeroporto selecionado — arcos curvos em 3 tiers de volume
    for lo, hi, width, opacity, color in [
        (0.00, 0.33, 1.2, 0.55, "#5BA4CF"),
        (0.33, 0.67, 2.4, 0.72, ANAC_LIGHT),
        (0.67, 1.01, 4.0, 0.90, ANAC_BLUE),
    ]:
        tier = focus[(focus["pax"] / pax_max >= lo) & (focus["pax"] / pax_max < hi)]
        if tier.empty:
            continue
        lats, lons = [], []
        for _, r in tier.iterrows():
            al, aln = _great_circle_path(r["lat_o"], r["lon_o"], r["lat_d"], r["lon_d"], n=30)
            lats += al + [None]; lons += aln + [None]
        fig.add_trace(go.Scattergeo(
            lat=lats, lon=lons, mode="lines",
            line=dict(color=color, width=width),
            opacity=opacity, hoverinfo="none", showlegend=False,
        ))

    # Hover no ponto médio de cada rota do aeroporto selecionado
    if not focus.empty:
        mid_lat = ((focus["lat_o"] + focus["lat_d"]) / 2).tolist()
        mid_lon = ((focus["lon_o"] + focus["lon_d"]) / 2).tolist()
        hover   = focus.apply(lambda r: (
            f"<b>{r['origem']} → {r['destino']}</b><br>"
            f"{r['nome_o']} → {r['nome_d']}<br>"
            f"{r['pax']/1e6:.2f} M passageiros"
        ), axis=1).tolist()
        fig.add_trace(go.Scattergeo(
            lat=mid_lat, lon=mid_lon, mode="markers",
            marker=dict(size=10, color="rgba(0,0,0,0)", line=dict(width=0)),
            hovertext=hover, hoverinfo="text", showlegend=False,
        ))

    # Nós — tamanho ∝ √(pax); aeroporto de referência com halo dourado
    all_icaos = pd.unique(pd.concat([od["origem"], od["destino"]]))
    nodes = []
    for icao in all_icaos:
        c = _AERO_COORDS.get(icao, {})
        if not c.get("lat"):
            continue
        pax_node = od[(od["origem"] == icao) | (od["destino"] == icao)]["pax"].sum()
        nodes.append({"icao": icao, "lat": c["lat"], "lon": c["lon"],
                      "nome": c.get("Município", icao), "uf": c.get("UF", ""),
                      "pax": pax_node, "is_ref": (icao == aeroporto)})
    nodes_df = pd.DataFrame(nodes)

    if not nodes_df.empty:
        pn_max = nodes_df["pax"].max()
        nodes_df["sz"] = (nodes_df["pax"] / pn_max).pow(0.5) * 18 + 4

        reg = nodes_df[~nodes_df["is_ref"]]
        if not reg.empty:
            fig.add_trace(go.Scattergeo(
                lat=reg["lat"].tolist(), lon=reg["lon"].tolist(), mode="markers",
                marker=dict(size=reg["sz"].tolist(), color=ANAC_LIGHT,
                            opacity=0.80, line=dict(color="white", width=0.5)),
                hovertext=reg.apply(lambda r:
                    f"<b>{r['icao']}</b> — {r['nome']}/{r['uf']}<br>"
                    f"{r['pax']/1e6:.1f} M pax", axis=1).tolist(),
                hoverinfo="text", showlegend=False,
            ))

        ref = nodes_df[nodes_df["is_ref"]]
        if not ref.empty:
            # Halo (glow effect): círculo maior e translúcido
            fig.add_trace(go.Scattergeo(
                lat=ref["lat"].tolist(), lon=ref["lon"].tolist(), mode="markers",
                marker=dict(size=(ref["sz"] * 2.4).tolist(), color=GOLD,
                            opacity=0.18, line=dict(width=0)),
                hoverinfo="none", showlegend=False,
            ))
            fig.add_trace(go.Scattergeo(
                lat=ref["lat"].tolist(), lon=ref["lon"].tolist(), mode="markers+text",
                marker=dict(size=(ref["sz"] * 1.4).tolist(), color=GOLD,
                            opacity=1.0, line=dict(color="white", width=1.5)),
                text=ref["icao"].tolist(), textposition="top right",
                textfont=dict(size=11, color=GOLD),
                hovertext=ref.apply(lambda r:
                    f"<b>{r['icao']}</b> ★ aeroporto selecionado<br>"
                    f"{r['nome']}/{r['uf']}<br>{r['pax']/1e6:.1f} M pax", axis=1).tolist(),
                hoverinfo="text", showlegend=False,
            ))

    fig.update_geos(
        scope="south america",
        showcountries=True,  countrycolor="#E2E8F0",
        showsubunits=True,   subunitcolor="#DDD",
        showland=True,       landcolor="#F8FAFC",
        showocean=True,      oceancolor="#EBF4FB",
        showcoastlines=True, coastlinecolor="#DDD",
        fitbounds="locations",
        projection_type="mercator",
    )
    fig.update_layout(
        **{**LAYOUT_BASE, "margin": dict(t=10, b=0, l=0, r=0)},
        height=520,
    )
    return fig


# ---------------------------------------------------------------------------
# Viz 7 — Grafo de conexões (Cytoscape com física cose-bilkent)
# ---------------------------------------------------------------------------

def _build_cyto_elements(df, n_airports=80):
    """Retorna lista de elementos (nós + arestas) para cyto.Cytoscape.

    Nós coloridos pela empresa dominante; tamanho ∝ √(pax total).
    Arestas limitadas a top-500 por volume para manter performance.
    """
    top_icaos = set(
        df.groupby("AEROPORTO_DE_ORIGEM_SIGLA")["PASSAGEIROS_PAGOS"]
        .sum().nlargest(n_airports).index
    )
    od = (
        df.groupby(["AEROPORTO_DE_ORIGEM_SIGLA", "AEROPORTO_DE_DESTINO_SIGLA"])
        .agg(pax=("PASSAGEIROS_PAGOS", "sum")).reset_index()
    )
    od = od[
        od["AEROPORTO_DE_ORIGEM_SIGLA"].isin(top_icaos) &
        od["AEROPORTO_DE_DESTINO_SIGLA"].isin(top_icaos) &
        (od["pax"] > 0)
    ].nlargest(500, "pax")

    pax_by_aero  = df.groupby("AEROPORTO_DE_ORIGEM_SIGLA")["PASSAGEIROS_PAGOS"].sum()
    pax_aero_max = pax_by_aero[pax_by_aero.index.isin(top_icaos)].max()
    pax_edge_max = od["pax"].max()

    # Empresa dominante por aeroporto para coloração
    dominant = (
        df[df["AEROPORTO_DE_ORIGEM_SIGLA"].isin(top_icaos)]
        .groupby(["AEROPORTO_DE_ORIGEM_SIGLA", "EMPRESA_SIGLA"])["PASSAGEIROS_PAGOS"]
        .sum().reset_index()
        .sort_values("PASSAGEIROS_PAGOS", ascending=False)
        .drop_duplicates("AEROPORTO_DE_ORIGEM_SIGLA")
        .set_index("AEROPORTO_DE_ORIGEM_SIGLA")["EMPRESA_SIGLA"]
    )

    elements = []
    for icao in top_icaos:
        c = _AERO_COORDS.get(icao, {})
        pax_node = float(pax_by_aero.get(icao, 0))
        size     = round(10 + (pax_node / pax_aero_max) ** 0.5 * 40, 1)
        emp      = dominant.get(icao, "Outros")
        color    = AIRLINE_COLORS.get(emp, "#888888")
        mun, uf  = c.get("Município", ""), c.get("UF", "")
        elements.append({"data": {
            "id": icao, "label": icao, "size": size, "color": color,
            "pax": pax_node, "nome": f"{mun}/{uf}" if uf else mun,
            "empresa": EMPRESA_LABEL.get(emp, emp),
        }})

    for _, r in od.iterrows():
        weight = round(0.5 + (r["pax"] / pax_edge_max) ** 0.5 * 6, 2)
        elements.append({"data": {
            "source": r["AEROPORTO_DE_ORIGEM_SIGLA"],
            "target": r["AEROPORTO_DE_DESTINO_SIGLA"],
            "weight": weight, "pax": float(r["pax"]),
        }})

    return elements


# ---------------------------------------------------------------------------
# Viz 8 — Matriz O-D: heatmap de pares origem-destino
# ---------------------------------------------------------------------------

def _fig_od_matrix(df, aeroporto):
    """Matriz de calor top-15 aeroportos × top-15 aeroportos.

    Heatmap é mais informativo que Sankey para rotas bidirecionais:
    a simetria (ou assimetria) fica imediatamente visível.
    """
    # Top-15 por aparições como origem OU destino
    counts = (
        df["AEROPORTO_DE_ORIGEM_SIGLA"].value_counts()
        .add(df["AEROPORTO_DE_DESTINO_SIGLA"].value_counts(), fill_value=0)
    )
    top15 = counts.nlargest(15).index.tolist()
    if aeroporto in top15:
        top15 = [aeroporto] + [a for a in top15 if a != aeroporto]

    od = (
        df.groupby(["AEROPORTO_DE_ORIGEM_SIGLA", "AEROPORTO_DE_DESTINO_SIGLA"])
        ["PASSAGEIROS_PAGOS"].sum().reset_index()
    )
    od = od[
        od["AEROPORTO_DE_ORIGEM_SIGLA"].isin(top15) &
        od["AEROPORTO_DE_DESTINO_SIGLA"].isin(top15)
    ]

    pivot = (
        od.pivot_table(index="AEROPORTO_DE_ORIGEM_SIGLA",
                       columns="AEROPORTO_DE_DESTINO_SIGLA",
                       values="PASSAGEIROS_PAGOS", aggfunc="sum", fill_value=0)
        .reindex(index=top15, columns=top15, fill_value=0)
    )
    z = pivot.values / 1e6
    n = len(top15)
    hover = [
        [f"<b>{top15[i]} → {top15[j]}</b><br>{z[i,j]:.2f} M pax"
         if z[i,j] > 0 else f"<b>{top15[i]} → {top15[j]}</b><br>—"
         for j in range(n)] for i in range(n)
    ]

    fig = go.Figure(go.Heatmap(
        z=z, x=top15, y=top15,
        colorscale="Blues", text=hover, hoverinfo="text",
        xgap=1, ygap=1,
        colorbar=dict(
            title=dict(text="Passageiros (M)", font=dict(size=9)),
            thickness=12, len=0.7,
        ),
    ))

    # Destaca linha e coluna do aeroporto selecionado em dourado
    if aeroporto in top15:
        i = top15.index(aeroporto)
        for sh in [
            dict(x0=i-0.5, x1=i+0.5, y0=-0.5, y1=n-0.5),  # coluna
            dict(x0=-0.5,  x1=n-0.5, y0=i-0.5, y1=i+0.5),  # linha
        ]:
            fig.add_shape(type="rect", line=dict(color=GOLD, width=2),
                          layer="above", **sh)

    fig.update_layout(
        **{**LAYOUT_BASE, "margin": dict(t=10, b=50, l=60, r=90)},
        height=520,
        xaxis=dict(side="bottom", tickfont=dict(size=10), tickangle=0),
        yaxis=dict(autorange="reversed", tickfont=dict(size=10)),
        hovermode="closest",
    )
    return fig


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True, port=8050, host="0.0.0.0")
