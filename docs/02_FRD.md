# Functional Requirements Document (FRD)
## Intelligent Conversational AI & Crime Analytics Platform (CIPHER)

| Field | Value |
|---|---|
| **Document** | Functional Requirements Document (FRD) |
| **Product** | CIPHER |
| **Version** | 1.0 |
| **Date** | 21 June 2026 |
| **Companion docs** | PRD v1.0, HLD v1.0, LLD v1.0 |
| **Classification** | Confidential — Law Enforcement Use Only |

---

## 1. Purpose & Scope

This FRD translates the PRD capability pillars into **testable functional requirements**. Each requirement has a unique ID (`FR-<module>-<n>`), a priority (M=Must, S=Should, C=Could), and acceptance criteria. Non-functional requirements (NFRs) are listed in §13.

**Requirement ID convention:** `FR-<MODULE>-<seq>` where MODULE ∈ {CONV, NET, PAT, SOC, PROF, DSS, FIN, FCST, XAI, SEC, DATA, ADMIN}.

---

## 2. Module: Conversational Crime Intelligence Interface (CONV)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CONV-01 | The system shall accept natural-language queries via **text** in English and Kannada. | M | EN/KN text query returns relevant grounded answer; language auto-detected. |
| FR-CONV-02 | The system shall accept natural-language queries via **voice** (ASR) in English and Kannada. | M | Spoken query transcribed with ≥85% WER-adjusted accuracy and answered; TTS optional readback. |
| FR-CONV-03 | The system shall translate/normalize Kannada queries and respond in the user's query language. | M | KN query → KN answer; technical terms preserved via glossary. |
| FR-CONV-04 | The system shall retrieve information on **FIRs, accused, victims, locations, investigation status, and criminal history**. | M | Each entity type queryable by NL; returns correct records with IDs. |
| FR-CONV-05 | The system shall maintain **context across turns** so follow-up queries need not repeat context. | M | "...and their prior cases?" resolves pronoun/entity from prior turn correctly. |
| FR-CONV-06 | The system shall maintain per-session conversation memory and allow context reset. | M | New session = clean context; "start over" clears memory. |
| FR-CONV-07 | The system shall export the **conversation history to a PDF saved locally**. | M | PDF includes Q&A, timestamps, citations, user/role, watermark; saved to local path. |
| FR-CONV-08 | The system shall handle ambiguous queries by asking a clarifying question. | S | Ambiguous input triggers disambiguation prompt, not a wrong answer. |
| FR-CONV-09 | The system shall present tabular/list results with pagination and inline source links. | M | Lists > N rows paginate; each row links to source FIR/record. |
| FR-CONV-10 | The system shall refuse/abstain when no supporting evidence exists ("no records found / insufficient data"). | M | Out-of-data query never fabricated; abstains with explanation. |
| FR-CONV-11 | The system shall support voice readback of answers (TTS) in EN/KN. | S | Answer playable as audio in query language. |

---

## 3. Module: Criminal Network & Relationship Analysis (NET)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-NET-01 | The system shall identify links between **accused, victims, locations, financial accounts, vehicles, phone numbers, and crime incidents**. | M | Shared-attribute links computed and queryable. |
| FR-NET-02 | The system shall **visualize criminal networks** as an interactive node-edge graph. | M | Graph renders entities (nodes) & relationships (edges) with type, weight, drill-down. |
| FR-NET-03 | The system shall **detect organized-crime groups** via community/cluster detection. | S | Dense sub-networks flagged with cohesion score. |
| FR-NET-04 | The system shall **detect repeat-offender networks** and co-offending patterns. | M | Co-accused recurrence surfaced with frequency. |
| FR-NET-05 | The system shall rank network nodes by **centrality/influence** (e.g., key player detection). | S | Centrality metrics (degree/betweenness) shown per node. |
| FR-NET-06 | The system shall allow filtering the network by time, crime type, and geography. | S | Filters re-render subgraph correctly. |
| FR-NET-07 | The system shall let a NL query trigger a network view ("show me the network around accused X"). | M | NL → graph rendered centered on entity X. |

---

## 4. Module: Crime Pattern & Trend Analytics (PAT)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-PAT-01 | The system shall analyze crime trends across **time, geography, crime type, and modus operandi**. | M | Trend output for any combination of these dimensions. |
| FR-PAT-02 | The system shall identify **crime hotspots** and emerging clusters geospatially. | M | Hotspot map (heat/cluster) by area with intensity. |
| FR-PAT-03 | The system shall perform **seasonal and event-based** trend analysis. | S | Seasonality decomposition; festival/event correlation. |
| FR-PAT-04 | The system shall compare trends across periods/regions on demand. | S | Period-over-period & region-over-region comparison. |
| FR-PAT-05 | The system shall detect **MO clustering** (similar modus operandi across cases). | S | Cases grouped by MO similarity with linkage score. |
| FR-PAT-06 | The system shall surface trend output via both NL answers and visual charts/maps. | M | NL query returns chart + textual summary. |

---

