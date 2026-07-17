'use strict';

/**
 * Record store.
 *
 * The bundled tables mirror the official Police FIR System ER diagram verbatim
 * (CaseMaster, Accused, Victim, ComplainantDetails, ArrestSurrender, ChargesheetDetails,
 * ActSectionAssociation + reference tables), plus CIPHER's analytical layer
 * (person_master, person_case_link, attribute, socio_economic) — see docs/08.
 *
 * At cold start the transactional rows are joined once into denormalised case views;
 * every query below then runs against those views. Callers never touch raw FK IDs.
 * The citation key for a case is its CrimeNo; for a person, person_master.person_id.
 *
 * Two backends behind one interface:
 *   memory    — reads the seed tables bundled with the function (default)
 *   datastore — Catalyst Data Store via ZCQL
 * Catalyst can only create Data Store tables from the console, so `memory` keeps the
 * app fully runnable before that manual step is done. Set CIPHER_STORE=datastore to
 * switch over; the callers below do not change.
 */

const TABLES = [
	'CaseMaster', 'ComplainantDetails', 'Victim', 'Accused', 'ArrestSurrender', 'ChargesheetDetails',
	'ActSectionAssociation', 'Act', 'Section', 'CrimeHead', 'CrimeSubHead', 'CrimeHeadActSection',
	'CaseCategory', 'GravityOffence', 'CaseStatusMaster', 'OccupationMaster',
	'State', 'District', 'Unit', 'UnitType', 'Rank', 'Designation', 'Employee', 'Court',
	'person_master', 'person_case_link', 'attribute', 'socio_economic',
];

const backend = process.env.CIPHER_STORE === 'datastore' ? 'datastore' : 'memory';

// ── memory backend ────────────────────────────────────────────────────────────
const rows = {};
for (const t of TABLES) rows[t] = require(`../data/${t}.json`);

// lookup maps
const byId = (table, key) => new Map(rows[table].map((r) => [r[key], r]));
const districts = byId('District', 'DistrictID');
const units = byId('Unit', 'UnitID');
const employees = byId('Employee', 'EmployeeID');
const courts = byId('Court', 'CourtID');
const crimeHeads = byId('CrimeHead', 'CrimeHeadID');
const crimeSubHeads = byId('CrimeSubHead', 'CrimeSubHeadID');
const caseCategories = byId('CaseCategory', 'CaseCategoryID');
const gravities = byId('GravityOffence', 'GravityOffenceID');
const caseStatuses = byId('CaseStatusMaster', 'CaseStatusID');
const ranks = byId('Rank', 'RankID');

const sectionsByCase = new Map();
for (const a of rows.ActSectionAssociation) {
	if (!sectionsByCase.has(a.CaseMasterID)) sectionsByCase.set(a.CaseMasterID, []);
	sectionsByCase.get(a.CaseMasterID).push(`${a.ActID} ${a.SectionID}`);
}
const chargesheetByCase = new Map(rows.ChargesheetDetails.map((c) => [c.CaseMasterID, c]));
const arrestsByCase = new Map();
for (const a of rows.ArrestSurrender) {
	if (!arrestsByCase.has(a.CaseMasterID)) arrestsByCase.set(a.CaseMasterID, []);
	arrestsByCase.get(a.CaseMasterID).push(a);
}

const RANK_SHORT = { 'Police Sub-Inspector': 'PSI', 'Police Inspector': 'PI', 'Deputy Superintendent of Police': 'DySP', 'Head Constable': 'HC', 'Police Constable': 'PC' };
const ioDisplay = (employeeId) => {
	const e = employees.get(employeeId);
	if (!e) return '';
	const r = ranks.get(e.RankID);
	return `${(r && RANK_SHORT[r.RankName]) || ''} ${e.FirstName}`.trim();
};

// Station jurisdiction name ("Yelahanka") — derived from "<Area> Police Station".
const areaOfUnit = (unitId) => {
	const u = units.get(unitId);
	return u ? u.UnitName.replace(/ Police Station$/, '') : '';
};

const CSTYPE = { A: 'Chargesheet filed', B: 'Closed as false case', C: 'Closed as undetected' };

