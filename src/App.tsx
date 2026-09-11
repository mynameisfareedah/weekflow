import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import logoImage from './assets/weekflow-logo.png'
import DailyActivityScreen from './components/DailyActivityScreen'
import FollowUpsScreen from './components/FollowUpsScreen'
import GenerateReportScreen from './components/GenerateReportScreen'
import OverviewScreen from './components/OverviewScreen'
import TemplateSelectionScreen from './components/TemplateSelectionScreen'
import ProfileSettingsScreen from './components/ProfileSettingsScreen'
import TemplateIcon, { AppIcon } from './components/TemplateIcon'
import { loadDailyActivities } from './storage/dailyActivityStorage'
import { loadFollowUps } from './storage/followUpsStorage'
import { deriveWeeklyIntelligence } from './intelligence/intelligenceEngine'
import {
  getCurrentWeekStart,
  getSelectedWeekStart,
  getStoredWeekStarts,
  getWeekStartFromInput,
  loadWeeklyPlan,
  loadWeeklyPlanAsync,
  saveWeeklyPlanAsync,
  setSelectedWeekStart,
  toWeekInput,
} from './storage/weeklyPlanStorage'
import {
  PLAN_CATEGORIES,
  type AccountObjective,
  type CommercialPriority,
  type DayPlan,
  type PlanCategory,
  type PlanItem,
  type SuccessMeasure,
  type VirtualEngagementPlanItem,
  type WeeklyPlan,
} from './types/weeklyPlan'
import { exportReportWord, getFixedReportWeekLabel } from './utils/reportDocx'
import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from './config/templates'
import { getSelectedTemplate } from './storage/templateStorage'
import { getPlanningCategoryDescriptors, getPlanningCategoryItems, type PlanningCategoryDescriptor } from './planning/planningCategoryAdapter'
import { getTemplateTerminology } from './config/templateTerminology'
import { WEEK_DAY_IDS } from './utils/week'
import { navigateTo } from './utils/navigation'
import { createWorkspace, DEFAULT_ACCOUNT_ID, ensureFirstWorkspaceForOwner, getCurrentWorkspace, isWorkspaceNameTaken, loadWorkspaces, normalizeWorkspaceName, provisionWorkspaceInCloud, setCurrentWorkspaceId } from './storage/workspaceStorage'
import { getAvailableTemplates } from './config/templates'
import { accountProvider, type AccountState, createAccount, getCurrentUser, requestPasswordReset, signIn, signOut, updatePassword } from './account'
import { isSupabaseConfigured } from './lib/supabase'
import type { UserProfile } from './types/workspace'
import './App.css'
import './landing.css'

const navigationItems = [
  { label: 'Overview', path: '/', icon: 'overview' as const },
  { label: 'Weekly Plan', path: '/weekly-plan', icon: 'weekly-plan' as const },
  { label: 'Daily Activity', path: '/daily-activity', icon: 'daily-activity' as const },
  { label: 'Follow-ups', path: '/follow-ups', icon: 'follow-ups' as const },
  { label: 'Generate Report', path: '/report', icon: 'report' as const },
  { label: 'Report History', path: '/report-history', icon: 'report-history' as const },
  { label: 'Template', path: '/template-selection', icon: 'workflow' as const },
]

const navigationGroups = [
  { label: 'Your Workflows', items: [{ label: 'Your Workflows', path: '/workspaces', icon: 'workspaces' as const }] },
  { label: 'Workspace', items: navigationItems.slice(0, 5) },
  { label: 'History', items: navigationItems.slice(5, 6) },
  { label: 'Configuration', items: navigationItems.slice(6) },
]

function getScreenFromPath(): string {
  const pathname = window.location.pathname
  if (pathname === '/sign-in') return 'sign-in'
  if (pathname === '/sign-up') return 'sign-up'
  if (pathname === '/forgot-password') return 'forgot-password'
  if (pathname === '/reset-password') return 'reset-password'
  if (pathname === '/profile') return 'profile'
  if (pathname === '/workspaces') return 'workspaces'
  if (pathname === '/template-selection') return 'template-selection'
  if (pathname === '/weekly-plan') return 'weekly-plan'
  if (pathname === '/daily-activity') return 'daily-activity'
  if (pathname === '/follow-ups') return 'follow-ups'
  if (pathname === '/report') return 'report'
  if (pathname === '/report-history') return 'report-history'
  return 'overview'
}

function getInitialScreen(): string {
  // Handle old hash-based URLs for initial state
  const hash = window.location.hash
  if (hash === '#weekly-plan') return 'weekly-plan'
  if (hash === '#daily-activity') return 'daily-activity'
  if (hash === '#follow-ups') return 'follow-ups'
  if (hash === '#report') return 'report'
  if (hash === '#report-history') return 'report-history'
  if (hash === '#overview') return 'overview'
  // Fall back to pathname-based routing
  return getScreenFromPath()
}

