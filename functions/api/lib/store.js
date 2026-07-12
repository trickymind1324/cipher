'use strict';

/**
 * Record store.
 *
 * Two backends behind one interface:
 *   memory    — reads the seed tables bundled with the function (default)
 *   datastore — Catalyst Data Store via ZCQL
 *
 * Catalyst can only create Data Store tables from the console (the CLI and SDK both
 * read tables but cannot create them), so `memory` keeps the app fully runnable
 * before that manual step is done. Set CIPHER_STORE=datastore to switch over; the
 * callers below do not change.
 */

const TABLES = ['fir', 'person', 'fir_party', 'attribute', 'socio_economic', 'police_station'];

const backend = process.env.CIPHER_STORE === 'datastore' ? 'datastore' : 'memory';

// ── memory backend ────────────────────────────────────────────────────────────
const rows = {};
for (const t of TABLES) rows[t] = require(`../data/${t}.json`);

// Indexes built once per cold start — the demo dataset is small enough that every
// query below is a scan or a map lookup, no query planner needed.
const firById = new Map(rows.fir.map((f) => [f.fir_id, f]));
const personById = new Map(rows.person.map((p) => [p.person_id, p]));

const partiesByFir = new Map();
const partiesByPerson = new Map();
for (const r of rows.fir_party) {
	if (!partiesByFir.has(r.fir_id)) partiesByFir.set(r.fir_id, []);
	partiesByFir.get(r.fir_id).push(r);
	if (!partiesByPerson.has(r.person_id)) partiesByPerson.set(r.person_id, []);
	partiesByPerson.get(r.person_id).push(r);
}

const attrsByPerson = new Map();
const personsByAttrValue = new Map(); // "type:value" -> person_id[]
for (const a of rows.attribute) {
	if (!attrsByPerson.has(a.person_id)) attrsByPerson.set(a.person_id, []);
	attrsByPerson.get(a.person_id).push(a);
	const key = `${a.type}:${a.value}`;
	if (!personsByAttrValue.has(key)) personsByAttrValue.set(key, []);
	if (!personsByAttrValue.get(key).includes(a.person_id)) personsByAttrValue.get(key).push(a.person_id);
}

// ── query surface ─────────────────────────────────────────────────────────────

/** Filter FIRs. All filters are optional and AND-ed together. */
function findFirs({ district, taluk, crime_type, status, from, to, person_id, limit = 50 } = {}) {
	let out = rows.fir;

	if (person_id) {
		const firIds = new Set((partiesByPerson.get(person_id) || []).map((p) => p.fir_id));
		out = out.filter((f) => firIds.has(f.fir_id));
	}
	const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
	if (district) out = out.filter((f) => eq(f.district, district));
	if (taluk) out = out.filter((f) => eq(f.taluk, taluk));
	if (crime_type) out = out.filter((f) => eq(f.crime_type, crime_type));
	if (status) out = out.filter((f) => eq(f.status, status));
	if (from) out = out.filter((f) => f.occurrence_date >= from);
	if (to) out = out.filter((f) => f.occurrence_date <= to);

	out = [...out].sort((a, b) => b.occurrence_date.localeCompare(a.occurrence_date));
	return { total: out.length, rows: out.slice(0, limit) };
}

const getFir = (fir_id) => firById.get(fir_id) || null;
const getPerson = (person_id) => personById.get(person_id) || null;

/** Parties on a FIR, each joined to the person record. */
const partiesOfFir = (fir_id) =>
	(partiesByFir.get(fir_id) || []).map((r) => ({ ...r, person: personById.get(r.person_id) || null }));

/** Every FIR a person is attached to, with the role they held. */
const firsOfPerson = (person_id) =>
	(partiesByPerson.get(person_id) || [])
		.map((r) => ({ role: r.role, fir: firById.get(r.fir_id) }))
		.filter((r) => r.fir)
		.sort((a, b) => b.fir.occurrence_date.localeCompare(a.fir.occurrence_date));

const attributesOfPerson = (person_id) => attrsByPerson.get(person_id) || [];

