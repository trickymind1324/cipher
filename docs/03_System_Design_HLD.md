# High-Level Design (HLD)
## Intelligent Conversational AI & Crime Analytics Platform (CIPHER)

| Field | Value |
|---|---|
| **Document** | High-Level Design (HLD) |
| **Product** | CIPHER |
| **Version** | 1.0 |
| **Date** | 21 June 2026 |
| **Companion docs** | PRD v1.0, FRD v1.0, LLD v1.0 |
| **Classification** | Confidential — Law Enforcement Use Only |

---

## 1. Purpose

This HLD describes the system architecture, major components, data flows, technology choices, and cross-cutting concerns for CIPHER at an architectural level. Implementation-level detail is in the LLD.

---

## 2. Architectural Principles

1. **Grounded-by-design** — every answer is retrieval-augmented; the LLM never asserts ungrounded facts (anti-hallucination).
2. **Data sovereignty first** — sensitive data and inference stay on state-controlled infrastructure.
3. **Explainable & auditable** — provenance and reasoning captured for every output.
4. **Least-privilege & need-to-know** — RBAC + data scoping enforced at the query layer, not just UI.
5. **Human-in-the-loop** — outputs are advisory; no autonomous enforcement actions.
6. **Modular & API-first** — loosely-coupled microservices; capabilities exposed via internal APIs.
7. **Polyglot persistence** — relational + graph + vector + search + geospatial, each for its strength.
8. **Augment, don't replace** — read-only/CDC from CCTNS; CIPHER never mutates the system of record.

---

