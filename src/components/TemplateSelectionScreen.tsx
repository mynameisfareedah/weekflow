import { useState } from 'react'
import { getAvailableTemplates } from '../config/templates'
import { getSelectedTemplateId, saveSelectedTemplateId } from '../storage/templateStorage'
import TemplateIcon, { AppIcon } from './TemplateIcon'
import './TemplateSelectionScreen.css'

interface TemplateSelectionScreenProps {
  onSelect: () => void
}

const TEMPLATE_GROUPS = [
  {
    title: 'Business & Operations',
    ids: ['field-sales', 'field-service', 'small-business', 'project-management'],
  },
  {
    title: 'People & Impact',
    ids: ['ngo-community', 'education'],
  },
  {
    title: 'Personal',
    ids: ['personal'],
  },
  {
    title: 'Build Your Own',
    ids: ['custom'],
  },
] as const

export default function TemplateSelectionScreen({ onSelect }: TemplateSelectionScreenProps) {
  const [selectedId, setSelectedId] = useState(getSelectedTemplateId)
  const templates = getAvailableTemplates()
  const templateMap = new Map(templates.map((template) => [template.id, template]))

  function chooseTemplate(templateId: string) {
    if (!saveSelectedTemplateId(templateId)) return
    setSelectedId(templateId)
    onSelect()
  }

  return (
    <main className="template-selection-screen">
      <div className="template-selection-intro">
        <p className="eyebrow">Workflow</p>
        <h1>Choose the workflow that best matches how you work.</h1>
      </div>

      <div className="template-selection-groups">
        {TEMPLATE_GROUPS.map((group) => (
          <section className="template-group" key={group.title} aria-labelledby={`${group.title.toLowerCase().replace(/[^a-z]+/g, '-')}-heading`}>
            <div className="template-group-header">
              <h2 id={`${group.title.toLowerCase().replace(/[^a-z]+/g, '-')}-heading`}>{group.title}</h2>
            </div>
            <div className="template-selection-grid">
              {group.ids.map((templateId) => {
                const template = templateMap.get(templateId)
                if (!template) return null
                const isSelected = template.id === selectedId
                return (
                  <article className={`template-option${isSelected ? ' is-selected' : ''}${template.id === 'field-sales' ? ' is-featured' : ''}`} key={template.id}>
                    <div className="template-option-topline"><span className="template-option-mark"><TemplateIcon templateId={template.id} /></span><span className="template-option-status">{template.availability === 'available' ? 'Available' : 'Foundation ready'}</span></div>
                    {template.id === 'field-sales' && <span className="template-option-featured">Featured</span>}
                    <h2>{template.name}</h2>
                    <p>{template.description}</p>
                    <button className="button button-primary" type="button" onClick={() => chooseTemplate(template.id)}>{isSelected ? 'Selected' : 'Use this workflow'} <AppIcon name="arrow-right" /></button>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}