function handleOldHashRoutes(): void {
  if (!window.location.hash) return
  const hash = window.location.hash
  const hashMap: Record<string, string> = {
    '#weekly-plan': '/weekly-plan',
    '#daily-activity': '/daily-activity',
    '#follow-ups': '/follow-ups',
    '#report': '/report',
    '#report-history': '/report-history',
    '#overview': '/',
  }
  const newPath = hashMap[hash] || null
  if (newPath) {
    // Use replaceState to seamlessly redirect without adding to history
    window.history.replaceState(null, '', newPath)
    // Trigger a popstate event to update the screen
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

function formatHeaderWeek(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)
  return `${startLabel} - ${endLabel}`
}

const landingWorkflowDemos = [
  { id: 'field-sales', name: 'Pharma Field Sales', status: 'Ready to review', planned: 12, activities: 18, followUps: 5, plan: ['UPTH Urology/Oncology', 'RSUTH', 'Peter Odili Cardiovascular & Cancer Hospital', 'Shalom Medical Center'], activity: ['UPTH Urology/Oncology', 'RSUTH', 'Peter Odili Hospital'], followThrough: '5 actions remain visible' },
  { id: 'small-business', name: 'Small Business', status: 'On track', planned: 9, activities: 14, followUps: 4, plan: ['Customer meetings', 'Orders', 'Supplier activity', 'Sales priorities'], activity: ['Customer Meeting', 'Sales Activity', 'Order Processing'], followThrough: '4 actions remain visible' },
  { id: 'personal', name: 'Personal Productivity', status: 'Making progress', planned: 8, activities: 11, followUps: 3, plan: ['Personal goals', 'Important tasks', 'Weekly priorities'], activity: ['Morning planning', 'Priority task', 'Personal errand', 'Follow-up'], followThrough: '3 actions remain visible' },
  { id: 'project-management', name: 'Project Management', status: 'Ready to review', planned: 10, activities: 16, followUps: 4, plan: ['Project deliverables', 'Stakeholder updates', 'Project priorities', 'Risks and blockers'], activity: ['Project task', 'Stakeholder meeting', 'Deliverable review'], followThrough: '4 actions remain visible' },
  { id: 'field-service', name: 'Field Operations', status: 'On track', planned: 11, activities: 15, followUps: 6, plan: ['Site visits', 'Inspections', 'Service jobs', 'Equipment checks'], activity: ['Site visit', 'Inspection', 'Service job'], followThrough: '6 actions remain visible' },
  { id: 'ngo-community', name: 'NGO & Community Work', status: 'Making progress', planned: 8, activities: 13, followUps: 4, plan: ['Community outreach', 'Beneficiary engagement', 'Partner coordination', 'Programme activities'], activity: ['Community visit', 'Beneficiary engagement', 'Partner meeting'], followThrough: '4 actions remain visible' },
  { id: 'education', name: 'Education', status: 'On track', planned: 9, activities: 14, followUps: 3, plan: ['Lesson planning', 'Student activities', 'Assessment', 'Academic priorities'], activity: ['Lesson preparation', 'Student session', 'Assessment review'], followThrough: '3 actions remain visible' },
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
    <div className="landing-demo-selector"><span>WORKFLOW</span><div className="landing-demo-options">{landingWorkflowDemos.map((item, index) => <button type="button" className={index === activeIndex ? 'is-active' : ''} onClick={() => setActiveIndex(index)} key={item.id} aria-label={`Show ${item.name}`}><TemplateIcon templateId={item.id} /><span>{item.name}</span></button>)}</div></div>
    <div className="landing-product-preview landing-product-preview-live" key={demo.id}><div className="preview-window-bar"><span className="preview-dots"><i /><i /><i /></span><span>WeekFlow</span><span className="preview-week">Week of Aug 10 - Aug 16</span></div><div className="preview-body"><aside><strong>WeekFlow</strong><span className="preview-active">Overview</span><span>Weekly Plan</span><span>Daily Activity</span><span>Follow-ups</span><span>Report</span></aside><div className="preview-main"><div className="preview-heading"><div><small>{demo.name}</small><h2>Your week at a glance.</h2></div><b>{demo.status}</b></div><div className="preview-metrics"><div><small>Planned</small><strong>{demo.planned}</strong></div><div><small>Activities</small><strong>{demo.activities}</strong></div><div><small>Follow-ups</small><strong>{demo.followUps}</strong></div></div><div className="preview-content-grid"><div className="preview-plan"><small>Weekly Plan</small>{demo.plan.map((item) => <strong key={item}>{item}</strong>)}</div><div className="preview-followups"><small>Daily Activity</small>{demo.activity.map((item) => <strong key={item}>{item}</strong>)}<span className="preview-pill">{demo.followThrough}</span></div></div></div></div></div>
  </div>
}

function PublicLandingScreen({ onSignIn, onCreateAccount }: { onSignIn: () => void; onCreateAccount: () => void }) {
  useEffect(() => {
    document.querySelector('.landing-hero-actions')?.remove()
    const finalSignIn = document.querySelector<HTMLButtonElement>('.landing-final-cta .landing-secondary-cta')
    if (finalSignIn) {
      finalSignIn.textContent = 'Already have an account? Sign in'
      finalSignIn.setAttribute('aria-label', 'Already have an account? Sign in')
    }
    const elements = document.querySelectorAll<HTMLElement>('.landing-reveal')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12 })
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  const templateGroups = [
    { label: 'Business & Operations', ids: ['field-sales', 'field-service', 'small-business', 'project-management'] },
    { label: 'People & Impact', ids: ['ngo-community', 'education'] },
    { label: 'Personal', ids: ['personal'] },
    { label: 'Build Your Own', ids: ['custom'] },
  ]
  const templates = getAvailableTemplates()
  const templateById = new Map(templates.map((template) => [template.id, template]))
  const workflow = [
    ['01', 'PLAN', 'Weekly Plan', 'Set objectives and organise the work ahead.'],
    ['02', 'ACTIVITY', 'Daily Activity', 'Capture what actually happened during the week.'],
    ['03', 'FOLLOW-UP', 'Follow-ups', 'Keep unresolved actions visible until they are done.'],
    ['04', 'REVIEW', 'Generate Report', 'Review progress, outcomes, intelligence, and readiness.'],
    ['05', 'REPORT', 'Report History', 'Keep a useful record of completed weeks and reports.'],
  ]
  return <main className="landing-page">
    <AnimatedLandingPreview />
    <nav className="landing-nav"><a className="landing-brand" href="/" aria-label="WeekFlow home"><img src={logoImage} alt="WeekFlow mark" /><span className="landing-wordmark">WeekFlow</span></a><div className="landing-nav-actions"><button type="button" className="landing-sign-in" onClick={onSignIn}>Sign In</button><button type="button" className="button button-primary landing-nav-cta" onClick={onCreateAccount}>Create a free account</button></div></nav>
    <section className="landing-hero"><div className="landing-hero-copy"><p className="landing-eyebrow">Your week, working better</p><h1>Plan your week.<br /><em>Stay on top of the work.</em></h1><p className="landing-hero-text">WeekFlow brings your weekly plans, daily activity, follow-ups, review, and reporting into one simple workspace.</p><div className="landing-hero-actions"><button type="button" className="button button-primary landing-large-cta" onClick={onCreateAccount}>Create a free account <AppIcon name="arrow-right" /></button><button type="button" className="landing-secondary-cta" onClick={onSignIn}>Sign In</button></div></div><div className="landing-preview-wrap"><span className="preview-float preview-float-week">Week of Aug 10-16</span><span className="preview-float preview-float-followups">5 follow-ups</span><div className="landing-product-preview" aria-label="WeekFlow product preview"><div className="preview-window-bar"><span className="preview-dots"><i /><i /><i /></span><span>WeekFlow</span><span className="preview-week">Aug 10 - Aug 16</span></div><div className="preview-body"><aside><strong>WeekFlow</strong><span className="preview-active">Overview</span><span>Weekly Plan</span><span>Daily Activity</span><span>Follow-ups</span><span>Report</span></aside><div className="preview-main"><div className="preview-heading"><div><small>Current work week</small><h2>Your week at a glance.</h2></div><b>Ready to review</b></div><div className="preview-metrics"><div><small>Planned</small><strong>12</strong></div><div><small>Activities</small><strong>18</strong></div><div><small>Follow-ups</small><strong>5</strong></div></div><div className="preview-content-grid"><div className="preview-plan"><small>Weekly Plan</small><strong>Priority accounts and next actions</strong><span className="preview-line" /><span className="preview-line short" /><span className="preview-line" /></div><div className="preview-followups"><small>Follow-through</small><strong>5 actions remain visible</strong><span className="preview-pill">On track</span></div></div></div></div></div></div></section>
    <section className="landing-section landing-workflow" id="workflow"><div className="landing-section-heading"><p className="landing-eyebrow">The WeekFlow rhythm</p><h2>One week. One clear rhythm.</h2><p>Plan. Work. Follow through. Review. Report.</p></div><div className="landing-orbit-window" aria-label="WeekFlow rhythm stages"><div className="landing-orbit-ring" aria-hidden="true" />{workflow.map(([number, label, title, description], index) => <article className="landing-orbit-card" style={{ ['--orbit-delay' as string]: `${index * -4}s` }} key={number}><span>{number}</span><small>{label}</small><h3>{title}</h3><p>{description}</p></article>)}</div></section>
        <section className="landing-story landing-story-activity landing-reveal"><div className="landing-story-visual landing-activity-visual"><div className="story-window-label">Planned work <span>Actual activity</span></div><div className="story-flow-step"><b>Weekly Plan</b><span>Planned priorities</span></div><div className="story-flow-arrow"><AppIcon name="arrow-down" /></div><div className="story-flow-step is-active"><b>Daily Activity</b><span>What actually happened</span></div><div className="story-outcome-row"><span>Outcome</span><span>Intelligence</span><span>Next Action</span></div></div><div className="landing-story-copy"><p className="landing-eyebrow">Product in action</p><h2>Turn the plan into real work.</h2><p>Start the week knowing what matters. Capture what actually happens as the work unfolds.</p></div></section>
    <section className="landing-story landing-story-followups landing-reveal"><div className="landing-story-copy"><p className="landing-eyebrow">Follow-ups</p><h2>Don't let important work disappear.</h2><p>Keep unresolved actions visible until they're complete.</p></div><div className="landing-story-visual landing-followups-visual"><div className="story-window-label">Follow-ups <span>Open work</span></div><div className="story-followup-row"><span className="story-dot is-open" /><strong>Confirm account next action</strong><small>Priority</small></div><div className="story-followup-row"><span className="story-dot is-open" /><strong>Share outcome with team</strong><small>Due this week</small></div><div className="story-followup-row is-complete"><span className="story-dot is-done"><AppIcon name="check" /></span><strong>Complete follow-up</strong><small>Completed</small></div></div></section>
    <section className="landing-feature-band landing-reveal"><div><p className="landing-eyebrow">Smart Start</p><h2>Start the next week with less work to rebuild.</h2><p>Carry forward the unfinished work that still matters. Leave completed work behind.</p></div><div className="landing-smart-visual"><div><small>Last week</small><span>[done] Completed work</span><span>[done] Completed follow-ups</span><b>-&gt; Unfinished priorities</b></div><div className="smart-start-bridge"><span>Smart Start</span><b>select what still matters</b></div><div><small>New week</small><b>-&gt; Carry forward what still matters</b></div></div></section>
    <section className="landing-section landing-reporting landing-reveal"><div className="landing-section-heading"><p className="landing-eyebrow">Reporting</p><h2>Turn the week's work into a finished report.</h2><p>Bring together what you planned, what happened, what changed, and what still needs attention.</p></div><div className="landing-report-preview"><div><strong>Weekly Activity</strong><span>Activities Summary</span><span>Daily Activity Breakdown</span><span>Key Outcomes</span></div><div className="report-transform"><b>WeekFlow Review</b><span>-&gt;</span><strong>Professional Report</strong><small>Export professional Word documents.</small></div></div></section>
    <section className="landing-section landing-templates landing-reveal" id="templates"><div className="landing-section-heading"><p className="landing-eyebrow">Built for different kinds of work</p><h2>One platform. Different kinds of work.</h2><p>Choose a workflow that fits how you work.</p></div><div className="landing-template-groups">{templateGroups.map((group) => <div className="landing-template-group landing-stagger" key={group.label}><h3>{group.label}</h3><div>{group.ids.map((id) => { const template = templateById.get(id); return template ? <article key={id}><span className="landing-template-icon"><TemplateIcon templateId={template.id} /></span><strong>{template.name}</strong><p>{template.description}</p></article> : null })}</div></div>)}</div></section>
    <section className="landing-section landing-workspaces landing-reveal"><div className="landing-split-copy"><p className="landing-eyebrow">Your work. Your workspaces.</p><h2>Keep every workflow in its place.</h2><p>Keep different kinds of work organised without mixing their workflows.</p></div><div className="landing-workspace-examples"><article><span>Waheed's Field Work</span><strong>Pharma Field Sales</strong><small>Plans, activity, accounts, follow-ups</small></article><article><span>Benazir's</span><strong>Small Business</strong><small>Customers, sales, orders, priorities</small></article><article><span>Personal Goals</span><strong>Personal Productivity</strong><small>Goals, tasks, routines, next actions</small></article></div></section>
    <section className="landing-final-cta"><h2>Make every week easier to run.</h2><p>Start with a free WeekFlow account.</p><div><button type="button" className="button button-primary landing-large-cta" onClick={onCreateAccount}>Create a free account <AppIcon name="arrow-right" /></button><button type="button" className="landing-secondary-cta" onClick={onSignIn}>Sign In</button></div></section>
    <footer className="landing-footer"><div><div className="landing-footer-brand"><img src={logoImage} alt="WeekFlow mark" /><span className="landing-wordmark">WeekFlow</span></div><p>Plan your week. Stay on top of the work.</p></div><div><a href="#workflow">The rhythm</a><a href="#templates">Workflows</a><a href="/workspaces">Your Workflows</a></div><small>(c) {new Date().getFullYear()} WeekFlow</small></footer>
  </main>
}

function AuthenticationScreen({ initialMode = 'welcome' }: { initialMode?: 'welcome' | 'signin' | 'signup' }) {
  const [mode, setMode] = useState<'welcome' | 'signin' | 'signup'>(initialMode)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function resetMessages() {
    setErrorMessage('')
    setSuccessMessage('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()
    if (!email.trim() || !password) {
      setErrorMessage('Enter your email and password to continue.')
      return
    }
    if (mode === 'signup' && !displayName.trim()) {
      setErrorMessage('Enter your full name to create an account.')
      return
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn({ email: email.trim(), password })
      } else {
        const result = await createAccount({ displayName: displayName.trim(), email: email.trim(), password })
        if (!result.authenticated) {
          setSuccessMessage('Account created. Please check your email to confirm your account before signing in.')
          setMode('signin')
          setPassword('')
          setConfirmPassword('')
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Authentication could not be completed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (mode === 'welcome') {
    return <main className="auth-screen"><div className="auth-panel auth-welcome-panel"><img className="auth-logo" src={logoImage} alt="WeekFlow" /><p className="eyebrow">Weekly workflow</p><h1>Plan your week. Track what happens. Stay on top of what comes next.</h1><p className="auth-intro">A focused workspace for turning plans, activity, and follow-through into a clearer week.</p><div className="auth-actions"><button type="button" className="button button-primary" onClick={() => { resetMessages(); setMode('signin') }}>Sign In</button><button type="button" className="button button-secondary" onClick={() => { resetMessages(); setMode('signup') }}>Create Account</button></div></div></main>
  }

  return <main className="auth-screen"><section className="auth-panel" aria-labelledby="auth-title"><img className="auth-logo" src={logoImage} alt="WeekFlow" /><p className="eyebrow">Account</p><h1 id="auth-title">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1><p className="auth-intro">{mode === 'signin' ? 'Sign in to return to your workflows.' : 'Start building a calmer, more useful weekly rhythm.'}</p><form className="auth-form" onSubmit={submit} noValidate>
    {mode === 'signup' && <label className="auth-field"><span>Full Name</span><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>}
    <label className="auth-field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label className="auth-field"><span>Password</span><input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {mode === 'signin' && <button className="auth-inline-link" type="button" onClick={() => navigateTo('/forgot-password')}>Forgot password?</button>}
    {mode === 'signup' && <label className="auth-field"><span>Confirm Password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}
    {errorMessage && <p className="auth-message auth-error" role="alert">{errorMessage}</p>}
    {successMessage && <p className="auth-message auth-success" role="status">{successMessage}</p>}
    <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Working...' : mode === 'signin' ? 'Sign In' : 'Create Account'}</button>
  </form><button className="auth-switch" type="button" onClick={() => { resetMessages(); setMode(mode === 'signin' ? 'signup' : 'signin') }}>{mode === 'signin' ? 'Need an account? Create Account' : 'Already have an account? Sign In'}</button><button className="auth-back" type="button" onClick={() => { resetMessages(); setMode('welcome') }}>Back to WeekFlow</button></section></main>
}

function humanizeResetError(error: unknown, isPasswordUpdate = false) {
  if (error instanceof TypeError || (error instanceof Error && /network|fetch|connection|offline/i.test(error.message))) {
    return 'We could not connect right now. Check your connection and try again.'
  }
  if (isPasswordUpdate) return 'This password reset link is no longer valid. Request a new one to continue.'
  return 'We could not complete that request. Please try again.'
}

function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setErrorMessage('Enter your email address.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage('Enter a valid email address.')
      return
    }

    setIsSubmitting(true)
    try {
      await requestPasswordReset(normalizedEmail, `${window.location.origin}/reset-password`)
      setSubmitted(true)
    } catch (error) {
      setErrorMessage(humanizeResetError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return <main className="auth-screen"><section className="auth-panel" aria-labelledby="reset-request-title"><img className="auth-logo" src={logoImage} alt="WeekFlow" /><p className="eyebrow">Account recovery</p>{submitted ? <><h1 id="reset-request-title">Check your email</h1><p className="auth-intro">If an account exists for that email address, we&apos;ve sent a password reset link.</p></> : <><h1 id="reset-request-title">Forgot your password?</h1><p className="auth-intro">Enter the email address associated with your WeekFlow account and we&apos;ll send you a link to reset your password.</p><form className="auth-form" onSubmit={submit} noValidate><label className="auth-field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{errorMessage && <p className="auth-message auth-error" role="alert">{errorMessage}</p>}<button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send reset link'}</button></form></>}<button className="auth-switch" type="button" onClick={() => navigateTo('/sign-in')}>Back to sign in</button></section></main>
}

function ResetPasswordScreen() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [updated, setUpdated] = useState(false)
  const [linkExpired, setLinkExpired] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (!password) {
      setErrorMessage('Enter a new password.')
      return
    }
    if (password.length < 8) {
      setErrorMessage('Your password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await updatePassword(password)
      setUpdated(true)
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      const isConnectionError = error instanceof TypeError || (error instanceof Error && /network|fetch|connection|offline/i.test(error.message))
      if (!isConnectionError) setLinkExpired(true)
      setErrorMessage(humanizeResetError(error, true))
    } finally {
      setIsSubmitting(false)
    }
  }

  return <main className="auth-screen"><section className="auth-panel" aria-labelledby="new-password-title"><img className="auth-logo" src={logoImage} alt="WeekFlow" /><p className="eyebrow">Account recovery</p>{updated ? <><h1 id="new-password-title">Password updated</h1><p className="auth-intro">Your password has been changed successfully.</p><button className="button button-primary auth-submit" type="button" onClick={() => navigateTo('/sign-in')}>Continue to sign in</button></> : linkExpired ? <><h1 id="new-password-title">Reset link expired</h1><p className="auth-intro">This password reset link is no longer valid. Request a new one to continue.</p></> : <><h1 id="new-password-title">Create a new password</h1><p className="auth-intro">Choose a new password for your WeekFlow account.</p><form className="auth-form" onSubmit={submit} noValidate><label className="auth-field"><span>New password</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="auth-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{errorMessage && <p className="auth-message auth-error" role="alert">{errorMessage}</p>}<button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update password'}</button></form></>}<button className="auth-switch" type="button" onClick={() => navigateTo('/forgot-password')}>Request a new reset link</button><button className="auth-back" type="button" onClick={() => navigateTo('/sign-in')}>Back to sign in</button></section></main>
}

function AuthLoadingScreen() {
  return <main className="auth-screen"><div className="auth-panel auth-loading"><img className="auth-logo" src={logoImage} alt="WeekFlow" /><p>Restoring your session...</p></div></main>
}

function getUserInitials(user: UserProfile | null) {
  const source = user?.displayName?.trim() || user?.email?.trim() || ''
  const words = source.split(/\s+/).filter(Boolean)
  return words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase() : (words[0]?.slice(0, 2) || 'WF').toUpperCase()
}

function Header({
  selectedWeek,
  currentWorkspace,
  currentTemplate,
  workspaceMenuOpen,
  onToggleWorkspaceMenu,
  onOpenNavigation,
  onSelectWorkspace,
  onOpenCreateWorkspace,
  onOpenProfile,
  user,
  onSignOut,
}: {
  selectedWeek: string
  currentWorkspace: ReturnType<typeof getCurrentWorkspace>
  currentTemplate: ReturnType<typeof getSelectedTemplate>
  workspaceMenuOpen: boolean
  onToggleWorkspaceMenu: () => void
  onOpenNavigation: () => void
  onSelectWorkspace: (workspaceId: string) => void
  onOpenCreateWorkspace: () => void
  onOpenProfile: () => void
  user: UserProfile | null
  onSignOut: () => void
}) {
  const isHistorical = selectedWeek !== getCurrentWeekStart()
  const workspaces = loadWorkspaces()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profileMenuOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [profileMenuOpen])

  return (
    <header className="app-header">
      <button className="mobile-menu-button" type="button" onClick={onOpenNavigation} aria-label="Open navigation" aria-controls="main-navigation"><AppIcon name="menu" /></button>
      <a className="brand" href="/" aria-label="WeekFlow overview" onClick={(event) => { event.preventDefault(); navigateTo('/') }}>
        <img className="brand-logo" src={logoImage} alt="WeekFlow" />
      </a>
      <div className="header-context">
        <span className="context-label">Current week</span>
        <span className="context-value">Week of {formatHeaderWeek(selectedWeek)}</span>
        {isHistorical && <span className="context-history">Historical report</span>}
      </div>
      <div className="workspace-switcher-wrap">
        <button className="workspace-switcher-trigger" type="button" onClick={onToggleWorkspaceMenu} aria-expanded={workspaceMenuOpen} aria-label="Workspace switcher">
          <span className="workspace-switcher-name">{currentWorkspace.name}</span>
          <span className="workspace-switcher-template">{currentTemplate.name}</span>
        </button>
        {workspaceMenuOpen && (
          <div className="workspace-switcher-menu" role="menu" aria-label="Workspace switcher menu">
            <div className="workspace-switcher-header">Your workspaces</div>
            {workspaces.map((workspace) => {
              const isCurrent = workspace.id === currentWorkspace.id
              const templateName = getAvailableTemplates().find((template) => template.id === workspace.templateId)?.name ?? currentTemplate.name
              return (
                <button type="button" className={`workspace-switcher-item${isCurrent ? ' is-current' : ''}`} key={workspace.id} onClick={() => onSelectWorkspace(workspace.id)} role="menuitemradio" aria-checked={isCurrent}>
                  <span className="workspace-switcher-item-title"><AppIcon name={isCurrent ? 'check' : 'dot'} /> {workspace.name}</span>
                  <span className="workspace-switcher-item-template">{templateName}</span>
                </button>
              )
            })}
            <button type="button" className="workspace-switcher-create" onClick={onOpenCreateWorkspace}>+ Create New Workspace</button>
          </div>
        )}
      </div>
      <div className="profile-wrap" ref={profileMenuRef}><button className="profile-button" type="button" aria-label={`Open profile menu for ${user?.displayName || user?.email || 'account'}`} aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((current) => !current)}><span className="profile-avatar" aria-hidden="true">{getUserInitials(user)}</span><span className="profile-button-name">{user?.displayName || user?.email || 'Account'}</span><span className="profile-chevron" aria-hidden="true">⌄</span></button>{profileMenuOpen && <div className="profile-menu" role="menu" aria-label="Account menu"><strong>{user?.displayName || 'WeekFlow account'}</strong>{user?.email && <span>{user.email}</span>}<button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); onOpenProfile() }}>Profile Settings</button><button type="button" role="menuitem" onClick={onSignOut}>Sign out</button></div>}</div>
    </header>
  )
}

function WorkspaceCreateDialog({
  isOpen,
  templateId,
  onTemplateChange,
  onNameChange,
  workspaceName,
  onClose,
  onCreate,
  validationMessage,
}: {
  isOpen: boolean
  templateId: string
  onTemplateChange: (value: string) => void
  onNameChange: (value: string) => void
  workspaceName: string
  onClose: () => void
  onCreate: () => void
  validationMessage: string
}) {
  if (!isOpen) return null

  const templates = getAvailableTemplates()
  const selectedTemplate = templates.find((template) => template.id === templateId) ?? templates[0]

  return (
    <div className="workspace-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-workspace-title">
      <div className="workspace-modal">
        <div className="workspace-modal-header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2 id="create-workspace-title">Create New Workspace</h2>
          </div>
          <button type="button" className="workspace-modal-close" onClick={onClose} aria-label="Close create workspace dialog"><AppIcon name="close" /></button>
        </div>
        <label className="workspace-field">
          <span>Workspace Name</span>
          <input
            value={workspaceName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g. Franklin's Field Work"
            aria-label="Workspace Name"
            aria-invalid={Boolean(validationMessage)}
          />
          {validationMessage && <span className="workspace-field-error" role="alert">{validationMessage}</span>}
        </label>
        <label className="workspace-field">
          <span>Template</span>
          <select value={templateId} onChange={(event) => onTemplateChange(event.target.value)} aria-label="Workspace template">
            {templates.map((template) => (
              <option value={template.id} key={template.id}>{template.name}</option>
            ))}
          </select>
          <span className="workspace-template-preview">{selectedTemplate.description}</span>
        </label>
        <div className="workspace-modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="button button-primary" onClick={onCreate}>Create Workspace</button>
        </div>
      </div>
    </div>
  )
}

function AppNavigation({ activeScreen, templateName, onSwitchTemplate, onNavigate, collapsed, mobileOpen, onToggleCollapse, onClose }: { activeScreen: string; templateName: string; onSwitchTemplate: () => void; onNavigate: (path: string) => void; collapsed: boolean; mobileOpen: boolean; onToggleCollapse: () => void; onClose: () => void }) {
  return (
    <nav className={`app-navigation${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-mobile-open' : ''}`} id="main-navigation" aria-label="Main navigation">
      <div className="navigation-brand"><img src={logoImage} alt="WeekFlow" /><span>WeekFlow</span></div>
      <button className="navigation-close-button" type="button" onClick={onClose} aria-label="Close navigation"><AppIcon name="close" /></button>
      <div className="navigation-topline"><div className="navigation-template"><span className="navigation-template-label">Workflow</span><strong>{templateName}</strong><button type="button" onClick={onSwitchTemplate}>Switch workflow</button></div><button className="navigation-collapse-button" type="button" onClick={onToggleCollapse} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!collapsed}><AppIcon name={collapsed ? 'expand' : 'collapse'} /></button></div>
      <div className="navigation-groups">
        {navigationGroups.map((group) => <div className="navigation-group" key={group.label}><span className="navigation-label">{group.label}</span><div className="navigation-links">{group.items.map((item) => {
          const isItemActive = item.path === '/' ? activeScreen === 'overview' : item.path === '/workspaces' ? activeScreen === 'workspaces' : activeScreen === item.path.slice(1)
          return <a className={`navigation-link${isItemActive ? ' is-active' : ''}`} href={item.path} key={item.path} aria-current={isItemActive ? 'page' : undefined} onClick={(event) => { event.preventDefault(); onNavigate(item.path); onClose() }} title={collapsed ? item.label : undefined}><span className="navigation-icon"><AppIcon name={item.icon} /></span><span className="navigation-link-label">{item.label}</span></a>
        })}</div></div>)}
      </div>
      <div className="navigation-footer"><span className="navigation-footer-label">Selected workflow</span><strong>{templateName}</strong></div>
    </nav>
  )
}

function WorkspaceHomeScreen({
  currentWorkspaceId,
  onOpenWorkspace,
  onCreateWorkspace,
  user,
}: {
  currentWorkspaceId: string
  onOpenWorkspace: (workspaceId: string) => void
  onCreateWorkspace: () => void
  user: UserProfile | null
}) {
  const workspaces = loadWorkspaces().filter((workspace) => !workspace.archived)
  const welcomeName = user?.displayName?.trim().toUpperCase() || 'there'

  if (workspaces.length === 0) {
    return (
      <main className="workspace-home-screen">
        <div className="workspace-home-empty">
            <p className="eyebrow">Your Workflows</p>
          <h1>Your first workflow starts here</h1>
          <p>Create a workspace for the kind of work you want to organize.</p>
          <button type="button" className="button button-primary" onClick={onCreateWorkspace}>+ Create New Workspace</button>
        </div>
      </main>
    )
  }

  return (
    <main className="workspace-home-screen">
      <div className="workspace-home-header">
        <p className="eyebrow">Your Workflows</p>
        <h1>Welcome back, {welcomeName}! 👋</h1>
        <p>Your workspaces are ready. Choose one to continue, or create a new workspace for what’s next.</p>
      </div>
      <div className="workspace-home-grid">
        {workspaces.map((workspace) => {
          const template = getAvailableTemplates().find((candidate) => candidate.id === workspace.templateId) ?? getAvailableTemplates()[0]
          const isCurrent = workspace.id === currentWorkspaceId

          return (
            <article className={`workspace-home-card${isCurrent ? ' is-current' : ''}`} key={workspace.id}>
              {isCurrent && <span className="workspace-home-badge">Current workspace</span>}
              <span className="workspace-home-icon"><TemplateIcon templateId={workspace.templateId} /></span>
              <h2>{workspace.name}</h2>
              <p className="workspace-home-template">{template.name}</p>
              <p className="workspace-home-description">{template.description}</p>
              <button type="button" className="button button-primary" onClick={() => onOpenWorkspace(workspace.id)}>
                Open Workspace
              </button>
            </article>
          )
        })}
        <button type="button" className="workspace-home-create" onClick={onCreateWorkspace}>+ Create New Workspace</button>
      </div>
    </main>
  )
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function formatWeekRange(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)
  return `${startLabel} - ${endLabel}`
}

function shiftWeek(weekStart: string, amount: number) {
  const date = new Date(`${weekStart}T12:00:00`)
  date.setDate(date.getDate() + amount * 7)
  return date.toISOString().slice(0, 10)
}

function WeekNavigation({ weekStart, onChange }: { weekStart: string; onChange: (weekStart: string) => void }) {
  const currentWeek = getCurrentWeekStart()
  return (
    <div className="week-navigation" aria-label="Reporting week navigation">
      <button type="button" onClick={() => onChange(shiftWeek(weekStart, -1))}><AppIcon name="chevron-left" /> Previous Week</button>
      <button type="button" onClick={() => onChange(currentWeek)} disabled={weekStart === currentWeek}>Current Week</button>
      <button type="button" onClick={() => onChange(shiftWeek(weekStart, 1))}>Next Week <AppIcon name="chevron-right" /></button>
    </div>
  )
}

function PlanCategory({
  dayId,
  descriptor,
  items,
  onAdd,
  onEdit,
  onDelete,
}: {
  dayId: string
  descriptor: PlanningCategoryDescriptor
  items: PlanItem[]
  onAdd: (text: string, itemId?: string) => void
  onEdit: (itemId: string, text: string) => void
  onDelete: (itemId: string) => void
}) {
  const category = descriptor.key
  const categoryLabel = descriptor.label
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [newItemId, setNewItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!newItemId) return
    const timer = window.setTimeout(() => setNewItemId(null), 520)
    return () => window.clearTimeout(timer)
  }, [newItemId])

  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = draft.trim()
    if (!value) return
    const itemId = crypto.randomUUID()
    onAdd(value, itemId)
    setNewItemId(itemId)
    setDraft('')
  }

  function startEditing(item: PlanItem) {
    setEditingId(item.id)
    setEditingText(item.text)
  }

  function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingId || !editingText.trim()) return
    onEdit(editingId, editingText.trim())
    setEditingId(null)
    setEditingText('')
  }

  return (
    <section className="plan-category" aria-labelledby={`${dayId}-${category}-label`}>
      <div className="category-heading">
        <h3 id={`${dayId}-${category}-label`}>{categoryLabel}</h3>
        <button className="add-item-button" type="button" onClick={() => document.getElementById(`${dayId}-${category}-input`)?.focus()}>
          + Add
        </button>
      </div>
      {items.length > 0 && (
        <ul className="plan-items">
          {items.map((item) => (
            <li className={`plan-item${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              {editingId === item.id ? (
                <form className="item-edit-form" onSubmit={saveEdit}>
                  <input aria-label={`Edit ${categoryLabel}`} autoFocus value={editingText} onChange={(event) => setEditingText(event.target.value)} />
                  <button type="submit" aria-label="Save item">Save</button>
                  <button type="button" aria-label="Cancel editing" onClick={() => setEditingId(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <span>{item.text}</span>
                  <span className="item-actions">
                    <button type="button" aria-label={`Edit ${item.text}`} onClick={() => startEditing(item)}>Edit</button>
                    <button type="button" aria-label={`Delete ${item.text}`} onClick={() => onDelete(item.id)}>Delete</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="add-item-form" onSubmit={addItem}>
        <input id={`${dayId}-${category}-input`} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add an item..." aria-label={`Add to ${categoryLabel}`} />
        <button type="submit" aria-label={`Add to ${categoryLabel}`}>+</button>
      </form>
    </section>
  )
}

function DayPlanSection({ day, onChange, template = FIELD_SALES_TEMPLATE }: { day: DayPlan; onChange: (day: DayPlan) => void; template?: WeekFlowTemplate }) {
  function updateCategory(category: PlanCategory, items: PlanItem[]) {
    onChange({ ...day, categories: { ...day.categories, [category]: items } })
  }

  return (
    <section className="day-plan" aria-labelledby={`${day.id}-heading`}>
      <div className="day-heading">
        <span className="day-index">{String(WEEK_DAY_IDS.indexOf(day.id) + 1).padStart(2, '0')}</span>
        <div>
          <h2 id={`${day.id}-heading`}>{day.label}</h2>
          <p>{formatDateLabel(day.date)}</p>
        </div>
      </div>
      <div className="day-categories">
        {getPlanningCategoryDescriptors(template).map((descriptor) => (
          <PlanCategory
            dayId={day.id}
            descriptor={descriptor}
            items={getPlanningCategoryItems(day, descriptor.key)}
            key={descriptor.key}
            onAdd={(text, itemId) => updateCategory(descriptor.key, [...getPlanningCategoryItems(day, descriptor.key), { id: itemId ?? crypto.randomUUID(), text }])}
            onEdit={(itemId, text) => updateCategory(descriptor.key, getPlanningCategoryItems(day, descriptor.key).map((item) => item.id === itemId ? { ...item, text } : item))}
            onDelete={(itemId) => updateCategory(descriptor.key, getPlanningCategoryItems(day, descriptor.key).filter((item) => item.id !== itemId))}
          />
        ))}
      </div>
    </section>
  )
}

function WeeklyPlanTextListSection<T extends { id: string; text: string }>({
  title,
  summary,
  items,
  emptyText,
  placeholder,
  onChange,
}: {
  title: string
  summary: string
  items: T[]
  emptyText: string
  placeholder: string
  onChange: (items: T[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [newItemId, setNewItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!newItemId) return
    const timer = window.setTimeout(() => setNewItemId(null), 520)
    return () => window.clearTimeout(timer)
  }, [newItemId])

  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = draft.trim()
    if (!value) return
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, text: value } as T])
    setNewItemId(itemId)
    setDraft('')
  }

  function updateItem(itemId: string, text: string) {
    onChange(items.map((item) => item.id === itemId ? { ...item, text } : item))
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section" aria-labelledby={`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-heading`}>
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3 id={`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-heading`}>{title}</h3>
        </div>
        <span>{summary}</span>
      </div>
      {items.length > 0 ? (
        <ul className="weekly-plan-summary-list">
          {items.map((item) => (
            <li className={`weekly-plan-summary-item${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <input
                aria-label={title}
                value={item.text}
                onChange={(event) => updateItem(item.id, event.target.value)}
              />
              <button type="button" aria-label={`Delete ${title}`} onClick={() => deleteItem(item.id)}>Remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="weekly-plan-summary-empty">{emptyText}</p>
      )}
      <form className="weekly-plan-summary-form" onSubmit={addItem}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
        <button type="submit" aria-label={`Add ${title}`}>+ Add</button>
      </form>
    </section>
  )
}

function WeeklyPlanVirtualEngagementSection({
  items,
  onChange,
  title = 'Virtual Engagement Plan',
  helperText = 'Map where you need to engage virtually, the key stakeholders and the purpose of the outreach.',
  emptyText: _emptyText = 'No virtual engagements planned yet.',
  addButtonText: _addButtonText = '+ Add engagement',
  contactPlaceholder: _contactPlaceholder = 'Add priority contact',
  objectivePlaceholder: _objectivePlaceholder = 'Describe the objective of this engagement',
}: {
  items: VirtualEngagementPlanItem[]
  onChange: (items: VirtualEngagementPlanItem[]) => void
  title?: string
  helperText?: string
  emptyText?: string
  addButtonText?: string
  contactPlaceholder?: string
  objectivePlaceholder?: string
}) {
  const [contactDrafts, setContactDrafts] = useState<Record<string, string>>({})

  function updateItem(itemId: string, changes: Partial<VirtualEngagementPlanItem>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...changes } : item))
  }

  const [newItemId, setNewItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!newItemId) return
    const timer = window.setTimeout(() => setNewItemId(null), 520)
    return () => window.clearTimeout(timer)
  }, [newItemId])

  function addItem() {
    const itemId = crypto.randomUUID()
    onChange([...items, {
      id: itemId,
      coverage: '',
      priorityContacts: [],
      objective: '',
    }])
    setNewItemId(itemId)
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  function addPriorityContact(itemId: string) {
    const value = (contactDrafts[itemId] ?? '').trim()
    if (!value) return
    const existing = items.find((item) => item.id === itemId)
    if (!existing) return
    updateItem(itemId, {
      priorityContacts: [...existing.priorityContacts, { id: crypto.randomUUID(), text: value }],
    })
    setContactDrafts((current) => ({ ...current, [itemId]: '' }))
  }

  function updatePriorityContact(itemId: string, contactId: string, text: string) {
    const existing = items.find((item) => item.id === itemId)
    if (!existing) return
    updateItem(itemId, {
      priorityContacts: existing.priorityContacts.map((contact) => contact.id === contactId ? { ...contact, text } : contact),
    })
  }

  function deletePriorityContact(itemId: string, contactId: string) {
    const existing = items.find((item) => item.id === itemId)
    if (!existing) return
    updateItem(itemId, {
      priorityContacts: existing.priorityContacts.filter((contact) => contact.id !== contactId),
    })
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>{title}</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">{helperText}</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input
                  aria-label="Coverage"
                  value={item.coverage}
                  placeholder="Coverage"
                  onChange={(event) => updateItem(item.id, { coverage: event.target.value })}
                />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-list-editor">
                {item.priorityContacts.length > 0 ? (
                  <ul className="weekly-plan-inline-list">
                    {item.priorityContacts.map((contact) => (
                      <li key={contact.id}>
                        <input
                          aria-label="Priority contact"
                          value={contact.text}
                          onChange={(event) => updatePriorityContact(item.id, contact.id, event.target.value)}
                        />
                        <button type="button" onClick={() => deletePriorityContact(item.id, contact.id)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="weekly-plan-list-empty">No customer contacts added yet.</p>}
                <div className="weekly-plan-inline-input-row">
                  <input
                    aria-label="Add priority contact"
                    value={contactDrafts[item.id] ?? ''}
                    placeholder="Add customer contact"
                    onChange={(event) => setContactDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                  />
                  <button type="button" onClick={() => addPriorityContact(item.id)}>Add</button>
                </div>
              </div>
              <label className="weekly-plan-field-label">
                Objective
                <textarea
                  value={item.objective}
                  placeholder="Describe the objective of this maintenance task"
                  onChange={(event) => updateItem(item.id, { objective: event.target.value })}
                />
              </label>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No preventive maintenance planned yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add maintenance</button>
      </div>
    </section>
  )
}

function WeeklyPlanAccountObjectiveSection({
  items,
  onChange,
  title = 'Key Account-Specific Objectives',
  helperText = 'Capture the specific account goals and the actions required for each key account.',
  emptyText = 'No account-specific objectives captured yet.',
  addButtonText = '+ Add account',
  accountPlaceholder = 'Account',
  objectivePlaceholder = 'Add objective',
}: {
  items: AccountObjective[]
  onChange: (items: AccountObjective[]) => void
  title?: string
  helperText?: string
  emptyText?: string
  addButtonText?: string
  accountPlaceholder?: string
  objectivePlaceholder?: string
}) {
  const [objectiveDrafts, setObjectiveDrafts] = useState<Record<string, string>>({})
  const [newItemId, setNewItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!newItemId) return
    const timer = window.setTimeout(() => setNewItemId(null), 520)
    return () => window.clearTimeout(timer)
  }, [newItemId])

  function addAccount() {
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, account: '', objectives: [] }])
    setNewItemId(itemId)
  }

  function updateAccount(itemId: string, account: string) {
    onChange(items.map((item) => item.id === itemId ? { ...item, account } : item))
  }

  function updateObjective(itemId: string, objectiveId: string, text: string) {
    onChange(items.map((item) => item.id === itemId ? {
      ...item,
      objectives: item.objectives.map((objective) => objective.id === objectiveId ? { ...objective, text } : objective),
    } : item))
  }

  function addObjective(itemId: string) {
    const value = (objectiveDrafts[itemId] ?? '').trim()
    if (!value) return
    const account = items.find((item) => item.id === itemId)
    if (!account) return
    onChange(items.map((item) => item.id === itemId ? { ...item, objectives: [...item.objectives, { id: crypto.randomUUID(), text: value }] } : item))
    setObjectiveDrafts((current) => ({ ...current, [itemId]: '' }))
  }

  function deleteObjective(itemId: string, objectiveId: string) {
    const account = items.find((item) => item.id === itemId)
    if (!account) return
    onChange(items.map((item) => item.id === itemId ? { ...item, objectives: item.objectives.filter((objective) => objective.id !== objectiveId) } : item))
  }

  function deleteAccount(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>{title}</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">{helperText}</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input
                  aria-label="Account name"
                  value={item.account}
                  placeholder={accountPlaceholder}
                  onChange={(event) => updateAccount(item.id, event.target.value)}
                />
                <button type="button" className="destructive-button" onClick={() => deleteAccount(item.id)}>Delete</button>
              </div>
              {item.objectives.length > 0 ? (
                <ul className="weekly-plan-inline-list">
                  {item.objectives.map((objective) => (
                    <li key={objective.id}>
                      <input
                        aria-label="Objective"
                        value={objective.text}
                        onChange={(event) => updateObjective(item.id, objective.id, event.target.value)}
                      />
                      <button type="button" onClick={() => deleteObjective(item.id, objective.id)}>Remove</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="weekly-plan-list-empty">No objectives added yet.</p>}
              <div className="weekly-plan-inline-input-row">
                <input
                  aria-label="Add objective"
                  value={objectiveDrafts[item.id] ?? ''}
                  placeholder={objectivePlaceholder}
                  onChange={(event) => setObjectiveDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                />
                <button type="button" onClick={() => addObjective(item.id)}>Add</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">{emptyText}</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addAccount}>{addButtonText}</button>
      </div>
    </section>
  )
}

function WeeklyPlanCommercialPrioritySection({
  items,
  onChange,
  title = 'Commercial Priorities',
  helperText = 'Capture the priorities that should keep projects moving this week.',
}: {
  items: CommercialPriority[]
  onChange: (items: CommercialPriority[]) => void
  title?: string
  helperText?: string
}) {
  function updateItem(itemId: string, updates: Partial<CommercialPriority>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  const [newItemId, setNewItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!newItemId) return
    const timer = window.setTimeout(() => setNewItemId(null), 520)
    return () => window.clearTimeout(timer)
  }, [newItemId])

  function addItem() {
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, text: '', opportunity: '', account: '', product: '' }])
    setNewItemId(itemId)
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>{title}</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">{helperText}</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input
                  aria-label="Commercial priority opportunity"
                  value={item.opportunity ?? ''}
                  placeholder="Opportunity"
                  onChange={(event) => updateItem(item.id, { opportunity: event.target.value || undefined })}
                />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-two-column-grid">
                <input
                  aria-label="Commercial priority action"
                  value={item.text}
                  placeholder="Action"
                  onChange={(event) => updateItem(item.id, { text: event.target.value })}
                />
                <input
                  aria-label="Commercial priority account"
                  value={item.account ?? ''}
                  placeholder="Account (optional)"
                  onChange={(event) => updateItem(item.id, { account: event.target.value || undefined })}
                />
                <input
                  aria-label="Commercial priority product"
                  value={item.product ?? ''}
                  placeholder="Product (optional)"
                  onChange={(event) => updateItem(item.id, { product: event.target.value || undefined })}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No {title.toLowerCase()} captured yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add issue</button>
      </div>
    </section>
  )
}

function WeeklyPlanSuccessMeasureSection({
  items,
  onChange,
  title = 'Success Measures',
  helperText = 'Track the measurable indicators of success for the week, with optional target and category context.',
  emptyText = 'No success measures captured yet.',
  addButtonText = '+ Add measure',
}: {
  items: SuccessMeasure[]
  onChange: (items: SuccessMeasure[]) => void
  title?: string
  helperText?: string
  emptyText?: string
  addButtonText?: string
}) {
  function updateItem(itemId: string, updates: Partial<SuccessMeasure>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  const [newItemId, setNewItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!newItemId) return
    const timer = window.setTimeout(() => setNewItemId(null), 520)
    return () => window.clearTimeout(timer)
  }, [newItemId])

  function addItem() {
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, text: '', target: '', unit: '', category: 'coverage' }])
    setNewItemId(itemId)
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>{title}</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">{helperText}</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input
                  aria-label="Success measure"
                  value={item.text}
                  placeholder="Measure / description"
                  onChange={(event) => updateItem(item.id, { text: event.target.value })}
                />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-two-column-grid">
                <input
                  aria-label="Target"
                  value={item.target ?? ''}
                  placeholder="Target (optional)"
                  onChange={(event) => updateItem(item.id, { target: event.target.value || undefined })}
                />
                <input
                  aria-label="Unit"
                  value={item.unit ?? ''}
                  placeholder="Unit (optional)"
                  onChange={(event) => updateItem(item.id, { unit: event.target.value || undefined })}
                />
              </div>
              <label className="weekly-plan-field-label">
                Category
                <select
                  aria-label="Success measure category"
                  value={item.category ?? 'coverage'}
                  onChange={(event) => updateItem(item.id, { category: event.target.value as SuccessMeasure['category'] })}
                >
                  <option value="coverage">Coverage</option>
                  <option value="engagement">Engagement</option>
                  <option value="commercial">Commercial</option>
                  <option value="account">Account</option>
                  <option value="scientific">Scientific</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">{emptyText}</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>{addButtonText}</button>
      </div>
    </section>
  )
}

