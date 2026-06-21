# Product Requirements Document (PRD)
## Intelligent Conversational AI & Crime Analytics Platform

| Field | Value |
|---|---|
| **Document** | Product Requirements Document (PRD) |
| **Product Name** | CIPHER — Crime Intelligence Platform for Higher-order Enforcement Reasoning |
| **Version** | 1.0 |
| **Date** | 21 June 2026 |
| **Status** | Draft for Review |
| **Author** | Solution Architecture Team |
| **Sponsor** | Karnataka State Police (KSP) / State CID |
| **Classification** | Confidential — Law Enforcement Use Only |

---

## 1. Executive Summary

CIPHER is an Intelligent Conversational AI and Crime Analytics Platform that lets investigators, analysts, supervisors, and policymakers interrogate the state crime database using **natural language** (English and Kannada, by voice or text) and obtain **criminologically grounded analytics**.

The platform goes beyond keyword search and report generation. It discovers hidden relationships between crimes, offenders, victims, locations, and socio-economic patterns; surfaces criminal networks; profiles offenders; forecasts emerging crime; and supports investigative decisions — while keeping every AI answer **explainable, evidence-linked, role-gated, and auditable**.

### Vision
> Move policing from *reactive record-keeping* to *proactive, intelligence-led, accountable enforcement* by making the entire crime knowledge base conversational and analytically intelligent.

---

## 2. Problem Statement

State crime data (FIRs, charge sheets, arrest records, victim/accused details, property, financial trails) is **vast, siloed, and structurally complex**. Today:

1. **Retrieval is slow and skill-bound.** Officers depend on rigid forms, SQL-savvy operators, or paper registers. A simple cross-question ("which accused in theft cases in this taluk also appear in NDPS cases?") can take days.
2. **Relationships are invisible.** Links between offenders, victims, locations, vehicles, phones, and bank accounts exist in the data but are never connected, so organized crime and repeat-offender networks go undetected.
3. **Analysis is descriptive, not predictive.** Existing dashboards report *what happened*; they rarely explain *why* (sociological drivers) or *what is likely next* (forecasting).
4. **Language and literacy barriers.** Field officers are most fluent in Kannada; current systems are English-only and form-driven.
5. **No accountability layer on insight.** Any analytical conclusion used in an investigation must be traceable to source evidence — current tools provide numbers without provenance.

**Consequence:** Underutilized data, delayed investigations, missed networks, and reactive rather than preventive policing.

---

## 3. Goals & Objectives

### 3.1 Business Goals
| # | Goal | Target Outcome |
|---|---|---|
| G1 | Democratize crime-data access | Any authorized officer can query without technical skill |
| G2 | Reduce time-to-insight | From days to seconds for cross-entity queries |
| G3 | Detect hidden networks | Surface organized/repeat-offender groups proactively |
| G4 | Enable preventive policing | Forecast hotspots and emerging patterns ahead of incidents |
| G5 | Ensure accountability | 100% of AI answers traceable to source records |

### 3.2 Success Metrics (KPIs)
| Metric | Baseline | Target (12 mo) |
|---|---|---|
| Median query response time | hours–days | < 5 sec (retrieval), < 30 sec (analytics) |
| NL query intent accuracy | — | ≥ 92% |
| Kannada query accuracy | — | ≥ 85% |
| % answers with evidence trail | — | 100% |
| Network links surfaced per case | — | +40% over manual |
| Investigator adoption (MAU) | 0 | ≥ 70% of target users |
| Forecast precision@hotspot | — | ≥ 0.65 |

### 3.3 Non-Goals (Out of Scope for v1)
- Autonomous decision-making or automated charge-sheet generation (system is **decision-support**, human-in-the-loop only).
- Real-time CCTV/face recognition ingestion (future phase).
- Replacing CCTNS / existing systems of record — CIPHER **augments**, not replaces.
- Cross-state / national data federation (Phase 3).

---

## 4. Target Users & Personas

| Persona | Role | Primary Needs | Access Tier |
|---|---|---|---|
| **Investigating Officer (IO)** | Field/Station | Quick FIR/accused lookups, case timelines, similar past cases, leads | Investigator |
| **Crime Analyst** | District/State Crime Records | Pattern/trend analysis, network graphs, hotspots, socio-demographics | Analyst |
| **Supervisor / SP / DCP** | Command | Case oversight, district dashboards, resource allocation, audit | Supervisor |
| **Policymaker / DGP Office** | Strategy | Macro trends, socio-economic correlations, policy impact | Policymaker |
| **System Administrator** | IT/Security | RBAC, audit logs, data governance, model ops | Admin |

---

## 5. User Stories (Representative)

- **As an IO**, I want to ask *"ಈ ತಿಂಗಳು ಹುಬ್ಬಳ್ಳಿಯಲ್ಲಿ ನಡೆದ ದರೋಡೆ ಪ್ರಕರಣಗಳ ಆರೋಪಿಗಳ ಪಟ್ಟಿ ಕೊಡಿ"* (give me the list of accused in robbery cases in Hubballi this month) by voice and get a verified list with FIR links.
- **As an IO**, I want to follow up with *"which of them have prior NDPS records?"* without restating the city or crime type.
- **As an analyst**, I want to see a network graph linking accused, shared phone numbers, and bank accounts to detect an organized group.
- **As an analyst**, I want to correlate burglary spikes with a ward's unemployment and migration indicators.
- **As a supervisor**, I want an auto-generated case summary and investigation timeline for review.
- **As a policymaker**, I want emerging-crime early-warning alerts for the next quarter by district.
- **As an admin**, I want every query, answer, and data-access event logged immutably for audit.
- **Any user** wants to export a conversation to a local PDF for the case file.

