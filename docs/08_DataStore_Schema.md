# Catalyst Data Store — Table Schema

| Field | Value |
|---|---|
| **Document** | Data Store table spec (console click-path) |
| **Project** | `cipher-ksp` (IN data center) |
| **Source of truth** | `data/generate_seed.mjs` → `data/seed/*.csv` |

> **Why this is a manual step.** Catalyst creates Data Store tables **from the console only** — the CLI's Data Store endpoints can read tables (`getAllTables`, `getColumnDetails`) but cannot create them, and the Node SDK exposes row CRUD, not DDL. So the six tables below have to be created once by hand, after which everything else is automated.
>
> **You are not blocked on this.** The function ships with the same tables bundled as JSON and runs against them by default (`CIPHER_STORE=memory`). Create these tables whenever convenient, import the CSVs, then set `CIPHER_STORE=datastore` to flip the backend. No application code changes.

---

## 1. Create the tables

Console → **Data Store** → **New Table** → add the columns below → **Import Data** → upload the matching `data/seed/<table>.csv` (the CSV header row matches these column names exactly).

Catalyst adds `ROWID`, `CREATORID`, `CREATEDTIME`, `MODIFIEDTIME` to every table automatically — do not add them.

### `fir` — 300 rows
| Column | Type | Notes |
|---|---|---|
| `fir_id` | Text (20) | unique — the citation key |
| `fir_number` | Text (20) | |
| `station_id` | Text (20) | → `police_station.station_id` |
| `police_station` | Text (100) | denormalised for display |
| `district` | Text (50) | |
| `taluk` | Text (50) | |
| `crime_type` | Text (50) | |
| `ipc_sections` | Text (100) | `; `-separated |
| `severity` | Text (10) | low / medium / high |
| `registered_date` | Date | |
| `occurrence_date` | Date | |
| `occurrence_time` | Text (10) | |
| `lat` | Double | |
| `lon` | Double | |
| `modus_operandi` | Text (255) | |
| `status` | Text (30) | under investigation / chargesheeted / closed |
| `io_officer` | Text (100) | |
| `summary_text` | Text (255) | |

### `person` — 330 rows
| Column | Type | Notes |
|---|---|---|
| `person_id` | Text (20) | unique — the citation key |
| `full_name` | Text (100) | |
| `aliases` | Text (100) | may be empty |
| `gender` | Text (5) | |
| `dob` | Date | |
| `age_band` | Text (10) | |
| `address` | Text (255) | |
| `city` | Text (50) | |
| `district` | Text (50) | |
| `taluk` | Text (50) | |
| `socio_econ_band` | Text (20) | |
| `occupation` | Text (50) | |
| `is_offender` | Int | 0 / 1 |

### `fir_party` — 1200 rows
| Column | Type | Notes |
|---|---|---|
| `id` | Text (20) | unique |
| `fir_id` | Text (20) | → `fir.fir_id` |
| `person_id` | Text (20) | → `person.person_id` |
| `role` | Text (20) | accused / victim / witness / complainant |
| `arrest_date` | Date | may be empty |
| `bail_status` | Text (20) | may be empty |

### `attribute` — 384 rows
| Column | Type | Notes |
|---|---|---|
| `id` | Text (20) | unique |
| `person_id` | Text (20) | → `person.person_id` |
| `type` | Text (20) | phone / vehicle |
| `value` | Text (50) | **shared values across persons are the network edges — do not dedupe** |
| `verified` | Int | 0 / 1 |

### `socio_economic` — 10 rows
| Column | Type | Notes |
|---|---|---|
| `area_id` | Text (20) | unique |
| `district` | Text (50) | |
| `taluk` | Text (50) | |
| `ward` | Text (30) | |
| `population` | Int | |
| `unemployment_rate` | Double | |
| `literacy_rate` | Double | |
| `migration_index` | Double | |
| `economic_stress_index` | Double | |
| `urbanization_level` | Text (20) | urban / semi-urban / rural |

### `police_station` — 10 rows
| Column | Type | Notes |
|---|---|---|
| `station_id` | Text (20) | unique |
| `name` | Text (100) | |
| `district` | Text (50) | |
| `taluk` | Text (50) | |
| `lat` | Double | |
| `lon` | Double | |

---

## 2. Flip the backend

Once the tables are populated, set the function's environment variable in the console
(**Functions → api → Configuration → Environment Variables**):

```
CIPHER_STORE=datastore
```

Verify with `GET /server/api/health` — the `store` field should read `datastore` instead of `memory`.

---

## 3. What is *not* in the Data Store

Per-FIR narratives (`data/seed/narratives/FIR-*.txt`, 300 docs) are **not** Data Store rows. They go to the **QuickML RAG Knowledge Base** (`cipher-fir-kb`), one doc per FIR, so a RAG citation resolves to exactly one `fir_id`.

The split follows the LLD's intent-routing table: structured questions (*"list the accused in Yelahanka"*) are answered from Data Store rows; narrative/semantic questions (*"find cases with a similar modus operandi"*) are answered from the RAG KB. Both paths return record IDs, which is what the evidence trail cites.
