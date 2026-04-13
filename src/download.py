"""
download.py — Baixa todos os datasets necessários para o projeto anac-viz.

Datasets:
  1. Dados Estatísticos do Transporte Aéreo  (~354 MB, arquivo único)
  2. Percentuais de Atrasos e Cancelamentos  (Anexos I/II/III, 2000–2026)
  3. Aeródromos Públicos — Características Gerais  (~2.5 MB, arquivo único)

Uso:
    python src/download.py                        # tudo (2000–2026)
    python src/download.py --start 2016           # atrasos a partir de 2016
    python src/download.py --start 2016 --end 2024
    python src/download.py --skip-producao        # pula o arquivo grande
    python src/download.py --skip-atrasos
    python src/download.py --skip-aerodromos
"""

import argparse
import time
from pathlib import Path
from urllib.parse import quote

import requests
from tqdm import tqdm

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent

DELAY = 0.4        # segundos entre requests bem-sucedidos
TIMEOUT = 60       # segundos por request (arquivo grande = timeout maior)

SESSION_HEADERS = {"User-Agent": "anac-viz/1.0 (mestrado UFRGS - pesquisa)"}

MESES_PT = {
    1: "janeiro", 2: "fevereiro", 3: "março",    4: "abril",
    5: "maio",    6: "junho",     7: "julho",     8: "agosto",
    9: "setembro",10: "outubro",  11: "novembro", 12: "dezembro",
}

# Arquivos únicos (url, destino_relativo_ao_ROOT)
SINGLE_FILES = {
    "producao": (
        "https://sistemas.anac.gov.br/dadosabertos/"
        "Voos%20e%20opera%C3%A7%C3%B5es%20a%C3%A9reas/"
        "Dados%20Estat%C3%ADsticos%20do%20Transporte%20A%C3%A9reo/"
        "Dados_Estatisticos.csv",
        ROOT / "data" / "raw" / "producao" / "Dados_Estatisticos.csv",
    ),
    "aerodromos": (
        "https://sistemas.anac.gov.br/dadosabertos/"
        "Aerodromos/Aer%C3%B3dromos%20P%C3%BAblicos/"
        "Caracter%C3%ADsticas%20Gerais/"
        "pda_aerodromos_publicos_caracteristicas_gerais.csv",
        ROOT / "data" / "raw" / "aerodromos" / "aerodromos_caracteristicas_gerais.csv",
    ),
}

BASE_ATRASOS = (
    "https://sistemas.anac.gov.br/dadosabertos/"
    "Voos%20e%20opera%C3%A7%C3%B5es%20a%C3%A9reas/"
    "Percentuais%20de%20atrasos%20e%20cancelamentos"
)

