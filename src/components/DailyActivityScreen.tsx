import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { loadDailyActivities, saveDailyActivities } from '../storage/dailyActivityStorage'
import { queueFollowUpPrefill } from '../storage/followUpsStorage'
import { loadFollowUps } from '../storage/followUpsStorage'
import { getSelectedWeekStart, loadWeeklyPlan } from '../storage/weeklyPlanStorage'
import { deriveWeeklyIntelligence } from '../intelligence/intelligenceEngine'
import type { FollowUpSuggestion } from '../intelligence/intelligenceTypes'
import {
  ACTIVITY_TYPES,
  PORTFOLIO_PRODUCTS,
  STRUCTURED_OUTCOME_TYPES,
  type ActivityType,
  type DailyActivity,
  type PortfolioProduct,
  type StructuredOutcome,
  type StructuredOutcomeType,
} from '../types/dailyActivity'
import type { DayPlan, PlanItem, WeeklyPlan } from '../types/weeklyPlan'
import { FIELD_SALES_TEMPLATE } from '../config/templates'
import { getExecutablePlannedActivities, type PlannedActivity } from '../planning/plannedActivityAdapter'
import './DailyActivity.css'

interface ActivityDraft {
  account: string
  activityType: ActivityType
  hcpNames: string[]
  outcome: string
  intelligence: string
  nextAction: string
  structuredOutcomes: StructuredOutcome[]
}

const EMPTY_DRAFT: ActivityDraft = {
  account: '',
  activityType: 'Physical Visit',
  hcpNames: [],
  outcome: '',
  intelligence: '',
  nextAction: '',
  structuredOutcomes: [],
}

