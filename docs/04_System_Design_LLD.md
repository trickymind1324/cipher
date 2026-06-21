# Low-Level Design (LLD)
## Intelligent Conversational AI & Crime Analytics Platform (CIPHER)

| Field | Value |
|---|---|
| **Document** | Low-Level Design (LLD) |
| **Product** | CIPHER |
| **Version** | 1.0 |
| **Date** | 21 June 2026 |
| **Companion docs** | PRD v1.0, FRD v1.0, HLD v1.0 |
| **Classification** | Confidential — Law Enforcement Use Only |

---

## 1. Purpose

This LLD specifies module-level design: data models, service interfaces (APIs), algorithms, the conversational/RAG pipeline, the network and analytics internals, sequence flows, and error handling. It is the build blueprint that realizes the HLD.

---

## 2. Data Model

### 2.1 Core Relational Schema (PostgreSQL — simplified)

```sql
-- Persons (unified after entity resolution)
person(
  person_id PK, full_name, aliases[], gender, dob, age_band,
  address, city, district, taluk, photo_ref,
  socio_econ_band, occupation, created_at, updated_at)

-- FIR / Case
fir(
  fir_id PK, fir_number, police_station_id FK, district, taluk,
  crime_type, ipc_sections[], registered_date, occurrence_date,
  occurrence_geo GEOGRAPHY(Point), modus_operandi, status,
  io_officer_id FK, summary_text, created_at)

-- Roles linking persons to FIRs
fir_party(
  id PK, fir_id FK, person_id FK,
  role ENUM('accused','victim','witness','complainant'),
  arrest_date, bail_status)

-- Criminal history
criminal_history(
  id PK, person_id FK, fir_id FK, conviction_status,
  sentence, court, disposition_date)

-- Assets / linking attributes
attribute(
  id PK, person_id FK, type ENUM('phone','vehicle','bank_account',
  'email','device_imei'), value, verified BOOLEAN)

-- Financial transactions (sanctioned)
transaction(
  txn_id PK, from_account, to_account, amount, currency,
  txn_time, channel, flagged BOOLEAN, linked_fir_id FK NULL)

-- Police station / geography
police_station(station_id PK, name, district, taluk, geo GEOGRAPHY)

-- External socio-economic (area level)
socio_economic(area_id PK, district, taluk, ward,
  population, unemployment_rate, literacy_rate,
  migration_index, economic_stress_index, urbanization_level)
```

### 2.2 Knowledge Graph Model (Neo4j)

```
NODES:
 (:Person {person_id, name, risk_score})
 (:FIR {fir_id, crime_type, date, status})
 (:Location {area_id, name, lat, lon})
 (:Account {account_no, bank})
 (:Vehicle {reg_no})   (:Phone {number})

RELATIONSHIPS:
 (Person)-[:ACCUSED_IN]->(FIR)
 (Person)-[:VICTIM_IN]->(FIR)
 (Person)-[:CO_ACCUSED_WITH {count}]->(Person)
 (FIR)-[:OCCURRED_AT]->(Location)
 (Person)-[:OWNS]->(Account|Vehicle|Phone)
 (Account)-[:TRANSFERRED {amount,date}]->(Account)
 (Person)-[:SHARES_ATTRIBUTE {type}]->(Person)
```

### 2.3 Vector Index
- **Collections:** `fir_embeddings` (case narrative), `mo_embeddings` (modus operandi), `person_profile_embeddings`.
- **Embedding model:** multilingual/Indic sentence encoder (EN+KN). Dimension e.g. 768.
- **Distance:** cosine. **Index:** HNSW. Metadata filters: district, crime_type, date range (for scoped semantic search).

### 2.4 Audit Schema (append-only)
```
audit_log(
  log_id PK, user_id, role, timestamp, action_type,
  query_text, resolved_intent, entities_json, engines_used[],
  records_accessed[], response_hash, model_version,
  data_scope, client_ip, export_flag)   -- WORM, immutable
```

---

## 3. Conversational / RAG Pipeline (Core Algorithm)

