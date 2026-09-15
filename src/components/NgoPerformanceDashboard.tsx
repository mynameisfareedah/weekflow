import type { NgoPerformance } from '../report/ngoPerformance'
import './NgoPerformanceDashboard.css'

function displayNumber(value: number | null) {
  return value === null ? 'Not recorded' : String(value)
}

function displayVariance(value: number | null) {
  if (value === null) return 'Not available'
  return value > 0 ? `+${value}` : String(value)
}

export default function NgoPerformanceDashboard({ performance, onNavigate }: { performance: NgoPerformance; onNavigate: (screen: string) => void }) {
  if (performance.empty) {
    return <section className="ngo-performance-dashboard ngo-performance-empty" aria-labelledby="ngo-performance-heading">
      <div className="ngo-performance-heading"><div><p className="eyebrow">Programme Performance</p><h2 id="ngo-performance-heading">No programme activity recorded yet</h2><p>Start by recording today&apos;s programme activity.</p></div></div>
      <button className="button button-secondary" type="button" onClick={() => onNavigate('daily-activity')}>Record activity</button>
    </section>
  }

  return <section className="ngo-performance-dashboard" aria-labelledby="ngo-performance-heading">
    <div className="ngo-performance-heading"><div><p className="eyebrow">Programme Performance</p><h2 id="ngo-performance-heading">This week&apos;s delivery at a glance</h2></div><strong className={`ngo-performance-status is-${performance.status.toLowerCase().replace(/\s+/g, '-')}`}>{performance.status}</strong></div>
    <div className="ngo-performance-sections">
      <section className="ngo-performance-section" aria-labelledby="ngo-delivery-heading"><h3 id="ngo-delivery-heading">Programme Delivery</h3><div className="ngo-performance-stat-row"><div><span>Planned</span><strong>{performance.plannedActivities}</strong></div><div><span>Completed</span><strong>{performance.completedActivities}</strong></div><div><span>Carried forward</span><strong>{performance.carriedForwardActivities}</strong></div><div><span>Completion</span><strong>{performance.completionRate === null ? 'Not available' : `${performance.completionRate.toFixed(0)}%`}</strong></div></div></section>
      <section className="ngo-performance-section" aria-labelledby="ngo-reach-heading"><h3 id="ngo-reach-heading">Community Reach</h3><div className="ngo-performance-stat-row"><div><span>Target</span><strong>{displayNumber(performance.plannedReach)}</strong></div><div><span>Actual</span><strong>{displayNumber(performance.actualReach)}</strong></div><div><span>Variance</span><strong>{displayVariance(performance.reachVariance)}</strong></div></div></section>
      <section className="ngo-performance-section" aria-labelledby="ngo-follow-up-heading"><h3 id="ngo-follow-up-heading">Follow-ups</h3><div className="ngo-performance-stat-row"><div><span>Open</span><strong>{performance.openFollowUps}</strong></div><div><span>Completed</span><strong>{performance.completedFollowUps}</strong></div><div><span>Overdue</span><strong>{performance.overdueFollowUps}</strong></div></div></section>
      <section className="ngo-performance-section" aria-labelledby="ngo-evidence-heading"><h3 id="ngo-evidence-heading">Evidence & Monitoring</h3><div className="ngo-performance-stat-row"><div><span>Objectives with evidence</span><strong>{performance.objectivesWithEvidence} / {performance.objectivesPlanned}</strong></div><div><span>Outputs recorded</span><strong>{performance.outputsWithEvidence}</strong></div><div><span>Outcome evidence</span><strong>{performance.outcomeEvidence}</strong></div><div><span>Evidence pending</span><strong>{performance.outcomeEvidencePending + performance.evidenceGaps}</strong></div></div></section>
      <section className="ngo-performance-section" aria-labelledby="ngo-engagement-heading"><h3 id="ngo-engagement-heading">Engagement & Logistics</h3><div className="ngo-performance-stat-row"><div><span>Stakeholder engagements</span><strong>{performance.stakeholderEngagements}</strong></div><div><span>Actions requiring follow-up</span><strong>{performance.stakeholderActions}</strong></div><div><span>Resource issues</span><strong>{performance.resourceIssues.length}</strong></div></div></section>
      {(performance.issues.length > 0 || performance.objectivesRequiringAction > 0) && <section className="ngo-performance-section ngo-performance-attention" aria-labelledby="ngo-attention-heading"><div><h3 id="ngo-attention-heading">Needs attention</h3><ul>{performance.issues.slice(0, 3).map((issue) => <li key={issue}>{issue}</li>)}{performance.objectivesRequiringAction > 0 && <li>{performance.objectivesRequiringAction} objective{performance.objectivesRequiringAction === 1 ? '' : 's'} still require evidence or action.</li>}</ul></div><button className="button button-secondary" type="button" onClick={() => onNavigate(performance.openFollowUps > 0 ? 'follow-ups' : 'report')}>{performance.openFollowUps > 0 ? 'Review follow-ups' : 'Review report'}</button></section>}
    </div>
  </section>
}
