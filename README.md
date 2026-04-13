# Panorama da Aviação Doméstica Brasileira

Projeto de mestrado em Ciência da Computação (foco em IA) — análise exploratória e visualização interativa da aviação doméstica brasileira com dados abertos da ANAC (2016–2026).

**Persona:** Carla Mendes, gestora de operações do Aeroporto Salgado Filho (POA), usando os painéis para identificar padrões operacionais e comparar com a média nacional.

---

## Visualizações

| # | Tipo | Descrição |
|---|------|-----------|
| 1 | Mapa coroplético | Passageiros e decolagens por aeroporto no Brasil |
| 2 | Série temporal | Evolução mensal do setor — passageiros, decolagens, impacto COVID |
| 3 | Heatmap | Concentração de atrasos por hora × dia da semana |
| 4 | Barras comparativas | Market share e pontualidade por companhia aérea |

Todas as visualizações são exportadas como HTML interativo via Plotly.

---

## Fontes de dados

- **Produção aeronáutica** — [ANAC / Dados de Produção](https://sistemas.anac.gov.br/dadosabertos/Voos%20e%20opera%C3%A7%C3%B5es%20a%C3%A9reas/Produ%C3%A7%C3%A3o%20Aeronautica/)
  - `data/raw/producao/Base_10_anos.csv` — 372 mil linhas, encoding `latin1`, separador `;`
  - Colunas: empresa, ano, mês, aeroporto origem/destino, natureza, passageiros, carga, ASK, RPK, ATK, RTK, combustível, distância, decolagens, horas voadas, bagagem

- **Atrasos e cancelamentos** — [ANAC / Percentuais de Atrasos](https://sistemas.anac.gov.br/dadosabertos/Voos%20e%20opera%C3%A7%C3%B5es%20a%C3%A9reas/Percentuais%20de%20atrasos%20e%20cancelamentos/)
  - `data/raw/atrasos/<ano>/<MM_mes>/anexo_i.csv` — etapa individual de voo
  - `data/raw/atrasos/<ano>/<MM_mes>/anexo_ii.csv` — consolidado por empresa + par de aeroportos
  - `data/raw/atrasos/<ano>/<MM_mes>/anexo_iii.csv` — consolidado por par de aeroportos

---

## Estrutura do repositório

```
anac-viz/
├── data/
│   ├── raw/
│   │   ├── producao/         # Base_10_anos.csv (não versionado)
│   │   └── atrasos/          # CSVs por ano/mês (não versionados)
│   └── processed/            # Dados limpos e agregados
├── notebooks/                # Análise exploratória e protótipos
├── src/
│   └── download.py           # Script de download dos dados ANAC
├── viz/                      # HTMLs interativos exportados
├── slides/                   # Apresentações
├── .gitignore
├── requirements.txt
└── README.md
```

> Os arquivos `data/` não são versionados. Use `src/download.py` para obter os dados.

---

## Instalação

```bash
# Clone o repositório
git clone <url>
cd anac-viz

# Crie e ative o ambiente virtual
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Instale as dependências
pip install -r requirements.txt

# Baixe os dados de atrasos (2016–2026)
python src/download.py

# Coloque Base_10_anos.csv em data/raw/producao/ manualmente
```

---

## Uso

```bash
# Inicie o Jupyter
jupyter notebook notebooks/
```

---

## Stack

- Python 3.11+
- Pandas, NumPy
- Plotly (visualizações interativas + exportação HTML)
- GeoPandas (mapa coroplético)
- Jupyter Notebook
