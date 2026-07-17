/**
 * CIPHER benchmark harness — produces the numbers for the submission's performance
 * report (PPTX slide 12) and writes docs/09_Benchmark_Report.md.
 *
 * Ground truths are computed from the record store at run time, not hard-coded, so the
 * report can never drift from the dataset. What is measured:
 *
 *   1. Intent routing accuracy      — labelled EN + KN queries vs the NLU's intent
 *   2. Entity extraction accuracy   — crime type / district / area / date resolution
 *   3. Retrieval correctness        — answer totals vs counts computed from the tables
 *   4. Citation validity            — every cited id must resolve AND be in evidence
 *   5. Abstain behaviour            — unanswerable queries abstain; answerable never do
 *   6. Kannada handling             — KN in → KN out, correct entity resolution
 *   7. Latency                      — in-process pipeline p50/p95, optional live API
 *
 * Usage:
 *   node bench/run.mjs                  # in-process (records-only mode)
 *   node bench/run.mjs --live <BASE>    # add live-API latency, e.g.
 *                                       #   --live https://…catalystserverless.in/server/api
 */

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const pipeline = require('../functions/api/lib/pipeline.js');
const nlu = require('../functions/api/lib/nlu.js');
const store = require('../functions/api/lib/store.js');

const liveBase = process.argv.includes('--live') ? process.argv[process.argv.indexOf('--live') + 1] : null;

const count = (f) => store.findFirs({ ...f, limit: 1 }).total;
const kn = (s) => /[ಀ-೿]/.test(s);

// ── labelled query set ─────────────────────────────────────────────────────────
// `entities` lists what the NLU must resolve; `total` (a filter object) is the
// retrieval ground truth; `abstain` marks queries that must return no answer.
const CASES = [
	// retrieval, EN
	{ q: 'List chain snatching cases in Yelahanka this year', intent: 'RETRIEVE', entities: { crime_type: 'Chain Snatching', area: 'Yelahanka' }, total: { crime_type: 'Chain Snatching', area: 'Yelahanka', from: '2026-01-01', to: '2026-12-31' } },
	{ q: 'Show robbery cases in Mysuru in 2025', intent: 'RETRIEVE', entities: { crime_type: 'Robbery', district: 'Mysuru' }, total: { crime_type: 'Robbery', district: 'Mysuru', from: '2025-01-01', to: '2025-12-31' } },
	{ q: 'House burglaries in Peenya', intent: 'RETRIEVE', entities: { crime_type: 'House Burglary', area: 'Peenya' }, total: { crime_type: 'House Burglary', area: 'Peenya' } },
	{ q: 'Vehicle theft cases in Kalaburagi', intent: 'RETRIEVE', entities: { crime_type: 'Vehicle Theft', district: 'Kalaburagi' }, total: { crime_type: 'Vehicle Theft', district: 'Kalaburagi' } },
	{ q: 'Online fraud cases in Bengaluru North', intent: 'RETRIEVE', entities: { crime_type: 'Cheating / Online Fraud', district: 'Bengaluru North' }, total: { crime_type: 'Cheating / Online Fraud', district: 'Bengaluru North' } },
	{ q: 'How many assault cases in Hunsur?', intent: 'RETRIEVE', entities: { crime_type: 'Assault / Hurt', area: 'Hunsur' }, total: { crime_type: 'Assault / Hurt', area: 'Hunsur' } },
	// retrieval, KN
	{ q: 'ಈ ವರ್ಷ ಯಲಹಂಕದಲ್ಲಿ ಸರಗಳ್ಳತನ ಪ್ರಕರಣಗಳನ್ನು ತೋರಿಸಿ', intent: 'RETRIEVE', lang: 'kn', entities: { crime_type: 'Chain Snatching', area: 'Yelahanka' } },
	{ q: 'ಮೈಸೂರಿನಲ್ಲಿ ದರೋಡೆ ಪ್ರಕರಣಗಳು', intent: 'RETRIEVE', lang: 'kn', entities: { crime_type: 'Robbery', district: 'Mysuru' } },
	{ q: 'ಬೆಂಗಳೂರಿನಲ್ಲಿ ಮನೆ ಕಳ್ಳತನ', intent: 'RETRIEVE', lang: 'kn', entities: { crime_type: 'House Burglary', district: 'Bengaluru North' } },
	// trend / hotspot
	{ q: 'Is chain snatching rising in Bengaluru North?', intent: 'TREND', entities: { crime_type: 'Chain Snatching', district: 'Bengaluru North' } },
	{ q: 'Which area has the most burglaries?', intent: 'HOTSPOT', entities: { crime_type: 'House Burglary' } },
	{ q: 'ಯಾವ ಪ್ರದೇಶದಲ್ಲಿ ಹೆಚ್ಚು ದರೋಡೆ?', intent: 'HOTSPOT', lang: 'kn', entities: { crime_type: 'Robbery' } },
	// network / profile / repeat
	{ q: 'Show the network around P-0067', intent: 'NETWORK', entities: { person_id: 'P-0067' } },
	{ q: 'Who are the repeat offenders in Bengaluru North?', intent: 'REPEAT_OFFENDER', entities: { district: 'Bengaluru North' } },
	{ q: 'Criminal history of P-0025', intent: 'PROFILE', entities: { person_id: 'P-0025' } },
	// summary by CrimeNo (id injected below)
	{ q: null, intent: 'SUMMARY', mkQ: (cn) => `What happened in ${cn}?`, entities: {} },
	// abstain set — data that does not exist
	{ q: 'Show narcotics cases in Kalaburagi', abstain: true },
	{ q: 'ಕಲಬುರಗಿಯಲ್ಲಿ ಮಾದಕ ವಸ್ತು ಪ್ರಕರಣಗಳು', abstain: true, lang: 'kn' },
	{ q: 'Chain snatching cases in Yelahanka in 2020', abstain: true },
	{ q: 'What happened in 899999999920269999?', abstain: true },
];

