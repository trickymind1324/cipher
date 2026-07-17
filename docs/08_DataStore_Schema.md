# Catalyst Data Store — Table Schema (v2, aligned to the official ER diagram)

| Field | Value |
|---|---|
| **Document** | Data Store table spec (console click-path) |
| **Project** | `cipher-ksp` (IN data center) |
| **Source of truth** | `data/generate_seed.mjs` → `data/seed/*.csv` |
| **Aligned to** | `Police_FIR_ER_Diagram.pdf` (Karnataka Police FIR System ER diagram) |

> **Why this is a manual step.** Catalyst creates Data Store tables **from the console only** — the CLI's Data Store endpoints can read tables but cannot create them, and the Node SDK exposes row CRUD, not DDL. Tables are created once by hand, after which everything else is automated.
>
> **You are not blocked on this.** The function ships with the same tables bundled as JSON and runs against them by default (`CIPHER_STORE=memory`). Create these tables whenever convenient, import the CSVs, then set `CIPHER_STORE=datastore` to flip the backend. No application code changes.
>
> **Deploy priority.** If console time is short, create **Tier 1** tables first — the API reads everything else from reference JSON bundled with the function. Tier 2/3 tables exist for schema fidelity and can be imported later without code changes.

---

## 0. Design stance

The schema is in two layers:

**Layer 1 — Transactional (official).** Mirrors the Police FIR System ER diagram **verbatim** — same table names, same column names, same key structure. This is what CCTNS-style source systems look like, so CIPHER's ingestion story is credible: what we generate synthetically is shaped exactly like what a real deployment would ingest.

