import { useEffect, useState } from 'react'
import type {
  DayId,
  EducationContext,
  EducationLearningObjective,
  EducationTeachingPlanItem,
  EducationWeeklyTarget,
  PriorityLevel,
} from '../types/weeklyPlan'

const DAYS: { id: DayId; label: string }[] = [
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
  { id: 'saturday', label: 'Saturday' },
  { id: 'sunday', label: 'Sunday' },
]

const PRIORITIES: PriorityLevel[] = ['low', 'medium', 'high', 'critical']

function useNewItemHighlight() {
  const [newItemId, setNewItemId] = useState<string | null>(null)
  useEffect(() => {
    if (!newItemId) return
    const timer = window.setTimeout(() => setNewItemId(null), 520)
    return () => window.clearTimeout(timer)
  }, [newItemId])
  return { newItemId, markNew: setNewItemId }
}

function Section({ title, prompt, count, children }: { title: string; prompt?: string; count?: number; children: React.ReactNode }) {
  return <section className="weekly-plan-summary-section">
    <div className="weekly-plan-summary-header"><div><p className="eyebrow">Education Weekly Plan</p><h3>{title}</h3></div>{typeof count === 'number' && <span>{count} item{count === 1 ? '' : 's'}</span>}</div>
    {prompt && <p className="weekly-plan-helper">{prompt}</p>}
    {children}
  </section>
}