## 3. Logical Architecture (Layered)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PRESENTATION / CLIENT LAYER                                              │
│  Web App (React)  •  Conversational UI (text+voice)  •  Dashboards/Maps   │
│  Graph Visualizer •  PDF Export  •  Admin Console                         │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │  HTTPS / WSS
┌───────────────────────────▼─────────────────────────────────────────────┐
│  API GATEWAY & SECURITY LAYER                                            │
│  AuthN (SSO+MFA) • AuthZ (RBAC + data scope) • Rate limit • Audit hook    │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────────┐
│  CONVERSATIONAL AI / ORCHESTRATION LAYER                                 │
│  ASR/TTS • Lang Detect/Translate • NLU (intent+NER) • Dialogue/Context    │
│  Mgr • Query Router/Planner • RAG Orchestrator (LLM) • XAI/Evidence Comp   │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────────┐
│  ANALYTICS & INTELLIGENCE SERVICES LAYER (microservices)                 │
│  Retrieval • Network/Graph Analytics • Pattern/Trend • Sociological •      │
│  Offender Profiling/Risk • Decision Support • Financial Link • Forecasting │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────────┐
│  DATA PLATFORM LAYER                                                     │
│  Relational(PG) • Knowledge Graph(Neo4j) • Vector DB • Search(OpenSearch) │
│  • Geospatial(PostGIS) • Object store • Feature store • Audit store        │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────────┐
│  DATA INGESTION & INTEGRATION LAYER                                      │
│  CCTNS Connector(CDC) • Financial-data connector • Socio-econ datasets •   │
│  ETL/ELT • Entity Resolution • Data Quality • Embedding & Graph Builders   │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────────┐
│  SOURCE SYSTEMS                                                          │
│  State Crime DB (CCTNS) • Financial/Bank data (sanctioned) • Census/Econ   │
└─────────────────────────────────────────────────────────────────────────┘
```

Cross-cutting (all layers): **Security & IAM • Audit & Governance • Observability (logs/metrics/traces) • MLOps/Model Registry • Configuration & Secrets.**

---

## 4. Component Catalogue

### 4.1 Presentation Layer
| Component | Responsibility |
|---|---|
| Conversational UI | Multi-turn chat, voice mic capture/playback, language toggle (EN/KN) |
| Analytics Dashboards | Trend charts, hotspot maps, KPIs |
| Network Graph Visualizer | Interactive node-edge exploration, filters, drill-down |
| PDF Export module | Render conversation + citations to local PDF |
| Admin Console | RBAC management, audit search, model/config governance |

### 4.2 API Gateway & Security
| Component | Responsibility |
|---|---|
| API Gateway | Routing, throttling, request validation |
| Identity Provider integration | SSO + MFA against police directory |
| Authorization service | RBAC roles + attribute/jurisdiction-based data scoping |
| Audit interceptor | Captures every request/response metadata immutably |

### 4.3 Conversational AI / Orchestration
| Component | Responsibility |
|---|---|
| Speech service | ASR (EN/KN) + TTS |
| Language service | Detection, translation, transliteration, domain glossary |
| NLU engine | Intent classification + NER (police-domain entities) |
| Dialogue/Context Manager | Session memory, coreference, follow-up resolution |
| Query Router / Planner | Maps intent to one or more downstream engines; multi-step plans |
| RAG Orchestrator | Retrieves context, prompts LLM, enforces grounding & citations |
| XAI / Evidence Composer | Assembles evidence trail, provenance, confidence, reasoning path |
| Guardrails | Output validation, abstain-on-no-evidence, PII/policy filters |

### 4.4 Analytics & Intelligence Services
| Service | Maps to FRD | Core Function |
|---|---|---|
| Retrieval Service | CONV, DATA | Structured + semantic record retrieval |
| Network Analytics | NET | Link discovery, community detection, centrality |
| Pattern/Trend Service | PAT | Time/geo/type/MO trends, hotspots, seasonality |
| Sociological Service | SOC | Demographic & socio-economic correlation |
| Profiling & Risk Service | PROF | Repeat-offender ID, behavioral profiling, risk scoring |
| Decision Support Service | DSS | Summaries, timelines, similar cases, leads |
| Financial Link Service | FIN | Money-trail & suspicious-network detection |
| Forecasting Service | FCST | Emerging patterns, predictive hotspots, alerts |

### 4.5 Data Platform (Polyglot Persistence)
| Store | Technology (indicative) | Holds |
|---|---|---|
| Relational | PostgreSQL | Normalized FIR/accused/victim/case records |
| Knowledge Graph | Neo4j / JanusGraph | Entities & relationships for network analysis |
| Vector DB | pgvector / Milvus / Qdrant | Embeddings for semantic & similar-case search |
| Search | OpenSearch/Elasticsearch | Full-text & faceted search |
| Geospatial | PostGIS | Locations, hotspots, mapping |
| Object Store | MinIO / state cloud storage | PDFs, exports, model artifacts |
| Feature Store | Feast (or equivalent) | ML features for profiling/forecasting |
| Audit Store | Append-only / WORM | Immutable audit logs |

### 4.6 Ingestion & Integration
| Component | Responsibility |
|---|---|
| CCTNS Connector | Secure read-replica / CDC ingestion (no write-back) |
| ETL/ELT pipeline | Cleanse, normalize, transform |
| Entity Resolution | De-duplicate & unify persons/entities across records |
| Data Quality engine | Validation, anomaly detection, quarantine |
| Embedding Builder | Generate & index vector embeddings |
| Graph Builder | Construct/refresh knowledge graph |
| External Data connectors | Financial (sanctioned), census/socio-economic |

---

## 5. Key Data Flows

### 5.1 Conversational Retrieval (synchronous)
```
User → UI → API GW (authN/Z) → Orchestrator
  → [ASR if voice] → LangDetect/Translate → NLU(intent+entities)
  → ContextManager(merge history) → QueryRouter
  → RBAC/scope filter → Retrieval/Analytics engine(s) → Data Platform
  → RAG(LLM grounds answer + citations) → XAI(evidence trail)
  → [TTS optional] → UI(render text+viz, query language)
  → Audit log (async)
```

### 5.2 Batch Intelligence (asynchronous)
```
Source DBs → Ingestion(CDC) → DQ + Entity Resolution → Data Platform
  → Graph Builder + Embedding Builder
  → Analytics jobs (network/pattern/profiling/forecast) → precomputed insights
  → Alert engine → role/jurisdiction routing → notifications
