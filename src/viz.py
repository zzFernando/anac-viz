#!/usr/bin/env python3
"""
viz.py — Protótipos de visualização da aviação doméstica brasileira.

Gera 3 HTMLs interativos em viz/:
  01_serie_temporal.html  — Passageiros domésticos mensais 2000–2026
  02_market_share.html    — Evolução do market share por empresa
  03_heatmap_atrasos.html — Atrasos médios por hora × dia da semana (VRA 2022–2024)

Uso:
    python src/viz.py
    python src/viz.py --only serie
    python src/viz.py --only market
    python src/viz.py --only heatmap
"""

import argparse
import glob
import warnings
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots

warnings.filterwarnings("ignore")

ROOT  = Path(__file__).resolve().parent.parent
DATA  = ROOT / "data" / "raw"
VIZ   = ROOT / "viz"
VIZ.mkdir(exist_ok=True)

STATS_FILE = DATA / "Voos e operações aéreas" / "Dados Estatísticos do Transporte Aéreo" / "Dados_Estatisticos.csv"
VRA_GLOB   = str(DATA / "Voos e operações aéreas" / "Voo Regular Ativo (VRA)" / "**" / "*.csv")

CORES_EMPRESA = {
    "TAM": "#E31837",
    "GLO": "#FF6B00",
    "AZU": "#0066CC",
    "AVI": "#8B1A1A",
    "VRG": "#FF8C00",
    "ONE": "#666666",
    "Outros": "#CCCCCC",
}

# ---------------------------------------------------------------------------
# Carregamento dos Dados Estatísticos
# ---------------------------------------------------------------------------

def load_estatisticos() -> pd.DataFrame:
    print("Carregando Dados_Estatisticos.csv…")
    df = pd.read_csv(
        STATS_FILE, sep=";", encoding="utf-8-sig", skiprows=1,
        usecols=["ANO", "MES", "NATUREZA", "GRUPO_DE_VOO",
                 "EMPRESA_SIGLA", "EMPRESA_NOME",
                 "PASSAGEIROS_PAGOS", "DECOLAGENS", "ASK", "RPK"],
        low_memory=False,
    )
    df = df[
        (df["NATUREZA"] == "DOMÉSTICA") &
        (df["GRUPO_DE_VOO"] == "REGULAR")
    ].copy()
    df["DATA"] = pd.to_datetime(
        df["ANO"].astype(str) + "-" + df["MES"].astype(str).str.zfill(2) + "-01"
    )
    df["PASSAGEIROS_PAGOS"] = pd.to_numeric(df["PASSAGEIROS_PAGOS"], errors="coerce").fillna(0)
    df["DECOLAGENS"]        = pd.to_numeric(df["DECOLAGENS"],        errors="coerce").fillna(0)
    df["ASK"]               = pd.to_numeric(df["ASK"],               errors="coerce").fillna(0)
    df["RPK"]               = pd.to_numeric(df["RPK"],               errors="coerce").fillna(0)
    print(f"  {len(df):,} linhas | {df['DATA'].min().date()} – {df['DATA'].max().date()}")
    return df


# ---------------------------------------------------------------------------
# 1. Série Temporal
# ---------------------------------------------------------------------------

EVENTOS = [
    ("2001-09-11", "11/Set", "abaixo"),
    ("2006-09-29", "Gol 1907", "acima"),  # acidente Gol voo 1907
    ("2009-06-01", "AF447", "abaixo"),
    ("2019-05-01", "Avianca BR", "acima"),
    ("2020-03-01", "COVID-19", "abaixo"),
    ("2022-01-01", "Retomada", "acima"),
]


