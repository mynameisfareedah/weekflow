import { jsPDF } from 'jspdf'
import type { DailyActivity } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { DayPlan, WeeklyPlan } from '../types/weeklyPlan'

export interface ReportSnapshot {
  weekKey: string
  weekLabel: string
  plan: WeeklyPlan
  activities: DailyActivity[]
  followUps: FollowUp[]
  preparedBy: string
  role: string
  company: string
  portfolio: string
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 17
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_Y = PAGE_HEIGHT - 10
const BODY_COLOR: [number, number, number] = [42, 49, 41]
const MUTED_COLOR: [number, number, number] = [105, 114, 104]
const ACCENT_COLOR: [number, number, number] = [169, 95, 57]
const LINE_COLOR: [number, number, number] = [214, 219, 211]
const TINT_COLOR: [number, number, number] = [238, 240, 233]

type PdfDocument = InstanceType<typeof jsPDF>

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function formatDueDate(date?: string) {
  return date ? formatDate(date) : ''
}

function dayActivities(day: DayPlan, activities: DailyActivity[]) {
  return activities.filter((activity) => activity.date === day.date)
}

function textLines(pdf: PdfDocument, text: string, width: number) {
  return pdf.splitTextToSize(text || 'Not recorded', width) as string[]
}

function drawFooter(pdf: PdfDocument, pageNumber: number) {
  pdf.setDrawColor(...LINE_COLOR)
  pdf.line(MARGIN, FOOTER_Y - 5, PAGE_WIDTH - MARGIN, FOOTER_Y - 5)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED_COLOR)
  pdf.text('WeekFlow | Weekly Field Activity Report', MARGIN, FOOTER_Y)
  pdf.text(`Page ${pageNumber}`, PAGE_WIDTH - MARGIN, FOOTER_Y, { align: 'right' })
}

function addPage(pdf: PdfDocument, pageNumber: number) {
  if (pdf.getNumberOfPages() > 1) pdf.addPage('a4', 'portrait')
  drawFooter(pdf, pageNumber)
  return MARGIN
}

function ensureSpace(pdf: PdfDocument, y: number, height: number, pageNumber: { value: number }, minimum = 0) {
  if (y + height <= PAGE_HEIGHT - 22) return y
  pageNumber.value += 1
  y = addPage(pdf, pageNumber.value)
  return y + minimum
}

function drawSectionHeading(pdf: PdfDocument, number: string, eyebrow: string, title: string, y: number, pageNumber: { value: number }) {
  y = ensureSpace(pdf, y, 18, pageNumber)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...ACCENT_COLOR)
  pdf.text(number, MARGIN, y)
  pdf.setFontSize(7)
  pdf.text(eyebrow.toUpperCase(), MARGIN + 10, y)
  y += 5
  pdf.setFontSize(15)
  pdf.setTextColor(...BODY_COLOR)
  pdf.text(title, MARGIN + 10, y)
  y += 5
  pdf.setDrawColor(...LINE_COLOR)
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  return y + 8
}

function drawBullet(pdf: PdfDocument, text: string, y: number, pageNumber: { value: number }, color = BODY_COLOR) {
  const lines = textLines(pdf, text, CONTENT_WIDTH - 8)
  y = ensureSpace(pdf, y, lines.length * 4.5 + 3, pageNumber)
  pdf.setFillColor(...ACCENT_COLOR)
  pdf.circle(MARGIN + 1.5, y - 1.2, 0.8, 'F')
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...color)
  pdf.text(lines, MARGIN + 6, y)
  return y + lines.length * 4.5 + 3
}

function drawLabeledText(pdf: PdfDocument, label: string, text: string, x: number, y: number, width: number, pageNumber: { value: number }) {
  const lines = textLines(pdf, text, width)
  y = ensureSpace(pdf, y, lines.length * 4.2 + 8, pageNumber)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(...MUTED_COLOR)
  pdf.text(label.toUpperCase(), x, y)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor(...BODY_COLOR)
  pdf.text(lines, x, y + 4)
  return y + lines.length * 4.2 + 8
}