// inject a real CrimeNo for the summary case
const sampleCase = store.findFirs({ limit: 1 }).rows[0];
for (const c of CASES) if (c.mkQ) c.q = c.mkQ(sampleCase.crime_no);

// ── run ────────────────────────────────────────────────────────────────────────
const results = [];
for (const c of CASES) {
	const t0 = process.hrtime.bigint();
	const r = await pipeline.answer(c.q, {});
	const ms = Number(process.hrtime.bigint() - t0) / 1e6;

	const row = { case: c, r, ms, pass: { } };

	if (c.abstain) {
		row.pass.abstain = r.abstained === true;
		if (c.lang) row.pass.lang = r.language === c.lang && kn(r.answer);
	} else {
		row.pass.answered = r.abstained === false;
		if (c.intent) row.pass.intent = r.intent === c.intent;
		if (c.lang) row.pass.lang = r.language === c.lang;
		if (c.entities) {
			row.pass.entities = Object.entries(c.entities).every(([k, v]) => r.entities[k] === v);
		}
		if (c.total) {
			row.pass.total = r.data?.total === count(c.total);
		}
		// citation validity: every cited id resolves in the store AND was retrieved
		const evidence = new Set((r.evidence || []).map(String));
		row.pass.citations = (r.citations || []).every((id) =>
			evidence.has(id) && (id.startsWith('P-') ? !!store.getPerson(id) : !!store.getFir(id)),
		);
	}
	results.push(row);
}

// context carry-over check (FR-CONV-05)
const c1 = await pipeline.answer('Chain snatching in Bengaluru North in 2026', {});
const c2 = await pipeline.answer('what about Mysuru?', c1.entities);
const carryPass = c2.entities.crime_type === 'Chain Snatching' && c2.entities.district === 'Mysuru';

// ── aggregate ──────────────────────────────────────────────────────────────────
const agg = (key) => {
	const applicable = results.filter((x) => key in x.pass);
	return { pass: applicable.filter((x) => x.pass[key]).length, total: applicable.length };
};
const pct = ({ pass, total }) => (total ? `${((100 * pass) / total).toFixed(0)}% (${pass}/${total})` : 'n/a');

const latencies = results.map((x) => x.ms).sort((a, b) => a - b);
const pctile = (p) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))].toFixed(1);

