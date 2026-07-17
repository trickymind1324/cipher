/**
 * CIPHER — synthetic seed generator, aligned to the official Police FIR System ER diagram.
 *
 * ALL DATA IS SYNTHETIC. No real police record, person, phone, or vehicle is used.
 * Names, numbers and narratives are generated; any resemblance to a real record is coincidental.
 *
 * Two layers (see docs/08_DataStore_Schema.md):
 *   Layer 1 — transactional tables mirroring Police_FIR_ER_Diagram.pdf verbatim
 *             (CaseMaster, Accused, Victim, ComplainantDetails, ArrestSurrender,
 *              ChargesheetDetails, ActSectionAssociation + law/lookup/org reference tables)
 *   Layer 2 — CIPHER analytical layer (person_master, person_case_link, attribute,
 *             socio_economic) — the entity-resolution output the official schema lacks.
 *
 * Emits, into data/seed/:
 *   *.json / *.csv          one pair per Data Store table
 *   narratives/<CrimeNo>.txt one narrative doc per case, for the QuickML RAG Knowledge Base
 *                            (1 doc = 1 case so RAG citations resolve to a single CrimeNo)
 *
 * Deterministic: same SEED always yields the same dataset.
 *
 *   node data/generate_seed.mjs
 */

import { writeFileSync, mkdirSync, rmSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, 'seed');
// The function bundles its own copy of the tables so it can serve them without a
// Data Store round-trip. Generated here (not copied by hand) so the two never drift.
const FN_DATA = join(HERE, '..', 'functions', 'api', 'data');
const SEED = 20260717;

