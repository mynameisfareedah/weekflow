import { getWorkflowTemplateById } from '../src/config/templates.ts'
import { buildNarrativeReport, type NarrativeReport } from '../src/report/reportNarrative.ts'

const personalTemplate = getWorkflowTemplateById('personal')
const personalSnapshot = {
  weekKey: '2026-09-07',
  weekLabel: '7–13 September 2026',
  template: personalTemplate,
  plan: {
    weekStart: '2026-09-07',
    weeklyStrategicObjectives: [],
    days: [
      { id: 'monday', label: 'Monday', date: '2026-09-07', categories: { facilities: [], hcps: [], primaryObjectives: [], virtualEngagements: [], accountObjectives: [], commercialPriorities: [], successMeasures: [] } },
      { id: 'tuesday', label: 'Tuesday', date: '2026-09-08', categories: { facilities: [], hcps: [], primaryObjectives: [], virtualEngagements: [], accountObjectives: [], commercialPriorities: [], successMeasures: [] } },
    ],
    virtualEngagementPlan: [],
    keyAccountObjectives: [],
    commercialPriorities: [],
    successMeasures: [],
  },
  activities: [
    {
      id: 'a1',
      date: '2026-09-12',
      weekStart: '2026-09-07',
      plannedActivityId: null,
      account: 'TAILORS',
      activityType: 'Errand',
      hcpNames: [],
      outcome: 'DROPPED MY CLOTHES FOR ADJUSTMENT',
      intelligence: 'TO BALANCE HER 10,000',
      nextAction: 'GO BACK TO COLLECT THEM NEXT WEEK SATURDAY',
      structuredOutcomes: [],
      createdAt: '2026-09-12T00:00:00.000Z',
      updatedAt: '2026-09-12T00:00:00.000Z',
    },
    {
      id: 'a2',
      date: '2026-09-12',
      weekStart: '2026-09-07',
      plannedActivityId: null,
      account: 'Hair salon',
      activityType: 'Appointment',
      hcpNames: [],
      outcome: 'HAIR-DO COMPLETE',
      intelligence: '',
      nextAction: '',
      structuredOutcomes: [],
      createdAt: '2026-09-12T00:00:00.000Z',
      updatedAt: '2026-09-12T00:00:00.000Z',
    },
  ],
  followUps: [
    { id: 'f1', weekKey: '2026-09-07', task: 'Collect clothes from tailor', facility: 'TAILORS', dueDate: '2026-09-18', priority: 'normal', status: 'open', notes: 'Return to the tailor next Saturday to collect the adjusted clothing.', createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-12T00:00:00.000Z' },
  ],
}

const personalReport: NarrativeReport = buildNarrativeReport(personalSnapshot)
if (!personalReport.title.includes('Weekly Review')) throw new Error('Personal report title should use template title')
if (personalReport.sections.some((section) => section.items.some((item) => item.title.includes('|')))) throw new Error('Narrative formatter should not include pipe-delimited raw strings')
if (personalReport.sections.some((section) => section.items.some((item) => item.summary.includes('TAILORS')))) throw new Error('Narrative formatter should not expose raw uppercase location strings verbatim')
if (personalReport.summaryText.length === 0) throw new Error('Narrative summary should not be empty for populated personal report')

const fieldSalesTemplate = getWorkflowTemplateById('field-sales')
const fieldSalesSnapshot = {
  weekKey: '2026-09-07',
  weekLabel: '7–13 September 2026',
  template: fieldSalesTemplate,
  plan: {
    weekStart: '2026-09-07',
    weeklyStrategicObjectives: [],
    days: [
      { id: 'monday', label: 'Monday', date: '2026-09-07', categories: { facilities: [], hcps: [], primaryObjectives: [], virtualEngagements: [], accountObjectives: [], commercialPriorities: [], successMeasures: [] } },
    ],
    virtualEngagementPlan: [],
    keyAccountObjectives: [],
    commercialPriorities: [],
    successMeasures: [],
  },
  activities: [
    {
      id: 'f1',
      date: '2026-09-07',
      weekStart: '2026-09-07',
      plannedActivityId: null,
      account: 'Dr Smith',
      activityType: 'Physical Visit',
      hcpNames: ['Dr Smith'],
      outcome: 'Discussed ZYTIGA',
      intelligence: 'Interested',
      nextAction: 'Follow up next week',
      structuredOutcomes: [],
      createdAt: '2026-09-07T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z',
    },
  ],
  followUps: [{ id: 'f2', weekKey: '2026-09-07', task: 'Follow up next week', facility: 'Dr Smith', hcpName: 'Dr Smith', dueDate: '2026-09-14', priority: 'normal', status: 'open', createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z' }],
}

const fieldSalesReport = buildNarrativeReport(fieldSalesSnapshot)
if (!fieldSalesReport.sections.some((section) => section.items.some((item) => item.title.includes('Dr. Smith') || item.summary.includes('ZYTIGA')))) throw new Error('Field sales narrative should preserve medical terminology and person names')

const projectManagementTemplate = getWorkflowTemplateById('project-management')
const projectManagementSnapshot = {
  weekKey: '2026-09-07',
  weekLabel: '7–13 September 2026',
  template: projectManagementTemplate,
  plan: {
    weekStart: '2026-09-07',
    weeklyStrategicObjectives: [],
    days: [
      { id: 'monday', label: 'Monday', date: '2026-09-07', categories: { facilities: [], hcps: [], primaryObjectives: [], virtualEngagements: [], accountObjectives: [], commercialPriorities: [], successMeasures: [] } },
    ],
    virtualEngagementPlan: [],
    keyAccountObjectives: [],
    commercialPriorities: [],
    successMeasures: [],
  },
  activities: [
    {
      id: 'p1',
      date: '2026-09-12',
      weekStart: '2026-09-07',
      plannedActivityId: null,
      account: 'Hair Salon',
      activityType: 'Client Review',
      hcpNames: [],
      outcome: 'HAIR-DO COMPLETE',
      intelligence: '',
      nextAction: '',
      structuredOutcomes: [],
      createdAt: '2026-09-12T00:00:00.000Z',
      updatedAt: '2026-09-12T00:00:00.000Z',
    },
  ],
  followUps: [],
}
const projectManagementReport = buildNarrativeReport(projectManagementSnapshot)
if (projectManagementReport.sections.some((section) => section.items.some((item) => item.summary.includes('HAIR-DO COMPLETE') || item.summary.includes('COMPLETE')))) throw new Error('Project management narrative should humanize raw outcome text instead of exposing raw uppercase strings')

const ngoTemplate = getWorkflowTemplateById('ngo-community')
const ngoPlan = {
  weekStart: '2026-09-07',
  weeklyStrategicObjectives: [{ id: 'objective-1', text: "Increased awareness of women's health issues" }],
  days: [],
  virtualEngagementPlan: [],
  keyAccountObjectives: [],
  commercialPriorities: [],
  successMeasures: [],
  programmeContext: { programmeStatus: 'On Track' },
  programmeActivities: [{ id: 'programme-1', activity: 'Community mobilisation', target: '30 people', status: 'Planned' }],
}
const emptyNgoReport = buildNarrativeReport({ weekKey: '2026-09-07', weekLabel: '7–13 September 2026', template: ngoTemplate, plan: ngoPlan, activities: [], followUps: [] })
const emptyNgoAssessment = emptyNgoReport.sections.find((section) => section.id === 'ngo-overall-assessment')?.items[0]?.summary ?? ''
if (!emptyNgoAssessment.includes('cannot yet be assessed')) throw new Error('Empty NGO assessment should state that progress cannot yet be assessed')
if (['on track.', 'with sufficient evidence', 'successful delivery'].some((phrase) => emptyNgoAssessment.toLowerCase().includes(phrase))) throw new Error('Empty NGO assessment should not use positive completion language')

const partialNgoActivity = {
  id: 'ngo-partial-1',
  date: '2026-09-07',
  weekStart: '2026-09-07',
  plannedActivityId: null,
  account: 'Community mobilisation',
  activityType: 'Community Visit' as const,
  hcpNames: [],
  outcome: '',
  workPerformed: 'Temporary community visit for partial-week acceptance testing.',
  actualResults: 'One introductory visit was recorded.',
  actualReach: '',
  engagementResult: '',
  volunteer: '',
  stakeholder: '',
  resource: '',
  intelligence: '',
  nextAction: '',
  structuredOutcomes: [],
  createdAt: '2026-09-07T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
}
const partialNgoReport = buildNarrativeReport({ weekKey: '2026-09-07', weekLabel: '7–13 September 2026', template: ngoTemplate, plan: { ...ngoPlan, weeklyStrategicObjectives: [] }, activities: [partialNgoActivity], followUps: [] })
const partialNgoAssessment = partialNgoReport.sections.find((section) => section.id === 'ngo-overall-assessment')?.items[0]?.summary ?? ''
if (!/incomplete|cannot yet be fully confirmed/i.test(partialNgoAssessment)) throw new Error('Partial NGO assessment should explicitly describe incomplete evidence')
if (['on track.', 'with sufficient evidence', 'outcomes achieved'].some((phrase) => partialNgoAssessment.toLowerCase().includes(phrase))) throw new Error('Partial NGO assessment should not claim positive completion')
if (/actual reach:\s*\d+|reach of\s*\d+/i.test(partialNgoAssessment)) throw new Error('Partial NGO assessment should not invent reach')

const populatedNgoActivity = {
  ...partialNgoActivity,
  id: 'ngo-populated-1',
  workPerformed: 'Delivered a community health education session focused on women\'s health awareness.',
  actualResults: '18 participants attended and completed the education session.',
  actualReach: '18',
  engagementResult: 'Participants engaged in discussion and requested additional information.',
  volunteer: 'Volunteer A',
  volunteerRole: 'Registration',
  volunteerParticipation: 'Present',
  volunteerContribution: 'Supported participant registration.',
  stakeholder: 'Local Health Centre',
  stakeholderPurpose: 'Referral support',
  stakeholderEngagement: 'Discussed referral coordination.',
  stakeholderResult: 'Referral coordination requirements were discussed.',
  resource: 'Educational flyers',
  resourceActual: '70',
  resourceIssue: '30 additional copies required',
  resourceAction: 'Print additional copies',
  outcome: 'Participants engaged in discussion and requested additional information.',
}
const populatedNgoReport = buildNarrativeReport({ weekKey: '2026-09-07', weekLabel: '7–13 September 2026', template: ngoTemplate, plan: ngoPlan, activities: [populatedNgoActivity], followUps: [] })
const populatedNgoAssessment = populatedNgoReport.sections.find((section) => section.id === 'ngo-overall-assessment')?.items[0]?.summary ?? ''
if (!/Attention required|Progress evidenced/i.test(populatedNgoAssessment)) throw new Error('Evidence-backed NGO assessment should reflect recorded evidence')
if (/sufficient evidence/i.test(populatedNgoAssessment) && !/Progress evidenced/i.test(populatedNgoAssessment)) throw new Error('Evidence-backed NGO assessment should use deterministic evidence language')

console.log('Narrative validation passed: personal, field-sales and project-management report text is human-readable and free of raw pipe-delimited values.')