### 3.1 Pipeline Stages
```
1. Input Capture        : {text | audio}, lang_hint, session_id, user_ctx(role,scope)
2. Speech-to-Text       : if audio → ASR(EN/KN) → transcript
3. Language Processing   : detect_lang → (translate KN→EN internal canonical) + keep original
4. NLU                   : intent ∈ {RETRIEVE, NETWORK, TREND, PROFILE, SUMMARY,
                            SIMILAR_CASE, FINANCIAL, FORECAST, SOCIO}; entities via NER
5. Context Resolution    : merge session memory; resolve coref ("them","that case")
6. Query Planning        : intent → engine plan (single or multi-step DAG)
7. Authorization         : inject RBAC + data-scope predicates into every engine call
8. Execution             : call engine(s) → structured results + evidence refs
9. Grounded Generation   : RAG → LLM composes answer ONLY from retrieved context
10. Guardrails           : verify each claim has citation; else abstain
11. XAI Assembly         : attach citations, confidence, reasoning path, lineage
12. Response Rendering    : translate answer→query lang; build viz payload; TTS optional
13. Audit                : persist full provenance bundle (async)
```

### 3.2 Grounding / Anti-Hallucination Rule
- The LLM prompt includes ONLY the retrieved records as context, with explicit instruction: *"Answer strictly from CONTEXT. If insufficient, reply 'No supporting records found.' Every factual statement must reference a record_id."*
- Post-generation validator parses claims → checks each maps to a `record_id` in context. Unsupported claims are stripped or trigger abstain.

### 3.3 Context Manager
- Per-session ring buffer of last *N* turns: `{query, intent, entities, result_refs}`.
- Coreference resolution maps anaphora to last-mentioned compatible entity.
- Entity carry-over: filters (district/crime_type/date) persist until overridden.
- Explicit "reset/start over" clears buffer.

### 3.4 Intent → Engine Routing Table
| Intent | Primary Engine | Secondary |
|---|---|---|
| RETRIEVE | Retrieval (SQL/search) | — |
| NETWORK | Graph Analytics | Retrieval |
| TREND | Pattern/Trend | Geospatial |
| SOCIO | Sociological | Pattern |
| PROFILE | Profiling & Risk | Retrieval, Graph |
| SUMMARY | Decision Support (LLM summarize) | Retrieval |
| SIMILAR_CASE | Vector search | Decision Support |
| FINANCIAL | Financial Link | Graph |
| FORECAST | Forecasting | Pattern |

---

## 4. Service API Specifications (Internal REST/gRPC)

### 4.1 Conversation Service
```
POST /api/v1/conversation/query
Body: { session_id, input_type:"text|voice", content|audio_ref,
        lang:"auto|en|kn", user_token }
Resp: { answer_text, answer_lang, visualizations[], citations[],
        confidence, reasoning_path[], audio_ref?, session_id }

POST /api/v1/conversation/export-pdf
Body: { session_id }
Resp: { pdf_local_path, checksum }   // renders Q&A + citations + watermark
```

### 4.2 Retrieval Service
```
POST /api/v1/retrieve
Body: { entity_types[], filters{district,crime_type,date_range,...},
        scope, semantic_query? , limit, offset }
Resp: { records[], total, evidence_refs[] }
```

### 4.3 Network Analytics Service
```
POST /api/v1/network/graph
Body: { center_entity_id?, filters, depth, scope }
Resp: { nodes[], edges[], communities[], centrality{}, evidence_refs[] }

POST /api/v1/network/detect-groups
Resp: { groups:[{members[], cohesion, type}], evidence_refs[] }
```

### 4.4 Pattern/Trend Service
```
POST /api/v1/trends
Body: { dimensions:["time","geo","crime_type","mo"], filters, granularity }
Resp: { series[], hotspots[], seasonality{}, summary_text, evidence_refs[] }
```

### 4.5 Profiling & Risk Service
```
POST /api/v1/profile/{person_id}
Resp: { behavioral_profile{}, repeat_offender:bool, risk_score:0-100,
        factors:[{name,weight,evidence_ref}], history[] }
```

### 4.6 Decision Support Service
```
POST /api/v1/case/{fir_id}/summary   → { summary, timeline[], parties[], citations[] }
POST /api/v1/case/{fir_id}/similar   → { similar_cases:[{fir_id,score,outcome}] }
POST /api/v1/case/{fir_id}/leads     → { leads:[{lead,rationale,evidence_ref}] }
```

