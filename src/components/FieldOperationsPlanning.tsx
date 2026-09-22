import type {
  FieldDailyScheduleItem,
  FieldEquipment,
  FieldJob,
  FieldPartResource,
  FieldServiceIssue,
  FieldTeamPlan,
  PriorityLevel,
  WeeklyObjective,
} from '../types/weeklyPlan'

type Change<T> = (items: T[]) => void

const priorityOptions: PriorityLevel[] = ['low', 'medium', 'high', 'critical']
const jobStatuses: FieldJob['status'][] = ['Scheduled', 'Assigned', 'Pending', 'Dispatched', 'In Progress', 'On Hold']
const issueStatuses: FieldServiceIssue['status'][] = ['Reported', 'Assigned', 'Investigating', 'Action Taken', 'Resolved', 'Verified', 'Closed']

function FieldSection({ title, helper, count, children, onAdd, addLabel }: { title: string; helper: string; count: number; children: React.ReactNode; onAdd: () => void; addLabel: string }) {
  return <section className="weekly-plan-summary-section field-operations-section">
    <div className="weekly-plan-summary-header"><div><p className="eyebrow">Field Operations</p><h3>{title}</h3></div><span>{count} item{count === 1 ? '' : 's'}</span></div>
    <p className="weekly-plan-helper">{helper}</p>
    {children}
    <div className="weekly-plan-summary-form"><button type="button" className="primary-inline-button" onClick={onAdd}>{addLabel}</button></div>
  </section>
}

function FieldTextInput({ label, value, placeholder, onChange, type = 'text' }: { label: string; value?: string; placeholder?: string; onChange: (value: string) => void; type?: string }) {
  return <label className="field-operations-input"><span>{label}</span><input aria-label={label} type={type} value={value ?? ''} placeholder={placeholder ?? label} onChange={(event) => onChange(event.target.value)} /></label>
}

function FieldSelect({ label, value, options, onChange }: { label: string; value?: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="field-operations-input"><span>{label}</span><select aria-label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value)}><option value="">Select</option>{options.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>
}

export function FieldOperationsPlanning({
  objectives, jobs, issues, equipment, teamPlan, schedule, partsResources, onObjectivesChange, onJobsChange, onIssuesChange, onEquipmentChange, onTeamPlanChange, onScheduleChange, onPartsResourcesChange,
}: {
  objectives: WeeklyObjective[]
  jobs: FieldJob[]
  issues: FieldServiceIssue[]
  equipment: FieldEquipment[]
  teamPlan: FieldTeamPlan[]
  schedule: FieldDailyScheduleItem[]
  partsResources: FieldPartResource[]
  onObjectivesChange: Change<WeeklyObjective>
  onJobsChange: Change<FieldJob>
  onIssuesChange: Change<FieldServiceIssue>
  onEquipmentChange: Change<FieldEquipment>
  onTeamPlanChange: Change<FieldTeamPlan>
  onScheduleChange: Change<FieldDailyScheduleItem>
  onPartsResourcesChange: Change<FieldPartResource>
}) {
  return <div className="field-operations-planning">
    <FieldObjectives items={objectives} onChange={onObjectivesChange} />
    <FieldJobs items={jobs} onChange={onJobsChange} />
    <FieldIssues items={issues} onChange={onIssuesChange} />
    <FieldEquipment items={equipment} onChange={onEquipmentChange} />
    <FieldTeamPlan items={teamPlan} onChange={onTeamPlanChange} />
    <FieldSchedule items={schedule} onChange={onScheduleChange} />
    <FieldPartsResources items={partsResources} onChange={onPartsResourcesChange} />
  </div>
}

