import { useEffect, useMemo, useState } from 'react'
import { loadEducationRecords, loadEducationRecordsAsync, saveEducationRecords, saveEducationRecordsAsync } from '../storage/educationRecordsStorage'
import {
  EDUCATION_ASSESSMENT_STATUSES,
  EDUCATION_ASSESSMENT_TYPES,
  EDUCATION_TASK_STATUSES,
  EDUCATION_TASK_TYPES,
  calculateAttendancePercentage,
  calculateSubmissionRate,
  type EducationAcademicTask,
  type EducationAssessment,
  type EducationAttendance,
  type EducationRecord,
} from '../types/educationRecords'
import './EducationRecords.css'

type Tab = 'attendance' | 'tasks' | 'assessments'

type RecordDraft = {
  date: string
  classGroup: string
  courseProgramme: string
  registeredLearners: string
  present: string
  notes: string
  task: string
  taskType: EducationAcademicTask['type']
  assignedDate: string
  dueDate: string
  expectedSubmissions: string
  submissions: string
  taskStatus: EducationAcademicTask['status']
  assessment: string
  assessmentType: EducationAssessment['type']
  learners: string
  averageScore: string
  assessmentStatus: EducationAssessment['status']
}

const EMPTY_DRAFT: RecordDraft = {
  date: '', classGroup: '', courseProgramme: '', registeredLearners: '', present: '', notes: '',
  task: '', taskType: 'Assignment', assignedDate: '', dueDate: '', expectedSubmissions: '', submissions: '', taskStatus: 'Planned',
  assessment: '', assessmentType: 'Formative', learners: '', averageScore: '', assessmentStatus: 'Planned',
}

function createId() { return crypto.randomUUID() }
function timestamp() { return new Date().toISOString() }
function numberValue(value: string) { return value === '' ? 0 : Number(value) }
function formatDate(value: string) { return value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'Date not set' }
function percentage(value: number | null) { return value === null ? 'Not applicable' : `${Math.round(value)}%` }

function draftFromRecord(record: EducationRecord): RecordDraft {
  if (record.kind === 'attendance') return { ...EMPTY_DRAFT, date: record.date, classGroup: record.classGroup, courseProgramme: record.courseProgramme, registeredLearners: String(record.registeredLearners), present: String(record.present), notes: record.notes }
  if (record.kind === 'academic-task') return { ...EMPTY_DRAFT, task: record.task, taskType: record.type, classGroup: record.classGroup, courseProgramme: record.courseProgramme, assignedDate: record.assignedDate, dueDate: record.dueDate, expectedSubmissions: String(record.expectedSubmissions), submissions: String(record.submissions), taskStatus: record.status, notes: record.notes }
  return { ...EMPTY_DRAFT, assessment: record.assessment, assessmentType: record.type, classGroup: record.classGroup, courseProgramme: record.courseProgramme, date: record.date, learners: String(record.learners), averageScore: String(record.averageScore), assessmentStatus: record.status, notes: record.notes }
}

function dateForWeek(weekStart: string) { return weekStart }