def viz_serie_temporal(df: pd.DataFrame) -> None:
    serie = df.groupby("DATA").agg(
        pax=("PASSAGEIROS_PAGOS", "sum"),
        decolagens=("DECOLAGENS", "sum"),
    ).reset_index()
    serie["pax_mm12"] = serie["pax"].rolling(12, center=True).mean()

    fig = make_subplots(
        rows=2, cols=1, shared_xaxes=True,
        row_heights=[0.7, 0.3],
        subplot_titles=("Passageiros pagos (doméstico regular)", "Decolagens"),
        vertical_spacing=0.08,
    )

    # Passageiros — área
    fig.add_trace(go.Scatter(
        x=serie["DATA"], y=serie["pax"] / 1e6,
        fill="tozeroy", mode="lines",
        line=dict(color="#0066CC", width=1),
        fillcolor="rgba(0,102,204,0.15)",
        name="Passageiros (M)",
        hovertemplate="%{x|%b/%Y}: %{y:.2f}M pax<extra></extra>",
    ), row=1, col=1)

    # Média móvel 12 meses
    fig.add_trace(go.Scatter(
        x=serie["DATA"], y=serie["pax_mm12"] / 1e6,
        mode="lines", line=dict(color="#E31837", width=2, dash="dash"),
        name="Média móvel 12m",
        hovertemplate="%{x|%b/%Y}: %{y:.2f}M<extra></extra>",
    ), row=1, col=1)

    # Decolagens
    fig.add_trace(go.Bar(
        x=serie["DATA"], y=serie["decolagens"] / 1e3,
        name="Decolagens (mil)",
        marker_color="rgba(0,102,204,0.5)",
        hovertemplate="%{x|%b/%Y}: %{y:.1f}k decolagens<extra></extra>",
    ), row=2, col=1)

    # Anotações de eventos
    for data_str, label, pos in EVENTOS:
        data = pd.Timestamp(data_str)
        row_data = serie[serie["DATA"] >= data].head(1)
        if row_data.empty:
            continue
        y_val = row_data["pax"].values[0] / 1e6
        ay = -50 if pos == "abaixo" else 50
        fig.add_annotation(
            x=data, y=y_val,
            text=label,
            showarrow=True, arrowhead=2, arrowsize=1, arrowwidth=1.5,
            arrowcolor="#555", ax=0, ay=ay,
            font=dict(size=10, color="#333"),
            bgcolor="white", bordercolor="#ccc", borderwidth=1,
            row=1, col=1,
        )

    # Sombra COVID
    fig.add_vrect(
        x0="2020-03-01", x1="2021-12-01",
        fillcolor="rgba(200,0,0,0.06)",
        layer="below", line_width=0,
        annotation_text="COVID-19", annotation_position="top left",
        annotation_font_size=10, annotation_font_color="#c00",
    )

    fig.update_layout(
        title=dict(text="Aviação Doméstica Brasileira — 2000 a 2026", font_size=18),
        height=600,
        hovermode="x unified",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        plot_bgcolor="white",
        paper_bgcolor="white",
        font=dict(family="Inter, Arial, sans-serif"),
        xaxis2=dict(title=""),
        yaxis=dict(title="Passageiros (milhões)", gridcolor="#eee"),
        yaxis2=dict(title="Decolagens (mil)", gridcolor="#eee"),
    )

    out = VIZ / "01_serie_temporal.html"
    fig.write_html(out, include_plotlyjs="cdn")
    print(f"  Salvo: {out}")


# ---------------------------------------------------------------------------
# 2. Market Share
# ---------------------------------------------------------------------------

EMPRESAS_LABEL = {
    "TAM": "LATAM/TAM",
    "GLO": "Gol",
    "AZU": "Azul",
    "VRG": "Gol (VRG)",
    "ONE": "Avianca BR",
    "AVI": "Avianca",
    "TIB": "Trip",
    "WEB": "Webjet",
    "VSP": "Vasp",
    "RLA": "Rico",
    "PTB": "Pantanal",
}


def viz_market_share(df: pd.DataFrame) -> None:
    top_siglas = (
        df.groupby("EMPRESA_SIGLA")["PASSAGEIROS_PAGOS"]
        .sum()
        .nlargest(6)
        .index.tolist()
    )

    df2 = df.copy()
    df2["EMPRESA_GRUPO"] = df2["EMPRESA_SIGLA"].where(
        df2["EMPRESA_SIGLA"].isin(top_siglas), "Outros"
    )

    anual = df2.groupby(["ANO", "EMPRESA_GRUPO"])["PASSAGEIROS_PAGOS"].sum().reset_index()
    total_ano = anual.groupby("ANO")["PASSAGEIROS_PAGOS"].sum().rename("TOTAL")
    anual = anual.join(total_ano, on="ANO")
    anual["SHARE"] = anual["PASSAGEIROS_PAGOS"] / anual["TOTAL"] * 100

    ordem = ["Outros"] + [e for e in top_siglas if e != "Outros"]
    cores = [CORES_EMPRESA.get(e, "#AAAAAA") for e in ordem]

    fig = go.Figure()
    for emp, cor in zip(ordem, cores):
        sub = anual[anual["EMPRESA_GRUPO"] == emp].sort_values("ANO")
        label = EMPRESAS_LABEL.get(emp, emp)
        fig.add_trace(go.Scatter(
            x=sub["ANO"], y=sub["SHARE"].round(1),
            name=label,
            mode="lines+markers",
            line=dict(color=cor, width=2.5),
            marker=dict(size=5),
            hovertemplate=f"<b>{label}</b><br>%{{x}}: %{{y:.1f}}%<extra></extra>",
        ))

    # Anotações de eventos relevantes
    fig.add_vline(x=2019, line_dash="dot", line_color="#999", annotation_text="Avianca BR", annotation_position="top right")
    fig.add_vline(x=2020, line_dash="dot", line_color="#c00", annotation_text="COVID", annotation_position="top left")
    fig.add_vline(x=2012, line_dash="dot", line_color="#999", annotation_text="TAM→LATAM", annotation_position="top right")

    fig.update_layout(
        title=dict(text="Market Share — Passageiros Domésticos por Empresa", font_size=18),
        height=500,
        yaxis=dict(title="Market Share (%)", range=[0, 65], gridcolor="#eee"),
        xaxis=dict(title="Ano", dtick=2),
        hovermode="x unified",
        plot_bgcolor="white",
        paper_bgcolor="white",
        font=dict(family="Inter, Arial, sans-serif"),
        legend=dict(orientation="v", x=1.02, y=1),
    )

    out = VIZ / "02_market_share.html"
    fig.write_html(out, include_plotlyjs="cdn")
    print(f"  Salvo: {out}")


