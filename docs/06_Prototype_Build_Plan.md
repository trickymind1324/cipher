# Prototype Build Plan — CIPHER (KSP Datathon 2026)

| Field | Value |
|---|---|
| **Document** | Prototype Build Plan |
| **Product** | CIPHER |
| **Version** | 0.1 (for approval) |
| **Date** | 28 June 2026 |
| **Companion docs** | PRD, FRD, HLD, LLD, Prototype Brief |
| **Status** | Draft — awaiting approval before any code |

> Approved demo scope: **Core conversational loop + Criminal-Network graph + Crime-trend/Hotspot view.**
> Mandatory deployment target: **Zoho Catalyst (exclusive)** per submission guideline.

---

## 1. Deliverables → Source mapping (what the judges receive)

| # | Required deliverable | Plan to satisfy it | Status |
|---|---|---|---|
| D1 | **Prototype Brief** (problem, features, stack, impact) | Exists: `docs/05_Prototype_Brief.md`; minor refresh so "tech stack" reflects the Catalyst build | ✅ have, needs edit |
| D2 | **Public GitHub repo** (source + README + setup/run) | Build the prototype in this repo; add root `README.md` with setup/run/deploy | ⏳ to build |
| D3 | **Demo video** (≤3 min) | Storyboard + script; **user records** | ⏳ script only |
| D4 | **Deployed link** — **Zoho Catalyst only** | React SPA on Catalyst Web Client Hosting + Catalyst Functions backend | ⏳ to build/deploy |
| D5 | **Submission deck** (official `template/*.pptx`) | Fill all 16 slides from docs + prototype artifacts | ⏳ to fill |

---

## 2. Submission deck → content source (16 slides)

| Slide | Content | Source / Action |
|---|---|---|
| 1 Team details | name, leader, size, problem stmt | **Need from user** |
| 2 Brief about solution | 1-paragraph pitch | Prototype Brief §1–2 |
| 3 Opportunities / USP / differentiation | grounded-no-hallucination, Kannada voice, 100% evidence-trail, sovereign | PRD §1, Brief §2 differentiators |
| 4 Features list | the implemented + designed pillars | FRD modules / Brief §2 |
| 5 Process-flow / use-case diagram | end-to-end query flow | HLD §5.1 + FRD §15 → render real diagram |
| 6 Wireframes (optional) | chat + graph + map screens | Produce simple mockups |
| 7 Architecture diagram | layered arch **as deployed on Catalyst** | HLD §3 → render Catalyst-mapped diagram |
| 8 Technologies | React, Catalyst Functions/Data Store, LLM, Cytoscape, Leaflet | §4 below |
| 9 **Catalyst services used** | Web Hosting, Functions, Data Store, Stratus, (Auth, Cache, Cron) | §4 below |
| 10 Cost (optional) | Catalyst free-tier note | Brief / optional |
| 11 Prototype snapshots | screenshots of live app | After build |
| 12 Performance/benchmark | latency table, intent-accuracy sample, abstain-rate | Measure on demo dataset |
| 13 Links | repo + video + deployed link | After deploy |
| 14 Future development | phased roadmap | PRD §10 release plan |
| 15–16 | blank | — |

---

## 3. Prototype feature scope (what we actually build)

### In scope (this prototype)
- **F1 Conversational core (EN + Kannada, text)** — NL query → intent+entities → retrieval → grounded answer.
- **F2 Grounded, evidence-cited answers** — every fact cites `fir_id`/`person_id`; **abstain** when no records (`FR-CONV-10`, `FR-XAI-01`).
- **F3 Context-aware follow-ups** — carry over district/crime-type/date across turns (`FR-CONV-05`).
- **F4 Criminal-network graph** — interactive node-edge graph around an entity (`FR-NET-02/07`).
- **F5 Crime-trend + hotspot view** — trend chart + map heat/markers by area & crime type (`FR-PAT-01/02/06`).
- **F6 Conversation → PDF export** — client/function-generated PDF with citations + watermark (`FR-CONV-07`).
- **F7 Role banner + audit log row** — lightweight RBAC label + append audit entry per query (`FR-SEC-03`, demo-level).

