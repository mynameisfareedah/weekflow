import { jsPDF } from 'jspdf'
import type { ReportSnapshot } from './reportDocx.ts'
import { FIELD_SALES_TEMPLATE } from '../config/templates.ts'
import { buildNarrativeReport } from '../report/reportNarrative.ts'
import { getReportSectionDescriptors } from '../report/reportTemplateAdapter.ts'
import { mapReportSections } from '../report/reportDataMapper.ts'
import { getReportIdentitySlug, getReportMetadataFields, getReportMetadataLines } from '../report/reportMetadata.ts'

const WIDTH = 210
const HEIGHT = 297
const MARGIN = 17
const CONTENT = WIDTH - MARGIN * 2
const BODY: [number, number, number] = [42, 49, 41]
const MUTED: [number, number, number] = [105, 114, 104]
const ACCENT: [number, number, number] = [169, 95, 57]
const LINE: [number, number, number] = [214, 219, 211]
type PdfDocument = InstanceType<typeof jsPDF>
function addPage(pdf: PdfDocument, page: number) { if (page > 1) pdf.addPage('a4', 'portrait'); pdf.setDrawColor(...LINE); pdf.line(MARGIN, HEIGHT - 15, WIDTH - MARGIN, HEIGHT - 15); pdf.setFontSize(8); pdf.setTextColor(...MUTED); pdf.text('WeekFlow', MARGIN, HEIGHT - 10); pdf.text(`Page ${page}`, WIDTH - MARGIN, HEIGHT - 10, { align: 'right' }); return MARGIN }
function ensure(pdf: PdfDocument, y: number, amount: number, page: { value: number }) { if (y + amount <= HEIGHT - 22) return y; page.value += 1; return addPage(pdf, page.value) }
function heading(pdf: PdfDocument, number: string, value: string, y: number, page: { value: number }) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); const wrapped = pdf.splitTextToSize(value, CONTENT - 14) as string[]; const blockHeight = wrapped.length * 6 + 8; y = ensure(pdf, y, blockHeight, page); pdf.setFontSize(8); pdf.setTextColor(...ACCENT); pdf.text(number, MARGIN, y); pdf.setFontSize(15); pdf.setTextColor(...BODY); pdf.text(wrapped, MARGIN + 10, y); pdf.setDrawColor(...LINE); pdf.line(MARGIN, y + wrapped.length * 6 - 1, WIDTH - MARGIN, y + wrapped.length * 6 - 1); return y + blockHeight }
function bullet(pdf: PdfDocument, value: string, y: number, page: { value: number }) { const wrapped = pdf.splitTextToSize(value || 'Not recorded', CONTENT - 8) as string[]; y = ensure(pdf, y, wrapped.length * 4.5 + 3, page); pdf.setFillColor(...ACCENT); pdf.circle(MARGIN + 1.5, y - 1.2, 0.8, 'F'); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...BODY); pdf.text(wrapped, MARGIN + 6, y); return y + wrapped.length * 4.5 + 3 }
function filename(snapshot: ReportSnapshot) { const start = new Date(`${snapshot.weekKey}T12:00:00`); const end = new Date(start); end.setDate(start.getDate() + (snapshot.template?.id === 'field-sales' ? 4 : 6)); const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(start); const template = snapshot.template ?? FIELD_SALES_TEMPLATE; const prefix = template.id === 'field-sales' ? `${getReportIdentitySlug(snapshot.reportMetadata)}_Weekly_Field_Activity_Report` : `${template.name.replace(/[^a-z0-9]+/gi, '_')}_Weekly_Report`; return `${prefix}_${month}${start.getDate()}-${end.getDate()}-${start.getFullYear()}.pdf` }

export function buildReportPdf(snapshot: ReportSnapshot) {
  const template = snapshot.template ?? FIELD_SALES_TEMPLATE
  const narrative = buildNarrativeReport(snapshot)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const page = { value: 1 }
  let y = addPage(pdf, 1)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...ACCENT); pdf.text(template.name.toUpperCase(), MARGIN, y); y += 10
  pdf.setFontSize(23); pdf.setTextColor(...BODY); const titleLines = pdf.splitTextToSize(narrative.title, CONTENT) as string[]; pdf.text(titleLines, MARGIN, y); y += titleLines.length * 9; pdf.setDrawColor(...BODY); pdf.line(MARGIN, y, WIDTH - MARGIN, y); y += 9
  pdf.setFontSize(9); pdf.setTextColor(...BODY); pdf.text(`Reporting Week: ${narrative.weekLabel}`, MARGIN, y); y += 12
  const metadataFields = getReportMetadataFields(template.id)
  if (metadataFields.length > 0) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...BODY)
    for (const line of getReportMetadataLines(snapshot.reportMetadata, metadataFields)) {
      const lines = pdf.splitTextToSize(line, CONTENT) as string[]
      pdf.text(lines, MARGIN, y)
      y += lines.length * 4.5 + 1
    }
    y += 3
  }
  if (template.id === 'custom') {
    const sections = mapReportSections(snapshot, getReportSectionDescriptors(template, snapshot.customReportConfig?.reportSections), template)
    for (const [index, section] of sections.entries()) {
      y = heading(pdf, String(index + 1).padStart(2, '0'), section.title, y, page)
      const values = Object.values(section.groups).find((value) => Array.isArray(value) && value.length > 0) as unknown[] | undefined
      if (values && values.length > 0) {
        for (const value of values) {
          const record = value as Record<string, unknown>
          const text = typeof value === 'object' && value && 'account' in value
            ? [record.date, record.account, record.outcome, record.nextAction].filter(Boolean).join(' | ')
            : typeof value === 'object' && value && 'task' in value
              ? [record.task, record.status, record.dueDate ? `Due ${record.dueDate}` : ''].filter(Boolean).join(' | ')
              : String(value)
          y = bullet(pdf, text, y, page)
        }
      } else y = bullet(pdf, 'No data recorded.', y, page)
    }
    return pdf
  }
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(...BODY); pdf.text(narrative.summaryText, MARGIN, y, { maxWidth: CONTENT }); y += 12
  for (const section of narrative.sections) {
    y = heading(pdf, String(section.order).padStart(2, '0'), section.title, y, page)
    if (section.items.length === 0) {
      y = bullet(pdf, section.emptyText, y, page)
      continue
    }
    for (const item of section.items) {
      y = bullet(pdf, `${item.title}: ${item.summary}`, y, page)
      if (item.detail) y = bullet(pdf, item.detail, y, page)
    }
  }
  return pdf
}

export function getReportPdfFilename(snapshot: ReportSnapshot) {
  return filename(snapshot)
}

export function exportReportPdf(snapshot: ReportSnapshot) {
  const pdf = buildReportPdf(snapshot)
  pdf.save(filename(snapshot))
  return { filename: filename(snapshot), pageCount: pdf.getNumberOfPages() }
}
