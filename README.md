# CIPHER

**Conversational Intelligence Platform for Hotspots, Entities & Records** — a grounded, evidence-cited crime-intelligence assistant for the Karnataka State Police, built for **KSP Datathon 2026** and deployed on **Zoho Catalyst**.

Ask a question in English or Kannada — *"who are the repeat chain-snatching accused in Bengaluru North this year?"* — and CIPHER answers **only from the records**, citing the `fir_id` / `person_id` behind every fact, and **abstains** when the records don't support an answer.

## Features

| | |
|---|---|
| **Conversational core** | Natural-language query → intent + entity extraction → retrieval → grounded answer (English + Kannada) |
| **Evidence trail** | Every fact cites its source FIR/person record; no supporting record → explicit abstain, never a guess |
| **Context-aware follow-ups** | District, crime type and date range carry across turns |
| **Criminal-network graph** | Interactive node-edge graph of co-accused and shared-attribute links around any entity |
| **Crime trends + hotspots** | Trend chart and hotspot map by area, crime type and period |
| **PDF export** | Any conversation exported as a cited, watermarked PDF |
| **Role + audit** | Role-scoped access banner and an append-only audit row per query |

## Tech stack

- **Frontend** — React + TypeScript + Vite, Cytoscape.js (graph), Leaflet (map), Recharts (trends)
- **Backend** — Catalyst Functions (Node.js, Advanced I/O + Express)
- **Data** — Catalyst Data Store (synthetic CCTNS-aligned records)
- **GenAI** — Catalyst QuickML: GLM 4.7 Flash (LLM Serving) + RAG over a FIR-narrative Knowledge Base
- **Object storage** — Catalyst Stratus (generated PDFs)

All data is **synthetic**. No real police records are used anywhere in this repository.

## Repository layout

```
catalyst.json        Catalyst project config (cipher-ksp, IN data center)
web/                 React SPA source (Vite) — builds into client/
client/              Catalyst Web Client Hosting dir (build output; only config is committed)
functions/api/       Advanced I/O function: /query, /network, /trends, /export-pdf, /seed
data/                Synthetic dataset + generator
docs/                PRD, FRD, HLD, LLD, prototype brief, build plan, Catalyst setup guide
```

## Setup

```bash
npm install -g zcatalyst-cli
catalyst login

# frontend
cd web && npm install

# backend
cd ../functions/api && npm install
```

## Run locally

```bash
# terminal 1 — Catalyst functions + hosted client on :4200
catalyst serve --http 4200

# terminal 2 — SPA with hot reload on :5180, proxying /server to the functions above
cd web && npm run dev
```

## Deploy

```bash
cd web && npm run build     # emits the SPA into client/
catalyst deploy             # pushes client + functions to Catalyst
```

**Live deployment (Catalyst, IN data center):**

- App: <https://cipher-ksp-60075928027.development.catalystserverless.in/app/index.html>
- API: <https://cipher-ksp-60075928027.development.catalystserverless.in/server/api/health>

The app is fully functional against the bundled record store (`CIPHER_STORE=memory`).
LLM-composed answers and RAG similarity switch on once the QuickML environment
variables are set on the `api` function in the console (see `docs/07`, §5d) and the
three `data/kb/` files are uploaded to the QuickML Knowledge Base.

## Documentation

The full design set lives in [`docs/`](docs/) — product requirements, functional requirements, high- and low-level design, the prototype brief, the build plan, and the Catalyst setup guide.
