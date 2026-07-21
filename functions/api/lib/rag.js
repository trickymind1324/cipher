'use strict';

/**
 * QuickML RAG over the FIR-narrative Knowledge Base.
 *
 * RAG is used as a *retriever*, not as an answer source. It is asked one thing — which
 * FIRs read like this — and everything it says about them is thrown away. The FIR ids it
 * mentions are then re-read from the record store, and the answer is built from those
 * records.
 *
 * This is not caution for its own sake. Tested against the console, RAG on this very
 * knowledge base:
 *
 *   - reported "three chain snatching incidents in Yelahanka" when there are 19, and
 *     "there are two cases" when asked to summarise them. It returns its top-k chunks and
 *     then describes the size of its retrieval window as if it were the size of the world.
 *     Cited, fluent, and wrong by 6x.
 *   - could not answer "what happened in <crime number>?" at all — embedding search does
 *     not match exact identifiers, so it cannot do the most basic lookup an officer needs.
 *   - but named genuinely similar cases, accurately, when asked about a modus operandi —
 *     which is the one thing SQL cannot do, because the MO is prose, not a column.
 *
 * So: counts, filters, rankings and id lookups come from the store. RAG is asked only for
 * narrative similarity, and its numbers never reach the user.
 */

const llm = require('./llm');

const DEFAULT_URL = 'https://api.catalyst.zoho.in/quickml/v1/project/43331000000013057/rag/answer';
// An 18-digit CrimeNo — the citation key each KB narrative carries on its first line.
const CRIME_NO_RE = /\b\d{18}\b/g;

const cfg = () => ({
	url: process.env.QUICKML_RAG_URL || DEFAULT_URL,
	org: process.env.CATALYST_ORG || '60075928027',
});

const isConfigured = () => llm.isConfigured() && Boolean(cfg().url);

/**
 * Ask the knowledge base which cases read like `description`.
 * @returns {Promise<{crime_nos: string[], raw: string}>} candidate ids only — no prose is kept
 */
async function similarCrimeNos(description, { limit = 8, timeoutMs = 25_000 } = {}) {
	if (!isConfigured()) throw new Error('rag_not_configured');

	const c = cfg();
	const bearer = await llm.accessToken();
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);

	// Ask only for identifiers. Any narrative it volunteers is discarded below anyway.
	// The /rag/answer endpoint takes a single `query` field — verified against the live API.
	const query =
		`List the Crime Numbers of cases whose narrative matches this description: "${description}". ` +
		`Reply with the 18-digit Crime Numbers only, one per line. Do not summarise, count, or explain.`;

	try {
		const res = await fetch(c.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${bearer}`,
				'CATALYST-ORG': c.org,
			},
			body: JSON.stringify({ query }),
			signal: ctrl.signal,
		});

		const json = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(`rag_http_${res.status}: ${JSON.stringify(json).slice(0, 200)}`);

		// Response shape varies by endpoint version; take whichever text field is present.
		const text =
			json.response ?? json?.choices?.[0]?.message?.content ?? json.answer ?? json.output ?? '';

		const ids = [...new Set(String(text).match(CRIME_NO_RE) || [])];
		return { crime_nos: ids.slice(0, limit), raw: String(text) };
	} finally {
		clearTimeout(timer);
	}
}

module.exports = { similarCrimeNos, isConfigured, config: cfg };
