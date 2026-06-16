# Panorama da Aviacao Domestica Brasileira

Dashboard estatico sobre a aviacao domestica brasileira com dados abertos da
ANAC. O app e um projeto Next.js exportado como arquivos estaticos e publicado
no Firebase Hosting.

Nao ha backend no runtime. Os dados consolidados ficam em `public/data/` e sao
carregados diretamente pelo navegador.

## Estrutura

```text
anac-viz/
├── public/data/          # JSONs consolidados usados pelo dashboard
├── src/app/              # Pagina e layout
├── src/components/       # Graficos, mapas e UI
├── src/lib/              # Carga dos dados, tipos e agregacoes
├── firebase.json         # Publica out/
├── .firebaserc           # Projeto Firebase
├── package.json
├── next.config.mjs       # output: "export"
├── start.sh              # Atalho para desenvolvimento local
└── README.md
```

## Rodar Localmente

```bash
npm install
npm run dev
```

Abra:

```text
http://localhost:3000
```

Tambem pode usar:

```bash
./start.sh
```

## Build

```bash
npm run build
```

O build gera `out/`.

## Deploy

```bash
firebase deploy
```

O Firebase Hosting esta configurado para publicar `out/`.

## Dados

O dashboard depende destes arquivos em `public/data/`:

- `stats.json`
- `percentuais.json`
- `aerodromos.json`
- `frota_nacional.json`
- `frota_empresas.json`
- `sdr_resumo.json`
- `ads_resumo.json`
- `ocorrencias_resumo.json`
- `ocorrencias_eventos.json`

Esses arquivos sao os consolidados necessarios para a aplicacao funcionar.
