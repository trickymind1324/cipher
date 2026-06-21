# Prototype Brief
## CIPHER — Intelligent Conversational AI & Crime Analytics Platform

| Field | Value |
|---|---|
| **Team / Submission** | Karnataka State Police (KSP) Challenge |
| **Product** | CIPHER — Crime Intelligence Platform for Higher-order Enforcement Reasoning |
| **Version** | 1.0 |
| **Date** | 21 June 2026 |
| **Classification** | Confidential — Law Enforcement Use Only |

---

## 1. Problem Statement Addressed

State crime data — FIRs, charge sheets, accused/victim records, locations, vehicles, phones, and financial trails — is **vast, siloed, and structurally complex**. Today, extracting insight requires technical skill and time, relationships between entities stay invisible, analysis is descriptive rather than predictive, and English-only form-driven tools exclude Kannada-fluent field officers. Critically, any insight used in an investigation must be **traceable to source evidence** — existing tools give numbers without provenance.

**CIPHER turns the entire state crime database into a conversation** — askable in plain English or Kannada, by voice or text — and layers **criminologically grounded analytics** on top, while keeping every answer explainable, evidence-linked, role-gated, and auditable. It shifts policing from *reactive record-keeping* to *proactive, intelligence-led, accountable enforcement*.

---

## 2. Key Features & Functionalities

| # | Capability | What it does |
|---|---|---|
| 1 | **Conversational Crime Intelligence** | NL chatbot over FIRs, accused, victims, locations, investigation status & criminal history. English + Kannada, **voice & text**, context-aware follow-ups, **conversation → local PDF export**. |
| 2 | **Criminal Network Analysis** | Links accused, victims, locations, accounts, phones & vehicles into an **interactive network graph**; detects organized-crime groups & repeat-offender clusters. |
| 3 | **Crime Pattern & Trend Analytics** | Trends across time, geography, crime type & modus operandi; **hotspot maps**, emerging clusters, seasonal/event-based analysis. |
| 4 | **Sociological Crime Insights** | Correlates crime with age, gender, socio-economic factors, urbanization, migration, economic stress & education; surfaces social risk factors. |
| 5 | **Offender Profiling & Risk Scoring** | Identifies repeat/habitual offenders, behavioral/MO profiles, and an **explainable risk score** to prioritize investigation. |
| 6 | **Investigator Decision Support** | Auto **case summaries & timelines**, **similar past cases** with outcomes, and **investigative lead** recommendations. |
| 7 | **Financial Crime Link Analysis** | Detects transactions tied to crime, traces **money trails** and suspicious networks. |
| 8 | **Forecasting & Early Warning** | Predictive **crime-hotspot** forecasts and **early-warning alerts** for repeat/gang/organized activity. |
| 9 | **Explainable & Transparent AI** | **Every answer cites source records**, shows reasoning paths, confidence & data lineage — accountability by design. |
| 10 | **Secure Role-Based Access & Governance** | RBAC for investigators/analysts/supervisors/policymakers, field-level PII masking, **immutable audit logs**, DPDP-compliant. |

**Signature differentiators:** voice-first **Kannada** support · **grounded answers (no hallucination — abstains when no evidence)** · 100% **evidence-trailed** outputs · on-prem **data sovereignty**.

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React + TypeScript, Cytoscape/D3 (network graph), Mapbox/Leaflet (hotspot maps), Recharts |
| **Voice & Language** | Indic ASR/TTS (AI4Bharat / Bhashini) + Whisper; IndicTrans2 translation; MuRIL/Indic-BERT for Kannada NLU |
| **Conversational AI** | On-prem/sovereign open-weight **LLM + RAG** orchestration (LangGraph/custom), NLU (intent + NER), dialogue/context manager, strict grounding guardrails |
| **Analytics/ML** | Python; graph algorithms (Louvain, centrality), Getis-Ord/KDE hotspots, gradient-boosted risk model with **SHAP** explainability, spatio-temporal forecasting |
| **Data Platform** | PostgreSQL + **PostGIS** + **pgvector**, **Neo4j** (knowledge graph), OpenSearch (full-text), MinIO (objects/PDF) |
| **Backend/Infra** | FastAPI microservices, Kafka/Redis (CDC & async), **Kubernetes** on state cloud (MeghRaj/SDC) / on-prem |
| **Security** | Keycloak/state IdP (SSO + MFA), OPA (RBAC/ABAC policy), HashiCorp Vault, TLS 1.2+/AES-256, WORM audit store |
| **Observability/MLOps** | Prometheus + Grafana, OpenTelemetry, ELK; MLflow registry, Feast feature store |

> All sensitive-data inference runs **on state-controlled infrastructure** — no PII leaves the security boundary; the LLM sits behind a provider-abstraction layer so the best open model can be swapped in without external API dependence.

---

## 4. Proposed Impact & Use Cases

### Impact
- **Time-to-insight: days → seconds.** Any authorized officer queries the whole crime base in their own language — no SQL, no operators.
- **Hidden networks made visible.** Organized crime and repeat-offender rings surfaced automatically (+~40% links over manual analysis).
- **Proactive, preventive policing.** Hotspot forecasts and early-warning alerts let commanders deploy *before* incidents cluster.
- **Accountable AI.** 100% of answers carry an evidence trail — defensible, reproducible, audit-ready for law-enforcement governance.
- **Inclusion.** Voice-first Kannada interface brings field officers and low-literacy users into data-driven policing.

### Representative Use Cases
1. **Field IO (voice, Kannada):** *"This month's robbery accused in Hubballi?"* → verified list with FIR links → follow-up *"which have NDPS priors?"* without restating context → export to PDF for the case file.
2. **Analyst:** Render the network around a suspect → spot a shared-account/phone cluster → flag an organized group with cohesion score and source links.
3. **Supervisor:** Auto case summary + investigation timeline + similar past cases and their outcomes for review and resource allocation.
4. **Policymaker:** District-level correlation of burglary spikes with unemployment/migration indices → targeted social-intervention policy.
5. **Command:** Predictive hotspot map + early-warning alert for emerging gang activity next quarter → preventive patrolling.

### Prototype Scope (this submission)
A working demo on a **sample / synthetic CCTNS-aligned dataset** showing: (a) English + Kannada voice/text Q&A with context-aware follow-ups, (b) **evidence-cited grounded answers** with abstain-on-no-data, (c) an **interactive criminal-network graph**, (d) a **crime-trend/hotspot view**, and (e) **conversation-to-PDF export** — demonstrating the end-to-end "ask → grounded answer → visual insight → exportable, auditable record" loop.

---
*End of Prototype Brief.*