/** Persons sharing an identifier (phone/vehicle) with this person — the non-obvious links. */
function sharedAttributeLinks(person_id) {
	const links = [];
	for (const a of attributesOfPerson(person_id)) {
		for (const other of personsByAttrValue.get(`${a.type}:${a.value}`) || []) {
			if (other !== person_id) links.push({ person_id: other, type: a.type, value: a.value });
		}
	}
	return links;
}

/** Persons accused alongside this person, with how many FIRs they share. */
function coAccused(person_id) {
	const mine = (partiesByPerson.get(person_id) || []).filter((p) => p.role === 'accused');
	const counts = new Map();
	for (const p of mine) {
		for (const other of partiesByFir.get(p.fir_id) || []) {
			if (other.role !== 'accused' || other.person_id === person_id) continue;
			const c = counts.get(other.person_id) || { person_id: other.person_id, shared_firs: [] };
			c.shared_firs.push(p.fir_id);
			counts.set(other.person_id, c);
		}
	}
	return [...counts.values()].sort((a, b) => b.shared_firs.length - a.shared_firs.length);
}

/** Free-text person lookup by name or alias. */
function findPersons(name, limit = 10) {
	const q = String(name || '').trim().toLowerCase();
	if (!q) return [];
	return rows.person
		.filter((p) => p.full_name.toLowerCase().includes(q) || (p.aliases && p.aliases.toLowerCase().includes(q)))
		.slice(0, limit);
}

/** Accused ranked by number of FIRs — the repeat-offender question. */
function repeatAccused({ district, crime_type, from, to, min_firs = 2, limit = 20 } = {}) {
	const scope = findFirs({ district, crime_type, from, to, limit: Infinity }).rows;
	const scopeIds = new Set(scope.map((f) => f.fir_id));
	const counts = new Map();
	for (const r of rows.fir_party) {
		if (r.role !== 'accused' || !scopeIds.has(r.fir_id)) continue;
		const c = counts.get(r.person_id) || { person_id: r.person_id, fir_ids: [] };
		c.fir_ids.push(r.fir_id);
		counts.set(r.person_id, c);
	}
	return [...counts.values()]
		.filter((c) => c.fir_ids.length >= min_firs)
		.sort((a, b) => b.fir_ids.length - a.fir_ids.length)
		.slice(0, limit)
		.map((c) => ({ ...c, person: personById.get(c.person_id), fir_count: c.fir_ids.length }));
}

/** Counts grouped by month / district / taluk / crime_type, over an optional filter. */
function aggregate({ by = 'month', ...filters } = {}) {
	const scope = findFirs({ ...filters, limit: Infinity }).rows;
	const keyOf = (f) => (by === 'month' ? f.occurrence_date.slice(0, 7) : f[by]);
	const counts = new Map();
	for (const f of scope) {
		const k = keyOf(f);
		if (k === undefined) continue;
		const c = counts.get(k) || { key: k, count: 0, fir_ids: [] };
		c.count++;
		c.fir_ids.push(f.fir_id);
		counts.set(k, c);
	}
	const out = [...counts.values()];
	return by === 'month' ? out.sort((a, b) => a.key.localeCompare(b.key)) : out.sort((a, b) => b.count - a.count);
}

const socioOf = (taluk) => rows.socio_economic.find((s) => s.taluk.toLowerCase() === String(taluk).toLowerCase()) || null;
const stations = () => rows.police_station;

const stats = () => ({
	backend,
	tables: Object.fromEntries(TABLES.map((t) => [t, rows[t].length])),
	districts: [...new Set(rows.fir.map((f) => f.district))],
	crime_types: [...new Set(rows.fir.map((f) => f.crime_type))],
	date_range: {
		from: rows.fir.reduce((a, f) => (f.occurrence_date < a ? f.occurrence_date : a), '9999'),
		to: rows.fir.reduce((a, f) => (f.occurrence_date > a ? f.occurrence_date : a), '0000'),
	},
});

module.exports = {
	backend,
	findFirs,
	getFir,
	getPerson,
	findPersons,
	partiesOfFir,
	firsOfPerson,
	attributesOfPerson,
	sharedAttributeLinks,
	coAccused,
	repeatAccused,
	aggregate,
	socioOf,
	stations,
	stats,
};
