import { useState, type FormEvent } from 'react'
import { supabase } from './lib/supabase'
import LandingShootingStars from './LandingShootingStars'
import { navigateTo } from './utils/navigation'
import { notifySubmission } from './utils/notifySubmission'
import logoImage from './assets/weekflow-logo.png'
import './support.css'

const contactReasons = [
  'General enquiry',
  'Product feedback',
  'Partnership',
  'Business enquiry',
  'Sales enquiry',
  'Technical issue',
  'Other',
] as const

export default function ContactScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setErrorMessage('')
    setStatus('idle')
    const normalizedName = name.trim()
    const normalizedEmail = email.trim()
    const normalizedMessage = message.trim()
    if (!normalizedName || !normalizedEmail || !reason || !normalizedMessage) {
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
      setErrorMessage("We couldn't send your message right now. Please try again.")
      setStatus('error')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.from('support_requests').insert({
      name: normalizedName,
      email: normalizedEmail,
      category: reason,
      message: normalizedMessage,
      source: 'contact',
      status: 'open',
    })
    if (error) {
      setIsSubmitting(false)
      setErrorMessage("We couldn't send your message right now. Please try again.")
      setStatus('error')
      return
    }
    const notificationSent = await notifySubmission(supabase, {
      name: normalizedName,
      email: normalizedEmail,
      category: reason,
      message: normalizedMessage,
      source: 'contact',
    })
    setIsSubmitting(false)
    if (!notificationSent) {
      setErrorMessage("Your message was saved, but we couldn't send the email notification. Please try again later.")
      setStatus('error')
      return
    }
    setStatus('success')
  }

  return <main className="support-page contact-page"><LandingShootingStars />
    <div className="support-page-shell contact-page-shell">
      <nav className="support-nav"><a className="support-brand" href="/" aria-label="WeekFlow home" onClick={(event) => { event.preventDefault(); navigateTo('/') }}><img className="support-brand-mark" src={logoImage} alt="" /><span>WeekFlow</span></a><div className="contact-nav-links"><a className="support-back-link" href="/support" onClick={(event) => { event.preventDefault(); navigateTo('/support') }}>Support</a><a className="support-back-link contact-nav-current" href="/contact" aria-current="page">Contact</a></div></nav>
      <header className="support-header contact-header"><p className="support-eyebrow">Contact</p><h1>Get in touch with WeekFlow</h1><p>Have a question, want to share feedback, or interested in working with us? We'd love to hear from you.</p></header>
      <section className="support-form-section contact-form-section" aria-labelledby="contact-form-title">
        {status === 'success' ? <div className="support-success" role="status"><p className="support-eyebrow">Message sent</p><h2>Thanks for getting in touch.</h2><p>We've received your message and will get back to you as soon as possible.</p><button className="support-button" type="button" onClick={() => { setStatus('idle'); setName(''); setEmail(''); setReason(''); setMessage('') }}>Send another message</button></div> : <form className="support-form" onSubmit={submit} noValidate><h2 id="contact-form-title">Send us a message</h2><div className="support-form-grid"><label><span>Name</span><input placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label><label><span>Email</span><input type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label></div><label><span>Reason for contacting us</span><select value={reason} onChange={(event) => setReason(event.target.value)} required><option value="">Choose a reason</option>{contactReasons.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Message</span><textarea placeholder="How can we help?" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} required /></label>{status === 'error' && <p className="support-error" role="alert">{errorMessage}</p>}<button className="support-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send Message'}</button></form>}
      </section>
      <section className="contact-email-prompt" aria-labelledby="contact-email-title"><p id="contact-email-title">Prefer email?</p><a href="mailto:bezanirsolutions@gmail.com">bezanirsolutions@gmail.com</a></section>
      <section className="contact-support-prompt" aria-labelledby="contact-support-title"><p className="support-eyebrow">Need help?</p><h2 id="contact-support-title">Looking for help using WeekFlow?</h2><p>Visit the Support Centre for guides, FAQs, and answers to common questions.</p><a className="support-card-link" href="/support" onClick={(event) => { event.preventDefault(); navigateTo('/support') }}>Visit Support →</a></section>
      <footer className="support-footer"><span>(c) {new Date().getFullYear()} WeekFlow</span><div className="contact-footer-links"><a href="/support" onClick={(event) => { event.preventDefault(); navigateTo('/support') }}>Support</a><a href="/guides" onClick={(event) => { event.preventDefault(); navigateTo('/guides') }}>Guides</a><a href="/contact" aria-current="page">Contact</a></div></footer>
    </div>
  </main>
}