### Voice (stretch, not committed)
- Kannada/English **voice input** via browser Web Speech API (no extra infra). Flagged as stretch; text is the committed path.

### Out of scope for prototype (kept as design/story only)
- Forecasting, financial money-trail, offender risk-ML, similar-case ML, full SSO/MFA, Neo4j/K8s. Shown in docs/deck as roadmap.

---

## 4. Technical architecture (Catalyst-deployed)

```
Browser (React SPA)
  └── Catalyst Web Client Hosting (Slate)   ← static build
        │  HTTPS
        ▼
  Catalyst Functions (Node.js)      ← /query, /network, /trends, /export-pdf, /seed
        │
        ├── Catalyst Data Store              ← fir, person, fir_party, attribute, socio_economic, audit_log
        ├── Catalyst QuickML — LLM Serving   ← GLM 4.7 Flash (OAuth REST) → grounded answer composition
        ├── Catalyst QuickML — RAG / KB      ← FIR-narrative knowledge base → semantic/similar-case + cited grounding
        └── Catalyst Stratus (object store)  ← generated PDFs
```

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite; Cytoscape.js (graph); Leaflet (map); Recharts (trends) |
| Backend | Catalyst **Functions** (Node.js), thin REST matching LLD §4 API shapes |
| Data | Catalyst **Data Store** tables (synthetic CCTNS-aligned seed) for structured retrieval (lists/filters) |
| LLM | Catalyst **QuickML LLM Serving** — **GLM 4.7 Flash** (131K context, multilingual 100+ langs, MIT-licensed open-weight), OAuth REST callable from Functions (IN data center). *Replaces the now-deprecated Qwen 2.5 models (EOL 30 Jun 2026).* No external API needed; consistent with the docs' sovereignty story (open-weight model served on-platform). A thin `llmClient` keeps it swappable. |
| RAG / grounding | Catalyst **QuickML RAG + Knowledge Base** — FIR narratives ingested as KB docs; semantic retrieval + re-rank + **Response Breakdown citations (source IDs)** → directly realizes `FR-XAI-01` evidence trails and `FR-DSS-03` similar-case |
| Storage | Catalyst **Stratus** (object storage) for exported PDFs — *note: legacy File Store is deprecated (EOL 30 Apr 2026), so use Stratus* |
| Auth (demo) | Hardcoded role switcher now; Catalyst **Authentication (Embedded Auth)** as stretch |
| Language | Kannada handling: Qwen multilingual + translate/normalize step + glossary; optional Web Speech for voice |

**Catalyst services for slide 9:** Web Client Hosting (Slate) · Functions · Data Store · QuickML (LLM Serving + RAG/Knowledge Base) · Stratus · (stretch: Authentication, Cache). *Avoid deprecated File Store / Cron / Event Listeners (EOL 30 Apr 2026).*

> **Hybrid retrieval design:** structured queries (lists of accused, filters by district/crime/date) run as **Data Store SQL**; narrative/semantic queries (similar cases, "summarize this FIR") run through **QuickML RAG**; **LLM Serving** composes the final grounded NL answer from whichever context was retrieved — matching the LLD §3.4 intent-routing table.

---

## 5. Repository structure (target)

```
/ (repo root)
├── README.md                  # pitch, features, setup, run, deploy
├── catalyst.json              # Catalyst project config
├── client/                    # React SPA (Vite)
│   ├── src/components/         # Chat, GraphView, TrendsView, ExportButton, RoleBar
│   ├── src/api/                # calls to functions
│   └── ...
├── functions/
│   ├── query/                  # NLU + retrieval + RAG grounding
│   ├── network/                # graph build from Data Store
│   ├── trends/                 # aggregation + hotspots
│   ├── export-pdf/             # PDF render
│   └── shared/                 # llmClient, dataStore client, rbac, audit
├── data/
│   ├── seed/                   # synthetic CSV/JSON (FIRs, persons, links, socio)
│   └── generate_seed.*         # generator script
└── docs/                       # existing design set + this plan
```

