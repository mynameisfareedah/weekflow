import { useState, type FormEvent } from 'react'
import { supabase } from './lib/supabase'
import LandingShootingStars from './LandingShootingStars'
import { navigateTo } from './utils/navigation'
import { notifySubmission } from './utils/notifySubmission'
import logoImage from './assets/weekflow-logo.png'
import './support.css'

const supportCategories = [
  'Getting started',
  'Weekly Plan',
  'Daily Activity',
  'Follow-ups',
  'Reports',
  'Templates',
  'Workspace',
  'Technical issue',
  'Feedback / suggestion',
  'Other',
] as const

const supportCards = [
  {
    title: 'Getting Started',
    description: 'Start your first week in minutes.',
    body: 'Choose a workspace and template, select your reporting week, then build your plan around the work you intend to complete. As the week progresses, record what actually happened in Daily Activity, add unresolved actions to Follow-ups, and review the finished week in Generate Report.',
    cta: 'Learn the workflow →',
    href: '/guides/getting-started',
  },
  {
    title: 'Templates',
    description: 'Choose the workflow that matches your work.',
    body: 'WeekFlow provides purpose-built templates for Pharma Field Sales, Field Operations, Project Management, Small Business, NGO & Community Work, Education, Personal Productivity, and Custom workflows. Each template adapts the planning, activity, follow-up, and reporting experience to that type of work. You can work within the template that fits your current workflow rather than forcing every type of work into the same structure.',
    cta: 'Explore templates →',
    href: '/templates',
  },
  {
    title: 'Guides',
    description: 'Learn how to get more from each part of WeekFlow.',
    body: 'Use the guides to understand how to plan a week, capture actual activities, create and manage follow-ups, use Smart Start, review previous weeks, compare reports where supported, and export your completed report. Each guide should focus on a specific task and explain what to do, where to do it, and what happens after you complete it.',
    cta: 'View guides →',
    href: '/guides',
  },
] as const

const faqs = [
  {
    question: 'What is WeekFlow?',
    answer: [
      'WeekFlow is a weekly execution and reporting tool that connects your planned work with what you actually do.',
      'The core workflow is:',
      'Plan → Activity → Follow-up → Review → Report',
      'You start with your weekly plan, capture actual activities during the week, record unresolved actions as follow-ups, review the week’s progress, and generate a report from the information already captured.',
    ],
  },
  {
    question: 'How does the WeekFlow workflow work?',
    answer: [
      'Weekly Plan is where you record what you intend to accomplish.',
      'Daily Activity is where you record what actually happened. This keeps planned work separate from completed work.',
      'Follow-ups capture unresolved actions that still need attention.',
      'Generate Report brings those records together into a structured weekly report.',
      'Report History allows you to return to previously saved reports rather than rebuilding them from scratch.',
    ],
  },
  {
    question: 'Can I use different templates?',
    answer: [
      'Yes. WeekFlow supports multiple templates for different types of work.',
      'Current templates include:',
      '• Pharma Field Sales',
      '• Field Operations',
      '• Project Management',
      '• Small Business',
      '• NGO & Community Work',
      '• Education',
      '• Personal Productivity',
      '• Custom',
      'The template determines the terminology, planning structure, activity fields, reporting sections, and other workflow details relevant to that type of work.',
    ],
  },
  {
    question: 'Can I change my template?',
    answer: [
      'Yes. You can change your workspace template from Workspace Settings.',
      'Templates are designed for different types of work, so changing the template can change the terminology, fields, planning structure, and report sections available in that workspace.',
      'Your existing records are not rewritten simply because you change the template. Previous weeks and their captured work remain part of your workspace history.',
      'If you are moving to a completely different type of work, you can also create a separate workspace and choose the template that fits it.',
    ],
  },
  {
    question: 'How does Smart Start work?',
    answer: [
      'Smart Start helps you begin a new week using relevant unfinished work from the previous week.',
      'It can carry forward explicitly selected unfinished or relevant objectives, open follow-ups, account objectives, and commercial priorities where the template supports them.',
      'It does not simply copy the entire previous week.',
      'Completed activities, completed follow-ups, old daily schedules, and previous reports are not treated as new work automatically.',
      'The new week receives its own records so historical weeks remain intact.',
    ],
  },
  {
    question: 'Can I access previous weeks and reports?',
    answer: [
      'Yes.',
      'WeekFlow keeps work organised by workspace and reporting week, allowing you to return to previous weeks and saved reports.',
      'A historical report is based on the report snapshot saved for that week. It does not silently change when you later modify the current week’s activities.',
      'This means a saved historical report remains a record of what was reported for that particular week.',
    ],
  },
  {
    question: 'Can I export reports?',
    answer: [
      'Yes.',
      'WeekFlow supports report export from the generated report output.',
      'The export uses the same report data shown in the Generate Report view rather than creating a separate reporting data architecture.',
      'Where supported by the current application, reports can be exported as Word documents and PDF files.',
      'The exported report includes the sections and information defined by the selected template.',
    ],
  },
  {
    question: 'Can I create a custom workflow?',
    answer: [
      'Yes.',
      'The Custom template allows you to define a workflow around your own type of work.',
      'You can configure the categories and fields needed for your workflow while still using WeekFlow’s core structure:',
      'Plan → Activity → Follow-up → Review → Report',
      'Custom workflows can therefore use WeekFlow’s reporting and follow-up capabilities without requiring you to fit your work into one of the predefined templates.',
    ],
  },
] as const