function getInitialDraft(initialActivity: DailyActivity | null, plannedActivity: PlannedActivity | null): ActivityDraft {
  if (initialActivity) {
    return {
      account: initialActivity.account,
      activityType: initialActivity.activityType,
      hcpNames: [...initialActivity.hcpNames],
      outcome: initialActivity.outcome,
      intelligence: initialActivity.intelligence,
      nextAction: initialActivity.nextAction,
      structuredOutcomes: initialActivity.structuredOutcomes.map((outcome) => ({ ...outcome })),
    }
  }
  return {
    ...EMPTY_DRAFT,
    hcpNames: [],
    structuredOutcomes: [],
    account: plannedActivity?.account ?? '',
    activityType: plannedActivity?.activityType ?? 'Physical Visit',
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
}: {
  day: DayPlan
  plannedActivity: PlannedActivity | null
  initialActivity: DailyActivity | null
  onSave: (draft: ActivityDraft, plannedActivityId: string | null, activityId?: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ActivityDraft>(() => getInitialDraft(initialActivity, plannedActivity))
  const [hcpInput, setHcpInput] = useState('')
  const [outcomeType, setOutcomeType] = useState<StructuredOutcomeType | ''>('')
  const availableHcps = getItemTexts(day.categories.hcps)
  const accountOptions = getItemTexts(day.categories.facilities)
  const plannedFocus = plannedActivity?.focus

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

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.account.trim()) return
    onSave({ ...draft, account: draft.account.trim() }, plannedActivity?.id ?? initialActivity?.plannedActivityId ?? null, initialActivity?.id)
  }

  return (
    <form className="activity-capture-form" onSubmit={save}>
      <div className="capture-form-heading">
        <div>
          <p className="eyebrow">{initialActivity ? 'Edit activity' : 'Quick capture'}</p>
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
      <div className="capture-form-grid">
        <label>
          <span>{FIELD_SALES_TEMPLATE.terminology.account}</span>
          <input autoFocus={!plannedActivity && !initialActivity} list="daily-account-options" value={draft.account} onChange={(event) => updateDraft('account', event.target.value)} placeholder="Select or add an account" required />
          <datalist id="daily-account-options">{accountOptions.map((account) => <option key={account} value={account} />)}</datalist>
        </label>
        <label>
          <span>{FIELD_SALES_TEMPLATE.terminology.activity} Type</span>
          <select className="activity-type-select" aria-label="Activity type" value={draft.activityType} onChange={(event) => updateDraft('activityType', event.target.value as ActivityType)}>
            {ACTIVITY_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="hcp-fieldset">
        <legend>Doctors / HCPs Engaged</legend>
        <div className="add-hcp-form">
          <input autoFocus={Boolean(plannedActivity || initialActivity)} enterKeyHint="done" list="daily-hcp-options" value={hcpInput} onChange={(event) => setHcpInput(event.target.value)} onKeyDown={handleHcpKeyDown} placeholder="Enter HCP name..." aria-label="Enter HCP name" />
          <datalist id="daily-hcp-options">{availableHcps.map((hcp) => <option key={hcp} value={hcp} />)}</datalist>
          <button type="button" onClick={addHcp}>Add</button>
        </div>
        {draft.hcpNames.length > 0 && (
          <div className="hcp-chips" aria-label="Added doctors and HCPs">
            {draft.hcpNames.map((hcp) => (
              <span className="hcp-chip" key={hcp}>
                {hcp}
                <button type="button" aria-label={`Remove ${hcp}`} onClick={() => updateDraft('hcpNames', draft.hcpNames.filter((name) => name !== hcp))}>×</button>
              </span>
            ))}
          </div>
        )}
      </fieldset>
      <div className="capture-text-grid">
        <label><span>{FIELD_SALES_TEMPLATE.terminology.outcome}</span><textarea value={draft.outcome} onChange={(event) => updateDraft('outcome', event.target.value)} placeholder="What happened during the visit?" rows={2} /></label>
        <label><span>Key Intelligence <em>(optional)</em></span><textarea value={draft.intelligence} onChange={(event) => updateDraft('intelligence', event.target.value)} placeholder="What did you learn?" rows={2} /></label>
        <label><span>Next Action <em>(optional)</em></span><textarea value={draft.nextAction} onChange={(event) => updateDraft('nextAction', event.target.value)} placeholder="What needs to happen next?" rows={2} /></label>
      </div>
      <section className="structured-outcomes" aria-labelledby="structured-outcomes-heading">
        <div className="structured-heading">
          <div><h3 id="structured-outcomes-heading">Important outcomes</h3><p>Optional structured details for the future report.</p></div>
          <div className="outcome-add-control">
            <select aria-label="Select an outcome type" value={outcomeType} onChange={(event) => setOutcomeType(event.target.value as StructuredOutcomeType)}>
              <option value="">Add outcome</option>
              {STRUCTURED_OUTCOME_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
            <button type="button" onClick={addStructuredOutcome}>+</button>
          </div>
        </div>
        {draft.structuredOutcomes.map((outcome) => (
          <div className="structured-outcome" key={outcome.id}>
            <div className="structured-outcome-topline"><strong>{outcome.type}</strong><button type="button" onClick={() => removeOutcome(outcome.id)} aria-label={`Remove ${outcome.type}`}>Remove</button></div>
            {(outcome.type === 'Prescription Generated' || outcome.type === 'Stock Issue') && <div className="outcome-detail-grid">
              <select aria-label={`${outcome.type} product`} value={outcome.product ?? ''} onChange={(event) => updateOutcome(outcome.id, { product: event.target.value as PortfolioProduct })}>
                <option value="">Select product</option>{PORTFOLIO_PRODUCTS.map((product) => <option key={product}>{product}</option>)}
              </select>
              {outcome.type === 'Prescription Generated' ? <input aria-label="Quantity" value={outcome.quantity ?? ''} onChange={(event) => updateOutcome(outcome.id, { quantity: event.target.value })} placeholder="Quantity" /> : <select aria-label="Stock status" value={outcome.stockStatus ?? ''} onChange={(event) => updateOutcome(outcome.id, { stockStatus: event.target.value as StructuredOutcome['stockStatus'] })}><option value="">Stock status</option><option>Stock available</option><option>Stock low</option><option>Stock depleted</option><option>Replenishment required</option></select>}
            </div>}
            <input aria-label={`${outcome.type} details`} value={outcome.details} onChange={(event) => updateOutcome(outcome.id, { details: event.target.value })} placeholder="Add a short detail..." />
          </div>
        ))}
      </section>
      <div className="capture-form-actions"><button className="button button-primary" type="submit">{initialActivity ? 'Save Changes' : 'Save Activity'} <span aria-hidden="true">→</span></button></div>
    </form>
  )
}

function ActivitySummary({ activity, onEdit, onDelete, onFollowUp }: { activity: DailyActivity; onEdit: () => void; onDelete: () => void; onFollowUp: () => void }) {
  return (
    <article className="activity-summary">
      <div className="activity-summary-check" aria-hidden="true">✓</div>
      <div className="activity-summary-main"><div className="activity-summary-title"><h3>{activity.account}</h3><span>{activity.activityType}</span></div><p>{activity.hcpNames.length ? `${activity.hcpNames.length} HCP${activity.hcpNames.length === 1 ? '' : 's'} engaged` : 'No HCPs recorded'}</p>{activity.outcome && <p className="summary-outcome">{activity.outcome}</p>}{activity.nextAction && <div className="next-action-summary"><span>Next action</span><p>{activity.nextAction}</p><button type="button" onClick={onFollowUp}>+ Add Follow-up</button></div>}{activity.structuredOutcomes.length > 0 && <div className="summary-tags">{activity.structuredOutcomes.map((outcome) => <span key={outcome.id}>{outcome.type}</span>)}</div>}</div>
      <div className="summary-actions"><button type="button" onClick={onEdit}>Edit</button><button type="button" onClick={onDelete}>Delete</button></div>
    </article>
  )
}

export default function DailyActivityScreen() {
  const [weekStart] = useState(getSelectedWeekStart)
  const [plan] = useState<WeeklyPlan>(() => loadWeeklyPlan(weekStart))
  const [activities, setActivities] = useState<DailyActivity[]>(() => loadDailyActivities(weekStart))
  const weekDays = plan.days
  const today = new Date().toISOString().slice(0, 10)
  const defaultDay = weekDays.find((day) => day.date === today) ?? weekDays[0]
  const [selectedDayId, setSelectedDayId] = useState(defaultDay.id)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<DailyActivity | null>(null)
  const [selectedPlannedActivity, setSelectedPlannedActivity] = useState<PlannedActivity | null>(null)
  const [followUpSuggestion, setFollowUpSuggestion] = useState<FollowUpSuggestion | null>(null)
  const selectedDay = weekDays.find((day) => day.id === selectedDayId) ?? weekDays[0]
  const plannedActivities = useMemo(() => getExecutablePlannedActivities(selectedDay), [selectedDay])
  const dayActivities = activities.filter((activity) => activity.date === selectedDay.date)

  useEffect(() => saveDailyActivities(weekStart, activities), [activities, weekStart])

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

  function saveActivity(draft: ActivityDraft, plannedActivityId: string | null, activityId?: string) {
    const now = new Date().toISOString()
    const savedActivity: DailyActivity = activityId
      ? { ...(activities.find((activity) => activity.id === activityId) as DailyActivity), ...draft, plannedActivityId, updatedAt: now }
      : { id: createId(), date: selectedDay.date, weekStart, plannedActivityId, ...draft, createdAt: now, updatedAt: now }
    const nextActivities = activityId
      ? activities.map((activity) => activity.id === activityId ? savedActivity : activity)
      : [...activities, savedActivity]
    if (activityId) {
      setActivities(nextActivities)
    } else {
      setActivities(nextActivities)
    }
    const intelligence = deriveWeeklyIntelligence({ selectedWeek: weekStart, plan, activities: nextActivities, followUps: loadFollowUps(weekStart) })
    setFollowUpSuggestion(intelligence.followUpSuggestions.find((suggestion) => suggestion.sourceActivityId === savedActivity.id) ?? null)
    setCaptureOpen(false)
    setEditingActivity(null)
    setSelectedPlannedActivity(null)
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

  function deleteActivity(activityId: string) {
    setActivities((current) => current.filter((activity) => activity.id !== activityId))
    setFollowUpSuggestion((current) => current?.sourceActivityId === activityId ? null : current)
  }

  function createFollowUpFromActivity(activity: DailyActivity, task = activity.nextAction) {
    queueFollowUpPrefill({
      weekKey: weekStart,
      task,
      facility: activity.account,
      ...(activity.hcpNames.length === 1 ? { hcpName: activity.hcpNames[0] } : {}),
      sourceActivityId: activity.id,
    })
    window.history.pushState(null, '', '/follow-ups')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const suggestedActivity = followUpSuggestion ? activities.find((activity) => activity.id === followUpSuggestion.sourceActivityId) : null

  return (
    <main className="daily-activity-screen" id="daily-activity">
      <div className="daily-page-heading">
        <div><p className="eyebrow">Capture what happened</p><h1>Daily {FIELD_SALES_TEMPLATE.terminology.activity}</h1><p className="daily-intro">Record the work you actually did in a few quick notes.</p></div>
        <div className="daily-status"><span>Current week</span><strong>{formatDate(selectedDay.date)}</strong><p>{dayActivities.length} activit{dayActivities.length === 1 ? 'y' : 'ies'} captured today</p></div>
      </div>
      <div className="day-switcher" aria-label="Select activity day">{weekDays.map((day) => <button key={day.id} className={day.id === selectedDay.id ? 'is-selected' : ''} type="button" onClick={() => selectDay(day)}><span>{day.label.slice(0, 3)}</span><strong>{new Date(`${day.date}T12:00:00`).getDate()}</strong></button>)}</div>
      <div className="daily-content">
        <section className="planned-activities" aria-labelledby="planned-activities-heading"><div className="daily-section-heading"><div><p className="eyebrow">From your Weekly Plan</p><h2 id="planned-activities-heading">Today's planned {FIELD_SALES_TEMPLATE.terminology.activityPlural.toLowerCase()}</h2></div><button className="button button-secondary compact-button" type="button" onClick={startUnplannedActivity}>+ Add {FIELD_SALES_TEMPLATE.terminology.activity}</button></div>{plannedActivities.length > 0 ? <div className="planned-activity-list">{plannedActivities.map((activity) => <button className="planned-activity" type="button" key={activity.id} onClick={() => startPlannedActivity(activity)}><span>{activity.label}</span><small>{activity.activityType === 'Virtual Engagement' ? 'Virtual engagement' : 'Start capture'} <b>→</b></small></button>)}</div> : <div className="empty-planned"><p>No {FIELD_SALES_TEMPLATE.terminology.activityPlural.toLowerCase()} planned for {selectedDay.label}.</p><button className="text-button" type="button" onClick={startUnplannedActivity}>+ Add an unplanned {FIELD_SALES_TEMPLATE.terminology.activity.toLowerCase()}</button></div>}</section>
        {captureOpen && <ActivityCaptureForm key={editingActivity?.id ?? selectedPlannedActivity?.id ?? 'new'} day={selectedDay} plannedActivity={selectedPlannedActivity} initialActivity={editingActivity} onSave={saveActivity} onCancel={() => { setCaptureOpen(false); setEditingActivity(null); setSelectedPlannedActivity(null) }} />}
        <section className="today-activities" aria-labelledby="today-activities-heading"><div className="daily-section-heading"><div><p className="eyebrow">Saved to this week</p><h2 id="today-activities-heading">Today's {FIELD_SALES_TEMPLATE.terminology.activityPlural}</h2></div><span className="activity-count">{dayActivities.length}</span></div>{dayActivities.length > 0 ? <div className="activity-summary-list">{dayActivities.map((activity) => <ActivitySummary key={activity.id} activity={activity} onEdit={() => editActivity(activity)} onDelete={() => deleteActivity(activity.id)} onFollowUp={() => createFollowUpFromActivity(activity)} />)}</div> : <p className="empty-activities">Captured activities will appear here.</p>}</section>
        {followUpSuggestion && suggestedActivity && <aside className="smart-follow-up" aria-label="Possible follow-up"><div><p className="eyebrow">WeekFlow Intelligence</p><h2>Possible Follow-up</h2><strong>{followUpSuggestion.title}</strong><p>{followUpSuggestion.reason}</p><small>{suggestedActivity.account}{suggestedActivity.hcpNames.length === 1 ? ` · ${suggestedActivity.hcpNames[0]}` : ''}</small></div><div className="smart-follow-up-actions"><button className="button button-primary compact-button" type="button" onClick={() => createFollowUpFromActivity(suggestedActivity, followUpSuggestion.title)}>Create Follow-up</button><button className="text-button" type="button" onClick={() => setFollowUpSuggestion(null)}>Dismiss</button></div></aside>}
      </div>
    </main>
  )
}
