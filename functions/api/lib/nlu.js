'use strict';

/**
 * Intent + entity extraction. Deterministic and rule-based on purpose.
 *
 * The LLM's job is to *phrase* an answer from records we hand it. Deciding which
 * records to fetch is not delegated to it: a mis-parse silently retrieves the wrong
 * evidence, and a fluent answer over the wrong evidence is the worst failure this
 * system can have. Rules are auditable and testable; a mis-parse here is a bug we fix,
 * not a probability we tolerate.
 */

const glossary = require('./glossary');

const INTENTS = ['RETRIEVE', 'NETWORK', 'TREND', 'HOTSPOT', 'PROFILE', 'REPEAT_OFFENDER', 'SUMMARY', 'SIMILAR_CASE'];

const has = (t, ...words) => words.some((w) => t.includes(w));

/** Absolute dates only — "this year" resolves against the dataset, not wall-clock. */
function dateRange(text, now = new Date()) {
	const t = text.toLowerCase();
	const year = now.getUTCFullYear();

	const explicitYear = t.match(/\b(20\d{2})\b/);
	if (explicitYear) return { from: `${explicitYear[1]}-01-01`, to: `${explicitYear[1]}-12-31`, label: explicitYear[1] };

	if (has(t, 'this year', 'ಈ ವರ್ಷ')) return { from: `${year}-01-01`, to: `${year}-12-31`, label: `${year}` };
	if (has(t, 'last year', 'ಕಳೆದ ವರ್ಷ')) return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31`, label: `${year - 1}` };

	const months = t.match(/last (\d+) months?/) || (has(t, 'ಕಳೆದ', 'ತಿಂಗಳ') ? [null, '6'] : null);
	if (months) {
		const n = Number(months[1]);
		const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1));
		return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), label: `last ${n} months` };
	}

	if (has(t, 'last 6 months', 'recent', 'lately', 'ಇತ್ತೀಚಿನ')) {
		const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1));
		return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), label: 'last 6 months' };
	}
	return null;
}

function intentOf(text) {
	const t = text.toLowerCase();
	// Narrative similarity — the only intent RAG serves. Everything else is answered from
	// the store, because RAG cannot count and cannot look a record up by id.
	if (has(t, 'similar', 'same modus', 'same method', 'like this case', 'same pattern', 'resemble', 'ಹೋಲುವ', 'ಸಮಾನ'))
		return 'SIMILAR_CASE';
	if (has(t, 'network', 'linked to', 'connected', 'associates', 'gang', 'nexus', 'ಜಾಲ', 'ಸಂಪರ್ಕ')) return 'NETWORK';
	if (has(t, 'hotspot', 'hot spot', 'which area', 'which taluk', 'where are', 'concentrated', 'ಹಾಟ್‌ಸ್ಪಾಟ್', 'ಪ್ರದೇಶ')) return 'HOTSPOT';
	if (has(t, 'trend', 'over time', 'rising', 'increase', 'increasing', 'decline', 'month by month', 'ಪ್ರವೃತ್ತಿ', 'ಹೆಚ್ಚಳ')) return 'TREND';
	if (has(t, 'repeat', 'habitual', 'most active', 'top accused', 'frequent', 'ಪುನರಾವರ್ತಿತ')) return 'REPEAT_OFFENDER';
	if (has(t, 'summarise', 'summarize', 'summary of', 'tell me about fir', 'ಸಾರಾಂಶ')) return 'SUMMARY';
	if (/\bp-\d{3,4}\b/i.test(t) || has(t, 'profile', 'history of', 'record of', 'ಪ್ರೊಫೈಲ್')) return 'PROFILE';
	return 'RETRIEVE';
}

/**
 * @param text     the user's turn
 * @param context  entities carried from previous turns (FR-CONV-05 follow-ups)
 */
function parse(text, context = {}) {
	const raw = String(text || '').trim();
	const language = glossary.isKannada(raw) ? 'kn' : 'en';

	const firId = (raw.match(/\bFIR-\d{3,4}\b/i) || [])[0];
	const personId = (raw.match(/\bP-\d{3,4}\b/i) || [])[0];

	const turn = {
		crime_type: glossary.crimeType(raw),
		district: glossary.district(raw),
		taluk: glossary.taluk(raw),
		...dateRange(raw) ? { date: dateRange(raw) } : {},
		...(firId ? { fir_id: firId.toUpperCase() } : {}),
		...(personId ? { person_id: personId.toUpperCase() } : {}),
	};

	// A follow-up inherits what it doesn't restate ("...and in Mysuru?" keeps the crime type).
	const carried = {};
	for (const k of ['crime_type', 'district', 'taluk', 'date', 'person_id']) {
		if (turn[k] == null && context[k] != null) carried[k] = context[k];
	}

	const entities = { ...carried, ...Object.fromEntries(Object.entries(turn).filter(([, v]) => v != null)) };
	// A person named in *this* turn replaces one carried over — otherwise a new subject
	// would silently keep answering about the previous person.
	if (turn.person_id) entities.person_id = turn.person_id;

	const name = personNameIn(raw);
	if (name) entities.person_name = name;

	return {
		text: raw,
		language,
		intent: intentOf(raw),
		entities,
		carried_over: Object.keys(carried),
	};
}

/** Capitalised name candidates, minus the words our vocabulary already claims. */
function personNameIn(raw) {
	const stop = new Set(['fir', 'show', 'who', 'what', 'list', 'the', 'in', 'is', 'me', 'network', 'around', 'bengaluru', 'north', 'mysuru', 'kalaburagi', 'yelahanka', 'hebbal', 'peenya', 'chain', 'snatching']);
	const words = (raw.match(/\b[A-Z][a-z]{2,}\b/g) || []).filter((w) => !stop.has(w.toLowerCase()));
	return words.length ? words.join(' ') : null;
}

module.exports = { parse, INTENTS, dateRange, intentOf };
