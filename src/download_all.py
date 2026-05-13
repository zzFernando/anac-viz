#!/usr/bin/env python3
"""
download_all.py — Baixa todos os datasets CSV/XLSX do portal ANAC.

Fontes:
  1. scrap/anac_dados_abertos_arquivos.csv  — arquivos mapeados pelo crawler
  2. scrap/anac_dados_abertos_completo.json — pastas mês de VRA e Percentuais
     (depth=4); os arquivos internos são descobertos on-the-fly e cacheados.

Saída: data/raw/<caminho_relativo_no_portal>/

Uso:
    python src/download_all.py                         # tudo (sem JSON)
    python src/download_all.py --dry-run               # plano sem baixar
    python src/download_all.py --cats voos aerodromos  # filtra categorias
    python src/download_all.py --include-json          # inclui JSON
    python src/download_all.py --skip-vra              # pula VRA
    python src/download_all.py --skip-percentuais      # pula Percentuais
"""

import argparse
import csv
import json
import re
import sys
import time
import urllib.parse
from collections import defaultdict
from pathlib import Path
from typing import Optional

import requests
from tqdm import tqdm

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

ROOT    = Path(__file__).resolve().parent.parent
DATA    = ROOT / "data" / "raw"
SCRAP   = ROOT / "scrap"
BASE    = "https://sistemas.anac.gov.br/dadosabertos/"

PAUSE   = 0.5      # segundos entre downloads bem-sucedidos
TIMEOUT = 120      # timeout de download (arquivos grandes)
RETRIES = 4
CHUNK   = 65_536

DISCOVERY_CACHE = SCRAP / "anac_vra_percentuais_files.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Referer": "https://www.gov.br/anac/",
}

ROW_RE = re.compile(
    r'<a href="([^"]+)">([^<]+)</a>\s+([\d\-A-Za-z:\s]+?)\s{2,}([\d\-A-Z\.]+|\-)',
    re.IGNORECASE,
)

VALID_EXTS = {"csv", "xlsx", "xls"}

session = requests.Session()
session.headers.update(HEADERS)


# ---------------------------------------------------------------------------
# Helpers HTTP
# ---------------------------------------------------------------------------

