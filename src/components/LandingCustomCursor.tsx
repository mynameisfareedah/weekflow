import { useEffect, useRef } from 'react'

const interactiveSelector = [
  'a[href]',
  'button:not(:disabled)',
  '[role="button"]',
  '[role="link"]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[data-interactive="true"]',
].join(', ')

export default function LandingCustomCursor() {
  const ringRef = useRef<HTMLDivElement | null>(null)
  const dotRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const xRef = useRef(0)
  const yRef = useRef(0)
  const targetXRef = useRef(0)
  const targetYRef = useRef(0)

  useEffect(() => {
    const landingPage = document.querySelector<HTMLElement>('.landing-page')
    const ring = ringRef.current
    const dot = dotRef.current

    if (!landingPage || !ring || !dot) return

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointerCoarseQuery = window.matchMedia('(pointer: coarse)')
    const hoverNoneQuery = window.matchMedia('(hover: none)')

    const shouldDisableCursor = reducedMotionQuery.matches || pointerCoarseQuery.matches || hoverNoneQuery.matches

    if (shouldDisableCursor) {
      landingPage.style.cursor = 'auto'
      ring.style.display = 'none'
      dot.style.display = 'none'
      return
    }

    const setInteractiveState = (isInteractive: boolean) => {
      ring.classList.toggle('is-interactive', isInteractive)
      dot.classList.toggle('is-interactive', isInteractive)
    }

    const handlePointerMove = (event: PointerEvent) => {
      targetXRef.current = event.clientX
      targetYRef.current = event.clientY
      ring.style.opacity = '1'
      dot.style.opacity = '1'

      const target = event.target as HTMLElement | null
      const isInteractive = !!target?.closest(interactiveSelector)
      setInteractiveState(isInteractive)
    }

    const handlePointerLeave = () => {
      setInteractiveState(false)
      ring.style.opacity = '0'
      dot.style.opacity = '0'
    }

    const handlePointerEnter = () => {
      ring.style.opacity = '1'
      dot.style.opacity = '1'
    }

    const updateLoop = () => {
      const dx = targetXRef.current - xRef.current
      const dy = targetYRef.current - yRef.current

      xRef.current += dx * 0.18
      yRef.current += dy * 0.18

      ring.style.transform = `translate(${xRef.current}px, ${yRef.current}px) translate3d(-50%, -50%, 0)`
      dot.style.transform = `translate(${xRef.current}px, ${yRef.current}px) translate3d(-50%, -50%, 0)`

      frameRef.current = window.requestAnimationFrame(updateLoop)
    }

    landingPage.style.cursor = 'none'
    targetXRef.current = window.innerWidth / 2
    targetYRef.current = window.innerHeight / 2
    xRef.current = targetXRef.current
    yRef.current = targetYRef.current

    ring.style.opacity = '0'
    dot.style.opacity = '0'
    ring.style.transform = `translate(${xRef.current}px, ${yRef.current}px) translate3d(-50%, -50%, 0)`
    dot.style.transform = `translate(${xRef.current}px, ${yRef.current}px) translate3d(-50%, -50%, 0)`

    landingPage.addEventListener('pointermove', handlePointerMove)
    landingPage.addEventListener('pointerleave', handlePointerLeave)
    landingPage.addEventListener('pointerenter', handlePointerEnter)

    frameRef.current = window.requestAnimationFrame(updateLoop)

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current)
      }
      landingPage.removeEventListener('pointermove', handlePointerMove)
      landingPage.removeEventListener('pointerleave', handlePointerLeave)
      landingPage.removeEventListener('pointerenter', handlePointerEnter)
      landingPage.style.cursor = ''
    }
  }, [])

  return (
    <div className="landing-custom-cursor" aria-hidden="true">
      <div ref={ringRef} className="landing-cursor-ring" />
      <div ref={dotRef} className="landing-cursor-dot" />
    </div>
  )
}