---

## 6. Product Scope — Capability Pillars

CIPHER delivers ten capability pillars (mapped to detailed functional requirements in the FRD):

| # | Pillar | Description |
|---|---|---|
| P1 | **Conversational Crime Intelligence** | NL chatbot (EN/KN, voice+text), context-aware follow-ups, PDF export of history |
| P2 | **Criminal Network & Relationship Analysis** | Entity-link discovery & graph visualization; organized-crime detection |
| P3 | **Crime Pattern & Trend Analytics** | Time/geo/type/MO trends; hotspots; seasonal & event-based analysis |
| P4 | **Sociological Crime Insights** | Demographic & socio-economic correlation; social risk factors |
| P5 | **Criminology-Based Offender Profiling** | Repeat-offender ID, behavioral analysis, risk scoring |
| P6 | **Investigator Decision Support** | Case summaries, timelines, similar-case retrieval, lead recommendations |
| P7 | **Financial Crime & Transaction Link Analysis** | Money-trail & suspicious-network detection; workflow integration |
| P8 | **Crime Forecasting & Early Warning** | Emerging-pattern detection, predictive hotspots, gang-activity alerts |
| P9 | **Explainable AI & Transparent Analytics** | Evidence trails, reasoning-path visualization, accountability compliance |
| P10 | **Secure Role-Based Access & Governance** | RBAC, audit logs, data-protection compliance |

---

## 7. Key Features (Prioritized — MoSCoW)

### Must Have (v1 / MVP)
- Conversational NL interface (English + Kannada), text & voice.
- Context-aware multi-turn dialogue with memory.
- Retrieval over FIRs, accused, victims, locations, investigation status, criminal history.
- Evidence-linked answers (every fact cites source record IDs).
- Criminal network entity-linking + interactive graph visualization.
- Crime pattern/trend analytics with hotspots map.
- Repeat-offender identification & risk scoring (rule + ML hybrid).
- RBAC, audit logging, conversation → PDF export.

### Should Have
- Sociological/socio-economic correlation analytics.
- Behavioral/MO-based offender profiling.
- Case summarization & investigation timeline auto-generation.
- Similar-case retrieval (semantic).
- Financial transaction link analysis.

### Could Have
- Crime forecasting & early-warning alerts (predictive).
- Reasoning-path visualization (explainability deep-dive).
- Additional regional languages beyond Kannada.

### Won't Have (this release)
- Autonomous actions, live biometric/CCTV feeds, cross-state federation.

---

## 8. Assumptions, Dependencies & Constraints

### Assumptions
- Access to a structured/normalized copy or secure read replica of the state crime database (CCTNS-aligned schema).
- Historical data of sufficient volume/quality for ML (≥ 3–5 years preferred).
- Authorized integration points for financial-crime data (subject to legal sanction).

### Dependencies
- CCTNS / state crime DB connectivity and data-sharing approvals.
- ASR/TTS and translation capability for Kannada.
- On-prem / state-cloud (e.g., MeghRaj / SDC) hosting for data residency.

### Constraints
- **Data residency & sovereignty** — sensitive data must remain on-prem/state-controlled infrastructure; no public-cloud egress of PII.
- **Human-in-the-loop** — all outputs are advisory; no automated legal action.
- **Compliance** — DPDP Act 2023, IT Act, evidence-handling norms, law-enforcement governance.
- LLM components must support on-prem / sovereign deployment for sensitive data.

---

## 9. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| LLM hallucination on facts | High | Med | Strict RAG grounding; answers only from retrieved records; "no-evidence" fallback; citations mandatory |
| Bias in profiling/forecasting | High | Med | Bias audits, fairness metrics, human review, exclude protected attributes from scoring drivers |
| Data privacy breach | Critical | Low | On-prem, encryption, RBAC, field-level masking, audit |
| Poor data quality | Med | High | Data-quality pipeline, entity resolution, confidence scoring |
| Kannada NLP accuracy | Med | Med | Fine-tuned/Indic models, transliteration, human-verified glossary |
| Misuse / over-reliance | High | Med | Explainability, advisory framing, training, audit trails |
| Adoption resistance | Med | Med | Voice-first UX, vernacular support, phased rollout, training |

---

## 10. Release Plan (Phased)

| Phase | Timeline | Scope |
|---|---|---|
| **Phase 0 — Prototype** | 0–1 mo | Conversational EN/KN Q&A over sample data, basic network graph, evidence links (this hackathon deliverable) |
| **Phase 1 — MVP** | 1–4 mo | Full retrieval, RBAC, audit, network analysis, pattern/trend analytics, risk scoring, PDF export |
| **Phase 2** | 4–8 mo | Sociological insights, profiling, decision support, financial link analysis, explainability UI |
| **Phase 3** | 8–12 mo | Forecasting & early warning, advanced socio-economic modeling, broader language/data federation |

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **FIR** | First Information Report |
| **MO** | Modus Operandi |
| **CCTNS** | Crime and Criminal Tracking Network & Systems |
| **RAG** | Retrieval-Augmented Generation |
| **NER** | Named Entity Recognition |
| **RBAC** | Role-Based Access Control |
| **XAI** | Explainable AI |
| **DPDP** | Digital Personal Data Protection Act, 2023 |
| **ASR/TTS** | Automatic Speech Recognition / Text-to-Speech |
| **NDPS** | Narcotic Drugs and Psychotropic Substances Act |

---
*End of PRD.*