function WeeklyPlanScreen({ template = FIELD_SALES_TEMPLATE }: { template?: WeekFlowTemplate }) {
  const terminology = getTemplateTerminology(template)
  const [weekStart, setWeekStart] = useState(getSelectedWeekStart)
  const [plan, setPlan] = useState<WeeklyPlan>(() => loadWeeklyPlan(getSelectedWeekStart()))
  const [cloudStatus, setCloudStatus] = useState('')
  const planHydrated = useRef(false)
  const planIntelligence = useMemo(() => deriveWeeklyIntelligence({
    selectedWeek: weekStart,
    plan,
    activities: loadDailyActivities(weekStart),
    followUps: loadFollowUps(weekStart),
    template,
  }), [plan, weekStart, template])

  useEffect(() => {
    if (!planHydrated.current) return
    let active = true
    saveWeeklyPlanAsync(plan).then((savedToCloud) => {
      if (active && savedToCloud) setCloudStatus('Saved to cloud')
    })
    return () => { active = false }
  }, [plan])

  useEffect(() => {
    let active = true
    planHydrated.current = false
    loadWeeklyPlanAsync(weekStart).then((loadedPlan) => {
      if (active) {
        setPlan(loadedPlan)
        planHydrated.current = true
      }
    })
    return () => { active = false }
  }, [weekStart])

  function changeWeek(value: string) {
    const nextWeekStart = getWeekStartFromInput(value)
    setSelectedWeekStart(nextWeekStart)
    setWeekStart(nextWeekStart)
    setPlan(loadWeeklyPlan(nextWeekStart))
    setCloudStatus('')
  }

  function updateDay(updatedDay: DayPlan) {
    setPlan((currentPlan) => ({
      ...currentPlan,
      days: currentPlan.days.map((day) => day.id === updatedDay.id ? updatedDay : day),
    }))
  }

  return (
    <main className="weekly-plan-screen" id="weekly-plan">
      <div className="plan-page-heading">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h1>Weekly Work Plan</h1>
          <p className="plan-intro">Align weekly priorities, {terminology.accounts.toLowerCase()} and {terminology.activityPlural.toLowerCase()} for the selected week.</p>
        </div>{cloudStatus && <span role="status">{cloudStatus}</span>}
        <div className="week-selector">
          <label htmlFor="reporting-week">Reporting week</label>
          <input id="reporting-week" type="week" value={toWeekInput(weekStart)} onChange={(event) => changeWeek(event.target.value)} />
          <span>{formatWeekRange(weekStart)}</span>
        </div>
      </div>
      <section className="plan-coverage" aria-labelledby="plan-coverage-heading">
        <div className="plan-coverage-heading"><div><p className="eyebrow">WeekFlow Intelligence</p><h2 id="plan-coverage-heading">Plan Coverage</h2></div><span>Derived from Daily Activity</span></div>
        <div className="plan-coverage-days">{plan.days.map((day) => {
          const dayGaps = planIntelligence.planGaps.filter((gap) => gap.dayLabel === day.label)
          const plannedCount = day.categories.facilities.length + day.categories.virtualEngagements.length + day.categories.primaryObjectives.length + day.categories.accountObjectives.length + day.categories.commercialPriorities.length + day.categories.successMeasures.length
          const status = plannedCount === 0 ? 'No items' : dayGaps.length === 0 ? 'Covered' : dayGaps.length < plannedCount ? 'Partially covered' : dayGaps.some((gap) => gap.status === 'needs review') ? 'Needs review' : 'Not evidenced'
          return <div className="plan-coverage-day" key={day.id}><div><strong>{day.label}</strong><span>{plannedCount === 0 ? 'No matchable plan items' : `${plannedCount} planned item${plannedCount === 1 ? '' : 's'}`}</span></div><em className={`coverage-status ${status.toLowerCase().replace(' ', '-')}`}>{status}</em></div>
        })}</div>
        {planIntelligence.planGaps.length > 0 && <ul className="plan-coverage-gaps">{planIntelligence.planGaps.filter((gap) => gap.status !== 'covered').slice(0, 5).map((gap) => <li key={`${gap.itemId}-${gap.dayLabel}`}><strong>{gap.item}</strong><span>{gap.status}</span><small>{gap.reason}</small></li>)}</ul>}
      </section>
      <div className="weekly-plan-top-level">
        <WeeklyPlanTextListSection
          title={template.id === 'project-management' ? 'Weekly Objectives' : terminology.objectives === 'Objectives' ? 'Weekly Strategic Objectives' : terminology.objectives}
          summary={`${plan.weeklyStrategicObjectives.length} item${plan.weeklyStrategicObjectives.length === 1 ? '' : 's'}`}
          items={plan.weeklyStrategicObjectives}
          emptyText={template.id === 'project-management' ? 'No weekly objectives captured for this week yet.' : `No ${terminology.objectives.toLowerCase()} captured for this week yet.`}
          placeholder={template.id === 'project-management' ? 'Add a weekly objective' : `Add ${terminology.objective.toLowerCase()}`}
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, weeklyStrategicObjectives: items }))}
        />
        {template.id === 'field-service' && <WeeklyPlanVirtualEngagementSection
          items={plan.virtualEngagementPlan}
          title="Preventive Maintenance"
          helperText="Plan preventive maintenance work, routine checks and scheduled service activity for the week."
          emptyText="No preventive maintenance planned yet."
          addButtonText="+ Add maintenance"
          contactPlaceholder="Add customer contact"
          objectivePlaceholder="Describe the objective of this maintenance task"
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, virtualEngagementPlan: items }))}
        />}
        {template.id === 'field-service' && <WeeklyPlanAccountObjectiveSection
          items={plan.keyAccountObjectives}
          title="Work Orders / Jobs"
          helperText="Capture the service jobs and work requests scheduled for the week."
          emptyText="No service jobs captured yet."
          addButtonText="+ Add job"
          accountPlaceholder="Site / service location"
          objectivePlaceholder="Add service job"
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, keyAccountObjectives: items }))}
        />}
        {template.id === 'small-business' && <WeeklyPlanVirtualEngagementSection
          items={plan.virtualEngagementPlan}
          title="Leads / Opportunities"
          helperText="Track potential customers, quotes, and sales opportunities that need attention this week."
          emptyText="No leads or opportunities captured yet."
          addButtonText="+ Add lead"
          contactPlaceholder="Add customer / client"
          objectivePlaceholder="Describe the opportunity or follow-up needed"
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, virtualEngagementPlan: items }))}
        />}
        {template.id === 'small-business' && <WeeklyPlanAccountObjectiveSection
          items={plan.keyAccountObjectives}
          title="Orders / Sales"
          helperText="Capture customers, commercial commitments, and sales work that needs attention this week."
          emptyText="No orders or sales work captured yet."
          addButtonText="+ Add order / sale"
          accountPlaceholder="Customer / client"
          objectivePlaceholder="Add sales objective"
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, keyAccountObjectives: items }))}
        />}
        {template.id !== 'field-service' && template.id !== 'project-management' && template.id !== 'small-business' && <WeeklyPlanVirtualEngagementSection
          items={plan.virtualEngagementPlan}
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, virtualEngagementPlan: items }))}
        />}
        {template.id !== 'field-service' && template.id !== 'project-management' && template.id !== 'small-business' && <WeeklyPlanAccountObjectiveSection
          items={plan.keyAccountObjectives}
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, keyAccountObjectives: items }))}
        />}
        <WeeklyPlanCommercialPrioritySection
          items={plan.commercialPriorities}
          title={template.id === 'project-management' ? 'Priorities' : template.id === 'field-service' ? 'Priority Issues' : template.id === 'small-business' ? 'Business Priorities' : undefined}
          helperText={template.id === 'small-business' ? 'Capture the highest-priority business matters that need attention this week.' : template.id === 'field-service' ? 'Capture the service issues that need attention this week, with optional site and asset context.' : 'Capture the priorities that should keep projects moving this week.'}
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, commercialPriorities: items }))}
        />
        <WeeklyPlanSuccessMeasureSection
          items={plan.successMeasures}
          title={template.id === 'field-service' ? 'Service Targets' : 'Success Measures'}
          helperText={template.id === 'field-service' ? 'Track the service goals and measurable targets for the week.' : 'Track the measurable indicators of success for the week, with optional target and category context.'}
          emptyText={template.id === 'field-service' ? 'No service targets captured yet.' : 'No success measures captured yet.'}
          addButtonText={template.id === 'field-service' ? '+ Add target' : '+ Add measure'}
          onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, successMeasures: items }))}
        />
      </div>
      <section className="daily-field-plan-section" aria-labelledby="daily-field-plan-heading">
        <div className="weekly-plan-summary-header daily-plan-header">
          <div>
            <p className="eyebrow">Weekly Plan</p>
            <h2 id="daily-field-plan-heading">Daily {terminology.activity} Plan</h2>
          </div>
          <span>Monday-Sunday</span>
        </div>
        <p className="weekly-plan-helper">Plan {terminology.accounts.toLowerCase()}, {terminology.people.toLowerCase()} and {terminology.objectives.toLowerCase()} for each working day.</p>
        <div className="days-list">
          {plan.days.map((day) => <DayPlanSection day={day} key={day.id} onChange={updateDay} template={template} />)}
        </div>
      </section>
    </main>
  )
}