ANEXOS = {
    "anexo_i.csv":   "Anexo I.csv",
    "anexo_ii.csv":  "Anexo II.csv",
    "anexo_iii.csv": "Anexo III.csv",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _kb(n_bytes: int) -> str:
    return f"{n_bytes / 1024:.1f} KB"


def download_file(
    url: str,
    dest: Path,
    session: requests.Session,
    *,
    stream: bool = False,
    label: str = "",
) -> tuple[str, int]:
    """
    Baixa `url` para `dest`.
    Retorna (status, bytes): status é 'ok', 'skip' ou 'fail:<motivo>'.
    """
    if dest.exists():
        return "skip", dest.stat().st_size

    dest.parent.mkdir(parents=True, exist_ok=True)

    try:
        resp = session.get(url, timeout=TIMEOUT, stream=stream)
        if resp.status_code == 404:
            return "fail:404", 0
        resp.raise_for_status()

        if stream:
            # Download com barra de progresso para arquivos grandes
            total = int(resp.headers.get("content-length", 0))
            desc = label or dest.name
            with open(dest, "wb") as fh, tqdm(
                total=total,
                unit="B",
                unit_scale=True,
                unit_divisor=1024,
                desc=f"  {desc}",
                leave=False,
            ) as bar:
                for chunk in resp.iter_content(chunk_size=65536):
                    fh.write(chunk)
                    bar.update(len(chunk))
            n_bytes = dest.stat().st_size
        else:
            dest.write_bytes(resp.content)
            n_bytes = len(resp.content)

        return "ok", n_bytes

    except requests.RequestException as exc:
        # Remove arquivo parcial se criado
        if dest.exists():
            dest.unlink()
        return f"fail:{exc}", 0


def _print_result(label: str, status: str, n_bytes: int) -> None:
    tag = {"ok": "OK  ", "skip": "SKIP"}.get(status, "FAIL")
    size_str = f"({_kb(n_bytes)})" if n_bytes else ""
    fail_detail = f" — {status[5:]}" if status.startswith("fail:") else ""
    print(f"  [{tag}] {label} {size_str}{fail_detail}")


def _summary(contadores: dict, falhas: list[str]) -> None:
    total = sum(contadores.values())
    print(f"\n{'='*60}")
    print(f"  Resumo — {total} arquivo(s) processado(s)")
    print(f"{'='*60}")
    print(f"  OK      : {contadores['ok']}")
    print(f"  Pulados : {contadores['skip']}")
    print(f"  Falhas  : {contadores['fail']}")
    if falhas:
        print(f"\n  Arquivos com falha ({len(falhas)}):")
        for f in falhas:
            print(f"    • {f}")
    print(f"{'='*60}")
    if contadores["fail"]:
        print("  Nota: 404 em datas sem dados publicados é esperado.\n")


# ---------------------------------------------------------------------------
# Download de arquivo único (producao / aerodromos)
# ---------------------------------------------------------------------------

def download_single(key: str, session: requests.Session, contadores: dict, falhas: list) -> None:
    url, dest = SINGLE_FILES[key]
    label = dest.name
    print(f"\n[{key.upper()}] {label}")
    status, n_bytes = download_file(url, dest, session, stream=True, label=label)
    _print_result(label, status, n_bytes)

    if status == "ok":
        contadores["ok"] += 1
        time.sleep(DELAY)
    elif status == "skip":
        contadores["skip"] += 1
    else:
        contadores["fail"] += 1
        falhas.append(f"{label} → {status}")


# ---------------------------------------------------------------------------
# Download dos Anexos I/II/III
# ---------------------------------------------------------------------------

def build_atrasos_url(ano: int, mes: int, nome_remoto: str) -> str:
    mes_str = f"{mes:02d} - {MESES_PT[mes]}"
    return f"{BASE_ATRASOS}/{ano}/{quote(mes_str)}/{quote(nome_remoto)}"


def atrasos_dest(ano: int, mes: int, nome_local: str) -> Path:
    mes_str = f"{mes:02d}_{MESES_PT[mes]}"
    return ROOT / "data" / "raw" / "atrasos" / str(ano) / mes_str / nome_local


def download_atrasos(
    start: int,
    end: int,
    session: requests.Session,
    contadores: dict,
    falhas: list,
) -> None:
    tasks = [
        (ano, mes, nome_local, nome_remoto)
        for ano in range(start, end + 1)
        for mes in range(1, 13)
        for nome_local, nome_remoto in ANEXOS.items()
    ]

    print(f"\n[ATRASOS] {len(tasks)} arquivos ({start}–{end})")

    with tqdm(tasks, desc="  Anexos", unit="arq") as pbar:
        for ano, mes, nome_local, nome_remoto in pbar:
            url = build_atrasos_url(ano, mes, nome_remoto)
            dest = atrasos_dest(ano, mes, nome_local)

            status, n_bytes = download_file(url, dest, session)

            if status == "ok":
                contadores["ok"] += 1
                time.sleep(DELAY)
            elif status == "skip":
                contadores["skip"] += 1
            else:
                contadores["fail"] += 1
                falhas.append(f"{ano}/{mes:02d}/{nome_local} → {status}")

            pbar.set_postfix(
                ok=contadores["ok"],
                skip=contadores["skip"],
                fail=contadores["fail"],
                refresh=False,
            )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Baixa todos os datasets ANAC para o projeto anac-viz.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--start", type=int, default=2000, help="Ano inicial dos atrasos (padrão: 2000)")
    parser.add_argument("--end",   type=int, default=2026, help="Ano final dos atrasos (padrão: 2026)")
    parser.add_argument("--skip-producao",   action="store_true", help="Pula o download de Dados_Estatisticos.csv")
    parser.add_argument("--skip-atrasos",    action="store_true", help="Pula o download dos Anexos I/II/III")
    parser.add_argument("--skip-aerodromos", action="store_true", help="Pula o download dos aeródromos")
    args = parser.parse_args()

    if args.start > args.end:
        parser.error("--start deve ser <= --end")

    session = requests.Session()
    session.headers.update(SESSION_HEADERS)

    contadores: dict[str, int] = {"ok": 0, "skip": 0, "fail": 0}
    falhas: list[str] = []

    if not args.skip_producao:
        download_single("producao", session, contadores, falhas)

    if not args.skip_aerodromos:
        download_single("aerodromos", session, contadores, falhas)

    if not args.skip_atrasos:
        download_atrasos(args.start, args.end, session, contadores, falhas)

    _summary(contadores, falhas)


if __name__ == "__main__":
    main()
