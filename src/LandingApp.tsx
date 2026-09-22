import { useEffect, useState } from 'react'
import logoImage from './assets/weekflow-logo.png'
import TemplateIcon, { AppIcon } from './components/TemplateIcon'
import { getAvailableTemplates } from './config/templates'
import './landing.css'

const landingWorkflowDemos = [
  { id: 'field-sales', name: 'Pharma Field Sales', status: 'Ready to review', planned: 12, activities: 18, followUps: 5, plan: ['UPTH Urology/Oncology', 'RSUTH', 'Peter Odili Cardiovascular & Cancer Hospital', 'Shalom Medical Center'], activity: ['UPTH Urology/Oncology', 'RSUTH', 'Peter Odili Hospital'], followThrough: '5 actions remain visible' },
  { id: 'small-business', name: 'Small Business', status: 'On track', planned: 9, activities: 14, followUps: 4, plan: ['Customer meetings', 'Orders', 'Supplier activity', 'Sales priorities'], activity: ['Customer Meeting', 'Sales Activity', 'Order Processing'], followThrough: '4 actions remain visible' },
  { id: 'personal', name: 'Personal Productivity', status: 'Making progress', planned: 8, activities: 11, followUps: 3, plan: ['Personal goals', 'Important tasks', 'Weekly priorities'], activity: ['Morning planning', 'Priority task', 'Personal errand', 'Follow-up'], followThrough: '3 actions remain visible' },
  { id: 'project-management', name: 'Project Management', status: 'Ready to review', planned: 10, activities: 16, followUps: 4, plan: ['Project deliverables', 'Stakeholder updates', 'Project priorities', 'Risks and blockers'], activity: ['Project task', 'Stakeholder meeting', 'Deliverable review'], followThrough: '4 actions remain visible' },
  { id: 'field-service', name: 'Field Operations', status: 'On track', planned: 11, activities: 15, followUps: 6, plan: ['Site visits', 'Inspections', 'Service jobs', 'Equipment checks'], activity: ['Site visit', 'Inspection', 'Service job'], followThrough: '6 actions remain visible' },
  { id: 'ngo-community', name: 'NGO & Community Work', status: 'Making progress', planned: 8, activities: 13, followUps: 4, plan: ['Community outreach', 'Beneficiary engagement', 'Partner coordination', 'Programme activities'], activity: ['Community visit', 'Beneficiary engagement', 'Partner meeting'], followThrough: '4 actions remain visible' },
  { id: 'education', name: 'Education', status: 'On track', planned: 9, activities: 14, followUps: 3, plan: ['Lesson planning', 'Student activities', 'Assessment', 'Academic priorities'], activity: ['Lesson preparation', 'Student session', 'Assessment review'], followThrough: '3 actions remain visible' },
  { id: 'custom', name: 'Custom', status: 'Ready to shape', planned: 6, activities: 9, followUps: 2, plan: ['Custom priorities', 'Key outcomes', 'Important work'], activity: ['Work session', 'Progress update', 'Next action'], followThrough: '2 actions remain visible' },
] as const

function AnimatedLandingPreview() {
  const [activeIndex, setActiveIndex] = useState(0)
  const demo = landingWorkflowDemos[activeIndex]

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % landingWorkflowDemos.length), 5600)
    return () => window.clearInterval(timer)
  }, [])

  return <div className="landing-preview-wrap landing-preview-carousel" aria-label={`${demo.name} WeekFlow product preview`}>
    <div className="landing-demo-selector"><span>TEMPLATES</span><div className="landing-demo-options">{landingWorkflowDemos.map((item, index) => <button type="button" className={index === activeIndex ? 'is-active' : ''} onClick={() => setActiveIndex(index)} key={item.id} aria-label={`Show ${item.name}`}><TemplateIcon templateId={item.id} /><span>{item.name}</span></button>)}</div></div>
    <div className="landing-product-preview landing-product-preview-live" key={demo.id}><div className="preview-window-bar"><span className="preview-dots"><i /><i /><i /></span><span>WeekFlow</span><span className="preview-week">Week of Aug 10 - Aug 16</span></div><div className="preview-body"><aside><strong>WeekFlow</strong><span className="preview-active">Overview</span><span>Weekly Plan</span><span>Daily Activity</span><span>Follow-ups</span><span>Report</span></aside><div className="preview-main"><div className="preview-heading"><div><small>{demo.name}</small><h2>Your week at a glance.</h2></div><b>{demo.status}</b></div><div className="preview-metrics"><div><small>Planned</small><strong>{demo.planned}</strong></div><div><small>Activities</small><strong>{demo.activities}</strong></div><div><small>Follow-ups</small><strong>{demo.followUps}</strong></div></div><div className="preview-content-grid"><div className="preview-plan"><small>Weekly Plan</small>{demo.plan.map((item) => <strong key={item}>{item}</strong>)}</div><div className="preview-followups"><small>Daily Activity</small>{demo.activity.map((item) => <strong key={item}>{item}</strong>)}<span className="preview-pill">{demo.followThrough}</span></div></div></div></div></div>
  </div>
}

