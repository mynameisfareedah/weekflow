import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import type { DailyActivity } from '../types/dailyActivity.ts'
import type { FollowUp } from '../types/followUp.ts'
import type { DayPlan, WeeklyPlan } from '../types/weeklyPlan.ts'
import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates.ts'
import { getReportSectionDescriptors } from '../report/reportTemplateAdapter.ts'
import { mapReportSections, type MappedReportSection } from '../report/reportDataMapper.ts'

export interface ReportSnapshot {
  weekKey: string
  weekLabel: string
  plan: WeeklyPlan
  activities: DailyActivity[]
  followUps: FollowUp[]
  template?: WeekFlowTemplate
}

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
  end.setDate(start.getDate() + 6)
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)
  return `${startLabel} - ${endLabel}`
}

function getDayActivities(day: DayPlan, activities: DailyActivity[]) {
  return activities.filter((activity) => activity.date === day.date)
}

const FIELD_REPORT_DAY_IDS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])

function getReportDays(snapshot: ReportSnapshot) {
  return snapshot.template?.id === 'field-sales'
    ? snapshot.plan.days.filter((day) => FIELD_REPORT_DAY_IDS.has(day.id))
    : snapshot.plan.days
}

function sectionById(sections: readonly MappedReportSection[], id: string) {
  return sections.find((section) => section.sectionId === id)
}

function groupValue<T>(sections: readonly MappedReportSection[], sectionId: string, group: string): T[] {
  const value = sectionById(sections, sectionId)?.groups[group]
  return Array.isArray(value) ? value as T[] : []
}

function unsupportedSectionText(section: MappedReportSection | undefined) {
  return section && section.unsupportedGroups.length > 0 ? section.presentation.emptyState : null
}

function summaryLines(snapshot: ReportSnapshot, sections: readonly MappedReportSection[]) {
  const summarySection = sectionById(sections, snapshot.template?.id === 'project-management' ? 'weekly-summary' : 'activities-summary')
  const activities = groupValue<DailyActivity>(sections, summarySection?.sectionId ?? '', 'dailyActivities')
  const followUps = groupValue<FollowUp>(sections, 'priorities-coming-week', 'followUps')
  const facilities = unique(activities.map((activity) => activity.account))
  const physicalVisits = activities.filter((activity) => activity.activityType === 'Physical Visit').length
  const virtualEngagements = activities.filter((activity) => activity.activityType === 'Virtual Engagement').length
  const structuredTypes = unique(activities.flatMap((activity) => activity.structuredOutcomes.map((outcome) => outcome.type.toLowerCase())))
  const openFollowUps = followUps.filter((followUp) => followUp.status === 'open').length

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
    keepNext: true,
    children: [new TextRun({ text, bold: true })],
    spacing: { before: 180, after: 120 },
  })
}

function buildReportFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'WeekFlow  |  Page ' }),
        new TextRun({ children: [PageNumber.CURRENT] }),
      ],
      spacing: { before: 120 },
    })],
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
    widowControl: true,
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

