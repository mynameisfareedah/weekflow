import { useEffect, useMemo, useState } from 'react'
import logoImage from './assets/weekflow-logo.png'
import DailyActivityScreen from './components/DailyActivityScreen'
import FollowUpsScreen from './components/FollowUpsScreen'
import GenerateReportScreen from './components/GenerateReportScreen'
import OverviewScreen from './components/OverviewScreen'
import { loadDailyActivities } from './storage/dailyActivityStorage'
import { loadFollowUps } from './storage/followUpsStorage'
import { deriveWeeklyIntelligence } from './intelligence/intelligenceEngine'
import {
  getCurrentWeekStart,
  getSelectedWeekStart,
  getStoredWeekStarts,
  getWeekStartFromInput,
  loadWeeklyPlan,
  saveWeeklyPlan,
  setSelectedWeekStart,
  toWeekInput,
} from './storage/weeklyPlanStorage'
import {
  PLAN_CATEGORIES,
  type AccountObjective,
  type CommercialPriority,
  type DayPlan,
  type PlanCategory,
  type PlanItem,
  type SuccessMeasure,
  type VirtualEngagementPlanItem,
  type WeeklyPlan,
} from './types/weeklyPlan'
import { exportReportWord, getFixedReportMetadata, getFixedReportWeekLabel } from './utils/reportDocx'
import './App.css'

const navigationItems = [
  { label: 'Overview', path: '/', icon: '○' },
  { label: 'Weekly Plan', path: '/weekly-plan', icon: '□' },
  { label: 'Daily Activity', path: '/daily-activity', icon: '✦' },
  { label: 'Follow-ups', path: '/follow-ups', icon: '↗' },
  { label: 'Report', path: '/report', icon: '▤' },
  { label: 'Report History', path: '/report-history', icon: '◷' },
]

const categoryLabels: Record<PlanCategory, string> = {
  facilities: 'Facilities / Accounts',
  hcps: 'HCPs / Stakeholders',
  primaryObjectives: 'Primary Objectives',
  virtualEngagements: 'Virtual Engagements',
  accountObjectives: 'Account-Specific Objectives',
  commercialPriorities: 'Commercial Priorities',
  successMeasures: 'Success Measures',
}

function getScreenFromPath(): string {
  const pathname = window.location.pathname
  if (pathname === '/weekly-plan') return 'weekly-plan'
  if (pathname === '/daily-activity') return 'daily-activity'
  if (pathname === '/follow-ups') return 'follow-ups'
  if (pathname === '/report') return 'report'
  if (pathname === '/report-history') return 'report-history'
  return 'overview'
}

function getInitialScreen(): string {
  // Handle old hash-based URLs for initial state
  const hash = window.location.hash
  if (hash === '#weekly-plan') return 'weekly-plan'
  if (hash === '#daily-activity') return 'daily-activity'
  if (hash === '#follow-ups') return 'follow-ups'
  if (hash === '#report') return 'report'
  if (hash === '#report-history') return 'report-history'
  if (hash === '#overview') return 'overview'
  // Fall back to pathname-based routing
  return getScreenFromPath()
}