---

## 6. Build sequence (phases & checkpoints)

| Phase | Work | Done-when |
|---|---|---|
| **P0 Foundations** | Confirm plan; create Catalyst project; repo scaffold; `catalyst.json` | Repo builds locally; empty app deploys to Catalyst |
| **P1 Data** | Generate synthetic CCTNS-aligned dataset (~3 districts, ~300 FIRs, persons, co-accused/shared-attribute links, socio rows); `/seed` loads Data Store | Data queryable via a function |
| **P2 Core chat (F1–F3)** | `/query`: intent+entity parse → retrieval → LLM grounded answer + citations + abstain; context carry-over; React chat UI; role bar + audit (F7) | EN query returns cited answer; no-data → abstain; follow-up works |
| **P3 Kannada** | language detect + translate/normalize in `/query`; respond in query language; glossary | KN query → KN cited answer |
| **P4 Network graph (F4)** | `/network` builds nodes/edges from co-accused + shared attributes; Cytoscape view; NL "show network around X" triggers it | Graph renders & is interactive with source links |
| **P5 Trends + hotspots (F5)** | `/trends` aggregates by time/geo/type; Recharts chart + Leaflet hotspot map | NL trend query returns chart + map + text summary |
| **P6 PDF export (F6)** | `/export-pdf` renders conversation + citations + watermark to Stratus; download link | PDF downloads with citations |
| **P7 Deploy** | Deploy client + functions to Catalyst; smoke test live | Public Catalyst URL works end-to-end |
| **P8 Submission assets** | README; screenshots (slide 11); benchmark table (slide 12); architecture/flow diagrams (slides 5/7); fill PPTX; demo-video script | Deck complete; links live |

**Recommended checkpoints for your review:** after P2 (core loop working), after P5 (visuals working), after P7 (deployed).

---

## 7. Open items / decisions needed from you

| # | Item | Why it blocks | Default if unanswered |
|---|---|---|---|
| O1 | **Zoho Catalyst account/project** — account **country must be set to India** (required for the hackathon credits) → **IN data center**. Do you have the project created? | Needed to deploy (D4), wire `catalyst.json`, and use QuickML GenAI (GA in IN) | Scaffold for IN data center; you create/share the project ID |
| O2 | ~~LLM provider~~ **Resolved → use Catalyst QuickML LLM Serving + RAG.** Only need: enable QuickML, create the RAG Knowledge Base, generate OAuth creds | grounding + similar-case | I wire `llmClient` to QuickML; you enable QuickML + share OAuth client |
| O3 | **Team details** (team name, leader, size, exact problem-statement text) | Slide 1 | Placeholder until provided |
| O4 | **Voice input** — include browser voice (stretch) in demo or skip? | Affects P3 effort | Skip unless asked; keep text |
| O5 | **Demo video** — you record from a script I provide? | D3 | I deliver script + shot list; you record |

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Catalyst Functions cold-start / runtime limits | Keep functions thin; precompute graph/trends on seed; cache |
| LLM grounding leaks hallucination | Strict "answer only from CONTEXT, cite ids, else abstain" prompt + QuickML RAG Response-Breakdown citations + post-check validator (LLD §3.2) |
| Kannada accuracy via GLM 4.7 Flash | GLM 4.7 Flash covers 100+ languages but verify Kannada quality early — add an EN-canonical translate step + curated glossary fallback; demo with vetted KN queries; keep text path primary |
| QuickML KB doc limit (500KB/doc, .pdf/.docx/.txt) | Chunk synthetic FIR narratives into small per-FIR docs; structured lists come from Data Store SQL, not KB |
| Time | Phase order front-loads the gating deliverable (deployed core loop); visuals/PDF after |

---

*End of Build Plan — awaiting approval. On approval, start at P0.*
