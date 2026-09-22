export const PLAN_CATEGORIES = [
  'facilities',
  'hcps',
  'primaryObjectives',
  'virtualEngagements',
  'accountObjectives',
  'commercialPriorities',
  'successMeasures',
] as const

export type PlanCategory = (typeof PLAN_CATEGORIES)[number]

export type DayId = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface PlanItem {
  id: string
  text: string
}

export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical'

export interface WeeklyObjective extends PlanItem {
  successMeasure?: string
  target?: string
  priority?: PriorityLevel
}

export interface EducationLearningObjective {
  id: string
  objective: string
  successMeasure?: string
  priority?: PriorityLevel
}

export interface EducationTeachingPlanItem {
  id: string
  day: DayId
  topic: string
  teachingActivity?: string
  learningActivity?: string
  duration?: string
}

export interface EducationWeeklyTarget {
  id: string
  target: string
  measure?: string
  priority?: PriorityLevel
}

export interface EducationContext {
  courseProgramme?: string
  classGroup?: string
  instructor?: string
  weeklyTheme?: string
}

export type FieldJobStatus = 'Scheduled' | 'Assigned' | 'Pending' | 'Dispatched' | 'In Progress' | 'Completed' | 'On Hold'
export type FieldIssueStatus = 'Reported' | 'Assigned' | 'Investigating' | 'Action Taken' | 'Resolved' | 'Verified' | 'Closed'

export interface FieldJob {
  id: string
  jobId: string
  customer: string
  location: string
  contactPerson?: string
  jobType: string
  priority?: PriorityLevel
  assignedTechnician?: string
  scheduledDate?: string
  scheduledDay?: string
  startTime?: string
  endTime?: string
  description?: string
  equipment?: string
  issue?: string
  actionsTaken?: string
  partsUsed?: string
  findings?: string
  resolution?: string
  customerConfirmation?: string
  photos?: string[]
  status?: FieldJobStatus
  followUpDate?: string
}

export interface FieldServiceIssue {
  id: string
  issueId: string
  customer: string
  problem: string
  priority?: PriorityLevel
  assignedTechnician?: string
  status?: FieldIssueStatus
}

export interface FieldEquipment {
  id: string
  equipmentId: string
  customerSite: string
  condition?: string
  lastService?: string
  nextService?: string
  status?: string
}

export interface FieldTeamPlan {
  id: string
  technician: string
  jobs?: string
  locations?: string
  hoursPlanned?: string
  status?: string
}

export interface FieldDailyScheduleItem {
  id: string
  day: string
  time?: string
  technician?: string
  customer?: string
  job?: string
}

export interface FieldPartResource {
  id: string
  job?: string
  partResource: string
  quantity?: string
  status?: string
}

export interface VirtualEngagementPlanItem {
  id: string
  coverage: string
  priorityContacts: PlanItem[]
  objective: string
  relatedObjective?: string
  owner?: string
  priority?: PriorityLevel
  plannedDate?: string
  startTime?: string
  endTime?: string
  estimatedHours?: string
  dependency?: string
  status?: string
}

export interface AccountObjective {
  id: string
  account: string
  objectives: PlanItem[]
  owner?: string
  priority?: PriorityLevel
  plannedDate?: string
  estimatedHours?: string
  dependency?: string
  status?: string
}

export type SuccessMeasureCategory = 'coverage' | 'engagement' | 'commercial' | 'account' | 'scientific' | 'other'

export interface CommercialPriority {
  id: string
  text: string
  opportunity?: string
  account?: string
  product?: string
  priority?: PriorityLevel
}

export interface SuccessMeasure {
  id: string
  text: string
  target?: string
  unit?: string
  category?: SuccessMeasureCategory
}

export interface WeeklyProgrammeContext {
  programme?: string
  organisation?: string
  weeklyTheme?: string
  programmeLead?: string
  programmeStatus?: string
}

export interface ProgrammeActivity {
  id: string
  activity: string
  programmeArea?: string
  location?: string
  owner?: string
  plannedDate?: string
  target?: string
  status?: string
}

export interface CommunityEngagementItem {
  id: string
  communityGroup: string
  engagementActivity: string
  target?: string
  plannedDate?: string
  responsible?: string
}

