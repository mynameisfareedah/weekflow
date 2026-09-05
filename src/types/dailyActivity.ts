export const ACTIVITY_TYPES = [
  'Physical Visit',
  'Virtual Engagement',
  'Pharmacy Call',
  'Phone Call',
  'Other',
] as const

export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const STRUCTURED_OUTCOME_TYPES = [
  'Prescription Generated',
  'Patient Identified',
  'Patient Access / Access Barrier',
  'Stock Issue',
  'Scientific Engagement',
  'MDT Opportunity',
  'CME / Meeting Opportunity',
  'Referral Opportunity',
  'Follow-up Required',
  'Other',
] as const

export type StructuredOutcomeType = (typeof STRUCTURED_OUTCOME_TYPES)[number]

export const PORTFOLIO_PRODUCTS = ['ZYTIGA', 'INVEGA SUSTENNA', 'TRIVECTA', 'Other'] as const
export type PortfolioProduct = (typeof PORTFOLIO_PRODUCTS)[number]

export type StockStatus = 'Stock available' | 'Stock low' | 'Stock depleted' | 'Replenishment required'

export interface StructuredOutcome {
  id: string
  type: StructuredOutcomeType
  details: string
  product?: PortfolioProduct
  quantity?: string
  stockStatus?: StockStatus
}

export interface DailyActivity {
  id: string
  date: string
  weekStart: string
  plannedActivityId: string | null
  account: string
  activityType: ActivityType
  hcpNames: string[]
  outcome: string
  intelligence: string
  nextAction: string
  structuredOutcomes: StructuredOutcome[]
  createdAt: string
  updatedAt: string
}