export default function EducationRecordsScreen({ weekStart }: { weekStart: string }) {
  const [records, setRecords] = useState<EducationRecord[]>(() => loadEducationRecords(weekStart))
  const [activeTab, setActiveTab] = useState<Tab>('attendance')
  const [draft, setDraft] = useState<RecordDraft>({ ...EMPTY_DRAFT, date: dateForWeek(weekStart), assignedDate: dateForWeek(weekStart) })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    loadEducationRecordsAsync(weekStart).then((loaded) => { if (active) setRecords(loaded) })
    return () => { active = false }
  }, [weekStart])

  const filteredRecords = useMemo(() => records.filter((record) => activeTab === 'attendance' ? record.kind === 'attendance' : activeTab === 'tasks' ? record.kind === 'academic-task' : record.kind === 'assessment'), [activeTab, records])
  const attendanceRecords = records.filter((record): record is EducationAttendance => record.kind === 'attendance')
  const taskRecords = records.filter((record): record is EducationAcademicTask => record.kind === 'academic-task')
  const assessmentRecords = records.filter((record): record is EducationAssessment => record.kind === 'assessment')

  function updateDraft<K extends keyof RecordDraft>(key: K, value: RecordDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrorMessage('')
  }

  function openCreate(tab: Tab) {
    setActiveTab(tab)
    setDraft({ ...EMPTY_DRAFT, date: dateForWeek(weekStart), assignedDate: dateForWeek(weekStart) })
    setEditingId(null)
    setErrorMessage('')
    setFormOpen(true)
  }

  function openEdit(record: EducationRecord) {
    setActiveTab(record.kind === 'academic-task' ? 'tasks' : record.kind === 'assessment' ? 'assessments' : 'attendance')
    setDraft(draftFromRecord(record))
    setEditingId(record.id)
    setErrorMessage('')
    setFormOpen(true)
  }

  function validateDraft() {
    const registered = numberValue(draft.registeredLearners)
    const present = numberValue(draft.present)
    const expected = numberValue(draft.expectedSubmissions)
    const submissions = numberValue(draft.submissions)
    const learners = numberValue(draft.learners)
    const score = numberValue(draft.averageScore)
    if (activeTab === 'attendance' && (registered < 0 || present < 0 || present > registered)) return 'Present must be between 0 and Registered Learners.'
    if (activeTab === 'tasks' && (expected < 0 || submissions < 0 || submissions > expected)) return 'Submissions must be between 0 and Expected Submissions.'
    if (activeTab === 'assessments' && (learners < 0 || score < 0 || score > 100)) return 'Learners cannot be negative and Average Score must be between 0 and 100.'
    return ''
  }

  function saveRecord() {
    const validation = validateDraft()
    if (validation) { setErrorMessage(validation); return }
    const now = timestamp()
    const existing = editingId ? records.find((record) => record.id === editingId) : null
    let record: EducationRecord
    if (activeTab === 'attendance') record = { id: editingId ?? createId(), kind: 'attendance', date: draft.date, classGroup: draft.classGroup.trim(), courseProgramme: draft.courseProgramme.trim(), registeredLearners: numberValue(draft.registeredLearners), present: numberValue(draft.present), notes: draft.notes.trim(), createdAt: existing?.createdAt ?? now, updatedAt: now }
    else if (activeTab === 'tasks') record = { id: editingId ?? createId(), kind: 'academic-task', task: draft.task.trim(), type: draft.taskType, classGroup: draft.classGroup.trim(), courseProgramme: draft.courseProgramme.trim(), assignedDate: draft.assignedDate, dueDate: draft.dueDate, expectedSubmissions: numberValue(draft.expectedSubmissions), submissions: numberValue(draft.submissions), status: draft.taskStatus, notes: draft.notes.trim(), createdAt: existing?.createdAt ?? now, updatedAt: now }
    else record = { id: editingId ?? createId(), kind: 'assessment', assessment: draft.assessment.trim(), type: draft.assessmentType, classGroup: draft.classGroup.trim(), courseProgramme: draft.courseProgramme.trim(), date: draft.date, learners: numberValue(draft.learners), averageScore: numberValue(draft.averageScore), status: draft.assessmentStatus, notes: draft.notes.trim(), createdAt: existing?.createdAt ?? now, updatedAt: now }
    const next = editingId ? records.map((item) => item.id === editingId ? record : item) : [...records, record]
    saveEducationRecords(weekStart, next)
    void saveEducationRecordsAsync(weekStart, next)
    setRecords(next)
    setFormOpen(false)
    setEditingId(null)
  }

  function deleteRecord(id: string) {
    const next = records.filter((record) => record.id !== id)
    saveEducationRecords(weekStart, next)
    void saveEducationRecordsAsync(weekStart, next)
    setRecords(next)
    if (editingId === id) setFormOpen(false)
  }

  const tabLabels: Array<[Tab, string, number]> = [['attendance', 'Attendance', attendanceRecords.length], ['tasks', 'Academic Tasks', taskRecords.length], ['assessments', 'Assessments', assessmentRecords.length]]

  return <main className="education-records-screen">
    <div className="education-records-heading"><div><p className="eyebrow">Education Phase 3</p><h1>Attendance, tasks & assessments</h1><p className="education-records-intro">Capture aggregate learner participation and academic evidence for the selected week.</p></div><div className="education-records-context"><span>Education workspace</span><strong>Week of {formatDate(weekStart)}</strong></div></div>
    <div className="education-record-tabs" role="tablist" aria-label="Education records"><div>{tabLabels.map(([tab, label, count]) => <button type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : ''} key={tab} onClick={() => { setActiveTab(tab); setFormOpen(false) }}>{label}<span>{count}</span></button>)}</div><button type="button" className="button button-primary" onClick={() => openCreate(activeTab)}>+ Add {activeTab === 'tasks' ? 'Academic Task' : activeTab === 'assessments' ? 'Assessment' : 'Attendance'}</button></div>
    {formOpen && <section className="education-record-form" aria-label={`Add ${activeTab}`}><div className="education-record-form-heading"><div><p className="eyebrow">{editingId ? 'Edit record' : 'New record'}</p><h2>{editingId ? 'Update the record' : `Record ${activeTab === 'tasks' ? 'academic work' : activeTab}`}</h2></div><button type="button" className="text-button" onClick={() => setFormOpen(false)}>Cancel</button></div>
      {activeTab === 'attendance' && <div className="education-record-form-grid"><label><span>Date</span><input aria-label="Attendance Date" type="date" value={draft.date} onChange={(event) => updateDraft('date', event.target.value)} required /></label><label><span>Class / Group</span><input aria-label="Attendance Class / Group" value={draft.classGroup} onChange={(event) => updateDraft('classGroup', event.target.value)} required /></label><label><span>Course / Programme</span><input value={draft.courseProgramme} onChange={(event) => updateDraft('courseProgramme', event.target.value)} /></label><label><span>Registered Learners</span><input aria-label="Registered Learners" type="number" min="0" step="1" value={draft.registeredLearners} onChange={(event) => updateDraft('registeredLearners', event.target.value)} required /></label><label><span>Present</span><input aria-label="Present Learners" type="number" min="0" step="1" value={draft.present} onChange={(event) => updateDraft('present', event.target.value)} required /></label><label className="calculated-field"><span>Absent</span><output>{Math.max(0, numberValue(draft.registeredLearners) - numberValue(draft.present))}</output></label><label className="calculated-field"><span>Attendance Percentage</span><output>{percentage(draft.registeredLearners === '' ? null : calculateAttendancePercentage({ registeredLearners: numberValue(draft.registeredLearners), present: numberValue(draft.present) }))}</output></label><label className="wide-field"><span>Notes</span><textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} rows={2} /></label></div>}
      {activeTab === 'tasks' && <div className="education-record-form-grid"><label className="wide-field"><span>Task</span><input value={draft.task} onChange={(event) => updateDraft('task', event.target.value)} required /></label><label><span>Type</span><select value={draft.taskType} onChange={(event) => updateDraft('taskType', event.target.value as EducationAcademicTask['type'])}>{EDUCATION_TASK_TYPES.map((option) => <option key={option}>{option}</option>)}</select></label><label><span>Class / Group</span><input value={draft.classGroup} onChange={(event) => updateDraft('classGroup', event.target.value)} required /></label><label><span>Course / Programme</span><input value={draft.courseProgramme} onChange={(event) => updateDraft('courseProgramme', event.target.value)} /></label><label><span>Assigned Date</span><input type="date" value={draft.assignedDate} onChange={(event) => updateDraft('assignedDate', event.target.value)} /></label><label><span>Due Date</span><input type="date" value={draft.dueDate} onChange={(event) => updateDraft('dueDate', event.target.value)} /></label><label><span>Expected Submissions</span><input aria-label="Expected Submissions" type="number" min="0" step="1" value={draft.expectedSubmissions} onChange={(event) => updateDraft('expectedSubmissions', event.target.value)} required /></label><label><span>Submissions</span><input aria-label="Submissions" type="number" min="0" step="1" value={draft.submissions} onChange={(event) => updateDraft('submissions', event.target.value)} required /></label><label><span>Status</span><select value={draft.taskStatus} onChange={(event) => updateDraft('taskStatus', event.target.value as EducationAcademicTask['status'])}>{EDUCATION_TASK_STATUSES.map((option) => <option key={option}>{option}</option>)}</select></label><label className="calculated-field"><span>Submission Rate</span><output>{percentage(draft.expectedSubmissions === '' ? null : calculateSubmissionRate({ expectedSubmissions: numberValue(draft.expectedSubmissions), submissions: numberValue(draft.submissions) }))}</output></label><label className="calculated-field"><span>Outstanding</span><output>{Math.max(0, numberValue(draft.expectedSubmissions) - numberValue(draft.submissions))}</output></label><label className="wide-field"><span>Notes</span><textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} rows={2} /></label></div>}
      {activeTab === 'assessments' && <div className="education-record-form-grid"><label className="wide-field"><span>Assessment</span><input value={draft.assessment} onChange={(event) => updateDraft('assessment', event.target.value)} required /></label><label><span>Type</span><select value={draft.assessmentType} onChange={(event) => updateDraft('assessmentType', event.target.value as EducationAssessment['type'])}>{EDUCATION_ASSESSMENT_TYPES.map((option) => <option key={option}>{option}</option>)}</select></label><label><span>Class / Group</span><input value={draft.classGroup} onChange={(event) => updateDraft('classGroup', event.target.value)} required /></label><label><span>Course / Programme</span><input value={draft.courseProgramme} onChange={(event) => updateDraft('courseProgramme', event.target.value)} /></label><label><span>Date</span><input type="date" value={draft.date} onChange={(event) => updateDraft('date', event.target.value)} /></label><label><span>Learners</span><input type="number" min="0" step="1" value={draft.learners} onChange={(event) => updateDraft('learners', event.target.value)} /></label><label><span>Average Score (%)</span><input aria-label="Average Score (%)" type="number" min="0" max="100" step="0.1" value={draft.averageScore} onChange={(event) => updateDraft('averageScore', event.target.value)} required /></label><label><span>Status</span><select value={draft.assessmentStatus} onChange={(event) => updateDraft('assessmentStatus', event.target.value as EducationAssessment['status'])}>{EDUCATION_ASSESSMENT_STATUSES.map((option) => <option key={option}>{option}</option>)}</select></label><label className="wide-field"><span>Notes</span><textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} rows={2} /></label></div>}
      {errorMessage && <p className="education-record-error" role="alert">{errorMessage}</p>}<div className="education-record-form-actions"><button type="button" className="button button-primary" onClick={saveRecord}>{editingId ? 'Save Changes' : 'Save Record'}</button></div>
    </section>}
    <section className="education-records-list" aria-live="polite">{filteredRecords.length === 0 ? <div className="education-records-empty"><span aria-hidden="true">+</span><h2>{activeTab === 'attendance' ? 'No attendance recorded for this week yet.' : activeTab === 'tasks' ? 'No academic tasks recorded for this week yet.' : 'No assessments recorded for this week yet.'}</h2><p>Use the button above to capture aggregate class or group information.</p></div> : <div className="education-record-card-list">{filteredRecords.map((record) => <EducationRecordCard key={record.id} record={record} onEdit={() => openEdit(record)} onDelete={() => deleteRecord(record.id)} />)}</div>}</section>
  </main>
}

