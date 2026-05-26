#!/usr/bin/env python3
"""
process_aeronaves.py — pré-computa os agregados de frota para o dashboard.

Lê data/raw/aeronaves/dados_aeronaves.csv (snapshot RAB ANAC) e gera:
  - data/processed/frota_nacional.json   — visão Brasil (fabricantes, idade, motor)
  - data/processed/frota_empresas.parquet — por empresa (sigla ICAO da malha doméstica)

Filtro principal: aeronaves ativas (DT_CANC nulo). O cruzamento com a empresa
aérea é feito pelo nome do operador (substring), porque a relação
CNPJ→sigla ICAO não é publicada de forma pareada pela ANAC.

Uso:
    python src/process_aeronaves.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

# Data de referência para classificar CA como vigente/vencido. Atualizar quando
# refrescar o snapshot do RAB.
REF_DATE = pd.Timestamp("2026-05-26")


def _parse_br_date(s) -> pd.Timestamp:
    """RAB usa datas em DDMMYYYY ou DDMMYY sem separadores. Outros valores
    (ABORDO, RESRAB, ISENTA) viram NaT — tratados como 'indefinido'."""
    if not isinstance(s, str):
        return pd.NaT
    s = s.strip()
    if re.fullmatch(r"\d{8}", s):
        try:
            return pd.Timestamp(year=int(s[4:8]), month=int(s[2:4]), day=int(s[:2]))
        except (ValueError, TypeError):
            return pd.NaT
    if re.fullmatch(r"\d{6}", s):
        try:
            yy = int(s[4:6])
            year = 2000 + yy if yy < 70 else 1900 + yy
            return pd.Timestamp(year=year, month=int(s[2:4]), day=int(s[:2]))
        except (ValueError, TypeError):
            return pd.NaT
    return pd.NaT

ROOT = Path(__file__).resolve().parent.parent
RAW  = ROOT / "data" / "raw" / "aeronaves" / "dados_aeronaves.csv"
OUT  = ROOT / "data" / "processed"

# Lookup operador (substring no NOME do OPERADORES JSON) → sigla ICAO usada
# nos parquets de stats. Ordem importa: padrões mais específicos primeiro.
# Mantém-se enxuto: empresas comerciais regulares com presença nos voos.
EMPRESA_PATTERNS: list[tuple[str, str]] = [
    (r"\bLATAM\b",                       "TAM"),
    (r"\bTAM LINHAS AÉREAS\b",           "TAM"),
    (r"\bTAM LINHAS AEREAS\b",           "TAM"),
    (r"\bGOL LINHAS AÉREAS\b",           "GLO"),
    (r"\bGOL LINHAS AEREAS\b",           "GLO"),
    (r"\bAZUL LINHAS A[ÉE]REAS\b",       "AZU"),
    (r"\bPASSAREDO\b",                   "PTB"),
    (r"\bVOEPASS\b",                     "PTB"),
    (r"\bMAP TRANSPORTES A[ÉE]REOS\b",   "MAP"),
    (r"\bSIDERAL LINHAS A[ÉE]REAS\b",    "SLX"),
    (r"\bTOTAL LINHAS\b",                "TTL"),
    (r"\bABSA\b",                        "TUS"),
]

EMPRESA_LABEL = {
    "TAM": "LATAM/TAM", "GLO": "Gol", "AZU": "Azul",
    "PTB": "Voepass", "MAP": "MAP", "SLX": "Sideral",
    "TTL": "Total Linhas", "TUS": "ABSA Cargo",
}


def _classify_operador(nome: str | None) -> str | None:
    if not nome or not isinstance(nome, str):
        return None
    upper = nome.upper()
    for pattern, sigla in EMPRESA_PATTERNS:
        if re.search(pattern, upper):
            return sigla
    return None


def _first_operador(operadores_json: str | float) -> dict | None:
    if pd.isna(operadores_json):
        return None
    try:
        arr = json.loads(operadores_json)
        return arr[0] if arr else None
    except (ValueError, TypeError):
        return None


def _motor_bucket(motor: str | None) -> str:
    """Agrupa TP_MOTOR em 4 buckets enxutos para o panorama."""
    if not motor or not isinstance(motor, str):
        return "OUTRO"
    m = motor.upper()
    if "TURBOFAN" in m or "JATO" in m:
        return "JATO"
    if "TURBOH" in m or "TURBOE" in m:
        return "TURBOELICE"
    if "CONVENCIONAL" in m or "PISTÃO" in m or "PISTAO" in m:
        return "PISTAO"
    return "OUTRO"


def _enrich_modelos(sub: pd.DataFrame, modelos_vc: pd.Series) -> list:
    """Enriquece top modelos com fabricante e idade média."""
    out = []
    sub_upper = sub.assign(_modelo_up=sub["DS_MODELO"].fillna("").str.strip().str.upper())
    for modelo, n in modelos_vc.items():
        grp = sub_upper[sub_upper["_modelo_up"] == modelo]
        idade = grp["idade"].dropna()
        idade = idade[idade.between(0, 80)]
        fabr = grp["NM_FABRICANTE"].dropna().str.strip().str.upper().value_counts()
        out.append({
            "modelo": modelo,
            "n": int(n),
            "idade_media": round(float(idade.mean()), 1) if len(idade) else None,
            "fabricante": fabr.index[0] if not fabr.empty else None,
        })
    return out


def main() -> None:
    print(f"Lendo {RAW.name}…", flush=True)
    df = pd.read_csv(RAW, sep=";", encoding="utf-8", skiprows=1, low_memory=False)
    total_bruto = len(df)

    # Frota ativa: sem data de cancelamento
    ativa = df[df["DT_CANC"].isna()].copy()
    print(f"  total registros: {total_bruto}  ·  ativas: {len(ativa)}", flush=True)

    # Idade: ano atual fixado como referência (snapshot do RAB tem ano-base 2026)
    ANO_REF = 2026
    ativa["ano_fab"] = pd.to_numeric(ativa["NR_ANO_FABRICACAO"], errors="coerce")
    ativa["idade"]   = ANO_REF - ativa["ano_fab"]
    ativa["motor"]   = ativa["TP_MOTOR"].apply(_motor_bucket)

    # Status do Certificado de Aeronavegabilidade — proxy de conformidade/manutenção
    ativa["ca_dt"]       = ativa["DT_VALIDADE_CA"].apply(_parse_br_date)
    ativa["ca_vigente"]  = ativa["ca_dt"] >= REF_DATE
    # "indefinido": ABORDO/RESRAB/ISENTA/sem data (não conta vigente nem vencido)
    ativa["ca_status"]   = ativa["ca_dt"].apply(
        lambda d: "vigente" if pd.notna(d) and d >= REF_DATE
                  else ("vencido" if pd.notna(d) else "indefinido"))

    # ── Visão nacional ────────────────────────────────────────────────────────
    # Recortes:
    #  - "total" = todas aeronaves ativas (~26 k, inclui aviação geral privada)
    #  - "transporte" = categoria TRANSPORTE / TRANSP.REGIONAL — recorte relevante
    #    para o panorama da aviação comercial doméstica
    CAT_TRANSPORTE = {"TRANSPORTE", "TRANSPORTE A/B", "TRANSP.REGIONAL"}
    transp = ativa[ativa["DS_CATEGORIA_HOMOLOGACAO"].isin(CAT_TRANSPORTE)].copy()

    def _resumo(sub: pd.DataFrame) -> dict:
        idade_validas = sub["idade"].dropna()
        idade_validas = idade_validas[idade_validas.between(0, 80)]
        n_jato = int((sub["motor"] == "JATO").sum())
        fabr = sub["NM_FABRICANTE"].dropna().str.strip().str.upper().value_counts()
        top_fabr = []
        for nome, n in fabr.head(8).items():
            grp = sub[sub["NM_FABRICANTE"].str.upper() == nome]
            top_fabr.append({
                "nome": nome,
                "n": int(n),
                "idade_media": round(float(grp["idade"].dropna().mean()), 1),
            })
        modelos = sub["DS_MODELO"].dropna().str.strip().str.upper().value_counts().head(8)
        comp = sub["motor"].value_counts().to_dict()
        ca_counts = sub["ca_status"].value_counts().to_dict()
        n_vig  = int(ca_counts.get("vigente", 0))
        n_venc = int(ca_counts.get("vencido", 0))
        n_ind  = int(ca_counts.get("indefinido", 0))
        return {
            "total": int(len(sub)),
            "idade_media": round(float(idade_validas.mean()), 1) if len(idade_validas) else None,
            "idade_p50":   round(float(idade_validas.median()), 1) if len(idade_validas) else None,
            "idade_p90":   round(float(idade_validas.quantile(0.90)), 1) if len(idade_validas) else None,
            "pct_jato":    round(n_jato / len(sub) * 100, 1) if len(sub) else 0,
            "ca": {
                "vigente":    n_vig,
                "vencido":    n_venc,
                "indefinido": n_ind,
                "pct_vigente": round(n_vig / len(sub) * 100, 1) if len(sub) else 0,
            },
            "top_fabricantes": top_fabr,
            "top_modelos": _enrich_modelos(sub, modelos),
            "composicao_motor": {k: int(v) for k, v in comp.items()},
        }

    frota_nacional = {
        "ano_ref": ANO_REF,
        "transporte": _resumo(transp),
        "total":      _resumo(ativa),
    }

    out_json = OUT / "frota_nacional.json"
    out_json.write_text(json.dumps(frota_nacional, ensure_ascii=False, indent=2),
                        encoding="utf-8")
    print(f"  → {out_json.relative_to(ROOT)}  ({out_json.stat().st_size/1024:.1f} KB)",
          flush=True)

    # ── Visão por empresa ─────────────────────────────────────────────────────
    ativa["op_data"]  = ativa["OPERADORES"].apply(_first_operador)
    ativa["op_nome"]  = ativa["op_data"].apply(lambda x: x.get("NOME") if x else None)
    ativa["empresa"] = ativa["op_nome"].apply(_classify_operador)

    por_empresa = ativa.dropna(subset=["empresa"])
    print(f"  aeronaves mapeadas a empresa comercial: {len(por_empresa)}", flush=True)

    rows = []
    for sigla, grp in por_empresa.groupby("empresa"):
        idade = grp["idade"].dropna()
        idade = idade[idade.between(0, 80)]
        modelo_top = (
            grp["DS_MODELO"].dropna().str.strip().str.upper()
            .value_counts().head(1)
        )
        n_vig = int((grp["ca_status"] == "vigente").sum())
        n_venc = int((grp["ca_status"] == "vencido").sum())
        rows.append({
            "empresa_icao": sigla,
            "label": EMPRESA_LABEL.get(sigla, sigla),
            "n_aeronaves": int(len(grp)),
            "idade_media": round(float(idade.mean()), 1) if len(idade) else None,
            "pct_jato": round((grp["motor"] == "JATO").sum() / len(grp) * 100, 1),
            "modelo_top": modelo_top.index[0] if not modelo_top.empty else None,
            "n_ca_vigente": n_vig,
            "n_ca_vencido": n_venc,
            "pct_ca_vigente": round(n_vig / len(grp) * 100, 1) if len(grp) else 0,
        })

    frota_empresas = pd.DataFrame(rows).sort_values("n_aeronaves", ascending=False)
    out_pq = OUT / "frota_empresas.parquet"
    frota_empresas.to_parquet(out_pq, index=False)
    print(f"  → {out_pq.relative_to(ROOT)}  ({out_pq.stat().st_size/1024:.1f} KB)",
          flush=True)
    print("\nFrota por empresa:")
    print(frota_empresas.to_string(index=False))


if __name__ == "__main__":
    main()
