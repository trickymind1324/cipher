/**
 * Bundle the per-FIR narratives into upload-ready Knowledge Base documents.
 *
 * The QuickML Knowledge Base has no bulk or API upload — documents go in through the
 * console, one selection at a time — and caps each file at 500 KB. Uploading 300
 * per-FIR files by hand is not reasonable, so they are grouped here.
 *
 * Grouping costs us nothing, because citations do not depend on RAG's document ids.
 * Every narrative carries its own `Crime Number: <18 digits>` line, the model cites
 * those ids from the text, and pipeline.js then validates each cited id against the
 * record store, discarding the answer if any id was not retrieved. Document-level
 * provenance would actually be weaker than that.
 *
 * Files are grouped by district and split at a conservative size, so a retrieved chunk
 * is surrounded by records from the same jurisdiction.
 *
 *   node data/bundle_kb.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const NARRATIVES = join(HERE, 'seed', 'narratives');
const OUT = join(HERE, 'kb');

const LIMIT = 500 * 1024; // hard cap from the console uploader
const TARGET = 400 * 1024; // split here, leaving headroom

// CrimeNo digits 2–5 are the DistrictID (1-digit category + 4-digit district + …).
const districts = JSON.parse(readFileSync(join(HERE, 'seed', 'District.json'), 'utf8'));
const districtById = new Map(districts.map((d) => [d.DistrictID, d.DistrictName]));
const districtOf = (crimeNo) => districtById.get(Number(crimeNo.slice(1, 5))) || 'Unknown';

const files = readdirSync(NARRATIVES).filter((f) => f.endsWith('.txt')).sort();

// group by district, keeping case order stable
const groups = new Map();
for (const file of files) {
	const crimeNo = file.replace('.txt', '');
	const district = districtOf(crimeNo);
	if (!groups.has(district)) groups.set(district, []);
	groups.get(district).push({ firId: crimeNo, text: readFileSync(join(NARRATIVES, file), 'utf8') });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SEPARATOR = '\n\n' + '='.repeat(70) + '\n\n';

const written = [];

for (const [district, docs] of groups) {
	let part = 1;
	let buffer = [];
	let size = 0;

	const flush = () => {
		if (!buffer.length) return;

		const header = [
			`CIPHER — FIR NARRATIVE RECORDS`,
			`District: ${district}`,
			`Part ${part}`,
			`Records in this document: ${buffer.length} (${buffer[0].firId} … ${buffer[buffer.length - 1].firId})`,
			`Each record below begins with its 18-digit Crime Number. Cite that Crime Number when answering.`,
			`ALL RECORDS ARE SYNTHETIC — generated for the CIPHER prototype, not real FIRs.`,
		].join('\n');

		const body = header + SEPARATOR + buffer.map((d) => d.text).join(SEPARATOR);
		const name = `cipher-fir-kb--${slug(district)}--part-${part}.txt`;
		writeFileSync(join(OUT, name), body);

		const bytes = Buffer.byteLength(body);
		written.push({ name, district, records: buffer.length, bytes });
		if (bytes > LIMIT) throw new Error(`${name} is ${bytes} B — over the 500 KB console limit`);

		part++;
		buffer = [];
		size = 0;
	};

	for (const doc of docs) {
		const cost = Buffer.byteLength(doc.text) + SEPARATOR.length;
		if (size + cost > TARGET) flush();
		buffer.push(doc);
		size += cost;
	}
	flush();
}

const totalRecords = written.reduce((a, w) => a + w.records, 0);
const largest = Math.max(...written.map((w) => w.bytes));

console.log(`knowledge-base bundle → data/kb  (${written.length} files, upload these)\n`);
for (const w of written) {
	console.log(`  ${w.name.padEnd(46)} ${String(w.records).padStart(3)} FIRs  ${(w.bytes / 1024).toFixed(0).padStart(4)} KB`);
}
console.log(`\n  ${totalRecords} FIRs bundled (expected ${files.length})`);
console.log(`  largest file ${(largest / 1024).toFixed(0)} KB — console limit is 500 KB`);

if (totalRecords !== files.length) throw new Error('record count mismatch — some narratives were dropped');
