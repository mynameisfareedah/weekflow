import { jsPDF } from 'jspdf'
import type { ReportSnapshot } from './reportDocx.ts'
import { FIELD_SALES_TEMPLATE } from '../config/templates.ts'
import { getReportSectionDescriptors } from '../report/reportTemplateAdapter.ts'
import { mapReportSections, type MappedReportSection } from '../report/reportDataMapper.ts'

const WIDTH = 210
const HEIGHT = 297
const MARGIN = 17
const CONTENT = WIDTH - MARGIN * 2
const BODY: [number, number, number] = [42, 49, 41]
const MUTED: [number, number, number] = [105, 114, 104]
const ACCENT: [number, number, number] = [169, 95, 57]
const LINE: [number, number, number] = [214, 219, 211]
type PdfDocument = InstanceType<typeof jsPDF>

function dateLabel(date: string) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)) }
function addPage(pdf: PdfDocument, page: number) { if (page > 1) pdf.addPage('a4', 'portrait'); pdf.setDrawColor(...LINE); pdf.line(MARGIN, HEIGHT - 15, WIDTH - MARGIN, HEIGHT - 15); pdf.setFontSize(8); pdf.setTextColor(...MUTED); pdf.text('WeekFlow', MARGIN, HEIGHT - 10); pdf.text(`Page ${page}`, WIDTH - MARGIN, HEIGHT - 10, { align: 'right' }); return MARGIN }
function ensure(pdf: PdfDocument, y: number, amount: number, page: { value: number }) { if (y + amount <= HEIGHT - 22) return y; page.value += 1; return addPage(pdf, page.value) }
function heading(pdf: PdfDocument, number: string, value: string, y: number, page: { value: number }) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); const wrapped = pdf.splitTextToSize(value, CONTENT - 14) as string[]; const blockHeight = wrapped.length * 6 + 8; y = ensure(pdf, y, blockHeight, page); pdf.setFontSize(8); pdf.setTextColor(...ACCENT); pdf.text(number, MARGIN, y); pdf.setFontSize(15); pdf.setTextColor(...BODY); pdf.text(wrapped, MARGIN + 10, y); pdf.setDrawColor(...LINE); pdf.line(MARGIN, y + wrapped.length * 6 - 1, WIDTH - MARGIN, y + wrapped.length * 6 - 1); return y + blockHeight }
function bullet(pdf: PdfDocument, value: string, y: number, page: { value: number }) { const wrapped = pdf.splitTextToSize(value || 'Not recorded', CONTENT - 8) as string[]; y = ensure(pdf, y, wrapped.length * 4.5 + 3, page); pdf.setFillColor(...ACCENT); pdf.circle(MARGIN + 1.5, y - 1.2, 0.8, 'F'); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...BODY); pdf.text(wrapped, MARGIN + 6, y); return y + wrapped.length * 4.5 + 3 }
function filename(snapshot: ReportSnapshot) { const start = new Date(`${snapshot.weekKey}T12:00:00`); const end = new Date(start); end.setDate(start.getDate() + 4); const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(start); const template = snapshot.template ?? FIELD_SALES_TEMPLATE; const prefix = template.id === 'field-sales' ? 'Weekly_Field_Activity_Report' : `${template.name.replace(/[^a-z0-9]+/gi, '_')}_Weekly_Report`; return `${prefix}_${month}${start.getDate()}-${end.getDate()}-${start.getFullYear()}.pdf` }

function groupValue<T>(section: MappedReportSection | undefined, group: string): T[] {
  const value = section?.groups[group]
  return Array.isArray(value) ? value as T[] : []
}

function sectionText(section: MappedReportSection) {
  if (section.unsupportedGroups.length > 0) return section.presentation.emptyState
  const values = Object.values(section.groups)
  const count = values.reduce<number>((total, value) => total + (Array.isArray(value) ? value.length : 1), 0)
  return count > 0 ? `${count} mapped report item${count === 1 ? '' : 's'}.` : 'No report data recorded.'
}

