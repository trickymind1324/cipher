'use strict';

/**
 * Query pipeline: parse → retrieve → ground → verify → answer.
 *
 * The contract (FR-CONV-10, FR-XAI-01):
 *   1. Nothing is answered without records. No records → abstain, explicitly.
 *   2. The model only ever sees records we retrieved, and is told to use nothing else.
 *   3. Every record ID in the final answer is checked against the retrieved set.
 *      An ID that was not retrieved is a fabrication; if one appears, we discard the
 *      model's text and fall back to the deterministic answer rather than ship it.
 *
 * Step 3 is what makes step 2 more than a polite request.
 */

const store = require('./store');
const nlu = require('./nlu');
const llm = require('./llm');
const rag = require('./rag');
const trends = require('./trends');

const ID_RE = /\b(?:FIR-\d{3,4}|P-\d{3,4})\b/gi;

// ── retrieval ─────────────────────────────────────────────────────────────────

/** Resolve a person named in the query to an id, if unambiguous. */
function resolvePerson(entities) {
	if (entities.person_id) return store.getPerson(entities.person_id);
	if (entities.person_name) {
		const hits = store.findPersons(entities.person_name, 2);
		if (hits.length === 1) return hits[0];
	}
	return null;
}

/**
 * Narrative similarity — the one question RAG is allowed to answer, and even here only as
 * a source of candidate ids. Whatever RAG *says* about the cases is discarded; the ids it
 * names are re-read from the store, and any id that doesn't resolve is dropped. So the
 * worst a bad retrieval can do is return fewer cases, never wrong facts about them.
 */
async function retrieveSimilar(entities, question) {
	const seed = entities.fir_id ? store.getFir(entities.fir_id) : null;
	// Describe by MO if a case was named, else use the question itself.
	const description = seed ? `${seed.crime_type}: ${seed.modus_operandi}` : question;

	const { fir_ids } = await rag.similarFirIds(description);

	const firs = fir_ids
		.filter((id) => id !== seed?.fir_id) // a case is not similar to itself
		.map((id) => store.getFir(id))
		.filter(Boolean); // an id RAG invented simply vanishes here

	return {
		kind: 'similar',
		records: firs,
		evidence: [...(seed ? [seed.fir_id] : []), ...firs.map((f) => f.fir_id)],
		data: { seed, description, rows: firs, proposed: fir_ids.length, resolved: firs.length },
	};
}

/**
 * @returns {{kind, records, evidence: string[], data}} evidence = the ids the answer may cite
 */
function retrieve(intent, entities) {
	const filters = {
		district: entities.district,
		taluk: entities.taluk,
		crime_type: entities.crime_type,
		from: entities.date?.from,
		to: entities.date?.to,
	};

	if (intent === 'SUMMARY' && entities.fir_id) {
		const fir = store.getFir(entities.fir_id);
		if (!fir) return { kind: 'fir', records: [], evidence: [] };
		const parties = store.partiesOfFir(fir.fir_id);
		return {
			kind: 'fir',
			records: [fir],
			evidence: [fir.fir_id, ...parties.map((p) => p.person_id)],
			data: { fir, parties },
		};
	}

	if (intent === 'NETWORK' || intent === 'PROFILE') {
		const person = resolvePerson(entities);
		if (!person) return { kind: intent.toLowerCase(), records: [], evidence: [] };

		const firs = store.firsOfPerson(person.person_id);
		const co = store.coAccused(person.person_id).map((c) => ({ ...c, person: store.getPerson(c.person_id) }));
		const links = store.sharedAttributeLinks(person.person_id).map((l) => ({ ...l, person: store.getPerson(l.person_id) }));

		return {
			kind: intent.toLowerCase(),
			records: [person],
			evidence: [
				person.person_id,
				...firs.map((f) => f.fir.fir_id),
				...co.map((c) => c.person_id),
				...links.map((l) => l.person_id),
			],
			data: { person, firs, co_accused: co, shared_links: links, attributes: store.attributesOfPerson(person.person_id) },
		};
	}

	if (intent === 'REPEAT_OFFENDER') {
		const rows = store.repeatAccused({ ...filters, min_firs: 2, limit: 10 });
		return {
			kind: 'repeat_offender',
			records: rows,
			evidence: rows.flatMap((r) => [r.person_id, ...r.fir_ids]),
			data: { rows, filters },
		};
	}

	// Both come from trends.build so the spoken answer and the rendered chart/map are
	// computed once. Two code paths would drift, and the text would contradict the picture.
	if (intent === 'TREND' || intent === 'HOTSPOT') {
		const t = trends.build(filters);
		return {
			kind: intent.toLowerCase(),
			records: t.total ? t.series : [],
			evidence: t.evidence,
			data: t,
		};
	}

	// RETRIEVE
	const { rows, total } = store.findFirs({ ...filters, person_id: entities.person_id, limit: 10 });
	return {
		kind: 'firs',
		records: rows,
		evidence: rows.map((f) => f.fir_id),
		data: { rows, total, filters },
	};
}