function buildDailyTable(snapshot: ReportSnapshot, sections: readonly MappedReportSection[]) {
  const activities = groupValue<DailyActivity>(sections, 'daily-activity-breakdown', 'dailyActivities')
  const rows = [
    new TableRow({
      children: [
        tableCell('Day', { bold: true, shading: 'F3F5F0', width: DAILY_TABLE_COLUMN_WIDTHS[0], alignment: AlignmentType.CENTER, verticalAlign: VerticalAlign.CENTER }),
        tableCell(snapshot.template?.terminology.account ?? 'Account', { bold: true, shading: 'F3F5F0', width: DAILY_TABLE_COLUMN_WIDTHS[1], alignment: AlignmentType.CENTER, verticalAlign: VerticalAlign.CENTER }),
        tableCell(snapshot.template?.terminology.people ?? 'People', { bold: true, shading: 'F3F5F0', width: DAILY_TABLE_COLUMN_WIDTHS[2], alignment: AlignmentType.CENTER, verticalAlign: VerticalAlign.CENTER }),
        tableCell(snapshot.template?.terminology.outcome ?? 'Outcome', { bold: true, shading: 'F3F5F0', width: DAILY_TABLE_COLUMN_WIDTHS[3], alignment: AlignmentType.CENTER, verticalAlign: VerticalAlign.CENTER }),
        tableCell(`${snapshot.template?.terminology.notes ?? 'Notes'} / ${snapshot.template?.terminology.nextAction ?? 'Next Action'}`, { bold: true, shading: 'F3F5F0', width: DAILY_TABLE_COLUMN_WIDTHS[4], alignment: AlignmentType.CENTER, verticalAlign: VerticalAlign.CENTER }),
      ],
      tableHeader: true,
      cantSplit: true,
    }),
  ]

  getReportDays(snapshot).forEach((day) => {
    const records = getDayActivities(day, activities)
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

function buildFollowUps(sections: readonly MappedReportSection[]) {
  const followUps = groupValue<FollowUp>(sections, 'priorities-coming-week', 'followUps')
  const openFollowUps = followUps.filter((followUp) => followUp.status === 'open')
  const completedFollowUps = followUps.filter((followUp) => followUp.status === 'completed')

  const content: Paragraph[] = []
  content.push(buildSectionHeading(`6. ${sectionById(sections, 'priorities-coming-week')?.title ?? 'Priorities for the Coming Week'}`))
  content.push(buildTextParagraph('Open follow-ups:'))
  if (openFollowUps.length > 0) {
    openFollowUps.forEach((followUp) => {
      const details = [followUp.facility, followUp.hcpName, followUp.dueDate ? `Due ${formatDate(followUp.dueDate)}` : ''].filter(Boolean).join(' | ')
      content.push(buildBulletParagraph(`${followUp.priority === 'high' ? 'HIGH: ' : ''}${followUp.task}${details ? ` (${details})` : ''}`))
    })
  } else {
    content.push(buildTextParagraph('No open follow-ups recorded.'))
  }

  content.push(buildSectionHeading(`7. ${sectionById(sections, 'completed-follow-ups')?.title ?? 'Completed Follow-ups'}`))
  if (completedFollowUps.length > 0) {
    completedFollowUps.forEach((followUp) => {
      content.push(buildBulletParagraph(followUp.task))
    })
  } else {
    content.push(buildTextParagraph('No completed follow-ups recorded.'))
  }

  return content
}

const PM_DAILY_WIDTHS = [800, 2100, 2200, 1900, 2100, CONTENT_WIDTH_TWIPS - 800 - 2100 - 2200 - 1900 - 2100]

function pmSectionHeading(sections: readonly MappedReportSection[], id: string, fallback: string, number: string) {
  const title = sectionById(sections, id)?.title ?? fallback
  return buildSectionHeading(`${number}. ${title}`)
}

function buildProjectManagementDailyTable(snapshot: ReportSnapshot, sections: readonly MappedReportSection[]) {
  const activities = groupValue<DailyActivity>(sections, 'daily-activity-breakdown', 'dailyActivities')
  const headers = ['Day', 'Activity Type', 'Project / Workstream', 'Stakeholders Involved', 'Outcome', 'Key Intelligence / Next Action']
  const rows = [new TableRow({
    children: headers.map((header, index) => tableCell(header, { bold: true, shading: 'F3F5F0', width: PM_DAILY_WIDTHS[index], alignment: AlignmentType.CENTER, verticalAlign: VerticalAlign.CENTER })),
    tableHeader: true,
    cantSplit: true,
  })]

  snapshot.plan.days.forEach((day) => {
    const records = getDayActivities(day, activities)
    const dayRows = records.length > 0
      ? records.map((activity) => [
        `${day.label}\n${formatDate(day.date)}`,
        activity.activityType,
        activity.account,
        unique(activity.hcpNames).join(', ') || 'Not recorded',
        activity.outcome || 'Not recorded',
        [activity.intelligence, activity.nextAction].filter(Boolean).join(' ') || 'Not recorded',
      ])
      : [[`${day.label}\n${formatDate(day.date)}`, 'No activity captured', 'Not recorded', 'Not recorded', 'Not recorded', 'Not recorded']]
    dayRows.forEach((cells) => rows.push(new TableRow({
      children: cells.map((cell, index) => textCell(cell, PM_DAILY_WIDTHS[index], index === 0)),
      cantSplit: true,
    })))
  })

  return new Table({
    rows,
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: PM_DAILY_WIDTHS,
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

function buildProjectManagementDocument(snapshot: ReportSnapshot) {
  const sections = mapReportSections(snapshot, getReportSectionDescriptors(snapshot.template), snapshot.template)
  const activities = groupValue<DailyActivity>(sections, 'daily-activity-breakdown', 'dailyActivities')
  const followUps = groupValue<FollowUp>(sections, 'priorities-coming-week', 'followUps')
  const progressSection = sectionById(sections, 'project-workstream-progress')
  const deliverablesSection = sectionById(sections, 'key-deliverables')
  const risksSection = sectionById(sections, 'risks-blockers-decisions')
  const stakeholdersSection = sectionById(sections, 'stakeholder-client-updates')
  const mappedPlan = sectionById(sections, 'weekly-summary')?.groups.weeklyPlan as WeeklyPlan | undefined
  const plannedDeliverables = unique((mappedPlan ?? snapshot.plan).days.flatMap((day) => day.categories.accountObjectives.map((item) => item.text)))
  const priorities = groupValue<{ text?: string }>(sections, 'priorities-coming-week', 'priorities')
  const plannedPriorities = unique(priorities.map((item) => item.text ?? '').filter(Boolean))
  const openFollowUps = followUps.filter((followUp) => followUp.status === 'open')
  const completedFollowUps = followUps.filter((followUp) => followUp.status === 'completed')
  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: 'WEEKFLOW PROJECT REPORTING', bold: true, color: 'A55F39', size: 17 })], spacing: { after: 120 } }),
    new Paragraph({ children: [new TextRun({ text: 'Weekly Project Management Report', bold: true, size: 30, color: '2B2D2B' })], spacing: { after: 120 } }),
    new Paragraph({ children: [new TextRun({ text: `Reporting Week: ${snapshot.weekLabel}`, bold: true, size: 20 })], spacing: { after: 200 } }),
    pmSectionHeading(sections, 'weekly-summary', 'Weekly Summary', '1'),
    ...((activities.length > 0 ? [`${activities.length} project activit${activities.length === 1 ? 'y' : 'ies'} captured across ${unique(activities.map((activity) => activity.account)).length} project/workstream${unique(activities.map((activity) => activity.account)).length === 1 ? '' : 's'}.`] : ['No project activity has been captured for this week yet.']).map((line) => buildBulletParagraph(line))),
    pmSectionHeading(sections, 'daily-activity-breakdown', 'Daily Activity Breakdown', '2'),
    buildProjectManagementDailyTable(snapshot, sections),
    pmSectionHeading(sections, 'project-workstream-progress', 'Project / Workstream Progress', '3'),
    ...(unsupportedSectionText(progressSection) ? [buildTextParagraph(unsupportedSectionText(progressSection) as string)] : activities.length > 0 ? unique(activities.map((activity) => activity.account)).flatMap((account) => [buildTextParagraph(account, true), ...activities.filter((activity) => activity.account === account).map((activity) => buildBulletParagraph([activity.outcome, activity.nextAction].filter(Boolean).join(' | ') || 'Progress not recorded.'))]) : [buildTextParagraph('No project progress recorded.')]),
    pmSectionHeading(sections, 'key-deliverables', 'Key Deliverables', '4'),
    ...(unsupportedSectionText(deliverablesSection)
      ? [buildTextParagraph(unsupportedSectionText(deliverablesSection) as string)]
      : [buildTextParagraph('Planned deliverables:', true), ...(plannedDeliverables.length > 0 ? plannedDeliverables.map((item) => buildBulletParagraph(item)) : [buildTextParagraph('No planned deliverables recorded.')])]),
    pmSectionHeading(sections, 'risks-blockers-decisions', 'Risks, Blockers & Decisions', '5'),
    ...(unsupportedSectionText(risksSection) ? [buildTextParagraph(unsupportedSectionText(risksSection) as string)] : [buildTextParagraph('No risks, blockers, or decisions recorded.')]),
    pmSectionHeading(sections, 'stakeholder-client-updates', 'Stakeholder / Client Updates', '6'),
    ...(unsupportedSectionText(stakeholdersSection) ? [buildTextParagraph(unsupportedSectionText(stakeholdersSection) as string)] : [buildTextParagraph('No stakeholder updates recorded.')]),
    pmSectionHeading(sections, 'priorities-coming-week', 'Priorities for Coming Week', '7'),
    ...(plannedPriorities.length > 0 ? [buildTextParagraph('Planned priorities:', true), ...plannedPriorities.map((item) => buildBulletParagraph(item))] : []),
    ...(openFollowUps.length > 0 ? [buildTextParagraph('Open follow-ups:', true), ...openFollowUps.map((followUp) => buildBulletParagraph(`${followUp.task}${followUp.facility ? ` (${followUp.facility})` : ''}${followUp.dueDate ? ` - Due ${formatDate(followUp.dueDate)}` : ''}`))] : [buildTextParagraph('No open priorities or follow-ups recorded.')]),
    pmSectionHeading(sections, 'completed-follow-ups', 'Completed Follow-ups', '8'),
    ...(completedFollowUps.length > 0 ? completedFollowUps.map((followUp) => buildBulletParagraph(`${followUp.task}${followUp.facility ? ` (${followUp.facility})` : ''}${followUp.hcpName ? ` | ${followUp.hcpName}` : ''}${followUp.dueDate ? ` | Due ${formatDate(followUp.dueDate)}` : ''}${followUp.notes ? ` | ${followUp.notes}` : ''}`)) : [buildTextParagraph('No completed follow-ups recorded.')]),
  ]

  return new Document({
    creator: 'WeekFlow',
    title: 'Weekly Project Management Report',
    description: 'Project Management report generated by WeekFlow',
    sections: [{
      properties: { page: { margin: { top: MARGIN_TWIPS, right: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS }, size: { width: PAGE_WIDTH_TWIPS, height: PAGE_HEIGHT_TWIPS } } },
      footers: { default: buildReportFooter() },
      children,
    }],
  })
}

