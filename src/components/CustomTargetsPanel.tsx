import { useState } from 'react'
import type { CustomCategory, CustomTarget, CustomTargetType } from '../types/customTemplate'

const TARGET_TYPES: Record<CustomTargetType, string> = { number: 'Number', percentage: 'Percentage', currency: 'Currency' }

type TargetDraft = Omit<CustomTarget, 'id' | 'order' | 'targetValue'> & { targetValue: string }

type Props = {
  targets: CustomTarget[]
  categories: CustomCategory[]
}

function compatibleFields(categories: CustomCategory[], type: CustomTargetType, preservedFieldId?: string) {
  return categories.flatMap((category) => category.fields.filter((field) => field.type === type && (field.archived !== true || field.id === preservedFieldId)).map((field) => ({ ...field, categoryName: category.name })))
}

export default function CustomTargetsPanel({ targets: initialTargets, categories }: Props) {
  const [targets, setTargets] = useState<CustomTarget[]>(() => [...initialTargets].sort((left, right) => left.order - right.order))
  const [draft, setDraft] = useState<TargetDraft>({ name: '', description: '', type: 'number', targetValue: '', categoryId: undefined, fieldId: undefined })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [error, setError] = useState('')

  function publish(next: CustomTarget[]) {
    setTargets(next)
    window.dispatchEvent(new CustomEvent('weekflow-custom-targets-change', { detail: next }))
  }

  function editTarget(target?: CustomTarget) {
    setEditingId(target?.id ?? null)
    setDraft(target ? { name: target.name, description: target.description ?? '', type: target.type, targetValue: String(target.targetValue), categoryId: target.categoryId, fieldId: target.fieldId } : { name: '', description: '', type: 'number', targetValue: '', categoryId: undefined, fieldId: undefined })
    setEditorOpen(true)
    setError('')
  }

  function saveTarget() {
    const name = draft.name.trim()
    const value = Number(draft.targetValue)
    if (!name) { setError('Enter a target name.'); return }
    if (targets.some((target) => target.id !== editingId && target.name.toLowerCase() === name.toLowerCase())) { setError('A target with this name already exists.'); return }
    if (!draft.targetValue.trim() || !Number.isFinite(value) || value < 0) { setError('Enter a target value of zero or greater.'); return }
    if (draft.type === 'percentage' && value > 100) { setError('Percentage targets must be between 0 and 100.'); return }
    const fields = compatibleFields(categories, draft.type, draft.fieldId)
    if (draft.fieldId && !fields.some((field) => field.id === draft.fieldId)) { setError('Select a compatible source field.'); return }
    const nextTarget: CustomTarget = { ...draft, name, targetValue: value, ...(draft.description?.trim() ? { description: draft.description.trim() } : {}), ...(draft.categoryId ? { categoryId: draft.categoryId } : {}), ...(draft.fieldId ? { fieldId: draft.fieldId } : {}), order: editingId ? targets.find((target) => target.id === editingId)?.order ?? targets.length + 1 : targets.length + 1, id: editingId ?? crypto.randomUUID() }
    const next = editingId ? targets.map((target) => target.id === editingId ? nextTarget : target) : [...targets, nextTarget]
    publish(next)
    setEditorOpen(false)
    setEditingId(null)
    setError('')
  }

  function moveTarget(id: string, direction: -1 | 1) {
    const items = [...targets]
    const index = items.findIndex((target) => target.id === id)
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= items.length) return
    const [item] = items.splice(index, 1)
    items.splice(targetIndex, 0, item)
    publish(items.map((target, order) => ({ ...target, order: order + 1 })))
  }

  function removeTarget(id: string) {
    publish(targets.filter((target) => target.id !== id).map((target, order) => ({ ...target, order: order + 1 })))
    setError('')
  }

  const sourceFields = compatibleFields(categories, draft.type, draft.fieldId)
  const selectableCategories = categories.filter((category) => category.archived !== true || category.id === draft.categoryId)

  return <section className="custom-measures-panel" aria-labelledby="custom-measures-heading">
    <p className="eyebrow">07 / Measures</p>
    <h2 id="custom-measures-heading">What do you want to measure?</h2>
    <p className="custom-builder-helper">Add optional targets for the numbers that matter to your work.</p>
    <div className="custom-target-list">{targets.length ? targets.map((target, index) => <article className="custom-target-card" key={target.id}>
      <div><h3>{target.name}</h3><p>{TARGET_TYPES[target.type]} · Target: {target.type === 'percentage' ? `${target.targetValue}%` : target.type === 'currency' ? `₦${target.targetValue.toLocaleString()}` : target.targetValue.toLocaleString()}</p>{target.description && <small>{target.description}</small>}</div>
      <div className="custom-category-actions"><button className="text-button" type="button" onClick={() => moveTarget(target.id, -1)} disabled={!index}>Move Up</button><button className="text-button" type="button" onClick={() => moveTarget(target.id, 1)} disabled={index === targets.length - 1}>Move Down</button><button className="text-button" type="button" onClick={() => editTarget(target)}>Edit</button><button className="text-button danger-text-button" type="button" onClick={() => removeTarget(target.id)}>Delete</button></div>
    </article>) : <div className="custom-category-empty"><strong>No targets configured</strong><span>Targets are optional for this template.</span></div>}</div>
    {!editorOpen && <button className="button button-secondary custom-add-category" type="button" onClick={() => editTarget()}>+ Add Target</button>}
    {editorOpen && <div className="custom-category-editor"><h3>Target editor</h3><label><span>Target Name *</span><input autoFocus aria-label="Target Name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label><span>Description</span><textarea aria-label="Target Description" value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label><span>Target Type</span><select aria-label="Target Type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as CustomTargetType, fieldId: undefined })}>{Object.entries(TARGET_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Target Value *</span><input aria-label="Target Value" type="number" min="0" max={draft.type === 'percentage' ? '100' : undefined} value={draft.targetValue} onChange={(event) => setDraft({ ...draft, targetValue: event.target.value })} /></label><label><span>Category</span><select aria-label="Target Category" value={draft.categoryId ?? ''} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value || undefined })}><option value="">All Categories</option>{selectableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.archived ? ' · ARCHIVED' : ''}</option>)}</select></label><label><span>Source Field</span><select aria-label="Target Source Field" value={draft.fieldId ?? ''} onChange={(event) => setDraft({ ...draft, fieldId: event.target.value || undefined })}><option value="">No source field</option>{sourceFields.map((field) => <option key={field.id} value={field.id}>{field.name}{field.archived ? ' · ARCHIVED' : ''} · {field.categoryName}</option>)}</select></label>{error && <p className="custom-builder-error" role="alert">{error}</p>}<button className="button button-primary" type="button" onClick={saveTarget}>Save Target</button><button className="button button-secondary" type="button" onClick={() => setEditorOpen(false)}>Cancel</button></div>}
  </section>
}
