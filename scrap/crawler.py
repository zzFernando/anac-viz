#!/usr/bin/env python3
"""
Crawler do Portal de Dados Abertos da ANAC.

O endpoint https://sistemas.anac.gov.br/dadosabertos/ expõe um
"directory listing" estilo Apache/Nginx. Este script percorre essa
árvore recursivamente (BFS), extrai nome/data/tamanho de cada entrada
e salva o resultado em JSON + CSV + Markdown.

Cuidados:
  - serial (1 requisição por vez) com pausa entre requests, pois o
    servidor responde 503 sob carga;
  - retry com backoff exponencial em 5xx;
  - User-Agent + Referer realistas (sem isso o servidor devolve 503);
  - "PRUNE_BEYOND" limita a profundidade em subárvores que explodem
    combinatorialmente (ex.: AeroportosConcedidos tem 1 pasta por
    aeroporto × N rodadas × dezenas de subpastas DADOS_NNN_YYYY);
  - salva snapshot parcial a cada 30 diretórios visitados, então
    pode ser interrompido e retomado.

Uso:
    pip install requests
    python3 anac_crawler.py
"""

import csv
import json
import os.path
import re
import sys
import time
import urllib.parse
from collections import Counter, defaultdict, deque

import requests

# ---------------------------------------------------------------------------
# CONFIGURAÇÃO
# ---------------------------------------------------------------------------
BASE = "https://sistemas.anac.gov.br/dadosabertos/"

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

# Profundidade máxima padrão (em níveis a partir da raiz).
MAX_DEPTH_DEFAULT = 4

# Subárvores que devem ser podadas mais cedo para evitar explosão.
# Chave = nome do top-level; valor = profundidade máxima permitida.
PRUNE_BEYOND = {
    "AeroportosConcedidos": 2,  # só lista AeroportosConcedidos/<AEROPORTO>/
}

PAUSE = 0.5      # segundos entre requisições
TIMEOUT = 30     # timeout por request
RETRIES = 4      # tentativas em caso de erro 5xx

# Arquivos de saída
PARTIAL_PATH = "anac_partial.json"
FULL_JSON = "anac_full.json"
OUT_CSV = "anac_dados_abertos_arquivos.csv"
OUT_MD = "anac_dados_abertos_indice.md"

