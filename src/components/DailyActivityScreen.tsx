import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { loadDailyActivities, loadDailyActivitiesAsync, saveDailyActivitiesAsync } from '../storage/dailyActivityStorage'
import { queueFollowUpPrefill } from '../storage/followUpsStorage'
import { loadFollowUps } from '../storage/followUpsStorage'
import { getSelectedWeekStart, loadWeeklyPlan, loadWeeklyPlanAsync } from '../storage/weeklyPlanStorage'
import { deriveWeeklyIntelligence } from '../intelligence/intelligenceEngine'
import type { FollowUpSuggestion } from '../intelligence/intelligenceTypes'
import {
  PORTFOLIO_PRODUCTS,
  type ActivityType,
  type DailyActivity,
  type PortfolioProduct,
  type StructuredOutcome,
  type StructuredOutcomeType,
} from '../types/dailyActivity'
import type { DayPlan, PlanItem, WeeklyPlan } from '../types/weeklyPlan'
import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates'
import { getTemplateTerminology } from '../config/templateTerminology'
import { AppIcon } from './TemplateIcon'
import { getActivityFieldDescriptors, isActivityFieldEnabled, isActivityFieldRequired, type ActivityFieldKey } from '../activity/activityFieldAdapter'
import { getActivityTypeOptions } from '../activity/activityTypeAdapter'
import { getStructuredOutcomeOptions } from '../activity/structuredOutcomeAdapter'
import { getExecutablePlannedActivities, type PlannedActivity } from '../planning/plannedActivityAdapter'
import { loadCustomTemplateConfig } from '../storage/customTemplateStorage'
import { hasAuthenticatedCloudWorkspace } from '../storage/workspaceStorage'
import { DEFAULT_CUSTOM_STATUSES, type CustomField } from '../types/customTemplate'
import './DailyActivity.css'

interface ActivityDraft {
  account: string
  activityType: ActivityType
  hcpNames: string[]
  outcome: string
  workPerformed?: string
  actualResults?: string
  programmeArea?: string
  location?: string
  communityGroup?: string
  engagementActivity?: string
  actualReach?: string
  engagementResult?: string
  volunteer?: string
  volunteerRole?: string
  volunteerActivity?: string
  volunteerParticipation?: string
  volunteerContribution?: string
  stakeholder?: string
  stakeholderPurpose?: string
  stakeholderEngagement?: string
  stakeholderResult?: string
  stakeholderNextStep?: string
  resource?: string
  resourceActual?: string
  resourceIssue?: string
  resourceAction?: string
  timeSpent?: string
  dailySummary?: string
  carryForward?: string
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
  jobCustomer?: string
  jobPriority?: string
  assignedTechnician?: string
  contactPerson?: string
  arrivalTime?: string
  departureTime?: string
  actionsTaken?: string
  partsUsed?: string
  findings?: string
  condition?: string
  servicePerformed?: string
  nextServiceDate?: string
  followUpRequired?: string
  followUpDate?: string
  issuePriority?: string
  educationCourseProgramme?: string
  educationClassGroup?: string
  educationTopic?: string
  educationInstructor?: string
  educationLearningObjectiveId?: string
  educationTeachingActivity?: string
  educationStudentActivity?: string
  educationLearnerCount?: string
  educationExpectedOutput?: string
  educationLearningResult?: string
  educationStatus?: string
  customCategoryId: string
  customStatusId: string
  customFieldValues: Record<string, unknown>
}

const EMPTY_DRAFT: ActivityDraft = {
  account: '',
  activityType: 'Physical Visit',
  hcpNames: [],
  outcome: '',
  workPerformed: '',
  actualResults: '',
  programmeArea: '',
  location: '',
  communityGroup: '',
  engagementActivity: '',
  actualReach: '',
  engagementResult: '',
  volunteer: '',
  volunteerRole: '',
  volunteerActivity: '',
  volunteerParticipation: '',
  volunteerContribution: '',
  stakeholder: '',
  stakeholderPurpose: '',
  stakeholderEngagement: '',
  stakeholderResult: '',
  stakeholderNextStep: '',
  resource: '',
  resourceActual: '',
  resourceIssue: '',
  resourceAction: '',
  timeSpent: '',
  dailySummary: '',
  carryForward: '',
  intelligence: '',
  nextAction: '',
  structuredOutcomes: [],
  product: '',
  stockStatus: '',
  progressStatus: '',
  blockerRisk: '',
  decision: '',
  workOrderJob: '',
  equipmentAsset: '',
  issueProblem: '',
  resolution: '',
  serviceStatus: '',
  partsMaterialsUsed: '',
  escalation: '',
  slaPriority: '',
  downtime: '',
  customerSignOff: '',
  jobCustomer: '',
  jobPriority: '',
  assignedTechnician: '',
  contactPerson: '',
  arrivalTime: '',
  departureTime: '',
  actionsTaken: '',
  partsUsed: '',
  findings: '',
  condition: '',
  servicePerformed: '',
  nextServiceDate: '',
  followUpRequired: '',
  followUpDate: '',
  issuePriority: '',
  educationCourseProgramme: '',
  educationClassGroup: '',
  educationTopic: '',
  educationInstructor: '',
  educationLearningObjectiveId: '',
  educationTeachingActivity: '',
  educationStudentActivity: '',
  educationLearnerCount: '',
  educationExpectedOutput: '',
  educationLearningResult: '',
  educationStatus: '',
  customCategoryId: '',
  customStatusId: '',
  customFieldValues: {},
}

