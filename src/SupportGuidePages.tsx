import LandingShootingStars from './LandingShootingStars'
import { navigateTo } from './utils/navigation'
import logoImage from './assets/weekflow-logo.png'

function SupportPageFrame({ title, subtitle, children, backHref = '/support' }: { title: string; subtitle: string; children: React.ReactNode; backHref?: string }) {
  return (
    <main className="support-page support-help-page">
      <LandingShootingStars />
      <div className="support-page-shell support-help-shell">
        <nav className="support-nav">
          <a className="support-brand" href="/" aria-label="WeekFlow home" onClick={(event) => { event.preventDefault(); navigateTo('/') }}>
            <img className="support-brand-mark" src={logoImage} alt="" />
            <span>WeekFlow</span>
          </a>
          <a className="support-back-link" href={backHref} onClick={(event) => { event.preventDefault(); navigateTo(backHref) }}>Back to Support</a>
        </nav>

        <header className="support-header support-help-header">
          <p className="support-eyebrow">Help & support</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>

        {children}
      </div>
    </main>
  )
}

const workflowSteps = [
  {
    title: '1. Choose your workspace',
    body: 'A workspace is where your work, reporting weeks, plans, activities, follow-ups, and saved reports live together. It gives your team or project a clear home for the work being tracked.',
  },
  {
    title: '2. Choose a template',
    body: 'WeekFlow includes purpose-built templates for different kinds of work. The selected template shapes the terminology, planning structure, activity fields, and report sections you see in that workspace.',
  },
  {
    title: '3. Select your week',
    body: 'WeekFlow organizes work around reporting weeks so you can plan, work, review, and report in a consistent rhythm.',
  },
  {
    title: '4. Plan your week',
    body: 'Weekly Plan is where you capture the work you intend to do. This includes objectives, priorities, planned activities, and planned outcomes where relevant. Weekly Plan is about intention: what you expect to accomplish.',
  },
  {
    title: '5. Capture what actually happened',
    body: 'Daily Activity records what actually happened during the week. This keeps your plan and your execution separate, so you can compare what was intended with what was completed.',
  },
  {
    title: '6. Add follow-ups',
    body: 'Follow-ups capture unresolved items that still need attention. These can include tasks, priorities, due dates, contact context, notes, and the source activity or record they came from. You can track whether they are open or completed.',
  },
  {
    title: '7. Review your week',
    body: 'Generate Report brings together the information captured during the week into the report structure defined by your selected template. Report readiness helps you quickly see whether the week has enough information to generate a useful report.',
  },
  {
    title: '8. Generate and export your report',
    body: 'Once the report is ready, WeekFlow can produce the report output using the existing report data. Where supported by the current application, you can export the report in the available formats for your workflow.',
  },
  {
    title: '9. Continue into the next week',
    body: 'Smart Start can carry relevant unfinished work into a new week, helping you apply the most useful previous context without copying the whole prior week. Completed activities and completed follow-ups are not automatically created as new work.',
  },
] as const

const templateCards = [
  {
    name: 'Pharma Field Sales',
    description: 'For field-based pharmaceutical sales teams managing account coverage, HCP engagement, activities, follow-ups, commercial intelligence, and weekly reporting.',
  },
  {
    name: 'Field Operations',
    description: 'For teams managing jobs, dispatch, field visits, equipment, issues, resolutions, parts, customer concerns, follow-ups, and operational reporting.',
  },
  {
    name: 'Project Management',
    description: 'For managing projects, tasks, deliverables, risks, blockers, decisions, stakeholder updates, and weekly progress.',
  },
  {
    name: 'Small Business',
    description: 'For small business owners and teams managing customers, tasks, orders, suppliers, invoices, deliveries, and follow-ups.',
  },
  {
    name: 'NGO & Community Work',
    description: 'For organisations coordinating community activities, partners, volunteers, field work, outcomes, and follow-ups.',
  },
  {
    name: 'Education',
    description: 'For educators managing lessons, assessments, student support, teaching activities, parent follow-ups, and educational reporting.',
  },
  {
    name: 'Personal Productivity',
    description: 'For individuals organising personal priorities, tasks, goals, routines, errands, and follow-ups.',
  },
  {
    name: 'Custom',
    description: 'For workflows that do not fit neatly into one of the predefined templates. Custom allows you to configure categories and fields while keeping the core WeekFlow workflow.',
  },
] as const

const guideLinks = [
  { title: 'Getting Started', description: 'How WeekFlow works from your first workspace through your weekly report.', href: '/guides/getting-started' },
  { title: 'Weekly Planning', description: 'Create objectives, planned activities, and priorities for the week ahead.', href: '/support' },
  { title: 'Daily Activity', description: 'Capture what actually happened and record outcomes, intelligence, and next actions.', href: '/support' },
  { title: 'Follow-ups', description: 'Create, manage, complete, and reopen follow-ups that still need attention.', href: '/support' },
  { title: 'Smart Start', description: 'Carry relevant unfinished work into a new week without copying the whole previous week.', href: '/support' },
  { title: 'Generate Report', description: 'Turn the captured information into a clear weekly report structure.', href: '/support' },
  { title: 'Report History', description: 'Review saved historical reports and understand how snapshots stay tied to their reporting week.', href: '/support' },
  { title: 'Exporting Reports', description: 'Use the report export features available in the current application.', href: '/support' },
  { title: 'Custom Templates', description: 'Configure a workflow around your own categories and fields while keeping the WeekFlow rhythm.', href: '/support' },
] as const

export function SupportGettingStartedPage() {
  return (
    <SupportPageFrame
      title="Getting Started with WeekFlow"
      subtitle="Everything you need to go from your first plan to your first weekly report."
    >
      <div className="support-article support-section-block">
        <h2>How WeekFlow works</h2>
        <p>WeekFlow is built to help you move from planning to delivery to reporting in a single workflow. Every week is organised around the same rhythm: plan the work, capture what actually happened, act on unresolved items, review progress, and generate a report.</p>
        <ol className="support-steps">
          {workflowSteps.map((step) => (
            <li key={step.title} className="support-step-item">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </SupportPageFrame>
  )
}

export function SupportTemplatesPage() {
  return (
    <SupportPageFrame
      title="WeekFlow Templates"
      subtitle="Choose a workflow built around the way you work."
    >
      <div className="support-article support-section-block">
        <p className="support-lead">Templates change the way WeekFlow organises and presents your work.</p>
        <div className="support-template-grid">
          {templateCards.map((template) => (
            <article key={template.name} className="support-template-card">
              <h3>{template.name}</h3>
              <p>{template.description}</p>
            </article>
          ))}
        </div>
      </div>
    </SupportPageFrame>
  )
}

export function SupportGuidesPage() {
  return (
    <SupportPageFrame
      title="WeekFlow Guides"
      subtitle="Practical guides for getting the most from WeekFlow."
    >
      <div className="support-article support-section-block">
        <div className="support-guide-directory">
          {guideLinks.map((guide) => (
            <a key={guide.title} className="support-guide-tile" href={guide.href} onClick={(event) => {
              if (guide.href.startsWith('/')) {
                event.preventDefault();
                navigateTo(guide.href)
              }
            }}>
              <h3>{guide.title}</h3>
              <p>{guide.description}</p>
              <span>Open guide →</span>
            </a>
          ))}
        </div>
      </div>
    </SupportPageFrame>
  )
}
