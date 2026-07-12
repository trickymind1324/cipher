/**
 * CIPHER — synthetic CCTNS-aligned seed generator.
 *
 * ALL DATA IS SYNTHETIC. No real police record, person, phone, or vehicle is used.
 * Names, numbers and narratives are generated; any resemblance to a real record is coincidental.
 *
 * Emits, into data/seed/:
 *   *.json / *.csv        one pair per Data Store table
 *   narratives/FIR-*.txt  one narrative doc per FIR, for the QuickML RAG Knowledge Base
 *                         (1 doc = 1 FIR so RAG citations resolve to a single fir_id)
 *
 * Deterministic: same SEED always yields the same dataset.
 *
 *   node data/generate_seed.mjs
 */

import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'seed');
const SEED = 20260712;

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

// ── reference geography (real Karnataka districts; stations are invented) ──────
const DISTRICTS = [
	{
		district: 'Bengaluru North',
		urbanization: 'urban',
		taluks: [
			{ taluk: 'Yelahanka', lat: 13.1007, lon: 77.5963 },
			{ taluk: 'Hebbal', lat: 13.0358, lon: 77.5970 },
			{ taluk: 'Peenya', lat: 13.0287, lon: 77.5178 },
			{ taluk: 'RT Nagar', lat: 13.0207, lon: 77.5945 },
		],
	},
	{
		district: 'Mysuru',
		urbanization: 'semi-urban',
		taluks: [
			{ taluk: 'Krishnaraja', lat: 12.3052, lon: 76.6552 },
			{ taluk: 'Nanjangud', lat: 12.1173, lon: 76.6838 },
			{ taluk: 'Hunsur', lat: 12.3040, lon: 76.2930 },
		],
	},
	{
		district: 'Kalaburagi',
		urbanization: 'rural',
		taluks: [
			{ taluk: 'Kalaburagi City', lat: 17.3297, lon: 76.8343 },
			{ taluk: 'Aland', lat: 17.5645, lon: 76.5680 },
			{ taluk: 'Chittapur', lat: 17.1204, lon: 77.0836 },
		],
	},
];

// crime_type → IPC sections + modus-operandi phrasings.
// NOTE: Kalaburagi is deliberately given NO 'Narcotics (NDPS)' FIRs — that gap is what the
// abstain path (FR-CONV-10) is demonstrated against. Do not "fix" it by adding data.
const CRIMES = [
	{
		type: 'Chain Snatching',
		ipc: ['IPC 379', 'IPC 356'],
		severity: 'medium',
		mo: [
			'two-wheeler borne suspects snatched the gold chain and fled towards the ring road',
			'pillion rider snatched the mangalsutra while the complainant was walking on the footpath',
			'suspects on a motorcycle without a number plate snatched the chain near a bus stop',
		],
	},
	{
		type: 'House Burglary',
		ipc: ['IPC 454', 'IPC 457', 'IPC 380'],
		severity: 'medium',
		mo: [
			'the lock of the main door was broken open while the house was locked and the family was away',
			'entry was gained through an unsecured rear window and the almirah was ransacked',
			'the grill of the ventilator was cut and gold ornaments and cash were taken',
		],
	},
	{
		type: 'Vehicle Theft',
		ipc: ['IPC 379'],
		severity: 'low',
		mo: [
			'the motorcycle parked outside the residence was stolen during the night',
			'the vehicle was taken from an unattended parking lot after the steering lock was broken',
			'the two-wheeler was stolen from outside a commercial complex in broad daylight',
		],
	},
	{
		type: 'Cheating / Online Fraud',
		ipc: ['IPC 420', 'IPC 66D IT Act'],
		severity: 'medium',
		mo: [
			'the complainant was induced to transfer money on the promise of a part-time job',
			'the suspect posed as a bank official and obtained the OTP over a phone call',
			'payment was collected for goods advertised online which were never delivered',
		],
	},
	{
		type: 'Robbery',
		ipc: ['IPC 392', 'IPC 397'],
		severity: 'high',
		mo: [
			'the suspects threatened the complainant with a knife and took cash and a mobile phone',
			'an armed group waylaid the complainant on a deserted stretch and robbed the collection amount',
		],
	},
	{
		type: 'Assault / Hurt',
		ipc: ['IPC 323', 'IPC 324'],
		severity: 'low',
		mo: [
			'a quarrel over a parking dispute escalated and the complainant was assaulted',
			'the accused caused hurt with a wooden club following a prior enmity',
		],
	},
	{
		type: 'Narcotics (NDPS)',
		ipc: ['NDPS 20', 'NDPS 22'],
		severity: 'high',
		mo: [
			'the accused was found in possession of contraband during a vehicle check at a checkpost',
			'a tip-off led to the seizure of contraband from a rented room',
		],
	},
];