function PrioritySelect({ value, onChange, label }: { value?: PriorityLevel; onChange: (value: PriorityLevel) => void; label: string }) {
  return <select aria-label={label} value={value ?? 'medium'} onChange={(event) => onChange(event.target.value as PriorityLevel)}>{PRIORITIES.map((priority) => <option value={priority} key={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>)}</select>
}

export default function EducationWeeklyPlan({
  focus,
  objectives,
  teachingPlan,
  targets,
  context,
  onFocusChange,
  onObjectivesChange,
  onTeachingPlanChange,
  onTargetsChange,
  onContextChange,
}: {
  focus?: string
  objectives: EducationLearningObjective[]
  teachingPlan: EducationTeachingPlanItem[]
  targets: EducationWeeklyTarget[]
  context?: EducationContext
  onFocusChange: (value: string) => void
  onObjectivesChange: (items: EducationLearningObjective[]) => void
  onTeachingPlanChange: (items: EducationTeachingPlanItem[]) => void
  onTargetsChange: (items: EducationWeeklyTarget[]) => void
  onContextChange: (value: EducationContext) => void
}) {
  const objectiveHighlight = useNewItemHighlight()
  const teachingHighlight = useNewItemHighlight()
  const targetHighlight = useNewItemHighlight()
  const contextValue = context ?? {}
  const updateContext = (key: keyof EducationContext, value: string) => onContextChange({ ...contextValue, [key]: value || undefined })

  function addObjective() {
    const id = crypto.randomUUID()
    onObjectivesChange([...objectives, { id, objective: '', successMeasure: '', priority: 'medium' }])
    objectiveHighlight.markNew(id)
  }
  function updateObjective(id: string, changes: Partial<EducationLearningObjective>) { onObjectivesChange(objectives.map((item) => item.id === id ? { ...item, ...changes } : item)) }
  function deleteObjective(id: string) { onObjectivesChange(objectives.filter((item) => item.id !== id)) }

  function addTeachingPlanItem() {
    const id = crypto.randomUUID()
    onTeachingPlanChange([...teachingPlan, { id, day: 'monday', topic: '', teachingActivity: '', learningActivity: '', duration: '' }])
    teachingHighlight.markNew(id)
  }
  function updateTeachingPlanItem(id: string, changes: Partial<EducationTeachingPlanItem>) { onTeachingPlanChange(teachingPlan.map((item) => item.id === id ? { ...item, ...changes } : item)) }
  function deleteTeachingPlanItem(id: string) { onTeachingPlanChange(teachingPlan.filter((item) => item.id !== id)) }

  function addTarget() {
    const id = crypto.randomUUID()
    onTargetsChange([...targets, { id, target: '', measure: '', priority: 'medium' }])
    targetHighlight.markNew(id)
  }
  function updateTarget(id: string, changes: Partial<EducationWeeklyTarget>) { onTargetsChange(targets.map((item) => item.id === id ? { ...item, ...changes } : item)) }
  function deleteTarget(id: string) { onTargetsChange(targets.filter((item) => item.id !== id)) }

  return <div className="education-weekly-plan" aria-label="Education weekly planning sections">
    <Section title="Weekly Focus" prompt="What should students learn or achieve this week?">
      <textarea aria-label="Weekly Focus" value={focus ?? ''} placeholder="Describe the learning focus for this week..." rows={3} onChange={(event) => onFocusChange(event.target.value)} />
      <div className="weekly-plan-form-actions"><span className="weekly-plan-helper">This is planned focus, not evidence that learning has already occurred.</span></div>
    </Section>

    <Section title="Learning Objectives" prompt="Define what students should be able to learn or achieve. Keep these distinct from teaching activities." count={objectives.length}>
      {objectives.length > 0 ? <div className="weekly-plan-card-stack">{objectives.map((item) => <div className={`weekly-plan-card${objectiveHighlight.newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
        <div className="weekly-plan-card-header"><input aria-label="Learning Objective" value={item.objective} placeholder="What should students be able to do?" onChange={(event) => updateObjective(item.id, { objective: event.target.value })} /><button type="button" className="destructive-button" onClick={() => deleteObjective(item.id)}>Delete</button></div>
        <div className="weekly-plan-two-column-grid"><input aria-label="Success Measure" value={item.successMeasure ?? ''} placeholder="Success Measure" onChange={(event) => updateObjective(item.id, { successMeasure: event.target.value || undefined })} /><PrioritySelect label="Learning Objective Priority" value={item.priority} onChange={(priority) => updateObjective(item.id, { priority })} /></div>
      </div>)}</div> : <p className="weekly-plan-summary-empty">No learning objectives captured yet.</p>}
      <div className="weekly-plan-summary-form"><button type="button" className="primary-inline-button" onClick={addObjective}>+ Add learning objective</button></div>
    </Section>

    <Section title="Weekly Teaching Plan" prompt="Plan what will be taught and what learning activity students will do. Entries remain planned until actual activity is recorded." count={teachingPlan.length}>
      {teachingPlan.length > 0 ? <div className="weekly-plan-card-stack">{teachingPlan.map((item) => <div className={`weekly-plan-card${teachingHighlight.newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
        <div className="weekly-plan-card-header"><select aria-label="Teaching Plan Day" value={item.day} onChange={(event) => updateTeachingPlanItem(item.id, { day: event.target.value as DayId })}>{DAYS.map((day) => <option value={day.id} key={day.id}>{day.label}</option>)}</select><button type="button" className="destructive-button" onClick={() => deleteTeachingPlanItem(item.id)}>Delete</button></div>
        <div className="weekly-plan-two-column-grid"><input aria-label="Topic" value={item.topic} placeholder="Topic" onChange={(event) => updateTeachingPlanItem(item.id, { topic: event.target.value })} /><input aria-label="Duration" value={item.duration ?? ''} placeholder="Duration (for example, 1.5h)" onChange={(event) => updateTeachingPlanItem(item.id, { duration: event.target.value || undefined })} /><input aria-label="Teaching Activity" value={item.teachingActivity ?? ''} placeholder="Teaching Activity" onChange={(event) => updateTeachingPlanItem(item.id, { teachingActivity: event.target.value || undefined })} /><input aria-label="Learning Activity" value={item.learningActivity ?? ''} placeholder="Learning Activity" onChange={(event) => updateTeachingPlanItem(item.id, { learningActivity: event.target.value || undefined })} /></div>
      </div>)}</div> : <p className="weekly-plan-summary-empty">No teaching-plan entries captured yet.</p>}
      <div className="weekly-plan-summary-form"><button type="button" className="primary-inline-button" onClick={addTeachingPlanItem}>+ Add teaching-plan entry</button></div>
    </Section>

    <Section title="Weekly Targets" prompt="Record planned targets and how they will be measured. Missing data is not treated as zero or completed." count={targets.length}>
      {targets.length > 0 ? <div className="weekly-plan-card-stack">{targets.map((item) => <div className={`weekly-plan-card${targetHighlight.newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
        <div className="weekly-plan-card-header"><input aria-label="Weekly Target" value={item.target} placeholder="Target" onChange={(event) => updateTarget(item.id, { target: event.target.value })} /><button type="button" className="destructive-button" onClick={() => deleteTarget(item.id)}>Delete</button></div>
        <div className="weekly-plan-two-column-grid"><input aria-label="Target Measure" value={item.measure ?? ''} placeholder="Measure" onChange={(event) => updateTarget(item.id, { measure: event.target.value || undefined })} /><PrioritySelect label="Weekly Target Priority" value={item.priority} onChange={(priority) => updateTarget(item.id, { priority })} /></div>
      </div>)}</div> : <p className="weekly-plan-summary-empty">No weekly targets captured yet.</p>}
      <div className="weekly-plan-summary-form"><button type="button" className="primary-inline-button" onClick={addTarget}>+ Add weekly target</button></div>
    </Section>

    <Section title="Education Context" prompt="Optional context for this week's teaching plan.">
      <div className="weekly-plan-two-column-grid"><label className="weekly-plan-field-label">Course / Programme<input aria-label="Course / Programme" value={contextValue.courseProgramme ?? ''} placeholder="Course / Programme" onChange={(event) => updateContext('courseProgramme', event.target.value)} /></label><label className="weekly-plan-field-label">Class / Group<input aria-label="Class / Group" value={contextValue.classGroup ?? ''} placeholder="Class / Group" onChange={(event) => updateContext('classGroup', event.target.value)} /></label><label className="weekly-plan-field-label">Instructor<input aria-label="Instructor" value={contextValue.instructor ?? ''} placeholder="Instructor" onChange={(event) => updateContext('instructor', event.target.value)} /></label><label className="weekly-plan-field-label">Weekly Theme<input aria-label="Weekly Theme" value={contextValue.weeklyTheme ?? ''} placeholder="Weekly Theme" onChange={(event) => updateContext('weeklyTheme', event.target.value)} /></label></div>
    </Section>
  </div>
}