// ── context for the model (ids are explicit, so citations can be verified) ─────

function contextBlock(r) {
	const lines = [];
	const d = r.data || {};

	if (r.kind === 'firs') {
		lines.push(`Matching FIRs: ${d.total} total, showing ${d.rows.length}.`);
		for (const f of d.rows) {
			lines.push(`- ${f.fir_id} | ${f.crime_type} | ${f.taluk}, ${f.district} | occurred ${f.occurrence_date} | status ${f.status} | ${f.modus_operandi}`);
		}
	}

	if (r.kind === 'similar') {
		if (d.seed) lines.push(`Reference case ${d.seed.fir_id}: ${d.seed.crime_type} — ${d.seed.modus_operandi}`);
		lines.push(`Cases with a similar narrative (${d.rows.length}):`);
		for (const f of d.rows) {
			lines.push(`- ${f.fir_id} | ${f.crime_type} | ${f.taluk}, ${f.district} | ${f.occurrence_date} | ${f.status} | ${f.modus_operandi}`);
		}
		// The count below is the number of records that resolved, not a count of all such
		// cases in the database. Say so, or the model will present it as a total.
		lines.push('NOTE: this is a similarity shortlist, not a complete count of such cases.');
	}

	if (r.kind === 'fir') {
		const f = d.fir;
		lines.push(`${f.fir_id} (${f.fir_number}) | ${f.crime_type} | ${f.police_station}, ${f.taluk}, ${f.district}`);
		lines.push(`Occurred ${f.occurrence_date}, registered ${f.registered_date}. Sections: ${f.ipc_sections}. Status: ${f.status}. IO: ${f.io_officer}.`);
		lines.push(`Modus operandi: ${f.modus_operandi}`);
		for (const p of d.parties) {
			lines.push(`- ${p.role}: ${p.person?.full_name} (${p.person_id})${p.bail_status ? ` | ${p.bail_status}` : ''}`);
		}
	}

	if (r.kind === 'network' || r.kind === 'profile') {
		const p = d.person;
		lines.push(`${p.person_id} | ${p.full_name} | ${p.age_band} | ${p.taluk}, ${p.district} | occupation: ${p.occupation}`);
		lines.push(`Named in ${d.firs.length} FIRs:`);
		for (const f of d.firs.slice(0, 12)) lines.push(`- ${f.fir.fir_id} | ${f.role} | ${f.fir.crime_type} | ${f.fir.taluk} | ${f.fir.occurrence_date}`);
		if (d.co_accused.length) {
			lines.push('Co-accused (persons charged in the same FIRs):');
			for (const c of d.co_accused.slice(0, 8)) {
				lines.push(`- ${c.person_id} | ${c.person?.full_name} | co-accused in ${c.shared_firs.length} FIR(s): ${c.shared_firs.join(', ')}`);
			}
		}
		if (d.shared_links.length) {
			lines.push('Shared identifiers (same phone/vehicle recorded against another person):');
			for (const l of d.shared_links) {
				lines.push(`- ${l.person_id} | ${l.person?.full_name} | shares ${l.type} ${l.value}`);
			}
		}
	}

	if (r.kind === 'repeat_offender') {
		lines.push('Accused ranked by number of FIRs in scope:');
		for (const row of d.rows) {
			lines.push(`- ${row.person_id} | ${row.person?.full_name} | ${row.fir_count} FIRs: ${row.fir_ids.join(', ')}`);
		}
	}

	if (r.kind === 'trend' || r.kind === 'hotspot') {
		lines.push(`Total FIRs in scope: ${d.total}.`);
		lines.push('FIR count by month:');
		for (const s of d.series) lines.push(`- ${s.key}: ${s.count}`);
		lines.push('FIR count by taluk:');
		for (const a of d.hotspots) lines.push(`- ${a.taluk}: ${a.count} (${Math.round(a.share * 100)}%)`);
		if (d.movement) {
			lines.push(
				`Movement: ${d.movement.direction}. ${d.movement.recent_avg} FIRs/month over ${d.movement.recent_window} versus ${d.movement.prior_avg} over ${d.movement.prior_window} (${d.movement.change_pct}%).`
			);
		}
	}

	return lines.join('\n');
}