const FIRST = ['Ravi', 'Suresh', 'Manjunath', 'Girish', 'Prakash', 'Basavaraj', 'Naveen', 'Kiran', 'Mahesh', 'Santhosh', 'Vinay', 'Ramesh', 'Lokesh', 'Umesh', 'Shivakumar', 'Anand', 'Rakesh', 'Chetan', 'Harish', 'Nagaraj', 'Imran', 'Farhan', 'Yusuf', 'Lakshmi', 'Savitha', 'Bhavya', 'Deepa', 'Roopa', 'Ananya', 'Kavitha', 'Shwetha', 'Nandini', 'Vidya', 'Pooja'];
const LAST = ['Gowda', 'Shetty', 'Reddy', 'Patil', 'Kumar', 'Rao', 'Naik', 'Hegde', 'Murthy', 'Swamy', 'Prasad', 'Desai', 'Kulkarni', 'Bhat', 'Achar', 'Jadhav', 'Pujari', 'Kamath'];
const OCCUPATIONS = ['daily wage labourer', 'auto driver', 'mechanic', 'shop assistant', 'unemployed', 'street vendor', 'construction worker', 'private security guard', 'delivery rider', 'farm labourer'];
const BANDS = ['low', 'lower-middle', 'middle'];

const pad = (n, w) => String(n).padStart(w, '0');
const iso = (d) => d.toISOString().slice(0, 10);
const dtime = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

// 24-month window ending 30 Jun 2026
const WINDOW_START = new Date('2024-07-01T00:00:00Z');
const WINDOW_MONTHS = 24;
const monthDate = (m, day) => new Date(Date.UTC(2024, 6 + m, day, int(0, 23), int(0, 59)));

// ── police stations ───────────────────────────────────────────────────────────
const police_station = [];
let stationN = 0;
for (const d of DISTRICTS) {
	for (const t of d.taluks) {
		police_station.push({
			station_id: `PS-${pad(++stationN, 3)}`,
			name: `${t.taluk} Police Station`,
			district: d.district,
			taluk: t.taluk,
			lat: t.lat,
			lon: t.lon,
		});
	}
}
const stationsOf = (district) => police_station.filter((s) => s.district === district);

// ── socio-economic (area = taluk) ─────────────────────────────────────────────
const socio_economic = police_station.map((s) => {
	const d = DISTRICTS.find((x) => x.district === s.district);
	const urban = d.urbanization === 'urban';
	return {
		area_id: `AREA-${s.station_id.slice(3)}`,
		district: s.district,
		taluk: s.taluk,
		ward: `Ward ${int(1, 40)}`,
		population: urban ? int(120000, 400000) : int(40000, 150000),
		unemployment_rate: +(urban ? 4 + rnd() * 5 : 6 + rnd() * 7).toFixed(1),
		literacy_rate: +(urban ? 82 + rnd() * 12 : 66 + rnd() * 14).toFixed(1),
		migration_index: +(urban ? 0.5 + rnd() * 0.45 : 0.1 + rnd() * 0.35).toFixed(2),
		economic_stress_index: +(urban ? 0.25 + rnd() * 0.3 : 0.45 + rnd() * 0.4).toFixed(2),
		urbanization_level: d.urbanization,
	};
});

// ── persons ───────────────────────────────────────────────────────────────────
// Offenders are drawn from a pool that FIRs reuse, so repeat-offender and
// co-accused questions have real answers.
const person = [];
const OFFENDERS = 90;
const CIVILIANS = 240;
let personN = 0;