# ---------------------------------------------------------------------------
# 3. Heatmap de Atrasos (VRA)
# ---------------------------------------------------------------------------

SBPA = "SBPA"  # Porto Alegre — aeroporto da persona Carla

def load_vra(anos=(2022, 2023, 2024)) -> pd.DataFrame:
    print(f"  Carregando VRA {anos[0]}–{anos[-1]}…")
    dfs = []
    for ano in anos:
        pattern = str(DATA / "Voos e operações aéreas" / "Voo Regular Ativo (VRA)" / str(ano) / "**" / "*.csv")
        for f in glob.glob(pattern, recursive=True):
            try:
                tmp = pd.read_csv(
                    f, sep=";", encoding="utf-8-sig", skiprows=1,
                    usecols=["ICAO Empresa Aérea", "Código Tipo Linha",
                             "ICAO Aeródromo Origem", "ICAO Aeródromo Destino",
                             "Partida Prevista", "Partida Real", "Situação Voo"],
                    low_memory=False,
                )
                dfs.append(tmp)
            except Exception:
                pass
    if not dfs:
        return pd.DataFrame()
    df = pd.concat(dfs, ignore_index=True)
    print(f"  {len(df):,} voos carregados")
    return df


def viz_heatmap_atrasos() -> None:
    df = load_vra(anos=(2022, 2023, 2024))
    if df.empty:
        print("  VRA vazio — pulando heatmap")
        return

    # Só doméstico realizado
    df = df[
        (df["Situação Voo"] == "REALIZADO") &
        (df["Código Tipo Linha"].isin(["N", "E"]))  # N=doméstico, E=regional
    ].copy()

    df["Partida Prevista"] = pd.to_datetime(df["Partida Prevista"], errors="coerce")
    df["Partida Real"]     = pd.to_datetime(df["Partida Real"],     errors="coerce")
    df = df.dropna(subset=["Partida Prevista", "Partida Real"])

    df["atraso_min"] = (df["Partida Real"] - df["Partida Prevista"]).dt.total_seconds() / 60
    # Remove outliers absurdos (erros de dado)
    df = df[(df["atraso_min"] >= -60) & (df["atraso_min"] <= 360)]

    df["hora"]      = df["Partida Prevista"].dt.hour
    df["dia_semana"] = df["Partida Prevista"].dt.dayofweek  # 0=seg

    dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

    def make_heatmap(subdf, title):
        pivot = (
            subdf.groupby(["dia_semana", "hora"])["atraso_min"]
            .mean()
            .unstack(fill_value=0)
            .reindex(range(7))
            .reindex(columns=range(24), fill_value=0)
        )
        return go.Heatmap(
            z=pivot.values,
            x=[f"{h:02d}h" for h in range(24)],
            y=dias,
            colorscale="RdYlGn_r",
            zmid=0,
            zmin=-10, zmax=30,
            colorbar=dict(title="Atraso (min)", len=0.5),
            hovertemplate="<b>%{y} %{x}</b><br>Atraso médio: %{z:.1f} min<extra></extra>",
            name=title,
        )

    df_brasil = df
    df_poa    = df[
        (df["ICAO Aeródromo Origem"] == SBPA) |
        (df["ICAO Aeródromo Destino"] == SBPA)
    ]

    fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=(
            f"Brasil (2022–2024 · {len(df_brasil):,} voos)",
            f"Porto Alegre/SBPA ({len(df_poa):,} voos)",
        ),
        horizontal_spacing=0.12,
    )

    fig.add_trace(make_heatmap(df_brasil, "Brasil"),  row=1, col=1)
    fig.add_trace(make_heatmap(df_poa,    "POA"),     row=1, col=2)

    fig.update_layout(
        title=dict(text="Atraso Médio de Partida — Hora × Dia da Semana", font_size=18),
        height=380,
        plot_bgcolor="white",
        paper_bgcolor="white",
        font=dict(family="Inter, Arial, sans-serif"),
    )

    out = VIZ / "03_heatmap_atrasos.html"
    fig.write_html(out, include_plotlyjs="cdn")
    print(f"  Salvo: {out}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=["serie", "market", "heatmap"],
                        help="Gera só esta visualização")
    args = parser.parse_args()

    run_all   = args.only is None
    run_serie  = run_all or args.only == "serie"
    run_market = run_all or args.only == "market"
    run_heat   = run_all or args.only == "heatmap"

    df_stats = None
    if run_serie or run_market:
        df_stats = load_estatisticos()

    if run_serie:
        print("\n[1/3] Série temporal…")
        viz_serie_temporal(df_stats)

    if run_market:
        print("\n[2/3] Market share…")
        viz_market_share(df_stats)

    if run_heat:
        print("\n[3/3] Heatmap de atrasos (VRA)…")
        viz_heatmap_atrasos()

    print("\nPronto. HTMLs em viz/")


if __name__ == "__main__":
    main()
