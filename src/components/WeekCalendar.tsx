import { useEffect, useMemo, useRef, useState } from 'react'
import type { DailyActivity } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import { WEEK_DAY_LABELS } from '../utils/week'
import { AppIcon } from './TemplateIcon'
import './WeekCalendar.css'

type WeekCalendarProps = {
  selectedWeek: string
  activities: DailyActivity[]
  followUps: FollowUp[]
}

function toDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`)
}

function toDateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function startOfWeek(date: Date) {
  const result = new Date(date)
  const day = result.getDay()
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1))
  return result
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12)
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12)
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}

function formatAccessibleDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

function buildMonthDays(month: Date) {
  const firstDay = startOfMonth(month)
  const gridStart = startOfWeek(firstDay)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return date
  })
}

export default function WeekCalendar({ selectedWeek, activities, followUps }: WeekCalendarProps) {
  const selectedWeekDate = toDate(selectedWeek)
  const [isMounted, setIsMounted] = useState(false)
  const previousWeekRef = useRef<string | null>(null)
  const hasInitialized = useRef(false)
  const [monthSelection, setMonthSelection] = useState<{ weekKey: string; month: Date }>(() => ({ weekKey: selectedWeek, month: startOfMonth(selectedWeekDate) }))
  const [monthTransition, setMonthTransition] = useState<{ direction: 'next' | 'previous'; id: number; isAnimating: boolean }>({ direction: 'next', id: 0, isAnimating: false })
  const [dateSelection, setDateSelection] = useState<{ weekKey: string; dateKey: string }>(() => ({ weekKey: selectedWeek, dateKey: selectedWeek }))
  const [dateSelectionVersion, setDateSelectionVersion] = useState(0)
  const visibleMonth = monthSelection.weekKey === selectedWeek ? monthSelection.month : startOfMonth(selectedWeekDate)
  useEffect(() => {
    const previousWeek = previousWeekRef.current
    const isActualWeekChange = previousWeek !== null && previousWeek !== selectedWeek

    previousWeekRef.current = selectedWeek

    if (!hasInitialized.current) {
      hasInitialized.current = true
      setIsMounted(false)
      const frame = window.requestAnimationFrame(() => {
        setIsMounted(true)
      })
      return () => window.cancelAnimationFrame(frame)
    }

    if (!isActualWeekChange) {
      setIsMounted(true)
      return
    }

    setIsMounted(false)
    const frame = window.requestAnimationFrame(() => {
      setIsMounted(true)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedWeek])
  const selectedDate = dateSelection.weekKey === selectedWeek ? dateSelection.dateKey : selectedWeek
  const days = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth])
  const activityDates = useMemo(() => new Set(activities.map((activity) => activity.date)), [activities])
  const followUpDates = useMemo(() => new Set(followUps.flatMap((followUp) => followUp.dueDate ? [followUp.dueDate] : [])), [followUps])
  const [focusedDateKey, setFocusedDateKey] = useState(selectedWeek)
  const todayKey = toDateKey(new Date())
  const focusedDate = toDate(focusedDateKey)
  const focusedActivities = activities.filter((activity) => activity.date === focusedDateKey)

  function selectDate(dateKey: string) {
    setFocusedDateKey(dateKey)
    setDateSelection({ weekKey: selectedWeek, dateKey })
    setDateSelectionVersion((current) => current + 1)
  }

  function selectMonth(amount: number) {
    const direction = amount > 0 ? 'next' : 'previous'
    setMonthTransition((current) => ({ direction, id: current.id + 1, isAnimating: true }))
    setMonthSelection({ weekKey: selectedWeek, month: shiftMonth(visibleMonth, amount) })
  }

  return (
    <section className={`week-calendar${isMounted ? ' is-visible' : ''}`} aria-labelledby="week-calendar-heading">
      <div className="week-calendar-header">
        <div>
          <p className="eyebrow">Week at a glance</p>
          <h2 id="week-calendar-heading" className={`week-calendar-month-heading is-${monthTransition.direction}`} key={monthTransition.id}>{formatMonth(visibleMonth)}</h2>
        </div>
        <div className="week-calendar-controls" aria-label="Calendar month navigation">
          <button className="week-calendar-nav" type="button" onClick={() => selectMonth(-1)} aria-label="Previous month" title="Previous month"><AppIcon name="chevron-left" /></button>
          <button className="week-calendar-nav" type="button" onClick={() => selectMonth(1)} aria-label="Next month" title="Next month"><AppIcon name="chevron-right" /></button>
          <button className="week-calendar-today" type="button" onClick={() => { setMonthTransition((current) => ({ direction: new Date().getMonth() >= visibleMonth.getMonth() && new Date().getFullYear() >= visibleMonth.getFullYear() ? 'next' : 'previous', id: current.id + 1, isAnimating: true })); setMonthSelection({ weekKey: selectedWeek, month: startOfMonth(new Date()) }) }}>Today</button>
        </div>
      </div>
      <div className={`week-calendar-month-content is-${monthTransition.direction}${monthTransition.isAnimating ? ' is-animating' : ''}`} key={monthTransition.id} onAnimationEnd={() => setMonthTransition((current) => ({ ...current, isAnimating: false }))}>
        <div className="week-calendar-weekdays" aria-hidden="true">{WEEK_DAY_LABELS.map((label) => <span key={label}>{label.slice(0, 3)}</span>)}</div>
        <div className="week-calendar-grid" role="grid" aria-label={`${formatMonth(visibleMonth)} calendar`}>
        {days.map((date) => {
          const dateKey = toDateKey(date)
          const isCurrentMonth = date.getMonth() === visibleMonth.getMonth()
          const isSelectedWeek = toDateKey(startOfWeek(date)) === selectedWeek
          const isSelectedDate = dateKey === selectedDate
          const isToday = dateKey === todayKey
          const hasActivity = activityDates.has(dateKey)
          const hasFollowUp = followUpDates.has(dateKey)
          const hasCompletedFollowUp = followUps.some((followUp) => followUp.dueDate === dateKey && followUp.status === 'completed')
          return <button
            className={`week-calendar-day${isCurrentMonth ? '' : ' is-outside-month'}${isSelectedWeek ? ' is-selected-week' : ''}${isSelectedDate ? ' is-selected-date' : ''}${isToday ? ' is-today' : ''}`}
            type="button"
            role="gridcell"
            key={`${dateKey}-${isSelectedDate ? dateSelectionVersion : 'stable'}`}
            onClick={() => selectDate(dateKey)}
            aria-label={`${formatAccessibleDate(date)}${isSelectedWeek ? ', selected WeekFlow week' : ''}${isToday ? ', today' : ''}${hasActivity ? ', has activity' : ', no activity recorded'}${hasFollowUp ? ', has follow-up' : ', no follow-ups'}${hasCompletedFollowUp ? ', completed follow-up' : ''}`}
            aria-pressed={isSelectedDate}
          >
            <span className="week-calendar-date-number">{date.getDate()}</span>
            <span className="week-calendar-markers" aria-hidden="true">
              {hasActivity && <i className="week-calendar-marker is-activity" />}
              {hasFollowUp && <i className="week-calendar-marker is-follow-up" />}
              {hasCompletedFollowUp && <i className="week-calendar-marker is-completed" />}
            </span>
          </button>
        })}
        </div>
      </div>
      <div className="week-calendar-legend" aria-label="Calendar status legend">
        <span><i className="week-calendar-legend-dot is-week" />Selected week</span>
        <span><i className="week-calendar-legend-dot is-activity" />Activity</span>
        <span><i className="week-calendar-legend-dot is-follow-up" />Follow-up</span>
        <span><i className="week-calendar-legend-dot is-completed" />Completed</span>
        <span><i className="week-calendar-legend-dot is-today" />Today</span>
      </div>
      <aside className="week-calendar-detail" aria-live="polite" aria-labelledby="week-calendar-detail-heading">
        <div className="week-calendar-detail-heading"><div><p className="eyebrow">Selected date</p><h3 id="week-calendar-detail-heading">{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(focusedDate)}</h3></div></div>
        <p className="week-calendar-detail-summary">{focusedActivities.length > 0 ? 'Activity recorded.' : 'No activity recorded.'}</p>
      </aside>
    </section>
  )
}