// optional live-API latency (network + function, records-only mode)
let live = null;
if (liveBase) {
	const times = [];
	for (const c of CASES.slice(0, 8)) {
		const t0 = Date.now();
		await fetch(`${liveBase}/query`, {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: c.q }),
		}).then((r) => r.json());
		times.push(Date.now() - t0);
	}
	times.sort((a, b) => a - b);
	live = { n: times.length, p50: times[Math.floor(times.length / 2)], max: times[times.length - 1] };
}

const failures = results.filter((x) => Object.values(x.pass).some((v) => !v));

// ── report ─────────────────────────────────────────────────────────────────────
const stats = store.stats();
const mode = liveBase ? `in-process + live (${liveBase})` : 'in-process';
const lines = [
	'# CIPHER — Prototype Performance Report',
	'',
	`Generated by \`node bench/run.mjs\` on ${new Date().toISOString().slice(0, 10)} · dataset: ${stats.tables.CaseMaster} cases / ${stats.tables.person_master} persons (synthetic, ${stats.date_range.from} → ${stats.date_range.to}) · mode: ${mode}, answers composed from records (guardrailed template path).`,
	'',
	'| Metric | What it measures | Result |',
	'|---|---|---|',
	`| Intent routing accuracy | ${agg('intent').total} labelled EN/KN queries → correct intent (retrieve, trend, hotspot, network, profile, repeat-offender, summary) | **${pct(agg('intent'))}** |`,
	`| Entity extraction accuracy | crime type, district, area, person and date resolved from EN and KN phrasing | **${pct(agg('entities'))}** |`,
	`| Retrieval correctness | answer totals equal counts computed independently from the tables | **${pct(agg('total'))}** |`,
	`| Citation validity | every cited id resolves in the record store and was actually retrieved for the answer | **${pct(agg('citations'))}** |`,
	`| Abstain on unanswerable | queries with no supporting records (incl. the planted Kalaburagi-narcotics gap) refuse to answer | **${pct(agg('abstain'))}** |`,
	`| False-abstain rate | answerable queries wrongly refused | **${(100 * (1 - agg('answered').pass / agg('answered').total)).toFixed(0)}% (${agg('answered').total - agg('answered').pass}/${agg('answered').total})** |`,
	`| Kannada in → Kannada out | KN queries answered in Kannada with correct entity resolution | **${pct(agg('lang'))}** |`,
	`| Context carry-over | follow-up inherits unstated entities ("what about Mysuru?" keeps the crime type) | **${carryPass ? 'pass' : 'FAIL'}** |`,
	`| Pipeline latency (in-process) | parse → retrieve → compose → verify, per query | **p50 ${pctile(50)} ms · p95 ${pctile(95)} ms** |`,
	...(live ? [`| Live API latency (end-to-end) | deployed Catalyst function, network included, ${live.n} queries | **p50 ${live.p50} ms · max ${live.max} ms** |`] : []),
	'',
	'## Reading the numbers',
	'',
	'- **Citation validity is enforced, not observed.** The pipeline discards any model answer citing a record that was not retrieved, so an invalid citation cannot reach the user; this benchmark confirms the enforcement holds across the query set.',
	'- **Abstention is a feature.** The dataset deliberately contains no narcotics cases in Kalaburagi; the correct behaviour on that query is refusal with an explicit statement, in the language of the question.',
	'- **Totals come from the record store, never from RAG.** RAG (when configured) only shortlists similar narratives; counts, rankings and lookups are computed from tables. This is why retrieval correctness can be checked against independently computed ground truth.',
	'- Ground truths are recomputed from the dataset on every run — the report cannot drift from the data.',
	'',
	failures.length ? `## Failures (${failures.length})\n\n${failures.map((f) => `- "${f.case.q}" → ${JSON.stringify(f.pass)}`).join('\n')}` : '_All checks passed._',
	'',
];

const out = join(HERE, '..', 'docs', '09_Benchmark_Report.md');
writeFileSync(out, lines.join('\n'));
console.log(lines.join('\n'));
console.log(`\nreport → docs/09_Benchmark_Report.md`);
if (failures.length) process.exitCode = 1;
