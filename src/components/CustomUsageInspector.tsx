import { useCallback, useEffect, useState } from 'react'
import type { CustomUsageActivityDetail } from '../storage/dailyActivityStorage'
import { AppIcon } from './TemplateIcon'

type Props = {
  definitionName: string
  definitionType: 'category' | 'field'
  usageCount: number
  affectedWeekCount: number
  statusNames: Record<string, string>
  loadDetails: () => Promise<CustomUsageActivityDetail[]>
  onClose: () => void
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function formatWeek(value: string) {
  const start = new Date(`${value}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  return `${formatter.format(start)} - ${formatter.format(end)}`
}

function formatValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ')
  if (value === undefined) return ''
  return String(value)
}

export default function CustomUsageInspector({ definitionName, definitionType, usageCount, affectedWeekCount, statusNames, loadDetails, onClose }: Props) {
  const [details, setDetails] = useState<CustomUsageActivityDetail[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setState('loading')
    try {
      setDetails(await loadDetails())
      setState('ready')
    } catch {
      setState('error')
    }
  }, [loadDetails])

  useEffect(() => {
    void load(false)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [load, onClose])

  const activityLabel = usageCount === 1 ? '1 activity' : `${usageCount} activities`
  const weekLabel = affectedWeekCount === 1 ? '1 week' : `${affectedWeekCount} weeks`

  return (
    <div className="workspace-modal-backdrop custom-usage-inspector-backdrop" role="dialog" aria-modal="true" aria-labelledby="custom-usage-inspector-title">
      <section className="workspace-modal custom-usage-inspector" aria-busy={state === 'loading'}>
        <div className="workspace-modal-header">
          <div>
            <p className="eyebrow">Used-in Inspector</p>
            <h2 id="custom-usage-inspector-title">{definitionName}</h2>
          </div>
          <button type="button" className="workspace-modal-close" onClick={onClose} aria-label="Close used-in inspector"><AppIcon name="close" /></button>
        </div>
        <p className="workspace-modal-intro">Used in {activityLabel} across {weekLabel}.</p>
        {state === 'loading' && <p className="custom-usage-inspector-state" role="status">Loading activity usage...</p>}
        {state === 'error' && <div className="custom-usage-inspector-state"><p role="alert">Couldn&apos;t load activity usage.</p><button type="button" className="text-button" onClick={() => void load()}>Retry</button></div>}
        {state === 'ready' && details.length === 0 && <p className="custom-usage-inspector-state">No matching activities found.</p>}
        {state === 'ready' && details.length > 0 && <div className="custom-usage-activity-list" role="list" aria-label={`${definitionType} usage activities`}>
          {details.map((activity) => (
            <article className="custom-usage-activity" key={`${activity.activityId}-${activity.weekStart}`} role="listitem">
              <div className="custom-usage-activity-main">
                <div className="custom-usage-activity-title"><h3>{activity.activityTitle}</h3><span>{activity.activityType}</span></div>
                <p>{formatDate(activity.date)} · Week of {formatWeek(activity.weekStart)}</p>
                {activity.customStatusId && <p>Status: {statusNames[activity.customStatusId] ?? activity.customStatusId}</p>}
                {definitionType === 'field' && <p className="custom-usage-field-value">Saved value: <strong>{formatValue(activity.customFieldValue)}</strong></p>}
              </div>
            </article>
          ))}
        </div>}
      </section>
    </div>
  )
}