function hasPlanData(plan: WeeklyPlan) {
  return plan.days.some((day) => PLAN_CATEGORIES.some((category) => day.categories[category].length > 0))
    || plan.weeklyStrategicObjectives.length > 0
    || plan.virtualEngagementPlan.length > 0
    || plan.keyAccountObjectives.length > 0
    || plan.commercialPriorities.length > 0
    || plan.successMeasures.length > 0
}

function getWeekYear(weekStart: string) {
  return Number(toWeekInput(weekStart).slice(0, 4))
}

function getWeekNumber(weekStart: string) {
  return toWeekInput(weekStart).split('-W')[1]
}

function ReportHistory({ selectedWeek, onSelectWeek, template = FIELD_SALES_TEMPLATE }: { selectedWeek: string; onSelectWeek: (weekStart: string) => void; template?: WeekFlowTemplate }) {
  const [exportingWeek, setExportingWeek] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState('')
  const reports = getStoredWeekStarts().map((weekStart) => {
    const plan = loadWeeklyPlan(weekStart)
    const activities = loadDailyActivities(weekStart)
    const followUps = loadFollowUps(weekStart)
    const intelligence = deriveWeeklyIntelligence({ selectedWeek: weekStart, plan, activities, followUps, template })
    return {
      weekStart,
      plan,
      activities,
      followUps,
      hasPlan: hasPlanData(plan),
      hasActivities: activities.length > 0,
      hasFollowUps: followUps.length > 0,
      readiness: intelligence.reportReadiness,
      completedFollowUps: followUps.filter((followUp) => followUp.status === 'completed').length,
    }
  }).filter((report) => report.hasPlan || report.hasActivities || report.hasFollowUps)
  const currentWeek = getCurrentWeekStart()
  const currentReport = reports.find((report) => report.weekStart === currentWeek)
  const historicalReports = reports.filter((report) => report.weekStart !== currentWeek).sort((left, right) => right.weekStart.localeCompare(left.weekStart))
  const currentYear = new Date().getFullYear()
  const years = [...new Set([
    ...historicalReports.map((report) => getWeekYear(report.weekStart)),
    ...Array.from({ length: 11 }, (_, index) => currentYear - 5 + index),
  ])].sort((left, right) => right - left)
  const [selectedYear, setSelectedYear] = useState(getWeekYear(selectedWeek))
  const filteredReports = historicalReports.filter((report) => getWeekYear(report.weekStart) === selectedYear)

  function openWeek(weekStart: string) {
    onSelectWeek(weekStart)
    navigateTo('/weekly-plan')
  }

  function readinessLabel(status: typeof reports[number]['readiness']['status']) {
    return status === 'ready' ? 'Ready to Review' : status === 'review' ? 'Needs Attention' : "Week Hasn't Started"
  }

  function renderReport(report: typeof reports[number], current = false) {
    return <article className={`report-history-item${current ? ' is-current' : ''}`} key={report.weekStart} role="listitem">
      <div><strong>{current ? 'Current Week' : `Week ${getWeekNumber(report.weekStart)}`}</strong><span>{formatWeekRange(report.weekStart)}</span><small>{current ? 'Current reporting period' : 'Previous reporting period'}</small></div>
      <div className="report-history-details"><span>{template.name}</span><strong className={`report-history-readiness is-${report.readiness.status}`}>{readinessLabel(report.readiness.status)}</strong><div className="report-history-status"><span>{report.activities.length} activit{report.activities.length === 1 ? 'y' : 'ies'}</span><span>{report.followUps.length} follow-ups</span><span>{report.completedFollowUps} completed</span></div></div>
      <div className="report-history-actions"><button type="button" onClick={() => { onSelectWeek(report.weekStart); navigateTo('/report') }}>Open Report</button>{!current && <button type="button" onClick={() => openWeek(report.weekStart)}>Open Week</button>}<button type="button" onClick={() => exportHistoricalReport(report.weekStart)} disabled={exportingWeek !== null}>{exportingWeek === report.weekStart ? 'Exporting...' : 'Export Word'}</button></div>
    </article>
  }

  async function exportHistoricalReport(weekStart: string) {
    setExportingWeek(weekStart)
    setExportMessage('')
    try {
      const report = reports.find((item) => item.weekStart === weekStart)
      if (!report) return
      const result = await exportReportWord({
        weekKey: weekStart,
        weekLabel: getFixedReportWeekLabel(weekStart),
        plan: report.plan,
        activities: report.activities,
        followUps: report.followUps,
        template,
      })
      setExportMessage(`Downloaded ${result.filename}`)
    } catch {
      setExportMessage('Word export could not be completed. Please try again.')
    } finally {
      setExportingWeek(null)
    }
  }

  return (
    <section className="report-history" aria-labelledby="report-history-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Report History</p>
          <h2 id="report-history-heading">Report History</h2>
        </div>
        <p>Reopen a saved week or export its report again.</p>
      </div>
      <label className="history-year-selector" htmlFor="history-year">Year
        <select id="history-year" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
          {years.map((year) => <option value={year} key={year}>{year}</option>)}
        </select>
      </label>
      {currentReport && <div className="report-history-current" aria-label="Current reporting week"><div className="report-history-list" role="list">{renderReport(currentReport, true)}</div></div>}
      {filteredReports.length > 0 ? <div className="report-history-list" role="list">{filteredReports.map((report) => renderReport(report))}</div> : <p className="report-history-empty">No previous reports yet. Completed weekly activity will appear here.</p>}
      {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}
    </section>
  )
}

