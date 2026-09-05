import type { DailyActivity, StructuredOutcome } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { WeeklyPlan } from '../types/weeklyPlan'

export type IntelligenceInput = {
  selectedWeek: string
  plan: WeeklyPlan
  activities: DailyActivity[]
  followUps: FollowUp[]
}

export type IntelligenceCategory = 'commercial' | 'patient' | 'access-market' | 'strategic-accounts' | 'scientific-engagement'
export type OpportunityStrength = 'low' | 'moderate' | 'high' | 'priority'
export type PlanGapStatus = 'covered' | 'partially covered' | 'not evidenced' | 'needs review'

export interface Evidence {
  activityId: string
  account: string
  text: string
  outcome?: StructuredOutcome
}

export interface FollowUpSuggestion {
  type: 'follow-up'
  title: string
  reason: string
  priority: 'normal' | 'high'
  sourceActivityId: string
  account: string
}

export interface OpportunitySignal {
  type: 'commercial-opportunity'
  account: string
  title: string
  reason: string
  strength: OpportunityStrength
  category: IntelligenceCategory
  evidence: Evidence[]
}

export interface OpportunityScore {
  account: string
  strength: OpportunityStrength
  reason: string
  score: number
  signals: string[]
}

export interface PlanGap {
  itemId: string
  category: string
  item: string
  dayLabel: string
  status: PlanGapStatus
  reason: string
}

export interface WeeklyInsight {
  category: IntelligenceCategory
  title: string
  detail: string
  account: string
  evidence: Evidence[]
}

export interface Recommendation {
  title: string
  reason: string
  priority: 'normal' | 'high'
  category: IntelligenceCategory
  sourceActivityId?: string
  account?: string
}

export interface DataQualityWarning {
  severity: 'warning'
  title: string
  reason: string
  account?: string
  sourceActivityId?: string
}

export interface CarryForwardCandidate {
  title: string
  reason: string
  category: IntelligenceCategory
  account?: string
  hcpName?: string
  priority?: 'normal' | 'high'
  source?: 'follow-up' | 'plan-gap' | 'data-quality'
  sourceActivityId?: string
}

export interface ReportReadiness {
  status: 'ready' | 'review' | 'empty'
  activityCount: number
  openFollowUpCount: number
  warningCount: number
  highPriorityCount: number
  summary: string
}

export interface WeeklyIntelligence {
  selectedWeek: string
  followUpSuggestions: FollowUpSuggestion[]
  opportunitySignals: OpportunitySignal[]
  opportunityScores: OpportunityScore[]
  planGaps: PlanGap[]
  insights: Record<IntelligenceCategory, WeeklyInsight[]>
  recommendations: Recommendation[]
  dataQualityWarnings: DataQualityWarning[]
  carryForwardCandidates: CarryForwardCandidate[]
  reportReadiness: ReportReadiness
}