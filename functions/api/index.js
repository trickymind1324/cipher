'use strict';

const express = require('express');

const app = express();

app.use(express.json({ limit: '1mb' }));

// Every route below is reached at /server/api/<path> once deployed.
app.get('/health', (req, res) => {
	res.json({ status: 'ok', service: 'cipher-api', version: '0.1.0' });
});

const notBuiltYet = (phase) => (req, res) =>
	res.status(501).json({ error: 'not_implemented', phase });

app.post('/seed', notBuiltYet('P1'));
app.post('/query', notBuiltYet('P2'));
app.get('/network', notBuiltYet('P4'));
app.get('/trends', notBuiltYet('P5'));
app.post('/export-pdf', notBuiltYet('P6'));

app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));

module.exports = app;
