import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { consumeFollowUpPrefill, loadFollowUps, loadFollowUpsAsync, saveFollowUpsAsync } from '../storage/followUpsStorage'
import { getSelectedWeekStart, loadWeeklyPlan } from '../storage/weeklyPlanStorage'
import {
  type FollowUp,
  type FollowUpDraft,
  type FollowUpPriority,
} from '../types/followUp'
import type { WeeklyPlan } from '../types/weeklyPlan'
import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates'
import { getTemplateTerminology } from '../config/templateTerminology'
import { getFollowUpField } from '../followUp/followUpFieldAdapter'
import { AppIcon } from './TemplateIcon'
import './FollowUps.css'

const EMPTY_DRAFT: FollowUpDraft = {
  task: '',
  facility: '',
  hcpName: '',
  dueDate: '',
  priority: 'normal',
  notes: '',
}

function createId() {
  return crypto.randomUUID()
}

function formatWeekRange(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
    end.setDate(start.getDate() + 6)
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)
  return `${startLabel} - ${endLabel}`
}

function formatDueDate(date?: string) {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function getPlanSuggestions(plan: WeeklyPlan) {
  const facilities = new Set<string>()
  const hcps = new Set<string>()
  plan.days.forEach((day) => {
    day.categories.facilities.forEach((item) => facilities.add(item.text))
    day.categories.hcps.forEach((item) => hcps.add(item.text))
  })
  return { facilities: [...facilities], hcps: [...hcps] }
}

function FollowUpForm({
  initialFollowUp,
  prefill,
  plan,
  onSave,
  onCancel,
  template,
}: {
  initialFollowUp: FollowUp | null
  prefill: Partial<FollowUp> | null
  plan: WeeklyPlan
  onSave: (draft: FollowUpDraft, id?: string) => void
  onCancel: () => void
  template: WeekFlowTemplate
}) {
  const initialDraft: FollowUpDraft = initialFollowUp ? {
    task: initialFollowUp.task,
    facility: initialFollowUp.facility ?? '',
    hcpName: initialFollowUp.hcpName ?? '',
    dueDate: initialFollowUp.dueDate ?? '',
    priority: initialFollowUp.priority,
    notes: initialFollowUp.notes ?? '',
    sourceActivityId: initialFollowUp.sourceActivityId,
  } : {
    ...EMPTY_DRAFT,
    task: prefill?.task ?? '',
    facility: prefill?.facility ?? '',
    hcpName: prefill?.hcpName ?? '',
    dueDate: prefill?.dueDate ?? '',
    priority: prefill?.priority ?? 'normal',
    notes: prefill?.notes ?? '',
    sourceActivityId: prefill?.sourceActivityId,
  }
  const [draft, setDraft] = useState(initialDraft)
  const suggestions = getPlanSuggestions(plan)
  const taskField = getFollowUpField(template, 'task')
  const facilityField = getFollowUpField(template, 'facility')
  const hcpField = getFollowUpField(template, 'hcpName')
  const dueDateField = getFollowUpField(template, 'dueDate')
  const priorityField = getFollowUpField(template, 'priority')
  const notesField = getFollowUpField(template, 'notes')
  const isFieldVisible = (field: typeof taskField) => Boolean(field?.visible)

  function updateDraft<K extends keyof FollowUpDraft>(key: K, value: FollowUpDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.task.trim()) return
    onSave({ ...draft, task: draft.task.trim(), facility: draft.facility.trim(), hcpName: draft.hcpName.trim(), notes: draft.notes.trim() }, initialFollowUp?.id)
  }

  return (
    <form className="follow-up-form" onSubmit={save}>
      <div className="follow-up-form-heading">
        <div><p className="eyebrow">{initialFollowUp ? 'Edit follow-up' : 'Follow-up'}</p><h2>{initialFollowUp ? 'Update follow-up' : 'Add a follow-up'}</h2></div>
        <button className="text-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
      {isFieldVisible(taskField) && <label><span>{taskField?.label ?? `${template.terminology.followUp} / Next Action`}</span><input value={draft.task} onChange={(event) => updateDraft('task', event.target.value)} placeholder="Follow up on the next action..." required={taskField?.required ?? true} autoFocus /></label>}
      <div className="follow-up-form-grid">
        {isFieldVisible(facilityField) && <label><span>{facilityField?.label ?? template.terminology.account}</span><input list="follow-up-facilities" value={draft.facility} onChange={(event) => updateDraft('facility', event.target.value)} placeholder={`Optional ${facilityField?.label.toLowerCase() ?? template.terminology.account.toLowerCase()}`} /><datalist id="follow-up-facilities">{suggestions.facilities.map((facility) => <option key={facility} value={facility} />)}</datalist></label>}
        {isFieldVisible(hcpField) && <label><span>{hcpField?.label ?? template.terminology.contact}</span><input list="follow-up-hcps" value={draft.hcpName} onChange={(event) => updateDraft('hcpName', event.target.value)} placeholder={`Optional ${hcpField?.label.toLowerCase() ?? template.terminology.contact.toLowerCase()}`} /><datalist id="follow-up-hcps">{suggestions.hcps.map((hcp) => <option key={hcp} value={hcp} />)}</datalist></label>}
        {isFieldVisible(dueDateField) && <label><span>{dueDateField?.label ?? 'Due Date'}</span><input type="date" value={draft.dueDate} onChange={(event) => updateDraft('dueDate', event.target.value)} required={dueDateField?.required ?? false} /></label>}
        {isFieldVisible(priorityField) && <label><span>{priorityField?.label ?? 'Priority'}</span><select value={draft.priority} onChange={(event) => updateDraft('priority', event.target.value as FollowUpPriority)} required={priorityField?.required ?? false}><option value="normal">Normal</option><option value="high">High</option></select></label>}
      </div>
      {isFieldVisible(notesField) && <label><span>{notesField?.label ?? 'Notes'}</span><textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} placeholder="Optional context..." rows={2} required={notesField?.required ?? false} /></label>}
      <div className="follow-up-form-actions"><button className="button button-primary" type="submit">{initialFollowUp ? 'Save Changes' : 'Save Follow-up'} <AppIcon name="arrow-right" /></button></div>
    </form>
  )
}

