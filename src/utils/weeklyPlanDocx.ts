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
import type { PlanItem, WeeklyPlan } from '../types/weeklyPlan'

const A4_WIDTH_TWIPS = 11906
const A4_HEIGHT_TWIPS = 16838
const PAGE_MARGIN_TWIPS = 720
const CONTENT_WIDTH_TWIPS = A4_WIDTH_TWIPS - (PAGE_MARGIN_TWIPS * 2)
const DAILY_WIDTHS = [900, 3200, 3000, CONTENT_WIDTH_TWIPS - 900 - 3200 - 3000]
const VIRTUAL_WIDTHS = [2800, 3600, CONTENT_WIDTH_TWIPS - 2800 - 3600]
const TWO_COLUMN_WIDTHS = [2600, CONTENT_WIDTH_TWIPS - 2600]
const BORDER_COLOR = 'C9D1C8'
const HEADER_COLOR = 'F3F5F0'
const WEEKLY_PLAN_METADATA = {
  preparedBy: 'Franklin Ewelike',
  role: 'Medical Representative WWCV (Johnson & Johnson)',
  portfolio: 'ZYTIGA® | INVEGA SUSTENNA® | TREVICTA®',
} as const

function clean(value: string | undefined) {
  return value?.trim() || 'Not recorded'
}

function uniqueItems(items: PlanItem[]) {
  return items.filter((item, index) => item.text.trim() && items.findIndex((candidate) => candidate.text === item.text) === index)
}

function cellParagraphs(items: PlanItem[], bullet = false) {
  const visibleItems = uniqueItems(items)
  return visibleItems.length > 0
    ? visibleItems.map((item) => new Paragraph({
      text: item.text,
      bullet: bullet ? { level: 0 } : undefined,
      spacing: { before: 0, after: 60, line: 240 },
    }))
    : [new Paragraph({ text: 'Not recorded', spacing: { before: 0, after: 0, line: 240 } })]
}

function tableCell(children: Paragraph[], width: number, options: { header?: boolean; center?: boolean; columnSpan?: number } = {}) {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    columnSpan: options.columnSpan,
    shading: options.header ? { fill: HEADER_COLOR } : undefined,
    verticalAlign: options.header || options.center ? VerticalAlign.CENTER : VerticalAlign.TOP,
    margins: { top: 70, bottom: 70, left: 90, right: 90 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
    },
  })
}

function headerCell(text: string, width: number) {
  return tableCell([new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true, size: 18 })],
    spacing: { before: 0, after: 0, line: 240 },
  })], width, { header: true, center: true })
}

function buildTable(rows: TableRow[], widths: number[]) {
  return new Table({
    rows,
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: 'AEB8AC' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AEB8AC' },
      left: { style: BorderStyle.SINGLE, size: 6, color: 'AEB8AC' },
      right: { style: BorderStyle.SINGLE, size: 6, color: 'AEB8AC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'D8DED7' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'D8DED7' },
    },
  })
}

function sectionHeading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true })],
    spacing: { before: 180, after: 100 },
    keepNext: true,
  })
}

function spacer() {
  return new Paragraph({ text: '', spacing: { after: 80 } })
}

function formatWeeklyPlanWeekLabel(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long' })
  return `${weekdayFormatter.format(start)} ${start.getDate()} – ${weekdayFormatter.format(end)} ${end.getDate()} ${monthFormatter.format(start)} ${start.getFullYear()}`
}

function getExecutionStandard(plan: WeeklyPlan) {
  const item = plan.weeklyStrategicObjectives.find((candidate) => candidate.text.toLowerCase().startsWith('daily execution standard:'))
  return item?.text.replace(/^daily execution standard:\s*/i, '').trim() || ''
}