export function buildReportPdf(snapshot: ReportSnapshot) {
  const template = snapshot.template ?? FIELD_SALES_TEMPLATE
  const sections = mapReportSections(snapshot, getReportSectionDescriptors(template), template)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const page = { value: 1 }
  let y = addPage(pdf, 1)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...ACCENT); pdf.text(`WEEKFLOW ${template.name.toUpperCase()} REPORTING`, MARGIN, y); y += 10
  pdf.setFontSize(23); pdf.setTextColor(...BODY); const titleLines = pdf.splitTextToSize(template.report.title.toUpperCase(), CONTENT) as string[]; pdf.text(titleLines, MARGIN, y); y += titleLines.length * 9; pdf.setDrawColor(...BODY); pdf.line(MARGIN, y, WIDTH - MARGIN, y); y += 9
  pdf.setFontSize(7); pdf.setTextColor(...MUTED); pdf.text('REPORTING WEEK', MARGIN, y); pdf.setFontSize(9); pdf.setTextColor(...BODY); pdf.text(snapshot.weekLabel, MARGIN, y + 5); y += 18
  for (const section of sections) {
    y = heading(pdf, String(section.order).padStart(2, '0'), section.title, y, page)
    if (template.id === 'small-business' && section.sectionId === 'business-summary') {
      const activities = groupValue<{ account: string; activityType: string; structuredOutcomes: Array<{ type: string }>; nextAction: string }>(section, 'dailyActivities')
      y = bullet(pdf, activities.length > 0 ? `${activities.length} business activities recorded.` : section.presentation.emptyState, y, page)
    } else if (template.id === 'small-business' && section.sectionId === 'daily-business-activity') {
      const activities = groupValue<{ date: string; activityType: string; account: string; outcome: string; intelligence: string; nextAction: string }>(section, 'dailyActivities')
      for (const day of snapshot.plan.days) {
        const records = activities.filter((activity) => activity.date === day.date)
        y = bullet(pdf, records.length > 0 ? `${day.label} ${dateLabel(day.date)}: ${records.map((activity) => [activity.activityType, activity.account, activity.outcome, activity.intelligence, activity.nextAction].filter(Boolean).join(' | ')).join(' || ')}` : `${day.label} ${dateLabel(day.date)}: No activity captured`, y, page)
      }
    } else if (template.id === 'small-business' && ['sales-opportunity-progress', 'customer-client-outcomes', 'orders-payments'].includes(section.sectionId)) {
      const allowed = section.sectionId === 'sales-opportunity-progress' ? ['Sale / Order Won', 'Lead Qualified'] : section.sectionId === 'customer-client-outcomes' ? ['Customer Retained', 'Follow-up Required'] : ['Payment Received']
      const outcomes = groupValue<{ type: string; details: string }>(section, 'outcomes').filter((outcome) => allowed.includes(outcome.type))
      y = bullet(pdf, outcomes.length > 0 ? outcomes.map((outcome) => `${outcome.type}: ${outcome.details || 'Details not recorded.'}`).join(' || ') : section.presentation.emptyState, y, page)
    } else if (template.id === 'small-business' && section.sectionId === 'supplier-operational-intelligence') {
      const intelligence = groupValue<{ account: string; type: string; details: string }>(section, 'intelligence')
      y = bullet(pdf, intelligence.length > 0 ? intelligence.map((item) => `${item.type}: ${item.details}`).join(' || ') : section.presentation.emptyState, y, page)
    } else if (template.id === 'small-business' && section.sectionId === 'priorities-coming-week') {
      const followUps = groupValue<{ task: string; status: string }>(section, 'followUps').filter((followUp) => followUp.status === 'open')
      y = bullet(pdf, followUps.length > 0 ? followUps.map((followUp) => followUp.task).join(' || ') : section.presentation.emptyState, y, page)
    } else if (template.id === 'small-business' && section.sectionId === 'completed-follow-ups') {
      const followUps = groupValue<{ task: string; status: string }>(section, 'followUps').filter((followUp) => followUp.status === 'completed')
      y = bullet(pdf, followUps.length > 0 ? followUps.map((followUp) => followUp.task).join(' || ') : section.presentation.emptyState, y, page)
    } else if (section.sectionId === 'daily-activity-breakdown') {
      const activities = groupValue<{ date: string; activityType: string; account: string; hcpNames: string[]; outcome: string; intelligence: string; nextAction: string }>(section, 'dailyActivities')
      for (const day of snapshot.plan.days) {
        const records = activities.filter((activity) => activity.date === day.date)
        const text = records.length > 0 ? records.map((activity) => [activity.activityType, activity.account, activity.hcpNames.join(', '), activity.outcome, activity.intelligence, activity.nextAction].filter(Boolean).join(' | ')).join(' || ') : 'No activity captured'
        y = bullet(pdf, `${day.label} ${dateLabel(day.date)}: ${text}`, y, page)
      }
    } else if (section.sectionId === 'priorities-coming-week') {
      const followUps = groupValue<{ task: string; status: string }>(section, 'followUps')
      y = bullet(pdf, followUps.length > 0 ? `${followUps.filter((followUp) => followUp.status === 'open').length} open follow-up(s) recorded.` : 'No open follow-ups recorded.', y, page)
    } else if (section.sectionId === 'completed-follow-ups') {
      const followUps = groupValue<{ status: string }>(section, 'followUps')
      y = bullet(pdf, followUps.some((followUp) => followUp.status === 'completed') ? 'Completed follow-ups recorded.' : 'No completed follow-ups recorded.', y, page)
    } else {
      y = bullet(pdf, sectionText(section), y, page)
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