function EducationRecordCard({ record, onEdit, onDelete }: { record: EducationRecord; onEdit: () => void; onDelete: () => void }) {
  return <article className="education-record-card"><div className="education-record-card-main">{record.kind === 'attendance' ? <><div className="education-record-card-title"><h3>{record.classGroup || 'Class / Group not set'}</h3><span>Attendance</span></div><p>{formatDate(record.date)}{record.courseProgramme ? ` · ${record.courseProgramme}` : ''}</p><div className="education-record-metrics"><strong>{record.registeredLearners}</strong><span>registered</span><strong>{record.present}</strong><span>present</span><strong>{record.registeredLearners - record.present}</strong><span>absent</span><strong>{percentage(calculateAttendancePercentage(record))}</strong></div>{record.notes && <p className="education-record-notes">{record.notes}</p>}</> : record.kind === 'academic-task' ? <><div className="education-record-card-title"><h3>{record.task}</h3><span>{record.type}</span></div><p>{record.classGroup || 'Class / Group not set'} · Due {formatDate(record.dueDate)}</p><div className="education-record-metrics"><strong>{record.expectedSubmissions}</strong><span>expected</span><strong>{record.submissions}</strong><span>submitted</span><strong>{percentage(calculateSubmissionRate(record))}</strong><span>submission rate</span><strong>{record.status}</strong></div>{record.notes && <p className="education-record-notes">{record.notes}</p>}</> : <><div className="education-record-card-title"><h3>{record.assessment}</h3><span>{record.type}</span></div><p>{record.classGroup || 'Class / Group not set'} · {formatDate(record.date)}</p><div className="education-record-metrics"><strong>{record.learners}</strong><span>learners</span><strong>{record.averageScore}%</strong><span>average score</span><strong>{record.status}</strong></div>{record.notes && <p className="education-record-notes">{record.notes}</p>}</>}</div><div className="education-record-card-actions"><button type="button" onClick={onEdit}>Edit</button><button type="button" onClick={onDelete}>Delete</button></div></article>
}