export default function SupportScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setErrorMessage('')
    setStatus('idle')
    const normalizedEmail = email.trim()
    if (!name.trim() || !normalizedEmail || !category || !message.trim()) {
      setErrorMessage('Complete all fields to send your message.')
      setStatus('error')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage('Enter a valid email address.')
      setStatus('error')
      return
    }
    if (!supabase) {
      setErrorMessage('Support messages are not configured yet. Please try again later.')
      setStatus('error')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.from('support_requests').insert({
      name: name.trim(),
      email: normalizedEmail,
      category,
      message: message.trim(),
      source: 'support',
      status: 'open',
    })
    if (error) {
      setIsSubmitting(false)
      setErrorMessage('Something went wrong. Please try again.')
      setStatus('error')
      return
    }
    const notificationSent = await notifySubmission(supabase, {
      name: name.trim(),
      email: normalizedEmail,
      category,
      message: message.trim(),
      source: 'support',
    })
    setIsSubmitting(false)
    if (!notificationSent) {
      setErrorMessage("Your message was saved, but we couldn't send the email notification. Please try again later.")
      setStatus('error')
      return
    }
    setStatus('success')
  }

  return <main className="support-page"><LandingShootingStars />
    <div className="support-page-shell">
      <nav className="support-nav"><a className="support-brand" href="/" aria-label="WeekFlow home"><img className="support-brand-mark" src={logoImage} alt="" /><span>WeekFlow</span></a><a className="support-back-link" href="/">Back to WeekFlow</a></nav>
      <header className="support-header"><p className="support-eyebrow">Support</p><h1>Get support or share your feedback</h1><p>Have a question, need help with WeekFlow, or want to share your thoughts? We'd love to hear from you.</p></header>
      <section className="support-form-section" aria-labelledby="support-form-title">
        {status === 'success' ? <div className="support-success" role="status"><p className="support-eyebrow">Message sent</p><h2>Thanks for contacting WeekFlow.</h2><p>We've received your message and will get back to you.</p><button className="support-button" type="button" onClick={() => { setStatus('idle'); setName(''); setEmail(''); setCategory(''); setMessage('') }}>Send another message</button></div> : <form className="support-form" onSubmit={submit} noValidate><h2 id="support-form-title">Send us a message</h2><div className="support-form-grid"><label><span>Name</span><input placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} required /></label><label><span>Email</span><input type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label></div><label><span>What can we help with?</span><select value={category} onChange={(event) => setCategory(event.target.value)} required><option value="">Choose a topic</option>{supportCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Message</span><textarea placeholder="Tell us how we can help..." value={message} onChange={(event) => setMessage(event.target.value)} required /></label>{status === 'error' && <p className="support-error" role="alert">{errorMessage}</p>}<button className="support-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send Message'}</button></form>}
      </section>
      <section className="support-guides" aria-labelledby="support-guides-title"><div className="support-section-heading"><p className="support-eyebrow">Self-serve</p><h2 id="support-guides-title">Before contacting support</h2></div><div className="support-guide-grid">{supportCards.map(({ title, description, body, cta, href }) => <article key={title}><h3>{title}</h3><p className="support-card-description">{description}</p><p className="support-card-body">{body}</p><a className="support-card-link" href={href} onClick={(event) => { if (href.startsWith('/')) { event.preventDefault(); navigateTo(href) } }}>{cta}</a></article>)}</div></section>
      <section className="support-faq" aria-labelledby="support-faq-title"><div className="support-section-heading"><p className="support-eyebrow">Answers</p><h2 id="support-faq-title">Frequently asked questions</h2></div><div className="support-faq-list">{faqs.map(({ question, answer }) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary>{answer.map((paragraph, index) => typeof paragraph === 'string' && paragraph.startsWith('•') ? <ul key={`${question}-${index}`} className="support-faq-list-bullets"><li>{paragraph.replace(/^•\s*/, '')}</li></ul> : <p key={`${question}-${index}`}>{paragraph}</p>)}</details>)}</div></section>
      <footer className="support-footer"><span>(c) {new Date().getFullYear()} WeekFlow</span><a href="/">WeekFlow home</a></footer>
    </div>
  </main>
}