export default function LandingApp() {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('.landing-reveal')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      }
    }), { threshold: 0.12 })
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  const templateGroups = [
    { label: 'Business & Operations', ids: ['field-sales', 'field-service', 'small-business', 'project-management'] },
    { label: 'People & Impact', ids: ['ngo-community', 'education'] },
    { label: 'Personal', ids: ['personal'] },
    { label: 'Build Your Own', ids: ['custom'] },
  ]
  const templateById = new Map(getAvailableTemplates().map((template) => [template.id, template]))
  const weekRhythm = [
    ['01', 'PLAN', 'Weekly Plan', 'Set objectives and organise the work ahead.'],
    ['02', 'ACTIVITY', 'Daily Activity', 'Capture what actually happened during the week.'],
    ['03', 'FOLLOW-UP', 'Follow-ups', 'Keep unresolved actions visible until they are done.'],
    ['04', 'REVIEW', 'Generate Report', 'Review progress, outcomes, intelligence, and readiness.'],
    ['05', 'REPORT', 'Report History', 'Keep a useful record of completed weeks and reports.'],
  ]
  const goTo = (path: string) => { window.location.assign(path) }

  return <main className="landing-page">
    <AnimatedLandingPreview />
    <nav className="landing-nav"><a className="landing-brand" href="/" aria-label="WeekFlow home"><img src={logoImage} alt="WeekFlow mark" /><span className="landing-wordmark">WeekFlow</span></a><div className="landing-nav-actions"><a className="landing-support-link" href="/support">Support</a><a className="landing-support-link" href="/contact">Contact</a><button type="button" className="landing-sign-in" onClick={() => goTo('/sign-in')}>Sign In</button><button type="button" className="button button-primary landing-nav-cta" onClick={() => goTo('/sign-up')}>Create a free account</button></div></nav>
    <section className="landing-hero"><div className="landing-hero-copy"><p className="landing-eyebrow">Your week, working better</p><h1>Plan your week.<br /><em>Stay on top of the work.</em></h1><p className="landing-hero-text">WeekFlow brings your weekly plans, daily activity, follow-ups, review, and reporting into one simple workspace.</p></div><div className="landing-hero-story" aria-hidden="true"><article className="landing-hero-card landing-hero-card-plan"><span className="landing-hero-card-mark">P</span><strong>Weekly Plan</strong><p>3 priorities planned</p></article><article className="landing-hero-card landing-hero-card-activity"><span className="landing-hero-card-mark">A</span><strong>Activity captured</strong><p>Client meeting</p><small>Outcome recorded</small></article><article className="landing-hero-card landing-hero-card-followup"><span className="landing-hero-card-mark">F</span><strong>Follow-up added</strong><p>Confirm next action</p><small>Due Friday</small></article><article className="landing-hero-card landing-hero-card-report"><span className="landing-hero-card-mark">R</span><strong>Report ready</strong><p>Weekly report generated</p></article></div></section>
    <section className="landing-section landing-workflow" id="week-rhythm"><div className="landing-section-heading"><p className="landing-eyebrow">The WeekFlow rhythm</p><h2>One week. One clear rhythm.</h2><p>Plan. Work. Follow through. Review. Report.</p></div><div className="landing-orbit-window" aria-label="WeekFlow rhythm stages"><div className="landing-orbit-ring" aria-hidden="true" />{weekRhythm.map(([number, label, title, description], index) => <article className="landing-orbit-card" style={{ ['--orbit-delay' as string]: `${index * -4}s` }} key={number}><span>{number}</span><small>{label}</small><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <section className="landing-story landing-story-activity landing-reveal"><div className="landing-story-visual landing-activity-visual"><div className="story-window-label">Planned work <span>Actual activity</span></div><div className="story-flow-step"><b>Weekly Plan</b><span>Planned priorities</span></div><div className="story-flow-arrow"><AppIcon name="arrow-down" /></div><div className="story-flow-step is-active"><b>Daily Activity</b><span>What actually happened</span></div><div className="story-outcome-row"><span>Outcome</span><span>Intelligence</span><span>Next Action</span></div></div><div className="landing-story-copy"><p className="landing-eyebrow">Product in action</p><h2>Turn the plan into real work.</h2><p>Start the week knowing what matters. Capture what actually happens as the work unfolds.</p></div></section>
    <section className="landing-story landing-story-followups landing-reveal"><div className="landing-story-copy"><p className="landing-eyebrow">Follow-ups</p><h2>Don't let important work disappear.</h2><p>Keep unresolved actions visible until they're complete.</p></div><div className="landing-story-visual landing-followups-visual"><div className="story-window-label">Follow-ups <span>Open work</span></div><div className="story-followup-row"><span className="story-dot is-open" /><strong>Confirm account next action</strong><small>Priority</small></div><div className="story-followup-row"><span className="story-dot is-open" /><strong>Share outcome with team</strong><small>Due this week</small></div><div className="story-followup-row is-complete"><span className="story-dot is-done"><AppIcon name="check" /></span><strong>Complete follow-up</strong><small>Completed</small></div></div></section>
    <section className="landing-feature-band landing-reveal"><div><p className="landing-eyebrow">Smart Start</p><h2>Start the next week with less work to rebuild.</h2><p>Carry forward the unfinished work that still matters. Leave completed work behind.</p></div><div className="landing-smart-visual"><div><small>Last week</small><span>[done] Completed work</span><span>[done] Completed follow-ups</span><b>-&gt; Unfinished priorities</b></div><div className="smart-start-bridge"><span>Smart Start</span><b>select what still matters</b></div><div><small>New week</small><b>-&gt; Carry forward what still matters</b></div></div></section>
    <section className="landing-section landing-reporting landing-reveal"><div className="landing-section-heading"><p className="landing-eyebrow">Reporting</p><h2>Turn the week's work into a finished report.</h2><p>Bring together what you planned, what happened, what changed, and what still needs attention.</p></div><div className="landing-report-preview"><div><strong>Weekly Activity</strong><span>Activities Summary</span><span>Daily Activity Breakdown</span><span>Key Outcomes</span></div><div className="report-transform"><b>WeekFlow Review</b><span>-&gt;</span><strong>Professional Report</strong><small>Export professional Word documents.</small></div></div></section>
    <section className="landing-section landing-templates landing-reveal" id="templates"><div className="landing-section-heading"><p className="landing-eyebrow">Built for different kinds of work</p><h2>One platform. Different kinds of work.</h2><p>Choose a workflow that fits how you work.</p></div><div className="landing-template-groups">{templateGroups.map((group) => <div className="landing-template-group landing-stagger" key={group.label}><h3>{group.label}</h3><div>{group.ids.map((id) => { const template = templateById.get(id); return template ? <article key={id}><span className="landing-template-icon"><TemplateIcon templateId={template.id} /></span><strong>{template.name}</strong><p>{template.description}</p></article> : null })}</div></div>)}</div></section>
    <section className="landing-section landing-workspaces landing-reveal"><div className="landing-split-copy"><p className="landing-eyebrow">Your work. Your workspaces.</p><h2>Keep every workflow in its place.</h2><p>Keep different kinds of work organised without mixing their workflows.</p></div><div className="landing-workspace-examples"><article><span>Field Sales Workspace</span><strong>Pharma Field Sales</strong><small>Plans, activity, accounts, follow-ups</small></article><article><span>Small Business Workspace</span><strong>Small Business</strong><small>Customers, sales, orders, priorities</small></article><article><span>Personal Goals</span><strong>Personal Productivity</strong><small>Goals, tasks, routines, next actions</small></article></div></section>
    <section className="landing-final-cta"><h2>Make every week easier to run.</h2><p>Start with a free WeekFlow account.</p><div><button type="button" className="button button-primary landing-large-cta" onClick={() => goTo('/sign-up')}>Create a free account <AppIcon name="arrow-right" /></button><button type="button" className="landing-secondary-cta" onClick={() => goTo('/sign-in')}>Already have an account? Sign in</button></div></section>
    <footer className="landing-footer"><div><div className="landing-footer-brand"><img src={logoImage} alt="WeekFlow mark" /><span className="landing-wordmark">WeekFlow</span></div><p>Plan your week. Stay on top of the work.</p></div><div><a href="#week-rhythm">The rhythm</a><a href="#templates">Workflows</a><a href="/workspaces">Your Workflows</a><a href="/guides">Guides</a><a href="/support">Support</a><a href="/contact">Contact</a></div><small>(c) {new Date().getFullYear()} WeekFlow</small></footer>
  </main>
}