function getInitialDraft(initialActivity: DailyActivity | null, plannedActivity: PlannedActivity | null, template: WeekFlowTemplate): ActivityDraft {
  if (initialActivity) {
    return {
      account: initialActivity.account,
      activityType: initialActivity.activityType,
      hcpNames: [...initialActivity.hcpNames],
      outcome: initialActivity.outcome,
      workPerformed: initialActivity.workPerformed ?? '',
      actualResults: initialActivity.actualResults ?? '',
      programmeArea: initialActivity.programmeArea ?? '',
      location: initialActivity.location ?? '',
      communityGroup: initialActivity.communityGroup ?? '',
      engagementActivity: initialActivity.engagementActivity ?? '',
      actualReach: initialActivity.actualReach ?? '',
      engagementResult: initialActivity.engagementResult ?? '',
      volunteer: initialActivity.volunteer ?? '',
      volunteerRole: initialActivity.volunteerRole ?? '',
      volunteerActivity: initialActivity.volunteerActivity ?? '',
      volunteerParticipation: initialActivity.volunteerParticipation ?? '',
      volunteerContribution: initialActivity.volunteerContribution ?? '',
      stakeholder: initialActivity.stakeholder ?? '',
      stakeholderPurpose: initialActivity.stakeholderPurpose ?? '',
      stakeholderEngagement: initialActivity.stakeholderEngagement ?? '',
      stakeholderResult: initialActivity.stakeholderResult ?? '',
      stakeholderNextStep: initialActivity.stakeholderNextStep ?? '',
      resource: initialActivity.resource ?? '',
      resourceActual: initialActivity.resourceActual ?? '',
      resourceIssue: initialActivity.resourceIssue ?? '',
      resourceAction: initialActivity.resourceAction ?? '',
      timeSpent: initialActivity.timeSpent ?? '',
      dailySummary: initialActivity.dailySummary ?? '',
      carryForward: initialActivity.carryForward ?? '',
      intelligence: initialActivity.intelligence,
      nextAction: initialActivity.nextAction,
      structuredOutcomes: initialActivity.structuredOutcomes.map((outcome) => ({ ...outcome })),
      product: initialActivity.product ?? '',
      stockStatus: initialActivity.stockStatus ?? '',
      progressStatus: initialActivity.progressStatus ?? '',
      blockerRisk: initialActivity.blockerRisk ?? '',
      decision: initialActivity.decision ?? '',
      workOrderJob: initialActivity.workOrderJob ?? '',
      equipmentAsset: initialActivity.equipmentAsset ?? '',
      issueProblem: initialActivity.issueProblem ?? '',
      resolution: initialActivity.resolution ?? '',
      serviceStatus: initialActivity.serviceStatus ?? '',
      partsMaterialsUsed: initialActivity.partsMaterialsUsed ?? '',
      escalation: initialActivity.escalation ?? '',
      slaPriority: initialActivity.slaPriority ?? '',
      downtime: initialActivity.downtime ?? '',
      customerSignOff: initialActivity.customerSignOff ?? '',
      jobCustomer: initialActivity.jobCustomer ?? '',
      jobPriority: initialActivity.jobPriority ?? '',
      assignedTechnician: initialActivity.assignedTechnician ?? '',
      contactPerson: initialActivity.contactPerson ?? '',
      arrivalTime: initialActivity.arrivalTime ?? '',
      departureTime: initialActivity.departureTime ?? '',
      actionsTaken: initialActivity.actionsTaken ?? '',
      partsUsed: initialActivity.partsUsed ?? '',
      findings: initialActivity.findings ?? '',
      condition: initialActivity.condition ?? '',
      servicePerformed: initialActivity.servicePerformed ?? '',
      nextServiceDate: initialActivity.nextServiceDate ?? '',
      followUpRequired: initialActivity.followUpRequired ?? '',
      followUpDate: initialActivity.followUpDate ?? '',
      issuePriority: initialActivity.issuePriority ?? '',
      educationCourseProgramme: initialActivity.educationCourseProgramme ?? '',
      educationClassGroup: initialActivity.educationClassGroup ?? '',
      educationTopic: initialActivity.educationTopic ?? '',
      educationInstructor: initialActivity.educationInstructor ?? '',
      educationLearningObjectiveId: initialActivity.educationLearningObjectiveId ?? '',
      educationTeachingActivity: initialActivity.educationTeachingActivity ?? '',
      educationStudentActivity: initialActivity.educationStudentActivity ?? '',
      educationLearnerCount: initialActivity.educationLearnerCount ?? '',
      educationExpectedOutput: initialActivity.educationExpectedOutput ?? '',
      educationLearningResult: initialActivity.educationLearningResult ?? '',
      educationStatus: initialActivity.educationStatus ?? '',
      customCategoryId: initialActivity.customCategoryId ?? '',
      customStatusId: initialActivity.customStatusId ?? '',
      customFieldValues: initialActivity.customFieldValues ?? {},
    }
  }
  return {
    ...EMPTY_DRAFT,
    hcpNames: [],
    structuredOutcomes: [],
    account: plannedActivity?.account ?? '',
    activityType: plannedActivity?.activityType ?? template.activityTypes[0],
    programmeArea: plannedActivity?.programmeArea ?? '',
    location: plannedActivity?.location ?? '',
    workOrderJob: plannedActivity?.jobId ?? '',
    jobCustomer: plannedActivity?.customer ?? '',
    contactPerson: '',
    jobPriority: plannedActivity?.priority ?? '',
    assignedTechnician: plannedActivity?.technician ?? '',
    educationCourseProgramme: plannedActivity?.educationCourseProgramme ?? '',
    educationClassGroup: plannedActivity?.educationClassGroup ?? '',
    educationTopic: plannedActivity?.educationTopic ?? '',
    educationInstructor: plannedActivity?.educationInstructor ?? '',
    educationLearningObjectiveId: plannedActivity?.educationLearningObjectiveId ?? '',
    educationTeachingActivity: plannedActivity?.educationTeachingActivity ?? '',
    educationStudentActivity: plannedActivity?.educationStudentActivity ?? '',
    customCategoryId: template.id === 'custom' ? loadCustomTemplateConfig().categories.find((category) => category.archived !== true)?.id ?? '' : '',
    customStatusId: template.id === 'custom' ? loadCustomTemplateConfig().statuses[0]?.id ?? DEFAULT_CUSTOM_STATUSES[0].id : '',
    customFieldValues: {},
  }
}