function FieldObjectives({ items, onChange }: { items: WeeklyObjective[]; onChange: Change<WeeklyObjective> }) {
  const addItem = () => onChange([...items, { id: crypto.randomUUID(), text: '', target: '', priority: 'medium' }])
  const update = (id: string, changes: Partial<WeeklyObjective>) => onChange(items.map((item) => item.id === id ? { ...item, ...changes } : item))
  return <FieldSection title="Weekly Objectives" helper="Set planning targets for scheduled work. Targets are planning commitments and are not automatically treated as achieved." count={items.length} onAdd={addItem} addLabel="+ Add objective">
    {items.length === 0 ? <p className="weekly-plan-summary-empty">No weekly objectives captured yet.</p> : <div className="field-operations-card-stack">{items.map((item) => <div className="field-operations-card" key={item.id}>
      <div className="field-operations-card-header"><strong>Objective</strong><button type="button" className="destructive-button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>Remove</button></div>
      <div className="field-operations-grid"><FieldTextInput label="Objective" value={item.text} placeholder="Objective" onChange={(value) => update(item.id, { text: value })} /><FieldTextInput label="Target" value={item.target} placeholder="Target" onChange={(value) => update(item.id, { target: value || undefined })} /><FieldSelect label="Priority" value={item.priority} options={priorityOptions} onChange={(value) => update(item.id, { priority: value as PriorityLevel })} /></div>
    </div>)}</div>}
  </FieldSection>
}

function FieldJobs({ items, onChange }: { items: FieldJob[]; onChange: Change<FieldJob> }) {
  const addItem = () => onChange([...items, { id: crypto.randomUUID(), jobId: '', customer: '', location: '', jobType: '', priority: 'medium', status: 'Scheduled' }])
  const update = (id: string, changes: Partial<FieldJob>) => onChange(items.map((item) => item.id === id ? { ...item, ...changes } : item))
  return <FieldSection title="Jobs / Field Assignments" helper="Plan and assign jobs for the week. These are planned assignments, not records of work already completed." count={items.length} onAdd={addItem} addLabel="+ Add job">
    {items.length === 0 ? <p className="weekly-plan-summary-empty">No jobs or field assignments planned yet.</p> : <div className="field-operations-card-stack">{items.map((item) => <div className="field-operations-card" key={item.id}>
      <div className="field-operations-card-header"><strong>{item.jobId || 'New job'}</strong><button type="button" className="destructive-button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>Remove</button></div>
      <div className="field-operations-grid"><FieldTextInput label="Job ID" value={item.jobId} onChange={(value) => update(item.id, { jobId: value })} /><FieldTextInput label="Customer" value={item.customer} onChange={(value) => update(item.id, { customer: value })} /><FieldTextInput label="Location" value={item.location} onChange={(value) => update(item.id, { location: value })} /><FieldTextInput label="Contact Person" value={item.contactPerson} onChange={(value) => update(item.id, { contactPerson: value || undefined })} /><FieldTextInput label="Job Type" value={item.jobType} onChange={(value) => update(item.id, { jobType: value })} /><FieldSelect label="Priority" value={item.priority} options={priorityOptions} onChange={(value) => update(item.id, { priority: value as PriorityLevel })} /><FieldTextInput label="Assigned Technician" value={item.assignedTechnician} onChange={(value) => update(item.id, { assignedTechnician: value || undefined })} /><FieldTextInput label="Scheduled Day" value={item.scheduledDay} placeholder="Monday" onChange={(value) => update(item.id, { scheduledDay: value || undefined })} /><FieldTextInput label="Scheduled Date" type="date" value={item.scheduledDate} onChange={(value) => update(item.id, { scheduledDate: value || undefined })} /><FieldTextInput label="Start Time" type="time" value={item.startTime} onChange={(value) => update(item.id, { startTime: value || undefined })} /><FieldTextInput label="End Time" type="time" value={item.endTime} onChange={(value) => update(item.id, { endTime: value || undefined })} /><FieldSelect label="Status" value={item.status} options={jobStatuses as string[]} onChange={(value) => update(item.id, { status: value as FieldJob['status'] })} /><FieldTextInput label="Description" value={item.description} onChange={(value) => update(item.id, { description: value || undefined })} /><FieldTextInput label="Equipment" value={item.equipment} onChange={(value) => update(item.id, { equipment: value || undefined })} /><FieldTextInput label="Issue" value={item.issue} onChange={(value) => update(item.id, { issue: value || undefined })} /><FieldTextInput label="Follow-up Date" type="date" value={item.followUpDate} onChange={(value) => update(item.id, { followUpDate: value || undefined })} /></div>
    </div>)}</div>}
  </FieldSection>
}

