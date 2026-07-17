# Zoho Catalyst Setup Guide — CIPHER (KSP Datathon 2026)

| Field | Value |
|---|---|
| **Document** | Catalyst Account & Project Setup (click-path) |
| **Audience** | Team — one-time setup before build P0 |
| **Date** | 28 June 2026 |
| **Hard constraint** | Account country = **India** → **IN data center** (required for hackathon credits *and* QuickML GenAI) |

> Do these once. At the end, share the four values in §6 back with me and I can start P0 scaffolding.

---

## 0. Why the India / IN data center rule matters (read first)

Two independent requirements both force the same setting:

1. **Hackathon credits** ($250 + 1,500) only apply to accounts whose **country is set to India**.
2. **QuickML GenAI** (LLM Serving + RAG — our grounded-answer engine) is **GA in the IN data center**.

> ⚠️ A Zoho account's **data center is fixed at signup based on the account's country** and is **not switchable later**. If your existing Zoho account is on a non-IN DC (e.g. US), create a **fresh Zoho account with country = India** for this submission. Don't build on the wrong DC and discover it at deploy time.

---

## 1. Create / verify the Zoho account (country = India)

1. Sign up at **https://www.zoho.com/** (or accounts.zoho.com) — during signup set **Country = India**.
2. Verify the account lands on the **IN data center**: after login the console URL should be under **`catalyst.zoho.in`** (IN), *not* `.com` (US) or `.eu`.
3. If you already have an India-based Zoho account, just use it.

**Check:** console URL host = `catalyst.zoho.in` → ✅ IN DC.

---

## 2. Claim the hackathon credits

1. Complete the organizer's credit-activation steps (the ones that grant **1,500 credits** immediately).
2. The **$250** is then applied for monthly deductions and auto-covers renewals for the hackathon duration.
3. **Wait for the confirmation email** that the $250 was applied — *do not* start heavy QuickML usage until it lands (GenAI calls are the main credit consumer).

**Check:** confirmation email received; Catalyst console → **Billing** shows the credit balance.

---

## 3. Create the Catalyst project

1. Go to the **Catalyst console** (IN): **https://catalyst.zoho.in/**
2. Click **Create New Project**.
3. Name it (alphanumeric / `_` / `-` only, no spaces) — suggested: **`cipher`** or **`cipher-ksp`**.
4. A unique **Project ID** is generated — note it.
5. Click **Access Project**.

> First project must be created from the **console** (not the CLI). You get up to 50 projects.

**Check:** project opens; Project ID + DC noted.

---

## 4. Install the Catalyst CLI (for our build/deploy)

```bash
npm install -g zcatalyst-cli      # install
catalyst --version                 # verify
catalyst login                     # opens browser → auth with the India Zoho account
```

> After `catalyst login`, the CLI is tied to your account/DC. We'll run `catalyst init` inside the repo during P0 to wire `client/` (Web Client Hosting) + `functions/`.

**Check:** `catalyst login` succeeds and lists the `cipher` project.

---

## 5. Enable QuickML + create the RAG Knowledge Base + get API credentials

This is the GenAI engine for CIPHER's grounded, evidence-cited answers.

### 5a. Open QuickML
- In the Catalyst console (project open), open **QuickML** (under AI / Cloud Scale). Confirm it's available (IN DC ✅; it's *not* available on CA/JP/SA DCs).

### 5b. LLM Serving
- Go to **Generative AI → LLM Serving**.
- Select model **GLM 4.7 Flash**.

> **Use the console, not the public docs.** Zoho's public LLM Serving help page still lists the three
> Qwen 2.5 models as current and mentions no deprecation. The **console banner** says otherwise:
> *"Qwen 2.5-14B Instruct, Qwen 2.5-7B Coder and Qwen 2.5-7B Vision Language models are deprecated.
> Please migrate to GLM 4.7 Flash ... before June 30, 2026."* The console wins. Note that date has
> **already passed**, so treat Qwen as unavailable and go straight to GLM 4.7 Flash.
- Click **View API** → copy the **endpoint URL**, and note it uses **OAuth** (POST, headers incl. org ID + OAuth token).

### 5b-i. Kannada smoke test — do this before anything else
While you're in the **Chat** tab, ask GLM 4.7 Flash a question in Kannada. GLM 4.7 Flash is broadly
multilingual, so this should work — but *verify it rather than assume it*. Two minutes here decides
the whole P3 design:

- **Good Kannada** → keep the direct multilingual path.
- **Poor / garbled Kannada** → English-canonical path (translate in, compose from records in English,
  render the Kannada reply from templates + glossary). Tell me which you see.

### 5c. Knowledge Base + RAG
- **Generative AI → Knowledge Base → Upload Document.** Formats `.pdf` / `.docx` / `.txt`, **max 500 KB per file**. Upload from desktop (WorkDrive / Zoho Learn sync also offered — not needed).
- **Generative AI → RAG → Add Documents** (right panel, *Document Store*) → pick the uploaded docs. Leaving the document store empty makes RAG search the whole Knowledge Base, which is what we want.
- **View API** (top-right) → **Model Details → API Details** → copy the **RAG endpoint URL**.

> **What to upload — these three files, and nothing else** (delete any earlier CIPHER
> uploads first: pre-schema-redo bundles cite retired `FIR-xxxx` ids that no longer resolve):
>
> ```
> data/kb/cipher-fir-kb--bengaluru-north--part-1.txt   152 cases   158 KB
> data/kb/cipher-fir-kb--kalaburagi--part-1.txt         65 cases    67 KB
> data/kb/cipher-fir-kb--mysuru--part-1.txt             83 cases    85 KB
> ```
>
> All 300 case narratives, grouped by district, largest file 158 KB against the 500 KB cap.
> Regenerate any time with `node data/bundle_kb.mjs`.
>
> There is **no bulk/API upload** — it's a console upload — so the 300 per-case files are bundled rather
> than uploaded one by one. Grouping costs no citation precision, because we do **not** depend on RAG's
> document IDs. Every narrative carries its own `Crime Number: <18 digits>` line, so the model cites
> record IDs from the text, and the function then **validates every cited ID against the record store**
> before the answer is returned. An ID that doesn't resolve means the model fabricated it, and the
> answer is discarded — a stronger guarantee than trusting a document-level citation.

### 5d. OAuth client (so Functions can call the above)
- Zoho **API Console** (`api-console.zoho.in`) → create a **Self Client** (server-to-server).
- Scope needed for both LLM Serving and RAG: **`QuickML.deployment.READ`**.
- Generate **Client ID + Client Secret**; both calls are `POST` with the **org ID** and an **OAuth access token** in the headers.
- Store as Catalyst Function **environment variables** — never commit them.

**Check:** you have an LLM-Serving endpoint, a RAG endpoint, and OAuth Client ID/Secret that can mint a token.

---

## 6. Share these four things back to unblock build P0

| # | Value | Where from |
|---|---|---|
| 1 | **Project ID** + **data center** (should be IN) | §3 |
| 2 | **QuickML LLM-Serving endpoint URL** | §5b |
| 3 | **QuickML RAG endpoint URL** + **Knowledge Base name/ID** | §5c |
| 4 | **OAuth Client ID + Secret + scopes** (send securely, not in chat/repo) | §5d |

> Secrets: don't paste the Client Secret into the repo or a public channel. Put it straight into Catalyst env vars; share only that it's set, or use a secure channel.

---

## 7. Final verification checklist

- [ ] Zoho account country = **India**, console at **`catalyst.zoho.in`**
- [ ] **1,500 credits** visible + **$250** confirmation email received
- [ ] Catalyst project **`cipher`** created; Project ID noted
- [ ] CLI installed; `catalyst login` works
- [ ] QuickML enabled; **GLM 4.7 Flash** LLM Serving live; **RAG + KB** created
- [ ] OAuth Client ID/Secret generated and stored as secrets
- [ ] Four values from §6 captured

> Once §7 is green, P0 (repo scaffold + `catalyst init` + empty deploy) can begin.

---

## Notes / gotchas

- **Don't use deprecated services:** File Store, Cron, Event Listeners (EOL **30 Apr 2026**). We use **Stratus** (object store) for PDFs and precompute at seed time instead of Cron.
- **Hosting:** React SPA goes to **Web Client Hosting (Slate)**; backend logic to **Functions**. (AppSail is an alternative full-app PaaS — we don't need it for an SPA + FaaS split.)
- **Kannada — verify, don't assume.** GLM 4.7 Flash is broadly multilingual, but Kannada quality is unverified for our use. Test it *first* (§5b-i). If quality is poor, the fallback is an English-canonical pipeline (translate KN→EN in, compose the answer in English from records, render the reply from Kannada templates + a curated glossary rather than free-form LLM Kannada).

*End of Setup Guide.*