// ── deterministic answer (used when the LLM is unconfigured or fails) ──────────

function templateAnswer(r, parsed) {
	const d = r.data || {};
	const scope = [
		parsed.entities.crime_type,
		parsed.entities.taluk || parsed.entities.district,
		parsed.entities.date?.label,
	].filter(Boolean).join(', ');

	if (r.kind === 'firs') {
		const head = `Found ${d.total} FIR${d.total === 1 ? '' : 's'}${scope ? ` for ${scope}` : ''}. Showing the ${d.rows.length} most recent:`;
		return [head, ...d.rows.map((f) => `• ${f.fir_id} — ${f.crime_type}, ${f.taluk} (${f.occurrence_date}), ${f.status}`)].join('\n');
	}
	if (r.kind === 'similar') {
		// "shortlist", never "there are N such cases" — RAG returns its top matches, and
		// reporting that number as a total is exactly how it misled the console test.
		const head = d.seed
			? `Cases resembling ${d.seed.fir_id} (${d.seed.crime_type} — ${d.seed.modus_operandi}):`
			: 'Cases with a similar narrative:';
		return [
			head,
			...d.rows.map((f) => `• ${f.fir_id} — ${f.crime_type}, ${f.taluk} (${f.occurrence_date}), ${f.status}`),
			'',
			'This is a similarity shortlist, not a count of every such case.',
		].join('\n');
	}

	if (r.kind === 'fir') {
		const f = d.fir;
		const accused = d.parties.filter((p) => p.role === 'accused');
		return [
			`${f.fir_id} (${f.fir_number}) — ${f.crime_type} at ${f.taluk}, ${f.district} on ${f.occurrence_date}. Status: ${f.status}.`,
			`Modus operandi: ${f.modus_operandi}`,
			accused.length
				? `Accused: ${accused.map((p) => `${p.person?.full_name} (${p.person_id})`).join(', ')}`
				: 'No accused has been identified in this FIR.',
		].join('\n');
	}
	if (r.kind === 'network' || r.kind === 'profile') {
		const p = d.person;
		const out = [`${p.full_name} (${p.person_id}) is named in ${d.firs.length} FIR${d.firs.length === 1 ? '' : 's'}.`];
		if (d.co_accused.length) {
			out.push(`Co-accused: ${d.co_accused.slice(0, 5).map((c) => `${c.person?.full_name} (${c.person_id}, ${c.shared_firs.length} shared FIRs)`).join(', ')}`);
		}
		if (d.shared_links.length) {
			out.push(`Shared identifiers: ${d.shared_links.map((l) => `${l.person?.full_name} (${l.person_id}) shares ${l.type} ${l.value}`).join('; ')}`);
		}
		return out.join('\n');
	}
	if (r.kind === 'repeat_offender') {
		return [`Accused with the most FIRs${scope ? ` for ${scope}` : ''}:`, ...d.rows.map((x, i) => `${i + 1}. ${x.person?.full_name} (${x.person_id}) — ${x.fir_count} FIRs`)].join('\n');
	}
	// The chart and map are on screen beside these answers, so the text says what the
	// picture can't: the direction, the size of the change, and where it is concentrated.
	if (r.kind === 'trend') {
		const first = d.series[0], last = d.series[d.series.length - 1];
		const m = d.movement;
		const out = [`${d.total} FIRs${scope ? ` for ${scope}` : ''} between ${first.key} and ${last.key}.`];

		if (m && m.direction !== 'flat') {
			out.push(
				`The trend is ${m.direction}: ${m.recent_avg} FIRs/month over ${m.recent_window}, against ${m.prior_avg} over ${m.prior_window} (${m.change_pct > 0 ? '+' : ''}${m.change_pct}%).`
			);
		} else if (m) {
			out.push(`The trend is flat: ${m.recent_avg} FIRs/month, broadly unchanged from ${m.prior_avg}.`);
		}

		if (d.top_area) {
			out.push(`${d.top_area.taluk} accounts for ${Math.round(d.top_area.share * 100)}% of them (${d.top_area.count} FIRs).`);
		}
		return out.join('\n');
	}

	if (r.kind === 'hotspot') {
		const top = d.top_area;
		const out = [
			`${top.taluk} has the most FIRs${scope ? ` for ${scope}` : ''}: ${top.count} of ${d.total} (${Math.round(top.share * 100)}%).`,
		];
		const rest = d.hotspots.slice(1, 4);
		if (rest.length) out.push(`Next: ${rest.map((a) => `${a.taluk} (${a.count})`).join(', ')}.`);
		return out.join('\n');
	}
	return 'No answer could be composed.';
}