// ── deterministic PRNG (mulberry32) ────────────────────────────────────────────
let _s = SEED;
const rnd = () => {
	_s |= 0;
	_s = (_s + 0x6d2b79f5) | 0;
	let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (xs) => xs[int(0, xs.length - 1)];
const pickMany = (xs, n) => {
	const pool = [...xs];
	const out = [];
	while (out.length < n && pool.length) out.push(...pool.splice(int(0, pool.length - 1), 1));
	return out;
};
const chance = (p) => rnd() < p;

const pad = (n, w) => String(n).padStart(w, '0');
const iso = (d) => d.toISOString().slice(0, 10);
const dt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

// ── geography (real Karnataka districts; stations & IDs are invented) ──────────
// District IDs are synthetic but format-true 4-digit codes used inside CrimeNo.
const KARNATAKA = 1; // StateID
const STATES = [
	{ StateID: 1, StateName: 'Karnataka', Active: 1 },
	{ StateID: 2, StateName: 'Maharashtra', Active: 1 },
	{ StateID: 3, StateName: 'Telangana', Active: 1 },
];

const DISTRICTS = [
	{
		DistrictID: 443,
		district: 'Bengaluru North',
		urbanization: 'urban',
		areas: [
			{ area: 'Yelahanka', lat: 13.1007, lon: 77.5963 },
			{ area: 'Hebbal', lat: 13.0358, lon: 77.597 },
			{ area: 'Peenya', lat: 13.0287, lon: 77.5178 },
			{ area: 'RT Nagar', lat: 13.0207, lon: 77.5945 },
		],
	},
	{
		DistrictID: 450,
		district: 'Mysuru',
		urbanization: 'semi-urban',
		areas: [
			{ area: 'Krishnaraja', lat: 12.3052, lon: 76.6552 },
			{ area: 'Nanjangud', lat: 12.1173, lon: 76.6838 },
			{ area: 'Hunsur', lat: 12.304, lon: 76.293 },
		],
	},
	{
		DistrictID: 430,
		district: 'Kalaburagi',
		urbanization: 'rural',
		areas: [
			{ area: 'Kalaburagi City', lat: 17.3297, lon: 76.8343 },
			{ area: 'Aland', lat: 17.5645, lon: 76.568 },
			{ area: 'Chittapur', lat: 17.1204, lon: 77.0836 },
		],
	},
];
const districtName = (id) => DISTRICTS.find((d) => d.DistrictID === id).district;

// ── law classification (ER: Act / Section / CrimeHead / CrimeSubHead) ──────────
const Act = [
	{ ActCode: 'IPC', ActDescription: 'Indian Penal Code, 1860', ShortName: 'IPC', Active: 1 },
	{ ActCode: 'NDPS', ActDescription: 'Narcotic Drugs and Psychotropic Substances Act, 1985', ShortName: 'NDPS Act', Active: 1 },
	{ ActCode: 'ITACT', ActDescription: 'Information Technology Act, 2000', ShortName: 'IT Act', Active: 1 },
];

const Section = [
	{ ActCode: 'IPC', SectionCode: '379', SectionDescription: 'Punishment for theft', Active: 1 },
	{ ActCode: 'IPC', SectionCode: '356', SectionDescription: 'Assault or criminal force in attempt to commit theft', Active: 1 },
	{ ActCode: 'IPC', SectionCode: '454', SectionDescription: 'Lurking house-trespass or house-breaking to commit offence', Active: 1 },
	{ ActCode: 'IPC', SectionCode: '457', SectionDescription: 'Lurking house-trespass or house-breaking by night', Active: 1 },
	{ ActCode: 'IPC', SectionCode: '380', SectionDescription: 'Theft in dwelling house', Active: 1 },
	{ ActCode: 'IPC', SectionCode: '420', SectionDescription: 'Cheating and dishonestly inducing delivery of property', Active: 1 },
	{ ActCode: 'IPC', SectionCode: '392', SectionDescription: 'Punishment for robbery', Active: 1 },
	{ ActCode: 'IPC', SectionCode: '397', SectionDescription: 'Robbery with attempt to cause death or grievous hurt', Active: 1 },
	{ ActCode: 'IPC', SectionCode: '323', SectionDescription: 'Punishment for voluntarily causing hurt', Active: 1 },
	{ ActCode: 'IPC', SectionCode: '324', SectionDescription: 'Voluntarily causing hurt by dangerous weapons', Active: 1 },
	{ ActCode: 'NDPS', SectionCode: '20', SectionDescription: 'Contravention in relation to cannabis', Active: 1 },
	{ ActCode: 'NDPS', SectionCode: '22', SectionDescription: 'Contravention in relation to psychotropic substances', Active: 1 },
	{ ActCode: 'ITACT', SectionCode: '66D', SectionDescription: 'Cheating by personation using computer resource', Active: 1 },
];

const CrimeHead = [
	{ CrimeHeadID: 1, CrimeGroupName: 'Crimes Against Property', Active: 1 },
	{ CrimeHeadID: 2, CrimeGroupName: 'Crimes Against Body', Active: 1 },
	{ CrimeHeadID: 3, CrimeGroupName: 'Economic Offences', Active: 1 },
	{ CrimeHeadID: 4, CrimeGroupName: 'Narcotic Offences', Active: 1 },
];

// CrimeSubHead.CrimeHeadName is the column name in the ER diagram (it holds the sub-head label).
// `sections`, `gravity`, `mo`, `weight` are generator-internal, stripped before write.
const SUBHEADS = [
	{
		CrimeSubHeadID: 1, CrimeHeadID: 1, CrimeHeadName: 'Chain Snatching', SeqID: 1,
		sections: [['IPC', '379'], ['IPC', '356']], gravity: 2,
		mo: [
			'two-wheeler borne suspects snatched the gold chain and fled towards the ring road',
			'pillion rider snatched the mangalsutra while the complainant was walking on the footpath',
			'suspects on a motorcycle without a number plate snatched the chain near a bus stop',
		],
	},
	{
		CrimeSubHeadID: 2, CrimeHeadID: 1, CrimeHeadName: 'House Burglary', SeqID: 2,
		sections: [['IPC', '454'], ['IPC', '457'], ['IPC', '380']], gravity: 2,
		mo: [
			'the lock of the main door was broken open while the house was locked and the family was away',
			'entry was gained through an unsecured rear window and the almirah was ransacked',
			'the grill of the ventilator was cut and gold ornaments and cash were taken',
		],
	},
	{
		CrimeSubHeadID: 3, CrimeHeadID: 1, CrimeHeadName: 'Vehicle Theft', SeqID: 3,
		sections: [['IPC', '379']], gravity: 2,
		mo: [
			'the motorcycle parked outside the residence was stolen during the night',
			'the vehicle was taken from an unattended parking lot after the steering lock was broken',
			'the two-wheeler was stolen from outside a commercial complex in broad daylight',
		],
	},
	{
		CrimeSubHeadID: 4, CrimeHeadID: 1, CrimeHeadName: 'Robbery', SeqID: 4,
		sections: [['IPC', '392'], ['IPC', '397']], gravity: 1,
		mo: [
			'the suspects threatened the complainant with a knife and took cash and a mobile phone',
			'an armed group waylaid the complainant on a deserted stretch and robbed the collection amount',
		],
	},
	{
		CrimeSubHeadID: 5, CrimeHeadID: 2, CrimeHeadName: 'Assault / Hurt', SeqID: 1,
		sections: [['IPC', '323'], ['IPC', '324']], gravity: 2,
		mo: [
			'a quarrel over a parking dispute escalated and the complainant was assaulted',
			'the accused caused hurt with a wooden club following a prior enmity',
		],
	},
	{
		CrimeSubHeadID: 6, CrimeHeadID: 3, CrimeHeadName: 'Cheating / Online Fraud', SeqID: 1,
		sections: [['IPC', '420'], ['ITACT', '66D']], gravity: 2,
		mo: [
			'the complainant was induced to transfer money on the promise of a part-time job',
			'the suspect posed as a bank official and obtained the OTP over a phone call',
			'payment was collected for goods advertised online which were never delivered',
		],
	},
	{
		// NOTE: Kalaburagi is deliberately given NO narcotics cases — that gap is what the
		// abstain path (FR-CONV-10) is demonstrated against. Do not "fix" it by adding data.
		CrimeSubHeadID: 7, CrimeHeadID: 4, CrimeHeadName: 'Narcotics Possession', SeqID: 1,
		sections: [['NDPS', '20'], ['NDPS', '22']], gravity: 1,
		mo: [
			'the accused was found in possession of contraband during a vehicle check at a checkpost',
			'a tip-off led to the seizure of contraband from a rented room',
		],
	},
];

const CrimeHeadActSection = SUBHEADS.flatMap((s) =>
	s.sections.map(([act, sec]) => ({ CrimeHeadID: s.CrimeHeadID, ActCode: act, SectionCode: sec })),
);

// ── lookups (ER-verbatim) ──────────────────────────────────────────────────────
const CaseCategory = [
	{ CaseCategoryID: 1, LookupValue: 'FIR' },
	{ CaseCategoryID: 3, LookupValue: 'UDR' },
	{ CaseCategoryID: 4, LookupValue: 'PAR' },
	{ CaseCategoryID: 8, LookupValue: 'Zero FIR' },
];
const GravityOffence = [
	{ GravityOffenceID: 1, LookupValue: 'Heinous' },
	{ GravityOffenceID: 2, LookupValue: 'Non-Heinous' },
];
const CaseStatusMaster = [
	{ CaseStatusID: 1, CaseStatusName: 'Under Investigation' },
	{ CaseStatusID: 2, CaseStatusName: 'Charge Sheeted' },
	{ CaseStatusID: 3, CaseStatusName: 'Closed' },
];
const OCC_NAMES = ['Daily Wage Labourer', 'Auto Driver', 'Mechanic', 'Shop Assistant', 'Unemployed', 'Street Vendor', 'Construction Worker', 'Private Security Guard', 'Delivery Rider', 'Farm Labourer', 'Homemaker', 'Student', 'Government Employee', 'Private Employee', 'Small Business Owner'];
const OccupationMaster = OCC_NAMES.map((OccupationName, i) => ({ OccupationID: i + 1, OccupationName }));
const occId = (name) => OccupationMaster.find((o) => o.OccupationName === name).OccupationID;

// GenderID is an inline lookup per the ER diagram (no master table): 1=M, 2=F, 3=T.
const GENDER = { M: 1, F: 2, T: 3 };
const genderLetter = (id) => (id === 1 ? 'M' : id === 2 ? 'F' : 'T');

// ── org structure (Unit / UnitType / Rank / Designation / Employee / Court) ────
const UnitType = [
	{ UnitTypeID: 1, UnitTypeName: 'Police Station', CityDistState: 'City', Hierarchy: 3, Active: 1 },
	{ UnitTypeID: 2, UnitTypeName: 'District Office', CityDistState: 'District', Hierarchy: 2, Active: 1 },
];
const Rank = [
	{ RankID: 1, RankName: 'Police Constable', Hierarchy: 5, Active: 1 },
	{ RankID: 2, RankName: 'Head Constable', Hierarchy: 4, Active: 1 },
	{ RankID: 3, RankName: 'Police Sub-Inspector', Hierarchy: 3, Active: 1 },
	{ RankID: 4, RankName: 'Police Inspector', Hierarchy: 2, Active: 1 },
	{ RankID: 5, RankName: 'Deputy Superintendent of Police', Hierarchy: 1, Active: 1 },
];
const Designation = [
	{ DesignationID: 1, DesignationName: 'Investigating Officer', Active: 1, SortOrder: 1 },
	{ DesignationID: 2, DesignationName: 'Station House Officer', Active: 1, SortOrder: 2 },
	{ DesignationID: 3, DesignationName: 'Station Writer', Active: 1, SortOrder: 3 },
];

const State = STATES;
const District = DISTRICTS.map((d) => ({ DistrictID: d.DistrictID, DistrictName: d.district, StateID: KARNATAKA, Active: 1 }));

const Unit = [];
const stationMeta = new Map(); // UnitID -> { area, lat, lon, DistrictID, district, name }
{
	let unitN = 0;
	for (const d of DISTRICTS) {
		const parent = { UnitID: ++unitN, UnitName: `${d.district} District Police Office`, TypeID: 2, ParentUnit: 0, NationalityID: 1, StateID: KARNATAKA, DistrictID: d.DistrictID, Active: 1 };
		Unit.push(parent);
		for (const a of d.areas) {
			const u = { UnitID: ++unitN, UnitName: `${a.area} Police Station`, TypeID: 1, ParentUnit: parent.UnitID, NationalityID: 1, StateID: KARNATAKA, DistrictID: d.DistrictID, Active: 1 };
			Unit.push(u);
			stationMeta.set(u.UnitID, { area: a.area, lat: a.lat, lon: a.lon, DistrictID: d.DistrictID, district: d.district, name: u.UnitName });
		}
	}
}
const stations = [...stationMeta.keys()];
const stationsOf = (DistrictID) => stations.filter((id) => stationMeta.get(id).DistrictID === DistrictID);

const FIRST = ['Ravi', 'Suresh', 'Manjunath', 'Girish', 'Prakash', 'Basavaraj', 'Naveen', 'Kiran', 'Mahesh', 'Santhosh', 'Vinay', 'Ramesh', 'Lokesh', 'Umesh', 'Shivakumar', 'Anand', 'Rakesh', 'Chetan', 'Harish', 'Nagaraj', 'Imran', 'Farhan', 'Yusuf', 'Lakshmi', 'Savitha', 'Bhavya', 'Deepa', 'Roopa', 'Ananya', 'Kavitha', 'Shwetha', 'Nandini', 'Vidya', 'Pooja'];
const LAST = ['Gowda', 'Shetty', 'Reddy', 'Patil', 'Kumar', 'Rao', 'Naik', 'Hegde', 'Murthy', 'Swamy', 'Prasad', 'Desai', 'Kulkarni', 'Bhat', 'Achar', 'Jadhav', 'Pujari', 'Kamath'];
const personName = () => `${pick(FIRST)} ${pick(LAST)}`;

const Employee = [];
const iosOf = new Map(); // UnitID -> EmployeeID[] (IOs at that station)
{
	let empN = 0;
	for (const uid of stations) {
		const meta = stationMeta.get(uid);
		const mk = (RankID, DesignationID) => {
			const e = {
				EmployeeID: ++empN,
				DistrictID: meta.DistrictID,
				UnitID: uid,
				RankID,
				DesignationID,
				KGID: `KG${pad(100000 + empN * 7 + int(0, 5), 7)}`,
				FirstName: personName(),
				EmployeeDOB: iso(new Date(Date.UTC(int(1970, 1995), int(0, 11), int(1, 28)))),
				GenderID: chance(0.8) ? 1 : 2,
				AppointmentDate: iso(new Date(Date.UTC(int(2000, 2020), int(0, 11), int(1, 28)))),
			};
			Employee.push(e);
			return e;
		};
		mk(4, 2); // SHO (Police Inspector)
		const ios = [mk(3, 1), mk(3, 1)]; // two PSI Investigating Officers
		if (chance(0.5)) ios.push(mk(3, 1));
		iosOf.set(uid, ios.map((e) => e.EmployeeID));
	}
}
const empById = new Map(Employee.map((e) => [e.EmployeeID, e]));
const rankShort = { 3: 'PSI', 4: 'PI', 5: 'DySP' };
const ioDisplay = (id) => {
	const e = empById.get(id);
	return `${rankShort[e.RankID] || ''} ${e.FirstName}`.trim();
};

const Court = [];
{
	let courtN = 0;
	for (const d of DISTRICTS) {
		Court.push({ CourtID: ++courtN, CourtName: `District and Sessions Court, ${d.district}`, DistrictID: d.DistrictID, StateID: KARNATAKA, Active: 1 });
		Court.push({ CourtID: ++courtN, CourtName: `JMFC Court, ${d.district}`, DistrictID: d.DistrictID, StateID: KARNATAKA, Active: 1 });
	}
}
const courtsOf = (DistrictID) => Court.filter((c) => c.DistrictID === DistrictID);

// ── socio-economic (CIPHER analytical layer; area = station jurisdiction) ──────
const socio_economic = stations.map((uid) => {
	const m = stationMeta.get(uid);
	const d = DISTRICTS.find((x) => x.DistrictID === m.DistrictID);
	const urban = d.urbanization === 'urban';
	return {
		area_id: `AREA-${pad(uid, 3)}`,
		district: m.district,
		area_name: m.area,
		population: urban ? int(120000, 400000) : int(40000, 150000),
		unemployment_rate: +(urban ? 4 + rnd() * 5 : 6 + rnd() * 7).toFixed(1),
		literacy_rate: +(urban ? 82 + rnd() * 12 : 66 + rnd() * 14).toFixed(1),
		migration_index: +(urban ? 0.5 + rnd() * 0.45 : 0.1 + rnd() * 0.35).toFixed(2),
		economic_stress_index: +(urban ? 0.25 + rnd() * 0.3 : 0.45 + rnd() * 0.4).toFixed(2),
		urbanization_level: d.urbanization,
	};
});

// ── person_master (CIPHER entity-resolved identities) ──────────────────────────
// Offenders are drawn from a pool that cases reuse, so repeat-offender and
// co-accused questions have real answers. The official schema stores only
// per-case name rows; person_master is the resolved identity behind them.
const person_master = [];
const OFFENDERS = 90;
const CIVILIANS = 240;
let personN = 0;

const makePerson = (d, isOffender) => {
	const a = pick(d.areas);
	const first = pick(FIRST);
	const p = {
		person_id: `P-${pad(++personN, 4)}`,
		full_name: `${first} ${pick(LAST)}`,
		aliases: isOffender && chance(0.35) ? `${first[0]}${pick(['appa', 'anna', 'u'])}` : '',
		gender: chance(0.78) ? 'M' : 'F',
		dob: iso(new Date(Date.UTC(int(1975, 2005), int(0, 11), int(1, 28)))),
		age_band: '',
		address: `${int(1, 180)}, ${pick(['Main Road', 'Cross Road', 'Layout', 'Colony', 'Extension'])}, ${a.area}`,
		district: d.district,
		socio_econ_band: pick(['low', 'lower-middle', 'middle']),
		occupation: pick(OCC_NAMES.slice(0, 10)),
		is_offender: isOffender ? 1 : 0,
	};
	const age = 2026 - Number(p.dob.slice(0, 4));
	p.age_band = age < 25 ? '18-24' : age < 35 ? '25-34' : age < 45 ? '35-44' : '45+';
	return p;
};

for (let i = 0; i < OFFENDERS; i++) person_master.push(makePerson(pick(DISTRICTS), true));
for (let i = 0; i < CIVILIANS; i++) person_master.push(makePerson(pick(DISTRICTS), false));

const offenders = person_master.filter((p) => p.is_offender);
const civilians = person_master.filter((p) => !p.is_offender);
const offendersIn = (district) => offenders.filter((p) => p.district === district);
const civiliansIn = (district) => civilians.filter((p) => p.district === district);
const ageOf = (p) => 2026 - Number(p.dob.slice(0, 4));

// ── gangs (planted co-accused clusters — the network-graph demo) ───────────────
const GANGS = [
	{ name: 'Yelahanka chain-snatching ring', district: 'Bengaluru North', sub: 1, size: 6 },
	{ name: 'Peenya burglary crew', district: 'Bengaluru North', sub: 2, size: 5 },
	{ name: 'Nanjangud vehicle-lifting crew', district: 'Mysuru', sub: 3, size: 4 },
];
const gangMembers = new Map();
for (const g of GANGS) {
	const pool = offendersIn(g.district).filter((p) => ![...gangMembers.values()].flat().includes(p));
	gangMembers.set(g.name, pickMany(pool, g.size));
}

// ── cases ──────────────────────────────────────────────────────────────────────
const CaseMaster = [];
const ComplainantDetails = [];
const Victim = [];
const Accused = [];
const ArrestSurrender = [];
const ChargesheetDetails = [];
const ActSectionAssociation = [];
const person_case_link = [];
const narrativeMeta = new Map(); // CaseMasterID -> data needed for the KB narrative

const TARGET_CASES = 300;
let caseN = 0, complN = 0, victimN = 0, accN = 0, arrestN = 0, csN = 0, linkN = 0;
const serials = new Map(); // `${unit}|${cat}|${year}` -> running serial

const WINDOW_MONTHS = 24; // ending 30 Jun 2026
const monthDate = (m, day) => new Date(Date.UTC(2024, 6 + m, day, int(0, 23), int(0, 59)));
const monthWeight = (m) => 1 + m / 24; // gentle overall rise
const monthSlots = [];
for (let m = 0; m < WINDOW_MONTHS; m++) {
	for (let i = 0; i < Math.round(monthWeight(m) * 10); i++) monthSlots.push(m);
}

// Chain-snatching surge in Bengaluru North over the final 6 months, concentrated
// on Yelahanka — that surge is what the hotspot/trend view should reveal.
const pickSub = (district, m) => {
	const surging = district === 'Bengaluru North' && m >= 18;
	if (surging && chance(0.45)) return SUBHEADS[0]; // Chain Snatching
	let s = pick(SUBHEADS);
	while (s.CrimeSubHeadID === 7 && district === 'Kalaburagi') s = pick(SUBHEADS); // abstain-path gap
	return s;
};

const addLink = (person, CaseMasterID, role, source_table, source_row_id) =>
	person_case_link.push({
		link_id: `L-${pad(++linkN, 5)}`,
		person_id: person.person_id,
		CaseMasterID,
		role,
		source_table,
		source_row_id,
	});

while (CaseMaster.length < TARGET_CASES) {
	const m = pick(monthSlots);
	// Bengaluru North carries the bulk of volume, as an urban district would
	const dName = chance(0.5) ? 'Bengaluru North' : chance(0.55) ? 'Mysuru' : 'Kalaburagi';
	const d = DISTRICTS.find((x) => x.district === dName);
	const sub = pickSub(dName, m);
	const stationIds = stationsOf(d.DistrictID);
	const unitId =
		dName === 'Bengaluru North' && sub.CrimeSubHeadID === 1 && m >= 18 && chance(0.7)
			? stationIds.find((id) => stationMeta.get(id).area === 'Yelahanka')
			: pick(stationIds);
	const meta = stationMeta.get(unitId);

	const occurrence = monthDate(m, int(1, 28));
	const registered = new Date(occurrence.getTime() + int(0, 3) * 864e5);
	if (registered > new Date('2026-06-30T23:59:59Z')) continue;
	const year = registered.getUTCFullYear();

	// CrimeNo: 1-digit category + 4-digit district + 4-digit unit + 4-digit year + 5-digit serial.
	// Serial runs per station + category + year, as the ER diagram specifies.
	const catId = chance(0.06) ? 8 : 1; // mostly FIR, a few Zero FIRs
	const serialKey = `${unitId}|${catId}|${year}`;
	const serial = (serials.get(serialKey) || 0) + 1;
	serials.set(serialKey, serial);
	const CrimeNo = `${catId}${pad(d.DistrictID, 4)}${pad(unitId, 4)}${year}${pad(serial, 5)}`;
	const CaseNo = `${year}${pad(serial, 5)}`;
	const CaseMasterID = ++caseN;

	// accused: gang crews for their signature crime, otherwise loose offenders
	const gang = GANGS.find((g) => g.district === dName && g.sub === sub.CrimeSubHeadID);
	let accusedPersons = [];
	if (gang && chance(0.72)) {
		accusedPersons = pickMany(gangMembers.get(gang.name), int(2, 3));
	} else if (chance(0.72)) {
		accusedPersons = pickMany(offendersIn(dName), int(1, 2));
	} // else: undetected case — no accused named yet (realistic, and exercises "unsolved" queries)

	const complainant = pick(civiliansIn(dName));
	const victimPerson = chance(0.8) ? complainant : pick(civiliansIn(dName));

	// status + final report: undetected cases stay under investigation or close as C;
	// detected cases charge-sheet (A) or stay open; a rare few close as false (B).
	let CaseStatusID, cstype = '';
	if (accusedPersons.length === 0) {
		CaseStatusID = chance(0.75) ? 1 : 3;
		if (CaseStatusID === 3) cstype = 'C';
	} else if (chance(0.05)) {
		CaseStatusID = 3;
		cstype = 'B';
	} else if (chance(0.55)) {
		CaseStatusID = 2;
		cstype = 'A';
	} else {
		CaseStatusID = chance(0.5) ? 1 : 3;
		if (CaseStatusID === 3) cstype = 'A'; // closed after chargesheet + trial
	}

	const jitter = () => (rnd() - 0.5) * 0.045;
	const registeringOfficer = pick(iosOf.get(unitId));
	const io = pick(iosOf.get(unitId));
	const court = pick(courtsOf(d.DistrictID)).CourtID;

	const briefFacts =
		`On ${iso(occurrence)}, ${complainant.full_name}, a resident of ${complainant.address}, ` +
		`reported that ${pick(sub.mo)}. The incident occurred within the limits of ${meta.name} in ${dName} district.`;

	CaseMaster.push({
		CaseMasterID,
		CrimeNo,
		CaseNo,
		CrimeRegisteredDate: iso(registered),
		PolicePersonID: registeringOfficer,
		PoliceStationID: unitId,
		CaseCategoryID: catId,
		GravityOffenceID: sub.gravity,
		CrimeMajorHeadID: sub.CrimeHeadID,
		CrimeMinorHeadID: sub.CrimeSubHeadID,
		CaseStatusID,
		CourtID: court,
		IncidentFromDate: dt(occurrence),
		IncidentToDate: dt(new Date(occurrence.getTime() + int(0, 3) * 36e5)),
		InfoReceivedPSDate: dt(registered),
		latitude: +(meta.lat + jitter()).toFixed(5),
		longitude: +(meta.lon + jitter()).toFixed(5),
		BriefFacts: briefFacts,
	});

	// act-section rows for the sub-head's sections
	sub.sections.forEach(([act, sec], i) =>
		ActSectionAssociation.push({ CaseMasterID, ActID: act, SectionID: sec, ActOrderID: i + 1, SectionOrderID: i + 1 }),
	);

	// complainant (occupation mapped into OccupationMaster range)
	const complRow = {
		ComplainantID: ++complN,
		CaseMasterID,
		ComplainantName: complainant.full_name,
		AgeYear: ageOf(complainant),
		OccupationID: occId(complainant.occupation),
		GenderID: GENDER[complainant.gender],
	};
	ComplainantDetails.push(complRow);
	addLink(complainant, CaseMasterID, 'complainant', 'ComplainantDetails', complRow.ComplainantID);

	const victimRow = {
		VictimMasterID: ++victimN,
		CaseMasterID,
		VictimName: victimPerson.full_name,
		AgeYear: ageOf(victimPerson),
		GenderID: GENDER[victimPerson.gender],
		VictimPolice: '0',
	};
	Victim.push(victimRow);
	addLink(victimPerson, CaseMasterID, 'victim', 'Victim', victimRow.VictimMasterID);

	const accusedRows = [];
	accusedPersons.forEach((p, i) => {
		const row = {
			AccusedMasterID: ++accN,
			CaseMasterID,
			AccusedName: p.full_name,
			AgeYear: ageOf(p),
			GenderID: GENDER[p.gender],
			PersonID: `A${i + 1}`, // in-case ordinal per the ER diagram, not a person FK
		};
		Accused.push(row);
		accusedRows.push({ row, person: p });
		addLink(p, CaseMasterID, 'accused', 'Accused', row.AccusedMasterID);

		if (chance(0.6)) {
			ArrestSurrender.push({
				ArrestSurrenderID: ++arrestN,
				CaseMasterID,
				ArrestSurrenderTypeID: chance(0.9) ? 1 : 2,
				ArrestSurrenderDate: iso(new Date(registered.getTime() + int(1, 40) * 864e5)),
				ArrestSurrenderStateId: chance(0.94) ? KARNATAKA : pick([2, 3]),
				ArrestSurrenderDistrictId: d.DistrictID,
				PoliceStationID: unitId,
				IOID: io,
				CourtID: court,
				AccusedMasterID: row.AccusedMasterID,
				IsAccused: 1,
				IsComplainantAccused: 0,
			});
		}
	});

	if (cstype) {
		ChargesheetDetails.push({
			CSID: ++csN,
			CaseMasterID,
			csdate: dt(new Date(registered.getTime() + int(30, 120) * 864e5)),
			cstype,
			PolicePersonID: io,
		});
	}

	narrativeMeta.set(CaseMasterID, { complainant, victimPerson, accusedPersons, io, sub, meta, dName, cstype });
}

// ── attributes (phones / vehicles) ─────────────────────────────────────────────
// Some offenders deliberately SHARE a phone or vehicle — those shared values are the
// non-obvious edges the criminal-network graph is supposed to surface.
const attribute = [];
let attrN = 0;
const addAttr = (person_id, type, value, verified = 1) =>
	attribute.push({ id: `AT-${pad(++attrN, 5)}`, person_id, type, value, verified });

const phone = () => `9${int(1, 9)}${pad(int(0, 99999999), 8)}`;
const vehicle = () => `KA${pad(int(1, 51), 2)}${pick(['AB', 'MJ', 'HG', 'CZ', 'PL'])}${pad(int(1000, 9999), 4)}`;

for (const p of person_master) {
	addAttr(p.person_id, 'phone', phone());
	if (p.is_offender && chance(0.55)) addAttr(p.person_id, 'vehicle', vehicle());
}
for (const g of GANGS) {
	const members = gangMembers.get(g.name);
	const sharedPhone = phone();
	for (const p of pickMany(members, Math.min(3, members.length))) addAttr(p.person_id, 'phone', sharedPhone);
	const sharedVehicle = vehicle();
	for (const p of pickMany(members, Math.min(2, members.length))) addAttr(p.person_id, 'vehicle', sharedVehicle);
}
// one cross-gang link — a single phone bridging two crews, the kind of lead worth finding
{
	const a = pick(gangMembers.get('Yelahanka chain-snatching ring'));
	const b = pick(gangMembers.get('Peenya burglary crew'));
	const bridge = phone();
	addAttr(a.person_id, 'phone', bridge);
	addAttr(b.person_id, 'phone', bridge);
}

// ── narratives (one RAG doc per case, keyed by CrimeNo) ───────────────────────
const catName = (id) => CaseCategory.find((c) => c.CaseCategoryID === id).LookupValue;
const statusName = (id) => CaseStatusMaster.find((s) => s.CaseStatusID === id).CaseStatusName;
const gravityName = (id) => GravityOffence.find((g) => g.GravityOffenceID === id).LookupValue;
const sectionsDisplay = (CaseMasterID) =>
	ActSectionAssociation.filter((a) => a.CaseMasterID === CaseMasterID)
		.map((a) => `${a.ActID} ${a.SectionID}`)
		.join('; ');

const nameOf = (p) => `${p.full_name} (${p.person_id})`;
const narrativeFor = (c) => {
	const n = narrativeMeta.get(c.CaseMasterID);
	const accused = n.accusedPersons.length ? n.accusedPersons.map(nameOf).join(', ') : 'not identified so far';
	const finalReport =
		n.cstype === 'A' ? 'A chargesheet has been filed in this case.'
		: n.cstype === 'B' ? 'The case was closed as a false case (final report B).'
		: n.cstype === 'C' ? 'The case was closed as undetected (final report C).'
		: 'No final report has been filed yet.';
	return [
		`Crime Number: ${c.CrimeNo}`,
		`Case Number: ${c.CaseNo}`,
		`Case Category: ${catName(c.CaseCategoryID)}`,
		`Police Station: ${n.meta.name}, ${n.dName} district, Karnataka`,
		`Crime Head: ${CrimeHead.find((h) => h.CrimeHeadID === c.CrimeMajorHeadID).CrimeGroupName} — ${n.sub.CrimeHeadName}`,
		`Sections: ${sectionsDisplay(c.CaseMasterID)}`,
		`Gravity: ${gravityName(c.GravityOffenceID)}`,
		`Date of Occurrence: ${c.IncidentFromDate}`,
		`Date of Registration: ${c.CrimeRegisteredDate}`,
		`Investigating Officer: ${ioDisplay(n.io)}`,
		`Status: ${statusName(c.CaseStatusID)}`,
		'',
		'Brief Facts:',
		c.BriefFacts,
		'',
		'Complainant:',
		`${nameOf(n.complainant)}, aged ${ageOf(n.complainant)}, ${n.complainant.occupation}.`,
		'',
		'Victim:',
		`${nameOf(n.victimPerson)}, aged ${ageOf(n.victimPerson)}.`,
		'',
		'Accused:',
		accused === 'not identified so far'
			? 'No accused has been identified so far. The case remains under investigation.'
			: `The following persons are named as accused in this case: ${accused}.`,
		'',
		finalReport,
		'',
		'[SYNTHETIC RECORD — generated for the CIPHER prototype. Not a real FIR.]',
	].join('\n');
};

// ── write ──────────────────────────────────────────────────────────────────────
const toCsv = (rows) => {
	if (!rows.length) return '';
	const cols = Object.keys(rows[0]);
	const esc = (v) => {
		const s = v === null || v === undefined ? '' : String(v);
		return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
};

rmSync(ROOT, { recursive: true, force: true });
mkdirSync(join(ROOT, 'narratives'), { recursive: true });

// wipe stale table JSONs from the function bundle so removed tables don't linger
if (existsSync(FN_DATA)) for (const f of readdirSync(FN_DATA)) if (f.endsWith('.json')) unlinkSync(join(FN_DATA, f));
mkdirSync(FN_DATA, { recursive: true });

const CrimeSubHead = SUBHEADS.map(({ CrimeSubHeadID, CrimeHeadID, CrimeHeadName, SeqID }) => ({ CrimeSubHeadID, CrimeHeadID, CrimeHeadName, SeqID }));

const tables = {
	// Layer 1 — official ER
	CaseMaster, ComplainantDetails, Victim, Accused, ArrestSurrender, ChargesheetDetails,
	ActSectionAssociation, Act, Section, CrimeHead, CrimeSubHead, CrimeHeadActSection,
	CaseCategory, GravityOffence, CaseStatusMaster, OccupationMaster,
	State, District, Unit, UnitType, Rank, Designation, Employee, Court,
	// Layer 2 — CIPHER analytical
	person_master, person_case_link, attribute, socio_economic,
};
for (const [name, rows] of Object.entries(tables)) {
	writeFileSync(join(ROOT, `${name}.json`), JSON.stringify(rows, null, 2));
	writeFileSync(join(ROOT, `${name}.csv`), toCsv(rows));
	writeFileSync(join(FN_DATA, `${name}.json`), JSON.stringify(rows));
}

let maxDoc = 0;
for (const c of CaseMaster) {
	const text = narrativeFor(c);
	maxDoc = Math.max(maxDoc, Buffer.byteLength(text));
	writeFileSync(join(ROOT, 'narratives', `${c.CrimeNo}.txt`), text);
}

// ── report ─────────────────────────────────────────────────────────────────────
const countBy = (rows, key) =>
	Object.entries(rows.reduce((a, r) => ((a[r[key]] = (a[r[key]] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);

const byDistrict = (name) => {
	const id = DISTRICTS.find((d) => d.district === name).DistrictID;
	return CaseMaster.filter((c) => Number(c.CrimeNo.slice(1, 5)) === id).length;
};
const accusedLinks = person_case_link.filter((l) => l.role === 'accused');
const repeat = countBy(accusedLinks, 'person_id').filter(([, n]) => n >= 3).length;
const yelahanka = stations.find((id) => stationMeta.get(id).area === 'Yelahanka');
const surge = CaseMaster.filter((c) => c.PoliceStationID === yelahanka && c.CrimeMinorHeadID === 1 && c.CrimeRegisteredDate >= '2026-01-01').length;
const ndpsKbg = CaseMaster.filter((c) => Number(c.CrimeNo.slice(1, 5)) === 430 && c.CrimeMajorHeadID === 4).length;

console.log(`seed written → data/seed  (SEED=${SEED})`);
console.log(`  CaseMaster         ${CaseMaster.length}   ${DISTRICTS.map((d) => `${d.district}:${byDistrict(d.district)}`).join('  ')}`);
console.log(`  Accused/Victim/Compl ${Accused.length}/${Victim.length}/${ComplainantDetails.length}`);
console.log(`  ArrestSurrender    ${ArrestSurrender.length}   ChargesheetDetails ${ChargesheetDetails.length}`);
console.log(`  ActSectionAssoc    ${ActSectionAssociation.length}`);
console.log(`  person_master      ${person_master.length}   (offenders ${offenders.length})   links ${person_case_link.length}`);
console.log(`  attribute          ${attribute.length}   Employee ${Employee.length}   Unit ${Unit.length}   Court ${Court.length}`);
console.log(`  narratives         ${CaseMaster.length} docs, largest ${maxDoc} B (KB limit 500 KB)`);
console.log('');
console.log('  demo hooks:');
console.log(`    crime mix          ${countBy(CaseMaster, 'CrimeMinorHeadID').map(([k, v]) => `${SUBHEADS.find((s) => s.CrimeSubHeadID === Number(k)).CrimeHeadName}:${v}`).join('  ')}`);
console.log(`    repeat accused     ${repeat} persons in >=3 cases   (network graph)`);
console.log(`    Yelahanka snatch   ${surge} cases in 2026 H1        (hotspot / trend)`);
console.log(`    Kalaburagi NDPS    ${ndpsKbg} cases                    (abstain path)`);
console.log(`    Zero FIRs          ${CaseMaster.filter((c) => c.CaseCategoryID === 8).length}`);
