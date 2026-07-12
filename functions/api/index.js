'use strict';

const express = require('express');
const store = require('./lib/store');
const pipeline = require('./lib/pipeline');
const network = require('./lib/network');
const trends = require('./lib/trends');
const audit = require('./lib/audit');
const llm = require('./lib/llm');

const app = express();

app.use(express.json({ limit: '1mb' }));

// Every route below is reached at /server/api/<path> once deployed.

app.get('/health', (req, res) => {
	res.json({
		status: 'ok',
		service: 'cipher-api',
		version: '0.2.0',
		store: store.backend,
		llm: llm.isConfigured() ? 'quickml' : 'not_configured',
	});
});

/** Dataset shape — what the assistant is allowed to claim knowledge of. */
app.get('/stats', (req, res) => res.json(store.stats()));

/** Structured record retrieval. The conversational layer (P2) is built on top of this. */
app.get('/firs', (req, res) => {
	const { district, taluk, crime_type, status, from, to, person_id } = req.query;
	const limit = Math.min(Number(req.query.limit) || 20, 200);
	res.json(store.findFirs({ district, taluk, crime_type, status, from, to, person_id, limit }));
});

app.get('/firs/:fir_id', (req, res) => {
	const fir = store.getFir(req.params.fir_id);
	if (!fir) return res.status(404).json({ error: 'not_found', fir_id: req.params.fir_id });
	res.json({ ...fir, parties: store.partiesOfFir(fir.fir_id) });
});

app.get('/persons', (req, res) => res.json(store.findPersons(req.query.name)));

app.get('/persons/:person_id', (req, res) => {
	const person = store.getPerson(req.params.person_id);
	if (!person) return res.status(404).json({ error: 'not_found', person_id: req.params.person_id });
	res.json({
		...person,
		attributes: store.attributesOfPerson(person.person_id),
		firs: store.firsOfPerson(person.person_id),
		co_accused: store.coAccused(person.person_id),
		shared_attribute_links: store.sharedAttributeLinks(person.person_id),
	});
});

app.get('/repeat-accused', (req, res) => {
	const { district, crime_type, from, to } = req.query;
	const min_firs = Number(req.query.min_firs) || 2;
	res.json(store.repeatAccused({ district, crime_type, from, to, min_firs }));
});

app.get('/aggregate', (req, res) => {
	const { by, district, taluk, crime_type, from, to } = req.query;
	res.json(store.aggregate({ by: by || 'month', district, taluk, crime_type, from, to }));
});

app.get('/stations', (req, res) => res.json(store.stations()));

/**
 * The conversational core. Body: { question, context?, user?, role? }
 * `context` is the previous turn's entities — send it back to get follow-ups.
 */
app.post('/query', async (req, res) => {
	const { question, context, user, role } = req.body || {};
	if (!question || !String(question).trim()) {
		return res.status(400).json({ error: 'question_required' });
	}

	try {
		const result = await pipeline.answer(String(question), context || {});
		audit.record({ user, role, question, result, ip: req.ip });

		res.json({
			answer: result.answer,
			abstained: result.abstained,
			citations: result.citations,
			intent: result.intent,
			language: result.language,
			entities: result.entities,
			carried_over: result.carried_over,
			result_kind: result.result_kind,
			data: result.data,
			// Surfaced, not hidden: the UI shows how the answer was produced.
			provenance: {
				source: result.source,
				guardrail: result.guardrail,
				records_retrieved: result.evidence.length,
				latency_ms: result.latency_ms,
			},
			// Echo back so the client can send it as `context` on the next turn.
			context: result.entities,
		});
	} catch (err) {
		res.status(500).json({ error: 'query_failed', detail: String(err.message).slice(0, 200) });
	}
});

app.get('/audit', (req, res) => res.json(audit.recent(Number(req.query.limit) || 50)));

/** Criminal-network graph around a person. ?person_id=P-0070&depth=2 */
app.get('/network', (req, res) => {
	const { person_id, name, depth } = req.query;

	let id = person_id;
	if (!id && name) {
		const hits = store.findPersons(name, 2);
		if (hits.length !== 1) {
			return res.status(hits.length ? 409 : 404).json({
				error: hits.length ? 'ambiguous_person' : 'person_not_found',
				candidates: hits.map((p) => ({ person_id: p.person_id, full_name: p.full_name })),
			});
		}
		id = hits[0].person_id;
	}
	if (!id) return res.status(400).json({ error: 'person_id_or_name_required' });

	const graph = network.build(id, depth);
	if (!graph) return res.status(404).json({ error: 'person_not_found', person_id: id });
	res.json(graph);
});

/** Trends + hotspots. ?district=&taluk=&crime_type=&from=&to= (all optional) */
app.get('/trends', (req, res) => {
	const { district, taluk, crime_type, from, to } = req.query;
	res.json(trends.build({ district, taluk, crime_type, from, to }));
});

const notBuiltYet = (phase) => (req, res) =>
	res.status(501).json({ error: 'not_implemented', phase });
app.get('/trends', notBuiltYet('P5'));
app.post('/export-pdf', notBuiltYet('P6'));

app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));

module.exports = app;