// ── grounded generation ───────────────────────────────────────────────────────

const SYSTEM = (lang) => `You are CIPHER, an assistant for the Karnataka State Police.

Rules you must follow exactly:
1. Answer ONLY from the RECORDS block given to you. It is your entire world.
2. Never state a fact that is not in the RECORDS. Do not use outside knowledge about crime, places, or people.
3. Cite the record id (FIR-xxxx or P-xxxx) in brackets after every fact you state.
4. Never invent a record id. Only use ids that appear in the RECORDS block.
5. If the RECORDS do not answer the question, say so plainly. Do not guess.
6. Be concise and factual. No speculation, no advice, no moralising.
7. Reply in ${lang === 'kn' ? 'Kannada' : 'English'}.`;

/** Ids the model cited that we never retrieved. Non-empty = it fabricated. */
const unsupportedIds = (text, evidence) => {
	const allowed = new Set(evidence.map((e) => String(e).toUpperCase()));
	const cited = [...new Set((text.match(ID_RE) || []).map((s) => s.toUpperCase()))];
	return cited.filter((id) => !allowed.has(id));
};

async function answer(question, context = {}) {
	const started = Date.now();
	const parsed = nlu.parse(question, context);

	let r;
	let ragNote = null;

	if (parsed.intent === 'SIMILAR_CASE' && rag.isConfigured()) {
		try {
			r = await retrieveSimilar(parsed.entities, question);
		} catch (err) {
			// RAG being down must not turn into a wrong answer; fall back to structured retrieval.
			ragNote = { failed: true, detail: String(err.message).slice(0, 120) };
			r = retrieve('RETRIEVE', parsed.entities);
		}
	} else {
		if (parsed.intent === 'SIMILAR_CASE') ragNote = { failed: true, detail: 'rag_not_configured' };
		r = retrieve(parsed.intent === 'SIMILAR_CASE' ? 'RETRIEVE' : parsed.intent, parsed.entities);
	}

	// (1) No records → abstain. This is a feature, not a failure.
	if (!r.records.length) {
		return {
			...parsed,
			abstained: true,
			answer: parsed.language === 'kn'
				? 'ಈ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸಲು ದಾಖಲೆಗಳಲ್ಲಿ ಯಾವುದೇ ಮಾಹಿತಿ ಇಲ್ಲ. ಲಭ್ಯವಿರುವ ದಾಖಲೆಗಳ ಆಧಾರದ ಮೇಲೆ ಉತ್ತರ ನೀಡಲಾಗುವುದಿಲ್ಲ.'
				: 'No records match that query, so I cannot answer it. I only answer from the FIR records available to me, and there are none for these criteria.',
			citations: [],
			evidence: [],
			source: 'abstain',
			latency_ms: Date.now() - started,
		};
	}

	const deterministic = templateAnswer(r, parsed);
	let text = deterministic;
	let source = 'template';
	let guardrail = null;

	if (llm.isConfigured()) {
		try {
			const prompt = `RECORDS:\n${contextBlock(r)}\n\nQUESTION: ${question}\n\nAnswer using only the RECORDS above, citing ids in brackets.`;
			const out = await llm.chat({ prompt, system: SYSTEM(parsed.language) });

			// (3) Verify before trusting.
			const bad = unsupportedIds(out.text, r.evidence);
			if (bad.length) {
				guardrail = { blocked: true, reason: 'unsupported_ids', ids: bad };
				source = 'template_after_guardrail';
			} else {
				text = out.text;
				source = 'llm';
			}
		} catch (err) {
			// A model failure must not become a wrong answer.
			guardrail = { blocked: true, reason: 'llm_error', detail: String(err.message).slice(0, 120) };
			source = 'template_after_llm_error';
		}
	}

	return {
		...parsed,
		abstained: false,
		answer: text,
		citations: [...new Set((text.match(ID_RE) || []).map((s) => s.toUpperCase()))],
		evidence: r.evidence,
		result_kind: r.kind,
		data: r.data,
		source,
		guardrail,
		rag: ragNote,
		latency_ms: Date.now() - started,
	};
}

module.exports = { answer, retrieve, contextBlock, templateAnswer, unsupportedIds };