**Layer 2 — Analytical (CIPHER's value-add).** The official schema has **no cross-case person identity**: `Accused`, `Victim` and `ComplainantDetails` are per-FIR rows holding just a name and age. Repeat-offender detection, criminal-network graphs and offender profiling are impossible on that shape. CIPHER adds an entity-resolution layer (`person_master` + `person_case_link`) plus network attributes and socio-economic context. On real data this layer would be produced by an entity-resolution pipeline; in the prototype the generator emits it directly.

### Deliberate deviations from the ER diagram

| Deviation | Reason |
|---|---|
| `CasteMaster`, `ReligionMaster` omitted; `ComplainantDetails.CasteID/ReligionID` not populated | PRD §9 bias stance: protected attributes are excluded from all scoring and analytics. The columns exist in the source system; CIPHER refuses to ingest them. Called out as a feature, not a gap. |
| `GenderID` kept as an inline lookup (1=M, 2=F, 3=T), no table | The ER diagram itself treats gender as "lookup value" with no master table. |
| No witness entity | The official schema records no witnesses; witness mentions live only in `BriefFacts` narrative text. |
| `Inv_OccuranceTime`, `inv_arrestsurrenderaccused` folded in | The ER's 1:1 occurrence table is folded into `CaseMaster` (its columns: `IncidentFromDate/ToDate`, `latitude`, `longitude` already appear there in the diagram); the arrest junction is unnecessary because the prototype links one accused per arrest row via `ArrestSurrender.AccusedMasterID`. |
| `Employee` trimmed to investigation-relevant columns | `BloodGroupID`, `PhysicallyChallenged` etc. add no analytical value to the prototype. |

---

## 1. Identifier formats (must match exactly)

**`CrimeNo`** — 18 digits, assigned at station level:

```
1 digit  Case Category code   (1=FIR, 3=UDR, 4=PAR, 8=Zero FIR)
4 digits District ID
4 digits Police Station / Unit ID
4 digits Year
5 digits Running serial (per station + category + year)

Example: 1 0443 0006 2026 00001  →  104430006202600001
```

**`CaseNo`** — last 9 digits of CrimeNo: `YYYY` + 5-digit serial (e.g. `202600001`).

**District IDs (synthetic but format-true):** `0443` Bengaluru North, `0450` Mysuru, `0430` Kalaburagi.

`CrimeNo` is the **FIR citation key** end-to-end: KB narrative docs carry it, the LLM cites it, the pipeline validates cited CrimeNos against retrieved records. Person citations use `person_master.person_id` (`P-XXXX`).

---

## 2. Tier 1 — Transactional core (official ER, create first)

Console → **Data Store** → **New Table** → add the columns → **Import Data** → upload `data/seed/<Table>.csv`. Catalyst auto-adds `ROWID`, `CREATORID`, `CREATEDTIME`, `MODIFIEDTIME` — do not add them.

### `CaseMaster` — ~300 rows
| Column | Type | Notes |
|---|---|---|
| `CaseMasterID` | Int | PK — unique per FIR/case |
| `CrimeNo` | Text (20) | 18-digit structured number — **citation key** |
| `CaseNo` | Text (10) | last 9 digits of CrimeNo |
| `CrimeRegisteredDate` | Date | |
| `PolicePersonID` | Int | → `Employee.EmployeeID` (registering officer) |
| `PoliceStationID` | Int | → `Unit.UnitID` |
| `CaseCategoryID` | Int | → `CaseCategory` (1=FIR, 3=UDR, 4=PAR, 8=Zero FIR) |
| `GravityOffenceID` | Int | → `GravityOffence` (Heinous / Non-Heinous) |
| `CrimeMajorHeadID` | Int | → `CrimeHead` |
| `CrimeMinorHeadID` | Int | → `CrimeSubHead` |
| `CaseStatusID` | Int | → `CaseStatusMaster` |
| `CourtID` | Int | → `Court` |
| `IncidentFromDate` | DateTime | |
| `IncidentToDate` | DateTime | |
| `InfoReceivedPSDate` | DateTime | |
| `latitude` | Double | incident GPS |
| `longitude` | Double | incident GPS |
| `BriefFacts` | Text (2000) | case narrative — also the RAG KB document body |

### `ComplainantDetails` — ~300 rows
| Column | Type | Notes |
|---|---|---|
| `ComplainantID` | Int | PK |
| `CaseMasterID` | Int | → `CaseMaster` |
| `ComplainantName` | Text (100) | |
| `AgeYear` | Int | |
| `OccupationID` | Int | → `OccupationMaster` |
| `GenderID` | Int | 1=M, 2=F, 3=T |

### `Victim` — ~300 rows
| Column | Type | Notes |
|---|---|---|
| `VictimMasterID` | Int | PK |
| `CaseMasterID` | Int | → `CaseMaster` |
| `VictimName` | Text (100) | |
| `AgeYear` | Int | |
| `GenderID` | Int | 1=M, 2=F, 3=T |
| `VictimPolice` | Text (5) | '1' if the victim is police, else '0' |

### `Accused` — ~450 rows
| Column | Type | Notes |
|---|---|---|
| `AccusedMasterID` | Int | PK |
| `CaseMasterID` | Int | → `CaseMaster` |
| `AccusedName` | Text (100) | |
| `AgeYear` | Int | |
| `GenderID` | Int | 1=M, 2=F, 3=T |
| `PersonID` | Text (10) | in-case ordinal: A1, A2, A3… (per the ER diagram; NOT a person FK) |

### `ArrestSurrender` — ~270 rows
| Column | Type | Notes |
|---|---|---|
| `ArrestSurrenderID` | Int | PK |
| `CaseMasterID` | Int | → `CaseMaster` |
| `ArrestSurrenderTypeID` | Int | 1=arrest, 2=surrender |
| `ArrestSurrenderDate` | Date | |
| `ArrestSurrenderStateId` | Int | → `State` |
| `ArrestSurrenderDistrictId` | Int | → `District` |
| `PoliceStationID` | Int | → `Unit` |
| `IOID` | Int | → `Employee` |
| `CourtID` | Int | → `Court` |
| `AccusedMasterID` | Int | → `Accused` |
| `IsAccused` | Int | 0/1 |
| `IsComplainantAccused` | Int | 0/1 |

### `ChargesheetDetails` — ~120 rows
| Column | Type | Notes |
|---|---|---|
| `CSID` | Int | PK |
| `CaseMasterID` | Int | → `CaseMaster` |
| `csdate` | DateTime | |
| `cstype` | Text (2) | A=Chargesheet, B=False Case, C=Undetected |
| `PolicePersonID` | Int | → `Employee` |

### `ActSectionAssociation` — ~700 rows
| Column | Type | Notes |
|---|---|---|
| `CaseMasterID` | Int | → `CaseMaster` |
| `ActID` | Text (20) | → `Act.ActCode` |
| `SectionID` | Text (20) | → `Section.SectionCode` |
| `ActOrderID` | Int | print order |
| `SectionOrderID` | Int | print order |

---

## 3. Tier 2 — CIPHER analytical layer (create with Tier 1)

### `person_master` — ~330 rows (entity-resolved identities)
| Column | Type | Notes |
|---|---|---|
| `person_id` | Text (20) | PK — `P-XXXX`, the person citation key |
| `full_name` | Text (100) | |
| `aliases` | Text (100) | may be empty |
| `gender` | Text (5) | M / F / T |
| `dob` | Date | |
| `age_band` | Text (10) | 18-24 / 25-34 / 35-44 / 45+ |
| `address` | Text (255) | |
| `district` | Text (50) | |
| `socio_econ_band` | Text (20) | low / lower-middle / middle |
| `occupation` | Text (50) | |
| `is_offender` | Int | 0/1 |

### `person_case_link` — ~1050 rows (resolution of per-case rows → identities)
| Column | Type | Notes |
|---|---|---|
| `link_id` | Text (20) | PK |
| `person_id` | Text (20) | → `person_master` |
| `CaseMasterID` | Int | → `CaseMaster` |
| `role` | Text (20) | accused / victim / complainant |
| `source_table` | Text (30) | Accused / Victim / ComplainantDetails |
| `source_row_id` | Int | AccusedMasterID / VictimMasterID / ComplainantID |

### `attribute` — ~400 rows
| Column | Type | Notes |
|---|---|---|
| `id` | Text (20) | PK |
| `person_id` | Text (20) | → `person_master` |
| `type` | Text (20) | phone / vehicle |
| `value` | Text (50) | **shared values across persons are the network edges — do not dedupe** |
| `verified` | Int | 0/1 |

### `socio_economic` — 10 rows (area = station jurisdiction)
| Column | Type | Notes |
|---|---|---|
| `area_id` | Text (20) | PK |
| `district` | Text (50) | |
| `area_name` | Text (50) | station jurisdiction name (Yelahanka, Hebbal, …) |
| `population` | Int | |
| `unemployment_rate` | Double | |
| `literacy_rate` | Double | |
| `migration_index` | Double | |
| `economic_stress_index` | Double | |
| `urbanization_level` | Text (20) | urban / semi-urban / rural |

---

## 4. Tier 3 — Reference & org tables (official ER; import when convenient)

Small tables; the function bundles them as JSON regardless.

### Law classification
| Table | Rows | Columns |
|---|---|---|
| `Act` | ~4 | `ActCode` (PK, Text: IPC / NDPS / ITACT / MVACT), `ActDescription`, `ShortName`, `Active` |
| `Section` | ~20 | `ActCode` → Act, `SectionCode`, `SectionDescription`, `Active` |
| `CrimeHead` | 4 | `CrimeHeadID` (PK), `CrimeGroupName` (Crimes Against Property / Crimes Against Body / Economic Offences / Narcotic Offences), `Active` |
| `CrimeSubHead` | 7 | `CrimeSubHeadID` (PK), `CrimeHeadID` → CrimeHead, `CrimeHeadName` (Chain Snatching, House Burglary, Vehicle Theft, Robbery, Assault / Hurt, Cheating / Online Fraud, Narcotics Possession), `SeqID` |
| `CrimeHeadActSection` | ~10 | `CrimeHeadID`, `ActCode`, `SectionCode` |

### Lookups
| Table | Rows | Columns |
|---|---|---|
| `CaseCategory` | 4 | `CaseCategoryID` (PK: 1/3/4/8), `LookupValue` (FIR / UDR / PAR / Zero FIR) |
| `GravityOffence` | 2 | `GravityOffenceID` (PK), `LookupValue` (Heinous / Non-Heinous) |
| `CaseStatusMaster` | 3 | `CaseStatusID` (PK), `CaseStatusName` (Under Investigation / Charge Sheeted / Closed) |
| `OccupationMaster` | ~10 | `OccupationID` (PK), `OccupationName` |

### Organisation & geography
| Table | Rows | Columns |
|---|---|---|
| `State` | 3 | `StateID` (PK), `StateName` (Karnataka + neighbours for out-of-state arrests), `Active` |
| `District` | 3 | `DistrictID` (PK: 443/450/430), `DistrictName`, `StateID`, `Active` |
| `Unit` | ~13 | `UnitID` (PK), `UnitName`, `TypeID` → UnitType, `ParentUnit` (self-ref), `StateID`, `DistrictID`, `Active` |
| `UnitType` | 2 | `UnitTypeID` (PK), `UnitTypeName` (Police Station / District Office), `CityDistState`, `Hierarchy` |
| `Rank` | ~5 | `RankID` (PK), `RankName` (PC / HC / PSI / PI / DySP), `Hierarchy`, `Active` |
| `Designation` | ~3 | `DesignationID` (PK), `DesignationName` (Investigating Officer / SHO / Writer), `Active` |
| `Employee` | ~40 | `EmployeeID` (PK), `DistrictID`, `UnitID`, `RankID`, `DesignationID`, `KGID`, `FirstName`, `GenderID`, `AppointmentDate` |
| `Court` | ~5 | `CourtID` (PK), `CourtName`, `DistrictID`, `StateID`, `Active` |

---

## 5. Flip the backend

Once tables are populated, set the function env var in the console (**Functions → api → Configuration → Environment Variables**):

```
CIPHER_STORE=datastore
```

Verify with `GET /server/api/health` — `store` should read `datastore` instead of `memory`.

---

## 6. What is *not* in the Data Store

Per-FIR narrative docs (built from `CaseMaster.BriefFacts` + party details) are **not** Data Store rows. They are bundled by `data/bundle_kb.mjs` into per-district files under `data/kb/` and uploaded to the **QuickML RAG Knowledge Base** (`cipher-fir-kb`). Each narrative carries its `CrimeNo` line, the model cites CrimeNos, and the pipeline validates every cited CrimeNo against the record store — discarding answers citing unretrieved records.

The split follows the LLD's intent routing: structured questions (*"list the accused in Yelahanka"*) are answered from Data Store rows; narrative/semantic questions (*"find cases with a similar modus operandi"*) go through RAG similarity retrieval. Both paths return record IDs for the evidence trail.

---

## 7. Mapping to the official ER diagram (for the deck)

| ER diagram table | CIPHER table | Fidelity |
|---|---|---|
| CaseMaster | `CaseMaster` | verbatim (occurrence 1:1 table folded in, as its columns already appear in CaseMaster) |
| ComplainantDetails | `ComplainantDetails` | verbatim minus Caste/Religion FKs (bias stance) |
| Victim / Accused | `Victim` / `Accused` | verbatim |
| ArrestSurrender | `ArrestSurrender` | verbatim (junction table folded in) |
| ChargesheetDetails | `ChargesheetDetails` | verbatim |
| ActSectionAssociation, Act, Section | same names | verbatim |
| CrimeHead, CrimeSubHead, CrimeHeadActSection | same names | verbatim |
| CaseCategory, GravityOffence, CaseStatusMaster, OccupationMaster | same names | verbatim |
| State, District, Unit, UnitType, Rank, Designation, Employee, Court | same names | verbatim (Employee trimmed) |
| CasteMaster, ReligionMaster | — | deliberately excluded (PRD §9 bias stance) |
| — | `person_master`, `person_case_link`, `attribute`, `socio_economic` | CIPHER analytical layer: entity resolution + network + socio context |
