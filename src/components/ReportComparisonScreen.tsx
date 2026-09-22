import type { ReportComparison, ComparisonValue } from '../report/reportComparison'
import { navigateTo } from '../utils/navigation'
import './ReportComparisonScreen.css'

function formatWeek(weekKey: string) {
  const start = new Date(`${weekKey}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)} - ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)}`
}

function valueLabel(value: ComparisonValue) {
  if (value.state === 'no-data') return 'No data'
  if (value.state === 'not-applicable') return 'Not applicable'
  if (value.state === 'unsupported') return 'Not available'
  return String(value.value ?? 'No data')
}

function deltaLabel(delta?: number) {
  if (delta === undefined) return 'Not comparable'
  return delta > 0 ? `+${delta}` : String(delta)
}

function ReportColumn({ label, weekKey, templateName, onOpen }: { label: string; weekKey: string; templateName: string; onOpen: () => void }) {
  return <div className="comparison-report-column"><span className="eyebrow">{label}</span><h2>{formatWeek(weekKey)}</h2><p>{templateName}</p><button className="button button-secondary" type="button" onClick={onOpen}>Open Report</button></div>
}

export default function ReportComparisonScreen({ comparison }: { comparison: ReportComparison }) {
  const openReport = (weekKey: string) => navigateTo(`/report?historyWeek=${encodeURIComponent(weekKey)}`)
  return <main className="report-comparison-screen">
    <header className="report-comparison-header">
      <div><p className="eyebrow">Report History</p><h1>Report Comparison</h1><p>Read-only comparison of two saved historical report snapshots.</p></div>
      <button className="text-button" type="button" onClick={() => navigateTo('/report-history')}>Back to Report History</button>
    </header>
    <section className="comparison-report-pair" aria-label="Reports being compared">
      <ReportColumn label="Report A" weekKey={comparison.baseline.weekKey} templateName={comparison.baseline.template?.name ?? 'Template unavailable'} onOpen={() => openReport(comparison.baseline.weekKey)} />
      <ReportColumn label="Report B" weekKey={comparison.comparison.weekKey} templateName={comparison.comparison.template?.name ?? 'Template unavailable'} onOpen={() => openReport(comparison.comparison.weekKey)} />
    </section>
    <section aria-labelledby="comparison-metrics-heading"><div className="comparison-section-heading"><div><p className="eyebrow">Summary metrics</p><h2 id="comparison-metrics-heading">Recorded values</h2></div></div><div className="comparison-metrics" role="table" aria-label="Comparison metrics"><div className="comparison-metric-row comparison-metric-header" role="row"><span role="columnheader">Metric</span><span role="columnheader">Report A</span><span role="columnheader">Report B</span><span role="columnheader">Difference</span></div>{comparison.metrics.map((metric) => <div className="comparison-metric-row" role="row" key={metric.key}><strong role="rowheader">{metric.label}</strong><span role="cell">{valueLabel(metric.baseline)}</span><span role="cell">{valueLabel(metric.comparison)}</span><span role="cell">{metric.delta === undefined ? 'Not comparable' : deltaLabel(metric.delta)}</span></div>)}</div></section>
    <section aria-labelledby="comparison-sections-heading"><div className="comparison-section-heading"><div><p className="eyebrow">Report sections</p><h2 id="comparison-sections-heading">Evidence by section</h2></div></div><div className="comparison-sections">{comparison.sections.map((section) => <article className="comparison-section" key={section.id}><h3>{section.title}</h3><div className="comparison-section-columns"><div><strong>Report A</strong><p>{section.baseline.content}</p></div><div><strong>Report B</strong><p>{section.comparison.content}</p></div></div></article>)}</div></section>
  </main>
}
