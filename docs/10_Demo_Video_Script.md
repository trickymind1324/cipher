# CIPHER — 3-Minute Demo Video Script

**Recording setup.** Deployed app in a clean browser window (light theme, INVESTIGATOR role), 1080p or better, cursor visible. Screen-record with voice-over; keep each beat inside its time box. The LLM composes some answers in 5–20 s — record those waits and trim them in the edit (leave ~1 s of the "Retrieving records…" state so the pacing reads honestly).

URL: `https://cipher-ksp-60075928027.development.catalystserverless.in/app/index.html`

---

### 0:00 – 0:20 — Problem (over the home screen)

> "Karnataka's crime records hold answers investigators can't reach: repeat offenders across stations, gangs connected by a shared phone, hotspots forming this month. Dashboards can't answer questions, and generic AI chatbots make things up. CIPHER is a conversational crime-intelligence platform where every answer is retrieved from records, verified, and cited — or explicitly refused. It runs entirely on Zoho Catalyst."

*Action: home screen visible with suggestion chips; briefly point at the role bar and "GLM 4.7 Flash" pill.*

### 0:20 – 0:55 — Grounded Q&A + trends + hotspot

*Type:* `Is chain snatching rising in Bengaluru North?`

> "I ask in plain English. CIPHER parses the intent with auditable rules, aggregates from the record store — never from the language model — and GLM 4.7 Flash phrases the answer from those records only. It found a 275% rise. The chart and hotspot map render from the same payload the answer quoted — the text and the picture can't disagree. Yelahanka is the hotspot, and every marker and every source record here is clickable."

*Action: hover the surge months on the chart, then the red Yelahanka circle on the map; point at the provenance line ("Composed by GLM 4.7 Flash from retrieved records only · 29 records retrieved").*

### 0:55 – 1:20 — Kannada, natively

*Type:* `ಈ ವರ್ಷ ಯಲಹಂಕದಲ್ಲಿ ಸರಗಳ್ಳತನ ಪ್ರಕರಣಗಳನ್ನು ತೋರಿಸಿ` *(paste from a note)*

> "The same question works in Kannada. A deterministic glossary maps Kannada crime terminology onto the database taxonomy before any model sees the text — so ಸರಗಳ್ಳತನ retrieves chain-snatching records, and the answer comes back in Kannada with the same verifiable citations."

*Action: click one 18-digit citation chip — the full case record opens in the evidence panel (sections, gravity, IO, court, parties). Close it.*

### 1:20 – 1:55 — Criminal network: the invisible link

*Type:* `Show the network around P-0067`

> "Now the network. Solid edges are co-accused — people charged together; that's already in the case file. The dashed edges are the leads a file can't show: two people who share a phone number or a getaway vehicle but were never charged together. CIPHER names that lead explicitly — and every edge carries the records it was derived from."

*Action: point at the LEAD banner (shared phone, never charged together); click one dashed edge to show the identifier; click a co-accused edge to show its source cases.*

### 1:55 – 2:20 — The guardrail: refusing beats guessing

*Type:* `Show narcotics cases in Kalaburagi`

> "This dataset has no narcotics cases in Kalaburagi — so watch what the system does: it refuses, and says why. No records, no answer. Behind the scenes a second guardrail checks every id the model cites against the records actually retrieved — a fabricated citation gets the whole answer discarded and rebuilt deterministically. Every turn is also written to an append-only audit trail."

*Action: the abstain answer appears in amber; point at "Abstained — no records matched" provenance.*

### 2:20 – 2:45 — Similarity search + PDF export

*Type:* `Find cases with a similar modus operandi to chain snatching near a bus stop`

> "For narrative questions, a RAG knowledge base over the FIR narratives shortlists similar cases — but it's only a retriever: its ids are re-read from the record store, so it can suggest, never assert. And the whole conversation exports to a watermarked PDF, saved locally, citations included."

*Action: click **Export PDF**, show the downloaded file for a beat (header, watermark, citations).*

### 2:45 – 3:00 — Close (over the architecture slide or the app)

> "Synthetic CCTNS-shaped data today; the schema already mirrors the official Police FIR ER diagram, so real ingestion is an ETL exercise, not a redesign. Grounded, bilingual, auditable, and live on Zoho Catalyst — this is CIPHER."

---

**Fallback notes.**
- If an LLM answer takes too long on camera, the system falls back to a records-composed answer and says so in the provenance line — that is demonstrable honesty, not a failure; narrate it as such if it happens.
- Keep `docs/09_Benchmark_Report.md` open in a tab in case you want a one-beat flash of the numbers.
- All queries above are also in the app's suggestion chips except the similarity one.
