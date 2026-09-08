export interface WeekFlowTemplate {
  id: string
  name: string
  terminology: {
    activity: string
    activityPlural: string
    account: string
    contact: string
    objective: string
    outcome: string
    followUp: string
  }
  report: {
    title: string
    preparedBy: string
    role: string
    portfolio: string
  }
}

export const FIELD_SALES_TEMPLATE: WeekFlowTemplate = {
  id: 'field-sales',
  name: 'Field Sales',
  terminology: {
    activity: 'Activity',
    activityPlural: 'Activities',
    account: 'Account / Facility',
    contact: 'HCP / Doctor / Stakeholder',
    objective: 'Objective',
    outcome: 'Outcome',
    followUp: 'Follow-up',
  },
  report: {
    title: "This Week's Field Activity Report",
    preparedBy: 'WAHEED YUSUF',
    role: 'Field Sales Manager - Key Account WWCV (Johnson & Johnson)',
    portfolio: 'ZYTIGA® | INVEGA SUSTENNA® | TRIVECTA®',
  },
}