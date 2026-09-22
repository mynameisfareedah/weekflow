import { deriveCustomTargetProgress, formatCustomTargetValue, type CustomTargetProgress } from '../customTargets'
import type { CustomTemplateConfig } from '../types/customTemplate'
import type { DailyActivity } from '../types/dailyActivity'
import './CustomTargetsSummary.css'

type Props = { config: CustomTemplateConfig; activities: DailyActivity[]; title?: string }

function renderActual(progress: CustomTargetProgress) {
  return progress.actual === null ? 'No data' : formatCustomTargetValue(progress.actual, progress.target.type)
}

export default function CustomTargetsSummary({ config, activities, title = 'Weekly Targets' }: Props) {
  const progress = [...config.targets].sort((left, right) => left.order - right.order).map((target) => deriveCustomTargetProgress(target, activities))
  return <section className="custom-target-summary" aria-labelledby="custom-target-summary-heading">
    <div className="custom-target-summary-heading"><div><p className="eyebrow">Measures</p><h2 id="custom-target-summary-heading">{title}</h2></div><span>{progress.length} target{progress.length === 1 ? '' : 's'}</span></div>
    {progress.length === 0 ? <p className="custom-target-summary-empty">No targets configured for this template.</p> : <div className="custom-target-summary-list">{progress.map((item) => <article className="custom-target-summary-card" key={item.target.id}><div className="custom-target-summary-card-heading"><div><h3>{item.target.name}</h3>{item.target.description && <p>{item.target.description}</p>}</div><strong>{item.status}</strong></div><div className="custom-target-summary-values"><span>Actual: {renderActual(item)}</span><span>Target: {formatCustomTargetValue(item.target.targetValue, item.target.type)}</span><span>Progress: {item.progress === null ? 'Not applicable' : `${item.progress.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`}</span></div>{item.progress !== null && <div className="custom-target-progress-track" aria-label={`${item.target.name} progress`}><span style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }} /></div>}</article>)}</div>}
  </section>
}