function navigateTo(path: string): void {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function handleOldHashRoutes(): void {
  if (!window.location.hash) return
  const hash = window.location.hash
  const hashMap: Record<string, string> = {
    '#weekly-plan': '/weekly-plan',
    '#daily-activity': '/daily-activity',
    '#follow-ups': '/follow-ups',
    '#report': '/report',
    '#report-history': '/report-history',
    '#overview': '/',
  }
  const newPath = hashMap[hash] || null
  if (newPath) {
    // Use replaceState to seamlessly redirect without adding to history
    window.history.replaceState(null, '', newPath)
    // Trigger a popstate event to update the screen
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

function formatHeaderWeek(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)
  return `${startLabel} - ${endLabel}`
}

function Header({ selectedWeek }: { selectedWeek: string }) {
  const reportOwner = getFixedReportMetadata()
  const isHistorical = selectedWeek !== getCurrentWeekStart()

  return (
    <header className="app-header">
      <a className="brand" href="/" aria-label="WeekFlow overview">
        <img className="brand-logo" src={logoImage} alt="WeekFlow" />
      </a>
      <div className="header-context">
        <span className="context-label">Current workspace</span>
        <span className="context-value">Week of {formatHeaderWeek(selectedWeek)}</span>
        {isHistorical && <span className="context-history">Historical report</span>}
        <span className="context-owner">{reportOwner.preparedBy}</span>
      </div>
      <button className="profile-button" type="button" aria-label="Open profile menu">
        <span aria-hidden="true">WY</span>
      </button>
    </header>
  )
}

function AppNavigation({ activeScreen }: { activeScreen: string }) {
  return (
    <nav className="app-navigation" aria-label="Main navigation">
      <span className="navigation-label">Workspace</span>
      <div className="navigation-links">
        {navigationItems.map((item) => {
          const isItemActive = item.path === '/' ? activeScreen === 'overview' : activeScreen === item.path.slice(1)
          return (
            <a
              className={`navigation-link${isItemActive ? ' is-active' : ''}`}
              href={item.path}
              key={item.path}
              aria-current={isItemActive ? 'page' : undefined}
            >
              <span className="navigation-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function formatWeekRange(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)
  return `${startLabel} - ${endLabel}`
}

function shiftWeek(weekStart: string, amount: number) {
  const date = new Date(`${weekStart}T12:00:00`)
  date.setDate(date.getDate() + amount * 7)
  return date.toISOString().slice(0, 10)
}

function WeekNavigation({ weekStart, onChange }: { weekStart: string; onChange: (weekStart: string) => void }) {
  const currentWeek = getCurrentWeekStart()
  return (
    <div className="week-navigation" aria-label="Reporting week navigation">
      <button type="button" onClick={() => onChange(shiftWeek(weekStart, -1))}>← Previous Week</button>
      <button type="button" onClick={() => onChange(currentWeek)} disabled={weekStart === currentWeek}>Current Week</button>
      <button type="button" onClick={() => onChange(shiftWeek(weekStart, 1))}>Next Week →</button>
    </div>
  )
}

function PlanCategory({
  dayId,
  category,
  items,
  onAdd,
  onEdit,
  onDelete,
}: {
  dayId: string
  category: PlanCategory
  items: PlanItem[]
  onAdd: (text: string) => void
  onEdit: (itemId: string, text: string) => void
  onDelete: (itemId: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.trim()) return
    onAdd(draft.trim())
    setDraft('')
  }

  function startEditing(item: PlanItem) {
    setEditingId(item.id)
    setEditingText(item.text)
  }

  function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingId || !editingText.trim()) return
    onEdit(editingId, editingText.trim())
    setEditingId(null)
    setEditingText('')
  }

  return (
    <section className="plan-category" aria-labelledby={`${dayId}-${category}-label`}>
      <div className="category-heading">
        <h3 id={`${dayId}-${category}-label`}>{categoryLabels[category]}</h3>
        <button className="add-item-button" type="button" onClick={() => document.getElementById(`${dayId}-${category}-input`)?.focus()}>
          + Add
        </button>
      </div>
      {items.length > 0 && (
        <ul className="plan-items">
          {items.map((item) => (
            <li className="plan-item" key={item.id}>
              {editingId === item.id ? (
                <form className="item-edit-form" onSubmit={saveEdit}>
                  <input aria-label={`Edit ${categoryLabels[category]}`} autoFocus value={editingText} onChange={(event) => setEditingText(event.target.value)} />
                  <button type="submit" aria-label="Save item">Save</button>
                  <button type="button" aria-label="Cancel editing" onClick={() => setEditingId(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <span>{item.text}</span>
                  <span className="item-actions">
                    <button type="button" aria-label={`Edit ${item.text}`} onClick={() => startEditing(item)}>Edit</button>
                    <button type="button" aria-label={`Delete ${item.text}`} onClick={() => onDelete(item.id)}>Delete</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="add-item-form" onSubmit={addItem}>
        <input id={`${dayId}-${category}-input`} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add an item..." aria-label={`Add to ${categoryLabels[category]}`} />
        <button type="submit" aria-label={`Add to ${categoryLabels[category]}`}>+</button>
      </form>
    </section>
  )
}

function DayPlanSection({ day, onChange }: { day: DayPlan; onChange: (day: DayPlan) => void }) {
  function updateCategory(category: PlanCategory, items: PlanItem[]) {
    onChange({ ...day, categories: { ...day.categories, [category]: items } })
  }

  return (
    <section className="day-plan" aria-labelledby={`${day.id}-heading`}>
      <div className="day-heading">
        <span className="day-index">{String(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].indexOf(day.id) + 1).padStart(2, '0')}</span>
        <div>
          <h2 id={`${day.id}-heading`}>{day.label}</h2>
          <p>{formatDateLabel(day.date)}</p>
        </div>
      </div>
      <div className="day-categories">
        {PLAN_CATEGORIES.map((category) => (
          <PlanCategory
            dayId={day.id}
            category={category}
            items={day.categories[category]}
            key={category}
            onAdd={(text) => updateCategory(category, [...day.categories[category], { id: crypto.randomUUID(), text }])}
            onEdit={(itemId, text) => updateCategory(category, day.categories[category].map((item) => item.id === itemId ? { ...item, text } : item))}
            onDelete={(itemId) => updateCategory(category, day.categories[category].filter((item) => item.id !== itemId))}
          />
        ))}
      </div>
    </section>
  )
}

function WeeklyPlanTextListSection<T extends { id: string; text: string }>({
  title,
  summary,
  items,
  emptyText,
  placeholder,
  onChange,
}: {
  title: string
  summary: string
  items: T[]
  emptyText: string
  placeholder: string
  onChange: (items: T[]) => void
}) {
  const [draft, setDraft] = useState('')

  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = draft.trim()
    if (!value) return
    onChange([...items, { id: crypto.randomUUID(), text: value } as T])
    setDraft('')
  }

  function updateItem(itemId: string, text: string) {
    onChange(items.map((item) => item.id === itemId ? { ...item, text } : item))
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section" aria-labelledby={`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-heading`}>
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly focus</p>
          <h3 id={`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-heading`}>{title}</h3>
        </div>
        <span>{summary}</span>
      </div>
      {items.length > 0 ? (
        <ul className="weekly-plan-summary-list">
          {items.map((item) => (
            <li className="weekly-plan-summary-item" key={item.id}>
              <input
                aria-label={title}
                value={item.text}
                onChange={(event) => updateItem(item.id, event.target.value)}
              />
              <button type="button" aria-label={`Delete ${title}`} onClick={() => deleteItem(item.id)}>Remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="weekly-plan-summary-empty">{emptyText}</p>
      )}
      <form className="weekly-plan-summary-form" onSubmit={addItem}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
        <button type="submit" aria-label={`Add ${title}`}>+ Add</button>
      </form>
    </section>
  )
}

function WeeklyPlanVirtualEngagementSection({
  items,
  onChange,
}: {
  items: VirtualEngagementPlanItem[]
  onChange: (items: VirtualEngagementPlanItem[]) => void
}) {
  const [contactDrafts, setContactDrafts] = useState<Record<string, string>>({})

  function updateItem(itemId: string, changes: Partial<VirtualEngagementPlanItem>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...changes } : item))
  }

  function addItem() {
    onChange([...items, {
      id: crypto.randomUUID(),
      coverage: '',
      priorityContacts: [],
      objective: '',
    }])
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  function addPriorityContact(itemId: string) {
    const value = (contactDrafts[itemId] ?? '').trim()
    if (!value) return
    const existing = items.find((item) => item.id === itemId)
    if (!existing) return
    updateItem(itemId, {
      priorityContacts: [...existing.priorityContacts, { id: crypto.randomUUID(), text: value }],
    })
    setContactDrafts((current) => ({ ...current, [itemId]: '' }))
  }

  function updatePriorityContact(itemId: string, contactId: string, text: string) {
    const existing = items.find((item) => item.id === itemId)
    if (!existing) return
    updateItem(itemId, {
      priorityContacts: existing.priorityContacts.map((contact) => contact.id === contactId ? { ...contact, text } : contact),
    })
  }

  function deletePriorityContact(itemId: string, contactId: string) {
    const existing = items.find((item) => item.id === itemId)
    if (!existing) return
    updateItem(itemId, {
      priorityContacts: existing.priorityContacts.filter((contact) => contact.id !== contactId),
    })
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly work plan</p>
          <h3>Virtual Engagement Plan</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Map where you need to engage virtually, the key stakeholders and the purpose of the outreach.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className="weekly-plan-card" key={item.id}>
              <div className="weekly-plan-card-header">
                <input
                  aria-label="Coverage"
                  value={item.coverage}
                  placeholder="Coverage"
                  onChange={(event) => updateItem(item.id, { coverage: event.target.value })}
                />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-list-editor">
                {item.priorityContacts.length > 0 ? (
                  <ul className="weekly-plan-inline-list">
                    {item.priorityContacts.map((contact) => (
                      <li key={contact.id}>
                        <input
                          aria-label="Priority contact"
                          value={contact.text}
                          onChange={(event) => updatePriorityContact(item.id, contact.id, event.target.value)}
                        />
                        <button type="button" onClick={() => deletePriorityContact(item.id, contact.id)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="weekly-plan-list-empty">No priority contacts added yet.</p>}
                <div className="weekly-plan-inline-input-row">
                  <input
                    aria-label="Add priority contact"
                    value={contactDrafts[item.id] ?? ''}
                    placeholder="Add priority contact"
                    onChange={(event) => setContactDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                  />
                  <button type="button" onClick={() => addPriorityContact(item.id)}>Add</button>
                </div>
              </div>
              <label className="weekly-plan-field-label">
                Objective
                <textarea
                  value={item.objective}
                  placeholder="Describe the objective of this engagement"
                  onChange={(event) => updateItem(item.id, { objective: event.target.value })}
                />
              </label>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No virtual engagements planned yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add engagement</button>
      </div>
    </section>
  )
}

function WeeklyPlanAccountObjectiveSection({
  items,
  onChange,
}: {
  items: AccountObjective[]
  onChange: (items: AccountObjective[]) => void
}) {
  const [objectiveDrafts, setObjectiveDrafts] = useState<Record<string, string>>({})

  function addAccount() {
    onChange([...items, { id: crypto.randomUUID(), account: '', objectives: [] }])
  }

  function updateAccount(itemId: string, account: string) {
    onChange(items.map((item) => item.id === itemId ? { ...item, account } : item))
  }

  function updateObjective(itemId: string, objectiveId: string, text: string) {
    onChange(items.map((item) => item.id === itemId ? {
      ...item,
      objectives: item.objectives.map((objective) => objective.id === objectiveId ? { ...objective, text } : objective),
    } : item))
  }

  function addObjective(itemId: string) {
    const value = (objectiveDrafts[itemId] ?? '').trim()
    if (!value) return
    const account = items.find((item) => item.id === itemId)
    if (!account) return
    onChange(items.map((item) => item.id === itemId ? { ...item, objectives: [...item.objectives, { id: crypto.randomUUID(), text: value }] } : item))
    setObjectiveDrafts((current) => ({ ...current, [itemId]: '' }))
  }

  function deleteObjective(itemId: string, objectiveId: string) {
    const account = items.find((item) => item.id === itemId)
    if (!account) return
    onChange(items.map((item) => item.id === itemId ? { ...item, objectives: item.objectives.filter((objective) => objective.id !== objectiveId) } : item))
  }

  function deleteAccount(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly work plan</p>
          <h3>Key Account-Specific Objectives</h3>
        </div>
        <span>{items.length} account{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Capture the specific account goals and the actions required for each key account.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className="weekly-plan-card" key={item.id}>
              <div className="weekly-plan-card-header">
                <input
                  aria-label="Account name"
                  value={item.account}
                  placeholder="Account"
                  onChange={(event) => updateAccount(item.id, event.target.value)}
                />
                <button type="button" className="destructive-button" onClick={() => deleteAccount(item.id)}>Delete</button>
              </div>
              {item.objectives.length > 0 ? (
                <ul className="weekly-plan-inline-list">
                  {item.objectives.map((objective) => (
                    <li key={objective.id}>
                      <input
                        aria-label="Objective"
                        value={objective.text}
                        onChange={(event) => updateObjective(item.id, objective.id, event.target.value)}
                      />
                      <button type="button" onClick={() => deleteObjective(item.id, objective.id)}>Remove</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="weekly-plan-list-empty">No account objectives added yet.</p>}
              <div className="weekly-plan-inline-input-row">
                <input
                  aria-label="Add objective"
                  value={objectiveDrafts[item.id] ?? ''}
                  placeholder="Add objective"
                  onChange={(event) => setObjectiveDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                />
                <button type="button" onClick={() => addObjective(item.id)}>Add</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No account-specific objectives captured yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addAccount}>+ Add account</button>
      </div>
    </section>
  )
}

function WeeklyPlanCommercialPrioritySection({
  items,
  onChange,
}: {
  items: CommercialPriority[]
  onChange: (items: CommercialPriority[]) => void
}) {
  function updateItem(itemId: string, updates: Partial<CommercialPriority>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  function addItem() {
    onChange([...items, { id: crypto.randomUUID(), text: '', opportunity: '', account: '', product: '' }])
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly work plan</p>
          <h3>Commercial Priorities</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Capture the priority commercial actions, with optional account and product context.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className="weekly-plan-card" key={item.id}>
              <div className="weekly-plan-card-header">
                <input
                  aria-label="Commercial priority opportunity"
                  value={item.opportunity ?? ''}
                  placeholder="Opportunity"
                  onChange={(event) => updateItem(item.id, { opportunity: event.target.value || undefined })}
                />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-two-column-grid">
                <input
                  aria-label="Commercial priority action"
                  value={item.text}
                  placeholder="Action"
                  onChange={(event) => updateItem(item.id, { text: event.target.value })}
                />
                <input
                  aria-label="Commercial priority account"
                  value={item.account ?? ''}
                  placeholder="Account (optional)"
                  onChange={(event) => updateItem(item.id, { account: event.target.value || undefined })}
                />
                <input
                  aria-label="Commercial priority product"
                  value={item.product ?? ''}
                  placeholder="Product (optional)"
                  onChange={(event) => updateItem(item.id, { product: event.target.value || undefined })}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No commercial priorities captured yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add priority</button>
      </div>
    </section>
  )
}

function WeeklyPlanSuccessMeasureSection({
  items,
  onChange,
}: {
  items: SuccessMeasure[]
  onChange: (items: SuccessMeasure[]) => void
}) {
  function updateItem(itemId: string, updates: Partial<SuccessMeasure>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  function addItem() {
    onChange([...items, { id: crypto.randomUUID(), text: '', target: '', unit: '', category: 'coverage' }])
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly work plan</p>
          <h3>Success Measures</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Track the measurable indicators of success for the week, with optional target and category context.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className="weekly-plan-card" key={item.id}>
              <div className="weekly-plan-card-header">
                <input
                  aria-label="Success measure"
                  value={item.text}
                  placeholder="Measure / description"
                  onChange={(event) => updateItem(item.id, { text: event.target.value })}
                />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-two-column-grid">
                <input
                  aria-label="Target"
                  value={item.target ?? ''}
                  placeholder="Target (optional)"
                  onChange={(event) => updateItem(item.id, { target: event.target.value || undefined })}
                />
                <input
                  aria-label="Unit"
                  value={item.unit ?? ''}
                  placeholder="Unit (optional)"
                  onChange={(event) => updateItem(item.id, { unit: event.target.value || undefined })}
                />
              </div>
              <label className="weekly-plan-field-label">
                Category
                <select
                  aria-label="Success measure category"
                  value={item.category ?? 'coverage'}
                  onChange={(event) => updateItem(item.id, { category: event.target.value as SuccessMeasure['category'] })}
                >
                  <option value="coverage">Coverage</option>
                  <option value="engagement">Engagement</option>
                  <option value="commercial">Commercial</option>
                  <option value="account">Account</option>
                  <option value="scientific">Scientific</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No success measures captured yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add measure</button>
      </div>
    </section>
  )
}

function WeeklyPlanScreen() {
  const [weekStart, setWeekStart] = useState(getSelectedWeekStart)
  const [plan, setPlan] = useState<WeeklyPlan>(() => loadWeeklyPlan(getSelectedWeekStart()))
  const planIntelligence = useMemo(() => deriveWeeklyIntelligence({
    selectedWeek: weekStart,
    plan,
    activities: loadDailyActivities(weekStart),
    followUps: loadFollowUps(weekStart),
  }), [plan, weekStart])

  useEffect(() => {
    saveWeeklyPlan(plan)
  }, [plan])

  function changeWeek(value: string) {
    const nextWeekStart = getWeekStartFromInput(value)
    setSelectedWeekStart(nextWeekStart)
    setWeekStart(nextWeekStart)
    setPlan(loadWeeklyPlan(nextWeekStart))
  }

  function updateDay(updatedDay: DayPlan) {
    setPlan((currentPlan) => ({
      ...currentPlan,
      days: currentPlan.days.map((day) => day.id === updatedDay.id ? updatedDay : day),
    }))
  }

  return (
    <main className="weekly-plan-screen" id="weekly-plan">
      <div className="plan-page-heading">
        <div>
          <p className="eyebrow">Plan before the week begins</p>
          <h1>Weekly Work Plan</h1>
          <p className="plan-intro">Align weekly strategic priorities, field coverage and account-specific activities for the selected week.</p>
        </div>
        <div className="week-selector">
          <label htmlFor="reporting-week">Reporting week</label>
          <input id="reporting-week" type="week" value={toWeekInput(weekStart)} onChange={(event) => changeWeek(event.target.value)} />
          <span>{formatWeekRange(weekStart)}</span>
        </div>
      </div>
      <section className="plan-coverage" aria-labelledby="plan-coverage-heading">
        <div className="plan-coverage-heading"><div><p className="eyebrow">WeekFlow Intelligence</p><h2 id="plan-coverage-heading">Plan Coverage</h2></div><span>Derived from Daily Activity</span></div>
        <div className="plan-coverage-days">{plan.days.map((day) => {
          const dayGaps = planIntelligence.planGaps.filter((gap) => gap.dayLabel === day.label)
          const plannedCount = day.categories.facilities.length + day.categories.virtualEngagements.length + day.categories.primaryObjectives.length + day.categories.accountObjectives.length + day.categories.commercialPriorities.length + day.categories.successMeasures.length
          const status = plannedCount === 0 ? 'No items' : dayGaps.length === 0 ? 'Covered' : dayGaps.length < plannedCount ? 'Partially covered' : dayGaps.some((gap) => gap.status === 'needs review') ? 'Needs review' : 'Not evidenced'
          return <div className="plan-coverage-day" key={day.id}><div><strong>{day.label}</strong><span>{plannedCount === 0 ? 'No matchable plan items' : `${plannedCount} planned item${plannedCount === 1 ? '' : 's'}`}</span></div><em className={`coverage-status ${status.toLowerCase().replace(' ', '-')}`}>{status}</em></div>
        })}</div>
        {planIntelligence.planGaps.length > 0 && <ul className="plan-coverage-gaps">{planIntelligence.planGaps.filter((gap) => gap.status !== 'covered').slice(0, 5).map((gap) => <li key={`${gap.itemId}-${gap.dayLabel}`}><strong>{gap.item}</strong><span>{gap.status}</span><small>{gap.reason}</small></li>)}</ul>}
      </section>
      <div className="weekly-plan-top-level">
        <WeeklyPlanTextListSection
          title="Weekly Strategic Objectives"
          summary={`${plan.weeklyStrategicObjectives.length} item${plan.weeklyStrategicObjectives.length === 1 ? '' : 's'}`}
          items={plan.weeklyStrategicObjectives}
          emptyText="No strategic objectives captured for this week yet."
          placeholder="Add a strategic objective"
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, weeklyStrategicObjectives: items }))}
        />
        <WeeklyPlanVirtualEngagementSection
          items={plan.virtualEngagementPlan}
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, virtualEngagementPlan: items }))}
        />
        <WeeklyPlanAccountObjectiveSection
          items={plan.keyAccountObjectives}
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, keyAccountObjectives: items }))}
        />
        <WeeklyPlanCommercialPrioritySection
          items={plan.commercialPriorities}
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, commercialPriorities: items }))}
        />
        <WeeklyPlanSuccessMeasureSection
          items={plan.successMeasures}
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, successMeasures: items }))}
        />
      </div>
      <section className="daily-field-plan-section" aria-labelledby="daily-field-plan-heading">
        <div className="weekly-plan-summary-header daily-plan-header">
          <div>
            <p className="eyebrow">Week plan</p>
            <h2 id="daily-field-plan-heading">Daily Field Plan</h2>
          </div>
          <span>Monday–Friday</span>
        </div>
        <p className="weekly-plan-helper">Plan your physical account coverage, HCP engagements and primary objectives for each working day.</p>
        <div className="days-list">
          {plan.days.map((day) => <DayPlanSection day={day} key={day.id} onChange={updateDay} />)}
        </div>
      </section>
    </main>
  )
}

function hasPlanData(plan: WeeklyPlan) {
  return plan.days.some((day) => PLAN_CATEGORIES.some((category) => day.categories[category].length > 0))
}

function getWeekYear(weekStart: string) {
  return Number(toWeekInput(weekStart).slice(0, 4))
}

function getWeekNumber(weekStart: string) {
  return toWeekInput(weekStart).split('-W')[1]
}

function ReportHistory({ selectedWeek, onSelectWeek }: { selectedWeek: string; onSelectWeek: (weekStart: string) => void }) {
  const [exportingWeek, setExportingWeek] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState('')
  const reports = getStoredWeekStarts().map((weekStart) => {
    const plan = loadWeeklyPlan(weekStart)
    const activities = loadDailyActivities(weekStart)
    const followUps = loadFollowUps(weekStart)
    return {
      weekStart,
      plan,
      activities,
      followUps,
      hasPlan: hasPlanData(plan),
      hasActivities: activities.length > 0,
      hasFollowUps: followUps.length > 0,
    }
  }).filter((report) => report.hasPlan || report.hasActivities || report.hasFollowUps)
  const currentYear = new Date().getFullYear()
  const years = [...new Set([
    ...reports.map((report) => getWeekYear(report.weekStart)),
    ...Array.from({ length: 11 }, (_, index) => currentYear - 5 + index),
  ])].sort((left, right) => right - left)
  const [selectedYear, setSelectedYear] = useState(getWeekYear(selectedWeek))
  const filteredReports = reports.filter((report) => getWeekYear(report.weekStart) === selectedYear)

  async function exportHistoricalReport(weekStart: string) {
    setExportingWeek(weekStart)
    setExportMessage('')
    try {
      const report = reports.find((item) => item.weekStart === weekStart)
      if (!report) return
      const result = await exportReportWord({
        weekKey: weekStart,
        weekLabel: getFixedReportWeekLabel(weekStart),
        plan: report.plan,
        activities: report.activities,
        followUps: report.followUps,
      })
      setExportMessage(`Downloaded ${result.filename}`)
    } catch {
      setExportMessage('Word export could not be completed. Please try again.')
    } finally {
      setExportingWeek(null)
    }
  }

  return (
    <section className="report-history" aria-labelledby="report-history-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Saved reporting weeks</p>
          <h2 id="report-history-heading">Report History</h2>
        </div>
        <p>Reopen a saved week or export its report again.</p>
      </div>
      <label className="history-year-selector" htmlFor="history-year">Year
        <select id="history-year" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
          {years.map((year) => <option value={year} key={year}>{year}</option>)}
        </select>
      </label>
      {filteredReports.length > 0 ? <div className="report-history-list" role="list">{filteredReports.map((report) => <article className="report-history-item" key={report.weekStart} role="listitem">
        <div><strong>Week {getWeekNumber(report.weekStart)}</strong><span>{formatWeekRange(report.weekStart)}</span><small>{report.weekStart === selectedWeek ? 'Selected week' : report.weekStart === getCurrentWeekStart() ? 'Current week' : 'Historical week'}</small></div>
        <div className="report-history-status"><span className={report.hasPlan ? 'is-present' : ''}>Weekly Plan: {report.hasPlan ? 'Available' : 'Not saved'}</span><span className={report.hasActivities ? 'is-present' : ''}>Daily Activity: {report.hasActivities ? `${report.activities.length} records` : 'Not saved'}</span><span className={report.hasFollowUps ? 'is-present' : ''}>Follow-ups: {report.hasFollowUps ? `${report.followUps.length} records` : 'Not saved'}</span><span className="is-present">Report: Available</span></div>
        <div className="report-history-actions"><button type="button" onClick={() => { onSelectWeek(report.weekStart); navigateTo('/report') }}>View Report</button><button type="button" onClick={() => exportHistoricalReport(report.weekStart)} disabled={exportingWeek !== null}>{exportingWeek === report.weekStart ? 'Exporting...' : 'Export Word'}</button></div>
      </article>)}</div> : <p className="report-history-empty">No reports found for {selectedYear}.</p>}
      {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}
    </section>
  )
}

function ReportHistoryScreen({ selectedWeek, onSelectWeek }: { selectedWeek: string; onSelectWeek: (weekStart: string) => void }) {
  return <main className="report-history-screen"><ReportHistory selectedWeek={selectedWeek} onSelectWeek={onSelectWeek} /></main>
}

function App() {
  const [activeScreen, setActiveScreen] = useState(getInitialScreen)
  const [selectedWeek, setSelectedWeek] = useState(getSelectedWeekStart)

  useEffect(() => {
    // Initial hash-to-path redirect on app load
    handleOldHashRoutes()
  }, [])

  useEffect(() => {
    // Monitor hash changes for backward compatibility (e.g., old bookmarks, external links)
    const handleHashChange = () => {
      handleOldHashRoutes()
    }

    const handleLocationChange = () => setActiveScreen(getScreenFromPath())
    const handleWeekChange = (event: Event) => {
      const weekStart = (event as CustomEvent<string>).detail
      if (typeof weekStart === 'string') setSelectedWeek(weekStart)
    }
    window.addEventListener('hashchange', handleHashChange)
    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener('weekflow-week-change', handleWeekChange)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('weekflow-week-change', handleWeekChange)
    }
  }, [])

  function changeWeek(weekStart: string) {
    setSelectedWeekStart(weekStart)
  }

  return (
    <div className="app-shell">
      <Header selectedWeek={selectedWeek} />
      <WeekNavigation weekStart={selectedWeek} onChange={changeWeek} />
      <div className="app-body">
        <AppNavigation activeScreen={activeScreen} />
        {activeScreen === 'weekly-plan' ? <WeeklyPlanScreen key={selectedWeek} /> : activeScreen === 'daily-activity' ? <DailyActivityScreen key={selectedWeek} /> : activeScreen === 'follow-ups' ? <FollowUpsScreen key={selectedWeek} /> : activeScreen === 'report' ? <GenerateReportScreen key={selectedWeek} /> : activeScreen === 'report-history' ? <ReportHistoryScreen selectedWeek={selectedWeek} onSelectWeek={changeWeek} /> : <OverviewScreen selectedWeek={selectedWeek} onNavigate={(screen) => { navigateTo(`/${screen === 'overview' ? '' : screen}`) }} />}
      </div>
    </div>
  )
}

export default App
