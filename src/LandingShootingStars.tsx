import type { CSSProperties } from 'react'

const landingShootingStars = [
  { top: '5%', left: '7%', length: '82px', angle: '25deg', duration: '10s', delay: '-1.4s', opacity: '.48' },
  { top: '14%', left: '72%', length: '64px', angle: '145deg', duration: '13s', delay: '-5.8s', opacity: '.38' },
  { top: '24%', left: '28%', length: '74px', angle: '32deg', duration: '11s', delay: '-3.2s', opacity: '.42' },
  { top: '34%', left: '84%', length: '92px', angle: '154deg', duration: '15s', delay: '-10.6s', opacity: '.36' },
  { top: '44%', left: '12%', length: '58px', angle: '28deg', duration: '12s', delay: '-7.1s', opacity: '.4' },
  { top: '54%', left: '65%', length: '78px', angle: '148deg', duration: '14s', delay: '-11.2s', opacity: '.36' },
  { top: '64%', left: '38%', length: '68px', angle: '24deg', duration: '11s', delay: '-4.5s', opacity: '.36' },
  { top: '74%', left: '91%', length: '52px', angle: '156deg', duration: '16s', delay: '-13.8s', opacity: '.32' },
  { top: '84%', left: '48%', length: '60px', angle: '38deg', duration: '10s', delay: '-6.4s', opacity: '.34' },
  { top: '94%', left: '56%', length: '70px', angle: '141deg', duration: '12s', delay: '-2.7s', opacity: '.36' },
  { top: '18%', left: '42%', length: '48px', angle: '21deg', duration: '9s', delay: '-4s', opacity: '.3' },
  { top: '68%', left: '78%', length: '56px', angle: '151deg', duration: '10s', delay: '-8.6s', opacity: '.32' },
] as const

export default function LandingShootingStars() {
  return <div className="landing-shooting-stars" aria-hidden="true">{landingShootingStars.map((star, index) => <i key={index} style={{ '--star-top': star.top, '--star-left': star.left, '--star-length': star.length, '--star-angle': star.angle, '--star-duration': star.duration, '--star-delay': star.delay, '--star-opacity': star.opacity } as CSSProperties} />)}</div>
}