function drawDailyTable(pdf: PdfDocument, plan: WeeklyPlan, activities: DailyActivity[], y: number, pageNumber: { value: number }) {
  const columns = [
    { label: 'Day', width: 20 },
    { label: 'Facilities Visited', width: 34 },
    { label: 'Doctors Engaged', width: 37 },
    { label: 'Outcome of Visit', width: 43 },
    { label: 'Key Intelligence / Next Action', width: 49 },
  ]
  const headerHeight = 10
  const rowPadding = 3
  const drawHeader = () => {
    pdf.setFillColor(...TINT_COLOR)
    pdf.setDrawColor(...LINE_COLOR)
    pdf.rect(MARGIN, y, CONTENT_WIDTH, headerHeight, 'FD')
    let x = MARGIN
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.4)
    pdf.setTextColor(...MUTED_COLOR)
    columns.forEach((column) => {
      pdf.text(column.label.toUpperCase(), x + 2, y + 6)
      x += column.width
    })
    y += headerHeight
  }

  y = ensureSpace(pdf, y, headerHeight + 15, pageNumber)
  drawHeader()
  plan.days.forEach((day) => {
    const records = dayActivities(day, activities)
    const cells = records.length > 0 ? [
      `${day.label}\n${formatDate(day.date)}`,
      unique(records.map((activity) => activity.account)).join(', '),
      unique(records.flatMap((activity) => activity.hcpNames)).join(', ') || 'Not recorded',
      records.map((activity) => activity.outcome).filter(Boolean).join(' ') || 'Not recorded',
      records.flatMap((activity) => [activity.intelligence, activity.nextAction]).filter(Boolean).join(' ') || 'Not recorded',
    ] : [
      `${day.label}\n${formatDate(day.date)}`, 'No activity captured', 'Not recorded', 'Not recorded', 'Not recorded',
    ]
    const wrapped = cells.map((cell, index) => textLines(pdf, cell, columns[index].width - rowPadding * 2))
    const rowHeight = Math.max(...wrapped.map((lines) => lines.length)) * 3.6 + rowPadding * 2 + 2
    if (y + rowHeight > PAGE_HEIGHT - 22) {
      pageNumber.value += 1
      y = addPage(pdf, pageNumber.value)
      drawHeader()
    }
    pdf.setDrawColor(...LINE_COLOR)
    pdf.rect(MARGIN, y, CONTENT_WIDTH, rowHeight)
    let x = MARGIN
    wrapped.forEach((lines, index) => {
      if (index > 0) pdf.line(x, y, x, y + rowHeight)
      pdf.setFont('helvetica', index === 0 ? 'bold' : 'normal')
      pdf.setFontSize(index === 0 ? 7.2 : 7.1)
      pdf.setTextColor(...(index === 0 ? BODY_COLOR : MUTED_COLOR))
      pdf.text(lines, x + rowPadding, y + rowPadding + 3)
      x += columns[index].width
    })
    y += rowHeight
  })
  return y + 8
}

function drawStructuredOutcomes(pdf: PdfDocument, activities: DailyActivity[], y: number, pageNumber: { value: number }) {
  const outcomes = activities.flatMap((activity) => activity.structuredOutcomes.map((outcome) => ({ ...outcome, account: activity.account })))
  if (outcomes.length === 0) return y
  y = drawSectionHeading(pdf, '04', 'Structured intelligence', 'Key Commercial / Patient-Journey Outcomes', y, pageNumber)
  outcomes.forEach((outcome) => {
    y = ensureSpace(pdf, y, 16, pageNumber)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...BODY_COLOR)
    pdf.text(outcome.type, MARGIN, y)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED_COLOR)
    pdf.text(outcome.account, MARGIN, y + 4)
    y = drawLabeledText(pdf, 'Details', [outcome.product, outcome.quantity ? `Quantity: ${outcome.quantity}` : '', outcome.stockStatus, outcome.details].filter(Boolean).join(' - ') || 'Details not recorded.', MARGIN + 38, y, CONTENT_WIDTH - 38, pageNumber)
    y += 2
  })
  return y
}