function FollowUpCard({ followUp, onToggleStatus, onEdit, onDelete, className = '' }: { followUp: FollowUp; onToggleStatus: () => void; onEdit: () => void; onDelete: () => void; className?: string }) {
  return (
    <article className={`follow-up-card${followUp.status === 'completed' ? ' is-completed' : ''}${followUp.priority === 'high' ? ' is-high-priority' : ''}${className ? ` ${className}` : ''}`}>
      <div className="follow-up-card-marker" aria-hidden="true">{followUp.status === 'completed' ? <AppIcon name="check" /> : <AppIcon name="dot" />}</div>
      <div className="follow-up-card-main">
        <div className="follow-up-card-title"><h3>{followUp.task}</h3>{followUp.priority === 'high' && <span className="priority-label">High priority</span>}</div>
        <div className="follow-up-meta">{followUp.facility && <span>{followUp.facility}</span>}{followUp.hcpName && <span>{followUp.hcpName}</span>}{followUp.dueDate && <span>Due {formatDueDate(followUp.dueDate)}</span>}</div>
        {followUp.notes && <p className="follow-up-notes">{followUp.notes}</p>}
        {followUp.sourceActivityId && <span className="follow-up-source">From Daily Activity</span>}
      </div>
      <div className="follow-up-actions"><button type="button" onClick={onToggleStatus}>{followUp.status === 'open' ? 'Complete' : 'Reopen'}</button><button type="button" onClick={onEdit}>Edit</button><button type="button" onClick={onDelete}>Delete</button></div>
    </article>
  )
}

