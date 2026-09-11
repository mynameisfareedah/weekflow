export const ACTIVITY_TYPES = [
  'Physical Visit',
  'Virtual Engagement',
  'Pharmacy Call',
  'Phone Call',
  'Other',
  'Project Work',
  'Team Meeting',
  'Client / Stakeholder Meeting',
  'Review / Approval',
  'Planning',
  'Problem Solving',
  'Service Visit',
  'Installation',
  'Preventive Maintenance',
  'Repair / Troubleshooting',
  'Inspection',
  'Remote Support',
  'Dispatch / Team Coordination',
  'Customer Support',
  'Maintenance',
  'Repair',
  'Customer Call',
  'Customer Meeting',
  'Sales Activity',
  'Order Processing',
  'Supplier Activity',
  'Business Task',
  'Follow-up',
  'Community Visit',
  'Beneficiary Engagement',
  'Partner Meeting',
  'Volunteer Activity',
  'Programme Activity',
  'Monitoring / Evaluation',
  'Lesson',
  'Student Support',
  'Assessment',
  'Parent / Guardian Meeting',
  'Teacher Meeting',
  'Task',
  'Appointment',
  'Errand',
  'Personal Project',
  'Exercise / Routine',
  'Activity',
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
  'Progress Made',
  'Blocker Identified',
  'Risk Identified',
  'Decision Made',
  'Deliverable Completed',
  'Stakeholder Alignment',
  'Approval Received',
  'Sale / Order Won',
  'Lead Qualified',
  'Customer Retained',
  'Payment Received',
  'Supplier Issue Identified',
  'Operational Improvement',
  'Issue Resolved',
  'Issue Partially Resolved',
  'Issue Unresolved',
  'Installation Completed',
  'Preventive Maintenance Completed',
  'Inspection Completed',
  'Customer Sign-off Obtained',
  'Parts Required',
  'Escalation Required',
  'Equipment Fault Identified',
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
  product?: string
  stockStatus?: string
  progressStatus?: string
  blockerRisk?: string
  decision?: string
  workOrderJob?: string
  equipmentAsset?: string
  issueProblem?: string
  resolution?: string
  serviceStatus?: string
  partsMaterialsUsed?: string
  escalation?: string
  slaPriority?: string
  downtime?: string
  customerSignOff?: string
  createdAt: string
  updatedAt: string
}