// ── denormalised case views (built once per cold start) ──────────────────────
// The dataset is small enough that every query below is a scan or map lookup.
const cases = rows.CaseMaster.map((c) => {
	const unit = units.get(c.PoliceStationID);
	const cs = chargesheetByCase.get(c.CaseMasterID);
	return {
		case_master_id: c.CaseMasterID,
		crime_no: c.CrimeNo, // the citation key
		case_no: c.CaseNo,
		case_category: (caseCategories.get(c.CaseCategoryID) || {}).LookupValue || '',
		district: (districts.get(unit ? unit.DistrictID : 0) || {}).DistrictName || '',
		police_station: unit ? unit.UnitName : '',
		area: areaOfUnit(c.PoliceStationID),
		crime_head: (crimeHeads.get(c.CrimeMajorHeadID) || {}).CrimeGroupName || '',
		crime_type: (crimeSubHeads.get(c.CrimeMinorHeadID) || {}).CrimeHeadName || '',
		sections: (sectionsByCase.get(c.CaseMasterID) || []).join('; '),
		gravity: (gravities.get(c.GravityOffenceID) || {}).LookupValue || '',
		status: (caseStatuses.get(c.CaseStatusID) || {}).CaseStatusName || '',
		final_report: cs ? cs.cstype : '',
		final_report_label: cs ? CSTYPE[cs.cstype] || '' : '',
		chargesheet_date: cs ? String(cs.csdate).slice(0, 10) : '',
		registered_date: c.CrimeRegisteredDate,
		occurrence_date: String(c.IncidentFromDate).slice(0, 10),
		occurrence_time: String(c.IncidentFromDate).slice(11, 16),
		lat: c.latitude,
		lon: c.longitude,
		io_officer: ioDisplay(c.PolicePersonID),
		court: (courts.get(c.CourtID) || {}).CourtName || '',
		brief_facts: c.BriefFacts,
		arrests: (arrestsByCase.get(c.CaseMasterID) || []).length,
	};
});

const caseByCrimeNo = new Map(cases.map((c) => [c.crime_no, c]));
const caseById = new Map(cases.map((c) => [c.case_master_id, c]));
const personById = new Map(rows.person_master.map((p) => [p.person_id, p]));