function buildFieldSalesDocument(snapshot: ReportSnapshot) {
  const sections = mapReportSections(snapshot, getReportSectionDescriptors(snapshot.template), snapshot.template)
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
        new TextRun({ text: (snapshot.template?.report.title ?? 'Weekly Report').toUpperCase(), bold: true, size: 30, color: '2B2D2B' }),
      ],
      spacing: { after: 120 },
    }),
  )

  documentSections.push(new Paragraph({
    children: [new TextRun({ text: `Reporting Week: ${snapshot.weekLabel}`, bold: true, size: 20 })],
    spacing: { after: 200 },
  }))

  documentSections.push(buildSectionHeading(`1. ${sectionById(sections, 'activities-summary')?.title ?? 'Activities Summary'}`))
  summaryLines(snapshot, sections).forEach((line) => documentSections.push(buildBulletParagraph(line)))

  documentSections.push(buildSectionHeading(`2. ${sectionById(sections, 'daily-activity-breakdown')?.title ?? 'Daily Activity Breakdown'}`))
  documentSections.push(buildDailyTable(snapshot, sections))

  const virtualSection = sectionById(sections, 'virtual-engagements')
  const virtualActivities = groupValue<DailyActivity>(sections, 'virtual-engagements', 'virtualEngagements')
  documentSections.push(buildSectionHeading(`3. ${sectionById(sections, 'virtual-engagements')?.title ?? 'Virtual Engagements'}`))
  if (unsupportedSectionText(virtualSection)) {
    documentSections.push(buildTextParagraph(unsupportedSectionText(virtualSection) as string))
  } else if (virtualActivities.length > 0) {
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

  const outcomeSection = sectionById(sections, 'commercial-patient-journey-outcomes')
  const mappedOutcomes = [...groupValue<DailyActivity['structuredOutcomes'][number]>(sections, 'commercial-patient-journey-outcomes', 'commercialOutcomes'), ...groupValue<DailyActivity['structuredOutcomes'][number]>(sections, 'commercial-patient-journey-outcomes', 'patientJourney')]
  const outcomes = mappedOutcomes.map((outcome) => ({ ...outcome, account: snapshot.activities.find((activity) => activity.structuredOutcomes.some((candidate) => candidate.id === outcome.id))?.account ?? '' }))
  documentSections.push(buildSectionHeading(`4. ${sectionById(sections, 'commercial-patient-journey-outcomes')?.title ?? 'Key Commercial / Patient-Journey Outcomes'}`))
  if (unsupportedSectionText(outcomeSection)) {
    documentSections.push(buildTextParagraph(unsupportedSectionText(outcomeSection) as string))
  } else if (outcomes.length > 0) {
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

  const intelligenceSection = sectionById(sections, 'strategic-account-intelligence')
  const intelligenceItems: string[] = []
  documentSections.push(buildSectionHeading(`5. ${sectionById(sections, 'strategic-account-intelligence')?.title ?? 'Strategic Account Intelligence'}`))
  if (unsupportedSectionText(intelligenceSection)) {
    documentSections.push(buildTextParagraph(unsupportedSectionText(intelligenceSection) as string))
  } else if (intelligenceItems.length > 0) {
    intelligenceItems.forEach((item) => documentSections.push(buildBulletParagraph(item)))
  } else {
    documentSections.push(buildTextParagraph('No strategic intelligence recorded.'))
  }

  documentSections.push(...buildFollowUps(sections))

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
      footers: { default: buildReportFooter() },
      children: documentSections as any,
    }],
  })
}