export default function FollowUpsScreen({ template = FIELD_SALES_TEMPLATE }: { template?: WeekFlowTemplate }) {
  const terminology = getTemplateTerminology(template)
  const [weekKey] = useState(getSelectedWeekStart)
  const [followUps, setFollowUps] = useState<FollowUp[]>(() => loadFollowUps(weekKey))
  const [followUpsHydrated, setFollowUpsHydrated] = useState(false)
  const [plan] = useState<WeeklyPlan>(() => loadWeeklyPlan(weekKey))
  const [initialFormState] = useState(() => {
    const pendingPrefill = consumeFollowUpPrefill(weekKey)
    return { formOpen: Boolean(pendingPrefill), prefill: pendingPrefill }
  })
  const [formOpen, setFormOpen] = useState(initialFormState.formOpen)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [prefill, setPrefill] = useState<Partial<FollowUp> | null>(initialFormState.prefill)
  const [newFollowUpId, setNewFollowUpId] = useState<string | null>(null)
  const openFollowUps = useMemo(() => followUps.filter((followUp) => followUp.status === 'open'), [followUps])
  const completedFollowUps = useMemo(() => followUps.filter((followUp) => followUp.status === 'completed'), [followUps])

  useEffect(() => {
    let active = true
    loadFollowUpsAsync(weekKey).then((loadedFollowUps) => {
      if (active) {
        setFollowUps(loadedFollowUps)
        setFollowUpsHydrated(true)
      }
    })
    return () => { active = false }
  }, [weekKey])

  useEffect(() => {
    if (!followUpsHydrated) return
    void saveFollowUpsAsync(weekKey, followUps)
  }, [followUps, followUpsHydrated, weekKey])

  useEffect(() => {
    if (!newFollowUpId) return
    const timer = window.setTimeout(() => setNewFollowUpId(null), 520)
    return () => window.clearTimeout(timer)
  }, [newFollowUpId])
  function startAdd() {
    setEditingFollowUp(null)
    setPrefill(null)
    setFormOpen(true)
  }

  function saveFollowUp(draft: FollowUpDraft, id?: string) {
    const now = new Date().toISOString()
    if (id) {
      setFollowUps((current) => current.map((followUp) => followUp.id === id ? { ...followUp, ...draft, updatedAt: now } : followUp))
    } else {
      const newFollowUp = {
        id: createId(),
        weekKey,
        task: draft.task,
        ...(draft.facility ? { facility: draft.facility } : {}),
        ...(draft.hcpName ? { hcpName: draft.hcpName } : {}),
        ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
        priority: draft.priority,
        status: 'open',
        ...(draft.notes ? { notes: draft.notes } : {}),
        ...(draft.sourceActivityId ? { sourceActivityId: draft.sourceActivityId } : {}),
        createdAt: now,
        updatedAt: now,
      } as FollowUp
      setFollowUps((current) => [...current, newFollowUp])
      setNewFollowUpId(newFollowUp.id)
    }
    setFormOpen(false)
    setEditingFollowUp(null)
    setPrefill(null)
  }

  function toggleStatus(followUp: FollowUp) {
    setFollowUps((current) => current.map((item) => item.id === followUp.id ? { ...item, status: item.status === 'open' ? 'completed' : 'open', updatedAt: new Date().toISOString() } : item))
  }

  function editFollowUp(followUp: FollowUp) {
    setEditingFollowUp(followUp)
    setPrefill(null)
    setFormOpen(true)
  }

  function cancelForm() {
    setFormOpen(false)
    setEditingFollowUp(null)
    setPrefill(null)
  }

  return (
    <main className="follow-ups-screen" id="follow-ups">
      <div className="follow-ups-page-heading"><div><p className="eyebrow">Follow-ups</p><h1>{terminology.followUps}</h1><p className="follow-ups-intro">Track unresolved next actions so nothing important gets forgotten.</p></div><div className="follow-ups-week"><span>Current week</span><strong>{formatWeekRange(weekKey)}</strong></div></div>
      <div className="follow-ups-content">
        {!formOpen && <div className="follow-ups-toolbar"><p>{openFollowUps.length} open follow-up{openFollowUps.length === 1 ? '' : 's'} this week</p><button className="button button-primary compact-button" type="button" onClick={startAdd}>+ Add Follow-up</button></div>}
        {formOpen && <FollowUpForm initialFollowUp={editingFollowUp} prefill={prefill} plan={plan} onSave={saveFollowUp} onCancel={cancelForm} template={template} />}
        {!formOpen && followUps.length === 0 && <section className="follow-ups-empty"><span className="empty-mark" aria-hidden="true">+</span><h2>No {terminology.followUps.toLowerCase()} yet</h2><p>Capture unresolved next actions from your {terminology.activityPlural.toLowerCase()} here so nothing gets forgotten.</p><button className="button button-secondary" type="button" onClick={startAdd}>+ Add {terminology.followUp}</button></section>}
        {!formOpen && followUps.length > 0 && <>
          <section className="follow-up-group" aria-labelledby="open-follow-ups-heading"><div className="follow-up-group-heading"><h2 id="open-follow-ups-heading">Open</h2><span>{openFollowUps.length}</span></div>{openFollowUps.length > 0 ? <div className="follow-up-list">{openFollowUps.map((followUp) => <FollowUpCard className={newFollowUpId === followUp.id ? 'is-new' : ''} key={followUp.id} followUp={followUp} onToggleStatus={() => toggleStatus(followUp)} onEdit={() => editFollowUp(followUp)} onDelete={() => setFollowUps((current) => current.filter((item) => item.id !== followUp.id))} />)}</div> : <p className="follow-up-group-empty">All follow-ups are complete.</p>}</section>
          <section className="follow-up-group completed-group" aria-labelledby="completed-follow-ups-heading"><div className="follow-up-group-heading"><h2 id="completed-follow-ups-heading">Completed</h2><span>{completedFollowUps.length}</span></div>{completedFollowUps.length > 0 ? <div className="follow-up-list">{completedFollowUps.map((followUp) => <FollowUpCard className={newFollowUpId === followUp.id ? 'is-new' : ''} key={followUp.id} followUp={followUp} onToggleStatus={() => toggleStatus(followUp)} onEdit={() => editFollowUp(followUp)} onDelete={() => setFollowUps((current) => current.filter((item) => item.id !== followUp.id))} />)}</div> : <p className="follow-up-group-empty">Completed follow-ups will stay here for reference.</p>}</section>
        </>}
      </div>
    </main>
  )
}
