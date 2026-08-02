/**
 * Test fixtures: a realistic discharge summary, as both plain text and a real
 * PDF with a genuine text layer.
 *
 * The PDF is generated here rather than committed as a binary so the source of
 * truth stays readable and reviewable, and so tests never reach into another
 * package's internals for a sample file.
 *
 * The clinical content is synthetic but structured the way real discharge
 * paperwork is — abbreviations, mixed date formats, relative follow-ups
 * ("in 2 weeks"), and red-flag instructions — so the extraction stages are
 * exercised against the messiness they actually have to handle.
 */

/** Line-for-line source text. Line N here is line N in OCR output. */
export const DISCHARGE_SUMMARY_LINES: string[] = [
  "BAYVIEW GENERAL HOSPITAL",
  "DISCHARGE SUMMARY",
  "",
  "Patient: Sarah Chen          MRN: 40921",
  "Admitted: 07/29/2026         Discharged: 07/31/2026",
  "",
  "PRIMARY DIAGNOSIS:",
  "S72.001A Fracture of the neck of the right femur, initial encounter.",
  "",
  "PROCEDURE PERFORMED:",
  "Open reduction and internal fixation (ORIF) of the right femoral neck",
  "with three cannulated screws. No intraoperative complications.",
  "",
  "DISCHARGE MEDICATIONS:",
  "1. Amoxicillin 500 mg capsule - take one capsule by mouth three times",
  "   daily for 7 days. Take with food to reduce stomach upset.",
  "2. Oxycodone 5 mg tablet - one tablet by mouth every 6 hours as needed",
  "   for pain. Do not drive or drink alcohol while taking this.",
  "3. Docusate sodium 100 mg - one capsule by mouth each morning with a",
  "   full glass of water, to prevent constipation from the pain medicine.",
  "4. Aspirin 81 mg - one tablet by mouth daily with food for 30 days to",
  "   reduce the risk of blood clots.",
  "",
  "ACTIVITY AND RESTRICTIONS:",
  "Weight-bearing as tolerated on the right leg using a walker.",
  "Do not lift anything heavier than 10 pounds.",
  "Walk for 10 to 15 minutes three times a day.",
  "Do not drive until cleared by your surgeon.",
  "Showers are permitted after 48 hours. Do not submerge the incision.",
  "",
  "FOLLOW-UP APPOINTMENTS:",
  "Orthopedic clinic with Dr. Elena Marsh on 08/09/2026 at 10:30 AM,",
  "Bayview Orthopedic Associates, 412 Harborview Drive, Suite 220.",
  "Physical therapy evaluation with Dr. Rajiv Patel in 2 weeks at",
  "Cornerstone Physical Therapy.",
  "",
  "WHEN TO SEEK HELP:",
  "Call the clinic for a temperature above 101 F, increasing redness or",
  "drainage from the incision, or pain not controlled by your medicine.",
  "Go to the emergency department or call 911 for chest pain, shortness",
  "of breath, or sudden swelling in the calf.",
];

export const DISCHARGE_SUMMARY_TEXT = DISCHARGE_SUMMARY_LINES.join("\n");

/** Escapes the three characters that are special inside a PDF literal string. */
function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Builds a single-page (or multi-page) PDF with a real, extractable text layer.
 * Deliberately hand-rolled so tests have zero extra dependencies and so the
 * byte layout — including a correct xref table — is exercised end to end.
 */
export function makeTextPdf(lines: string[] = DISCHARGE_SUMMARY_LINES): Buffer {
  const LINES_PER_PAGE = 46;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }
  if (pages.length === 0) pages.push([""]);

  // Object numbering: 1 = Catalog, 2 = Pages, 3 = Font,
  // then per page: a Page object followed by its Contents stream.
  const firstPageObj = 4;
  const pageObjNumbers = pages.map((_, i) => firstPageObj + i * 2);

  const objects: string[] = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [${pageObjNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
  ];

  pages.forEach((pageLines, index) => {
    const contentsObjNumber = pageObjNumbers[index] + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentsObjNumber} 0 R >>`,
    );

    const body =
      `BT\n/F1 11 Tf\n54 738 Td\n15 TL\n` +
      pageLines.map((line) => `(${escapePdfText(line)}) Tj T*`).join("\n") +
      `\nET`;
    objects.push(`<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

/** A PDF with no extractable text, standing in for a scanned document. */
export function makeImageOnlyPdf(): Buffer {
  return makeTextPdf([" "]);
}