def fetch_html(url: str) -> Optional[str]:
    delay = 1.5
    for attempt in range(RETRIES):
        try:
            r = session.get(url, timeout=30)
            if r.status_code == 200:
                return r.text
            if r.status_code in (502, 503, 504):
                print(f"  [{r.status_code}] retry {attempt+1} em {delay:.1f}s",
                      file=sys.stderr)
                time.sleep(delay)
                delay *= 2
                continue
            return None
        except Exception as e:
            print(f"  [exc] {e} — retry {attempt+1}", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
    return None


def parse_listing(html: str, base_url: str) -> list[dict]:
    items = []
    for m in ROW_RE.finditer(html):
        href, name, date, size = m.groups()
        if href.startswith("../") or href in ("../", "/"):
            continue
        full = urllib.parse.urljoin(base_url, href)
        rel  = urllib.parse.unquote(full.replace(BASE, ""))
        items.append({
            "name": name.strip(),
            "url":  full,
            "rel_path": rel,
            "date": date.strip(),
            "size": size.strip(),
            "is_dir": href.endswith("/"),
        })
    return items


def size_to_bytes(s: str) -> int:
    if not s or s in ("-", ""):
        return 0
    s = s.strip().upper()
    mult = 1
    for suf, m in [("K", 1024), ("M", 1024**2), ("G", 1024**3)]:
        if s.endswith(suf):
            mult = m
            s = s[:-1]
            break
    try:
        return int(float(s) * mult)
    except ValueError:
        return 0


def fmt_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(n) < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"


# ---------------------------------------------------------------------------
# Carregamento do índice
# ---------------------------------------------------------------------------

def load_indexed_files(include_json: bool) -> list[dict]:
    """Carrega arquivos já mapeados pelo crawler (CSV do scrap)."""
    exts = VALID_EXTS | ({"json"} if include_json else set())
    files = []
    path = SCRAP / "anac_dados_abertos_arquivos.csv"
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            nome = row["arquivo"]
            ext  = nome.rsplit(".", 1)[-1].lower() if "." in nome else ""
            if ext not in exts:
                continue
            files.append({
                "url":        row["url"],
                "rel_path":   row["caminho_relativo"],
                "size_bytes": int(row["tamanho_bytes"] or 0),
                "categoria":  row["categoria"],
                "arquivo":    nome,
                "ext":        ext,
            })
    return files


# ---------------------------------------------------------------------------
# Descoberta de VRA e Percentuais (depth=5)
# ---------------------------------------------------------------------------

def _month_dirs_from_json(skip_vra: bool, skip_percentuais: bool) -> list[dict]:
    """Extrai as pastas mês (depth=4) do JSON do crawler."""
    path = SCRAP / "anac_dados_abertos_completo.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    dirs = []
    for item in data["items"]:
        if not item["is_dir"] or item["depth"] != 4:
            continue
        rp = item["rel_path"]
        if "Voo Regular Ativo" in rp and not skip_vra:
            dirs.append(item)
        elif "Percentuais de atrasos" in rp and not skip_percentuais:
            dirs.append(item)
    return dirs


def load_vra_and_percentuais(
    skip_vra: bool, skip_percentuais: bool, include_json: bool
) -> list[dict]:
    """Descobre (e cacheia) arquivos dentro das pastas mês de VRA/Percentuais."""
    if skip_vra and skip_percentuais:
        return []

    month_dirs = _month_dirs_from_json(skip_vra, skip_percentuais)

    # Carrega cache existente
    cached: list[dict] = []
    if DISCOVERY_CACHE.exists():
        with open(DISCOVERY_CACHE, encoding="utf-8") as f:
            cached = json.load(f)

    cached_dir_urls = {
        urllib.parse.unquote(c["url"]).rsplit("/", 1)[0] + "/"
        for c in cached
    }

    to_discover = [
        d for d in month_dirs
        if urllib.parse.unquote(d["url"]) not in cached_dir_urls
    ]

    if to_discover:
        print(f"\n[DESCOBERTA] {len(to_discover)} pastas mês para crawlar…")
        with tqdm(to_discover, unit="pasta") as pbar:
            for d in pbar:
                pbar.set_description(d["rel_path"][-70:])
                found = [
                    i for i in parse_listing(fetch_html(d["url"]) or "", d["url"])
                    if not i["is_dir"]
                ]
                cached.extend(found)
                time.sleep(PAUSE)

        with open(DISCOVERY_CACHE, "w", encoding="utf-8") as f:
            json.dump(cached, f, ensure_ascii=False)
        print(f"  Cache salvo: {DISCOVERY_CACHE.name}")

    exts = VALID_EXTS | ({"json"} if include_json else set())
    result = []
    for item in cached:
        ext = item["name"].rsplit(".", 1)[-1].lower() if "." in item["name"] else ""
        if ext not in exts:
            continue
        rp = item.get("rel_path", "")
        is_vra  = "Voo Regular Ativo" in rp
        is_perc = "Percentuais de atrasos" in rp
        if is_vra and skip_vra:
            continue
        if is_perc and skip_percentuais:
            continue
        result.append({
            "url":        item["url"],
            "rel_path":   rp,
            "size_bytes": size_to_bytes(item.get("size", "")),
            "categoria":  "Voos e operações aéreas",
            "arquivo":    item["name"],
            "ext":        ext,
        })
    return result


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

def download_one(url: str, dest: Path, size_hint: int = 0) -> str:
    """Baixa url para dest. Retorna 'ok', 'skip' ou 'fail:<motivo>'."""
    if dest.exists():
        current = dest.stat().st_size
        if size_hint == 0 or current == size_hint:
            return "skip"
        dest.unlink()  # tamanho diferente: re-baixa

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")

    delay = 1.5
    for attempt in range(RETRIES):
        try:
            r = session.get(url, timeout=TIMEOUT, stream=True)
            if r.status_code in (404, 403):
                return f"fail:{r.status_code}"
            if r.status_code in (502, 503, 504):
                time.sleep(delay)
                delay *= 2
                continue
            r.raise_for_status()

            with open(tmp, "wb") as fh:
                for chunk in r.iter_content(chunk_size=CHUNK):
                    fh.write(chunk)

            tmp.rename(dest)
            return "ok"

        except Exception as e:
            if tmp.exists():
                tmp.unlink()
            if attempt < RETRIES - 1:
                time.sleep(delay)
                delay *= 2
            else:
                return f"fail:{e}"

    return "fail:max_retries"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Baixa todos os datasets CSV/XLSX do portal ANAC.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Mostra o plano sem baixar nada")
    parser.add_argument("--cats", nargs="+", metavar="CAT",
                        help="Filtra categorias (ex: voos aerodromos operador)")
    parser.add_argument("--include-json", action="store_true",
                        help="Inclui arquivos JSON (muito maiores que CSV)")
    parser.add_argument("--skip-vra", action="store_true",
                        help="Pula VRA — Voo Regular Ativo (~2–5 GB)")
    parser.add_argument("--skip-percentuais", action="store_true",
                        help="Pula Percentuais de atrasos e cancelamentos")
    args = parser.parse_args()

    # --- Coleta de arquivos ---
    print("Carregando índice do crawler…")
    files = load_indexed_files(args.include_json)
    print(f"  {len(files)} arquivos no índice")

    vra_perc = load_vra_and_percentuais(
        args.skip_vra, args.skip_percentuais, args.include_json
    )
    if vra_perc:
        print(f"  {len(vra_perc)} arquivos VRA/Percentuais descobertos")
    files += vra_perc

    # --- Filtro de categorias ---
    if args.cats:
        cats_lower = [c.lower() for c in args.cats]
        files = [
            f for f in files
            if any(
                kw in f.get("categoria", "").lower() or
                kw in f.get("rel_path", "").lower()
                for kw in cats_lower
            )
        ]

    # --- Deduplicação por URL ---
    seen: set[str] = set()
    deduped: list[dict] = []
    for f in files:
        key = urllib.parse.unquote(f["url"])
        if key not in seen:
            seen.add(key)
            deduped.append(f)
    files = deduped

    # --- Resumo ---
    total_bytes = sum(f.get("size_bytes", 0) for f in files)
    by_cat: dict[str, dict] = defaultdict(lambda: {"n": 0, "bytes": 0})
    for f in files:
        cat = f.get("categoria") or f.get("rel_path", "?").split("/")[0]
        by_cat[cat]["n"] += 1
        by_cat[cat]["bytes"] += f.get("size_bytes", 0)

    sep = "=" * 62
    print(f"\n{sep}")
    print(f"  {len(files)} arquivos  |  ~{fmt_bytes(total_bytes)} estimados")
    print(sep)
    for cat, v in sorted(by_cat.items(), key=lambda x: -x[1]["bytes"]):
        print(f"  {v['n']:4d} arqs  {fmt_bytes(v['bytes']):>10}  {cat}")
    print(sep)
    print(f"  Destino: {DATA}")
    print()

    if args.dry_run:
        print("(--dry-run ativo: nenhum arquivo foi baixado)")
        return

    # --- Download ---
    counters = {"ok": 0, "skip": 0, "fail": 0}
    failures: list[str] = []

    with tqdm(files, unit="arq", desc="Baixando") as pbar:
        for item in pbar:
            rel  = item.get("rel_path", item["arquivo"])
            dest = DATA / rel
            pbar.set_postfix(
                ok=counters["ok"], skip=counters["skip"],
                fail=counters["fail"], refresh=False,
            )
            pbar.set_description(rel[-55:] if len(rel) > 55 else rel)

            status = download_one(item["url"], dest, item.get("size_bytes", 0))

            if status == "ok":
                counters["ok"] += 1
                time.sleep(PAUSE)
            elif status == "skip":
                counters["skip"] += 1
            else:
                counters["fail"] += 1
                failures.append(f"{rel} → {status}")
                pbar.write(f"  [FAIL] {rel[:80]} — {status}")

    print(f"\n{sep}")
    print(f"  OK: {counters['ok']}  |  "
          f"Skip: {counters['skip']}  |  "
          f"Fail: {counters['fail']}")
    if failures:
        print(f"\n  Falhas ({len(failures)}):")
        for line in failures[:30]:
            print(f"    {line}")
        if len(failures) > 30:
            print(f"    … +{len(failures)-30} mais")
    print(sep)


if __name__ == "__main__":
    main()