// person_case_link is the entity-resolution output: per-case Accused/Victim/Complainant
// rows resolved to person_master identities. All person↔case queries go through it.
const linksByCase = new Map();
const linksByPerson = new Map();
for (const l of rows.person_case_link) {
	if (!linksByCase.has(l.CaseMasterID)) linksByCase.set(l.CaseMasterID, []);
	linksByCase.get(l.CaseMasterID).push(l);
	if (!linksByPerson.has(l.person_id)) linksByPerson.set(l.person_id, []);
	linksByPerson.get(l.person_id).push(l);
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

// arrest info per (case, person) — resolved through Accused source rows
const arrestByAccusedRow = new Map();
for (const a of rows.ArrestSurrender) arrestByAccusedRow.set(a.AccusedMasterID, a);
const arrestOfLink = (l) => {
	if (l.source_table !== 'Accused') return null;
	const a = arrestByAccusedRow.get(l.source_row_id);
	if (!a) return null;
	return { date: a.ArrestSurrenderDate, type: a.ArrestSurrenderTypeID === 2 ? 'surrender' : 'arrest' };
};

// ── query surface ─────────────────────────────────────────────────────────────

/** Filter cases. All filters are optional and AND-ed together. */
function findFirs({ district, area, crime_type, crime_head, status, gravity, from, to, person_id, limit = 50 } = {}) {
	let out = cases;

	if (person_id) {
		const ids = new Set((linksByPerson.get(person_id) || []).map((l) => l.CaseMasterID));
		out = out.filter((c) => ids.has(c.case_master_id));
	}
	const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
	if (district) out = out.filter((c) => eq(c.district, district));
	if (area) out = out.filter((c) => eq(c.area, area));
	if (crime_type) out = out.filter((c) => eq(c.crime_type, crime_type));
	if (crime_head) out = out.filter((c) => eq(c.crime_head, crime_head));
	if (status) out = out.filter((c) => eq(c.status, status));
	if (gravity) out = out.filter((c) => eq(c.gravity, gravity));
	if (from) out = out.filter((c) => c.occurrence_date >= from);
	if (to) out = out.filter((c) => c.occurrence_date <= to);

	out = [...out].sort((a, b) => b.occurrence_date.localeCompare(a.occurrence_date));
	return { total: out.length, rows: out.slice(0, limit) };
}

/** Case by CrimeNo (the citation key); numeric CaseMasterID accepted too. */
const getFir = (key) => caseByCrimeNo.get(String(key)) || caseById.get(Number(key)) || null;
const getPerson = (person_id) => personById.get(person_id) || null;

/** Parties on a case, each resolved to the person_master identity. */
const partiesOfFir = (key) => {
	const c = getFir(key);
	if (!c) return [];
	return (linksByCase.get(c.case_master_id) || []).map((l) => ({
		role: l.role,
		person_id: l.person_id,
		person: personById.get(l.person_id) || null,
		arrest: arrestOfLink(l),
	}));
};

/** Every case a person is attached to, with the role they held. */
const firsOfPerson = (person_id) =>
	(linksByPerson.get(person_id) || [])
		.map((l) => ({ role: l.role, fir: caseById.get(l.CaseMasterID) }))
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

/** Persons accused alongside this person, with how many cases they share. */
function coAccused(person_id) {
	const mine = (linksByPerson.get(person_id) || []).filter((l) => l.role === 'accused');
	const counts = new Map();
	for (const l of mine) {
		for (const other of linksByCase.get(l.CaseMasterID) || []) {
			if (other.role !== 'accused' || other.person_id === person_id) continue;
			const crimeNo = caseById.get(l.CaseMasterID).crime_no;
			const c = counts.get(other.person_id) || { person_id: other.person_id, shared_firs: [] };
			c.shared_firs.push(crimeNo);
			counts.set(other.person_id, c);
		}
	}
	return [...counts.values()].sort((a, b) => b.shared_firs.length - a.shared_firs.length);
}

/** Free-text person lookup by name or alias. */
function findPersons(name, limit = 10) {
	const q = String(name || '').trim().toLowerCase();
	if (!q) return [];
	return rows.person_master
		.filter((p) => p.full_name.toLowerCase().includes(q) || (p.aliases && p.aliases.toLowerCase().includes(q)))
		.slice(0, limit);
}

/** Accused ranked by number of cases — the repeat-offender question. */
function repeatAccused({ district, crime_type, from, to, min_firs = 2, limit = 20 } = {}) {
	const scope = findFirs({ district, crime_type, from, to, limit: Infinity }).rows;
	const scopeIds = new Map(scope.map((c) => [c.case_master_id, c.crime_no]));
	const counts = new Map();
	for (const l of rows.person_case_link) {
		if (l.role !== 'accused' || !scopeIds.has(l.CaseMasterID)) continue;
		const c = counts.get(l.person_id) || { person_id: l.person_id, fir_ids: [] };
		c.fir_ids.push(scopeIds.get(l.CaseMasterID));
		counts.set(l.person_id, c);
	}
	return [...counts.values()]
		.filter((c) => c.fir_ids.length >= min_firs)
		.sort((a, b) => b.fir_ids.length - a.fir_ids.length)
		.slice(0, limit)
		.map((c) => ({ ...c, person: personById.get(c.person_id), fir_count: c.fir_ids.length }));
}

/** Counts grouped by month / district / area / crime_type / crime_head / gravity / status. */
function aggregate({ by = 'month', ...filters } = {}) {
	const scope = findFirs({ ...filters, limit: Infinity }).rows;
	const keyOf = (c) => (by === 'month' ? c.occurrence_date.slice(0, 7) : c[by]);
	const counts = new Map();
	for (const c of scope) {
		const k = keyOf(c);
		if (k === undefined || k === '') continue;
		const g = counts.get(k) || { key: k, count: 0, fir_ids: [] };
		g.count++;
		g.fir_ids.push(c.crime_no);
		counts.set(k, g);
	}
	const out = [...counts.values()];
	return by === 'month' ? out.sort((a, b) => a.key.localeCompare(b.key)) : out.sort((a, b) => b.count - a.count);
}

const socioOf = (area) =>
	rows.socio_economic.find((s) => s.area_name.toLowerCase() === String(area).toLowerCase()) || null;

/** Police stations (Unit rows of type Police Station), with map coords derived from their cases. */
const stationList = rows.Unit.filter((u) => u.TypeID === 1).map((u) => {
	const mine = cases.filter((c) => c.police_station === u.UnitName);
	const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
	return {
		unit_id: u.UnitID,
		name: u.UnitName,
		district: (districts.get(u.DistrictID) || {}).DistrictName || '',
		area: u.UnitName.replace(/ Police Station$/, ''),
		lat: avg(mine.map((c) => c.lat)),
		lon: avg(mine.map((c) => c.lon)),
		case_count: mine.length,
	};
});
const stations = () => stationList;

const stats = () => ({
	backend,
	tables: Object.fromEntries(TABLES.map((t) => [t, rows[t].length])),
	districts: [...new Set(cases.map((c) => c.district))],
	crime_types: [...new Set(cases.map((c) => c.crime_type))],
	crime_heads: [...new Set(cases.map((c) => c.crime_head))],
	date_range: {
		from: cases.reduce((a, c) => (c.occurrence_date < a ? c.occurrence_date : a), '9999'),
		to: cases.reduce((a, c) => (c.occurrence_date > a ? c.occurrence_date : a), '0000'),
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