function buildSchemaDocument(snapshot: ReportSnapshot) {
  const sections = mapReportSections(snapshot, getReportSectionDescriptors(snapshot.template), snapshot.template)
  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: `WEEKFLOW ${snapshot.template?.name.toUpperCase() ?? 'REPORT'} REPORTING`, bold: true, color: 'A55F39', size: 17 })], spacing: { after: 120 } }),
    new Paragraph({ children: [new TextRun({ text: snapshot.template?.report.title ?? 'Weekly Report', bold: true, size: 30, color: '2B2D2B' })], spacing: { after: 120 } }),
    new Paragraph({ children: [new TextRun({ text: `Reporting Week: ${snapshot.weekLabel}`, bold: true, size: 20 })], spacing: { after: 200 } }),
  ]

  for (const section of sections) {
    children.push(buildSectionHeading(`${section.order}. ${section.title}`))
    const unsupported = unsupportedSectionText(section)
    if (unsupported) {
      children.push(buildTextParagraph(unsupported))
      continue
    }
    if (snapshot.template?.id === 'small-business' && section.sectionId === 'business-summary') {
      summaryLines(snapshot, sections).forEach((line) => children.push(buildBulletParagraph(line)))
      continue
    }
    if (snapshot.template?.id === 'small-business' && section.sectionId === 'daily-business-activity') {
      children.push(buildDailyTable(snapshot, sections))
      continue
    }
    if (snapshot.template?.id === 'small-business' && ['sales-opportunity-progress', 'customer-client-outcomes', 'orders-payments'].includes(section.sectionId)) {
      const allowed = section.sectionId === 'sales-opportunity-progress' ? ['Sale / Order Won', 'Lead Qualified'] : section.sectionId === 'customer-client-outcomes' ? ['Customer Retained', 'Follow-up Required'] : ['Payment Received']
      const outcomes = groupValue<DailyActivity['structuredOutcomes'][number]>(sections, section.sectionId, 'outcomes').filter((outcome) => allowed.includes(outcome.type))
      if (outcomes.length === 0) children.push(buildTextParagraph(section.presentation.emptyState))
      outcomes.forEach((outcome) => {
        const account = snapshot.activities.find((activity) => activity.structuredOutcomes.some((candidate) => candidate.id === outcome.id))?.account ?? ''
        children.push(buildBulletParagraph(`${outcome.type}${account ? ` (${account})` : ''}: ${outcome.details || 'Details not recorded.'}`))
      })
      continue
    }
    if (snapshot.template?.id === 'small-business' && section.sectionId === 'supplier-operational-intelligence') {
      const intelligence = groupValue<{ account: string; type: string; details: string }>(sections, section.sectionId, 'intelligence')
      if (intelligence.length === 0) children.push(buildTextParagraph(section.presentation.emptyState))
      intelligence.forEach((item) => children.push(buildBulletParagraph(`${item.type}${item.account ? ` (${item.account})` : ''}: ${item.details}`)))
      continue
    }
    if (snapshot.template?.id === 'small-business' && section.sectionId === 'priorities-coming-week') {
      const priorities = groupValue<{ text?: string }>(sections, section.sectionId, 'priorities').map((item) => item.text ?? '').filter(Boolean)
      const followUps = groupValue<FollowUp>(sections, section.sectionId, 'followUps').filter((followUp) => followUp.status === 'open')
      if (priorities.length === 0 && followUps.length === 0) children.push(buildTextParagraph(section.presentation.emptyState))
      priorities.forEach((priority) => children.push(buildBulletParagraph(priority)))
      followUps.forEach((followUp) => children.push(buildBulletParagraph(`${followUp.task}${followUp.facility ? ` (${followUp.facility})` : ''}`)))
      continue
    }
    if (snapshot.template?.id === 'small-business' && section.sectionId === 'completed-follow-ups') {
      const followUps = groupValue<FollowUp>(sections, section.sectionId, 'followUps').filter((followUp) => followUp.status === 'completed')
      if (followUps.length === 0) children.push(buildTextParagraph(section.presentation.emptyState))
      followUps.forEach((followUp) => children.push(buildBulletParagraph(followUp.task)))
      continue
    }
    const values = Object.entries(section.groups)
      .map(([group, value]) => `${group}: ${Array.isArray(value) ? value.length : 1} item${Array.isArray(value) && value.length === 1 ? '' : 's'}`)
    children.push(...(values.length > 0 ? values.map((value) => buildBulletParagraph(value)) : [buildTextParagraph('No report data recorded.')]))
  }

  return new Document({
    creator: 'WeekFlow',
    title: snapshot.template?.report.title ?? 'Weekly Report',
    description: 'Report generated by WeekFlow',
    sections: [{
      properties: { page: { margin: { top: MARGIN_TWIPS, right: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS }, size: { width: PAGE_WIDTH_TWIPS, height: PAGE_HEIGHT_TWIPS } } },
      footers: { default: buildReportFooter() },
      children,
    }],
  })
}

