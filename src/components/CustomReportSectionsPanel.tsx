import { useState } from 'react'
import type { CustomCategory, CustomReportSection, CustomReportSectionType } from '../types/customTemplate'

const TYPE_LABELS: Record<CustomReportSectionType, string> = {
  'weekly-summary': 'Weekly Summary',
  activities: 'Activities',
  category: 'Category',
  targets: 'Targets & Measurements',
  'follow-ups': 'Follow-Ups',
  review: 'Review',
  'next-week': 'Next Week',
  custom: 'Custom',
}

type Draft = { name: string; description: string; type: CustomReportSectionType; categoryId?: string; showInReport: boolean }

type Props = { sections: CustomReportSection[]; categories: CustomCategory[] }

export default function CustomReportSectionsPanel({ sections: initialSections, categories }: Props) {
  const [sections, setSections] = useState<CustomReportSection[]>(() => [...initialSections].sort((left, right) => left.order - right.order))
  const [draft, setDraft] = useState<Draft>({ name: '', description: '', type: 'custom', categoryId: undefined, showInReport: true })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [error, setError] = useState('')

  function publish(next: CustomReportSection[]) {
    setSections(next)
    window.dispatchEvent(new CustomEvent('weekflow-custom-report-sections-change', { detail: next }))
  }

  function editSection(section?: CustomReportSection, type: CustomReportSectionType = 'custom', categoryId?: string) {
    setEditingId(section?.id ?? null)
    setDraft(section ? { name: section.name, description: section.description ?? '', type: section.type, categoryId: section.categoryId, showInReport: section.showInReport } : { name: type === 'category' ? categories.find((category) => category.id === categoryId)?.name ?? '' : '', description: '', type, categoryId, showInReport: true })
    setEditorOpen(true)
    setError('')
  }

  function saveSection() {
    const name = draft.name.trim()
    if (!name) { setError('Enter a report section name.'); return }
    if (sections.some((section) => section.id !== editingId && section.name.trim().toLowerCase() === name.toLowerCase())) { setError('A report section with this name already exists.'); return }
    if (draft.type === 'category' && !draft.categoryId) { setError('Choose a category.'); return }
    const nextSection: CustomReportSection = { ...draft, name, ...(draft.description.trim() ? { description: draft.description.trim() } : {}), ...(draft.categoryId ? { categoryId: draft.categoryId } : {}), id: editingId ?? crypto.randomUUID(), order: editingId ? sections.find((section) => section.id === editingId)?.order ?? sections.length + 1 : sections.length + 1 }
    publish(editingId ? sections.map((section) => section.id === editingId ? nextSection : section) : [...sections, nextSection])
    setEditorOpen(false)
    setEditingId(null)
    setError('')
  }

  function moveSection(id: string, direction: -1 | 1) {
    const items = [...sections]
    const index = items.findIndex((section) => section.id === id)
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const [item] = items.splice(index, 1)
    items.splice(target, 0, item)
    publish(items.map((section, order) => ({ ...section, order: order + 1 })))
  }

  function removeSection(id: string) {
    publish(sections.filter((section) => section.id !== id).map((section, order) => ({ ...section, order: order + 1 })))
    setError('')
  }

  return <section className="custom-report-sections-panel" aria-labelledby="custom-report-sections-heading">
    <p className="eyebrow">08 / Report</p>
    <h2 id="custom-report-sections-heading">What should your weekly report contain?</h2>
    <p className="custom-builder-helper">Choose and arrange the sections that matter to your work.</p>
    <div className="custom-report-section-list">{sections.length ? sections.map((section, index) => <article className="custom-report-section-card" key={section.id}><div><h3>{section.name}</h3><p>{TYPE_LABELS[section.type]}{section.type === 'category' && section.categoryId ? ` · ${categories.find((category) => category.id === section.categoryId)?.name ?? 'Category unavailable'}` : ''}</p></div><div className="custom-category-actions"><button className="text-button" type="button" onClick={() => moveSection(section.id, -1)} disabled={!index}>Move Up</button><button className="text-button" type="button" onClick={() => moveSection(section.id, 1)} disabled={index === sections.length - 1}>Move Down</button><button className="text-button" type="button" onClick={() => editSection(section)}>Edit</button><button className="text-button danger-text-button" type="button" onClick={() => removeSection(section.id)}>Delete</button></div></article>) : <div className="custom-category-empty"><strong>No report sections configured</strong><span>Add the sections that matter to your weekly review.</span></div>}</div>
    {!editorOpen && <div className="custom-report-section-actions"><button className="button button-secondary custom-add-category" type="button" onClick={() => editSection()}>+ Add Custom Section</button><button className="button button-secondary custom-add-category" type="button" onClick={() => editSection(undefined, 'category', categories.find((category) => category.showInReporting && category.archived !== true)?.id)}>+ Add Category Section</button></div>}
    {editorOpen && <div className="custom-category-editor"><h3>Report section editor</h3><label><span>Section Name *</span><input autoFocus aria-label="Report Section Name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label><span>Description</span><textarea aria-label="Report Section Description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label><span>Section Type</span><select aria-label="Report Section Type" value={draft.type} disabled={Boolean(editingId)} onChange={(event) => setDraft({ ...draft, type: event.target.value as CustomReportSectionType, categoryId: event.target.value === 'category' ? draft.categoryId : undefined })}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{draft.type === 'category' && <label><span>Category</span><select aria-label="Report Section Category" value={draft.categoryId ?? ''} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value || undefined })}><option value="">Choose category</option>{categories.filter((category) => (category.showInReporting && category.archived !== true) || category.id === draft.categoryId).map((category) => <option key={category.id} value={category.id}>{category.name}{category.archived ? ' · ARCHIVED' : ''}</option>)}</select></label>}<label className="custom-inline-toggle"><input type="checkbox" checked={draft.showInReport} onChange={(event) => setDraft({ ...draft, showInReport: event.target.checked })} />Show in report</label>{error && <p className="custom-builder-error" role="alert">{error}</p>}<button className="button button-primary" type="button" onClick={saveSection}>Save Section</button><button className="button button-secondary" type="button" onClick={() => setEditorOpen(false)}>Cancel</button></div>}
  </section>
}
