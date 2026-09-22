import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import logoImage from './assets/weekflow-logo.png'
import DailyActivityScreen from './components/DailyActivityScreen'
import FollowUpsScreen from './components/FollowUpsScreen'
import OverviewScreen from './components/OverviewScreen'
import ProfileSettingsScreen from './components/ProfileSettingsScreen'
import TemplateIcon, { AppIcon } from './components/TemplateIcon'
import { getTimeAwareGreeting } from './utils/greeting'
import { loadDailyActivities } from './storage/dailyActivityStorage'
import { loadFollowUps, loadFollowUpsAsync, saveFollowUpsAsync } from './storage/followUpsStorage'
import { deriveWeeklyIntelligence } from './intelligence/intelligenceEngine'
import { getSmartStartCandidateKeysFromCarryForwardSelection, getSmartStartCandidates, mergeSmartStartSelections, type SmartStartCandidate } from './intelligence/smartStart'
import { loadSmartStartCompletion, loadSmartStartCompletionAsync, saveSmartStartCompletionAsync, type SmartStartCompletion } from './storage/smartStartStorage'
import {
  getCurrentWeekStart,
  getPlanningWeekStart,
  getPreviousWeekStart,
  getSelectedWeekStart,
  getWeekSelectionSource,
  getWeekStartFromInput,
  loadWeeklyPlan,
  loadWeeklyPlanAsync,
  saveWeeklyPlanAsync,
  setSelectedWeekStart,
  toWeekInput,
} from './storage/weeklyPlanStorage'
import {
  type AccountObjective,
  type CommunicationPlanItem,
  type CommunityEngagementItem,
  type CommercialPriority,
  type DayId,
  type DayPlan,
  type DocumentationPlanItem,
  type MonitoringImpactTarget,
  type PlanCategory,
  type PlanItem,
  type ProgrammeActivity,
  type ResourceLogisticsItem,
  type StakeholderPlanItem,
  type SuccessMeasure,
  type VirtualEngagementPlanItem,
  type VolunteerPlanItem,
  type WeeklyObjective,
  type WeeklyPlan,
  type WeeklyProgrammeContext,
} from './types/weeklyPlan'
import type { FollowUp } from './types/followUp'
import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from './config/templates'
import { getReportHistoryEntry, loadReportHistoryEntries, type ReportHistoryEntry } from './storage/reportHistoryStorage'
import { getSelectedTemplate } from './storage/templateStorage'
import { getPlanningCategoryDescriptors, getPlanningCategoryItems, type PlanningCategoryDescriptor } from './planning/planningCategoryAdapter'
import { FieldOperationsPlanning } from './components/FieldOperationsPlanning'
import EducationWeeklyPlan from './components/EducationWeeklyPlan'
import EducationRecordsScreen from './components/EducationRecordsScreen'
import CustomTemplateBuilder from './components/CustomTemplateBuilder'
import CustomTargetsSummary from './components/CustomTargetsSummary'
import ReportComparisonScreen from './components/ReportComparisonScreen'
import { loadCustomTemplateConfig, saveCustomTemplateConfig } from './storage/customTemplateStorage'
import type { CustomTemplateConfig } from './types/customTemplate'
import { getTemplateTerminology } from './config/templateTerminology'
import { WEEK_DAY_IDS } from './utils/week'
import { navigateTo } from './utils/navigation'
import { clearWorkspaceOwnerLocalData, createWorkspace, DEFAULT_ACCOUNT_ID, deleteWorkspace, ensureFirstWorkspaceForOwner, getCurrentWorkspace, getCurrentWorkspaceId, isWorkspaceNameTaken, loadWorkspaces, normalizeWorkspaceName, provisionWorkspaceInCloud, renameWorkspace, setCurrentWorkspaceId, setWorkspaceOwner } from './storage/workspaceStorage'
import { getAvailableTemplates } from './config/templates'
import { accountProvider, type AccountState, createAccount, getCurrentUser, requestPasswordReset, signIn, signOut, updatePassword } from './account'
import { isAuthenticatedBootstrapBlocked } from './auth/bootstrapState'
import { isSupabaseConfigured } from './lib/supabase'
import type { UserProfile, Workspace } from './types/workspace'
import { getReportMetadataFields, type ReportMetadata } from './report/reportMetadata'
import { buildReportComparison, validateReportComparison } from './report/reportComparison'
import { applyTheme, getStoredThemePreference } from './theme'
import './App.css'
import './landing.css'
import LandingShootingStars from './LandingShootingStars'
import LandingCustomCursor from './components/LandingCustomCursor'
import SupportScreen from './SupportScreen'
import ContactScreen from './ContactScreen'
import { SupportGettingStartedPage, SupportGuidesPage, SupportTemplatesPage } from './SupportGuidePages'

const GenerateReportScreen = lazy(() => import('./components/GenerateReportScreen'))

const navigationItems = [
  { label: 'Overview', path: '/', icon: 'overview' as const },
  { label: 'Weekly Plan', path: '/weekly-plan', icon: 'weekly-plan' as const },
  { label: 'Daily Activity', path: '/daily-activity', icon: 'daily-activity' as const },
  { label: 'Follow-ups', path: '/follow-ups', icon: 'follow-ups' as const },
  { label: 'Generate Report', path: '/report', icon: 'report' as const },
  { label: 'Report History', path: '/report-history', icon: 'report-history' as const },
  { label: 'Workspaces', path: '/workspaces', icon: 'workspaces' as const },
]

const navigationGroups = [
  { id: 'workspace', label: 'Workspace', items: navigationItems.slice(0, 5) },
  { id: 'history', label: 'History', items: navigationItems.slice(5, 6) },
  { id: 'configuration', label: 'Configuration', items: navigationItems.slice(6) },
] as const

const getSectionIdForScreen = (screen: string): string | null => {
  if (['overview', 'weekly-plan', 'daily-activity', 'education-records', 'follow-ups', 'report'].includes(screen)) return 'workspace'
  if (screen === 'report-history') return 'history'
  if (screen === 'workspaces') return 'configuration'
  return null
}

const maximumUsernameLength = 80

function getScreenFromPath(): string {
  const pathname = window.location.pathname
  if (pathname === '/auth/callback') return 'auth-callback'
  if (pathname === '/sign-in') return 'sign-in'
  if (pathname === '/sign-up') return 'sign-up'
  if (pathname === '/forgot-password') return 'forgot-password'
  if (pathname === '/reset-password') return 'reset-password'
  if (pathname === '/support') return 'support'
  if (pathname === '/contact') return 'contact'
  if (pathname === '/guides') return 'guides'
  if (pathname === '/guides/getting-started') return 'getting-started'
  if (pathname === '/templates') return 'templates'
  if (pathname === '/profile') return 'profile'
  if (pathname === '/workspaces') return 'workspaces'
  if (pathname === '/weekly-plan') return 'weekly-plan'
  if (pathname === '/daily-activity') return 'daily-activity'
  if (pathname === '/education-records') return 'education-records'
  if (pathname === '/follow-ups') return 'follow-ups'
  if (pathname === '/report') return 'report'
  if (pathname === '/report-history') return 'report-history'
  if (pathname === '/report-comparison') return 'report-comparison'
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

type LandingHeroTemplate = {
  id: string
  name: string
  user: string
  metrics: readonly string[]
  rows: readonly string[]
  status: string
  date: string
  progress: number | null
  progressLabel?: string
  nextAction?: string
}

const landingHeroTemplates: LandingHeroTemplate[] = [
  { id: 'field-sales', name: 'Pharma Field Sales', user: 'Sarah', metrics: ['8 Activities', '3 Follow-ups', '5 Accounts'], rows: ['UPTH Urology', 'RSUTH Oncology', 'Alpha Pharmacy'], status: 'Report readiness · 86%', date: 'This week', progress: null, nextAction: 'Confirm pharmacy availability' },
  { id: 'field-service', name: 'Field Operations', user: 'Daniel', metrics: ['12 Jobs', '9 Completed', '3 Open'], rows: ['Generator service', 'Equipment inspection', 'Customer repair'], status: '3 follow-ups open', date: 'Mon 12 Aug', progress: null, nextAction: 'Review recurring equipment issue' },
  { id: 'project-management', name: 'Project Management', user: 'Michael', metrics: ['14 Tasks', '9 Done', '3 Open'], rows: ['Website redesign', 'Client review', 'Content delivery', 'Final QA'], status: '2 decisions pending', date: 'Sprint week 4', progress: 64, progressLabel: 'Weekly progress · 64%' },
  { id: 'small-business', name: 'Small Business', user: 'Amaka', metrics: ['7 Customers', '11 Tasks', '4 Follow-ups'], rows: ['Customer orders', 'Supplier follow-up', 'Outstanding invoice', 'Delivery coordination'], status: 'Week on track', date: 'Week of Aug 12', progress: null, nextAction: 'Confirm supplier delivery' },
  { id: 'ngo-community', name: 'NGO & Community Work', user: 'David', metrics: ['6 Activities', '4 Communities', '8 Follow-ups'], rows: ['Community outreach', 'Partner meeting', 'Volunteer coordination', 'Field visit'], status: '5 actions open', date: 'August review', progress: null, nextAction: 'Confirm community meeting' },
  { id: 'education', name: 'Education', user: 'Grace', metrics: ['5 Lessons', '3 Assessments', '7 Follow-ups'], rows: ['Lesson delivery', 'Class assessment', 'Student support', 'Parent follow-up'], status: '2 support actions open', date: 'Term week 6', progress: 80, progressLabel: 'Teaching plan · 80%' },
  { id: 'personal', name: 'Personal Productivity', user: 'Tunde', metrics: ['9 Tasks', '6 Completed', '2 Follow-ups'], rows: ['Deep work', 'Admin tasks', 'Personal goal', 'Errands'], status: '2 next actions', date: 'Today, 12 Aug', progress: 67, progressLabel: 'Weekly progress · 67%' },
  { id: 'custom', name: 'Custom Workspace', user: 'Alex', metrics: ['10 Items', '7 Completed', '3 Open'], rows: ['Priority item', 'Custom activity', 'Next action', 'Review'], status: 'Ready to review', date: 'Current week', progress: 70, progressLabel: 'Weekly progress · 70%' },
]

const landingHeroGreetings = ['Good morning', 'Good afternoon', 'Good evening', 'Hello'] as const

function LandingHeroTemplateCarousel() {
  const cards = [...landingHeroTemplates, ...landingHeroTemplates]
  return <div className="landing-template-carousel" aria-label="WeekFlow template dashboard previews"><div className="landing-template-track">{cards.map((template, index) => <article className={`landing-template-card landing-template-card-${template.id}`} key={`${template.id}-${index}`} style={{ ['--greeting-phase' as string]: `${-((index % landingHeroTemplates.length) % 4) * 1.5}s` }}><div className="landing-template-card-header"><div className="landing-template-card-identity"><span className="landing-template-avatar">{template.user.charAt(0)}</span><div className="landing-template-greeting" aria-label={`Illustrative greeting for ${template.user}`}>{landingHeroGreetings.map((greeting, greetingIndex) => <strong key={greeting} style={{ ['--greeting-index' as string]: greetingIndex }}>{greeting}, {template.user}</strong>)}<small>{template.name}</small></div></div><span className="landing-template-date">{template.date}</span></div><div className="landing-template-card-metrics">{template.metrics.map((metric) => { const [value, ...labelParts] = metric.split(' '); return <span key={metric}><b>{value}</b>{labelParts.join(' ')}</span> })}</div><div className="landing-template-card-content"><div className="landing-template-card-rows">{template.rows.map((row, rowIndex) => <span key={row}><i className={rowIndex < 2 ? 'is-done' : 'is-open'}>{rowIndex < 2 ? '✓' : 'o'}</i>{row}</span>)}</div><div className="landing-template-card-footer"><span className="landing-template-status">{template.status}</span>{template.progress !== null && <span className="landing-template-progress"><b>{template.progressLabel}</b><i style={{ width: `${template.progress}%` }} /></span>}{template.nextAction && <small className="landing-template-next-action">Next: {template.nextAction}</small>}</div></div></article>)}</div></div>
}

const landingProductStages = [
  { number: '01', label: 'PLAN', title: 'Plan the week with clarity.', copy: 'Set objectives, organise daily work, and know what needs to happen before the week begins.' },
  { number: '02', label: 'ACTIVITY', title: 'Capture what actually happened.', copy: 'Turn planned work into a clear record of the activities, outcomes, and next actions that happened during the week.' },
  { number: '03', label: 'FOLLOW-UP', title: 'Keep every next action visible.', copy: 'Capture unresolved work, assign priority, and carry the right actions forward.' },
  { number: '04', label: 'REVIEW', title: 'See what the week became.', copy: 'Review the work completed, outcomes captured, unresolved actions, and what needs attention before reporting.' },
  { number: '05', label: 'REPORT', title: 'Turn the week into a report.', copy: "WeekFlow brings the week's work together into a structured report ready to review and export." },
] as const

function LandingProductMockup({ stage }: { stage: typeof landingProductStages[number] }) {
  if (stage.label === 'PLAN') return <div className="landing-product-mockup landing-mockup-plan"><div className="landing-mockup-bar"><b>Weekly Plan</b><span>Week of Aug 12 - Aug 18</span></div><div className="landing-mockup-plan-head"><div><small>Current objectives</small><strong>Focus the week before it starts.</strong></div><span className="landing-mockup-date">Selected week</span></div><div className="landing-mockup-objectives"><span><i>01</i>Priority accounts</span><span><i>02</i>Team follow-through</span><span><i>03</i>Report readiness</span></div><div className="landing-mockup-days"><b>MON</b><span>Plan priorities</span><b>TUE</b><span>Account activity</span><b>WED</b><span>Follow-up review</span><b>THU</b><span>Open work</span></div></div>
  if (stage.label === 'ACTIVITY') return <div className="landing-product-mockup landing-mockup-activity"><div className="landing-mockup-bar"><b>Daily Activity</b><span>Planned work <em>Actual activity</em></span></div><div className="landing-mockup-activity-focus"><span>12 Aug</span><strong>What happened today?</strong><small>Capture the work as it unfolds.</small></div><div className="landing-mockup-activity-row"><i className="is-done">✓</i><div><b>Account meeting</b><small>Outcome recorded · Next action added</small></div><span>09:30</span></div><div className="landing-mockup-activity-row"><i className="is-done">✓</i><div><b>Team coordination</b><small>Notes and intelligence captured</small></div><span>13:00</span></div><div className="landing-mockup-activity-row"><i className="is-open">o</i><div><b>Unplanned follow-through</b><small>Needs a next action</small></div><span>Open</span></div></div>
  if (stage.label === 'FOLLOW-UP') return <div className="landing-product-mockup landing-mockup-followups"><div className="landing-mockup-bar"><b>Follow-ups</b><span>Open work <em>3 priority actions</em></span></div><div className="landing-mockup-followup-row"><i className="is-open">!</i><div><b>Confirm next action</b><small>From Daily Activity · Due this week</small></div><strong>Priority</strong></div><div className="landing-mockup-followup-row"><i className="is-open">!</i><div><b>Share outcome with team</b><small>From account meeting · Due Friday</small></div><strong>Open</strong></div><div className="landing-mockup-followup-row is-complete"><i className="is-done">✓</i><div><b>Complete review note</b><small>Source activity · Completed</small></div><strong>Done</strong></div><div className="landing-mockup-followup-foot"><span>Carry forward what still matters</span><b>3 actions visible</b></div></div>
  if (stage.label === 'REVIEW') return <div className="landing-product-mockup landing-mockup-review"><div className="landing-mockup-bar"><b>WeekFlow Review</b><span className="landing-mockup-ready">Ready to review</span></div><div className="landing-mockup-review-grid"><div><small>Evidence captured</small><strong>18 activities</strong><span>12 planned · 6 additional</span></div><div><small>Outcomes</small><strong>8 recorded</strong><span>3 next actions open</span></div><div><small>Intelligence</small><strong>4 signals</strong><span>Needs attention</span></div></div><div className="landing-mockup-review-list"><span><i className="is-done">✓</i> Completed work</span><span><i className="is-open">!</i> Unresolved follow-ups</span><span><i className="is-open">!</i> Coming-week priorities</span></div></div>
  return <div className="landing-product-mockup landing-mockup-report"><div className="landing-mockup-bar"><b>Generate Report</b><span>Week of Aug 12 - Aug 18</span></div><div className="landing-mockup-report-head"><div><small>Professional weekly report</small><strong>Weekly Activity Report</strong></div><span className="landing-mockup-ready">Ready to export</span></div><div className="landing-mockup-report-sections"><span><b>01</b>Activities Summary <em>18</em></span><span><b>02</b>Daily Activity Breakdown <em>7 days</em></span><span><b>03</b>Key Outcomes & Intelligence <em>8</em></span><span><b>04</b>Completed Follow-ups <em>5</em></span></div></div>
}

function LandingProductStorySection() {
  const sectionRef = useRef<HTMLElement>(null)
  const cardRefs = useRef<Array<HTMLElement | null>>([])
  const stageRefs = useRef<Array<HTMLSpanElement | null>>([])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const cards = cardRefs.current.filter((card): card is HTMLElement => Boolean(card))
    const indicators = stageRefs.current.filter((indicator): indicator is HTMLSpanElement => Boolean(indicator))
    const stage = section.querySelector<HTMLElement>('.landing-product-stack-stage')
    const sticky = section.querySelector<HTMLElement>('.landing-product-stack-sticky')
    const visual = section.querySelector<HTMLElement>('.landing-product-stack-visual')
    if (!stage || !sticky || !visual) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0

    const updateStack = () => {
      frame = 0
      if (reducedMotion.matches) return
      const stageRect = stage.getBoundingClientRect()
      const range = Math.max(stage.offsetHeight - sticky.offsetHeight, 1)
      const progress = Math.max(0, Math.min(1, (sticky.getBoundingClientRect().top - stageRect.top) / range))
      const entrance = .18
      const showcaseProgress = Math.max(0, Math.min(1, (progress - entrance) / (1 - entrance)))
      const cycle = showcaseProgress * (cards.length - 1)
      const segment = Math.min(cards.length - 2, Math.floor(cycle))
      const localProgress = cycle - segment
      const handoffProgress = Math.max(0, Math.min(1, (localProgress - .65) / .35))
      const easedHandoff = handoffProgress * handoffProgress * (3 - 2 * handoffProgress)
      const position = showcaseProgress >= 1 ? cards.length - 1 : segment + easedHandoff
      const activeIndex = Math.min(cards.length - 1, Math.round(position))
      visual.style.transform = `scale(${.78 + Math.min(1, progress / entrance) * .22})`
      cards.forEach((card, index) => {
        const distance = index - position
        const depth = Math.max(0, Math.min(4, distance))
        const passed = distance < 0
        card.style.transform = passed
          ? `translate3d(0, ${-72 + distance * 12}px, 0) scale(.94)`
          : `translate3d(0, ${depth * 34}px, 0) scale(${1 - depth * .022})`
        card.style.opacity = passed ? `${Math.max(.24, 1 + distance * .12)}` : `${1 - depth * .1}`
        card.style.zIndex = passed ? `${index}` : `${cards.length - Math.round(Math.max(0, distance))}`
      })
      indicators.forEach((indicator, index) => indicator.classList.toggle('is-active', index === activeIndex))
    }

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateStack)
    }
    const onMotionChange = () => {
      section.classList.toggle('is-reduced-motion', reducedMotion.matches)
      if (reducedMotion.matches) {
        visual.style.transform = ''
        cards.forEach((card) => { card.style.transform = ''; card.style.opacity = ''; card.style.zIndex = '' })
      } else {
        updateStack()
      }
    }

    section.classList.toggle('is-reduced-motion', reducedMotion.matches)
    reducedMotion.addEventListener('change', onMotionChange)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    updateStack()
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      reducedMotion.removeEventListener('change', onMotionChange)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return <section ref={sectionRef} className="landing-product-story-stack-section" aria-labelledby="landing-product-story-title"><div className="landing-product-story-heading"><p className="landing-eyebrow">Product in action</p><h2 id="landing-product-story-title">See the work come together.</h2><p>One connected workflow, from the first plan to the final report.</p></div><div className="landing-product-stack-stage"><div className="landing-product-stack-indicator" aria-label="WeekFlow workflow stages">{landingProductStages.map((stage, index) => <span ref={(element) => { stageRefs.current[index] = element }} className={index === 0 ? 'is-active' : ''} key={stage.label}>{stage.number} <b>{stage.label}</b></span>)}</div><div className="landing-product-stack-sticky"><div className="landing-product-stack-visual">{landingProductStages.map((stage, index) => <article ref={(element) => { cardRefs.current[index] = element }} className="landing-product-stack-card" key={stage.label} aria-label={`${stage.label} WeekFlow product preview`}><div className="landing-product-stack-label">{stage.number} · {stage.label}</div><LandingProductMockup stage={stage} /></article>)}</div></div></div></section>
}

