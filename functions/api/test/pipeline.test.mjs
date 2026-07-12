/**
 * Pipeline checks. Run: node --test functions/api/test/
 *
 * These run without QuickML configured, so they exercise the deterministic path and the
 * guardrail — which is exactly what must hold when the model is unavailable or wrong.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pipeline = require('../lib/pipeline.js');
const nlu = require('../lib/nlu.js');
const glossary = require('../lib/glossary.js');

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
	const r = await pipeline.answer('show the network around P-0070');
	assert.equal(r.intent, 'NETWORK');
	assert.ok(r.data.co_accused.length > 0, 'expected co-accused');
	assert.ok(r.data.shared_links.length > 0, 'expected a shared phone/vehicle link');
});

test('guardrail rejects a fabricated record id', () => {
	// Simulates the model citing a FIR that was never retrieved.
	const bad = pipeline.unsupportedIds('The accused appears in FIR-9999 [FIR-9999].', ['FIR-0001', 'P-0070']);
	assert.deepEqual(bad, ['FIR-9999']);

	const good = pipeline.unsupportedIds('Named in FIR-0001 [FIR-0001].', ['FIR-0001', 'P-0070']);
	assert.deepEqual(good, []);
});

test('hotspot ranks the planted surge area first', async () => {
	const r = await pipeline.answer('which area has the most chain snatching in Bengaluru North in 2026?');
	assert.equal(r.intent, 'HOTSPOT');
	assert.equal(r.data.top_area.taluk, 'Yelahanka');
});

test('trend windows are calendar-aligned and quiet months are not dropped', async () => {
	const r = await pipeline.answer('is chain snatching rising in Bengaluru North?');
	assert.equal(r.intent, 'TREND');
	assert.equal(r.data.movement.direction, 'rising');

	// Months with no FIRs must appear as zeros. Without them a "last 6 months" window
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

test('the spoken total and the charted total cannot disagree', async () => {
	// The prose and the chart are rendered from one payload precisely so this holds.
	const r = await pipeline.answer('is chain snatching rising in Bengaluru North?');
	const stated = Number(r.answer.match(/^(\d+) FIRs/)[1]);
	const charted = r.data.series.reduce((a, s) => a + s.count, 0);
	assert.equal(stated, r.data.total);
	assert.equal(charted, r.data.total);
});
