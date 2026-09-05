import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import type { DailyActivity } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { DayPlan, WeeklyPlan } from '../types/weeklyPlan'

export interface ReportSnapshot {
  weekKey: string
  weekLabel: string
  plan: WeeklyPlan
  activities: DailyActivity[]
  followUps: FollowUp[]
}

export const REPORT_METADATA = {
  preparedBy: 'WAHEED YUSUF',
  role: 'Field Sales Manager - Key Account WWCV (Johnson & Johnson)',
  portfolio: 'ZYTIGA® | INVEGA SUSTENNA® | TRIVECTA®',
} as const

const PAGE_WIDTH_TWIPS = 11906
const PAGE_HEIGHT_TWIPS = 16838
const MARGIN_TWIPS = 720
const CONTENT_WIDTH_TWIPS = PAGE_WIDTH_TWIPS - (MARGIN_TWIPS * 2)
const DAILY_TABLE_COLUMN_WIDTHS = [
  Math.round(CONTENT_WIDTH_TWIPS * 0.11),
  Math.round(CONTENT_WIDTH_TWIPS * 0.18),
  Math.round(CONTENT_WIDTH_TWIPS * 0.18),
  Math.round(CONTENT_WIDTH_TWIPS * 0.21),
  CONTENT_WIDTH_TWIPS - Math.round(CONTENT_WIDTH_TWIPS * 0.11) - Math.round(CONTENT_WIDTH_TWIPS * 0.18) - Math.round(CONTENT_WIDTH_TWIPS * 0.18) - Math.round(CONTENT_WIDTH_TWIPS * 0.21),
]

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${dateString}T12:00:00`))
}

function formatWeekRange(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)
  return `${startLabel} - ${endLabel}`
}

function getDayActivities(day: DayPlan, activities: DailyActivity[]) {
  return activities.filter((activity) => activity.date === day.date)
}

function summaryLines(snapshot: ReportSnapshot) {
  const facilities = unique(snapshot.activities.map((activity) => activity.account))
  const physicalVisits = snapshot.activities.filter((activity) => activity.activityType === 'Physical Visit').length
  const virtualEngagements = snapshot.activities.filter((activity) => activity.activityType === 'Virtual Engagement').length
  const structuredTypes = unique(snapshot.activities.flatMap((activity) => activity.structuredOutcomes.map((outcome) => outcome.type.toLowerCase())))
  const openFollowUps = snapshot.followUps.filter((followUp) => followUp.status === 'open').length

  const lines: string[] = []
  if (facilities.length > 0) lines.push(`Field coverage recorded across ${facilities.length} account${facilities.length === 1 ? '' : 's'}: ${facilities.join(', ')}.`)
  if (physicalVisits > 0) lines.push(`${physicalVisits} physical visit${physicalVisits === 1 ? '' : 's'} captured.`)
  if (virtualEngagements > 0) lines.push(`${virtualEngagements} virtual engagement${virtualEngagements === 1 ? '' : 's'} captured.`)
  if (structuredTypes.length > 0) lines.push(`Structured outcomes included ${structuredTypes.join(', ')}.`)
  if (openFollowUps > 0) lines.push(`${openFollowUps} open follow-up${openFollowUps === 1 ? '' : 's'} remain for the coming week.`)
  return lines.length > 0 ? lines : ['No Daily Activity has been captured for this week yet.']
}

type HeadingLevelValue = (typeof HeadingLevel)[keyof typeof HeadingLevel]
type AlignmentTypeValue = (typeof AlignmentType)[keyof typeof AlignmentType]

function buildSectionHeading(text: string, headingLevel: HeadingLevelValue = HeadingLevel.HEADING_2): Paragraph {
  return new Paragraph({
    heading: headingLevel,
    children: [new TextRun({ text, bold: true })],
    spacing: { before: 180, after: 120 },
  })
}

function buildTextParagraph(text: string, bold = false, italic = false) {
  return new Paragraph({
    children: [
      new TextRun({
        text: text || 'Not recorded',
        bold,
        italics: italic,
      }),
    ],
    spacing: { after: 80 },
  })
}

function buildBulletParagraph(text: string, indentLevel = 0) {
  return new Paragraph({
    text,
    bullet: { level: indentLevel },
    spacing: { after: 80 },
  })
}

function tableCell(text: string, options: { bold?: boolean; shading?: string; width: number; alignment?: AlignmentTypeValue; verticalAlign?: 'top' | 'center' }) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: text || 'Not recorded', bold: options.bold ?? false, size: 18 })],
      alignment: options.alignment ?? AlignmentType.LEFT,
      spacing: { before: 0, after: 0, line: 240 },
    })],
    shading: options.shading ? { fill: options.shading } : undefined,
    width: { size: options.width, type: WidthType.DXA },
    verticalAlign: options.verticalAlign ?? VerticalAlign.TOP,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'C9D1C8' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C9D1C8' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'C9D1C8' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'C9D1C8' },
    },
  })
}

function textCell(text: string, width: number, isDay = false) {
  return tableCell(text, {
    width,
    alignment: isDay ? AlignmentType.CENTER : AlignmentType.LEFT,
    verticalAlign: isDay ? VerticalAlign.CENTER : VerticalAlign.TOP,
  })
}

function buildDailyTable(snapshot: ReportSnapshot) {
  const rows = [
    new TableRow({
      children: [
        tableCell('Day', { bold: true, shading: 'F3F5F0', width: DAILY_TABLE_COLUMN_WIDTHS[0], alignment: AlignmentType.CENTER, verticalAlign: VerticalAlign.CENTER }),
        tableCell('Facilities Visited', { bold: true, shading: 'F3F5F0', width: DAILY_TABLE_COLUMN_WIDTHS[1], alignment: AlignmentType.CENTER, verticalAlign: VerticalAlign.CENTER }),
        tableCell('Doctors Engaged', { bold: true, shading: 'F3F5F0', width: DAILY_TABLE_COLUMN_WIDTHS[2], alignment: AlignmentType.CENTER, verticalAlign: VerticalAlign.CENTER }),
        tableCell('Outcome of Visit', { bold: true, shading: 'F3F5F0', width: DAILY_TABLE_COLUMN_WIDTHS[3], alignment: AlignmentType.CENTER, verticalAlign: VerticalAlign.CENTER }),
        tableCell('Key Intelligence / Next Action', { bold: true, shading: 'F3F5F0', width: DAILY_TABLE_COLUMN_WIDTHS[4], alignment: AlignmentType.CENTER, verticalAlign: VerticalAlign.CENTER }),
      ],
      cantSplit: true,
    }),
  ]

  snapshot.plan.days.forEach((day) => {
    const records = getDayActivities(day, snapshot.activities)
    const cells = records.length > 0
      ? [
        `${day.label}\n${formatDate(day.date)}`,
        unique(records.map((activity) => activity.account)).join(', ') || 'No activity captured',
        unique(records.flatMap((activity) => activity.hcpNames)).join(', ') || 'Not recorded',
        records.map((activity) => activity.outcome).filter(Boolean).join(' ') || 'Not recorded',
        records.flatMap((activity) => [activity.intelligence, activity.nextAction]).filter(Boolean).join(' ') || 'Not recorded',
      ]
      : [
        `${day.label}\n${formatDate(day.date)}`,
        'No activity captured',
        'Not recorded',
        'Not recorded',
        'Not recorded',
      ]

    rows.push(new TableRow({
      children: cells.map((cell, index) => textCell(cell, DAILY_TABLE_COLUMN_WIDTHS[index], index === 0)),
    }))
  })

  return new Table({
    rows,
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: 'AEB8AC' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AEB8AC' },
      left: { style: BorderStyle.SINGLE, size: 6, color: 'AEB8AC' },
      right: { style: BorderStyle.SINGLE, size: 6, color: 'AEB8AC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'D8DED7' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'D8DED7' },
    },
    layout: TableLayoutType.FIXED,
  })
}

function buildFollowUps(snapshot: ReportSnapshot) {
  const openFollowUps = snapshot.followUps.filter((followUp) => followUp.status === 'open')
  const completedFollowUps = snapshot.followUps.filter((followUp) => followUp.status === 'completed')

  const content: Paragraph[] = []
  content.push(buildSectionHeading('6. Priorities for the Coming Week'))
  content.push(buildTextParagraph('Open follow-ups:'))
  if (openFollowUps.length > 0) {
    openFollowUps.forEach((followUp) => {
      const details = [followUp.facility, followUp.hcpName, followUp.dueDate ? `Due ${formatDate(followUp.dueDate)}` : ''].filter(Boolean).join(' | ')
      content.push(buildBulletParagraph(`${followUp.priority === 'high' ? 'HIGH: ' : ''}${followUp.task}${details ? ` (${details})` : ''}`))
    })
  } else {
    content.push(buildTextParagraph('No open follow-ups recorded.'))
  }

  content.push(buildSectionHeading('7. Completed Follow-ups'))
  if (completedFollowUps.length > 0) {
    completedFollowUps.forEach((followUp) => {
      content.push(buildBulletParagraph(followUp.task))
    })
  } else {
    content.push(buildTextParagraph('No completed follow-ups recorded.'))
  }

  return content
}

function buildDocument(snapshot: ReportSnapshot) {
  const documentSections: (Paragraph | Table)[] = []

  documentSections.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'WEEKFLOW FIELD REPORTING', bold: true, color: 'A55F39', size: 17 }),
      ],
      spacing: { after: 120 },
    }),
  )

  documentSections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "THIS WEEK'S FIELD ACTIVITY REPORT", bold: true, size: 30, color: '2B2D2B' }),
      ],
      spacing: { after: 120 },
    }),
  )

  documentSections.push(new Paragraph({
    children: [new TextRun({ text: `Prepared by: ${REPORT_METADATA.preparedBy}`, bold: true, size: 22 }),],
    spacing: { after: 60 },
  }))
  documentSections.push(new Paragraph({
    children: [new TextRun({ text: REPORT_METADATA.role, bold: true, size: 20 })],
    spacing: { after: 60 },
  }))
  documentSections.push(new Paragraph({
    children: [new TextRun({ text: `Portfolio: ${REPORT_METADATA.portfolio}`, bold: true, size: 20 })],
    spacing: { after: 120 },
  }))
  documentSections.push(new Paragraph({
    children: [new TextRun({ text: `Reporting Week: ${snapshot.weekLabel}`, bold: true, size: 20 })],
    spacing: { after: 200 },
  }))

  documentSections.push(buildSectionHeading('1. Activities Summary'))
  summaryLines(snapshot).forEach((line) => documentSections.push(buildBulletParagraph(line)))

  documentSections.push(buildSectionHeading('2. Daily Activity Breakdown'))
  documentSections.push(buildDailyTable(snapshot))

  const virtualActivities = snapshot.activities.filter((activity) => activity.activityType === 'Virtual Engagement')
  documentSections.push(buildSectionHeading('3. Virtual Engagements'))
  if (virtualActivities.length > 0) {
    virtualActivities.forEach((activity) => {
      documentSections.push(buildTextParagraph(`${activity.account}`))
      documentSections.push(buildTextParagraph(`Doctors engaged: ${activity.hcpNames.join(', ') || 'Not recorded'}`))
      documentSections.push(buildTextParagraph(`Outcome: ${activity.outcome || 'Not recorded'}`))
      documentSections.push(buildTextParagraph(`Next action: ${activity.nextAction || 'Not recorded'}`))
      documentSections.push(new Paragraph({ text: '', spacing: { after: 80 } }))
    })
  } else {
    documentSections.push(buildTextParagraph('No virtual engagements recorded.'))
  }

  const outcomes = snapshot.activities.flatMap((activity) => activity.structuredOutcomes.map((outcome) => ({ ...outcome, account: activity.account })))
  documentSections.push(buildSectionHeading('4. Key Commercial / Patient-Journey Outcomes'))
  if (outcomes.length > 0) {
    outcomes.forEach((outcome) => {
      documentSections.push(buildTextParagraph(`${outcome.type} - ${outcome.account}`))
      const outcomeSummary = [
        outcome.product,
        outcome.quantity ? `Quantity: ${outcome.quantity}` : '',
        outcome.stockStatus,
        outcome.details,
      ].filter(Boolean).join(' - ') || 'Details not recorded.'
      documentSections.push(buildTextParagraph(outcomeSummary))
    })
  } else {
    documentSections.push(buildTextParagraph('No structured outcomes recorded.'))
  }

  const intelligence = unique(snapshot.activities.flatMap((activity) => activity.intelligence ? [`${activity.account}: ${activity.intelligence}`] : []))
  const plannedPriorities = unique(snapshot.plan.days.flatMap((day) => day.categories.commercialPriorities.map((item) => item.text)))
  const intelligenceItems = unique([...intelligence, ...plannedPriorities])
  documentSections.push(buildSectionHeading('5. Strategic Account Intelligence'))
  if (intelligenceItems.length > 0) {
    intelligenceItems.forEach((item) => documentSections.push(buildBulletParagraph(item)))
  } else {
    documentSections.push(buildTextParagraph('No strategic intelligence recorded.'))
  }

  documentSections.push(...buildFollowUps(snapshot))

  return new Document({
    creator: 'WeekFlow',
    title: 'Weekly Field Activity Report',
    description: 'Field activity report generated by WeekFlow',
    sections: [{
      properties: {
        page: {
          margin: {
            top: MARGIN_TWIPS,
            right: MARGIN_TWIPS,
            bottom: MARGIN_TWIPS,
            left: MARGIN_TWIPS,
          },
          size: { width: PAGE_WIDTH_TWIPS, height: PAGE_HEIGHT_TWIPS },
        },
      },
      children: documentSections as any,
    }],
  })
}

function buildReportFilename(weekKey: string) {
  const start = new Date(`${weekKey}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' })
  const startMonth = monthFormatter.format(start)
  const startDay = String(start.getDate()).padStart(2, '0')
  const endDay = String(end.getDate()).padStart(2, '0')
  const year = String(start.getFullYear())
  return `Waheed_Yusuf_Weekly_Field_Activity_Report_${startMonth}${startDay}-${endDay}-${year}.docx`
}

export async function exportReportWord(snapshot: ReportSnapshot) {
  const doc = buildDocument(snapshot)
  const blob = await Packer.toBlob(doc)
  const downloadUrl = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = buildReportFilename(snapshot.weekKey)
  anchor.style.display = 'none'
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  return { filename: anchor.download }
}

export function getFixedReportMetadata() {
  return REPORT_METADATA
}

export function getFixedReportWeekLabel(weekKey: string) {
  return formatWeekRange(weekKey)
}