export interface VolunteerPlanItem {
  id: string
  volunteer: string
  role: string
  activity: string
  date?: string
  status?: string
}

export interface StakeholderPlanItem {
  id: string
  stakeholder: string
  purpose: string
  actionRequired?: string
  owner?: string
  due?: string
  status?: string
}

export interface ResourceLogisticsItem {
  id: string
  resource: string
  required?: string
  available?: string
  gap?: string
  action?: string
}

export interface CommunicationPlanItem {
  id: string
  communication: string
  audience?: string
  channel?: string
  date?: string
  status?: string
}

export interface DocumentationPlanItem {
  id: string
  documentation: string
  required?: string
  responsible?: string
  status?: string
}

export interface MonitoringImpactTarget {
  id: string
  kind: 'outputs' | 'intended-outcomes'
  text: string
}

export type DayCategories = Record<PlanCategory, PlanItem[]>

export type LegacyDayCommercialPriority = PlanItem
export type LegacyDaySuccessMeasure = PlanItem

export interface DayPlan {
  id: DayId
  label: string
  date: string

  /**
   * Legacy compatibility layer for the original daily field-plan template.
   * These day-level category arrays are kept readable for older saved data and
   * current intelligence logic, but they are not the canonical weekly work-plan fields.
   */
  categories: {
    facilities: PlanItem[]
    hcps: PlanItem[]
    primaryObjectives: PlanItem[]

    // Legacy compatibility only.
    virtualEngagements: PlanItem[]
    accountObjectives: PlanItem[]
    commercialPriorities: PlanItem[]
    successMeasures: PlanItem[]
  }
}

export interface WeeklyPlan {
  weekStart: string

  /** Optional Education planning context; actual learning evidence belongs in Daily Activity. */
  educationWeeklyFocus?: string
  educationLearningObjectives?: EducationLearningObjective[]
  educationTeachingPlan?: EducationTeachingPlanItem[]
  educationWeeklyTargets?: EducationWeeklyTarget[]
  educationContext?: EducationContext

  /** Canonical weekly work-plan field; not the same as day categories. */
  weeklyStrategicObjectives: WeeklyObjective[]

  days: DayPlan[]

  /** Optional template-aware programme metadata. */
  programmeContext?: WeeklyProgrammeContext

  /** Optional NGO programme activity planning. */
  programmeActivities?: ProgrammeActivity[]

  /** Optional NGO community engagement planning. */
  communityEngagement?: CommunityEngagementItem[]

  /** Optional NGO volunteer planning. */
  volunteerPlan?: VolunteerPlanItem[]

  /** Optional NGO stakeholder planning. */
  stakeholderPlan?: StakeholderPlanItem[]

  /** Optional NGO resource and logistics planning. */
  resourcesLogistics?: ResourceLogisticsItem[]

  /** Optional NGO communications planning. */
  communicationsPlan?: CommunicationPlanItem[]

  /** Optional NGO documentation planning. */
  documentationPlan?: DocumentationPlanItem[]

  /** Optional NGO monitoring and impact tracking. */
  monitoringImpactTargets?: MonitoringImpactTarget[]

  /** Canonical weekly work-plan field; not the same as DayPlan.categories.virtualEngagements. */
  virtualEngagementPlan: VirtualEngagementPlanItem[]

  /** Canonical weekly work-plan field; not the same as DayPlan.categories.accountObjectives. */
  keyAccountObjectives: AccountObjective[]

  /** Canonical weekly work-plan field; not the same as DayPlan.categories.commercialPriorities. */
  commercialPriorities: CommercialPriority[]

  /** Canonical weekly work-plan field; not the same as DayPlan.categories.successMeasures. */
  successMeasures: SuccessMeasure[]

  /** Optional Field Operations planning records; execution fields remain reserved for later phases. */
  fieldJobs?: FieldJob[]
  fieldServiceIssues?: FieldServiceIssue[]
  fieldEquipment?: FieldEquipment[]
  fieldTeamPlan?: FieldTeamPlan[]
  fieldDailySchedule?: FieldDailyScheduleItem[]
  fieldPartsResources?: FieldPartResource[]
}