# ---------------------------------------------------------------------------
# REGEX para parsear o HTML de directory listing
# ---------------------------------------------------------------------------
# Formato típico de uma linha:
#   <a href="Aerodromos/">Aerodromos/</a>     02-Apr-2025 16:12     -
#   <a href="arquivo.csv">arquivo.csv</a>     12-Mar-2024 10:00     1.2M
ROW_RE = re.compile(
    r'<a href="([^"]+)">([^<]+)</a>\s+([\d\-A-Za-z:\s]+?)\s{2,}([\d\-A-Z\.]+|\-)',
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Sessão HTTP global com retry
# ---------------------------------------------------------------------------
session = requests.Session()
session.headers.update(HEADERS)


def fetch(url: str) -> str | None:
    """Baixa o HTML de `url` com retry exponencial em erros 5xx."""
    delay = 1.5
    for attempt in range(RETRIES):
        try:
            r = session.get(url, timeout=TIMEOUT)
            if r.status_code == 200:
                return r.text
            if r.status_code in (502, 503, 504):
                print(f"  [{r.status_code}] retry {attempt+1} em {delay:.1f}s...",
                      file=sys.stderr)
                time.sleep(delay)
                delay *= 2
                continue
            print(f"  [{r.status_code}] {url}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"  [exc] {e} -- retry {attempt+1}", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
    return None


def parse_listing(html: str, base_url: str) -> list[dict]:
    """Extrai entradas (arquivo/diretório) de um directory listing."""
    items = []
    for m in ROW_RE.finditer(html):
        href, name, date, size = m.groups()
        if href.startswith("../") or href in ("../", "/"):
            continue
        full = urllib.parse.urljoin(base_url, href)
        items.append({
            "name": name.strip(),
            "url": full,
            "date": date.strip(),
            "size": size.strip(),
            "is_dir": href.endswith("/"),
        })
    return items


def relpath(url: str) -> str:
    """Caminho relativo a BASE (decodificado)."""
    return urllib.parse.unquote(url.replace(BASE, ""))


def should_descend(url: str, depth: int) -> bool:
    """Decide se vamos explorar este diretório."""
    rp = relpath(url)
    parts = [p for p in rp.split("/") if p]
    if not parts:
        return depth < MAX_DEPTH_DEFAULT
    top = parts[0]
    if top in PRUNE_BEYOND:
        return depth < PRUNE_BEYOND[top]
    return depth < MAX_DEPTH_DEFAULT


# ---------------------------------------------------------------------------
# Crawl principal (BFS, com checkpoint)
# ---------------------------------------------------------------------------
def crawl(start_url: str = BASE) -> tuple[list[dict], set[str]]:
    visited: set[str] = set()
    all_items: list[dict] = []
    queue: deque[tuple[str, int]] = deque([(start_url, 0)])

    # Tenta retomar de um snapshot parcial
    if os.path.exists(PARTIAL_PATH):
        try:
            with open(PARTIAL_PATH, "r", encoding="utf-8") as f:
                snap = json.load(f)
            visited = set(snap["visited"])
            all_items = snap["items"]
            queue = deque()
            for it in all_items:
                if it["is_dir"] and it["url"] not in visited \
                        and should_descend(it["url"], it["depth"]):
                    queue.append((it["url"], it["depth"]))
            print(f"Retomando snapshot: visited={len(visited)} "
                  f"items={len(all_items)} pending={len(queue)}",
                  file=sys.stderr)
        except Exception as e:
            print(f"Falha ao retomar snapshot: {e} -- começando do zero",
                  file=sys.stderr)

    n = 0
    try:
        while queue:
            url, depth = queue.popleft()
            if url in visited:
                continue
            visited.add(url)
            n += 1

            rp = relpath(url) or "/"
            print(f"[{n:5d} | d={depth}] {rp[:120]}", file=sys.stderr)

            html = fetch(url)
            time.sleep(PAUSE)
            if not html:
                continue

            for it in parse_listing(html, url):
                it["depth"] = depth + 1
                it["parent_rel"] = rp
                it["rel_path"] = relpath(it["url"])
                all_items.append(it)
                if it["is_dir"] and should_descend(it["url"], depth + 1):
                    queue.append((it["url"], depth + 1))

            # checkpoint a cada 30 diretórios
            if n % 30 == 0:
                save_partial(all_items, visited)
    finally:
        save_partial(all_items, visited)

    return all_items, visited


def save_partial(items, visited):
    with open(PARTIAL_PATH, "w", encoding="utf-8") as f:
        json.dump({"items": items, "visited": sorted(visited)},
                  f, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Helpers para análise
# ---------------------------------------------------------------------------
def size_to_bytes(s: str) -> int:
    """Converte '1.2M' / '500K' / '3G' em bytes. '-' (diretório) -> 0."""
    if not s or s == "-":
        return 0
    s = s.strip().upper()
    mult = 1
    for suf, m in [("K", 1024), ("M", 1024**2),
                   ("G", 1024**3), ("T", 1024**4)]:
        if s.endswith(suf):
            mult = m
            s = s[:-1]
            break
    try:
        return int(float(s) * mult)
    except ValueError:
        return 0


# ---------------------------------------------------------------------------
# Geração dos relatórios
# ---------------------------------------------------------------------------
def export_csv(items: list[dict], path: str = OUT_CSV) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["categoria", "subcategoria", "caminho_relativo",
                    "arquivo", "data_modificacao",
                    "tamanho_humano", "tamanho_bytes", "url"])
        for it in items:
            if it["is_dir"]:
                continue
            parts = it["rel_path"].split("/")
            cat = parts[0] if parts else ""
            sub = parts[1] if len(parts) > 1 else ""
            w.writerow([cat, sub, it["rel_path"], it["name"],
                        it["date"], it["size"],
                        size_to_bytes(it["size"]), it["url"]])


def export_markdown(items: list[dict], path: str = OUT_MD) -> None:
    groups: dict[str, list[dict]] = defaultdict(list)
    for it in items:
        cat = it["rel_path"].split("/")[0]
        groups[cat].append(it)

    lines = [
        "# Portal de Dados Abertos da ANAC — Índice",
        "",
        f"Base: <{BASE}>",
        "",
        f"{sum(1 for i in items if not i['is_dir'])} arquivos / "
        f"{sum(1 for i in items if i['is_dir'])} diretórios.",
        "",
        "## Categorias top-level",
        "",
    ]
    for cat in sorted(groups):
        files = [i for i in groups[cat] if not i["is_dir"]]
        dirs = [i for i in groups[cat] if i["is_dir"]]
        total_b = sum(size_to_bytes(i.get("size", "")) for i in files)
        subs = sorted({
            i["rel_path"].split("/")[1]
            for i in groups[cat]
            if i["is_dir"] and len(i["rel_path"].split("/")) >= 2
        })
        lines += [
            f"### 📁 {cat}/",
            "",
            f"- {len(dirs)} diretórios, {len(files)} arquivos, "
            f"~{total_b/1024**2:.1f} MB",
            "- Subáreas:",
        ]
        for s in subs:
            lines.append(f"  - {s}")
        lines.append("")

    # Top 30 maiores
    lines += ["## Top 30 maiores arquivos", "",
              "| Tamanho | Caminho |", "|---:|---|"]
    files_ws = sorted(
        [(size_to_bytes(i["size"]), i) for i in items if not i["is_dir"]],
        reverse=True, key=lambda x: x[0]
    )
    for sz, it in files_ws[:30]:
        lines.append(f"| {sz/1024**2:.1f} MB | `{it['rel_path']}` |")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def print_summary(items: list[dict]) -> None:
    n_dirs = sum(1 for i in items if i["is_dir"])
    n_files = sum(1 for i in items if not i["is_dir"])
    total_b = sum(size_to_bytes(i["size"]) for i in items if not i["is_dir"])
    exts = Counter(
        os.path.splitext(i["name"])[1].lower() or "(sem ext)"
        for i in items if not i["is_dir"]
    )
    print(f"\n=== RESUMO ===")
    print(f"Total entradas: {len(items)}  "
          f"(dirs={n_dirs}, arquivos={n_files})")
    print(f"Tamanho total: {total_b:,} bytes "
          f"(~{total_b/1024**3:.2f} GB)")
    print("Extensões:", ", ".join(f"{e}={n}" for e, n in exts.most_common(10)))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    items, visited = crawl(BASE)

    # JSON completo
    with open(FULL_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "base": BASE,
            "directories_visited": sorted(visited),
            "items": items,
        }, f, ensure_ascii=False, indent=2)

    export_csv(items)
    export_markdown(items)
    print_summary(items)
    print(f"\nArquivos gerados:\n  {FULL_JSON}\n  {OUT_CSV}\n  {OUT_MD}")