### 4.7 Financial Link Service
```
POST /api/v1/financial/trace
Body: { seed_account|person_id, max_hops, scope }
Resp: { fund_flow_paths[], suspicious_patterns[], graph_payload, evidence_refs[] }
```

### 4.8 Forecasting Service
```
POST /api/v1/forecast/hotspots
Body: { region, horizon, crime_type }
Resp: { predicted_hotspots[], confidence, model_version, limitations }
GET  /api/v1/forecast/alerts?role=&jurisdiction=  → { alerts[] }
```

All responses include `evidence_refs[]`, `confidence`, `model_version` for XAI/audit. All requests pass through the gateway which injects `user_token` → resolves role + data scope.

---

## 5. Key Algorithms (Module Internals)

### 5.1 Entity Resolution (Ingestion)
- **Blocking** on normalized name + soundex + DOB/age band to reduce comparisons.
- **Pairwise scoring**: weighted similarity over name (Jaro-Winkler), DOB, address, shared attributes (phone/vehicle).
- **Decision**: score ≥ θ_high → auto-merge; θ_low ≤ score < θ_high → human review queue; below → distinct.
- Output: unified `person_id`, alias set, merge provenance retained.

### 5.2 Network / Organized-Crime Detection
- Build graph from co-accused, shared attributes, transaction edges.
- **Community detection**: Louvain/Leiden → candidate organized groups; cohesion = modularity contribution.
- **Centrality**: degree + betweenness → key players.
- **Repeat-offender network**: `CO_ACCUSED_WITH.count ≥ k` edges form persistent cliques.
- Cypher example:
```cypher
MATCH (p:Person)-[r:CO_ACCUSED_WITH]-(q:Person)
WHERE r.count >= 3
RETURN p,q,r;
```

### 5.3 Hotspot Detection
- Aggregate incidents to grid/ward; compute **Getis-Ord Gi\*** / KDE for statistically significant clusters.
- Emerging cluster = significant positive change vs. trailing baseline window.

### 5.4 Offender Risk Scoring (Explainable)
- **Features (legally permissible only):** prior conviction count, recency, crime severity, escalation trend, co-offending breadth, MO consistency, pending cases. **Excluded:** caste, religion, and other protected attributes.
- **Model:** gradient-boosted trees with **SHAP** for per-feature attribution → human-readable factors.
- **Output:** score 0–100 + ranked factors + source `evidence_ref` per factor. Reproducible (versioned model + features).

### 5.5 Similar-Case Retrieval
- Embed query/case narrative → cosine top-k over `fir_embeddings` with metadata scope filter → re-rank by recency/jurisdiction → return with dispositions.

### 5.6 Financial Money-Trail
- Treat accounts/persons as graph; BFS/DFS over `TRANSFERRED` edges up to `max_hops`.
- Typology rules: structuring (many sub-threshold), layering (rapid multi-hop), circular flow (cycle detection). Flag with confidence + path evidence.

### 5.7 Forecasting
- Spatio-temporal model (e.g., gradient boosting / Prophet / ST-features) per region×crime_type.
- Output probabilistic hotspot map + confidence; publish accuracy backtest + limitations. Advisory only.

---

## 6. Sequence Diagrams (Textual)

### 6.1 Voice Kannada Query → Grounded Answer
```
User →(speak KN)→ UI →(audio)→ Gateway →(authN/Z, scope)→ Orchestrator
Orchestrator → SpeechSvc: ASR(KN) → transcript
Orchestrator → LangSvc: detect=kn, canonical=en
Orchestrator → NLU: intent=RETRIEVE, entities={city:Hubballi, crime:robbery, period:this_month}
Orchestrator → ContextMgr: store turn
Orchestrator → Router: plan=[Retrieval]
Orchestrator → Retrieval(+scope): SQL+geo → records[]
Orchestrator → RAG/LLM: ground answer (cite fir_ids)
Orchestrator → Guardrail: validate citations OK
Orchestrator → XAI: bundle evidence+confidence
Orchestrator → LangSvc: translate answer en→kn
Orchestrator → SpeechSvc: TTS(kn) (optional)
Orchestrator →(answer+viz+audio)→ UI
Orchestrator →(async)→ AuditStore
```