export function exportReportPdf(snapshot: ReportSnapshot) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageNumber = { value: 1 }
  let y = addPage(pdf, pageNumber.value)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...ACCENT_COLOR)
  pdf.text('WEEKFLOW FIELD REPORTING', MARGIN, y)
  y += 10
  pdf.setFontSize(23)
  pdf.setTextColor(...BODY_COLOR)
  pdf.text("THIS WEEK'S FIELD ACTIVITY REPORT", MARGIN, y)
  y += 9
  pdf.setDrawColor(...BODY_COLOR)
  pdf.setLineWidth(0.7)
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 9

  const metadata = [
    ['Reporting week', snapshot.weekLabel],
    ['Prepared by', snapshot.preparedBy],
    ['Role', snapshot.role],
    ['Company', snapshot.company],
    ['Portfolio', snapshot.portfolio],
  ]
  const metadataWidth = CONTENT_WIDTH / 2
  metadata.forEach(([label, value], index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = MARGIN + column * metadataWidth
    const rowY = y + row * 12
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(...MUTED_COLOR)
    pdf.text(label.toUpperCase(), x, rowY)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(...BODY_COLOR)
    pdf.text(textLines(pdf, value, metadataWidth - 5), x, rowY + 5)
  })
  y += 36

  y = drawSectionHeading(pdf, '01', 'The week at a glance', 'Activities Summary', y, pageNumber)
  const facilities = unique(snapshot.activities.map((activity) => activity.account))
  const physicalVisits = snapshot.activities.filter((activity) => activity.activityType === 'Physical Visit').length
  const virtualEngagements = snapshot.activities.filter((activity) => activity.activityType === 'Virtual Engagement').length
  const structuredTypes = unique(snapshot.activities.flatMap((activity) => activity.structuredOutcomes.map((outcome) => outcome.type.toLowerCase())))
  const summaryLines = [
    facilities.length > 0 ? `Field coverage recorded across ${facilities.length} account${facilities.length === 1 ? '' : 's'}: ${facilities.join(', ')}.` : '',
    physicalVisits > 0 ? `${physicalVisits} physical visit${physicalVisits === 1 ? '' : 's'} captured.` : '',
    virtualEngagements > 0 ? `${virtualEngagements} virtual engagement${virtualEngagements === 1 ? '' : 's'} captured.` : '',
    structuredTypes.length > 0 ? `Structured outcomes included ${structuredTypes.join(', ')}.` : '',
  ].filter(Boolean)
  if (summaryLines.length === 0) summaryLines.push('No Daily Activity has been captured for this week yet.')
  summaryLines.forEach((line) => { y = drawBullet(pdf, line, y, pageNumber) })

  y = drawSectionHeading(pdf, '02', 'What happened each day', 'Daily Activity Breakdown', y + 5, pageNumber)
  y = drawDailyTable(pdf, snapshot.plan, snapshot.activities, y, pageNumber)

  const virtualActivities = snapshot.activities.filter((activity) => activity.activityType === 'Virtual Engagement')
  if (virtualActivities.length > 0) {
    y = drawSectionHeading(pdf, '03', 'Remote coverage', 'Virtual Engagements', y, pageNumber)
    virtualActivities.forEach((activity) => {
      y = ensureSpace(pdf, y, 24, pageNumber)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(...BODY_COLOR)
      pdf.text(activity.account, MARGIN, y)
      y += 6
      y = drawLabeledText(pdf, 'Doctors engaged', activity.hcpNames.join(', ') || 'Not recorded', MARGIN, y, CONTENT_WIDTH, pageNumber)
      y = drawLabeledText(pdf, 'Outcome', activity.outcome || 'Not recorded', MARGIN, y, CONTENT_WIDTH, pageNumber)
      y = drawLabeledText(pdf, 'Next action', activity.nextAction || 'Not recorded', MARGIN, y, CONTENT_WIDTH, pageNumber)
    })
  }

  y = drawStructuredOutcomes(pdf, snapshot.activities, y, pageNumber)
  const intelligence = unique(snapshot.activities.flatMap((activity) => activity.intelligence ? [`${activity.account}: ${activity.intelligence}`] : []))
  const plannedPriorities = unique(snapshot.plan.days.flatMap((day) => day.categories.commercialPriorities.map((item) => item.text)))
  const intelligenceItems = [...intelligence, ...plannedPriorities]
  if (intelligenceItems.length > 0) {
    y = drawSectionHeading(pdf, '05', 'Account-level context', 'Strategic Account Intelligence', y, pageNumber)
    intelligenceItems.forEach((item) => { y = drawBullet(pdf, item, y, pageNumber) })
  }

  const openFollowUps = snapshot.followUps.filter((followUp) => followUp.status === 'open')
  const completedFollowUps = snapshot.followUps.filter((followUp) => followUp.status === 'completed')
  y = drawSectionHeading(pdf, '06', 'Carry-forward actions', 'Priorities for the Coming Week', y, pageNumber)
  y = ensureSpace(pdf, y, 12, pageNumber)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(...BODY_COLOR)
  pdf.text('PRIORITIES FOR NEXT WEEK', MARGIN, y)
  y += 6
  if (openFollowUps.length > 0) {
    openFollowUps.forEach((followUp) => {
      const context = [followUp.facility, followUp.hcpName, followUp.dueDate ? `Due ${formatDueDate(followUp.dueDate)}` : ''].filter(Boolean).join(' | ')
      y = drawBullet(pdf, `${followUp.priority === 'high' ? 'HIGH: ' : ''}${followUp.task}${context ? ` (${context})` : ''}`, y, pageNumber, followUp.priority === 'high' ? ACCENT_COLOR : BODY_COLOR)
    })
  } else {
    y = drawBullet(pdf, 'No open follow-ups recorded.', y, pageNumber)
  }
  y += 4
  y = ensureSpace(pdf, y, 12, pageNumber)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(...BODY_COLOR)
  pdf.text('COMPLETED THIS WEEK', MARGIN, y)
  y += 6
  if (completedFollowUps.length > 0) {
    completedFollowUps.forEach((followUp) => { y = drawBullet(pdf, followUp.task, y, pageNumber) })
  } else {
    y = drawBullet(pdf, 'No completed follow-ups recorded.', y, pageNumber)
  }

  const safeName = snapshot.preparedBy === 'Not configured' ? 'WeekFlow' : snapshot.preparedBy.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')
  const start = new Date(`${snapshot.weekKey}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  const filename = `${safeName}_Weekly_Field_Activity_Report_${new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(start).replace(' ', '')}-${new Intl.DateTimeFormat('en-US', { month: '2-digit', day: 'numeric', year: 'numeric' }).format(end).replace(/ /g, '').replace(',', '-')}.pdf`
  pdf.save(filename)
  return { filename, pageCount: pdf.getNumberOfPages() }
}
