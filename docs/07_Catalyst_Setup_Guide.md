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
- Select model **GLM 4.7 Flash** (131K context, multilingual 100+ langs) and deploy/enable serving. *(Qwen 2.5-14B Instruct / 7B Coder / 7B Vision are deprecated — EOL 30 Jun 2026 — migrate to GLM 4.7 Flash.)*
- Click **View API** → copy the **endpoint URL**, and note it uses **OAuth** (POST, headers incl. org ID + OAuth token).

### 5c. RAG + Knowledge Base
- Go to **Generative AI → Knowledge Base** → create a KB (e.g. `cipher-fir-kb`).
  - (We'll upload synthetic per-FIR narrative docs during P1 — `.pdf/.docx/.txt`, ≤500 KB each.)
- Go to **Generative AI → RAG** → bind it to that KB.
- Click **View API** → copy the **RAG endpoint URL** (OAuth, POST, 128k limit). Responses include the **Response Breakdown** with source IDs → our citations.

### 5d. OAuth client (so Functions can call the above)
- In the Catalyst/Zoho **API Console** (`api-console.zoho.in`) → create a **Self Client** (or Server-based client) for server-to-server calls.
- Generate **Client ID + Client Secret**, and the **scopes** QuickML requires.
- We'll store these as Catalyst Function **environment variables / secrets** (never commit them).

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
- **Kannada:** GLM 4.7 Flash covers 100+ languages — verify Kannada quality early; we add an EN-canonical translate step + glossary and vet demo queries.

*End of Setup Guide.*