function PublicLandingScreen({ onSignIn, onCreateAccount }: { onSignIn: () => void; onCreateAccount: () => void }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [navOnLightSurface, setNavOnLightSurface] = useState(false)
  const navRef = useRef<HTMLElement>(null)

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

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const observer = new IntersectionObserver(() => {
      const navRect = nav.getBoundingClientRect()
      const lightSurfaceActive = Array.from(document.querySelectorAll<HTMLElement>('.landing-feature-band, .landing-reporting, .landing-templates, .landing-workspaces')).some((section) => {
        const sectionRect = section.getBoundingClientRect()
        return sectionRect.top <= navRect.bottom && sectionRect.bottom >= navRect.top
      })
      setNavOnLightSurface(lightSurfaceActive)
    }, { rootMargin: '-16px 0px -80% 0px', threshold: [0, 0.01] })
    document.querySelectorAll<HTMLElement>('.landing-feature-band, .landing-reporting, .landing-templates, .landing-workspaces').forEach((section) => observer.observe(section))
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
  const weekRhythm = [
    ['01', 'PLAN', 'Weekly Plan', 'Set objectives and organise the work ahead.'],
    ['02', 'ACTIVITY', 'Daily Activity', 'Capture what actually happened during the week.'],
    ['03', 'FOLLOW-UP', 'Follow-ups', 'Keep unresolved actions visible until they are done.'],
    ['04', 'REVIEW', 'Generate Report', 'Review progress, outcomes, intelligence, and readiness.'],
    ['05', 'REPORT', 'Report History', 'Keep a useful record of completed weeks and reports.'],
  ]
  return <main className="landing-page">
    <LandingShootingStars />
    <LandingCustomCursor />
    <LandingHeroTemplateCarousel />
    <div className="landing-public-content">
    <nav ref={navRef} className={`landing-nav${mobileNavOpen ? ' is-open' : ''}${navOnLightSurface ? ' is-light-surface' : ''}`}><a className="landing-brand" href="/" aria-label="WeekFlow home"><img src={logoImage} alt="WeekFlow mark" /><span className="landing-wordmark">WeekFlow</span></a><button type="button" className="landing-nav-toggle" aria-expanded={mobileNavOpen} aria-controls="landing-nav-actions" aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'} onClick={() => setMobileNavOpen((open) => !open)}><span /><span /><span /></button><div className="landing-nav-actions" id="landing-nav-actions"><a className="landing-support-link" href="/support" onClick={() => setMobileNavOpen(false)}>Support</a><a className="landing-support-link" href="/contact" onClick={() => setMobileNavOpen(false)}>Contact</a><button type="button" className="landing-sign-in" onClick={() => { setMobileNavOpen(false); onSignIn() }}>Sign In</button><button type="button" className="button button-primary landing-nav-cta" onClick={() => { setMobileNavOpen(false); onCreateAccount() }}>Create a free account</button></div></nav>
    <section className="landing-hero"><div className="landing-hero-copy"><p className="landing-eyebrow">Your week, working better</p><h1>Plan your week.<br /><em>Stay on top of the work.</em></h1><p className="landing-hero-text">WeekFlow brings your weekly plans, daily activity, follow-ups, review, and reporting into one simple workspace.</p><div className="landing-hero-actions"><button type="button" className="button button-primary landing-large-cta" onClick={onCreateAccount}>Create a free account <AppIcon name="arrow-right" /></button><button type="button" className="landing-secondary-cta" onClick={onSignIn}>Sign In</button></div></div><div className="landing-preview-wrap"><span className="preview-float preview-float-week">Week of Aug 10-16</span><span className="preview-float preview-float-followups">5 follow-ups</span><div className="landing-product-preview" aria-label="WeekFlow product preview"><div className="preview-window-bar"><span className="preview-dots"><i /><i /><i /></span><span>WeekFlow</span><span className="preview-week">Aug 10 - Aug 16</span></div><div className="preview-body"><aside><strong>WeekFlow</strong><span className="preview-active">Overview</span><span>Weekly Plan</span><span>Daily Activity</span><span>Follow-ups</span><span>Report</span></aside><div className="preview-main"><div className="preview-heading"><div><small>Current work week</small><h2>Your week at a glance.</h2></div><b>Ready to review</b></div><div className="preview-metrics"><div><small>Planned</small><strong>12</strong></div><div><small>Activities</small><strong>18</strong></div><div><small>Follow-ups</small><strong>5</strong></div></div><div className="preview-content-grid"><div className="preview-plan"><small>Weekly Plan</small><strong>Priority accounts and next actions</strong><span className="preview-line" /><span className="preview-line short" /><span className="preview-line" /></div><div className="preview-followups"><small>Follow-through</small><strong>5 actions remain visible</strong><span className="preview-pill">On track</span></div></div></div></div></div></div></section>
    <section className="landing-hero"><div className="landing-hero-copy"><p className="landing-eyebrow">Your week, working better</p><h1>Plan your week.<br /><em>Stay on top of the work.</em></h1><p className="landing-hero-text">WeekFlow brings your weekly plans, daily activity, follow-ups, review, and reporting into one simple workspace.</p><div className="landing-hero-actions"><button type="button" className="button button-primary landing-large-cta" onClick={onCreateAccount}>Create a free account <AppIcon name="arrow-right" /></button><button type="button" className="landing-secondary-cta" onClick={onSignIn}>Sign In</button></div></div><div className="landing-hero-inner-balance"><div className="landing-hero-story" aria-hidden="true"><article className="landing-hero-card landing-hero-card-plan"><span className="landing-hero-card-mark">P</span><strong>Weekly Plan</strong><p>3 priorities planned</p></article><article className="landing-hero-card landing-hero-card-activity"><span className="landing-hero-card-mark">A</span><strong>Activity captured</strong><p>Client meeting</p><small>Outcome recorded</small></article><article className="landing-hero-card landing-hero-card-followup"><span className="landing-hero-card-mark">F</span><strong>Follow-up added</strong><p>Confirm next action</p><small>Due Friday</small></article><article className="landing-hero-card landing-hero-card-report"><span className="landing-hero-card-mark">R</span><strong>Report ready</strong><p>Weekly report generated</p></article></div><div className="landing-preview-wrap"><span className="preview-float preview-float-week">Week of Aug 10-16</span><span className="preview-float preview-float-followups">5 follow-ups</span><div className="landing-product-preview" aria-label="WeekFlow product preview"><div className="preview-window-bar"><span className="preview-dots"><i /><i /><i /></span><span>WeekFlow</span><span className="preview-week">Aug 10 - Aug 16</span></div><div className="preview-body"><aside><strong>WeekFlow</strong><span className="preview-active">Overview</span><span>Weekly Plan</span><span>Daily Activity</span><span>Follow-ups</span><span>Report</span></aside><div className="preview-main"><div className="preview-heading"><div><small>Current work week</small><h2>Your week at a glance.</h2></div><b>Ready to review</b></div><div className="preview-metrics"><div><small>Planned</small><strong>12</strong></div><div><small>Activities</small><strong>18</strong></div><div><small>Follow-ups</small><strong>5</strong></div></div><div className="preview-content-grid"><div className="preview-plan"><small>Weekly Plan</small><strong>Priority accounts and next actions</strong><span className="preview-line" /><span className="preview-line short" /><span className="preview-line" /></div><div className="preview-followups"><small>Follow-through</small><strong>5 actions remain visible</strong><span className="preview-pill">Review and align</span></div></div></div></div></div></div></div></section>
    <section className="landing-section landing-workflow" id="week-rhythm"><div className="landing-section-heading"><p className="landing-eyebrow">The WeekFlow rhythm</p><h2>Turn a busy week into a clear rhythm.</h2><p>Plan. Work. Follow through. Review. Report.</p></div><div className="landing-orbit-window" aria-label="WeekFlow rhythm stages"><div className="landing-orbit-ring" aria-hidden="true" />{weekRhythm.map(([number, label, title, description], index) => <article className="landing-orbit-card" style={{ ['--orbit-delay' as string]: `${index * -4}s` }} key={number}><span>{number}</span><small>{label}</small><h3>{title}</h3><p>{description}</p></article>)}</div></section>
        <LandingProductStorySection />
    <section className="landing-story landing-story-followups landing-reveal"><div className="landing-story-copy"><p className="landing-eyebrow">Follow-ups</p><h2>Keep the next move in sight.</h2><p>Keep unresolved actions visible until they're complete.</p></div><div className="landing-story-visual landing-followups-visual"><div className="story-window-label">Follow-ups <span>Open work</span></div><div className="story-followup-row"><span className="story-dot is-open" /><strong>Confirm account next action</strong><small>Priority</small></div><div className="story-followup-row"><span className="story-dot is-open" /><strong>Share outcome with team</strong><small>Due this week</small></div><div className="story-followup-row is-complete"><span className="story-dot is-done"><AppIcon name="check" /></span><strong>Complete follow-up</strong><small>Completed</small></div></div></section>
    <section className="landing-feature-band landing-reveal"><div><p className="landing-eyebrow">Smart Start</p><h2>Start the next week with less work to rebuild.</h2><p>Carry forward the unfinished work that still matters. Leave completed work behind.</p></div><div className="landing-smart-visual"><div><small>Last week</small><span>[done] Completed work</span><span>[done] Completed follow-ups</span><b>-&gt; Unfinished priorities</b></div><div className="smart-start-bridge"><span>Smart Start</span><b>select what still matters</b></div><div><small>New week</small><b>-&gt; Carry forward what still matters</b></div></div></section>
    <section className="landing-section landing-reporting landing-reveal"><div className="landing-section-heading"><p className="landing-eyebrow">Reporting</p><h2>Turn the week's work into a finished report.</h2><p>Bring together what you planned, what happened, what changed, and what still needs attention.</p></div><div className="landing-report-preview"><div><strong>Weekly Activity</strong><span>Activities Summary</span><span>Daily Activity Breakdown</span><span>Key Outcomes</span></div><div className="report-transform"><b>WeekFlow Review</b><span>-&gt;</span><strong>Professional Report</strong><small>Export professional Word documents.</small></div></div></section>
    <section className="landing-section landing-templates landing-reveal" id="templates"><div className="landing-section-heading"><p className="landing-eyebrow">Built for different kinds of work</p><h2>Built for the work you actually do.</h2><p>Choose a workflow that fits how you work.</p></div><div className="landing-template-groups">{templateGroups.map((group) => <div className="landing-template-group landing-stagger" key={group.label}><h3>{group.label}</h3><div>{group.ids.map((id) => { const template = templateById.get(id); return template ? <article key={id}><span className="landing-template-icon"><TemplateIcon templateId={template.id} /></span><strong>{template.name}</strong><p>{template.description}</p></article> : null })}</div></div>)}</div></section>
    <section className="landing-section landing-workspaces landing-reveal"><div className="landing-split-copy"><p className="landing-eyebrow">Your work. Your workspaces.</p><h2>Give every kind of work a clear home.</h2><p>Keep different kinds of work organised without mixing their workflows.</p></div><div className="landing-workspace-examples"><article><span>Field Sales Workspace</span><strong>Pharma Field Sales</strong><small>Plans, activity, accounts, follow-ups</small></article><article><span>Small Business Workspace</span><strong>Small Business</strong><small>Customers, sales, orders, priorities</small></article><article><span>Personal Goals</span><strong>Personal Productivity</strong><small>Goals, tasks, routines, next actions</small></article></div></section>
    <section className="landing-final-cta"><h2>Run a better week, every week.</h2><p>Start with a free WeekFlow account.</p><div><button type="button" className="button button-primary landing-large-cta" onClick={onCreateAccount}>Create a free account <AppIcon name="arrow-right" /></button><button type="button" className="landing-secondary-cta" onClick={onSignIn}>Sign In</button></div></section>
    <footer className="landing-footer"><div><div className="landing-footer-brand"><img src={logoImage} alt="WeekFlow mark" /><span className="landing-wordmark">WeekFlow</span></div><p>Plan your week. Stay on top of the work.</p></div><div><a href="#workflow">The rhythm</a><a href="#templates">Workflows</a><a href="/workspaces">Your Workflows</a><a href="/guides">Guides</a><a href="/support">Support</a><a href="/contact">Contact</a></div><small>(c) {new Date().getFullYear()} WeekFlow</small></footer>
    </div>
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
    const trimmedUsername = displayName.trim()
    if (mode === 'signup' && !trimmedUsername) {
      setErrorMessage('Enter a username to create an account.')
      return
    }
    if (mode === 'signup' && trimmedUsername.length > maximumUsernameLength) {
      setErrorMessage(`Keep your username to ${maximumUsernameLength} characters or fewer.`)
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
        const result = await createAccount({ displayName: trimmedUsername, email: email.trim(), password })
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
    return <main className="auth-screen"><div className="auth-panel auth-welcome-panel"><img className="auth-logo" src={logoImage} alt="WeekFlow" /><p className="eyebrow">Weekly planning</p><h1>Plan your week. Track what happens. Stay on top of what comes next.</h1><p className="auth-intro">A focused workspace for turning plans, activity, and follow-through into a clearer week.</p><div className="auth-actions"><button type="button" className="button button-primary" onClick={() => { resetMessages(); setMode('signin') }}>Sign In</button><button type="button" className="button button-secondary" onClick={() => { resetMessages(); setMode('signup') }}>Create Account</button></div></div></main>
  }

  return <main className="auth-screen"><section className="auth-panel" aria-labelledby="auth-title"><img className="auth-logo" src={logoImage} alt="WeekFlow" /><p className="eyebrow">Account</p><h1 id="auth-title">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1><p className="auth-intro">{mode === 'signin' ? 'Sign in to return to your workspaces.' : 'Start building a calmer, more useful weekly rhythm.'}</p><form className="auth-form" onSubmit={submit} noValidate>
    {mode === 'signup' && <label className="auth-field"><span>Username</span><input autoComplete="name" maxLength={maximumUsernameLength} placeholder="Enter your preferred name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /><small>This is how WeekFlow will address you in your workspace.</small></label>}
    <label className="auth-field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label className="auth-field"><span>Password</span><input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {mode === 'signin' && <button className="auth-inline-link" type="button" onClick={() => navigateTo('/forgot-password')}>Forgot password?</button>}
    {mode === 'signup' && <label className="auth-field"><span>Confirm Password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}
    {errorMessage && <p className="auth-message auth-error" role="alert">{errorMessage}</p>}
    {successMessage && <p className="auth-message auth-success" role="status">{successMessage}</p>}
    <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Working...' : mode === 'signin' ? 'Sign In' : 'Create Account'}</button>
  </form><button className="auth-switch" type="button" onClick={() => { resetMessages(); setMode(mode === 'signin' ? 'signup' : 'signin') }}>{mode === 'signin' ? 'Need an account? Create Account' : 'Already have an account? Sign In'}</button><button className="auth-back" type="button" onClick={() => { resetMessages(); if (mode === 'signup') { navigateTo('/') } else { setMode('welcome') } }}>Back to WeekFlow</button></section></main>
}

function AuthCallbackScreen() {
  return <main className="auth-screen"><section className="auth-panel" aria-labelledby="auth-callback-title"><img className="auth-logo" src={logoImage} alt="WeekFlow" /><p className="eyebrow">Account confirmation</p><h1 id="auth-callback-title">Email confirmation could not be completed</h1><p className="auth-intro">The confirmation link may have expired or is no longer valid. Start again from Sign In or Create Account.</p><div className="auth-actions"><button type="button" className="button button-primary" onClick={() => navigateTo('/sign-in')}>Sign In</button><button type="button" className="button button-secondary" onClick={() => navigateTo('/sign-up')}>Create Account</button></div></section></main>
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
      await requestPasswordReset(normalizedEmail, new URL('/reset-password', window.location.origin).toString())
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
  return <main className="auth-screen" aria-busy="true"><div className="auth-panel auth-loading"><img className="auth-logo" src={logoImage} alt="WeekFlow" /></div></main>
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
          <span className="workspace-switcher-name">{currentWorkspace?.name ?? 'No workspace selected'}</span>
          {currentWorkspace && <span className="workspace-switcher-template">{currentTemplate.name}</span>}
        </button>
        {workspaceMenuOpen && (
          <div className="workspace-switcher-menu" role="menu" aria-label="Workspace switcher menu">
            <div className="workspace-switcher-header">Your workspaces</div>
            {workspaces.map((workspace) => {
              const isCurrent = workspace.id === currentWorkspace?.id
              const templateName = getAvailableTemplates().find((template) => template.id === workspace.templateId)?.name ?? currentTemplate.name
              return (
                <button type="button" className={`workspace-switcher-item${isCurrent ? ' is-current' : ''}`} key={workspace.id} onClick={() => onSelectWorkspace(workspace.id)} role="menuitemradio" aria-checked={isCurrent}>
                  <span className="workspace-switcher-item-title"><AppIcon name={isCurrent ? 'check' : 'dot'} /> {workspace.name}</span>
                  <span className="workspace-switcher-item-template">{templateName}</span>
                </button>
              )
            })}
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
  onCustomTemplate,
  validationMessage,
}: {
  isOpen: boolean
  templateId: string
  onTemplateChange: (value: string) => void
  onNameChange: (value: string) => void
  workspaceName: string
  onClose: () => void
  onCreate: () => void
  onCustomTemplate: () => void
  validationMessage: string
}) {
  if (!isOpen) return null

  const templates = getAvailableTemplates()
  const selectedTemplate = templates.find((template) => template.id === templateId) ?? templates[0]
  const templateGroups = [
    { label: 'Business & Operations', ids: ['field-sales', 'field-service', 'small-business', 'project-management'] },
    { label: 'People & Impact', ids: ['ngo-community', 'education'] },
    { label: 'Personal', ids: ['personal'] },
    { label: 'Build Your Own', ids: ['custom'] },
  ]

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
        <p className="workspace-modal-intro">Choose what you&apos;re using WeekFlow for.</p>
        <div className="workspace-template-groups" aria-label="Workspace templates">
          {templateGroups.map((group) => <section className="workspace-template-group" key={group.label} aria-labelledby={`workspace-template-group-${group.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
            <h3 id={`workspace-template-group-${group.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{group.label}</h3>
            <div className="workspace-template-options">
              {group.ids.map((id) => {
                const template = templates.find((candidate) => candidate.id === id)
                if (!template) return null
                const isSelected = template.id === selectedTemplate.id
                return <button type="button" className={`workspace-template-option${isSelected ? ' is-selected' : ''}`} key={template.id} onClick={() => template.id === 'custom' ? onCustomTemplate() : onTemplateChange(template.id)} aria-pressed={isSelected}>
                  <span className="workspace-template-option-icon"><TemplateIcon templateId={template.id} /></span>
                  <span className="workspace-template-option-copy"><strong>{template.name}</strong><span>{template.description}</span></span>
                  {isSelected && <span className="workspace-template-option-check" aria-label="Selected"><AppIcon name="check" /></span>}
                </button>
              })}
            </div>
          </section>)}
        </div>
        <label className="workspace-field">
          <span>Workspace name</span>
          <input
            value={workspaceName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="My workspace"
            aria-label="Workspace name"
            aria-invalid={Boolean(validationMessage)}
          />
          {validationMessage && <span className="workspace-field-error" role="alert">{validationMessage}</span>}
        </label>
        <div className="workspace-modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="button button-primary" onClick={onCreate}>Create Workspace</button>
        </div>
      </div>
    </div>
  )
}

function WorkspaceDeleteDialog({ workspace, isDeleting, errorMessage, onClose, onConfirm }: {
  workspace: ReturnType<typeof getCurrentWorkspace> | null
  isDeleting: boolean
  errorMessage: string
  onClose: () => void
  onConfirm: () => void
}) {
  if (!workspace) return null

  return (
    <div className="workspace-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-workspace-title">
      <div className="workspace-modal workspace-delete-modal">
        <div className="workspace-modal-header">
          <div>
            <p className="eyebrow">Permanent action</p>
            <h2 id="delete-workspace-title">Delete &ldquo;{workspace.name}&rdquo;?</h2>
          </div>
          <button type="button" className="workspace-modal-close" onClick={onClose} disabled={isDeleting} aria-label="Close delete workspace dialog"><AppIcon name="close" /></button>
        </div>
        <p className="workspace-modal-intro">This permanently removes the workspace and its associated weekly plans, Daily Activity, Follow-ups, Smart Start data, and Report History.</p>
        {errorMessage && <p className="workspace-field-error" role="alert">{errorMessage}</p>}
        <div className="workspace-modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={isDeleting}>Cancel</button>
          <button type="button" className="button button-danger" onClick={onConfirm} disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Delete Workspace'}</button>
        </div>
      </div>
    </div>
  )
}

function WorkspaceRenameDialog({ workspace, name, metadataFields, metadataValues, isSaving, errorMessage, onNameChange, onMetadataChange, onClose, onConfirm, onRequestDelete }: {
  workspace: ReturnType<typeof getCurrentWorkspace> | null
  name: string
  metadataFields: readonly { id: keyof ReportMetadata; label: string }[]
  metadataValues: Record<string, string>
  isSaving: boolean
  errorMessage: string
  onNameChange: (name: string) => void
  onMetadataChange: (field: keyof ReportMetadata, value: string) => void
  onClose: () => void
  onConfirm: () => void
  onRequestDelete: () => void
}) {
  if (!workspace) return null

  return (
    <div className="workspace-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rename-workspace-title">
      <div className="workspace-modal workspace-rename-modal">
        <div className="workspace-modal-header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2 id="rename-workspace-title">Rename workspace</h2>
          </div>
          <button type="button" className="workspace-modal-close" onClick={onClose} disabled={isSaving} aria-label="Close rename workspace dialog"><AppIcon name="close" /></button>
        </div>
        <p className="workspace-modal-intro">Rename this workspace without changing its template or any of its weekly data.</p>
        <label className="workspace-field">
          <span>Workspace name</span>
          <input autoFocus value={name} onChange={(event) => onNameChange(event.target.value)} aria-invalid={Boolean(errorMessage)} />
          {errorMessage && <span className="workspace-field-error" role="alert">{errorMessage}</span>}
        </label>
        <fieldset className="workspace-fieldset">
          <legend>Report Identity</legend>
          <p className="workspace-modal-intro">Optional identity shown in reports generated from this workspace.</p>
          {metadataFields.length === 0 ? <p className="workspace-modal-intro">This template does not define any report identity fields.</p> : metadataFields.map((field) => (
            <label key={field.id} className="workspace-field">
              <span>{field.label}</span>
              <input value={metadataValues[field.id] ?? ''} onChange={(event) => onMetadataChange(field.id, event.target.value)} placeholder={field.label} />
            </label>
          ))}
        </fieldset>
        <div className="workspace-modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="button" className="button button-primary" onClick={onConfirm} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Name'}</button>
        </div>
        <div className="workspace-danger-zone">
          <div>
            <strong>Danger Zone</strong>
            <span>Delete this workspace and its associated workspace data.</span>
          </div>
          <button type="button" className="button button-danger-ghost" onClick={onRequestDelete} disabled={isSaving}>Delete Workspace</button>
        </div>
      </div>
    </div>
  )
}

function AppNavigation({ activeScreen, templateName, onSwitchTemplate, onEditCustomTemplate, onNavigate, collapsed, mobileOpen, onToggleCollapse, onClose }: { activeScreen: string; templateName: string; onSwitchTemplate: () => void; onEditCustomTemplate: () => void; onNavigate: (path: string) => void; collapsed: boolean; mobileOpen: boolean; onToggleCollapse: () => void; onClose: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    workspace: true,
    history: false,
    configuration: false,
  })

  useEffect(() => {
    const matchingSection = getSectionIdForScreen(activeScreen)
    if (!matchingSection) return
    setExpandedSections((current) => current[matchingSection] ? current : { ...current, [matchingSection]: true })
  }, [activeScreen])

  function toggleSection(sectionId: string) {
    setExpandedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }))
  }

  const visibleNavigationGroups = templateName === 'Education'
    ? navigationGroups.map((group) => group.id === 'workspace'
      ? { ...group, items: [...group.items.slice(0, 3), { label: 'Education Records', path: '/education-records', icon: 'report' as const }, ...group.items.slice(3)] }
      : group)
    : navigationGroups

  return (
    <nav className={`app-navigation${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-mobile-open' : ''}`} id="main-navigation" aria-label="Main navigation">
      <div className="navigation-brand"><img src={logoImage} alt="WeekFlow" /><span>WeekFlow</span></div>
      <button className="navigation-close-button" type="button" onClick={onClose} aria-label="Close navigation"><AppIcon name="close" /></button>
      <div className="navigation-topline"><div className="navigation-template"><span className="navigation-template-label">Template</span><strong>{templateName}</strong><button type="button" onClick={onSwitchTemplate}>Switch template</button>{templateName !== 'Education' && templateName !== 'Personal Productivity' && templateName !== 'Project Management' && templateName !== 'Pharma Field Sales' && templateName !== 'Field Operations' && templateName !== 'NGO & Community Work' && <button type="button" onClick={onEditCustomTemplate}>Edit Template Configuration</button>}</div><button className="navigation-collapse-button" type="button" onClick={onToggleCollapse} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!collapsed}><AppIcon name={collapsed ? 'expand' : 'collapse'} /></button></div>
      <div className="navigation-groups">
        {visibleNavigationGroups.map((group) => {
          const groupId = group.id
          const isExpanded = !!expandedSections[groupId]
          const groupControlId = `${groupId}-navigation-group`
          return <div className="navigation-group" key={groupId}>
            <button type="button" className="navigation-section-toggle" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${group.label} section`} aria-expanded={isExpanded} aria-controls={groupControlId} onClick={() => toggleSection(groupId)}>
              <span className="navigation-label">{group.label}</span>
              <span className="navigation-section-chevron" aria-hidden="true"><AppIcon name={isExpanded ? 'chevron-down' : 'chevron-right'} /></span>
            </button>
            <div className="navigation-links" id={groupControlId} hidden={!isExpanded}>
              {group.items.map((item) => {
                const isItemActive = item.path === '/' ? activeScreen === 'overview' : item.path === '/workspaces' ? activeScreen === 'workspaces' : activeScreen === item.path.slice(1)
                return <a className={`navigation-link${isItemActive ? ' is-active' : ''}`} href={item.path} key={item.path} aria-current={isItemActive ? 'page' : undefined} onClick={(event) => { event.preventDefault(); onNavigate(item.path); onClose() }} title={collapsed ? item.label : undefined}><span className="navigation-icon"><AppIcon name={item.icon} /></span><span className="navigation-link-label">{item.label}</span></a>
              })}
            </div>
          </div>
        })}
      </div>
      <div className="navigation-footer"><span className="navigation-footer-label">Selected template</span><strong>{templateName}</strong></div>
    </nav>
  )
}

function WorkspaceHomeScreen({
  currentWorkspaceId,
  onOpenWorkspace,
  onCreateWorkspace,
  onRequestRename,
  user,
}: {
  currentWorkspaceId: string | null
  onOpenWorkspace: (workspaceId: string) => void
  onCreateWorkspace: () => void
  onRequestRename: (workspaceId: string) => void
  user: UserProfile | null
}) {
  const workspaces = loadWorkspaces().filter((workspace) => !workspace.archived)
  const welcomeName = user?.displayName?.trim() || 'there'

  if (workspaces.length === 0) {
    return (
      <main className="workspace-home-screen">
        <div className="workspace-home-empty">
          <h1>No workspaces yet</h1>
          <p>Create a workspace to start planning, tracking, following up, and reporting your work.</p>
          <button type="button" className="button button-primary" onClick={onCreateWorkspace}>+ New Workspace</button>
        </div>
      </main>
    )
  }

  return (
    <main className="workspace-home-screen">
      <div className="workspace-home-header">
        <h1>{getTimeAwareGreeting(welcomeName)}</h1>
        <p>Manage your workspaces. Create, rename, open, or remove the spaces you use in WeekFlow.</p>
      </div>
      <div className="workspace-home-section-heading">
        <h2>Workspaces</h2>
        <p>Manage the spaces where you organize your work.</p>
      </div>
      <div className="workspace-home-grid">
        {workspaces.map((workspace) => {
          const template = getAvailableTemplates().find((candidate) => candidate.id === workspace.templateId) ?? getAvailableTemplates()[0]
          const customConfig = workspace.templateId === 'custom' ? loadCustomTemplateConfig(workspace.id) : null
          const isCurrent = workspace.id === currentWorkspaceId

          return (
            <article className={`workspace-home-card${isCurrent ? ' is-current' : ''}`} key={workspace.id}>
              <div className="workspace-home-card-top">
                <span className="workspace-home-icon" style={customConfig ? { color: customConfig.accent, backgroundColor: `${customConfig.accent}18` } : undefined}><TemplateIcon templateId={customConfig?.icon ?? workspace.templateId} /></span>
                {isCurrent && <span className="workspace-home-state">Current workspace</span>}
              </div>
              <h3>{workspace.name}</h3>
              <p className="workspace-home-template">{customConfig ? `${template.name} · ${customConfig.purpose}${customConfig.categories.length ? ` · ${customConfig.categories.length} categor${customConfig.categories.length === 1 ? 'y' : 'ies'}` : ''}` : template.name}</p>
              <div className="workspace-home-card-actions">
                <button type="button" className="button button-primary" onClick={() => onOpenWorkspace(workspace.id)}>Open Workspace</button>
                <button type="button" className="button button-secondary" onClick={() => onRequestRename(workspace.id)}>Edit</button>
              </div>
            </article>
          )
        })}
      </div>
      <div className="workspace-home-footer">
        <button type="button" className="button button-secondary" onClick={onCreateWorkspace}>+ New Workspace</button>
      </div>
    </main>
  )
}

function NoWorkspaceScreen({ onCreateWorkspace }: { onCreateWorkspace: () => void }) {
  return (
    <main className="workspace-home-screen" aria-labelledby="no-workspace-title">
      <div className="workspace-home-empty">
        <p className="eyebrow">Workspace</p>
        <h1 id="no-workspace-title">No workspaces yet</h1>
        <p>Create a workspace to start planning, tracking, following up, and reporting your work.</p>
        <button type="button" className="button button-primary" onClick={onCreateWorkspace}>+ New Workspace</button>
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

function DayPlanSection({ day, expanded, onToggle, onChange, template = FIELD_SALES_TEMPLATE }: { day: DayPlan; expanded: boolean; onToggle: () => void; onChange: (day: DayPlan) => void; template?: WeekFlowTemplate }) {
  function updateCategory(category: PlanCategory, items: PlanItem[]) {
    onChange({ ...day, categories: { ...day.categories, [category]: items } })
  }

  return (
    <section className={`day-plan${expanded ? ' is-expanded' : ''}`} aria-labelledby={`${day.id}-heading`}>
      <button className="day-heading" type="button" aria-expanded={expanded} aria-controls={`${day.id}-content`} onClick={onToggle}>
        <span className="day-index">{String(WEEK_DAY_IDS.indexOf(day.id) + 1).padStart(2, '0')}</span>
        <div>
          <h2 id={`${day.id}-heading`}>{day.label}</h2>
          <p>{formatDateLabel(day.date)}</p>
        </div>
        <span className="day-toggle-indicator" aria-hidden="true">{expanded ? '-' : '+'}</span>
      </button>
      {expanded && <div className="day-plan-content" id={`${day.id}-content`}>
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
      </div>
      }
    </section>
  )
}

function WeeklyPlanTextListSection<T extends { id: string; text: string }>({
  title,
  summary,
  items,
  emptyText,
  placeholder,
  compact = false,
  onChange,
  renderItemExtras,
}: {
  title: string
  summary: string
  items: T[]
  emptyText: string
  placeholder: string
  compact?: boolean
  onChange: (items: T[]) => void
  renderItemExtras?: (item: T, updateItem: (itemId: string, updates: Partial<T>) => void) => React.ReactNode
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

  function updateItemDetails(itemId: string, updates: Partial<T>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
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
              <div className="weekly-plan-summary-item-main">
                <input
                  aria-label={title}
                  value={item.text}
                  onChange={(event) => updateItem(item.id, event.target.value)}
                />
                <button type="button" aria-label={`Delete ${title}`} onClick={() => deleteItem(item.id)}>Remove</button>
              </div>
              {renderItemExtras && <div className="weekly-plan-summary-item-meta">{renderItemExtras(item, updateItemDetails)}</div>}
            </li>
          ))}
        </ul>
      ) : !compact ? (
        <p className="weekly-plan-summary-empty">{emptyText}</p>
      ) : null}
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
  title = 'Planned Activities',
  helperText,
  emptyText,
  addButtonText,
  compact = false,
  contactPlaceholder = 'Add priority contact',
  objectivePlaceholder = 'Describe the objective of this activity',
  template,
}: {
  items: VirtualEngagementPlanItem[]
  onChange: (items: VirtualEngagementPlanItem[]) => void
  title?: string
  helperText?: string
  emptyText?: string
  addButtonText?: string
  compact?: boolean
  contactPlaceholder?: string
  objectivePlaceholder?: string
  template?: WeekFlowTemplate
}) {
  const resolvedHelperText = helperText ?? `Plan your ${title.toLowerCase()} for the selected week.`
  const resolvedEmptyText = emptyText ?? `No ${title.toLowerCase()} planned yet.`
  const resolvedAddButtonText = addButtonText ?? `+ Add ${title.toLowerCase().replace(/s$/, '')}`
  const [contactDrafts, setContactDrafts] = useState<Record<string, string>>({})

  function updateItem(itemId: string, changes: Partial<VirtualEngagementPlanItem>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...changes } : item))
  }

  const priorityOptions = ['low', 'medium', 'high'] as const
  const isPersonal = template?.id === 'personal'
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
      {!compact && <p className="weekly-plan-helper">{resolvedHelperText}</p>}
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
                          aria-label={isPersonal ? 'Task context' : 'Priority contact'}
                          value={contact.text}
                          onChange={(event) => updatePriorityContact(item.id, contact.id, event.target.value)}
                        />
                        <button type="button" onClick={() => deletePriorityContact(item.id, contact.id)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="weekly-plan-list-empty">{isPersonal ? 'No personal context added yet.' : 'No customer contacts added yet.'}</p>}
                <div className="weekly-plan-inline-input-row">
                  <input
                    aria-label={isPersonal ? 'Add context' : 'Add priority contact'}
                    value={contactDrafts[item.id] ?? ''}
                    placeholder={isPersonal ? 'Add a person or context' : contactPlaceholder}
                    onChange={(event) => setContactDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                  />
                  <button type="button" onClick={() => addPriorityContact(item.id)}>Add</button>
                </div>
              </div>
              <label className="weekly-plan-field-label">
                Objective
                <textarea
                  value={item.objective}
                  placeholder={objectivePlaceholder}
                  onChange={(event) => updateItem(item.id, { objective: event.target.value })}
                />
              </label>
              {template?.id === 'project-management' && (
                <div className="weekly-plan-two-column-grid">
                  <input
                    aria-label="Related objective"
                    value={item.relatedObjective ?? ''}
                    placeholder="Related objective"
                    onChange={(event) => updateItem(item.id, { relatedObjective: event.target.value || undefined })}
                  />
                  <input
                    aria-label="Owner"
                    value={item.owner ?? ''}
                    placeholder="Owner"
                    onChange={(event) => updateItem(item.id, { owner: event.target.value || undefined })}
                  />
                  <select
                    aria-label="Priority"
                    value={item.priority ?? 'medium'}
                    onChange={(event) => updateItem(item.id, { priority: event.target.value as any })}
                  >
                    {priorityOptions.map((option) => <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>)}
                  </select>
                  <input
                    aria-label="Planned date"
                    type="date"
                    value={item.plannedDate ?? ''}
                    onChange={(event) => updateItem(item.id, { plannedDate: event.target.value || undefined })}
                  />
                  <input
                    aria-label="Start time"
                    type="time"
                    value={item.startTime ?? ''}
                    onChange={(event) => updateItem(item.id, { startTime: event.target.value || undefined })}
                  />
                  <input
                    aria-label="End time"
                    type="time"
                    value={item.endTime ?? ''}
                    onChange={(event) => updateItem(item.id, { endTime: event.target.value || undefined })}
                  />
                  <input
                    aria-label="Estimated hours"
                    value={item.estimatedHours ?? ''}
                    placeholder="Hours"
                    onChange={(event) => updateItem(item.id, { estimatedHours: event.target.value || undefined })}
                  />
                  <input
                    aria-label="Dependency"
                    value={item.dependency ?? ''}
                    placeholder="Dependency"
                    onChange={(event) => updateItem(item.id, { dependency: event.target.value || undefined })}
                  />
                  <input
                    aria-label="Status"
                    value={item.status ?? ''}
                    placeholder="Status"
                    onChange={(event) => updateItem(item.id, { status: event.target.value || undefined })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : !compact ? (
        <p className="weekly-plan-summary-empty">{resolvedEmptyText}</p>
      ) : null}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>{resolvedAddButtonText}</button>
      </div>
    </section>
  )
}

function WeeklyPlanAccountObjectiveSection({
  items,
  onChange,
  title = 'Work Area Objectives',
  helperText,
  emptyText,
  addButtonText,
  compact = false,
  accountPlaceholder = 'Account',
  objectivePlaceholder = 'Add objective',
}: {
  items: AccountObjective[]
  onChange: (items: AccountObjective[]) => void
  title?: string
  helperText?: string
  emptyText?: string
  addButtonText?: string
  compact?: boolean
  accountPlaceholder?: string
  objectivePlaceholder?: string
}) {
  const resolvedHelperText = helperText ?? `Capture ${title.toLowerCase()} for the selected week.`
  const resolvedEmptyText = emptyText ?? `No ${title.toLowerCase()} captured yet.`
  const resolvedAddButtonText = addButtonText ?? `+ Add ${title.toLowerCase().replace(/s$/, '')}`
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

  const priorityOptions = ['low', 'medium', 'high'] as const

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
      {!compact && <p className="weekly-plan-helper">{resolvedHelperText}</p>}
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
              {title === 'Deliverables' && (
                <div className="weekly-plan-two-column-grid">
                  <input
                    aria-label="Owner"
                    value={item.owner ?? ''}
                    placeholder="Owner"
                    onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, owner: event.target.value || undefined } : entry))}
                  />
                  <select
                    aria-label="Priority"
                    value={item.priority ?? 'medium'}
                    onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, priority: event.target.value as any } : entry))}
                  >
                    {priorityOptions.map((option) => <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>)}
                  </select>
                  <input
                    aria-label="Planned date"
                    type="date"
                    value={item.plannedDate ?? ''}
                    onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, plannedDate: event.target.value || undefined } : entry))}
                  />
                  <input
                    aria-label="Estimated hours"
                    value={item.estimatedHours ?? ''}
                    placeholder="Hours"
                    onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, estimatedHours: event.target.value || undefined } : entry))}
                  />
                  <input
                    aria-label="Dependency"
                    value={item.dependency ?? ''}
                    placeholder="Dependency"
                    onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, dependency: event.target.value || undefined } : entry))}
                  />
                  <input
                    aria-label="Status"
                    value={item.status ?? ''}
                    placeholder="Status"
                    onChange={(event) => onChange(items.map((entry) => entry.id === item.id ? { ...entry, status: event.target.value || undefined } : entry))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : !compact ? (
        <p className="weekly-plan-summary-empty">{resolvedEmptyText}</p>
      ) : null}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addAccount}>{resolvedAddButtonText}</button>
      </div>
    </section>
  )
}

function WeeklyPlanCommercialPrioritySection({
  items,
  onChange,
  title = 'Priorities',
  helperText,
  compact = false,
  template,
}: {
  items: CommercialPriority[]
  onChange: (items: CommercialPriority[]) => void
  title?: string
  helperText?: string
  compact?: boolean
  template?: WeekFlowTemplate
}) {
  const resolvedHelperText = helperText ?? `Capture the ${title.toLowerCase()} that matter this week.`
  const resolvedAddButtonText = `+ Add ${title.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '')}`
  const priorityOptions = ['low', 'medium', 'high'] as const
  const isPersonal = template?.id === 'personal' || title === 'Big Three'
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
      {!compact && <p className="weekly-plan-helper">{resolvedHelperText}</p>}
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              {!isPersonal && <div className="weekly-plan-card-header">
                <input
                  aria-label="Commercial priority opportunity"
                  value={item.opportunity ?? ''}
                  placeholder="Opportunity"
                  onChange={(event) => updateItem(item.id, { opportunity: event.target.value || undefined })}
                />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>}
              {isPersonal ? (
                <div className="weekly-plan-two-column-grid">
                  <input
                    aria-label="Personal priority or commitment"
                    value={item.text}
                    placeholder="Priority / commitment"
                    onChange={(event) => updateItem(item.id, { text: event.target.value })}
                  />
                  <select
                    aria-label="Priority level"
                    value={item.priority ?? 'medium'}
                    onChange={(event) => updateItem(item.id, { priority: event.target.value as any })}
                  >
                    {priorityOptions.map((option) => <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>)}
                  </select>
                </div>
              ) : (
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
                  {title === 'Priorities' && (
                    <select
                      aria-label="Priority level"
                      value={item.priority ?? 'medium'}
                      onChange={(event) => updateItem(item.id, { priority: event.target.value as any })}
                    >
                      {priorityOptions.map((option) => <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>)}
                    </select>
                  )}
                </div>
              )}
              {isPersonal && <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>}
            </div>
          ))}
        </div>
      ) : !compact ? (
        <p className="weekly-plan-summary-empty">No {title.toLowerCase()} captured yet.</p>
      ) : null}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>{resolvedAddButtonText}</button>
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
  compact = false,
}: {
  items: SuccessMeasure[]
  onChange: (items: SuccessMeasure[]) => void
  title?: string
  helperText?: string
  emptyText?: string
  addButtonText?: string
  compact?: boolean
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
      {!compact && <p className="weekly-plan-helper">{helperText}</p>}
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
      ) : !compact ? (
        <p className="weekly-plan-summary-empty">{emptyText}</p>
      ) : null}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>{addButtonText}</button>
      </div>
    </section>
  )
}

function ProgrammeContextSection({
  context,
  onChange,
}: {
  context?: WeeklyProgrammeContext
  onChange: (context: WeeklyProgrammeContext) => void
}) {
  const value = context ?? {}
  const update = (field: keyof WeeklyProgrammeContext, nextValue: string) => {
    onChange({
      ...value,
      [field]: nextValue.trim() ? nextValue : undefined,
    })
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>Programme Context</h3>
        </div>
        <span>{Object.values(value).filter(Boolean).length} field{Object.values(value).filter(Boolean).length === 1 ? '' : 's'}</span>
      </div>
      <div className="weekly-plan-two-column-grid">
        <label className="weekly-plan-field-label">
          Programme
          <input
            aria-label="Programme"
            value={value.programme ?? ''}
            placeholder="Programme"
            onChange={(event) => update('programme', event.target.value)}
          />
        </label>
        <label className="weekly-plan-field-label">
          Organisation
          <input
            aria-label="Organisation"
            value={value.organisation ?? ''}
            placeholder="Organisation"
            onChange={(event) => update('organisation', event.target.value)}
          />
        </label>
        <label className="weekly-plan-field-label">
          Weekly Theme
          <input
            aria-label="Weekly Theme"
            value={value.weeklyTheme ?? ''}
            placeholder="Weekly Theme"
            onChange={(event) => update('weeklyTheme', event.target.value)}
          />
        </label>
        <label className="weekly-plan-field-label">
          Programme Lead
          <input
            aria-label="Programme Lead"
            value={value.programmeLead ?? ''}
            placeholder="Programme Lead"
            onChange={(event) => update('programmeLead', event.target.value)}
          />
        </label>
        <label className="weekly-plan-field-label">
          Programme Status
          <input
            aria-label="Programme Status"
            value={value.programmeStatus ?? ''}
            placeholder="Programme Status"
            onChange={(event) => update('programmeStatus', event.target.value)}
          />
        </label>
      </div>
    </section>
  )
}

function NGOWeeklyFocusSection({
  focusText,
  onChange,
}: {
  focusText: string
  onChange: (text: string) => void
}) {
  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>Weekly Focus</h3>
        </div>
        <span>{focusText.trim() ? '1 item' : '0 items'}</span>
      </div>
      <p className="weekly-plan-helper">What is the main outcome we want to achieve this week?</p>
      <label className="weekly-plan-field-label">
        Weekly Focus
        <textarea
          aria-label="Weekly Focus"
          value={focusText}
          placeholder="Add the main focus for your week."
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </section>
  )
}

function NGOWeeklyObjectivesSection({
  items,
  onChange,
}: {
  items: WeeklyObjective[]
  onChange: (items: WeeklyObjective[]) => void
}) {
  const [newItemId, setNewItemId] = useState<string | null>(null)

  function addItem() {
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, text: '', successMeasure: '', priority: 'medium' }])
    setNewItemId(itemId)
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  function updateItem(itemId: string, updates: Partial<WeeklyObjective>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>Weekly Objectives</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Capture the planned programme objectives and how success will be measured.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input
                  aria-label="Weekly objective"
                  value={item.text}
                  placeholder="Objective"
                  onChange={(event) => updateItem(item.id, { text: event.target.value })}
                />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-two-column-grid">
                <input
                  aria-label="Success measure"
                  value={item.successMeasure ?? ''}
                  placeholder="Success Measure"
                  onChange={(event) => updateItem(item.id, { successMeasure: event.target.value || undefined })}
                />
                <select
                  aria-label="Priority"
                  value={item.priority ?? 'medium'}
                  onChange={(event) => updateItem(item.id, { priority: event.target.value as WeeklyObjective['priority'] })}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No weekly objectives captured yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add objective</button>
      </div>
    </section>
  )
}

function NGOProgrammeActivitiesSection({
  items,
  onChange,
}: {
  items: ProgrammeActivity[]
  onChange: (items: ProgrammeActivity[]) => void
}) {
  const [newItemId, setNewItemId] = useState<string | null>(null)

  function addItem() {
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, activity: '', programmeArea: '', location: '', owner: '', plannedDate: '', target: '', status: 'Planned' }])
    setNewItemId(itemId)
  }

  function updateItem(itemId: string, updates: Partial<ProgrammeActivity>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>Programme Activities</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Plan the activity, area, location, owner, target and status for the week.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input
                  aria-label="Activity"
                  value={item.activity}
                  placeholder="Activity"
                  onChange={(event) => updateItem(item.id, { activity: event.target.value })}
                />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-two-column-grid">
                <input aria-label="Programme Area" value={item.programmeArea ?? ''} placeholder="Programme Area" onChange={(event) => updateItem(item.id, { programmeArea: event.target.value || undefined })} />
                <input aria-label="Location" value={item.location ?? ''} placeholder="Location" onChange={(event) => updateItem(item.id, { location: event.target.value || undefined })} />
                <input aria-label="Owner" value={item.owner ?? ''} placeholder="Owner" onChange={(event) => updateItem(item.id, { owner: event.target.value || undefined })} />
                <input aria-label="Planned Date" value={item.plannedDate ?? ''} placeholder="Planned Date" onChange={(event) => updateItem(item.id, { plannedDate: event.target.value || undefined })} />
                <input aria-label="Target" value={item.target ?? ''} placeholder="Target" onChange={(event) => updateItem(item.id, { target: event.target.value || undefined })} />
                <input aria-label="Status" value={item.status ?? ''} placeholder="Status" onChange={(event) => updateItem(item.id, { status: event.target.value || undefined })} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No programme activities planned yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add activity</button>
      </div>
    </section>
  )
}

function NGOCommunityEngagementSection({
  items,
  onChange,
}: {
  items: CommunityEngagementItem[]
  onChange: (items: CommunityEngagementItem[]) => void
}) {
  const [newItemId, setNewItemId] = useState<string | null>(null)

  function addItem() {
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, communityGroup: '', engagementActivity: '', target: '', plannedDate: '', responsible: '' }])
    setNewItemId(itemId)
  }

  function updateItem(itemId: string, updates: Partial<CommunityEngagementItem>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>Beneficiary / Community Engagement</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Plan beneficiary and community engagement activity for the selected week.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input aria-label="Community Group" value={item.communityGroup} placeholder="Community Group" onChange={(event) => updateItem(item.id, { communityGroup: event.target.value })} />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-two-column-grid">
                <input aria-label="Engagement Activity" value={item.engagementActivity} placeholder="Engagement Activity" onChange={(event) => updateItem(item.id, { engagementActivity: event.target.value })} />
                <input aria-label="Target" value={item.target ?? ''} placeholder="Target" onChange={(event) => updateItem(item.id, { target: event.target.value || undefined })} />
                <input aria-label="Planned Date" value={item.plannedDate ?? ''} placeholder="Planned Date" onChange={(event) => updateItem(item.id, { plannedDate: event.target.value || undefined })} />
                <input aria-label="Responsible" value={item.responsible ?? ''} placeholder="Responsible" onChange={(event) => updateItem(item.id, { responsible: event.target.value || undefined })} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No community engagement planned yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add engagement</button>
      </div>
    </section>
  )
}

function NGOVolunteerPlanSection({
  items,
  onChange,
}: {
  items: VolunteerPlanItem[]
  onChange: (items: VolunteerPlanItem[]) => void
}) {
  const [newItemId, setNewItemId] = useState<string | null>(null)

  function addItem() {
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, volunteer: '', role: '', activity: '', date: '', status: 'Confirmed' }])
    setNewItemId(itemId)
  }

  function updateItem(itemId: string, updates: Partial<VolunteerPlanItem>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>Volunteer Plan</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Capture volunteer support for the upcoming week.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input aria-label="Volunteer" value={item.volunteer} placeholder="Volunteer" onChange={(event) => updateItem(item.id, { volunteer: event.target.value })} />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-two-column-grid">
                <input aria-label="Role" value={item.role} placeholder="Role" onChange={(event) => updateItem(item.id, { role: event.target.value })} />
                <input aria-label="Activity" value={item.activity} placeholder="Activity" onChange={(event) => updateItem(item.id, { activity: event.target.value })} />
                <input aria-label="Date" value={item.date ?? ''} placeholder="Date" onChange={(event) => updateItem(item.id, { date: event.target.value || undefined })} />
                <input aria-label="Status" value={item.status ?? ''} placeholder="Status" onChange={(event) => updateItem(item.id, { status: event.target.value || undefined })} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No volunteer plan captured yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add volunteer</button>
      </div>
    </section>
  )
}

function NGOStakeholderPlanSection({
  items,
  onChange,
}: {
  items: StakeholderPlanItem[]
  onChange: (items: StakeholderPlanItem[]) => void
}) {
  const [newItemId, setNewItemId] = useState<string | null>(null)

  function addItem() {
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, stakeholder: '', purpose: '', actionRequired: '', owner: '', due: '', status: 'Pending' }])
    setNewItemId(itemId)
  }

  function updateItem(itemId: string, updates: Partial<StakeholderPlanItem>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>Partnerships & Stakeholders</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Track stakeholders, purpose, action required, owner, due date and status.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input aria-label="Stakeholder" value={item.stakeholder} placeholder="Stakeholder" onChange={(event) => updateItem(item.id, { stakeholder: event.target.value })} />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-two-column-grid">
                <input aria-label="Purpose" value={item.purpose} placeholder="Purpose" onChange={(event) => updateItem(item.id, { purpose: event.target.value })} />
                <input aria-label="Action Required" value={item.actionRequired ?? ''} placeholder="Action Required" onChange={(event) => updateItem(item.id, { actionRequired: event.target.value || undefined })} />
                <input aria-label="Owner" value={item.owner ?? ''} placeholder="Owner" onChange={(event) => updateItem(item.id, { owner: event.target.value || undefined })} />
                <input aria-label="Due" value={item.due ?? ''} placeholder="Due" onChange={(event) => updateItem(item.id, { due: event.target.value || undefined })} />
                <input aria-label="Status" value={item.status ?? ''} placeholder="Status" onChange={(event) => updateItem(item.id, { status: event.target.value || undefined })} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No partnerships or stakeholders captured yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add stakeholder</button>
      </div>
    </section>
  )
}

function NGOResourcesLogisticsSection({
  items,
  onChange,
}: {
  items: ResourceLogisticsItem[]
  onChange: (items: ResourceLogisticsItem[]) => void
}) {
  const [newItemId, setNewItemId] = useState<string | null>(null)

  function addItem() {
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, resource: '', required: '', available: '', gap: '', action: '' }])
    setNewItemId(itemId)
  }

  function updateItem(itemId: string, updates: Partial<ResourceLogisticsItem>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>Resources & Logistics</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Track required resources, availability, gaps and the action needed.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input aria-label="Resource" value={item.resource} placeholder="Resource" onChange={(event) => updateItem(item.id, { resource: event.target.value })} />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-two-column-grid">
                <input aria-label="Required" value={item.required ?? ''} placeholder="Required" onChange={(event) => updateItem(item.id, { required: event.target.value || undefined })} />
                <input aria-label="Available" value={item.available ?? ''} placeholder="Available" onChange={(event) => updateItem(item.id, { available: event.target.value || undefined })} />
                <input aria-label="Gap" value={item.gap ?? ''} placeholder="Gap" onChange={(event) => updateItem(item.id, { gap: event.target.value || undefined })} />
                <input aria-label="Action" value={item.action ?? ''} placeholder="Action" onChange={(event) => updateItem(item.id, { action: event.target.value || undefined })} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No resource or logistics items captured yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add resource</button>
      </div>
    </section>
  )
}

function NGOCommunicationsPlanSection({
  items,
  onChange,
}: {
  items: CommunicationPlanItem[]
  onChange: (items: CommunicationPlanItem[]) => void
}) {
  const [newItemId, setNewItemId] = useState<string | null>(null)

  function addItem() {
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, communication: '', audience: '', channel: '', date: '', status: 'Planned' }])
    setNewItemId(itemId)
  }

  function updateItem(itemId: string, updates: Partial<CommunicationPlanItem>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>Communications Plan</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Plan communication touchpoints for this week.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input aria-label="Communication" value={item.communication} placeholder="Communication" onChange={(event) => updateItem(item.id, { communication: event.target.value })} />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-two-column-grid">
                <input aria-label="Audience" value={item.audience ?? ''} placeholder="Audience" onChange={(event) => updateItem(item.id, { audience: event.target.value || undefined })} />
                <input aria-label="Channel" value={item.channel ?? ''} placeholder="Channel" onChange={(event) => updateItem(item.id, { channel: event.target.value || undefined })} />
                <input aria-label="Date" value={item.date ?? ''} placeholder="Date" onChange={(event) => updateItem(item.id, { date: event.target.value || undefined })} />
                <input aria-label="Status" value={item.status ?? ''} placeholder="Status" onChange={(event) => updateItem(item.id, { status: event.target.value || undefined })} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No communications plan captured yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add communication</button>
      </div>
    </section>
  )
}

function NGODocumentationPlanSection({
  items,
  onChange,
}: {
  items: DocumentationPlanItem[]
  onChange: (items: DocumentationPlanItem[]) => void
}) {
  const [newItemId, setNewItemId] = useState<string | null>(null)

  function addItem() {
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, documentation: '', required: '', responsible: '', status: 'Pending' }])
    setNewItemId(itemId)
  }

  function updateItem(itemId: string, updates: Partial<DocumentationPlanItem>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>Documentation Plan</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Capture the documentation and evidence needed for the week.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input aria-label="Documentation" value={item.documentation} placeholder="Documentation" onChange={(event) => updateItem(item.id, { documentation: event.target.value })} />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <div className="weekly-plan-two-column-grid">
                <input aria-label="Required" value={item.required ?? ''} placeholder="Required" onChange={(event) => updateItem(item.id, { required: event.target.value || undefined })} />
                <input aria-label="Responsible" value={item.responsible ?? ''} placeholder="Responsible" onChange={(event) => updateItem(item.id, { responsible: event.target.value || undefined })} />
                <input aria-label="Status" value={item.status ?? ''} placeholder="Status" onChange={(event) => updateItem(item.id, { status: event.target.value || undefined })} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No documentation plan captured yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={addItem}>+ Add documentation</button>
      </div>
    </section>
  )
}

function NGOMonitoringImpactTargetsSection({
  items,
  onChange,
}: {
  items: MonitoringImpactTarget[]
  onChange: (items: MonitoringImpactTarget[]) => void
}) {
  const [newItemId, setNewItemId] = useState<string | null>(null)

  function addItem(kind: MonitoringImpactTarget['kind']) {
    const itemId = crypto.randomUUID()
    onChange([...items, { id: itemId, kind, text: '' }])
    setNewItemId(itemId)
  }

  function updateItem(itemId: string, updates: Partial<MonitoringImpactTarget>) {
    onChange(items.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  function deleteItem(itemId: string) {
    onChange(items.filter((item) => item.id !== itemId))
  }

  return (
    <section className="weekly-plan-summary-section">
      <div className="weekly-plan-summary-header">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h3>Monitoring & Impact Targets</h3>
        </div>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <p className="weekly-plan-helper">Capture outputs and intended outcomes separately so actual evidence is never confused with intended results.</p>
      {items.length > 0 ? (
        <div className="weekly-plan-card-stack">
          {items.map((item) => (
            <div className={`weekly-plan-card${newItemId === item.id ? ' is-new' : ''}`} key={item.id}>
              <div className="weekly-plan-card-header">
                <input aria-label="Target text" value={item.text} placeholder="Target text" onChange={(event) => updateItem(item.id, { text: event.target.value })} />
                <button type="button" className="destructive-button" onClick={() => deleteItem(item.id)}>Delete</button>
              </div>
              <label className="weekly-plan-field-label">
                Type
                <select
                  aria-label="Monitoring impact target type"
                  value={item.kind}
                  onChange={(event) => updateItem(item.id, { kind: event.target.value as MonitoringImpactTarget['kind'] })}
                >
                  <option value="outputs">Outputs</option>
                  <option value="intended-outcomes">Intended Outcomes</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      ) : (
        <p className="weekly-plan-summary-empty">No monitoring or impact targets captured yet.</p>
      )}
      <div className="weekly-plan-summary-form">
        <button type="button" className="primary-inline-button" onClick={() => addItem('outputs')}>+ Add output</button>
        <button type="button" className="button button-secondary" onClick={() => addItem('intended-outcomes')}>+ Add intended outcome</button>
      </div>
    </section>
  )
}

function WeeklyPlanScreen({ template = FIELD_SALES_TEMPLATE }: { template?: WeekFlowTemplate }) {
  const terminology = getTemplateTerminology(template)
  const planningCategories = getPlanningCategoryDescriptors(template)
  const hasPlanningCategory = (category: PlanCategory) => planningCategories.some((descriptor) => descriptor.key === category)
  const getPlanningCategoryLabel = (category: PlanCategory) => planningCategories.find((descriptor) => descriptor.key === category)?.label
  const [weekStart, setWeekStart] = useState(getSelectedWeekStart)
  const [plan, setPlan] = useState<WeeklyPlan>(() => loadWeeklyPlan(getSelectedWeekStart()))
  const [cloudStatus, setCloudStatus] = useState('')
  const [cloudError, setCloudError] = useState('')
  const saveQueueRef = useRef(Promise.resolve())
  const saveSequenceRef = useRef(0)
  const confirmedPlanRef = useRef<WeeklyPlan | null>(null)
  const retryPlanRef = useRef<(() => Promise<void>) | null>(null)
  const suppressNextPlanSaveRef = useRef(false)
  const [expandedDayIds, setExpandedDayIds] = useState<DayId[]>([])
  const previousWeekStart = useMemo(() => getPreviousWeekStart(weekStart), [weekStart])
  const previousPlan = useMemo(() => loadWeeklyPlan(previousWeekStart), [previousWeekStart])
  const previousFollowUps = useMemo(() => loadFollowUps(previousWeekStart), [previousWeekStart])
  const [previousCloudData, setPreviousCloudData] = useState<{ plan: WeeklyPlan; followUps: FollowUp[] } | null>(null)
  const smartStartSourcePlan = previousCloudData?.plan ?? previousPlan
  const smartStartSourceFollowUps = previousCloudData?.followUps ?? previousFollowUps
  const smartStartCandidates = useMemo(() => getSmartStartCandidates(smartStartSourcePlan, smartStartSourceFollowUps, template.id), [smartStartSourcePlan, smartStartSourceFollowUps, template.id])
  const carryForwardSelectionKeys = useMemo(() => {
    if (template.id !== 'project-management') return []
    const sessionKey = `weekflow-carry-forward-selection:${getCurrentWorkspaceId()}`
    const raw = window.sessionStorage.getItem(sessionKey)
    if (!raw) return []
    try {
      return JSON.parse(raw) as string[]
    } catch {
      return []
    }
  }, [template.id])
  const carryForwardCandidateKeys = useMemo(() => getSmartStartCandidateKeysFromCarryForwardSelection(smartStartCandidates, carryForwardSelectionKeys), [smartStartCandidates, carryForwardSelectionKeys])
  const hasPreviousWeekData = previousPlan.weeklyStrategicObjectives.some((item) => item.text.trim())
    || Boolean(previousPlan.educationWeeklyFocus?.trim())
    || (previousPlan.educationLearningObjectives ?? []).some((item) => item.objective.trim() || item.successMeasure?.trim())
    || (previousPlan.educationTeachingPlan ?? []).some((item) => item.topic.trim() || item.teachingActivity?.trim() || item.learningActivity?.trim() || item.duration?.trim())
    || (previousPlan.educationWeeklyTargets ?? []).some((item) => item.target.trim() || item.measure?.trim())
    || Object.values(previousPlan.educationContext ?? {}).some((value) => typeof value === 'string' && value.trim())
    || previousPlan.days.some((day) => Object.values(day.categories).some((items) => items.some((item) => item.text.trim())))
    || previousPlan.keyAccountObjectives.some((item) => item.account.trim() && item.objectives.some((objective) => objective.text.trim()))
    || previousPlan.commercialPriorities.some((item) => item.text.trim())
    || previousPlan.virtualEngagementPlan.some((item) => item.coverage.trim() || item.objective.trim() || item.priorityContacts.length > 0)
    || previousPlan.successMeasures.some((item) => item.text.trim())
    || (previousPlan.programmeActivities ?? []).some((item) => item.activity.trim() || item.programmeArea?.trim() || item.location?.trim() || item.owner?.trim() || item.plannedDate?.trim() || item.target?.trim() || item.status?.trim())
    || (previousPlan.communityEngagement ?? []).some((item) => item.communityGroup.trim() || item.engagementActivity.trim() || item.target?.trim() || item.plannedDate?.trim() || item.responsible?.trim())
    || (previousPlan.volunteerPlan ?? []).some((item) => item.volunteer.trim() || item.role.trim() || item.activity.trim() || item.date?.trim() || item.status?.trim())
    || (previousPlan.stakeholderPlan ?? []).some((item) => item.stakeholder.trim() || item.purpose.trim() || item.actionRequired?.trim() || item.owner?.trim() || item.due?.trim() || item.status?.trim())
    || (previousPlan.resourcesLogistics ?? []).some((item) => item.resource.trim() || item.required?.trim() || item.available?.trim() || item.gap?.trim() || item.action?.trim())
    || (previousPlan.communicationsPlan ?? []).some((item) => item.communication.trim() || item.audience?.trim() || item.channel?.trim() || item.date?.trim() || item.status?.trim())
    || (previousPlan.documentationPlan ?? []).some((item) => item.documentation.trim() || item.required?.trim() || item.responsible?.trim() || item.status?.trim())
    || (previousPlan.monitoringImpactTargets ?? []).some((item) => item.text.trim())
    || previousFollowUps.some((followUp) => followUp.task.trim())
    || loadDailyActivities(previousWeekStart).length > 0
    || (previousPlan.fieldJobs ?? []).some((item) => item.jobId.trim() || item.customer.trim() || item.location.trim())
    || (previousPlan.fieldServiceIssues ?? []).some((item) => item.issueId.trim() || item.customer.trim() || item.problem.trim())
    || (previousPlan.fieldEquipment ?? []).some((item) => item.equipmentId.trim() || item.customerSite.trim())
  const [smartStartState, setSmartStartState] = useState<{ selected: string[]; showReview: boolean; completion: SmartStartCompletion | null; result: number | null }>({
    selected: carryForwardCandidateKeys.length > 0 ? carryForwardCandidateKeys : smartStartCandidates.map((candidate) => candidate.key),
    showReview: carryForwardCandidateKeys.length > 0,
    completion: loadSmartStartCompletion(weekStart),
    result: null,
  })
  const smartStartGroupLabels: Record<SmartStartCandidate['type'], string> = {
    'weekly-objective': 'Weekly Objectives',
    'open-follow-up': 'Open Follow-ups',
    'account-objective': 'Account Objectives',
    'commercial-priority': 'Commercial Priorities',
    'ngo-programme-activity': 'Programme Activities',
    'ngo-community-engagement': 'Community Engagement',
    'ngo-volunteer': 'Volunteer Planning',
    'ngo-stakeholder': 'Stakeholder Actions',
    'ngo-resource': 'Resource Gaps',
    'ngo-communication': 'Communications',
    'ngo-documentation': 'Documentation',
    'ngo-monitoring': 'Monitoring & Impact',
  }
  const hasPlanContent = plan.weeklyStrategicObjectives.some((item) => item.text.trim())
    || Boolean(plan.educationWeeklyFocus?.trim())
    || (plan.educationLearningObjectives ?? []).some((item) => item.objective.trim() || item.successMeasure?.trim())
    || (plan.educationTeachingPlan ?? []).some((item) => item.topic.trim() || item.teachingActivity?.trim() || item.learningActivity?.trim() || item.duration?.trim())
    || (plan.educationWeeklyTargets ?? []).some((item) => item.target.trim() || item.measure?.trim())
    || Object.values(plan.educationContext ?? {}).some((value) => typeof value === 'string' && value.trim())
    || plan.days.some((day) => Object.values(day.categories).some((items) => items.some((item) => item.text.trim())))
    || plan.keyAccountObjectives.some((item) => item.account.trim() && item.objectives.some((objective) => objective.text.trim()))
    || plan.commercialPriorities.some((item) => item.text.trim())
    || plan.virtualEngagementPlan.some((item) => item.coverage.trim() || item.objective.trim() || item.priorityContacts.length > 0)
    || plan.successMeasures.some((item) => item.text.trim())
    || Object.values(plan.programmeContext ?? {}).some((value) => typeof value === 'string' && value.trim().length > 0)
    || (plan.programmeActivities ?? []).some((item) => item.activity.trim() || item.programmeArea?.trim() || item.location?.trim() || item.owner?.trim() || item.plannedDate?.trim() || item.target?.trim() || item.status?.trim())
    || (plan.communityEngagement ?? []).some((item) => item.communityGroup.trim() || item.engagementActivity.trim() || item.target?.trim() || item.plannedDate?.trim() || item.responsible?.trim())
    || (plan.volunteerPlan ?? []).some((item) => item.volunteer.trim() || item.role.trim() || item.activity.trim() || item.date?.trim() || item.status?.trim())
    || (plan.stakeholderPlan ?? []).some((item) => item.stakeholder.trim() || item.purpose.trim() || item.actionRequired?.trim() || item.owner?.trim() || item.due?.trim() || item.status?.trim())
    || (plan.resourcesLogistics ?? []).some((item) => item.resource.trim() || item.required?.trim() || item.available?.trim() || item.gap?.trim() || item.action?.trim())
    || (plan.communicationsPlan ?? []).some((item) => item.communication.trim() || item.audience?.trim() || item.channel?.trim() || item.date?.trim() || item.status?.trim())
    || (plan.documentationPlan ?? []).some((item) => item.documentation.trim() || item.required?.trim() || item.responsible?.trim() || item.status?.trim())
    || (plan.monitoringImpactTargets ?? []).some((item) => item.text.trim())
    || (plan.fieldJobs ?? []).some((item) => item.jobId.trim() || item.customer.trim() || item.location.trim())
    || (plan.fieldServiceIssues ?? []).some((item) => item.issueId.trim() || item.customer.trim() || item.problem.trim())
    || (plan.fieldEquipment ?? []).some((item) => item.equipmentId.trim() || item.customerSite.trim())
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
    if (suppressNextPlanSaveRef.current) {
      suppressNextPlanSaveRef.current = false
      return
    }
    const planToSave = plan
    const sequence = ++saveSequenceRef.current
    setCloudStatus('Saving…')
    setCloudError('')
    const save = async () => {
      const savedToCloud = await saveWeeklyPlanAsync(planToSave)
      if (sequence !== saveSequenceRef.current) return
      if (savedToCloud) {
        confirmedPlanRef.current = planToSave
        retryPlanRef.current = null
        setCloudStatus('Saved')
      } else {
        const confirmedPlan = confirmedPlanRef.current
        if (confirmedPlan) {
          suppressNextPlanSaveRef.current = true
          setPlan(confirmedPlan)
        }
        setCloudStatus('')
        setCloudError('Couldn’t save changes')
        retryPlanRef.current = async () => { queuePlanSave(planToSave) }
      }
    }
    saveQueueRef.current = saveQueueRef.current.then(save).catch(() => {
      if (sequence !== saveSequenceRef.current) return
      const confirmedPlan = confirmedPlanRef.current
      if (confirmedPlan) {
        suppressNextPlanSaveRef.current = true
        setPlan(confirmedPlan)
      }
      setCloudStatus('')
      setCloudError('Couldn’t save changes')
      retryPlanRef.current = async () => { queuePlanSave(planToSave) }
    })
  }, [plan])

  function queuePlanSave(planToSave: WeeklyPlan) {
    const sequence = ++saveSequenceRef.current
    setCloudStatus('Saving…')
    setCloudError('')
    const save = async () => {
      const savedToCloud = await saveWeeklyPlanAsync(planToSave)
      if (sequence !== saveSequenceRef.current) return
      if (savedToCloud) {
        confirmedPlanRef.current = planToSave
        retryPlanRef.current = null
        setCloudStatus('Saved')
      } else {
        setCloudStatus('')
        setCloudError('Couldn’t save changes')
        retryPlanRef.current = async () => { queuePlanSave(planToSave) }
      }
    }
    saveQueueRef.current = saveQueueRef.current.then(save).catch(() => {
      if (sequence !== saveSequenceRef.current) return
      setCloudStatus('')
      setCloudError('Couldn’t save changes')
      retryPlanRef.current = async () => { queuePlanSave(planToSave) }
    })
  }

  useEffect(() => {
    let active = true
    planHydrated.current = false
    loadWeeklyPlanAsync(weekStart).then((loadedPlan) => {
      if (active) {
        setPlan(loadedPlan)
        confirmedPlanRef.current = loadedPlan
        planHydrated.current = true
        setCloudError('')
      }
    }).catch((error: unknown) => {
      if (active) setCloudError(error instanceof Error ? error.message : 'Weekly Plan could not be loaded.')
    })
    return () => { active = false }
  }, [weekStart])

  useEffect(() => {
    let active = true
    Promise.all([loadWeeklyPlanAsync(previousWeekStart), loadFollowUpsAsync(previousWeekStart)]).then(([plan, followUps]) => {
      if (active) setPreviousCloudData({ plan, followUps })
    }).catch(() => undefined)
    return () => { active = false }
  }, [previousWeekStart])

  useEffect(() => {
    let active = true
    loadSmartStartCompletionAsync(weekStart).then((completion) => {
      if (active) setSmartStartState((current) => ({ ...current, completion }))
    }).catch(() => undefined)
    return () => { active = false }
  }, [weekStart])

  async function markSmartStart(completion: SmartStartCompletion) {
    await saveSmartStartCompletionAsync(weekStart, completion)
    setSmartStartState((current) => ({ ...current, completion, showReview: false, result: completion === 'started' ? 0 : null }))
  }

  async function startFromPreviousWeek() {
    const result = mergeSmartStartSelections(plan, weekStart, loadFollowUps(weekStart), smartStartCandidates, smartStartState.selected)
    setPlan(result.plan)
    void saveFollowUpsAsync(weekStart, result.followUps)
    await saveSmartStartCompletionAsync(weekStart, 'started')
    setSmartStartState((current) => ({ ...current, completion: 'started', showReview: false, result: result.added }))
  }

  function changeWeek(value: string) {
    const nextWeekStart = getWeekStartFromInput(value)
    const nextCandidates = getSmartStartCandidates(loadWeeklyPlan(getPreviousWeekStart(nextWeekStart)), loadFollowUps(getPreviousWeekStart(nextWeekStart)), template.id)

    // Persist the active week's plan before the week transition and let the selected-week effect
    // load the destination week. This avoids the stale plan-overwrite race where the prior week's
    // PM fields could be replaced by the target week's state before the correct week was restored.
    void saveWeeklyPlanAsync(plan)
    setSelectedWeekStart(nextWeekStart)
    setWeekStart(nextWeekStart)
    setExpandedDayIds([])
    setCloudStatus('')
    setSmartStartState({
      selected: nextCandidates.map((candidate) => candidate.key),
      showReview: false,
      completion: loadSmartStartCompletion(nextWeekStart),
      result: null,
    })
  }

  function updateDay(updatedDay: DayPlan) {
    setPlan((currentPlan) => ({
      ...currentPlan,
      days: currentPlan.days.map((day) => day.id === updatedDay.id ? updatedDay : day),
    }))
  }

  function toggleDay(dayId: DayId) {
    setExpandedDayIds((current) => current.includes(dayId) ? current.filter((id) => id !== dayId) : [...current, dayId])
  }

  return (
    <main className="weekly-plan-screen" id="weekly-plan">
      <div className="plan-page-heading">
        <div>
          <p className="eyebrow">Weekly Plan</p>
          <h1>Weekly Work Plan</h1>
          <p className="plan-intro">{terminology.weeklyPlanIntro ?? `Plan your ${terminology.priorities.toLowerCase()}, ${terminology.accounts.toLowerCase()} and ${terminology.objectives.toLowerCase()} for the selected week.`}</p>
          {!hasPlanContent && <p className="plan-first-run-guidance">Start by adding the priorities and work you want to move forward this week. Then use Daily Activity to record what actually happens.</p>}
        </div>
        <div className="week-selector">
          <label htmlFor="reporting-week">Reporting week</label>
          <input id="reporting-week" type="week" value={toWeekInput(weekStart)} onChange={(event) => changeWeek(event.target.value)} />
          <span role={cloudStatus || cloudError ? 'status' : undefined}>{formatWeekRange(weekStart).replace(' - ', ' – ')}{cloudStatus ? ` · ${cloudStatus}` : ''}{cloudError ? ` · ${cloudError}` : ''}</span>{cloudError && <button type="button" className="text-button" onClick={() => { const retry = retryPlanRef.current; if (retry) void retry() }}>Retry</button>}
        </div>
      </div>
      {weekStart !== getCurrentWeekStart() && hasPreviousWeekData && smartStartState.completion === null && smartStartCandidates.length > 0 && (
        <section className="smart-start-panel" aria-labelledby="weekly-plan-smart-start-heading">
          <div className="smart-start-header">
            <div>
              <p className="eyebrow">Smart Start</p>
              <h2 id="weekly-plan-smart-start-heading">Carry forward from last week</h2>
            </div>
            <span>{smartStartCandidates.length} item{smartStartCandidates.length === 1 ? '' : 's'}</span>
          </div>
          <p className="smart-start-intro">Review what still matters from the previous week before building this week’s plan.</p>
          {!smartStartState.showReview ? (
            <div className="smart-start-actions">
              <button className="button button-primary" type="button" onClick={() => setSmartStartState((current) => ({ ...current, showReview: true }))}>Review &amp; Carry Forward</button>
              <button className="button button-secondary" type="button" onClick={() => markSmartStart('fresh')}>Start fresh</button>
            </div>
          ) : (
            <>
              <div className="smart-start-toolbar">
                <button type="button" className="link-button" onClick={() => setSmartStartState((current) => ({ ...current, selected: smartStartCandidates.map((candidate) => candidate.key) }))}>Select all</button>
                <button type="button" className="link-button" onClick={() => setSmartStartState((current) => ({ ...current, selected: [] }))}>Clear all</button>
                <span>{smartStartState.selected.length} selected</span>
              </div>
              <div className="smart-start-groups">
                {(['weekly-objective', 'open-follow-up', 'account-objective', 'commercial-priority', 'ngo-programme-activity', 'ngo-community-engagement', 'ngo-volunteer', 'ngo-stakeholder', 'ngo-resource', 'ngo-communication', 'ngo-documentation', 'ngo-monitoring'] as SmartStartCandidate['type'][]).map((type) => {
                  const group = smartStartCandidates.filter((candidate) => candidate.type === type)
                  if (group.length === 0) return null
                  return (
                    <section className="smart-start-group" key={type} aria-labelledby={`smart-start-${type}`}>
                      <h3 id={`smart-start-${type}`}>{smartStartGroupLabels[type]}</h3>
                      <div className="smart-start-list">
                        {group.map((candidate) => {
                          const selected = smartStartState.selected.includes(candidate.key)
                          return (
                            <label className={`smart-start-item${selected ? ' is-selected' : ''}`} key={candidate.key}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) => setSmartStartState((current) => ({
                                  ...current,
                                  selected: event.target.checked
                                    ? [...current.selected, candidate.key]
                                    : current.selected.filter((key) => key !== candidate.key),
                                }))}
                              />
                              <span>
                                <strong>{candidate.title}</strong>
                                {candidate.detail && <small>{candidate.detail}</small>}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
              <div className="smart-start-actions">
                <button className="button button-secondary" type="button" onClick={() => setSmartStartState((current) => ({ ...current, showReview: false }))}>Cancel</button>
                <button className="button button-primary" type="button" disabled={smartStartState.selected.length === 0} onClick={startFromPreviousWeek}>Apply selected items</button>
                <button className="button button-secondary" type="button" onClick={() => markSmartStart('fresh')}>Start fresh</button>
              </div>
              <small className="smart-start-safety-note">The previous week will not be changed. Daily activity and completed follow-ups are not copied.</small>
            </>
          )}
        </section>
      )}
      <div className="weekly-plan-top-level">
        {template.id === 'custom' ? (
          <CustomTargetsSummary config={loadCustomTemplateConfig()} activities={loadDailyActivities(weekStart)} />
        ) : template.schema?.planning.fieldOperations ? (
          <FieldOperationsPlanning
            objectives={plan.weeklyStrategicObjectives}
            jobs={plan.fieldJobs ?? []}
            issues={plan.fieldServiceIssues ?? []}
            equipment={plan.fieldEquipment ?? []}
            teamPlan={plan.fieldTeamPlan ?? []}
            schedule={plan.fieldDailySchedule ?? []}
            partsResources={plan.fieldPartsResources ?? []}
            onObjectivesChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, weeklyStrategicObjectives: items }))}
            onJobsChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, fieldJobs: items }))}
            onIssuesChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, fieldServiceIssues: items }))}
            onEquipmentChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, fieldEquipment: items }))}
            onTeamPlanChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, fieldTeamPlan: items }))}
            onScheduleChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, fieldDailySchedule: items }))}
            onPartsResourcesChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, fieldPartsResources: items }))}
          />
        ) : template.id === 'education' ? (
          <EducationWeeklyPlan
            focus={plan.educationWeeklyFocus}
            objectives={plan.educationLearningObjectives ?? []}
            teachingPlan={plan.educationTeachingPlan ?? []}
            targets={plan.educationWeeklyTargets ?? []}
            context={plan.educationContext}
            onFocusChange={(value) => setPlan((currentPlan) => ({ ...currentPlan, educationWeeklyFocus: value || undefined }))}
            onObjectivesChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, educationLearningObjectives: items }))}
            onTeachingPlanChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, educationTeachingPlan: items }))}
            onTargetsChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, educationWeeklyTargets: items }))}
            onContextChange={(value) => setPlan((currentPlan) => ({ ...currentPlan, educationContext: value }))}
          />
        ) : template.id === 'ngo-community' ? (
          <>
            <ProgrammeContextSection
              context={plan.programmeContext}
              onChange={(context) => setPlan((currentPlan) => ({ ...currentPlan, programmeContext: context }))}
            />
            <NGOWeeklyFocusSection
              focusText={plan.programmeContext?.weeklyTheme ?? ''}
              onChange={(text) => setPlan((currentPlan) => ({
                ...currentPlan,
                programmeContext: {
                  ...currentPlan.programmeContext,
                  weeklyTheme: text.trim() ? text : undefined,
                },
              }))}
            />
            <NGOWeeklyObjectivesSection
              items={plan.weeklyStrategicObjectives}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, weeklyStrategicObjectives: items }))}
            />
            <NGOProgrammeActivitiesSection
              items={plan.programmeActivities ?? []}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, programmeActivities: items }))}
            />
            <NGOCommunityEngagementSection
              items={plan.communityEngagement ?? []}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, communityEngagement: items }))}
            />
            <NGOVolunteerPlanSection
              items={plan.volunteerPlan ?? []}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, volunteerPlan: items }))}
            />
            <NGOStakeholderPlanSection
              items={plan.stakeholderPlan ?? []}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, stakeholderPlan: items }))}
            />
            <NGOResourcesLogisticsSection
              items={plan.resourcesLogistics ?? []}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, resourcesLogistics: items }))}
            />
            <NGOCommunicationsPlanSection
              items={plan.communicationsPlan ?? []}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, communicationsPlan: items }))}
            />
            <NGODocumentationPlanSection
              items={plan.documentationPlan ?? []}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, documentationPlan: items }))}
            />
            <NGOMonitoringImpactTargetsSection
              items={plan.monitoringImpactTargets ?? []}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, monitoringImpactTargets: items }))}
            />
          </>
        ) : (
          <>
            {hasPlanningCategory('primaryObjectives') && <WeeklyPlanTextListSection
              title={template.id === 'personal' ? 'Weekly Focus' : template.id === 'project-management' ? 'Weekly Objectives' : terminology.objectives === 'Objectives' ? 'Weekly Strategic Objectives' : terminology.objectives}
              summary={`${plan.weeklyStrategicObjectives.length} item${plan.weeklyStrategicObjectives.length === 1 ? '' : 's'}`}
              items={plan.weeklyStrategicObjectives}
              emptyText={template.id === 'personal' ? 'No weekly focus captured for this week yet.' : template.id === 'project-management' ? 'No weekly objectives captured for this week yet.' : `No ${terminology.objectives.toLowerCase()} captured for this week yet.`}
              placeholder={template.id === 'personal' ? 'Add the main focus for your week.' : template.id === 'project-management' ? 'Add a weekly objective' : `Add ${terminology.objective.toLowerCase()}`}
              compact
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, weeklyStrategicObjectives: items }))}
              renderItemExtras={template.id === 'project-management' ? (item, updateItem) => (
                <>
                  <input
                    aria-label="Success measure"
                    value={item.successMeasure ?? ''}
                    placeholder="Success Measure"
                    onChange={(event) => updateItem(item.id, { successMeasure: event.target.value || undefined })}
                  />
                  <select
                    aria-label="Objective priority"
                    value={item.priority ?? 'medium'}
                    onChange={(event) => updateItem(item.id, { priority: event.target.value as any })}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </>
              ) : undefined}
            />}
            {hasPlanningCategory('virtualEngagements') && template.id === 'field-service' && <WeeklyPlanVirtualEngagementSection
              items={plan.virtualEngagementPlan}
              title="Preventive Maintenance"
              helperText="Plan preventive maintenance work, routine checks and scheduled service activity for the week."
              emptyText="No preventive maintenance planned yet."
              addButtonText="+ Add maintenance"
              compact
              contactPlaceholder="Add customer contact"
              objectivePlaceholder="Describe the objective of this maintenance task"
              template={template}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, virtualEngagementPlan: items }))}
            />}
            {hasPlanningCategory('accountObjectives') && template.id === 'field-service' && <WeeklyPlanAccountObjectiveSection
              items={plan.keyAccountObjectives}
              title="Work Orders / Jobs"
              helperText="Capture the service jobs and work requests scheduled for the week."
              emptyText="No service jobs captured yet."
              addButtonText="+ Add job"
              compact
              accountPlaceholder="Site / service location"
              objectivePlaceholder="Add service job"
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, keyAccountObjectives: items }))}
            />}
            {hasPlanningCategory('virtualEngagements') && template.id === 'small-business' && <WeeklyPlanVirtualEngagementSection
              items={plan.virtualEngagementPlan}
              title="Leads / Opportunities"
              helperText="Track potential customers, quotes, and sales opportunities that need attention this week."
              emptyText="No leads or opportunities captured yet."
              addButtonText="+ Add lead"
              compact
              contactPlaceholder="Add customer / client"
              objectivePlaceholder="Describe the opportunity or follow-up needed"
              template={template}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, virtualEngagementPlan: items }))}
            />}
            {hasPlanningCategory('accountObjectives') && template.id === 'small-business' && <WeeklyPlanAccountObjectiveSection
              items={plan.keyAccountObjectives}
              title="Orders / Sales"
              helperText="Capture customers, commercial commitments, and sales work that needs attention this week."
              emptyText="No orders or sales work captured yet."
              addButtonText="+ Add order / sale"
              compact
              accountPlaceholder="Customer / client"
              objectivePlaceholder="Add sales objective"
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, keyAccountObjectives: items }))}
            />}
            {hasPlanningCategory('virtualEngagements') && template.id !== 'field-service' && template.id !== 'small-business' && <WeeklyPlanVirtualEngagementSection
              items={plan.virtualEngagementPlan}
              title={template.id === 'personal' ? 'Weekly Tasks' : getPlanningCategoryLabel('virtualEngagements')}
              helperText={template.id === 'project-management' ? 'Add the activities that matter this week.' : template.id === 'personal' ? 'Plan the weekly tasks that move your focus forward.' : undefined}
              emptyText={template.id === 'project-management' ? 'No key activities planned yet.' : template.id === 'personal' ? 'No weekly tasks captured yet.' : undefined}
              addButtonText={template.id === 'project-management' ? '+ Add key activity' : template.id === 'personal' ? '+ Add task' : undefined}
              compact
              contactPlaceholder={template.id === 'personal' ? 'Add a person or context' : 'Add priority contact'}
              objectivePlaceholder={template.id === 'personal' ? 'Describe the task or objective' : undefined}
              template={template}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, virtualEngagementPlan: items }))}
            />}
            {hasPlanningCategory('accountObjectives') && template.id !== 'field-service' && template.id !== 'small-business' && <WeeklyPlanAccountObjectiveSection
              items={plan.keyAccountObjectives}
              title={template.id === 'personal' ? 'Personal Routines' : getPlanningCategoryLabel('accountObjectives')}
              helperText={template.id === 'project-management' ? 'Add what needs to be delivered this week.' : template.id === 'personal' ? 'Capture recurring or planned personal routines that support the week.' : undefined}
              emptyText={template.id === 'project-management' ? 'No deliverables captured yet.' : template.id === 'personal' ? 'No personal routines captured yet.' : undefined}
              addButtonText={template.id === 'project-management' ? '+ Add deliverable' : template.id === 'personal' ? '+ Add routine' : undefined}
              compact
              accountPlaceholder={template.id === 'personal' ? 'Area / Commitment' : undefined}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, keyAccountObjectives: items }))}
            />}
            {hasPlanningCategory('commercialPriorities') && <WeeklyPlanCommercialPrioritySection
              items={plan.commercialPriorities}
              title={template.id === 'personal' ? 'Big Three' : template.id === 'project-management' ? 'Priorities' : template.id === 'field-service' ? 'Priority Issues' : template.id === 'small-business' ? 'Business Priorities' : undefined}
              helperText={template.id === 'personal' ? 'Capture the three most important personal outcomes or priorities for the week.' : template.id === 'project-management' ? 'Add the priorities that matter most.' : template.id === 'small-business' ? 'Capture the highest-priority business matters that need attention this week.' : template.id === 'field-service' ? 'Capture the service issues that need attention this week, with optional site and asset context.' : `Capture your ${terminology.priorities.toLowerCase()} for the selected week.`}
              compact
              template={template}
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, commercialPriorities: items }))}
            />}
            {template.id !== 'personal' && hasPlanningCategory('successMeasures') && <WeeklyPlanSuccessMeasureSection
              items={plan.successMeasures}
              title={template.id === 'field-service' ? 'Service Targets' : 'Success Measures'}
              helperText={template.id === 'project-management' ? "Define how you'll measure progress this week." : template.id === 'field-service' ? 'Track the service goals and measurable targets for the week.' : 'Track the measurable indicators of success for the week, with optional target and category context.'}
              emptyText={template.id === 'field-service' ? 'No service targets captured yet.' : 'No success measures captured yet.'}
              addButtonText={template.id === 'field-service' ? '+ Add target' : '+ Add measure'}
              compact
              onChange={(items) => setPlan((currentPlan) => ({ ...currentPlan, successMeasures: items }))}
            />}
          </>
        )}
      </div>
      <section className="daily-field-plan-section" aria-labelledby="daily-field-plan-heading">
        <div className="weekly-plan-summary-header daily-plan-header">
          <div>
            <p className="eyebrow">Daily planning</p>
            <h2 id="daily-field-plan-heading">Daily {terminology.activity} Plan</h2>
          </div>
          <span>Monday-Sunday</span>
        </div>
        <p className="weekly-plan-helper">{terminology.dailyPlanHelper ?? `Plan your ${terminology.priorities.toLowerCase()}, ${terminology.accounts.toLowerCase()} and ${terminology.objectives.toLowerCase()} for each day.`}</p>
        <div className="days-list">
          {plan.days.map((day) => <DayPlanSection day={day} key={day.id} expanded={expandedDayIds.includes(day.id)} onToggle={() => toggleDay(day.id)} onChange={updateDay} template={template} />)}
        </div>
      </section>
      <details className="plan-coverage">
        <summary className="plan-coverage-heading"><span><span className="eyebrow">Secondary review</span><strong id="plan-coverage-heading">Plan Coverage</strong></span><span>Derived from Daily Activity</span></summary>
        <div className="plan-coverage-days">{plan.days.map((day) => {
          const dayGaps = planIntelligence.planGaps.filter((gap) => gap.dayLabel === day.label)
          const plannedCount = day.categories.facilities.length + day.categories.virtualEngagements.length + day.categories.primaryObjectives.length + day.categories.accountObjectives.length + day.categories.commercialPriorities.length + day.categories.successMeasures.length
          const status = plannedCount === 0 ? 'No items' : dayGaps.length === 0 ? 'Covered' : dayGaps.length < plannedCount ? 'Partially covered' : dayGaps.some((gap) => gap.status === 'needs review') ? 'Needs review' : 'Not evidenced'
          return <div className="plan-coverage-day" key={day.id}><div><strong>{day.label}</strong><span>{plannedCount === 0 ? 'No matchable plan items' : `${plannedCount} planned item${plannedCount === 1 ? '' : 's'}`}</span></div><em className={`coverage-status ${status.toLowerCase().replace(' ', '-')}`}>{status}</em></div>
        })}</div>
        {planIntelligence.planGaps.length > 0 && <ul className="plan-coverage-gaps">{planIntelligence.planGaps.filter((gap) => gap.status !== 'covered').slice(0, 5).map((gap) => <li key={`${gap.itemId}-${gap.dayLabel}`}><strong>{gap.item}</strong><span>{gap.status}</span><small>{gap.reason}</small></li>)}</ul>}
      </details>
    </main>
  )
}

function getWeekNumber(weekStart: string) {
  return toWeekInput(weekStart).split('-W')[1]
}

function ReportHistory({ onSelectWeek, onOpenReport, onCompare = () => undefined, template = FIELD_SALES_TEMPLATE }: { onSelectWeek: (weekStart: string) => void; onOpenReport: (report: ReportHistoryEntry) => void; onCompare?: (baseline: ReportHistoryEntry, comparison: ReportHistoryEntry) => void; template?: WeekFlowTemplate }) {
  const [exportingWeek, setExportingWeek] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [templateFilter, setTemplateFilter] = useState('')
  const [weekFilter, setWeekFilter] = useState('')
  const [selectedReportWeeks, setSelectedReportWeeks] = useState<string[]>([])
  const [selectionMessage, setSelectionMessage] = useState('')
  const currentWorkspaceId = getCurrentWorkspaceId()
  const entries = loadReportHistoryEntries(currentWorkspaceId)
  const currentWeek = getCurrentWeekStart()
  const currentReport = entries.find((entry) => entry.weekKey === currentWeek) ?? null

  const historicalReports = entries
    .filter((entry) => entry.weekKey !== currentReport?.weekKey)
    .sort((left, right) => right.weekKey.localeCompare(left.weekKey))

  const templateOptions = [...new Map(historicalReports
    .filter((report) => report.template)
    .map((report) => [report.template?.id ?? '', report.template?.name ?? report.template?.id ?? '']))]
    .filter(([id, name]) => Boolean(id && name))
    .sort((left, right) => left[1].localeCompare(right[1]))
  const weekOptions = historicalReports.map((report) => ({ value: report.weekKey, label: formatWeekRange(report.weekKey) }))
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredReports = historicalReports.filter((report) => {
    const searchableText = [
      report.template?.name,
      report.template?.report.title,
      report.weekLabel,
      formatWeekRange(report.weekKey),
    ].filter(Boolean).join(' ').toLowerCase()
    return (!normalizedSearch || searchableText.includes(normalizedSearch))
      && (!templateFilter || report.template?.id === templateFilter)
      && (!weekFilter || report.weekKey === weekFilter)
  })
  const filtersActive = Boolean(normalizedSearch || templateFilter || weekFilter)

  function clearFilters() {
    setSearchQuery('')
    setTemplateFilter('')
    setWeekFilter('')
  }

  function toggleReportSelection(report: ReportHistoryEntry) {
    setSelectionMessage('')
    setSelectedReportWeeks((current) => {
      if (current.includes(report.weekKey)) return current.filter((weekKey) => weekKey !== report.weekKey)
      if (current.length >= 2) {
        setSelectionMessage('Select two reports from the same template to compare.')
        return current
      }
      return [...current, report.weekKey]
    })
  }

  const selectedReports = selectedReportWeeks.map((weekKey) => historicalReports.find((report) => report.weekKey === weekKey) ?? null)
  const selectedBaseline = selectedReports[0]
  const selectedComparison = selectedReports[1]
  const selectionValidation = selectedBaseline && selectedComparison ? validateReportComparison(selectedBaseline, selectedComparison, currentWorkspaceId) : null
  const comparisonReady = selectionValidation?.valid === true

  function openWeek(weekStart: string) {
    onSelectWeek(weekStart)
    navigateTo('/weekly-plan')
  }

  function readinessLabel(status: 'ready' | 'review' | 'empty') {
    return status === 'ready' ? 'Ready to Review' : status === 'review' ? 'Needs Attention' : "Week Hasn't Started"
  }

  function renderReport(report: typeof historicalReports[number], current = false) {
    const readiness = deriveWeeklyIntelligence({ selectedWeek: report.weekKey, plan: report.plan, activities: report.activities, followUps: report.followUps, template }).reportReadiness
    const statusLabel = readinessLabel(readiness.status)
    const selected = selectedReportWeeks.includes(report.weekKey)
    return <article className={`report-history-item${current ? ' is-current' : ''}${selected ? ' is-selected' : ''}`} key={report.weekKey} role="listitem">
      <div className="report-history-primary"><label className="report-history-selection"><input type="checkbox" aria-label={`Select ${current ? 'current week' : `week ${getWeekNumber(report.weekKey)}`} for comparison`} checked={selected} disabled={current} onChange={() => toggleReportSelection(report)} /><span aria-hidden="true" /></label><div><strong>{current ? 'Current Week' : `Week ${getWeekNumber(report.weekKey)}`}</strong><span>{formatWeekRange(report.weekKey)}</span><small>{current ? 'Current reporting period' : `Generated ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(report.generatedAt))}`}</small></div></div>
      <div className="report-history-details"><span>{report.template?.name ?? template.name}</span><strong className={`report-history-readiness is-${readiness.status}`}>{statusLabel}</strong><div className="report-history-status"><span>{report.activities.length} activit{report.activities.length === 1 ? 'y' : 'ies'}</span><span>{report.followUps.length} follow-ups</span><span>{report.followUps.filter((followUp) => followUp.status === 'completed').length} completed</span></div></div>
      <div className="report-history-actions"><button type="button" onClick={() => { onSelectWeek(report.weekKey); onOpenReport(report) }}>Open Report</button>{!current && <button type="button" onClick={() => openWeek(report.weekKey)}>Open Week</button>}<button type="button" onClick={() => exportHistoricalReport(report.weekKey)} disabled={exportingWeek !== null}>{exportingWeek === report.weekKey ? 'Exporting...' : 'Export Word'}</button></div>
    </article>
  }

  async function exportHistoricalReport(weekStart: string) {
    setExportingWeek(weekStart)
    setExportMessage('')
    try {
      const snapshot = getReportHistoryEntry(weekStart, currentWorkspaceId)
      if (!snapshot) return
      const { exportReportWord } = await import('./utils/reportDocx')
      const result = await exportReportWord(snapshot)
      setExportMessage(`Downloaded ${result.filename}`)
    } catch {
      setExportMessage('Word export could not be completed. Please try again.')
    } finally {
      setExportingWeek(null)
    }
  }

  const hasHistory = Boolean(currentReport || filteredReports.length > 0)
  const hasEntries = entries.length > 0

  return (
    <section className="report-history" aria-labelledby="report-history-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Report History</p>
          <h2 id="report-history-heading">Report History</h2>
        </div>
        <p>Review reports from previous weeks and keep track of your work over time.</p>
      </div>
      {hasEntries && <div className="report-history-toolbar" aria-label="Report history filters">
        <label className="report-history-filter report-history-search" htmlFor="report-history-search">
          <span>Search reports</span>
          <input id="report-history-search" type="search" placeholder="Search reports..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
        </label>
        <label className="report-history-filter" htmlFor="report-history-template">
          <span>Template</span>
          <select id="report-history-template" value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)}>
            <option value="">All Templates</option>
            {templateOptions.map(([id, name]) => <option value={id} key={id}>{name}</option>)}
          </select>
        </label>
        <label className="report-history-filter" htmlFor="report-history-week">
          <span>Week</span>
          <select id="report-history-week" value={weekFilter} onChange={(event) => setWeekFilter(event.target.value)}>
            <option value="">All Weeks</option>
            {weekOptions.map((week) => <option value={week.value} key={week.value}>{week.label}</option>)}
          </select>
        </label>
        {filtersActive && <button className="report-history-clear" type="button" onClick={clearFilters}>Clear filters</button>}
      </div>}
      {hasEntries && <p className="report-history-result-count" role="status">Showing {filteredReports.length} of {historicalReports.length} reports</p>}
      {hasEntries && <div className="report-history-comparison-bar"><span>{selectedReportWeeks.length} of 2 reports selected</span><button className="button button-primary" type="button" disabled={!comparisonReady} onClick={() => { if (selectedBaseline && selectedComparison) onCompare(selectedBaseline, selectedComparison) }}>Compare</button>{selectionMessage && <p role="alert">{selectionMessage}</p>}{selectionValidation && !selectionValidation.valid && <p role="alert">{selectionValidation.message}</p>}</div>}
      {currentReport ? <div className="report-history-current" aria-label="Current reporting week"><div className="report-history-list" role="list">{renderReport(currentReport, true)}</div></div> : null}
      {filteredReports.length > 0 ? <div className="report-history-list" role="list">{filteredReports.map((report) => renderReport(report))}</div> : !hasEntries ? <div className="report-history-empty-state"><h3>No reports yet</h3><p>Generate your first weekly report and it will appear here.</p><button className="button button-primary" type="button" onClick={() => navigateTo('/report')}>Go to Generate Report</button></div> : filtersActive ? <div className="report-history-filtered-empty"><p>No reports match these filters.</p><button className="report-history-clear" type="button" onClick={clearFilters}>Clear filters</button></div> : !hasHistory ? <p className="report-history-empty">No previous reports yet. Completed weekly activity will appear here.</p> : null}
      {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}
    </section>
  )
}

function ReportHistoryScreen({ onSelectWeek, onOpenReport, onCompare = (baseline, comparison) => navigateTo(`/report-comparison?from=${encodeURIComponent(baseline.weekKey)}&to=${encodeURIComponent(comparison.weekKey)}`), template = FIELD_SALES_TEMPLATE }: { selectedWeek?: string; onSelectWeek: (weekStart: string) => void; onOpenReport: (report: ReportHistoryEntry) => void; onCompare?: (baseline: ReportHistoryEntry, comparison: ReportHistoryEntry) => void; template?: WeekFlowTemplate }) {
  return <main className="report-history-screen"><ReportHistory onSelectWeek={onSelectWeek} onOpenReport={onOpenReport} onCompare={onCompare} template={template} /></main>
}

function getHistoricalReportWeek() {
  const week = new URLSearchParams(window.location.search).get('historyWeek')
  return week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : null
}

function getComparisonWeeks() {
  const params = new URLSearchParams(window.location.search)
  const from = params.get('from')
  const to = params.get('to')
  return from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) ? { from, to } : null
}

function getEntryWeekContext(screen: string) {
  // Explicit week navigation is authoritative; only unset/default contexts adapt to the workflow.
  if (getWeekSelectionSource() === 'explicit') return null
  if (screen === 'weekly-plan') return { weekStart: getPlanningWeekStart(), source: 'planning-default' as const }
  if (screen === 'daily-activity') return { weekStart: getCurrentWeekStart(), source: 'activity-default' as const }
  return null
}

function getInitialWeekContext() {
  return getSelectedWeekStart()
}

function getActiveReportMetadata(user: UserProfile | null, workspace: Workspace | null): ReportMetadata | undefined {
  const configured = workspace?.reportMetadata ?? {}
  const preparedBy = configured.preparedBy?.trim() || user?.displayName?.trim() || user?.email?.trim()
  const metadata = { ...configured, ...(preparedBy ? { preparedBy } : {}) }
  return Object.values(metadata).some((value) => Boolean(value?.trim())) ? metadata : undefined
}

function App() {
  const [accountState, setAccountState] = useState<AccountState>(() => isSupabaseConfigured ? { status: 'loading', user: null } : { status: 'local-demo', user: null })
  const accountStatusRef = useRef<AccountState['status']>(isSupabaseConfigured ? 'loading' : 'local-demo')
  const bootstrapMountIdRef = useRef(Math.random().toString(36).slice(2, 10))
  const [activeScreen, setActiveScreen] = useState(getInitialScreen)
  const [historicalReportWeek, setHistoricalReportWeek] = useState(getHistoricalReportWeek)
  const [historicalReportSnapshot, setHistoricalReportSnapshot] = useState<ReportHistoryEntry | null>(() => {
    const week = getHistoricalReportWeek()
    return week ? getReportHistoryEntry(week, getCurrentWorkspaceId()) : null
  })
  const [comparisonReports, setComparisonReports] = useState<{ baseline: ReportHistoryEntry; comparison: ReportHistoryEntry } | null>(() => {
    const weeks = getComparisonWeeks()
    if (!weeks) return null
    const baseline = getReportHistoryEntry(weeks.from, getCurrentWorkspaceId())
    const comparison = getReportHistoryEntry(weeks.to, getCurrentWorkspaceId())
    return baseline && comparison ? { baseline, comparison } : null
  })
  const [selectedWeek, setSelectedWeek] = useState(getInitialWeekContext)
  const [selectedTemplate, setSelectedTemplate] = useState(getSelectedTemplate)
  const [currentWorkspace, setCurrentWorkspace] = useState(getCurrentWorkspace)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [showCustomTemplateBuilder, setShowCustomTemplateBuilder] = useState(false)
  const [workspaceToRename, setWorkspaceToRename] = useState<ReturnType<typeof getCurrentWorkspace> | null>(null)
  const [workspaceRenameName, setWorkspaceRenameName] = useState('')
  const [workspaceReportMetadata, setWorkspaceReportMetadata] = useState<Record<string, string>>({})
  const [workspaceRenamePending, setWorkspaceRenamePending] = useState(false)
  const [workspaceRenameError, setWorkspaceRenameError] = useState('')
  const [workspaceToDelete, setWorkspaceToDelete] = useState<ReturnType<typeof getCurrentWorkspace> | null>(null)
  const [workspaceDeletePending, setWorkspaceDeletePending] = useState(false)
  const [workspaceDeleteError, setWorkspaceDeleteError] = useState('')
  const [workspaceListVersion, setWorkspaceListVersion] = useState(0)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceTemplateId, setNewWorkspaceTemplateId] = useState('field-sales')
  const [workspaceCreateValidation, setWorkspaceCreateValidation] = useState('')
  const [workspaceCreateReturnPath, setWorkspaceCreateReturnPath] = useState('/')
  const [navigationCollapsed, setNavigationCollapsed] = useState(false)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [workspaceInitializationError, setWorkspaceInitializationError] = useState('')
  const [themePreference] = useState(getStoredThemePreference)
  const [workspaceInitializationPending, setWorkspaceInitializationPending] = useState(false)
  const [workspaceReadyOwnerId, setWorkspaceReadyOwnerId] = useState<string | null>(null)
  const accountStateRef = useRef(accountState)
  const workspaceReadyOwnerRef = useRef(workspaceReadyOwnerId)
  const initializedWorkspaceOwnersRef = useRef(new Map<string, Promise<void>>())

  function logBootstrap(event: string, extra: Record<string, unknown> = {}) {
    if (!import.meta.env.DEV) return
    console.info('[WeekFlow bootstrap]', {
      event,
      path: window.location.pathname,
      mountId: bootstrapMountIdRef.current,
      accountStatus: accountState.status,
      authenticatedUserPresent: accountState.status === 'authenticated',
      workspaceInitializationPending,
      workspaceReadyOwnerPresent: workspaceReadyOwnerId !== null,
      workspaceReadyOwnerMatchesAccount: accountState.status === 'authenticated' && workspaceReadyOwnerId === accountState.user.id,
      currentWorkspacePresent: currentWorkspace !== null,
      ...extra,
    })
  }

  useEffect(() => {
    applyTheme(themePreference)
  }, [themePreference])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => {
      if (getStoredThemePreference() === 'system') applyTheme('system')
    }
    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [])

  useEffect(() => {
    logBootstrap('APP_MOUNT')
    return () => logBootstrap('APP_UNMOUNT')
  }, [])

  useEffect(() => {
    logBootstrap('STATE_TRANSITION')
  }, [accountState, workspaceInitializationPending, workspaceReadyOwnerId, currentWorkspace])

  useEffect(() => {
    accountStateRef.current = accountState
  }, [accountState])

  useEffect(() => {
    workspaceReadyOwnerRef.current = workspaceReadyOwnerId
  }, [workspaceReadyOwnerId])

  useEffect(() => {
    if (!historicalReportWeek) return
    if (accountState.status === 'authenticated' && workspaceReadyOwnerId !== accountState.user.id) return
          setHistoricalReportSnapshot(getReportHistoryEntry(historicalReportWeek, getCurrentWorkspaceId()))
  }, [accountState, historicalReportWeek, workspaceReadyOwnerId, currentWorkspace?.id])

  async function initializeAuthenticatedWorkspace(user: UserProfile) {
    const ownerId = user.id
    logBootstrap('WORKSPACE_INIT_START', { existingInitialization: initializedWorkspaceOwnersRef.current.has(ownerId) })

    if (accountStateRef.current.status === 'authenticated' && accountStateRef.current.user?.id === ownerId && workspaceReadyOwnerRef.current === ownerId) {
      logBootstrap('WORKSPACE_INIT_SKIPPED_ALREADY_READY')
      return undefined
    }

    const existingInitialization = initializedWorkspaceOwnersRef.current.get(ownerId)
    if (existingInitialization) {
      logBootstrap('WORKSPACE_INIT_REUSED_INFLIGHT')
      return existingInitialization
    }

    setWorkspaceInitializationPending(true)
    if (accountStateRef.current.status === 'authenticated' && accountStateRef.current.user?.id === ownerId) {
      setWorkspaceReadyOwnerId(null)
      logBootstrap('WORKSPACE_READY_CLEAR', { reason: 'reinitializing same authenticated owner' })
    }

    const initialization = (async () => {
      setWorkspaceInitializationError('')
      const workspace = await ensureFirstWorkspaceForOwner(ownerId, 'My Workspace', 'personal')
      if (!workspace) {
        setCurrentWorkspace(null)
        setSelectedTemplate(getSelectedTemplate())
        setSelectedWeek(getSelectedWeekStart())
        setWorkspaceReadyOwnerId(ownerId)
        logBootstrap('WORKSPACE_INIT_NO_WORKSPACE', { validEmptyState: true })
        return
      }

      const provisionedWorkspace = await provisionWorkspaceInCloud(workspace)
      setCurrentWorkspace(provisionedWorkspace)
      const entryContext = getEntryWeekContext(getScreenFromPath())
      if (entryContext) {
        setSelectedWeekStart(entryContext.weekStart, entryContext.source)
        setSelectedWeek(entryContext.weekStart)
      } else {
        setSelectedWeek(getSelectedWeekStart())
      }
      setSelectedTemplate(getSelectedTemplate())
      setWorkspaceReadyOwnerId(ownerId)
      logBootstrap('WORKSPACE_INIT_SUCCESS')
    })().catch((error) => {
      const message = error instanceof Error ? error.message : 'Workspace setup could not be completed. Your local workspace is still available.'
      setWorkspaceInitializationError(message)
      setCurrentWorkspace(getCurrentWorkspace())
      setSelectedTemplate(getSelectedTemplate())
      setSelectedWeek(getSelectedWeekStart())
      setWorkspaceReadyOwnerId(ownerId)
      logBootstrap('WORKSPACE_INIT_ERROR', { error: message })
    }).finally(() => {
      initializedWorkspaceOwnersRef.current.delete(ownerId)
      setWorkspaceInitializationPending(false)
      logBootstrap('WORKSPACE_INIT_FINALLY')
    })

    initializedWorkspaceOwnersRef.current.set(ownerId, initialization)
    return initialization
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    getCurrentUser()
      .then((user) => {
        if (active) {
          logBootstrap('AUTH_GET_CURRENT_USER_RESOLVED', { authenticatedUserPresent: user !== null })
          setWorkspaceOwner(user?.id ?? null)
          setWorkspaceReadyOwnerId(null)
          setWorkspaceInitializationError('')
          const nextState: AccountState = user ? { status: 'authenticated', user } : { status: 'unauthenticated', user: null }
          accountStatusRef.current = nextState.status
          accountStateRef.current = nextState
          setAccountState(nextState)
          if (user && window.location.pathname !== '/reset-password') {
            void initializeAuthenticatedWorkspace(user)
            if (window.location.pathname === '/auth/callback') navigateTo('/workspaces')
          }
        }
      })
      .catch((error) => {
        if (active) {
          const message = error instanceof Error ? error.message : 'Authentication could not be completed.'
          logBootstrap('AUTH_GET_CURRENT_USER_ERROR', { error: message })
          setWorkspaceOwner(null)
          setWorkspaceInitializationError(message)
          setWorkspaceReadyOwnerId(null)
          accountStatusRef.current = 'unauthenticated'
          accountStateRef.current = { status: 'unauthenticated', user: null }
          setAccountState({ status: 'unauthenticated', user: null })
        }
      })
    const unsubscribe = accountProvider.onAuthStateChange((state) => {
      if (!active) return
      const previousStatus = accountStatusRef.current
      logBootstrap('AUTH_CALLBACK_EVENT', { previousStatus, nextStatus: state.status })
      accountStatusRef.current = state.status

      if (state.status !== 'authenticated') {
        setWorkspaceOwner(null)
        setWorkspaceReadyOwnerId(null)
        logBootstrap('WORKSPACE_READY_CLEAR', { reason: 'auth callback unauthenticated' })
      } else {
        setWorkspaceOwner(state.user.id)
        const activeUserId = accountStateRef.current.status === 'authenticated' ? accountStateRef.current.user.id : null
        const isSameAuthenticatedOwner = previousStatus === 'authenticated' && activeUserId === state.user.id
        if (!isSameAuthenticatedOwner) {
          setWorkspaceReadyOwnerId(null)
          logBootstrap('WORKSPACE_READY_CLEAR', { reason: 'auth callback authenticated owner changed' })
        }
      }

      accountStateRef.current = state
      setAccountState(state)
      if (state.status === 'authenticated' && (previousStatus === 'unauthenticated' || window.location.pathname === '/auth/callback')) {
        if (window.location.pathname !== '/reset-password') {
          window.setTimeout(() => {
            if (active) void initializeAuthenticatedWorkspace(state.user)
          }, 0)
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
        if (workspaceToRename && !workspaceRenamePending) {
          setWorkspaceToRename(null)
          setWorkspaceRenameName('')
          setWorkspaceRenameError('')
          return
        }
        if (workspaceToDelete && !workspaceDeletePending) {
          setWorkspaceToDelete(null)
          setWorkspaceDeleteError('')
          return
        }
        setNavigationOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCreateWorkspace, workspaceDeletePending, workspaceToRename, workspaceRenamePending, workspaceToDelete])

  useEffect(() => {
    // Monitor hash changes for backward compatibility (e.g., old bookmarks, external links)
    const handleHashChange = () => {
      handleOldHashRoutes()
    }

    const handleLocationChange = () => {
      const historicalWeek = getHistoricalReportWeek()
      const comparisonWeeks = getComparisonWeeks()
      const nextScreen = getScreenFromPath()
      const entryContext = getEntryWeekContext(nextScreen)
      if (entryContext) {
        setSelectedWeekStart(entryContext.weekStart, entryContext.source)
        setSelectedWeek(entryContext.weekStart)
      }
      setActiveScreen(nextScreen)
      setHistoricalReportWeek(historicalWeek)
      setHistoricalReportSnapshot(historicalWeek ? getReportHistoryEntry(historicalWeek, getCurrentWorkspaceId()) : null)
      const baseline = comparisonWeeks ? getReportHistoryEntry(comparisonWeeks.from, getCurrentWorkspaceId()) : null
      const comparison = comparisonWeeks ? getReportHistoryEntry(comparisonWeeks.to, getCurrentWorkspaceId()) : null
      setComparisonReports(baseline && comparison ? { baseline, comparison } : null)
    }
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
    setWorkspaceCreateReturnPath('/')
    setWorkspaceCreateValidation('')
    setNewWorkspaceName('')
    setNewWorkspaceTemplateId('field-sales')
    setShowCreateWorkspace(true)
  }

  function openCustomTemplateBuilder() {
    setShowCreateWorkspace(false)
    setWorkspaceCreateValidation('')
    setShowCustomTemplateBuilder(true)
  }

  function openCustomTemplateEditor() {
    if (currentWorkspace?.templateId !== 'custom') return
    setShowCreateWorkspace(false)
    setWorkspaceCreateValidation('')
    setShowCustomTemplateBuilder(true)
  }

  function selectWorkspace(workspaceId: string) {
    const didSelect = setCurrentWorkspaceId(workspaceId)
    if (!didSelect) return
    setCurrentWorkspace(getCurrentWorkspace())
    setSelectedWeek(getSelectedWeekStart())
    setSelectedTemplate(getSelectedTemplate())
    setHistoricalReportWeek(null)
    setHistoricalReportSnapshot(null)
    setComparisonReports(null)
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
    setWorkspaceListVersion((current) => current + 1)
    setSelectedTemplate(getSelectedTemplate())
    setSelectedWeek(getSelectedWeekStart())
    setShowCreateWorkspace(false)
    setNewWorkspaceName('')
    setNewWorkspaceTemplateId('field-sales')
    setWorkspaceCreateValidation('')
    setWorkspaceMenuOpen(false)
    navigateTo(workspaceCreateReturnPath)
  }

  async function createCustomWorkspace(config: CustomTemplateConfig) {
    const trimmedName = normalizeWorkspaceName(config.name)
    if (!trimmedName) return
    if (isWorkspaceNameTaken(trimmedName)) return

    const ownerId = accountState.status === 'authenticated' ? accountState.user.id : DEFAULT_ACCOUNT_ID
    const workspace = createWorkspace(trimmedName, 'custom', ownerId)
    saveCustomTemplateConfig({ ...config, name: trimmedName }, workspace.id)
    let provisionedWorkspace = workspace
    if (accountState.status === 'authenticated') {
      try {
        provisionedWorkspace = await provisionWorkspaceInCloud(workspace)
      } catch {
        setCurrentWorkspace(workspace)
        setSelectedTemplate(getSelectedTemplate())
        setWorkspaceListVersion((current) => current + 1)
        setShowCustomTemplateBuilder(false)
        navigateTo(workspaceCreateReturnPath)
        return
      }
    }
    setCurrentWorkspace(provisionedWorkspace)
    setSelectedTemplate(getSelectedTemplate())
    setSelectedWeek(getSelectedWeekStart())
    setWorkspaceListVersion((current) => current + 1)
    setShowCustomTemplateBuilder(false)
    setWorkspaceMenuOpen(false)
    navigateTo(workspaceCreateReturnPath)
  }

  function saveCustomTemplateEdit(config: CustomTemplateConfig) {
    if (!currentWorkspace || currentWorkspace.templateId !== 'custom') return
    saveCustomTemplateConfig(config, currentWorkspace.id)
    setSelectedTemplate(getSelectedTemplate())
    setWorkspaceListVersion((current) => current + 1)
    setShowCustomTemplateBuilder(false)
  }

  async function confirmWorkspaceDeletion() {
    if (!workspaceToDelete) return
    setWorkspaceDeletePending(true)
    setWorkspaceDeleteError('')
    const wasCurrent = workspaceToDelete.id === currentWorkspace?.id
    try {
      const result = await deleteWorkspace(workspaceToDelete.id)
      setWorkspaceListVersion((current) => current + 1)
      if (wasCurrent) {
        setCurrentWorkspace(result.currentWorkspace)
        setSelectedTemplate(getSelectedTemplate())
        setSelectedWeek(getSelectedWeekStart())
        setHistoricalReportWeek(null)
        setHistoricalReportSnapshot(null)
        navigateTo(result.currentWorkspace ? '/' : '/workspaces')
      }
      setWorkspaceToDelete(null)
    } catch (error) {
      setWorkspaceDeleteError(error instanceof Error ? error.message : 'Workspace deletion failed. Please try again.')
    } finally {
      setWorkspaceDeletePending(false)
    }
  }

  async function confirmWorkspaceRename() {
    if (!workspaceToRename) return
    setWorkspaceRenamePending(true)
    setWorkspaceRenameError('')
    try {
      const metadata = Object.fromEntries(Object.entries(workspaceReportMetadata).filter(([, value]) => typeof value === 'string' && value.trim())) as ReportMetadata
      const renamedWorkspace = await renameWorkspace(workspaceToRename.id, workspaceRenameName, metadata)
      setWorkspaceListVersion((current) => current + 1)
      if (renamedWorkspace.id === currentWorkspace?.id) setCurrentWorkspace(renamedWorkspace)
      setWorkspaceToRename(null)
      setWorkspaceRenameName('')
      setWorkspaceReportMetadata({})
    } catch (error) {
      setWorkspaceRenameError(error instanceof Error ? error.message : 'Workspace rename failed. Please try again.')
    } finally {
      setWorkspaceRenamePending(false)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      setWorkspaceOwner(null)
      setWorkspaceReadyOwnerId(null)
      setAccountState({ status: 'unauthenticated', user: null })
      navigateTo('/')
    } catch {
      // The shell remains available if sign-out cannot complete.
    }
  }

  async function handleAccountDeleted() {
    const ownerId = accountState.status === 'authenticated' ? accountState.user.id : null
    if (ownerId) clearWorkspaceOwnerLocalData(ownerId)
    try {
      await signOut()
    } catch {
      // The Auth user has already been deleted; finish local teardown regardless.
    }
    setWorkspaceOwner(null)
    setWorkspaceReadyOwnerId(null)
    setCurrentWorkspace(null)
    setSelectedTemplate(FIELD_SALES_TEMPLATE)
    setSelectedWeek(getCurrentWeekStart())
    accountStatusRef.current = 'unauthenticated'
    accountStateRef.current = { status: 'unauthenticated', user: null }
    setAccountState({ status: 'unauthenticated', user: null })
    navigateTo('/')
  }

  if (window.location.pathname === '/forgot-password') return <ForgotPasswordScreen />
  if (window.location.pathname === '/reset-password') return <ResetPasswordScreen />
  if (window.location.pathname === '/support') return <SupportScreen />
  if (window.location.pathname === '/contact') return <ContactScreen />
  if (window.location.pathname === '/guides') return <SupportGuidesPage />
  if (window.location.pathname === '/guides/getting-started') return <SupportGettingStartedPage />
  if (window.location.pathname === '/templates') return <SupportTemplatesPage />
  const shouldBlockForAuthenticatedBootstrap = isAuthenticatedBootstrapBlocked({
    accountStatus: accountState.status,
    workspaceInitializationPending,
    workspaceReadyOwnerId,
    workspaceInitializationError,
    authenticatedUserId: accountState.status === 'authenticated' ? accountState.user.id : null,
  })
  if (accountState.status === 'loading' || shouldBlockForAuthenticatedBootstrap) return <AuthLoadingScreen />
  if (accountState.status === 'unauthenticated') {
    if (window.location.pathname === '/auth/callback') return <AuthCallbackScreen />
    if (window.location.pathname === '/') return <PublicLandingScreen onSignIn={() => navigateTo('/sign-in')} onCreateAccount={() => navigateTo('/sign-up')} />
    return <AuthenticationScreen initialMode={window.location.pathname === '/sign-up' ? 'signup' : 'signin'} />
  }

  const currentCustomConfig = currentWorkspace?.templateId === 'custom' && currentWorkspace ? loadCustomTemplateConfig(currentWorkspace.id) : null
  if (activeScreen === 'report-comparison') {
    const reports = comparisonReports
    const validation = reports ? validateReportComparison(reports.baseline, reports.comparison, getCurrentWorkspaceId()) : { valid: false as const, message: 'The saved reports for this comparison could not be found in the active workspace.' }
    if (!validation.valid) return <main className="report-comparison-screen"><section className="report-history-empty-state"><h1>Comparison unavailable</h1><p>{validation.message}</p><button className="button button-secondary" type="button" onClick={() => navigateTo('/report-history')}>Back to Report History</button></section></main>
    if (!reports) return null
    return <ReportComparisonScreen comparison={buildReportComparison(reports.baseline, reports.comparison, getCurrentWorkspaceId() as string)} />
  }
  return (
    <div className="app-shell" style={currentCustomConfig ? { ['--color-accent' as string]: currentCustomConfig.accent, ['--color-accent-hover' as string]: currentCustomConfig.accent, ['--accent' as string]: currentCustomConfig.accent, ['--accent-dark' as string]: currentCustomConfig.accent } : undefined}>
      <Header
        selectedWeek={selectedWeek}
        currentWorkspace={currentWorkspace}
        currentTemplate={selectedTemplate}
        workspaceMenuOpen={workspaceMenuOpen}
        onToggleWorkspaceMenu={() => setWorkspaceMenuOpen((current) => !current)}
        onOpenNavigation={() => setNavigationOpen(true)}
        onSelectWorkspace={selectWorkspace}
        onOpenProfile={() => navigateTo('/profile')}
        user={accountState.status === 'authenticated' ? accountState.user : null}
        onSignOut={handleSignOut}
      />
      {workspaceInitializationError && <p className="workspace-initialization-error" role="status">{workspaceInitializationError}</p>}
      <WorkspaceCreateDialog
        isOpen={showCreateWorkspace && !showCustomTemplateBuilder}
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
        onCustomTemplate={openCustomTemplateBuilder}
        validationMessage={workspaceCreateValidation}
      />
      <WorkspaceDeleteDialog
        workspace={workspaceToDelete}
        isDeleting={workspaceDeletePending}
        errorMessage={workspaceDeleteError}
        onClose={() => {
          if (workspaceDeletePending) return
          setWorkspaceToDelete(null)
          setWorkspaceDeleteError('')
        }}
        onConfirm={confirmWorkspaceDeletion}
      />
      <WorkspaceRenameDialog
        workspace={workspaceToRename}
        name={workspaceRenameName}
        metadataFields={getReportMetadataFields(workspaceToRename?.templateId ?? currentWorkspace?.templateId ?? selectedTemplate.id)}
        metadataValues={workspaceReportMetadata}
        isSaving={workspaceRenamePending}
        errorMessage={workspaceRenameError}
        onNameChange={(name) => {
          setWorkspaceRenameName(name)
          if (workspaceRenameError) setWorkspaceRenameError('')
        }}
        onMetadataChange={(field, value) => {
          setWorkspaceReportMetadata((current) => ({ ...current, [field]: value }))
        }}
        onClose={() => {
          if (workspaceRenamePending) return
          setWorkspaceToRename(null)
          setWorkspaceRenameName('')
          setWorkspaceReportMetadata({})
          setWorkspaceRenameError('')
        }}
        onConfirm={confirmWorkspaceRename}
        onRequestDelete={() => {
          if (!workspaceToRename) return
          setWorkspaceRenameError('')
          setWorkspaceToDelete(workspaceToRename)
          setWorkspaceToRename(null)
        }}
      />
      {activeScreen !== 'profile' && <WeekNavigation weekStart={selectedWeek} onChange={changeWeek} />}
      <div className="app-body">
        <AppNavigation activeScreen={activeScreen} templateName={currentWorkspace ? selectedTemplate.name : 'No workspace selected'} onSwitchTemplate={openTemplateSelection} onEditCustomTemplate={openCustomTemplateEditor} onNavigate={navigateTo} collapsed={navigationCollapsed} mobileOpen={navigationOpen} onToggleCollapse={() => setNavigationCollapsed((current) => !current)} onClose={() => setNavigationOpen(false)} />
        {navigationOpen && <button className="navigation-overlay" type="button" aria-label="Close navigation" onClick={() => setNavigationOpen(false)} />}
        {showCustomTemplateBuilder ? <CustomTemplateBuilder mode={currentWorkspace?.templateId === 'custom' ? 'edit' : 'create'} initialConfig={currentWorkspace?.templateId === 'custom' ? loadCustomTemplateConfig(currentWorkspace.id) : undefined} onCancel={() => setShowCustomTemplateBuilder(false)} onCreate={currentWorkspace?.templateId === 'custom' ? saveCustomTemplateEdit : createCustomWorkspace} /> : activeScreen === 'profile' ? <ProfileSettingsScreen user={accountState.status === 'authenticated' ? accountState.user : { id: '', displayName: '', email: '', createdAt: '', updatedAt: '' }} workspaces={loadWorkspaces()} currentWorkspaceId={currentWorkspace?.id ?? null} onProfileUpdated={(profile) => setAccountState((state) => state.status === 'authenticated' ? { ...state, user: profile } : state)} onWorkspaceSelected={selectWorkspace} onSignOut={handleSignOut} onAccountDeleted={handleAccountDeleted} onClose={() => navigateTo('/')} /> : activeScreen === 'workspaces' ? <WorkspaceHomeScreen key={workspaceListVersion} user={accountState.status === 'authenticated' ? accountState.user : null} currentWorkspaceId={currentWorkspace?.id ?? null} onOpenWorkspace={(workspaceId) => { selectWorkspace(workspaceId); navigateTo('/') }} onRequestRename={(workspaceId) => {
          const workspace = loadWorkspaces().find((candidate) => candidate.id === workspaceId)
          if (!workspace) return
          setWorkspaceRenameError('')
          setWorkspaceRenameName(workspace.name)
          setWorkspaceReportMetadata(Object.fromEntries(Object.entries(workspace.reportMetadata ?? {}).filter(([, value]) => typeof value === 'string').map(([key, value]) => [key, value])))
          setWorkspaceToRename(workspace)
        }} onCreateWorkspace={() => {
          setWorkspaceCreateReturnPath('/workspaces')
          setWorkspaceCreateValidation('')
          setNewWorkspaceName('')
          setNewWorkspaceTemplateId('field-sales')
          setShowCreateWorkspace(true)
        }} /> : !currentWorkspace ? <NoWorkspaceScreen onCreateWorkspace={() => {
          setWorkspaceCreateReturnPath('/')
          setWorkspaceCreateValidation('')
          setNewWorkspaceName('')
          setNewWorkspaceTemplateId('field-sales')
          setShowCreateWorkspace(true)
        }} /> : activeScreen === 'weekly-plan' ? <WeeklyPlanScreen key={`${currentWorkspace.id}-${selectedWeek}-${selectedTemplate.id}`} template={selectedTemplate} /> : activeScreen === 'daily-activity' ? <DailyActivityScreen key={`${currentWorkspace.id}-${selectedWeek}-${selectedTemplate.id}`} template={selectedTemplate} /> : activeScreen === 'education-records' && selectedTemplate.id === 'education' ? <EducationRecordsScreen key={`${currentWorkspace.id}-${selectedWeek}-${selectedTemplate.id}`} weekStart={selectedWeek} /> : activeScreen === 'follow-ups' ? <FollowUpsScreen key={`${currentWorkspace.id}-${selectedWeek}-${selectedTemplate.id}`} template={selectedTemplate} /> : activeScreen === 'report' ? historicalReportWeek && !historicalReportSnapshot ? <main className="generate-report-screen"><section className="report-readiness report-readiness-review" aria-label="Historical report unavailable"><h1>Historical report unavailable</h1><p>The saved report snapshot for this workspace and week could not be found.</p><a className="button button-secondary" href="/report-history" onClick={(event) => { event.preventDefault(); navigateTo('/report-history') }}>Back to Report History</a></section></main> : <Suspense fallback={<main className="auth-screen" aria-busy="true"><div className="auth-panel auth-loading"><img className="auth-logo" src={logoImage} alt="WeekFlow" /></div></main>}><GenerateReportScreen key={`${currentWorkspace.id}-${selectedWeek}-${selectedTemplate.id}-${historicalReportWeek ?? 'live'}`} template={historicalReportSnapshot?.template ?? selectedTemplate} historicalSnapshot={historicalReportSnapshot} reportMetadata={getActiveReportMetadata(accountState.status === 'authenticated' ? accountState.user : null, currentWorkspace)} /></Suspense> : activeScreen === 'report-history' ? <ReportHistoryScreen selectedWeek={selectedWeek} onSelectWeek={changeWeek} onOpenReport={(report) => { setHistoricalReportWeek(report.weekKey); setHistoricalReportSnapshot(report); navigateTo(`/report?historyWeek=${encodeURIComponent(report.weekKey)}`) }} template={selectedTemplate} /> : <OverviewScreen selectedWeek={selectedWeek} template={selectedTemplate} userName={accountState.status === 'authenticated' ? accountState.user.displayName || accountState.user.email || '' : ''} onNavigate={(screen) => { navigateTo(`/${screen === 'overview' ? '' : screen}`) }} />}
      </div>
    </div>
  )
}

export default App