function FieldIssues({ items, onChange }: { items: FieldServiceIssue[]; onChange: Change<FieldServiceIssue> }) {
  const addItem = () => onChange([...items, { id: crypto.randomUUID(), issueId: '', customer: '', problem: '', priority: 'medium', status: 'Reported' }])
  const update = (id: string, changes: Partial<FieldServiceIssue>) => onChange(items.map((item) => item.id === id ? { ...item, ...changes } : item))
  return <FieldSection title="Service Issues" helper="Track reported issues separately from jobs. Adding an issue does not imply that it is resolved." count={items.length} onAdd={addItem} addLabel="+ Add issue">
    {items.length === 0 ? <p className="weekly-plan-summary-empty">No service issues planned or recorded for this week.</p> : <div className="field-operations-card-stack">{items.map((item) => <div className="field-operations-card" key={item.id}><div className="field-operations-card-header"><strong>{item.issueId || 'New issue'}</strong><button type="button" className="destructive-button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>Remove</button></div><div className="field-operations-grid"><FieldTextInput label="Issue ID" value={item.issueId} onChange={(value) => update(item.id, { issueId: value })} /><FieldTextInput label="Customer" value={item.customer} onChange={(value) => update(item.id, { customer: value })} /><FieldTextInput label="Problem" value={item.problem} onChange={(value) => update(item.id, { problem: value })} /><FieldSelect label="Priority" value={item.priority} options={priorityOptions} onChange={(value) => update(item.id, { priority: value as PriorityLevel })} /><FieldTextInput label="Assigned Technician" value={item.assignedTechnician} onChange={(value) => update(item.id, { assignedTechnician: value || undefined })} /><FieldSelect label="Status" value={item.status} options={issueStatuses as string[]} onChange={(value) => update(item.id, { status: value as FieldServiceIssue['status'] })} /></div></div>)}</div>}
  </FieldSection>
}

function FieldEquipment({ items, onChange }: { items: FieldEquipment[]; onChange: Change<FieldEquipment> }) {
  const addItem = () => onChange([...items, { id: crypto.randomUUID(), equipmentId: '', customerSite: '', condition: '', lastService: '', nextService: '', status: 'Active' }])
  const update = (id: string, changes: Partial<FieldEquipment>) => onChange(items.map((item) => item.id === id ? { ...item, ...changes } : item))
  return <FieldSection title="Equipment" helper="Keep operational equipment references available for planned work. Full service history is reserved for a later phase." count={items.length} onAdd={addItem} addLabel="+ Add equipment">
    {items.length === 0 ? <p className="weekly-plan-summary-empty">No equipment references added yet.</p> : <div className="field-operations-card-stack">{items.map((item) => <div className="field-operations-card" key={item.id}><div className="field-operations-card-header"><strong>{item.equipmentId || 'New equipment'}</strong><button type="button" className="destructive-button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>Remove</button></div><div className="field-operations-grid"><FieldTextInput label="Equipment ID" value={item.equipmentId} onChange={(value) => update(item.id, { equipmentId: value })} /><FieldTextInput label="Customer / Site" value={item.customerSite} onChange={(value) => update(item.id, { customerSite: value })} /><FieldTextInput label="Condition" value={item.condition} onChange={(value) => update(item.id, { condition: value || undefined })} /><FieldTextInput label="Last Service" type="date" value={item.lastService} onChange={(value) => update(item.id, { lastService: value || undefined })} /><FieldTextInput label="Next Service" type="date" value={item.nextService} onChange={(value) => update(item.id, { nextService: value || undefined })} /><FieldTextInput label="Status" value={item.status} onChange={(value) => update(item.id, { status: value || undefined })} /></div></div>)}</div>}
  </FieldSection>
}

function FieldTeamPlan({ items, onChange }: { items: FieldTeamPlan[]; onChange: Change<FieldTeamPlan> }) {
  const addItem = () => onChange([...items, { id: crypto.randomUUID(), technician: '', jobs: '', locations: '', hoursPlanned: '', status: '' }])
  const update = (id: string, changes: Partial<FieldTeamPlan>) => onChange(items.map((item) => item.id === id ? { ...item, ...changes } : item))
  return <FieldSection title="Technician / Field Team Plan" helper="Keep workload planning visible without inventing job counts, locations, or hours." count={items.length} onAdd={addItem} addLabel="+ Add technician">
    {items.length === 0 ? <p className="weekly-plan-summary-empty">No technician planning entries yet.</p> : <div className="field-operations-card-stack">{items.map((item) => <div className="field-operations-card" key={item.id}><div className="field-operations-card-header"><strong>{item.technician || 'New technician'}</strong><button type="button" className="destructive-button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>Remove</button></div><div className="field-operations-grid"><FieldTextInput label="Technician" value={item.technician} onChange={(value) => update(item.id, { technician: value })} /><FieldTextInput label="Jobs" value={item.jobs} placeholder="Planned jobs" onChange={(value) => update(item.id, { jobs: value || undefined })} /><FieldTextInput label="Locations" value={item.locations} onChange={(value) => update(item.id, { locations: value || undefined })} /><FieldTextInput label="Hours Planned" value={item.hoursPlanned} onChange={(value) => update(item.id, { hoursPlanned: value || undefined })} /><FieldTextInput label="Status" value={item.status} onChange={(value) => update(item.id, { status: value || undefined })} /></div></div>)}</div>}
  </FieldSection>
}

function FieldSchedule({ items, onChange }: { items: FieldDailyScheduleItem[]; onChange: Change<FieldDailyScheduleItem> }) {
  const addItem = () => onChange([...items, { id: crypto.randomUUID(), day: '', time: '', technician: '', customer: '', job: '' }])
  const update = (id: string, changes: Partial<FieldDailyScheduleItem>) => onChange(items.map((item) => item.id === id ? { ...item, ...changes } : item))
  return <FieldSection title="Daily Field Schedule" helper="Associate planned jobs with a day, time, technician and customer. These entries do not create Daily Activity records." count={items.length} onAdd={addItem} addLabel="+ Add schedule entry">
    {items.length === 0 ? <p className="weekly-plan-summary-empty">No daily field schedule entries yet.</p> : <div className="field-operations-card-stack">{items.map((item) => <div className="field-operations-card" key={item.id}><div className="field-operations-card-header"><strong>{item.day || 'New schedule entry'}</strong><button type="button" className="destructive-button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>Remove</button></div><div className="field-operations-grid"><FieldTextInput label="Day" value={item.day} placeholder="Monday" onChange={(value) => update(item.id, { day: value })} /><FieldTextInput label="Time" type="time" value={item.time} onChange={(value) => update(item.id, { time: value || undefined })} /><FieldTextInput label="Technician" value={item.technician} onChange={(value) => update(item.id, { technician: value || undefined })} /><FieldTextInput label="Customer" value={item.customer} onChange={(value) => update(item.id, { customer: value || undefined })} /><FieldTextInput label="Job" value={item.job} onChange={(value) => update(item.id, { job: value || undefined })} /></div></div>)}</div>}
  </FieldSection>
}

function FieldPartsResources({ items, onChange }: { items: FieldPartResource[]; onChange: Change<FieldPartResource> }) {
  const addItem = () => onChange([...items, { id: crypto.randomUUID(), job: '', partResource: '', quantity: '', status: 'Requested' }])
  const update = (id: string, changes: Partial<FieldPartResource>) => onChange(items.map((item) => item.id === id ? { ...item, ...changes } : item))
  return <FieldSection title="Parts & Resources" helper="Plan required parts or resources without introducing inventory management." count={items.length} onAdd={addItem} addLabel="+ Add part / resource">
    {items.length === 0 ? <p className="weekly-plan-summary-empty">No parts or resources planned yet.</p> : <div className="field-operations-card-stack">{items.map((item) => <div className="field-operations-card" key={item.id}><div className="field-operations-card-header"><strong>{item.partResource || 'New part / resource'}</strong><button type="button" className="destructive-button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>Remove</button></div><div className="field-operations-grid"><FieldTextInput label="Job" value={item.job} onChange={(value) => update(item.id, { job: value || undefined })} /><FieldTextInput label="Part / Resource" value={item.partResource} onChange={(value) => update(item.id, { partResource: value })} /><FieldTextInput label="Quantity" value={item.quantity} onChange={(value) => update(item.id, { quantity: value || undefined })} /><FieldTextInput label="Status" value={item.status} onChange={(value) => update(item.id, { status: value || undefined })} /></div></div>)}</div>}
  </FieldSection>
}
