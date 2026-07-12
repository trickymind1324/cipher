'use strict';

const express = require('express');
const store = require('./lib/store');

const app = express();

app.use(express.json({ limit: '1mb' }));

// Every route below is reached at /server/api/<path> once deployed.

app.get('/health', (req, res) => {
	res.json({ status: 'ok', service: 'cipher-api', version: '0.1.0', store: store.backend });
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

const notBuiltYet = (phase) => (req, res) =>
	res.status(501).json({ error: 'not_implemented', phase });

app.post('/query', notBuiltYet('P2'));
app.get('/network', notBuiltYet('P4'));
app.get('/trends', notBuiltYet('P5'));
app.post('/export-pdf', notBuiltYet('P6'));

app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));

module.exports = app;
