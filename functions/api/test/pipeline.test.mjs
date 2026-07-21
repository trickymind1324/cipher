/**
 * Pipeline checks. Run: node --test functions/api/test/
 *
 * These run without QuickML configured, so they exercise the deterministic path and the
 * guardrail — which is exactly what must hold when the model is unavailable or wrong.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Deterministic path only — never let test results depend on a live model.
process.env.CIPHER_DISABLE_LLM = '1';

const require = createRequire(import.meta.url);
const pipeline = require('../lib/pipeline.js');
const nlu = require('../lib/nlu.js');
const glossary = require('../lib/glossary.js');
const store = require('../lib/store.js');

test('Kannada crime term maps to the taxonomy, not the model’s guess', () => {
	// GLM rendered ಸರಗಳ್ಳತನ as "Cybercrime" and answered about phishing. The glossary
	// is what stops that from becoming a retrieval against the wrong crime type.
	assert.equal(glossary.crimeType('ಬೆಂಗಳೂರಿನಲ್ಲಿ ಸರಗಳ್ಳತನ ಪ್ರಕರಣಗಳ ಬಗ್ಗೆ ಹೇಳಿ'), 'Chain Snatching');
	assert.equal(glossary.district('ಬೆಂಗಳೂರಿನಲ್ಲಿ ಸರಗಳ್ಳತನ ಪ್ರಕರಣಗಳ ಬಗ್ಗೆ ಹೇಳಿ'), 'Bengaluru North');
	assert.notEqual(glossary.crimeType('ಸರಗಳ್ಳತನ'), 'Cheating / Online Fraud');
});

test('longest match wins over substring', () => {
	assert.equal(glossary.district('cases in Bengaluru North'), 'Bengaluru North');
});

test('an 18-digit CrimeNo in the question is parsed and routed to SUMMARY', () => {
	const cn = store.findFirs({ limit: 1 }).rows[0].crime_no;
	const p = nlu.parse(`what happened in ${cn}?`);
	assert.equal(p.entities.crime_no, cn);
	assert.equal(p.intent, 'SUMMARY');
});

test('abstains when no records support the question', async () => {
	const r = await pipeline.answer('show me narcotics cases in Kalaburagi');
	assert.equal(r.abstained, true);
	assert.equal(r.citations.length, 0);
	assert.match(r.answer, /cannot answer|no records/i);
});

test('abstains in Kannada for a Kannada question', async () => {
	const r = await pipeline.answer('ಕಲಬುರಗಿಯಲ್ಲಿ ಮಾದಕ ವಸ್ತು ಪ್ರಕರಣಗಳು');
	assert.equal(r.abstained, true);
	assert.equal(r.language, 'kn');
	assert.match(r.answer, /[ಀ-೿]/); // answered in Kannada, not English
});

test('answers a retrieval question with citations that all resolve', async () => {
	const r = await pipeline.answer('chain snatching cases in Yelahanka in 2026');
	assert.equal(r.abstained, false);
	assert.ok(r.citations.length > 0);
	const evidence = new Set(r.evidence.map(String));
	for (const c of r.citations) assert.ok(evidence.has(c), `${c} was cited but never retrieved`);
});

test('follow-up carries context forward', async () => {
	const first = await pipeline.answer('chain snatching in Bengaluru North in 2026');
	const second = await pipeline.answer('what about Mysuru?', first.entities);
	assert.equal(second.entities.crime_type, 'Chain Snatching'); // carried
	assert.equal(second.entities.district, 'Mysuru'); // overridden by this turn
	assert.ok(second.carried_over.includes('crime_type'));
});

test('network query surfaces co-accused and shared identifiers', async () => {
	const r = await pipeline.answer('show the network around P-0067');
	assert.equal(r.intent, 'NETWORK');
	assert.ok(r.data.co_accused.length > 0, 'expected co-accused');
	assert.ok(r.data.shared_links.length > 0, 'expected a shared phone/vehicle link');
});

test('guardrail rejects a fabricated record id', () => {
	const real = store.findFirs({ limit: 1 }).rows[0].crime_no;
	const fake = '899999999920269999'; // 18 digits, matches no record

	// Simulates the model citing a case that was never retrieved.
	const bad = pipeline.unsupportedIds(`The accused appears in ${fake} [${fake}].`, [real, 'P-0067']);
	assert.deepEqual(bad, [fake]);

	const good = pipeline.unsupportedIds(`Named in ${real} [${real}].`, [real, 'P-0067']);
	assert.deepEqual(good, []);
});

test('hotspot ranks the planted surge area first', async () => {
	const r = await pipeline.answer('which area has the most chain snatching in Bengaluru North in 2026?');
	assert.equal(r.intent, 'HOTSPOT');
	assert.equal(r.data.top_area.area, 'Yelahanka');
});

test('trend windows are calendar-aligned and quiet months are not dropped', async () => {
	const r = await pipeline.answer('is chain snatching rising in Bengaluru North?');
	assert.equal(r.intent, 'TREND');
	assert.equal(r.data.movement.direction, 'rising');

	// Months with no cases must appear as zeros. Without them a "last 6 months" window
	// silently spans more than six calendar months, and the chart joins across the gap
	// as though nothing happened there.
	assert.ok(r.data.series.some((s) => s.count === 0), 'expected zero-filled months');

	const months = r.data.series.map((s) => s.key);
	for (let i = 1; i < months.length; i++) {
		const [py, pm] = months[i - 1].split('-').map(Number);
		const [cy, cm] = months[i].split('-').map(Number);
		assert.equal((cy - py) * 12 + (cm - pm), 1, `non-contiguous: ${months[i - 1]} → ${months[i]}`);
	}
});

test('counting questions never route to RAG', async () => {
	// Tested against the live console, RAG described its top-k retrieval window as if it
	// were the whole database ("three incidents" against a real count many times that).
	// Counts must therefore come from the store, always.
	const r = await pipeline.answer('how many chain snatchings in Yelahanka?');
	assert.notEqual(r.intent, 'SIMILAR_CASE');

	const rows = r.data.rows ?? r.data.series ?? [];
	assert.ok(rows.length > 0);
	// the store knows the real figure — check the answer reports it, not a top-k window
	const expected = store.findFirs({ area: 'Yelahanka', crime_type: 'Chain Snatching', limit: 1 }).total;
	assert.ok(expected > 5, 'dataset should have a real surge here');
	assert.equal(r.data.total, expected, 'store must report the true count');
});

test('similarity is described as a shortlist, never as a total', () => {
	const rows = [
		{ crime_no: '104300010202600001', crime_type: 'House Burglary', area: 'Kalaburagi City', occurrence_date: '2026-01-01', status: 'Closed' },
	];
	const text = pipeline.templateAnswer(
		{ kind: 'similar', records: rows, evidence: [rows[0].crime_no], data: { seed: null, rows, proposed: 1, resolved: 1 } },
		{ entities: {} }
	);
	assert.match(text, /shortlist, not a count/i);
	assert.doesNotMatch(text, /there are \d+ (such )?cases/i);
});

test('a crime number RAG invents does not survive re-grounding', () => {
	// retrieveSimilar maps ids through the store and drops what does not resolve.
	const real = store.findFirs({ limit: 1 }).rows[0].crime_no;
	assert.equal(store.getFir('899999999920269999'), null);
	assert.ok(store.getFir(real));
});

test('the spoken total and the charted total cannot disagree', async () => {
	// The prose and the chart are rendered from one payload precisely so this holds.
	const r = await pipeline.answer('is chain snatching rising in Bengaluru North?');
	const stated = Number(r.answer.match(/^(\d+) cases/)[1]);
	const charted = r.data.series.reduce((a, s) => a + s.count, 0);
	assert.equal(stated, r.data.total);
	assert.equal(charted, r.data.total);
});