function buildReportFilename(weekKey: string) {
  const start = new Date(`${weekKey}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' })
  const startMonth = monthFormatter.format(start)
  const startDay = String(start.getDate()).padStart(2, '0')
  const endDay = String(end.getDate()).padStart(2, '0')
  const year = String(start.getFullYear())
  return `Weekly_Field_Activity_Report_${startMonth}${startDay}-${endDay}-${year}.docx`
}

function buildProjectManagementReportFilename(weekKey: string) {
  const start = new Date(`${weekKey}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(start)
  return `Project_Management_Weekly_Report_${month}${start.getDate()}-${end.getDate()}-${start.getFullYear()}.docx`
}

export function buildReportDocument(snapshot: ReportSnapshot) {
  const template = snapshot.template ?? FIELD_SALES_TEMPLATE
  if (template.id === 'project-management') return buildProjectManagementDocument({ ...snapshot, template })
  if (template.id === 'field-sales') return buildFieldSalesDocument(snapshot)
  return buildSchemaDocument({ ...snapshot, template })
}

export function getReportDownloadFilename(snapshot: ReportSnapshot) {
  const template = snapshot.template ?? FIELD_SALES_TEMPLATE
  if (template.id === 'project-management') return buildProjectManagementReportFilename(snapshot.weekKey)
  if (template.id === 'field-sales') return buildReportFilename(snapshot.weekKey)
  const start = new Date(`${snapshot.weekKey}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(start)
  return `${template.name.replace(/[^a-z0-9]+/gi, '_')}_Weekly_Report_${month}${start.getDate()}-${end.getDate()}-${start.getFullYear()}.docx`
}

export async function exportReportWord(snapshot: ReportSnapshot) {
  const doc = buildReportDocument(snapshot)
  const blob = await Packer.toBlob(doc)
  const downloadUrl = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = getReportDownloadFilename(snapshot)
  anchor.style.display = 'none'
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  return { filename: anchor.download }
}

export function getFixedReportWeekLabel(weekKey: string) {
  return formatWeekRange(weekKey)
}
