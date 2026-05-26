#!/usr/bin/env python3
"""
process_seguranca.py — pré-processa datasets de segurança operacional e
manutenção da ANAC e gera parquets slim pro dashboard.

Saídas em data/processed/:
  - sdr_resumo.json            : agregados de Service Difficulty Reports
  - ocorrencias_resumo.json    : agregados nacionais de ocorrências (CENIPA)
  - ocorrencias_eventos.parquet: ocorrências individuais com lat/lon (pro mapa)
  - ads_resumo.json            : diretrizes de aeronavegabilidade

Uso:
    python src/process_seguranca.py
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW_SEG = ROOT / "data" / "raw" / "seguranca"
OUT     = ROOT / "data" / "processed"

# ATA chapters → nome legível (lista resumida das mais comuns)
ATA_NAMES = {
    "21": "Ar condicionado",
    "22": "Piloto automático",
    "23": "Comunicação",
    "24": "Energia elétrica",
    "25": "Equipamentos / acomodações",
    "26": "Proteção contra fogo",
    "27": "Controles de voo",
    "28": "Combustível",
    "29": "Hidráulico",
    "30": "Anti-gelo",
    "31": "Instrumentos",
    "32": "Trem de pouso",
    "33": "Iluminação",
    "34": "Navegação",
    "35": "Oxigênio",
    "36": "Pneumático",
    "38": "Água/lixo",
    "49": "APU",
    "51": "Estrutura standard",
    "52": "Portas",
    "53": "Fuselagem",
    "54": "Nacelas/pilares",
    "55": "Estabilizadores",
    "56": "Janelas",
    "57": "Asas",
    "61": "Hélices",
    "71": "Motor (powerplant)",
    "72": "Motor",
    "73": "Comb. motor",
    "74": "Ignição",
    "75": "Ar motor",
    "76": "Controles motor",
    "77": "Indicação motor",
    "78": "Exaustão motor",
    "79": "Óleo motor",
    "80": "Partida motor",
}


def _fix_mojibake(s):
    """ANAC publica CSV declarado latin1 com strings UTF-8 dentro. Conserta."""
    if not isinstance(s, str): return s
    try:
        return s.encode("latin1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s


def _norm(s):
    """Normaliza string para uppercase ASCII pra matching robusto."""
    if not isinstance(s, str):
        return ""
    s = _fix_mojibake(s)
    s = unicodedata.normalize("NFKD", s).encode("ASCII", "ignore").decode("ASCII")
    return s.strip().upper()


# ── SDR ───────────────────────────────────────────────────────────────────────

def process_sdr() -> dict:
    """Junta SDR V2 (atual) + Histórico (com ATA code)."""
    v2 = pd.read_csv(RAW_SEG / "sdr_v2.csv", sep=";", encoding="utf-8",
                     skiprows=1, low_memory=False)
    hist = pd.read_csv(RAW_SEG / "sdr_historico.csv", sep=";", encoding="utf-8",
                       skiprows=1, low_memory=False)
    v2.columns   = [_norm(c) for c in v2.columns]
    hist.columns = [_norm(c) for c in hist.columns]

    # Padroniza colunas — usa nomes normalizados em uppercase ASCII
    def col(df, *cands):
        for c in cands:
            cn = _norm(c)
            if cn in df.columns: return cn
        return None

    # V2
    v2_fab   = col(v2, "Fabricante da Aeronave")
    v2_mod   = col(v2, "Modelo da Aeronave")
    v2_data  = col(v2, "Mês/Ano")
    v2_class = col(v2, "Classificação")

    # Histórico
    h_fab    = col(hist, "Fabricante da Aeronave")
    h_mod    = col(hist, "Modelo da Aeronave")
    h_data   = col(hist, "Mês/Ano")
    h_ata    = col(hist, "Código do componente ATA")

    print(f"  SDR V2: {len(v2)} · Histórico: {len(hist)}")

    # Parse mês/ano
    def parse_mesano(s):
        if not isinstance(s, str): return None
        m = re.match(r"(\d{1,2})/(\d{4})", s.strip())
        if not m: return None
        return f"{m.group(2)}-{m.group(1).zfill(2)}"

    v2["ym"]   = v2[v2_data].apply(parse_mesano)
    hist["ym"] = hist[h_data].apply(parse_mesano)

    # Concatena pra análises gerais (fabricante / modelo / timeline)
    v2_slim = pd.DataFrame({
        "ym": v2["ym"], "fab": v2[v2_fab], "modelo": v2[v2_mod], "ata": None,
    })
    hist_slim = pd.DataFrame({
        "ym": hist["ym"], "fab": hist[h_fab], "modelo": hist[h_mod],
        "ata": hist[h_ata].astype(str).str.zfill(4).str[:2],  # 4 digits → primeiros 2 = capítulo
    })
    full = pd.concat([v2_slim, hist_slim], ignore_index=True)
    full = full.dropna(subset=["ym"])
    full["ano"] = full["ym"].str[:4].astype(int)
    full["fab"] = full["fab"].apply(_norm)
    full["modelo"] = full["modelo"].fillna("").astype(str).str.strip().str.upper()

    # Agregações
    total = len(full)
    HOJE_ANO = 2026
    recent = full[full["ano"] >= HOJE_ANO - 5]

    # Top fabricantes
    fab_top = full["fab"].value_counts().head(8)
    top_fab = [{"nome": n, "n": int(c)} for n, c in fab_top.items() if n]

    # Top modelos
    mod_top = full[full["modelo"] != ""]["modelo"].value_counts().head(10)
    top_mod = [{"modelo": m, "n": int(c)} for m, c in mod_top.items()]

    # Top ATA chapters (apenas Histórico tem essa info)
    ata_top = hist_slim["ata"].value_counts().head(12)
    top_ata = []
    for ata, c in ata_top.items():
        if not ata or ata == "NA" or ata == "0N":  # NaN / inválidos
            continue
        top_ata.append({
            "ata": ata,
            "nome": ATA_NAMES.get(ata, f"Capítulo {ata}"),
            "n": int(c),
        })

    # Timeline anual
    por_ano = full.groupby("ano").size().reset_index(name="n").sort_values("ano")
    timeline = [{"ano": int(r["ano"]), "n": int(r["n"])} for _, r in por_ano.iterrows()]

    resumo = {
        "total": int(total),
        "ultimos_5_anos": int(len(recent)),
        "top_fabricantes": top_fab,
        "top_modelos":     top_mod,
        "top_ata":         top_ata,
        "timeline":        timeline,
    }
    out = OUT / "sdr_resumo.json"
    out.write_text(json.dumps(resumo, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  → {out.relative_to(ROOT)}")
    return resumo


# ── Ocorrências CENIPA ────────────────────────────────────────────────────────

def process_ocorrencias() -> dict:
    df = pd.read_csv(RAW_SEG / "ocorrencias.csv", sep=";", encoding="utf-8",
                     skiprows=1, low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    print(f"  Ocorrências: {len(df)}")

    df["Classificacao_da_Ocorrencia"] = df["Classificacao_da_Ocorrencia"].fillna("").astype(str)
    df["Data_da_Ocorrencia"] = pd.to_datetime(df["Data_da_Ocorrencia"], errors="coerce")
    df["ano"] = df["Data_da_Ocorrencia"].dt.year

    # Lat/lon vêm com vírgula decimal
    for c in ["Latitude", "Longitude"]:
        df[c] = pd.to_numeric(
            df[c].astype(str).str.replace(",", ".", regex=False), errors="coerce")

    total = len(df)
    acid    = (df["Classificacao_da_Ocorrencia"] == "Acidente").sum()
    inc     = (df["Classificacao_da_Ocorrencia"] == "Incidente").sum()
    inc_g   = (df["Classificacao_da_Ocorrencia"] == "Incidente Grave").sum()

    fatais = df[["Lesoes_Fatais_Tripulantes", "Lesoes_Fatais_Passageiros", "Lesoes_Fatais_Terceiros"]].fillna(0).sum().sum()

    # Top tipos
    tipos = df["Descricao_do_Tipo"].fillna("DESCONHECIDO").value_counts().head(10)
    top_tipos = [{"tipo": str(t)[:50], "n": int(c)} for t, c in tipos.items()]

    # Por fase
    fases = df["Fase_da_Operacao"].fillna("DESCONHECIDA").value_counts().head(10)
    por_fase = [{"fase": str(f), "n": int(c)} for f, c in fases.items()]

    # Timeline
    por_ano = df.dropna(subset=["ano"]).groupby(["ano", "Classificacao_da_Ocorrencia"]).size().reset_index(name="n")
    timeline = []
    for ano in sorted(por_ano["ano"].unique()):
        sub = por_ano[por_ano["ano"] == ano]
        row = {"ano": int(ano)}
        for _, r in sub.iterrows():
            cls = r["Classificacao_da_Ocorrencia"] or "Outras"
            row[cls.lower().replace(" ", "_")] = int(r["n"])
        timeline.append(row)

    resumo = {
        "total":            int(total),
        "acidentes":        int(acid),
        "incidentes":       int(inc),
        "incidentes_graves":int(inc_g),
        "lesoes_fatais":    int(fatais),
        "top_tipos":        top_tipos,
        "por_fase":         por_fase,
        "timeline":         timeline,
    }
    out = OUT / "ocorrencias_resumo.json"
    out.write_text(json.dumps(resumo, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  → {out.relative_to(ROOT)}")

    # Eventos individuais com lat/lon pro mapa — só os com coordenadas válidas
    geo = df.dropna(subset=["Latitude", "Longitude"]).copy()
    geo = geo[(geo["Latitude"].between(-35, 6)) & (geo["Longitude"].between(-75, -28))]
    geo_slim = pd.DataFrame({
        "lat":   geo["Latitude"].round(4),
        "lon":   geo["Longitude"].round(4),
        "data":  geo["Data_da_Ocorrencia"].dt.strftime("%Y-%m-%d"),
        "ano":   geo["ano"],
        "tipo":  geo["Descricao_do_Tipo"].fillna(""),
        "cls":   geo["Classificacao_da_Ocorrencia"],
        "fase":  geo["Fase_da_Operacao"].fillna(""),
        "muni":  geo["Municipio"].fillna(""),
        "uf":    geo["UF"].fillna(""),
        "danos": geo["Danos_a_Aeronave"].fillna(""),
        "icao":  geo["ICAO"].fillna(""),
        "fatais":(geo[["Lesoes_Fatais_Tripulantes", "Lesoes_Fatais_Passageiros", "Lesoes_Fatais_Terceiros"]]
                  .fillna(0).sum(axis=1).astype(int)),
    })
    geo_slim = geo_slim.dropna(subset=["ano"])
    geo_slim["ano"] = geo_slim["ano"].astype(int)
    # Recorte de 10 anos pra slim file
    geo_slim = geo_slim[geo_slim["ano"] >= 2016]
    out_pq = OUT / "ocorrencias_eventos.parquet"
    geo_slim.to_parquet(out_pq, index=False)
    print(f"  → {out_pq.relative_to(ROOT)}  ({len(geo_slim)} eventos geo-localizados desde 2016)")
    return resumo


# ── Diretrizes de Aeronavegabilidade ─────────────────────────────────────────

def process_ads() -> dict:
    df = pd.read_csv(RAW_SEG / "diretrizes_ad.csv", sep=";", encoding="utf-8",
                     skiprows=1, low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    print(f"  ADs: {len(df)}")

    df["Status"]     = df["Status"].fillna("").astype(str).str.strip().str.upper()
    df["Fabricante"] = df["Fabricante"].fillna("").astype(str).str.strip().str.upper()
    df["Modelo"]     = df["Modelo"].fillna("").astype(str).str.strip().str.upper()
    df["Sistema"]    = df["Sistema"].fillna("").astype(str).str.strip().str.upper()
    df["Produto"]    = df["Produto"].fillna("").astype(str).str.strip()

    # Em vigor: status != 'C' (cancelada) e != 'R' (revogada). Status comum é vazio = vigente.
    vigentes = df[~df["Status"].isin(["C", "R", "S"])]
    print(f"  vigentes (≠ C/R/S): {len(vigentes)}")

    # Top fabricantes
    fab_top = vigentes["Fabricante"].value_counts().head(10)
    top_fab = [{"nome": n, "n": int(c)} for n, c in fab_top.items() if n]

    # Top sistemas (resumir; deduplicar variações)
    def short_sys(s):
        s = re.sub(r"[/–-]\s*.*$", "", s).strip()
        return s[:40]
    vigentes_sys = vigentes.assign(sys=vigentes["Sistema"].apply(short_sys))
    sys_top = vigentes_sys[vigentes_sys["sys"] != ""]["sys"].value_counts().head(12)
    top_sys = [{"sistema": s, "n": int(c)} for s, c in sys_top.items()]

    # Por produto
    prod = vigentes["Produto"].value_counts()
    por_produto = {str(k): int(v) for k, v in prod.items() if k}

    resumo = {
        "total":         int(len(df)),
        "vigentes":      int(len(vigentes)),
        "top_fabricantes": top_fab,
        "top_sistemas":  top_sys,
        "por_produto":   por_produto,
    }
    out = OUT / "ads_resumo.json"
    out.write_text(json.dumps(resumo, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  → {out.relative_to(ROOT)}")
    return resumo


def main():
    print("\n[ SDR — Service Difficulty Reports ]")
    process_sdr()
    print("\n[ Ocorrências CENIPA ]")
    process_ocorrencias()
    print("\n[ Diretrizes de Aeronavegabilidade ]")
    process_ads()
    print("\nOK.")


if __name__ == "__main__":
    main()