function buildDailyFieldPlanTable(plan: WeeklyPlan) {
  const rows = [new TableRow({
    children: [
      headerCell('Day', DAILY_WIDTHS[0]),
      headerCell('Facilities / Accounts', DAILY_WIDTHS[1]),
      headerCell('Key HCPs / Stakeholders', DAILY_WIDTHS[2]),
      headerCell('Primary Objectives', DAILY_WIDTHS[3]),
    ],
  })]

  for (const day of plan.days) {
    rows.push(new TableRow({
      children: [
        tableCell([new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: day.label, bold: true, size: 18 }), new TextRun({ text: `\n${day.date}`, size: 16 })],
          spacing: { before: 0, after: 0, line: 240 },
        })], DAILY_WIDTHS[0], { center: true }),
        tableCell(cellParagraphs(day.categories.facilities, true), DAILY_WIDTHS[1]),
        tableCell(cellParagraphs(day.categories.hcps, true), DAILY_WIDTHS[2]),
        tableCell(cellParagraphs(day.categories.primaryObjectives, true), DAILY_WIDTHS[3]),
      ],
    }))
  }

  return buildTable(rows, DAILY_WIDTHS)
}

function buildVirtualEngagementTable(plan: WeeklyPlan) {
  const rows = [new TableRow({
    children: [headerCell('Coverage', VIRTUAL_WIDTHS[0]), headerCell('Priority Contacts', VIRTUAL_WIDTHS[1]), headerCell('Objective', VIRTUAL_WIDTHS[2])],
  })]

  for (const item of plan.virtualEngagementPlan) {
    rows.push(new TableRow({
      children: [
        tableCell([new Paragraph({ text: clean(item.coverage), spacing: { before: 0, after: 0, line: 240 } })], VIRTUAL_WIDTHS[0]),
        tableCell(cellParagraphs(item.priorityContacts, true), VIRTUAL_WIDTHS[1]),
        tableCell([new Paragraph({ text: clean(item.objective), spacing: { before: 0, after: 0, line: 240 } })], VIRTUAL_WIDTHS[2]),
      ],
    }))
  }

  if (plan.virtualEngagementPlan.length === 0) {
    rows.push(new TableRow({ children: [tableCell([new Paragraph({ text: 'No virtual engagements planned.', spacing: { before: 0, after: 0 } })], CONTENT_WIDTH_TWIPS, { columnSpan: 3 })] }))
  }
  return buildTable(rows, VIRTUAL_WIDTHS)
}

function buildAccountObjectivesTable(plan: WeeklyPlan) {
  const rows = [new TableRow({ children: [headerCell('Account', TWO_COLUMN_WIDTHS[0]), headerCell('Objectives', TWO_COLUMN_WIDTHS[1])] })]
  for (const item of plan.keyAccountObjectives) {
    rows.push(new TableRow({
      children: [
        tableCell([new Paragraph({ text: clean(item.account), spacing: { before: 0, after: 0, line: 240 } })], TWO_COLUMN_WIDTHS[0]),
        tableCell(cellParagraphs(item.objectives, true), TWO_COLUMN_WIDTHS[1]),
      ],
    }))
  }
  if (plan.keyAccountObjectives.length === 0) {
    rows.push(new TableRow({ children: [tableCell([new Paragraph({ text: 'No key account objectives recorded.', spacing: { before: 0, after: 0 } })], CONTENT_WIDTH_TWIPS, { columnSpan: 2 })] }))
  }
  return buildTable(rows, TWO_COLUMN_WIDTHS)
}

function buildCommercialPrioritiesTable(plan: WeeklyPlan) {
  const rows = [new TableRow({ children: [headerCell('Opportunity', TWO_COLUMN_WIDTHS[0]), headerCell('Action', TWO_COLUMN_WIDTHS[1])] })]
  for (const item of plan.commercialPriorities) {
    const opportunity = item.opportunity?.trim() || [item.account, item.product].filter(Boolean).join(' - ') || item.text
    const action = item.text || 'Not recorded'
    rows.push(new TableRow({
      children: [
        tableCell([new Paragraph({ text: clean(opportunity), spacing: { before: 0, after: 0, line: 240 } })], TWO_COLUMN_WIDTHS[0]),
        tableCell([new Paragraph({ text: clean(action), spacing: { before: 0, after: 0, line: 240 } })], TWO_COLUMN_WIDTHS[1]),
      ],
    }))
  }
  if (plan.commercialPriorities.length === 0) {
    rows.push(new TableRow({ children: [tableCell([new Paragraph({ text: 'No commercial priorities recorded.', spacing: { before: 0, after: 0 } })], CONTENT_WIDTH_TWIPS, { columnSpan: 2 })] }))
  }
  return buildTable(rows, TWO_COLUMN_WIDTHS)
}