```

### 5.3 Explainability Flow
Every engine returns `(result, evidence[], confidence, lineage, model_version)`. The XAI composer binds these to the answer so the UI can render citations, reasoning path, and confidence; the audit store persists the full provenance bundle.

---

## 6. Technology Stack (Indicative)

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + TypeScript, D3/Cytoscape (graph), Mapbox/Leaflet (maps), Recharts | Rich interactive viz |
| Voice | Indic ASR/TTS (e.g., AI4Bharat IndicConformer/Bhashini), Whisper (EN) | Strong Kannada support |
| Translation/NLP | IndicTrans2, Indic-BERT/MuRIL fine-tuned | Kannada-English domain NLU |
| LLM | On-prem/sovereign-deployable LLM (open-weight) + RAG; abstraction layer to swap models | Data residency, no PII egress |
| Orchestration | LangGraph / custom orchestrator, FastAPI services | Multi-step grounded reasoning |
| Backend | Python (ML/AI services), Node/Java (API) | Ecosystem fit |
| Datastores | PostgreSQL+PostGIS+pgvector, Neo4j, OpenSearch, MinIO | Polyglot persistence |
| Messaging/Stream | Kafka / Redis Streams | CDC, async analytics, alerts |
| Infra | Kubernetes on state cloud (MeghRaj/SDC) / on-prem | Sovereign, scalable |
| Security | Keycloak/state IdP (SSO+MFA), Vault (secrets), OPA (policy) | Standards-based |
| Observability | Prometheus, Grafana, OpenTelemetry, ELK | Full visibility |
| MLOps | MLflow model registry, Feast feature store, CI/CD | Versioned, reproducible models |

> **Note:** All LLM/AI inference for sensitive data uses on-prem / sovereign-cloud deployments of open-weight models behind a provider-abstraction layer, so the platform is not dependent on any external API for PII processing.

---

## 7. Deployment Architecture

- **Topology:** Containerized microservices on Kubernetes, hosted on Karnataka State Data Centre / sovereign cloud (MeghRaj). Sensitive data never leaves the security boundary.
- **Environments:** Dev → Staging → Production, with isolated data (synthetic in non-prod).
- **Network zones:** DMZ (gateway) → App tier → Data tier; strict east-west segmentation; no direct DB exposure.
- **High availability:** Multi-node clusters, replicated datastores, stateless services autoscaled.
- **DR/Backup:** Regular encrypted backups, defined RPO/RTO, WORM audit retention.

```
[Police Network/VPN] → [WAF/DMZ → API Gateway] → [App Tier: AI + Analytics svcs]
        → [Data Tier: PG/Neo4j/Vector/Search/Object/Audit]
        ↑ Ingestion Tier ← CCTNS replica / sanctioned external feeds
   Cross-cutting: IdP, Vault, Observability, MLOps — all within state boundary
```

---

## 8. Cross-Cutting Concerns

| Concern | Approach |
|---|---|
| **Security** | SSO+MFA, RBAC+ABAC, encryption (TLS1.2+/AES-256), secrets in Vault, network segmentation |
| **Privacy** | Field-level masking, data minimization, DPDP-compliant retention, DPIA |
| **Auditability** | Immutable WORM logs of all access/queries/exports; admin-searchable |
| **Explainability** | Mandatory citations, lineage capture, reasoning-path rendering |
| **Bias & Fairness** | Excluded protected attributes from scoring, periodic bias audits, fairness metrics |
| **Observability** | Centralized logs/metrics/traces, SLO dashboards, alerting |
| **MLOps** | Model registry, versioning, reproducibility, drift monitoring, scheduled retraining |
| **Resilience** | Graceful degradation (retrieval works even if forecasting down), circuit breakers, abstain fallback |

---

## 9. Scalability & Performance Strategy

- **Stateless services** behind load balancers; horizontal autoscaling by load.
- **Caching** of frequent queries, embeddings, and precomputed analytics.
- **Async precomputation** of heavy analytics (graphs, forecasts) so interactive queries stay fast.
- **Read replicas / sharding** for large relational/graph workloads.
- **Streaming ingestion (CDC)** to keep data fresh without bulk reloads.

---

## 10. Compliance & Governance Mapping

| Requirement | Architectural Control |
|---|---|
| DPDP Act 2023 | Data minimization, masking, consent/lawful-basis tracking, retention policy |
| Data residency | Sovereign-cloud/on-prem deployment, no PII egress |
| Accountability | Evidence trails, reproducible outputs, audit logs |
| Need-to-know | RBAC + jurisdiction/case data scoping enforced at query layer |
| Evidence integrity | Read-only from SoR; lineage preserved; tamper-evident logs |

---

## 11. Architecture Risks & Trade-offs

| Decision | Trade-off | Resolution |
|---|---|---|
| On-prem open-weight LLM vs. external API | Capability vs. sovereignty | Sovereignty wins for PII; abstraction layer allows best-available open model |
| Polyglot persistence | Operational complexity | Justified by query-type fit; managed via IaC & observability |
| Precompute vs. on-demand analytics | Freshness vs. latency | Hybrid: precompute heavy, on-demand light |
| Strict grounding (abstain) | Fewer answers vs. trust | Trust/accountability prioritized over coverage |

---
*End of HLD.*