function ReportHistoryScreen({ selectedWeek, onSelectWeek, template = FIELD_SALES_TEMPLATE }: { selectedWeek: string; onSelectWeek: (weekStart: string) => void; template?: WeekFlowTemplate }) {
  return <main className="report-history-screen"><ReportHistory selectedWeek={selectedWeek} onSelectWeek={onSelectWeek} template={template} /></main>
}

function App() {
  const [accountState, setAccountState] = useState<AccountState>(() => isSupabaseConfigured ? { status: 'loading', user: null } : { status: 'local-demo', user: null })
  const accountStatusRef = useRef<AccountState['status']>(isSupabaseConfigured ? 'loading' : 'local-demo')
  const [activeScreen, setActiveScreen] = useState(getInitialScreen)
  const [selectedWeek, setSelectedWeek] = useState(getSelectedWeekStart)
  const [selectedTemplate, setSelectedTemplate] = useState(getSelectedTemplate)
  const [currentWorkspace, setCurrentWorkspace] = useState(getCurrentWorkspace)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceTemplateId, setNewWorkspaceTemplateId] = useState('field-sales')
  const [workspaceCreateValidation, setWorkspaceCreateValidation] = useState('')
  const [workspaceCreateReturnPath, setWorkspaceCreateReturnPath] = useState('/')
  const [navigationCollapsed, setNavigationCollapsed] = useState(false)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [workspaceInitializationError, setWorkspaceInitializationError] = useState('')
  const [workspaceInitializationPending, setWorkspaceInitializationPending] = useState(false)
  const initializedWorkspaceOwnersRef = useRef(new Map<string, Promise<void>>())

  async function initializeAuthenticatedWorkspace(user: UserProfile) {
    setWorkspaceInitializationPending(true)
    const existingInitialization = initializedWorkspaceOwnersRef.current.get(user.id)
    if (existingInitialization) return existingInitialization

    const initialization = (async () => {
      setWorkspaceInitializationError('')
      const workspace = await ensureFirstWorkspaceForOwner(user.id, 'My Workspace', 'personal')
      if (!workspace) return
      const provisionedWorkspace = await provisionWorkspaceInCloud(workspace)
      setCurrentWorkspace(provisionedWorkspace)
      setSelectedTemplate(getSelectedTemplate())
      setSelectedWeek(getSelectedWeekStart())
    })().catch((error) => {
      initializedWorkspaceOwnersRef.current.delete(user.id)
      setWorkspaceInitializationError(error instanceof Error ? error.message : 'Workspace setup could not be completed. Your local workspace is still available.')
      setCurrentWorkspace(getCurrentWorkspace())
      setSelectedTemplate(getSelectedTemplate())
      setSelectedWeek(getSelectedWeekStart())
    }).finally(() => {
      setWorkspaceInitializationPending(false)
    })
    initializedWorkspaceOwnersRef.current.set(user.id, initialization)
    return initialization
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    getCurrentUser()
      .then((user) => {
        if (active) {
          const nextState: AccountState = user ? { status: 'authenticated', user } : { status: 'unauthenticated', user: null }
          accountStatusRef.current = nextState.status
          setAccountState(nextState)
          if (user && window.location.pathname !== '/reset-password') void initializeAuthenticatedWorkspace(user)
        }
      })
      .catch(() => {
        if (active) {
          accountStatusRef.current = 'unauthenticated'
          setAccountState({ status: 'unauthenticated', user: null })
        }
      })
    const unsubscribe = accountProvider.onAuthStateChange((state) => {
      if (!active) return
      const previousStatus = accountStatusRef.current
      accountStatusRef.current = state.status
      setAccountState(state)
      if (state.status === 'authenticated' && previousStatus === 'unauthenticated') {
        if (window.location.pathname !== '/reset-password') {
          void initializeAuthenticatedWorkspace(state.user)
          navigateTo('/workspaces')
        }
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    // Initial hash-to-path redirect on app load
    handleOldHashRoutes()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showCreateWorkspace) {
          setShowCreateWorkspace(false)
          setNewWorkspaceName('')
          setNewWorkspaceTemplateId('field-sales')
          setWorkspaceCreateValidation('')
          return
        }
        setNavigationOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCreateWorkspace])

  useEffect(() => {
    // Monitor hash changes for backward compatibility (e.g., old bookmarks, external links)
    const handleHashChange = () => {
      handleOldHashRoutes()
    }

    const handleLocationChange = () => setActiveScreen(getScreenFromPath())
    const handleTemplateChange = () => setSelectedTemplate(getSelectedTemplate())
    const handleWeekChange = (event: Event) => {
      const weekStart = (event as CustomEvent<string>).detail
      if (typeof weekStart === 'string') setSelectedWeek(weekStart)
    }
    const handleWorkspaceChange = () => {
      setCurrentWorkspace(getCurrentWorkspace())
      setSelectedWeek(getSelectedWeekStart())
      setSelectedTemplate(getSelectedTemplate())
      setWorkspaceMenuOpen(false)
    }
    window.addEventListener('hashchange', handleHashChange)
    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener('weekflow-week-change', handleWeekChange)
    window.addEventListener('weekflow-template-change', handleTemplateChange)
    window.addEventListener('weekflow-workspace-change', handleWorkspaceChange)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('weekflow-week-change', handleWeekChange)
      window.removeEventListener('weekflow-template-change', handleTemplateChange)
      window.removeEventListener('weekflow-workspace-change', handleWorkspaceChange)
    }
  }, [])

  function changeWeek(weekStart: string) {
    setSelectedWeekStart(weekStart)
  }

  function openTemplateSelection() {
    navigateTo('/template-selection')
  }

  function completeTemplateSelection() {
    setSelectedTemplate(getSelectedTemplate())
    navigateTo('/')
  }

  function selectWorkspace(workspaceId: string) {
    const didSelect = setCurrentWorkspaceId(workspaceId)
    if (!didSelect) return
    setCurrentWorkspace(getCurrentWorkspace())
    setSelectedWeek(getSelectedWeekStart())
    setSelectedTemplate(getSelectedTemplate())
    setWorkspaceMenuOpen(false)
  }

  async function createWorkspaceFromDialog() {
    const trimmedName = normalizeWorkspaceName(newWorkspaceName)
    if (!trimmedName) {
      setWorkspaceCreateValidation('Please enter a workspace name.')
      return
    }

    if (isWorkspaceNameTaken(trimmedName)) {
      setWorkspaceCreateValidation('A workspace with this name already exists.')
      return
    }

    const ownerId = accountState.status === 'authenticated' ? accountState.user.id : DEFAULT_ACCOUNT_ID
    const workspace = createWorkspace(trimmedName, newWorkspaceTemplateId, ownerId)
    let provisionedWorkspace = workspace
    if (accountState.status === 'authenticated') {
      try {
        provisionedWorkspace = await provisionWorkspaceInCloud(workspace)
      } catch {
        setWorkspaceCreateValidation('Workspace saved locally, but cloud provisioning failed. Please try again later.')
        setCurrentWorkspace(workspace)
        return
      }
    }
    setCurrentWorkspace(provisionedWorkspace)
    setSelectedTemplate(getSelectedTemplate())
    setSelectedWeek(getSelectedWeekStart())
    setShowCreateWorkspace(false)
    setNewWorkspaceName('')
    setNewWorkspaceTemplateId('field-sales')
    setWorkspaceCreateValidation('')
    setWorkspaceMenuOpen(false)
    navigateTo(workspaceCreateReturnPath)
  }

  async function handleSignOut() {
    try {
      await signOut()
      setAccountState({ status: 'unauthenticated', user: null })
      navigateTo('/')
    } catch {
      // The shell remains available if sign-out cannot complete.
    }
  }

  if (window.location.pathname === '/forgot-password') return <ForgotPasswordScreen />
  if (window.location.pathname === '/reset-password') return <ResetPasswordScreen />
  if (accountState.status === 'loading' || workspaceInitializationPending) return <AuthLoadingScreen />
  if (accountState.status === 'unauthenticated') {
    if (window.location.pathname === '/') return <PublicLandingScreen onSignIn={() => navigateTo('/sign-in')} onCreateAccount={() => navigateTo('/sign-up')} />
    return <AuthenticationScreen initialMode={window.location.pathname === '/sign-up' ? 'signup' : 'signin'} />
  }

  return (
    <div className="app-shell">
      <Header
        selectedWeek={selectedWeek}
        currentWorkspace={currentWorkspace}
        currentTemplate={selectedTemplate}
        workspaceMenuOpen={workspaceMenuOpen}
        onToggleWorkspaceMenu={() => setWorkspaceMenuOpen((current) => !current)}
        onOpenNavigation={() => setNavigationOpen(true)}
        onSelectWorkspace={selectWorkspace}
        onOpenCreateWorkspace={() => {
          setWorkspaceCreateReturnPath('/')
          setWorkspaceCreateValidation('')
          setNewWorkspaceName('')
          setNewWorkspaceTemplateId('field-sales')
          setShowCreateWorkspace(true)
          setWorkspaceMenuOpen(false)
        }}
        onOpenProfile={() => navigateTo('/profile')}
        user={accountState.status === 'authenticated' ? accountState.user : null}
        onSignOut={handleSignOut}
      />
      {workspaceInitializationError && <p className="workspace-initialization-error" role="status">{workspaceInitializationError}</p>}
      <WorkspaceCreateDialog
        isOpen={showCreateWorkspace}
        templateId={newWorkspaceTemplateId}
        onTemplateChange={(value) => {
          setNewWorkspaceTemplateId(value)
          setWorkspaceCreateValidation('')
        }}
        onNameChange={(value) => {
          setNewWorkspaceName(value)
          if (workspaceCreateValidation) setWorkspaceCreateValidation('')
        }}
        workspaceName={newWorkspaceName}
        onClose={() => {
          setShowCreateWorkspace(false)
          setNewWorkspaceName('')
          setNewWorkspaceTemplateId('field-sales')
          setWorkspaceCreateValidation('')
        }}
        onCreate={createWorkspaceFromDialog}
        validationMessage={workspaceCreateValidation}
      />
      {activeScreen !== 'template-selection' && activeScreen !== 'profile' && <WeekNavigation weekStart={selectedWeek} onChange={changeWeek} />}
      <div className="app-body">
        <AppNavigation activeScreen={activeScreen} templateName={selectedTemplate.name} onSwitchTemplate={openTemplateSelection} onNavigate={navigateTo} collapsed={navigationCollapsed} mobileOpen={navigationOpen} onToggleCollapse={() => setNavigationCollapsed((current) => !current)} onClose={() => setNavigationOpen(false)} />
        {navigationOpen && <button className="navigation-overlay" type="button" aria-label="Close navigation" onClick={() => setNavigationOpen(false)} />}
        {activeScreen === 'profile' ? <ProfileSettingsScreen user={accountState.status === 'authenticated' ? accountState.user : { id: '', displayName: '', email: '', createdAt: '', updatedAt: '' }} workspaces={loadWorkspaces()} currentWorkspaceId={currentWorkspace.id} onProfileUpdated={(profile) => setAccountState((state) => state.status === 'authenticated' ? { ...state, user: profile } : state)} onWorkspaceSelected={selectWorkspace} /> : activeScreen === 'workspaces' ? <WorkspaceHomeScreen user={accountState.status === 'authenticated' ? accountState.user : null} currentWorkspaceId={currentWorkspace.id} onOpenWorkspace={(workspaceId) => { selectWorkspace(workspaceId); navigateTo('/') }} onCreateWorkspace={() => {
          setWorkspaceCreateReturnPath('/workspaces')
          setWorkspaceCreateValidation('')
          setNewWorkspaceName('')
          setNewWorkspaceTemplateId('field-sales')
          setShowCreateWorkspace(true)
        }} /> : activeScreen === 'template-selection' ? <TemplateSelectionScreen onSelect={completeTemplateSelection} /> : activeScreen === 'weekly-plan' ? <WeeklyPlanScreen key={`${selectedWeek}-${selectedTemplate.id}`} template={selectedTemplate} /> : activeScreen === 'daily-activity' ? <DailyActivityScreen key={`${selectedWeek}-${selectedTemplate.id}`} template={selectedTemplate} /> : activeScreen === 'follow-ups' ? <FollowUpsScreen key={`${currentWorkspace.id}-${selectedWeek}-${selectedTemplate.id}`} template={selectedTemplate} /> : activeScreen === 'report' ? <GenerateReportScreen key={`${selectedWeek}-${selectedTemplate.id}`} template={selectedTemplate} /> : activeScreen === 'report-history' ? <ReportHistoryScreen selectedWeek={selectedWeek} onSelectWeek={changeWeek} template={selectedTemplate} /> : <OverviewScreen selectedWeek={selectedWeek} template={selectedTemplate} onNavigate={(screen) => { navigateTo(`/${screen === 'overview' ? '' : screen}`) }} />}
      </div>
    </div>
  )
}

export default App