const makePerson = (district, isOffender) => {
	const d = DISTRICTS.find((x) => x.district === district);
	const t = pick(d.taluks);
	const first = pick(FIRST);
	const p = {
		person_id: `P-${pad(++personN, 4)}`,
		full_name: `${first} ${pick(LAST)}`,
		aliases: isOffender && chance(0.35) ? `${first[0]}${pick(['appa', 'anna', 'u'])}` : '',
		gender: chance(0.78) ? 'M' : 'F',
		dob: iso(new Date(Date.UTC(int(1975, 2005), int(0, 11), int(1, 28)))),
		age_band: '',
		address: `${int(1, 180)}, ${pick(['Main Road', 'Cross Road', 'Layout', 'Colony', 'Extension'])}, ${t.taluk}`,
		city: t.taluk,
		district,
		taluk: t.taluk,
		socio_econ_band: pick(BANDS),
		occupation: pick(OCCUPATIONS),
		is_offender: isOffender ? 1 : 0,
	};
	const age = 2026 - Number(p.dob.slice(0, 4));
	p.age_band = age < 25 ? '18-24' : age < 35 ? '25-34' : age < 45 ? '35-44' : '45+';
	return p;
};

for (let i = 0; i < OFFENDERS; i++) person.push(makePerson(pick(DISTRICTS).district, true));
for (let i = 0; i < CIVILIANS; i++) person.push(makePerson(pick(DISTRICTS).district, false));

const offenders = person.filter((p) => p.is_offender);
const civilians = person.filter((p) => !p.is_offender);
const offendersIn = (district) => offenders.filter((p) => p.district === district);

// ── gangs (planted co-accused clusters — the network-graph demo) ──────────────
const GANGS = [
	{ name: 'Yelahanka chain-snatching ring', district: 'Bengaluru North', crime: 'Chain Snatching', size: 6 },
	{ name: 'Peenya burglary crew', district: 'Bengaluru North', crime: 'House Burglary', size: 5 },
	{ name: 'Nanjangud vehicle-lifting crew', district: 'Mysuru', crime: 'Vehicle Theft', size: 4 },
];
const gangMembers = new Map(); // gang name -> person[]
for (const g of GANGS) {
	const pool = offendersIn(g.district).filter((p) => ![...gangMembers.values()].flat().includes(p));
	gangMembers.set(g.name, pickMany(pool, g.size));
}

// ── FIRs ──────────────────────────────────────────────────────────────────────
const fir = [];
const fir_party = [];
const TARGET_FIRS = 300;
let firN = 0;
let partyN = 0;

// Monthly weight: gentle overall rise, plus a chain-snatching surge in Bengaluru North
// over the final 6 months — that surge is what the hotspot/trend view should reveal.
const monthWeight = (m) => 1 + m / 24;

const pickCrime = (district, m) => {
	const surging = district === 'Bengaluru North' && m >= 18;
	if (surging && chance(0.45)) return CRIMES.find((c) => c.type === 'Chain Snatching');
	// deliberate data gap: no narcotics FIRs in Kalaburagi (abstain demo)
	let c = pick(CRIMES);
	while (c.type === 'Narcotics (NDPS)' && district === 'Kalaburagi') c = pick(CRIMES);
	return c;
};

const monthSlots = [];
for (let m = 0; m < WINDOW_MONTHS; m++) {
	for (let i = 0; i < Math.round(monthWeight(m) * 10); i++) monthSlots.push(m);
}