function buildSuccessMeasures(plan: WeeklyPlan) {
  return plan.successMeasures.length > 0
    ? plan.successMeasures.map((measure) => {
      const details = [measure.target, measure.unit].filter(Boolean).join(' ')
      return new Paragraph({
        text: details ? `${measure.text} (${details})` : measure.text,
        bullet: { level: 0 },
        spacing: { after: 70, line: 240 },
      })
    })
    : [new Paragraph({ text: 'No success measures recorded.', spacing: { after: 0 } })]
}

function buildWeeklyPlanDocument(plan: WeeklyPlan) {
  const executionStandard = getExecutionStandard(plan)
  const strategicObjectives = plan.weeklyStrategicObjectives.filter((item) => !item.text.toLowerCase().startsWith('daily execution standard:'))
  const weekLabel = formatWeeklyPlanWeekLabel(plan.weekStart)
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: 'WEEKFLOW WEEKLY WORK PLAN', bold: true, color: 'A55F39', size: 17 })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'WEEKLY WORK PLAN', bold: true, size: 30, color: '2B2D2B' })],
      spacing: { after: 100 },
    }),
    new Paragraph({ text: `Week: ${weekLabel}`, spacing: { after: 60 } }),
    new Paragraph({ text: `Prepared by: ${WEEKLY_PLAN_METADATA.preparedBy}`, spacing: { after: 60 } }),
    new Paragraph({ text: `Role: ${WEEKLY_PLAN_METADATA.role}`, spacing: { after: 60 } }),
    new Paragraph({ text: `Portfolio: ${WEEKLY_PLAN_METADATA.portfolio}`, spacing: { after: 160 } }),
    sectionHeading('1. Weekly Strategic Objectives'),
    ...cellParagraphs(strategicObjectives, true),
    spacer(),
    sectionHeading('2. Daily Field Plan'),
    buildDailyFieldPlanTable(plan),
    ...(executionStandard ? [
      new Paragraph({
        children: [new TextRun({ text: 'Daily execution standard:', bold: true })],
        spacing: { before: 100, after: 40 },
      }),
      new Paragraph({ text: executionStandard, spacing: { after: 100, line: 240 } }),
    ] : []),
    spacer(),
    sectionHeading('3. Virtual Engagement Plan'),
    buildVirtualEngagementTable(plan),
    spacer(),
    sectionHeading('4. Key Account-Specific Objectives'),
    buildAccountObjectivesTable(plan),
    spacer(),
    sectionHeading('5. Commercial Priorities'),
    buildCommercialPrioritiesTable(plan),
    spacer(),
    sectionHeading('6. Success Measures'),
    ...buildSuccessMeasures(plan),
  ]

  return new Document({
    creator: 'WeekFlow',
    title: 'Weekly Work Plan',
    description: 'Weekly Work Plan generated by WeekFlow',
    sections: [{
      properties: {
        page: {
          margin: { top: PAGE_MARGIN_TWIPS, right: PAGE_MARGIN_TWIPS, bottom: PAGE_MARGIN_TWIPS, left: PAGE_MARGIN_TWIPS },
          size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
        },
      },
      children,
    }],
  })
}

function buildWeeklyPlanFilename(weekKey: string) {
  return `WeekFlow_Weekly_Work_Plan_${weekKey}.docx`
}

export async function exportWeeklyPlanWord(plan: WeeklyPlan) {
  const blob = await Packer.toBlob(buildWeeklyPlanDocument(plan))
  const downloadUrl = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = buildWeeklyPlanFilename(plan.weekStart)
  anchor.style.display = 'none'
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  return { filename: anchor.download }
}