## 5. Module: Sociological Crime Insights (SOC)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-SOC-01 | The system shall analyze crime patterns by **demographic attributes** (age, gender, socio-economic background). | S | Demographic breakdown of crime types with statistics. |
| FR-SOC-02 | The system shall identify **social risk factors** influencing crime patterns. | S | Risk-factor correlations ranked with strength & confidence. |
| FR-SOC-03 | The system shall correlate crime with **urbanization, migration, economic stress, education** and other social indicators. | C | External socio-economic datasets joined; correlations reported. |
| FR-SOC-04 | The system shall present correlations with statistical confidence and explicit "correlation ≠ causation" disclaimers. | M | Confidence interval + disclaimer shown. |
| FR-SOC-05 | The system shall exclude protected/sensitive attributes from any punitive scoring (analysis only). | M | Caste/religion etc. usable for aggregate insight, never in individual risk scores. |

---

## 6. Module: Criminology-Based Offender Profiling (PROF)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-PROF-01 | The system shall identify **repeat offenders and habitual criminals**. | M | Offenders with ≥ threshold priors flagged with history. |
| FR-PROF-02 | The system shall perform **behavioral analysis** of offenders based on crime history and MO. | S | Behavioral profile: preferred crime types, MO, geography, time patterns. |
| FR-PROF-03 | The system shall compute an explainable **risk score** to prioritize investigation. | M | Score 0–100 with contributing factors listed; reproducible. |
| FR-PROF-04 | The risk model shall use only legally permissible, non-discriminatory features. | M | Feature list reviewed; protected attributes excluded; documented. |
| FR-PROF-05 | The system shall show the **evidence and factors** behind each profile/score. | M | Every score expandable into its driver factors + source records. |

---

## 7. Module: Investigator Decision Support (DSS)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-DSS-01 | The system shall generate **automated case summaries**. | S | Summary covers parties, charges, key events, status; cites records. |
| FR-DSS-02 | The system shall construct **investigation timelines** from case events. | S | Chronological event timeline rendered per case. |
| FR-DSS-03 | The system shall retrieve **similar past cases** and their outcomes. | S | Semantic similarity returns ranked comparable cases + disposition. |
| FR-DSS-04 | The system shall recommend **potential investigative leads**. | S | Leads (entities/links/next steps) suggested with rationale & evidence. |
| FR-DSS-05 | All recommendations shall be advisory and clearly labeled as decision-support. | M | UI labels outputs "advisory"; human action required. |

---

## 8. Module: Financial Crime & Transaction Link Analysis (FIN)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-FIN-01 | The system shall detect **financial transactions linked to criminal activity**. | S | Transactions tied to flagged accounts/entities surfaced. |
| FR-FIN-02 | The system shall identify **money trails and suspicious transaction networks**. | S | Multi-hop fund-flow paths visualized between entities. |
| FR-FIN-03 | The system shall detect suspicious patterns (structuring, layering, circular transfers). | C | Rule/ML flags on known typologies with confidence. |
| FR-FIN-04 | The system shall integrate with **financial-crime investigation workflows**. | C | Findings exportable to/triggerable from case workflow. |
| FR-FIN-05 | Financial data access shall be additionally gated and logged. | M | Extra authorization + audit on all FIN queries. |

---

## 9. Module: Crime Forecasting & Early Warning (FCST)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-FCST-01 | The system shall identify **emerging crime patterns** via AI. | C | New/accelerating patterns flagged before they peak. |
| FR-FCST-02 | The system shall issue **early-warning alerts** for repeat crimes, gang activity, organized crime. | C | Alerts with trigger, area, confidence, recommended attention. |
| FR-FCST-03 | The system shall produce **predictive crime-hotspot** forecasts. | C | Forecast map for future window with precision metrics. |
| FR-FCST-04 | Forecasts shall publish accuracy/limitations and be framed as probabilistic. | M | Each forecast shows confidence + model limitations. |
| FR-FCST-05 | Alerts shall route to appropriate roles/geographies. | C | Alert reaches relevant supervisor/IO per jurisdiction. |

---

## 10. Module: Explainable AI & Transparent Analytics (XAI)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-XAI-01 | Every AI response shall be supported by **clear data references and evidence trails** (citations to source records). | M | 100% of factual claims cite source IDs; clickable. |
| FR-XAI-02 | The system shall **visualize reasoning paths and correlations** used in analysis. | S | Reasoning steps / data lineage shown on demand. |
| FR-XAI-03 | The system shall record the data sources, filters, and model version behind each answer. | M | Answer metadata captures provenance for audit. |
| FR-XAI-04 | The system shall comply with **law-enforcement accountability** requirements (defensible, reproducible outputs). | M | Same query + data + version → reproducible result + trail. |
| FR-XAI-05 | The system shall surface confidence levels and known limitations per analytical output. | M | Confidence + caveats displayed. |

---