while (fir.length < TARGET_FIRS) {
	const m = pick(monthSlots);
	// Bengaluru North carries the bulk of volume, as an urban district would
	const district = chance(0.5) ? 'Bengaluru North' : chance(0.55) ? 'Mysuru' : 'Kalaburagi';
	const crime = pickCrime(district, m);
	const stations = stationsOf(district);
	// during the surge, concentrate on Yelahanka to create a real hotspot
	const station =
		district === 'Bengaluru North' && crime.type === 'Chain Snatching' && m >= 18 && chance(0.7)
			? stations.find((s) => s.taluk === 'Yelahanka')
			: pick(stations);

	const occurrence = monthDate(m, int(1, 28));
	const registered = new Date(occurrence.getTime() + int(0, 3) * 864e5);
	if (registered > new Date('2026-06-30T23:59:59Z')) continue;

	const id = `FIR-${pad(++firN, 4)}`;
	const jitter = () => (rnd() - 0.5) * 0.045;

	// accused: gang crews for their signature crime, otherwise loose offenders
	const gang = GANGS.find((g) => g.district === district && g.crime === crime.type);
	let accused = [];
	if (gang && chance(0.72)) {
		accused = pickMany(gangMembers.get(gang.name), int(2, 3));
	} else if (chance(0.72)) {
		accused = pickMany(offendersIn(district), int(1, 2));
	} // else: undetected case — no accused named yet (realistic, and exercises "unsolved" queries)

	const complainant = pick(civilians.filter((p) => p.district === district));
	const victims = chance(0.8) ? [complainant] : pickMany(civilians.filter((p) => p.district === district), 1);
	const witnesses = chance(0.5) ? pickMany(civilians.filter((p) => p.district === district), int(1, 2)) : [];

	const status = accused.length === 0 ? 'under investigation' : chance(0.55) ? 'chargesheeted' : chance(0.5) ? 'under investigation' : 'closed';

	const f = {
		fir_id: id,
		fir_number: `${pad(firN, 3)}/${occurrence.getUTCFullYear()}`,
		station_id: station.station_id,
		police_station: station.name,
		district,
		taluk: station.taluk,
		crime_type: crime.type,
		ipc_sections: crime.ipc.join('; '),
		severity: crime.severity,
		registered_date: iso(registered),
		occurrence_date: iso(occurrence),
		occurrence_time: dtime(occurrence).slice(11),
		lat: +(station.lat + jitter()).toFixed(5),
		lon: +(station.lon + jitter()).toFixed(5),
		modus_operandi: pick(crime.mo),
		status,
		io_officer: `PSI ${pick(FIRST)} ${pick(LAST)}`,
		summary_text: '',
	};

	for (const p of accused) fir_party.push({ id: `FP-${pad(++partyN, 5)}`, fir_id: id, person_id: p.person_id, role: 'accused', arrest_date: chance(0.6) ? iso(new Date(registered.getTime() + int(1, 40) * 864e5)) : '', bail_status: chance(0.5) ? 'on bail' : 'in custody' });
	for (const p of victims) fir_party.push({ id: `FP-${pad(++partyN, 5)}`, fir_id: id, person_id: p.person_id, role: 'victim', arrest_date: '', bail_status: '' });
	fir_party.push({ id: `FP-${pad(++partyN, 5)}`, fir_id: id, person_id: complainant.person_id, role: 'complainant', arrest_date: '', bail_status: '' });
	for (const p of witnesses) fir_party.push({ id: `FP-${pad(++partyN, 5)}`, fir_id: id, person_id: p.person_id, role: 'witness', arrest_date: '', bail_status: '' });

	f._accused = accused;
	f._complainant = complainant;
	f._witnesses = witnesses;
	fir.push(f);
}

// ── attributes (phones / vehicles) ────────────────────────────────────────────
// Some offenders deliberately SHARE a phone or vehicle — those shared values are the
// non-obvious edges the criminal-network graph is supposed to surface.
const attribute = [];
let attrN = 0;
const addAttr = (person_id, type, value, verified = 1) =>
	attribute.push({ id: `AT-${pad(++attrN, 5)}`, person_id, type, value, verified });

const phone = () => `9${int(1, 9)}${pad(int(0, 99999999), 8)}`;
const vehicle = () => `KA${pad(int(1, 51), 2)}${pick(['AB', 'MJ', 'HG', 'CZ', 'PL'])}${pad(int(1000, 9999), 4)}`;

for (const p of person) {
	addAttr(p.person_id, 'phone', phone());
	if (p.is_offender && chance(0.55)) addAttr(p.person_id, 'vehicle', vehicle());
}
// shared handset / shared getaway vehicle within each gang
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

