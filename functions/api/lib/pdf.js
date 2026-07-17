'use strict';

/**
 * Conversation-history PDF export (F6).
 *
 * The challenge asks for conversation history saved "in PDF format locally", so the
 * endpoint streams the document straight back as a download — no intermediate object
 * store, nothing retained server-side. What goes in the file is exactly what the audit
 * trail records about each turn: question, answer, citations, and how the answer was
 * produced (model, template, guardrail, abstain).
 *
 * Kannada: answers can be in Kannada, and the built-in PDF fonts have no Kannada
 * glyphs, so Noto Sans Kannada (OFL) is bundled. It carries digits and punctuation but
 * no Latin letters, so the font is chosen per text run: any run containing Kannada
 * script gets Noto, everything else gets Helvetica.
 */

const path = require('node:path');
const PDFDocument = require('pdfkit');

const FONT_KN = path.join(__dirname, '..', 'assets', 'NotoSansKannada-Regular.ttf');
const FONT_KN_BOLD = path.join(__dirname, '..', 'assets', 'NotoSansKannada-Bold.ttf');

const hasKannada = (s) => /[ಀ-೿]/.test(String(s || ''));
const body = (s) => (hasKannada(s) ? 'kn' : 'Helvetica');
const bold = (s) => (hasKannada(s) ? 'kn-bold' : 'Helvetica-Bold');

const SOURCE_LABEL = {
	llm: 'Composed by the model from retrieved records only',
	template: 'Composed directly from records (model not configured)',
	template_after_guardrail: 'Guardrail rejected the model answer; composed from records',
	template_after_llm_error: 'Model unavailable; composed from records',
	abstain: 'Abstained — no records matched',
};

/**
 * @param {object} payload  { turns: [{question, answer, citations, abstained, language, provenance}], role, user }
 * @param {import('stream').Writable} out  response stream to pipe into
 */
function render(payload, out) {
	const { turns = [], role, user } = payload;
	const doc = new PDFDocument({ size: 'A4', margins: { top: 64, bottom: 64, left: 56, right: 56 }, bufferPages: true });
	doc.pipe(out);

	doc.registerFont('kn', FONT_KN);
	doc.registerFont('kn-bold', FONT_KN_BOLD);

	// Watermark under the content of every page. Drawn on pageAdded so it sits beneath
	// whatever is written afterwards. save/restore covers graphics state only — font and
	// fontSize are doc-level in pdfkit — so both are reset explicitly, and the text is
	// placed with lineBreak off so the draw can never trigger a page break of its own.
	const watermark = () => {
		const { width, height } = doc.page;
		const { x, y } = doc;
		doc.save();
		doc.rotate(-38, { origin: [width / 2, height / 2] });
		doc.font('Helvetica-Bold').fontSize(46).fillColor('#000000').opacity(0.05);
		doc.text('SYNTHETIC DATA — CIPHER PROTOTYPE', 0, height / 2 - 30, { width, align: 'center', lineBreak: false });
		doc.restore().opacity(1);
		doc.font('Helvetica').fontSize(9.5).fillColor('#1c2b36');
		doc.x = x;
		doc.y = y;
	};
	watermark();
	doc.on('pageAdded', watermark);

	// ── header ────────────────────────────────────────────────────────────────
	doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f2a43').text('CIPHER — Conversation Export');
	doc.moveDown(0.2);
	doc.font('Helvetica').fontSize(10).fillColor('#5a6b7b')
		.text('Grounded crime intelligence · Karnataka State Police (prototype)');
	doc.moveDown(0.2);
	doc.fontSize(9).fillColor('#5a6b7b').text(
		`Exported ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC · role ${role || 'INVESTIGATOR'} · user ${user || 'demo-user'} · ${turns.length} turn${turns.length === 1 ? '' : 's'}`,
	);
	doc.moveDown(0.4);
	doc.fontSize(8.5).fillColor('#8a2222').text(
		'All records are synthetic, generated for the KSP Datathon 2026 prototype. No real police record, person or identifier appears in this document. Every answer below was composed only from retrieved records; citations are the 18-digit Crime Numbers and P-xxxx person identifiers of those records.',
	);
	rule(doc);

	// ── turns ─────────────────────────────────────────────────────────────────
	turns.forEach((t, i) => {
		// keep a question and at least the first lines of its answer together
		if (doc.y > doc.page.height - 200) doc.addPage();

		doc.moveDown(0.7);
		// The "Qn." prefix is Latin, so it gets Helvetica even when the question is Kannada.
		doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f2a43').text(`Q${i + 1}.  `, { continued: true });
		doc.font(bold(t.question)).text(t.question || '');
		doc.moveDown(0.3);

		const answer = String(t.answer || '');
		doc.font(body(answer)).fontSize(9.5).fillColor(t.abstained ? '#8a5a1e' : '#1c2b36').text(answer, { lineGap: 1.5 });

		const cits = Array.isArray(t.citations) ? t.citations : [];
		if (cits.length) {
			doc.moveDown(0.25);
			doc.font('Helvetica-Bold').fontSize(8).fillColor('#33566e').text('Evidence cited: ', { continued: true });
			doc.font('Helvetica').text(cits.join('   '));
		}

		const p = t.provenance || {};
		const provLine = [
			SOURCE_LABEL[p.source] || (t.abstained ? SOURCE_LABEL.abstain : null),
			p.guardrail?.blocked ? `guardrail: ${p.guardrail.reason}` : null,
			Number.isFinite(p.records_retrieved) ? `${p.records_retrieved} records retrieved` : null,
			Number.isFinite(p.latency_ms) ? `${p.latency_ms} ms` : null,
		].filter(Boolean).join(' · ');
		if (provLine) {
			doc.moveDown(0.15);
			doc.font('Helvetica').fontSize(7.5).fillColor('#7c8b98').text(provLine);
		}

		rule(doc);
	});

	// ── footer with page numbers (buffered pages) ─────────────────────────────
	// The footer sits below the bottom margin, which pdfkit treats as an overflow and
	// answers with an automatic page break — zeroing the margin for the write is the
	// documented way to keep the footer on the page it belongs to.
	const range = doc.bufferedPageRange();
	for (let i = range.start; i < range.start + range.count; i++) {
		doc.switchToPage(i);
		const savedBottom = doc.page.margins.bottom;
		doc.page.margins.bottom = 0;
		doc.font('Helvetica').fontSize(7.5).fillColor('#8a99a6');
		doc.text(
			`CIPHER prototype · synthetic records only · not for operational use — page ${i + 1} of ${range.count}`,
			56, doc.page.height - 42, { width: doc.page.width - 112, align: 'center', lineBreak: false },
		);
		doc.page.margins.bottom = savedBottom;
	}

	doc.end();
}

function rule(doc) {
	doc.moveDown(0.5);
	doc.save().strokeColor('#d6dee5').lineWidth(0.6)
		.moveTo(doc.page.margins.left, doc.y)
		.lineTo(doc.page.width - doc.page.margins.right, doc.y)
		.stroke().restore();
}

module.exports = { render };