function createId() {
  return crypto.randomUUID()
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function getItemTexts(items: PlanItem[]) {
  return items.map((item) => item.text)
}

function ActivityCaptureForm({
  day,
  plannedActivity,
  initialActivity,
  onSave,
  onCancel,
  template,
}: {
  day: DayPlan
  plannedActivity: PlannedActivity | null
  initialActivity: DailyActivity | null
  onSave: (draft: ActivityDraft, plannedActivityId: string | null, activityId?: string) => Promise<void>
  onCancel: () => void
  template: WeekFlowTemplate
}) {
  const [draft, setDraft] = useState<ActivityDraft>(() => getInitialDraft(initialActivity, plannedActivity, template))
  const terminology = getTemplateTerminology(template)
  const [hcpInput, setHcpInput] = useState('')
  const [outcomeType, setOutcomeType] = useState<StructuredOutcomeType | ''>('')
  const [customValidation, setCustomValidation] = useState('')
  const availableHcps = getItemTexts(day.categories.hcps)
  const accountOptions = getItemTexts(day.categories.facilities)
  const plannedFocus = plannedActivity?.focus
  const activityFields = getActivityFieldDescriptors(template)
  const structuredOutcomeOptions = getStructuredOutcomeOptions(template)
  const isFieldEnabled = (key: ActivityFieldKey) => isActivityFieldEnabled(template, key, draft.activityType)
  const isFieldRequired = (key: ActivityFieldKey) => isActivityFieldRequired(template, key)
  const accountPlaceholder = template.id === 'personal' ? 'Area / Commitment' : 'Select or add an account'
  const customConfig = template.id === 'custom' ? loadCustomTemplateConfig() : null
  const customStatuses = customConfig?.statuses.length ? [...customConfig.statuses].sort((left, right) => left.order - right.order) : DEFAULT_CUSTOM_STATUSES
  const customCategories = customConfig?.categories.filter((category) => category.archived !== true || Boolean(initialActivity && category.id === draft.customCategoryId)) ?? []
  const customCategory = customCategories.find((category) => category.id === draft.customCategoryId) ?? customCategories[0]
  const customFields = customCategory?.fields.filter((field) => field.archived !== true || Boolean(initialActivity && Object.prototype.hasOwnProperty.call(draft.customFieldValues, field.id))) ?? []

  function updateDraft<K extends keyof ActivityDraft>(key: K, value: ActivityDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function addHcp() {
    const name = hcpInput.trim()
    if (name && !draft.hcpNames.some((hcp) => hcp.toLowerCase() === name.toLowerCase())) {
      updateDraft('hcpNames', [...draft.hcpNames, name])
    }
    setHcpInput('')
  }

  function handleHcpKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addHcp()
    }
  }

  function addStructuredOutcome() {
    if (!outcomeType) return
    setDraft((current) => ({
      ...current,
      structuredOutcomes: [...current.structuredOutcomes, { id: createId(), type: outcomeType, details: '' }],
    }))
    setOutcomeType('')
  }

  function updateOutcome(id: string, changes: Partial<StructuredOutcome>) {
    setDraft((current) => ({
      ...current,
      structuredOutcomes: current.structuredOutcomes.map((outcome) => outcome.id === id ? { ...outcome, ...changes } : outcome),
    }))
  }

  function removeOutcome(id: string) {
    setDraft((current) => ({ ...current, structuredOutcomes: current.structuredOutcomes.filter((outcome) => outcome.id !== id) }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.account.trim()) return
    if (template.id === 'custom' && !draft.customCategoryId) { setCustomValidation('Choose a category.'); return }
    if (template.id === 'custom' && customCategory) {
      const missing = customFields.find((field) => { const value = draft.customFieldValues[field.id]; return field.archived !== true && field.required && (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) })
      if (missing) { setCustomValidation(`${missing.name} is required.`); return }
    }
    setCustomValidation('')
    await onSave({ ...draft, account: draft.account.trim() }, plannedActivity?.id ?? initialActivity?.plannedActivityId ?? null, initialActivity?.id)
  }

  function updateCustomValue(field: CustomField, value: unknown) {
    setDraft((current) => ({ ...current, customFieldValues: { ...current.customFieldValues, [field.id]: value } }))
  }

  function renderCustomField(field: CustomField) {
    const value = draft.customFieldValues[field.id]
    const isArchived = field.archived === true
    const label = `${field.name}${field.required && !isArchived ? ' *' : ''}${isArchived ? ' · ARCHIVED' : ''}`
    if (field.type === 'checkbox') return <label key={field.id} className="custom-activity-checkbox"><input type="checkbox" checked={value === true} disabled={isArchived} onChange={(event) => updateCustomValue(field, event.target.checked)} /><span>{label}</span></label>
    if (field.type === 'long-text') return <label key={field.id}><span>{label}</span><textarea value={typeof value === 'string' ? value : ''} disabled={isArchived} onChange={(event) => updateCustomValue(field, event.target.value)} rows={3} placeholder={field.description ?? field.name} /></label>
    if (field.type === 'dropdown') return <label key={field.id}><span>{label}</span><select value={typeof value === 'string' ? value : ''} disabled={isArchived} onChange={(event) => updateCustomValue(field, event.target.value)}><option value="">Select</option>{(field.options ?? []).map((option) => <option key={option}>{option}</option>)}</select></label>
    if (field.type === 'multi-select') return <label key={field.id}><span>{label}</span><select multiple value={Array.isArray(value) ? value as string[] : []} disabled={isArchived} onChange={(event) => updateCustomValue(field, Array.from(event.target.selectedOptions, (option) => option.value))}>{(field.options ?? []).map((option) => <option key={option}>{option}</option>)}</select></label>
    const inputType = field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : field.type === 'number' || field.type === 'percentage' || field.type === 'currency' ? 'number' : field.type === 'url' ? 'url' : 'text'
    return <label key={field.id}><span>{label}</span><input type={inputType} disabled={isArchived} min={field.type === 'percentage' ? '0' : undefined} max={field.type === 'percentage' ? '100' : undefined} value={value === undefined ? '' : String(value)} onChange={(event) => updateCustomValue(field, field.type === 'number' || field.type === 'percentage' || field.type === 'currency' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)} placeholder={field.description ?? field.name} /></label>
  }

  return (
    <form className="activity-capture-form" onSubmit={save}>
      <div className="capture-form-heading">
        <div>
          <p className="eyebrow">{initialActivity ? 'Edit activity' : 'Daily activity'}</p>
          <h2>{initialActivity ? 'Update what happened' : 'What did you actually do?'}</h2>
        </div>
        <button className="text-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
      {plannedFocus && (
        <div className="planned-context">
          <span>Planned focus</span>
          <p>{plannedFocus}</p>
        </div>
      )}
      {template.id === 'custom' && customConfig && <>
        {customCategories.length === 0 ? <div className="custom-activity-empty">No active activity categories yet. Create or restore a category in Template Configuration before recording structured Custom activities.</div> : <>
          <div className="custom-activity-controls"><label className="custom-activity-category"><span>Category</span><select aria-label="Custom Activity Category" value={customCategory?.id ?? ''} disabled={Boolean(initialActivity && customCategory?.archived)} onChange={(event) => { updateDraft('customCategoryId', event.target.value); setCustomValidation('') }}>{customCategories.sort((left, right) => left.order - right.order).map((category) => <option key={category.id} value={category.id}>{category.name}{category.archived ? ' · ARCHIVED' : ''}</option>)}</select></label><label className="custom-activity-category"><span>Status</span><select aria-label="Custom Activity Status" value={draft.customStatusId || customStatuses[0]?.id || ''} onChange={(event) => updateDraft('customStatusId', event.target.value)}>{customStatuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select></label></div>
          <div className="custom-activity-grid"><label><span>What did you work on? *</span><input aria-label="Custom Activity" value={draft.account} onChange={(event) => updateDraft('account', event.target.value)} /></label>{customFields.map(renderCustomField)}</div>
          <div className="capture-text-grid">
            <label><span>Outcome</span><textarea aria-label="Outcome" value={draft.outcome} onChange={(event) => updateDraft('outcome', event.target.value)} placeholder="What was the outcome?" rows={2} /></label>
            <label><span>Next Action</span><textarea aria-label="Next Action" value={draft.nextAction} onChange={(event) => updateDraft('nextAction', event.target.value)} placeholder="Enter the next action..." rows={2} /></label>
          </div>
        </>}
        {customValidation && <p className="custom-activity-validation" role="alert">{customValidation}</p>}
      </>}
      {template.id !== 'custom' && <>
      <div className="capture-form-grid">
        {isFieldEnabled('account') && <label>
          <span>{activityFields.find((field) => field.key === 'account')?.label}</span>
          <input autoFocus={!plannedActivity && !initialActivity} list="daily-account-options" value={draft.account} onChange={(event) => updateDraft('account', event.target.value)} placeholder={accountPlaceholder} required={isFieldRequired('account')} />
          <datalist id="daily-account-options">{accountOptions.map((account) => <option key={account} value={account} />)}</datalist>
        </label>}
        <label>
          <span>{terminology.activityType}</span>
          <select className="activity-type-select" aria-label="Activity type" value={draft.activityType} onChange={(event) => updateDraft('activityType', event.target.value as ActivityType)}>
            {getActivityTypeOptions(template).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      {isFieldEnabled('hcpNames') && <fieldset className="hcp-fieldset">
        <legend>{activityFields.find((field) => field.key === 'hcpNames')?.label}</legend>
        <div className="add-hcp-form">
              <input autoFocus={Boolean(plannedActivity || initialActivity)} enterKeyHint="done" list="daily-hcp-options" value={hcpInput} onChange={(event) => setHcpInput(event.target.value)} onKeyDown={handleHcpKeyDown} placeholder={`Enter ${activityFields.find((field) => field.key === 'hcpNames')?.label ?? terminology.person}...`} aria-label={`Enter ${activityFields.find((field) => field.key === 'hcpNames')?.label ?? terminology.person}`} />
          <datalist id="daily-hcp-options">{availableHcps.map((hcp) => <option key={hcp} value={hcp} />)}</datalist>
          <button type="button" onClick={addHcp}>Add</button>
        </div>
        {draft.hcpNames.length > 0 && (
          <div className="hcp-chips" aria-label={`Added ${terminology.people.toLowerCase()}`}>
            {draft.hcpNames.map((hcp) => (
              <span className="hcp-chip" key={hcp}>
                {hcp}
                <button type="button" aria-label={`Remove ${hcp}`} onClick={() => updateDraft('hcpNames', draft.hcpNames.filter((name) => name !== hcp))}>×</button>
              </span>
            ))}
          </div>
        )}
      </fieldset>}
      <div className="capture-form-grid">
        {([
          'workPerformed',
          'actualResults',
          'programmeArea',
          'location',
          'communityGroup',
          'engagementActivity',
          'actualReach',
          'engagementResult',
          'volunteer',
          'volunteerRole',
          'volunteerActivity',
          'volunteerParticipation',
          'volunteerContribution',
          'stakeholder',
          'stakeholderPurpose',
          'stakeholderEngagement',
          'stakeholderResult',
          'stakeholderNextStep',
          'resource',
          'resourceActual',
          'resourceIssue',
          'resourceAction',
          'timeSpent',
          'dailySummary',
          'carryForward',
          'workOrderJob',
          'equipmentAsset',
          'issueProblem',
          'resolution',
          'serviceStatus',
          'partsMaterialsUsed',
          'escalation',
          'slaPriority',
          'downtime',
          'customerSignOff',
          'jobCustomer',
          'jobPriority',
          'assignedTechnician',
          'contactPerson',
          'arrivalTime',
          'departureTime',
          'actionsTaken',
          'partsUsed',
          'findings',
          'condition',
          'servicePerformed',
          'nextServiceDate',
          'followUpRequired',
          'followUpDate',
          'issuePriority',
          'educationCourseProgramme',
          'educationClassGroup',
          'educationTopic',
          'educationInstructor',
          'educationLearningObjectiveId',
          'educationTeachingActivity',
          'educationStudentActivity',
          'educationLearnerCount',
          'educationExpectedOutput',
          'educationLearningResult',
          'educationStatus',
          'progressStatus',
          'blockerRisk',
          'decision',
        ] as const).map((fieldKey) => {
          const key = fieldKey as ActivityFieldKey
          if (!isFieldEnabled(key)) return null
          const fieldDescriptor = activityFields.find((field) => field.key === key)
          if (!fieldDescriptor) return null
          const value = typeof draft[key] === 'string' ? draft[key] ?? '' : ''
          const selectOptions = key === 'serviceStatus'
            ? ['Scheduled', 'Assigned', 'Dispatched', 'In Progress', 'Completed', 'Resolved', 'Awaiting Verification', 'Closed', 'Cancelled']
            : key === 'followUpRequired'
              ? ['Required', 'Not required', 'Pending']
              : key === 'customerSignOff'
                ? ['Confirmed Operational', 'Confirmation Pending', 'Customer Not Available', 'Requires Follow-up']
                  : key === 'educationLearningObjectiveId'
                    ? loadWeeklyPlan(getSelectedWeekStart()).educationLearningObjectives?.filter((objective) => objective.objective.trim()).map((objective) => objective.id) ?? []
                    : key === 'educationStatus'
                      ? ['Planned', 'In Progress', 'Completed', 'Follow-up Required']
                : null
          return (
            <label key={key}>
              <span>{fieldDescriptor.label}{isFieldRequired(key) ? ' *' : ''}</span>
              {selectOptions ? <select value={value} onChange={(event) => updateDraft(key, event.target.value)} required={isFieldRequired(key)}><option value="">Select</option>{selectOptions.map((option) => <option key={option} value={option}>{key === 'educationLearningObjectiveId' ? (loadWeeklyPlan(getSelectedWeekStart()).educationLearningObjectives?.find((objective) => objective.id === option)?.objective ?? option) : option}</option>)}</select> : <input type={key.toLowerCase().includes('date') ? 'date' : key === 'arrivalTime' || key === 'departureTime' ? 'time' : 'text'} value={value} onChange={(event) => updateDraft(key, event.target.value)} placeholder={fieldDescriptor.label} required={isFieldRequired(key)} />}
            </label>
          )
        })}
      </div>
      <div className="capture-text-grid">
        {isFieldEnabled('outcome') && <label><span>{activityFields.find((field) => field.key === 'outcome')?.label}</span><textarea value={draft.outcome} onChange={(event) => updateDraft('outcome', event.target.value)} placeholder={`What was the ${terminology.outcome.toLowerCase()}?`} rows={2} /></label>}
        {isFieldEnabled('intelligence') && <label><span>{activityFields.find((field) => field.key === 'intelligence')?.label} <em>(optional)</em></span><textarea value={draft.intelligence} onChange={(event) => updateDraft('intelligence', event.target.value)} placeholder={`Add ${terminology.notes.toLowerCase()}...`} rows={2} /></label>}
        {isFieldEnabled('nextAction') && <label><span>{activityFields.find((field) => field.key === 'nextAction')?.label} <em>(optional)</em></span><textarea value={draft.nextAction} onChange={(event) => updateDraft('nextAction', event.target.value)} placeholder={`Enter ${terminology.nextAction.toLowerCase()}...`} rows={2} /></label>}
      </div>
      {isFieldEnabled('structuredOutcomes') && <section className="structured-outcomes" aria-labelledby="structured-outcomes-heading">
        <div className="structured-heading">
          <div><h3 id="structured-outcomes-heading">Important outcomes</h3><p>Optional structured details for the future report.</p></div>
          <div className="outcome-add-control">
            <select aria-label="Select an outcome type" value={outcomeType} onChange={(event) => setOutcomeType(event.target.value as StructuredOutcomeType)}>
              <option value="">Add outcome</option>
              {structuredOutcomeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" onClick={addStructuredOutcome}>+</button>
          </div>
        </div>
        {draft.structuredOutcomes.map((outcome) => (
          <div className="structured-outcome" key={outcome.id}>
            <div className="structured-outcome-topline"><strong>{outcome.type}</strong><button type="button" onClick={() => removeOutcome(outcome.id)} aria-label={`Remove ${outcome.type}`}>Remove</button></div>
            {(outcome.type === 'Prescription Generated' || outcome.type === 'Stock Issue') && <div className="outcome-detail-grid">
              {isFieldEnabled('product') && <select aria-label={`${outcome.type} product`} value={outcome.product ?? ''} onChange={(event) => updateOutcome(outcome.id, { product: event.target.value as PortfolioProduct })}>
                <option value="">{activityFields.find((field) => field.key === 'product')?.label}</option>{PORTFOLIO_PRODUCTS.map((product) => <option key={product}>{product}</option>)}
              </select>}
              {outcome.type === 'Prescription Generated' ? <input aria-label="Quantity" value={outcome.quantity ?? ''} onChange={(event) => updateOutcome(outcome.id, { quantity: event.target.value })} placeholder="Quantity" /> : isFieldEnabled('stockStatus') && <select aria-label="Stock status" value={outcome.stockStatus ?? ''} onChange={(event) => updateOutcome(outcome.id, { stockStatus: event.target.value as StructuredOutcome['stockStatus'] })}><option value="">{activityFields.find((field) => field.key === 'stockStatus')?.label}</option><option>Stock available</option><option>Stock low</option><option>Stock depleted</option><option>Replenishment required</option></select>}
            </div>}
            <input aria-label={`${outcome.type} details`} value={outcome.details} onChange={(event) => updateOutcome(outcome.id, { details: event.target.value })} placeholder="Add a short detail..." />
          </div>
        ))}
      </section>}
      </>}
      <div className="capture-form-actions"><button className="button button-primary" type="submit">{initialActivity ? 'Save Changes' : 'Save Activity'} <AppIcon name="arrow-right" /></button></div>
    </form>
  )
}

function ActivitySummary({ activity, onEdit, onDelete, onFollowUp, template, className = '' }: { activity: DailyActivity; onEdit: () => void; onDelete: () => void; onFollowUp: () => void; template: WeekFlowTemplate; className?: string }) {
  const noContactsLabel = template.terminology.contact
  const contactCountLabel = activity.hcpNames.length === 1 ? template.terminology.person : template.terminology.people
  const isNgoTemplate = template.id === 'ngo-community'
  const customConfig = template.id === 'custom' ? loadCustomTemplateConfig() : null
  const customCategory = customConfig?.categories.find((category) => category.id === activity.customCategoryId) ?? null
  const customStatus = customConfig?.statuses.find((status) => status.id === activity.customStatusId) ?? (activity.customStatusId ? null : DEFAULT_CUSTOM_STATUSES.find((status) => status.id === activity.customStatusId))

  return (
    <article className={`activity-summary${className ? ` ${className}` : ''}`}>
      <div className="activity-summary-check" aria-hidden="true"><AppIcon name="check" /></div>
      <div className="activity-summary-main">
        <div className="activity-summary-title"><h3>{activity.account}</h3><span>{activity.activityType}</span></div>
        <p>{activity.hcpNames.length ? `${activity.hcpNames.length} ${contactCountLabel} involved` : `No ${noContactsLabel} recorded`}</p>
        {template.id === 'custom' && customCategory && <><p>Category: {customCategory.name}</p>{customStatus && <p>Status: {customStatus.name}</p>}{customCategory.fields.map((field) => { const value = activity.customFieldValues?.[field.id]; if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return null; return <p key={field.id}>{field.name}: {Array.isArray(value) ? value.join(', ') : String(value)}</p> })}</>}
        {isNgoTemplate && activity.workPerformed && <p className="summary-outcome">{activity.workPerformed}</p>}
        {isNgoTemplate && activity.actualResults && <p>{activity.actualResults}</p>}
        {isNgoTemplate && activity.programmeArea && <p>Programme area: {activity.programmeArea}</p>}
        {isNgoTemplate && activity.location && <p>Location: {activity.location}</p>}
        {isNgoTemplate && activity.communityGroup && <p>Community group: {activity.communityGroup}</p>}
        {isNgoTemplate && activity.engagementActivity && <p>Engagement activity: {activity.engagementActivity}</p>}
        {isNgoTemplate && activity.actualReach && <p>Actual reach: {activity.actualReach}</p>}
        {isNgoTemplate && activity.engagementResult && <p>Engagement result: {activity.engagementResult}</p>}
        {isNgoTemplate && activity.volunteer && <p>Volunteer: {activity.volunteer}</p>}
        {isNgoTemplate && activity.volunteerRole && <p>Volunteer role: {activity.volunteerRole}</p>}
        {isNgoTemplate && activity.volunteerActivity && <p>Volunteer activity: {activity.volunteerActivity}</p>}
        {isNgoTemplate && activity.volunteerParticipation && <p>Participation: {activity.volunteerParticipation}</p>}
        {isNgoTemplate && activity.volunteerContribution && <p>Contribution: {activity.volunteerContribution}</p>}
        {isNgoTemplate && activity.stakeholder && <p>Stakeholder: {activity.stakeholder}</p>}
        {isNgoTemplate && activity.stakeholderPurpose && <p>Purpose: {activity.stakeholderPurpose}</p>}
        {isNgoTemplate && activity.stakeholderEngagement && <p>Engagement / action: {activity.stakeholderEngagement}</p>}
        {isNgoTemplate && activity.stakeholderResult && <p>Result: {activity.stakeholderResult}</p>}
        {isNgoTemplate && activity.stakeholderNextStep && <p>Next step: {activity.stakeholderNextStep}</p>}
        {isNgoTemplate && activity.resource && <p>Resource: {activity.resource}</p>}
        {isNgoTemplate && activity.resourceActual && <p>Actual / available: {activity.resourceActual}</p>}
        {isNgoTemplate && activity.resourceIssue && <p>Issue / gap: {activity.resourceIssue}</p>}
        {isNgoTemplate && activity.resourceAction && <p>Action taken: {activity.resourceAction}</p>}
        {isNgoTemplate && activity.timeSpent && <p>Time spent: {activity.timeSpent}</p>}
        {isNgoTemplate && activity.dailySummary && <p>{activity.dailySummary}</p>}
        {isNgoTemplate && activity.carryForward && <p>Carry forward: {activity.carryForward}</p>}
        {template.id === 'field-service' && activity.jobCustomer && <p>Customer: {activity.jobCustomer}</p>}
        {template.id === 'field-service' && activity.location && <p>Location: {activity.location}</p>}
        {template.id === 'field-service' && activity.workOrderJob && <p>Job ID: {activity.workOrderJob}</p>}
        {template.id === 'field-service' && activity.serviceStatus && <p>Service status: {activity.serviceStatus}</p>}
        {template.id === 'field-service' && activity.issueProblem && <p>Issue: {activity.issueProblem}</p>}
        {template.id === 'field-service' && activity.findings && <p>Findings: {activity.findings}</p>}
        {template.id === 'field-service' && activity.actionsTaken && <p>Actions taken: {activity.actionsTaken}</p>}
        {template.id === 'field-service' && activity.resolution && <p>Resolution: {activity.resolution}</p>}
        {template.id === 'field-service' && activity.servicePerformed && <p>Service performed: {activity.servicePerformed}</p>}
        {template.id === 'field-service' && activity.downtime && <p>Downtime: {activity.downtime}</p>}
        {template.id === 'field-service' && activity.partsUsed && <p>Parts used: {activity.partsUsed}</p>}
        {template.id === 'field-service' && activity.customerSignOff && <p>Customer confirmation: {activity.customerSignOff}</p>}
        {template.id === 'education' && activity.educationCourseProgramme && <p>Course / programme: {activity.educationCourseProgramme}</p>}
        {template.id === 'education' && activity.educationClassGroup && <p>Class / group: {activity.educationClassGroup}</p>}
        {template.id === 'education' && activity.educationTopic && <p>Topic: {activity.educationTopic}</p>}
        {template.id === 'education' && activity.educationInstructor && <p>Instructor: {activity.educationInstructor}</p>}
        {template.id === 'education' && activity.educationTeachingActivity && <p>Teaching activity: {activity.educationTeachingActivity}</p>}
        {template.id === 'education' && activity.educationStudentActivity && <p>Student activity: {activity.educationStudentActivity}</p>}
        {template.id === 'education' && activity.educationLearnerCount && <p>Learners: {activity.educationLearnerCount}</p>}
        {template.id === 'education' && activity.educationExpectedOutput && <p>Expected output: {activity.educationExpectedOutput}</p>}
        {template.id === 'education' && activity.educationLearningResult && <p>Learning result: {activity.educationLearningResult}</p>}
        {template.id === 'education' && activity.educationStatus && <p>Status: {activity.educationStatus}</p>}
        {activity.outcome && <p className="summary-outcome">{activity.outcome}</p>}
        {(activity.nextAction || activity.followUpRequired === 'Required' || activity.followUpRequired === 'Pending') && <div className="next-action-summary"><span>Next action</span><p>{activity.nextAction || 'Follow-up required'}</p><button type="button" onClick={onFollowUp}>+ Add Follow-up</button></div>}
        {activity.structuredOutcomes.length > 0 && <div className="summary-tags">{activity.structuredOutcomes.map((outcome) => <span key={outcome.id}>{outcome.type}</span>)}</div>}
      </div>
      <div className="summary-actions"><button type="button" onClick={onEdit}>Edit</button><button type="button" onClick={onDelete}>Delete</button></div>
    </article>
  )
}

export default function DailyActivityScreen({ template = FIELD_SALES_TEMPLATE }: { template?: WeekFlowTemplate }) {
  const terminology = getTemplateTerminology(template)
  const weekStart = getSelectedWeekStart()
  const plan = useMemo(() => loadWeeklyPlan(weekStart), [weekStart])
  const [activities, setActivities] = useState<DailyActivity[]>(() => loadDailyActivities(weekStart))
  const [hydratedPlan, setHydratedPlan] = useState<WeeklyPlan | null>(null)
  const [loadError, setLoadError] = useState('')
  const [planHydrationStatus, setPlanHydrationStatus] = useState<'loading' | 'ready' | 'error'>(() => hasAuthenticatedCloudWorkspace() ? 'loading' : 'ready')
  const activitiesHydratedRef = useRef(false)
  const activitiesChangedDuringHydrationRef = useRef(false)
  const activePlan = hydratedPlan ?? plan
  const weekDays = activePlan.days
  const today = new Date().toISOString().slice(0, 10)
  const defaultDay = weekDays.find((day) => day.date === today) ?? weekDays[0]
  const [selectedDayId, setSelectedDayId] = useState(defaultDay.id)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<DailyActivity | null>(null)
  const [selectedPlannedActivity, setSelectedPlannedActivity] = useState<PlannedActivity | null>(null)
  const [followUpSuggestion, setFollowUpSuggestion] = useState<FollowUpSuggestion | null>(null)
  const [newActivityId, setNewActivityId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const retrySaveRef = useRef<(() => Promise<void>) | null>(null)
  const selectedDay = weekDays.find((day) => day.id === selectedDayId) ?? weekDays[0]
  const plannedActivities = useMemo(() => getExecutablePlannedActivities(selectedDay, template, activePlan), [selectedDay, template, activePlan])
  const dayActivities = activities.filter((activity) => activity.date === selectedDay.date)

  useEffect(() => {
    activitiesHydratedRef.current = false
    activitiesChangedDuringHydrationRef.current = false
    let active = true
    loadDailyActivitiesAsync(weekStart).then((loadedActivities) => {
      if (active) {
        setActivities((currentActivities) => activitiesChangedDuringHydrationRef.current ? currentActivities : loadedActivities)
        activitiesHydratedRef.current = true
      }
    })
    return () => { active = false }
  }, [weekStart])

  useEffect(() => {
    let active = true
    setPlanHydrationStatus(hasAuthenticatedCloudWorkspace() ? 'loading' : 'ready')
    setHydratedPlan(null)
    setLoadError('')
    loadWeeklyPlanAsync(weekStart).then((loadedPlan) => {
      if (active) {
        setHydratedPlan(loadedPlan)
        setPlanHydrationStatus('ready')
        setLoadError('')
      }
    }).catch((error: unknown) => {
      if (active) {
        setPlanHydrationStatus('error')
        setLoadError(error instanceof Error ? error.message : 'Weekly Plan could not be loaded.')
      }
    })
    return () => { active = false }
  }, [weekStart])

  useEffect(() => {
    if (!newActivityId) return
    const timer = window.setTimeout(() => setNewActivityId(null), 520)
    return () => window.clearTimeout(timer)
  }, [newActivityId])

  function startPlannedActivity(plannedActivity: PlannedActivity) {
    setSelectedPlannedActivity(plannedActivity)
    setEditingActivity(null)
    setCaptureOpen(true)
  }

  function startUnplannedActivity() {
    setSelectedPlannedActivity(null)
    setEditingActivity(null)
    setCaptureOpen(true)
  }

  async function persistActivities(nextActivities: DailyActivity[], afterSave?: () => void) {
    setSaveState('saving')
    const saved = await saveDailyActivitiesAsync(weekStart, nextActivities)
    if (!saved) {
      setSaveState('error')
      retrySaveRef.current = async () => { await persistActivities(nextActivities, afterSave) }
      return false
    }
    retrySaveRef.current = null
    setActivities(nextActivities)
    setSaveState('saved')
    afterSave?.()
    return true
  }

  async function saveActivity(draft: ActivityDraft, plannedActivityId: string | null, activityId?: string) {
    if (saveState === 'saving') return
    const now = new Date().toISOString()
    const savedActivity: DailyActivity = activityId
      ? { ...(activities.find((activity) => activity.id === activityId) as DailyActivity), ...draft, plannedActivityId, updatedAt: now }
      : { id: createId(), date: selectedDay.date, weekStart, templateId: template.id, plannedActivityId, ...draft, createdAt: now, updatedAt: now }
    const nextActivities = activityId
      ? activities.map((activity) => activity.id === activityId ? savedActivity : activity)
      : [...activities, savedActivity]

    activitiesChangedDuringHydrationRef.current = true
    await persistActivities(nextActivities, () => {
      if (!activityId) setNewActivityId(savedActivity.id)
      const intelligence = deriveWeeklyIntelligence({ selectedWeek: weekStart, plan: activePlan, activities: nextActivities, followUps: loadFollowUps(weekStart), template })
      setFollowUpSuggestion(intelligence.followUpSuggestions.find((suggestion) => suggestion.sourceActivityId === savedActivity.id) ?? null)
      setCaptureOpen(false)
      setEditingActivity(null)
      setSelectedPlannedActivity(null)
    })
  }

  function selectDay(day: DayPlan) {
    setSelectedDayId(day.id)
    setCaptureOpen(false)
    setEditingActivity(null)
    setSelectedPlannedActivity(null)
  }

  function editActivity(activity: DailyActivity) {
    setEditingActivity(activity)
    setSelectedPlannedActivity(null)
    setSelectedDayId(weekDays.find((day) => day.date === activity.date)?.id ?? selectedDayId)
    setCaptureOpen(true)
  }

  async function deleteActivity(activityId: string) {
    if (saveState === 'saving') return
    activitiesChangedDuringHydrationRef.current = true
    const nextActivities = activities.filter((activity) => activity.id !== activityId)
    await persistActivities(nextActivities, () => setFollowUpSuggestion((current) => current?.sourceActivityId === activityId ? null : current))
  }

  function createFollowUpFromActivity(activity: DailyActivity, task = activity.nextAction) {
    const explicitHighPriority = [activity.issuePriority, activity.jobPriority, activity.slaPriority]
      .some((value) => value?.trim().toLowerCase() === 'high')
    queueFollowUpPrefill({
      weekKey: weekStart,
      task,
      facility: activity.account,
      ...(activity.hcpNames.length === 1 ? { hcpName: activity.hcpNames[0] } : {}),
      ...(activity.followUpDate?.trim() ? { dueDate: activity.followUpDate.trim() } : {}),
      ...(explicitHighPriority ? { priority: 'high' } : {}),
      sourceActivityId: activity.id,
      sourceContext: {
        ...(activity.workOrderJob?.trim() ? { workOrderJob: activity.workOrderJob.trim() } : {}),
        ...(activity.jobCustomer?.trim() ? { customer: activity.jobCustomer.trim() } : {}),
        ...(activity.equipmentAsset?.trim() ? { equipmentAsset: activity.equipmentAsset.trim() } : {}),
        ...(activity.issueProblem?.trim() ? { issueProblem: activity.issueProblem.trim() } : {}),
      },
    })
    window.history.pushState(null, '', '/follow-ups')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const suggestedActivity = followUpSuggestion ? activities.find((activity) => activity.id === followUpSuggestion.sourceActivityId) : null

  return (
    <main className="daily-activity-screen" id="daily-activity">
      <div className="daily-page-heading">
        <div><p className="eyebrow">Daily Activity</p><h1>Daily {terminology.activity}</h1><p className="daily-intro">Record the work you actually did in a few quick notes.</p></div>
        <div className="daily-status"><span>Current week</span><strong>{formatDate(selectedDay.date)}</strong><p>{dayActivities.length} activit{dayActivities.length === 1 ? 'y' : 'ies'} captured today</p></div>
      </div>
      {loadError && <p className="daily-intro" role="alert">{loadError}</p>}
      {(saveState === 'saving' || saveState === 'saved' || saveState === 'error') && <div className={`persistence-status is-${saveState}`} role={saveState === 'error' ? 'alert' : 'status'} aria-live="polite"><span>{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Couldn’t save changes'}</span>{saveState === 'error' && <button type="button" className="text-button" onClick={() => { const retry = retrySaveRef.current; if (retry) void retry() }}>Retry</button>}</div>}
      <div className="day-switcher" aria-label="Select activity day">{weekDays.map((day) => <button key={day.id} className={day.id === selectedDay.id ? 'is-selected' : ''} type="button" onClick={() => selectDay(day)}><span>{day.label.slice(0, 3)}</span><strong>{new Date(`${day.date}T12:00:00`).getDate()}</strong></button>)}</div>
      <div className="daily-content">
        <section className="planned-activities" aria-labelledby="planned-activities-heading" aria-busy={planHydrationStatus === 'loading'}><div className="daily-section-heading"><div><p className="eyebrow">Weekly Plan</p><h2 id="planned-activities-heading">Today's planned {template.terminology.activityPlural.toLowerCase()}</h2></div><button className="button button-secondary compact-button" type="button" onClick={startUnplannedActivity}>+ Add {template.terminology.activity}</button></div>{planHydrationStatus === 'loading' ? <p className="planned-loading" role="status">Loading planned activity...</p> : planHydrationStatus === 'error' ? <p className="planned-loading" role="alert">{loadError || 'Weekly Plan could not be loaded.'}</p> : plannedActivities.length > 0 ? <div className="planned-activity-list">{plannedActivities.map((activity) => <button className="planned-activity" type="button" key={activity.id} onClick={() => startPlannedActivity(activity)}><span>{activity.label}</span><small>{activity.activityType === 'Virtual Engagement' ? 'Virtual engagement' : 'Start capture'} <AppIcon name="arrow-right" /></small></button>)}</div> : <div className="empty-planned"><p>No {template.terminology.activityPlural.toLowerCase()} planned for {selectedDay.label}.</p><button className="text-button" type="button" onClick={startUnplannedActivity}>+ Add an unplanned {template.terminology.activity.toLowerCase()}</button></div>}</section>
        {captureOpen && <ActivityCaptureForm key={editingActivity?.id ?? selectedPlannedActivity?.id ?? 'new'} day={selectedDay} plannedActivity={selectedPlannedActivity} initialActivity={editingActivity} onSave={saveActivity} onCancel={() => { setCaptureOpen(false); setEditingActivity(null); setSelectedPlannedActivity(null) }} template={template} />}
        <section className="today-activities" aria-labelledby="today-activities-heading"><div className="daily-section-heading"><div><p className="eyebrow">Daily Activity</p><h2 id="today-activities-heading">Today's {template.terminology.activityPlural}</h2></div><span className="activity-count">{dayActivities.length}</span></div>{dayActivities.length > 0 ? <div className="activity-summary-list">{dayActivities.map((activity) => <ActivitySummary className={newActivityId === activity.id ? 'is-new' : ''} key={activity.id} activity={activity} template={template} onEdit={() => editActivity(activity)} onDelete={() => deleteActivity(activity.id)} onFollowUp={() => createFollowUpFromActivity(activity)} />)}</div> : <p className="empty-activities">Captured activities will appear here.</p>}</section>
        {followUpSuggestion && suggestedActivity && <aside className="smart-follow-up" aria-label="Possible follow-up"><div><p className="eyebrow">WeekFlow Intelligence</p><h2>Possible Follow-up</h2><strong>{followUpSuggestion.title}</strong><p>{followUpSuggestion.reason}</p><small>{suggestedActivity.account}{suggestedActivity.hcpNames.length === 1 ? ` · ${suggestedActivity.hcpNames[0]}` : ''}</small></div><div className="smart-follow-up-actions"><button className="button button-primary compact-button" type="button" onClick={() => createFollowUpFromActivity(suggestedActivity, followUpSuggestion.title)}>Create Follow-up</button><button className="text-button" type="button" onClick={() => setFollowUpSuggestion(null)}>Dismiss</button></div></aside>}
      </div>
    </main>
  )
}