### 6.2 Network Graph Request
```
User: "show the network around accused P-1042"
NLU intent=NETWORK, entity=person_id:P-1042
Router → NetworkSvc.graph(center=P-1042, depth=2, scope)
NetworkSvc → Neo4j: traverse + Louvain + centrality
→ {nodes,edges,communities,centrality, evidence_refs}
XAI attaches source FIR links per edge → UI renders interactive graph
```

---

## 7. Security & RBAC Design (LLD)

### 7.1 Roles & Permission Matrix (illustrative)
| Capability | Investigator | Analyst | Supervisor | Policymaker | Admin |
|---|---|---|---|---|---|
| Record retrieval (own jurisdiction) | ✓ | ✓ | ✓ | aggregate | — |
| Cross-jurisdiction | on approval | ✓ | ✓ | aggregate | — |
| Network analysis | ✓ | ✓ | ✓ | aggregate | — |
| Profiling / risk score | ✓ | ✓ | ✓ | — | — |
| Financial link analysis | on approval | ✓ | ✓ | — | — |
| Forecasting/alerts | view | ✓ | ✓ | ✓ | — |
| Socio-demographic (aggregate) | ✓ | ✓ | ✓ | ✓ | — |
| Individual PII (unmasked) | ✓(scope) | masked | ✓ | masked | — |
| Audit search / RBAC mgmt | — | — | view | — | ✓ |

### 7.2 Enforcement
- **AuthN:** SSO+MFA via state IdP (OIDC); short-lived JWT.
- **AuthZ:** Policy engine (OPA) evaluates role + jurisdiction + case need-to-know → injects row/field predicates into every datastore query (defense at query layer, not just UI).
- **Masking:** Field-level masking applied in response composer per role.
- **Audit:** Gateway interceptor + service hooks write immutable `audit_log`; response_hash binds answer to provenance.
- **Secrets:** Vault; **encryption:** TLS1.2+ transit, AES-256 at rest.

---

## 8. PDF Export (FR-CONV-07) Design
- On request, fetch session turns + their `citations[]` from session/audit store.
- Render via server-side template (e.g., WeasyPrint/Puppeteer) → includes: header (case/officer/role, timestamp), each Q&A, inline citations (fir_id links), confidence notes, footer watermark "Advisory — Law Enforcement Use Only", checksum.
- Save to configured **local path**; record export event in audit log.

---

## 9. Error Handling & Degradation

| Condition | Behavior |
|---|---|
| No supporting records | Return "No supporting records found" (abstain), never fabricate |
| ASR low confidence | Ask user to repeat / show transcript for confirmation |
| Ambiguous entity | Disambiguation prompt with candidate list |
| Engine timeout/down | Degrade gracefully (e.g., retrieval works even if forecasting offline); circuit breaker |
| Unauthorized data | Deny with reason; log attempt |
| Low-confidence analytic | Return with explicit low-confidence + caveat |
| Translation failure | Fall back to English with notice |

---

## 10. Observability & MLOps (LLD)
- **Logging:** structured JSON logs, correlation IDs across services.
- **Metrics:** query latency, intent accuracy (sampled), abstain rate, engine error rates, model drift.
- **Tracing:** OpenTelemetry spans per pipeline stage.
- **MLOps:** MLflow registry (versioned NLU/risk/forecast models), Feast features, scheduled retraining + bias-audit gate before promotion; canary deploys.

---

## 11. Data Lifecycle & Retention
- Ingestion: CDC/scheduled; non-prod uses synthetic data only.
- Retention: per DPDP + statutory norms; audit logs WORM-retained ≥ mandated period.
- Right-to-correction handled at SoR; CIPHER re-syncs (no independent mutation of record-of-truth).

---

## 12. Build Sequence (for Prototype → MVP)
1. Data model + ingest sample CCTNS-aligned dataset (+ synthetic).
2. Retrieval + NLU (EN) + RAG grounding + citations.
3. Kannada ASR/translation + voice I/O.
4. Knowledge graph + network visualization.
5. Pattern/trend + hotspot map.
6. RBAC + audit + PDF export.
7. Profiling/risk + decision support.
8. Financial link + forecasting (later phase).

---
*End of LLD.*