## 11. Module: Secure Role-Based Access & Governance (SEC)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-SEC-01 | The system shall enforce **RBAC** for investigators, analysts, supervisors, policymakers, admins. | M | Each role sees only permitted data/features; tested per role. |
| FR-SEC-02 | The system shall enforce **data scoping** (jurisdiction/case need-to-know). | M | Users access only authorized jurisdictions/cases. |
| FR-SEC-03 | The system shall maintain **immutable audit logs** of every query, access, and export. | M | Tamper-evident log: who, what, when, result; queryable by admin. |
| FR-SEC-04 | The system shall apply **field-level masking** of sensitive PII based on role. | M | Victim identity etc. masked for non-authorized roles. |
| FR-SEC-05 | The system shall authenticate users via SSO/MFA. | M | MFA enforced; integrates with police directory/IdP. |
| FR-SEC-06 | The system shall comply with **DPDP Act 2023, IT Act**, and data-protection governance. | M | DPIA completed; consent/lawful-basis & retention policies enforced. |
| FR-SEC-07 | The system shall encrypt data **at rest and in transit**. | M | TLS 1.2+/AES-256 verified. |
| FR-SEC-08 | The system shall keep sensitive data within **state-controlled infrastructure** (data residency). | M | No PII egress to public cloud; deployment topology verified. |

---

## 12. Module: Data Management & Integration (DATA)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-DATA-01 | The system shall ingest from the **state crime database (CCTNS-aligned)** via secure connector/read-replica. | M | Scheduled/CDC ingestion verified; no write-back to SoR. |
| FR-DATA-02 | The system shall perform **entity resolution / de-duplication** across records. | M | Same person across FIRs unified with confidence; review for low confidence. |
| FR-DATA-03 | The system shall run **data-quality & validation** pipelines (completeness, format, anomalies). | M | DQ report per load; bad records quarantined. |
| FR-DATA-04 | The system shall build a **knowledge graph** of entities and relationships. | M | Graph populated; queryable by graph + NL. |
| FR-DATA-05 | The system shall maintain **vector embeddings** for semantic/similar-case search. | S | Embeddings indexed; semantic search returns relevant cases. |
| FR-DATA-06 | The system shall optionally integrate **external socio-economic datasets**. | C | Census/economic data joined at area level. |
| FR-DATA-07 | The system shall preserve **data lineage** from source to answer. | M | Lineage traceable for every analytic output. |

---

## 13. Non-Functional Requirements (NFR)

| ID | Category | Requirement | Target |
|---|---|---|---|
| NFR-01 | Performance | Retrieval query latency (p95) | < 5 s |
| NFR-02 | Performance | Analytical query latency (p95) | < 30 s |
| NFR-03 | Scalability | Concurrent users | ≥ 500 (scalable to 5,000) |
| NFR-04 | Scalability | Records supported | 10s of millions of FIRs/entities |
| NFR-05 | Availability | Uptime | ≥ 99.5% |
| NFR-06 | Accuracy | NL intent accuracy | ≥ 92% (EN), ≥ 85% (KN) |
| NFR-07 | Accuracy | Factual grounding | 0% fabricated facts (abstain instead) |
| NFR-08 | Security | Encryption | TLS 1.2+ in transit, AES-256 at rest |
| NFR-09 | Security | Auth | SSO + MFA, session timeout |
| NFR-10 | Privacy | Compliance | DPDP 2023, IT Act, data residency |
| NFR-11 | Auditability | Log retention | Immutable, ≥ statutory retention period |
| NFR-12 | Usability | Accessibility | Voice-first, vernacular, low-literacy friendly |
| NFR-13 | Maintainability | Model/version governance | Versioned models, reproducible outputs |
| NFR-14 | Portability | Deployment | On-prem / state sovereign cloud capable |
| NFR-15 | Explainability | Evidence coverage | 100% answers carry provenance |
| NFR-16 | Reliability | Data freshness | Configurable (near-real-time to daily) |

---

## 14. Traceability Matrix (PRD Pillar → FRD Modules)

| PRD Pillar | FRD Module(s) |
|---|---|
| P1 Conversational Interface | CONV |
| P2 Network & Relationship | NET, DATA |
| P3 Pattern & Trend | PAT, DATA |
| P4 Sociological Insights | SOC, DATA |
| P5 Offender Profiling | PROF |
| P6 Decision Support | DSS |
| P7 Financial Crime | FIN |
| P8 Forecasting & Early Warning | FCST |
| P9 Explainable AI | XAI |
| P10 Secure RBAC & Governance | SEC, DATA |

---

## 15. Functional Flow (End-to-End Query)

1. User authenticates (SSO+MFA) → role/scope resolved.
2. User submits NL query (voice/text, EN/KN).
3. ASR (if voice) → text; language detection → translation/normalization.
4. NLU extracts intent + entities; conversation context merged.
5. Query router selects engine(s): retrieval / graph / analytics / forecast.
6. RBAC + data-scope filter applied to query.
7. Engines execute against KG / relational store / vector index / analytics.
8. RAG composes grounded answer with citations; XAI attaches evidence trail.
9. Response rendered (text + chart/graph/map) in query language; optional TTS.
10. Audit log records query, access, result, provenance.
11. User optionally exports conversation → local PDF.

---
*End of FRD.*