// ── narratives (one RAG doc per FIR) ──────────────────────────────────────────
const nameOf = (p) => `${p.full_name} (${p.person_id})`;
const narrativeFor = (f) => {
	const accused = f._accused.length ? f._accused.map(nameOf).join(', ') : 'not identified so far';
	const witnesses = f._witnesses.length ? f._witnesses.map(nameOf).join(', ') : 'none recorded';
	return [
		`FIR ID: ${f.fir_id}`,
		`FIR Number: ${f.fir_number}`,
		`Police Station: ${f.police_station}, ${f.taluk}, ${f.district} district, Karnataka`,
		`Crime Type: ${f.crime_type}`,
		`Sections: ${f.ipc_sections}`,
		`Date of Occurrence: ${f.occurrence_date} at ${f.occurrence_time}`,
		`Date of Registration: ${f.registered_date}`,
		`Investigating Officer: ${f.io_officer}`,
		`Status: ${f.status}`,
		'',
		'Complaint:',
		`On ${f.occurrence_date}, ${nameOf(f._complainant)}, a resident of ${f._complainant.address}, reported that ${f.modus_operandi}. The incident occurred within the limits of ${f.police_station} in ${f.taluk}, ${f.district} district.`,
		'',
		'Accused:',
		accused === 'not identified so far'
			? 'No accused has been identified so far. The case remains under investigation.'
			: `The following persons are named as accused in this FIR: ${accused}.`,
		'',
		'Witnesses:',
		witnesses === 'none recorded' ? 'No witnesses were recorded.' : `Witnesses examined: ${witnesses}.`,
		'',
		`This case was registered under ${f.ipc_sections} and is currently ${f.status}.`,
		'',
		'[SYNTHETIC RECORD — generated for the CIPHER prototype. Not a real FIR.]',
	].join('\n');
};

for (const f of fir) {
	f.summary_text = `${f.crime_type} reported at ${f.taluk}, ${f.district} on ${f.occurrence_date}: ${f.modus_operandi}.`;
}

// ── write ─────────────────────────────────────────────────────────────────────
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

const firPublic = fir.map(({ _accused, _complainant, _witnesses, ...rest }) => rest);

const tables = { person, fir: firPublic, fir_party, attribute, socio_economic, police_station };
for (const [name, rows] of Object.entries(tables)) {
	writeFileSync(join(ROOT, `${name}.json`), JSON.stringify(rows, null, 2));
	writeFileSync(join(ROOT, `${name}.csv`), toCsv(rows));
}

let maxDoc = 0;
for (const f of fir) {
	const text = narrativeFor(f);
	maxDoc = Math.max(maxDoc, Buffer.byteLength(text));
	writeFileSync(join(ROOT, 'narratives', `${f.fir_id}.txt`), text);
}

// ── report ────────────────────────────────────────────────────────────────────
const byDistrict = (d) => fir.filter((f) => f.district === d).length;
const countBy = (rows, key) =>
	Object.entries(rows.reduce((a, r) => ((a[r[key]] = (a[r[key]] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);

const accusedCount = fir_party.filter((p) => p.role === 'accused').length;
const repeat = countBy(fir_party.filter((p) => p.role === 'accused'), 'person_id').filter(([, n]) => n >= 3).length;
const surge = fir.filter((f) => f.district === 'Bengaluru North' && f.crime_type === 'Chain Snatching' && f.taluk === 'Yelahanka' && f.occurrence_date >= '2026-01-01').length;
const ndpsKalaburagi = fir.filter((f) => f.district === 'Kalaburagi' && f.crime_type === 'Narcotics (NDPS)').length;

console.log(`seed written → data/seed  (SEED=${SEED})`);
console.log(`  fir              ${fir.length}   ${DISTRICTS.map((d) => `${d.district}:${byDistrict(d.district)}`).join('  ')}`);
console.log(`  person           ${person.length}   (offenders ${offenders.length}, civilians ${civilians.length})`);
console.log(`  fir_party        ${fir_party.length}   (accused rows ${accusedCount})`);
console.log(`  attribute        ${attribute.length}`);
console.log(`  socio_economic   ${socio_economic.length}`);
console.log(`  police_station   ${police_station.length}`);
console.log(`  narratives       ${fir.length} docs, largest ${maxDoc} B (KB limit 500 KB)`);
console.log('');
console.log('  demo hooks:');
console.log(`    crime mix          ${countBy(fir, 'crime_type').map(([k, v]) => `${k}:${v}`).join('  ')}`);
console.log(`    repeat accused     ${repeat} persons in >=3 FIRs   (network graph)`);
console.log(`    Yelahanka snatch   ${surge} FIRs in 2026 H1        (hotspot / trend)`);
console.log(`    Kalaburagi NDPS    ${ndpsKalaburagi} FIRs                    (abstain path)`);
