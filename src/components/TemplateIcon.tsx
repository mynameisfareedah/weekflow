import type { SVGProps } from 'react'

type TemplateIconProps = SVGProps<SVGSVGElement> & {
  templateId: string
}

export type AppIconName = 'overview' | 'weekly-plan' | 'daily-activity' | 'follow-ups' | 'report' | 'report-history' | 'workflow' | 'workspaces' | 'menu' | 'close' | 'collapse' | 'expand' | 'chevron-left' | 'chevron-right' | 'arrow-right' | 'arrow-down' | 'check' | 'dot'

const ICON_PATHS: Record<string, string> = {
  'field-sales': 'M3 7.5h18M5 7.5V20h14V7.5M8 7.5V4h8v3.5M8 12h8M8 16h5',
  'field-service': 'm14.7 6.3 3-3a5 5 0 0 0 1.1 6.7l-8.4 8.4a2.1 2.1 0 1 1-3-3l8.4-8.4a5 5 0 0 0 6.7 1.1l-3 3',
  'project-management': 'M6 3.5h12v17H6zM9 7h6M9 11h6M9 15h4',
  'small-business': 'M4 10h16v10H4zM3 10l2-5h14l2 5M8 14h8',
  'ngo-community': 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5M3 20a5 5 0 0 1 10 0M14 20a4 4 0 0 1 7 0',
  education: 'M3 9 12 4l9 5-9 5-9-5Zm4 3.5v4c3 2.5 7 2.5 10 0v-4M21 10v5',
  personal: 'M12 3.5 14.6 9l5.9.7-4.3 4 1.1 5.8-5.3-2.8-5.3 2.8 1.1-5.8-4.3-4L9.4 9 12 3.5Z',
  custom: 'm12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3ZM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z',
}

export default function TemplateIcon({ templateId, ...props }: TemplateIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={ICON_PATHS[templateId] ?? ICON_PATHS.custom} />
    </svg>
  )
}

const APP_ICON_PATHS: Record<AppIconName, string> = {
  overview: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  'weekly-plan': 'M5 4h14v16H5zM8 2v4M16 2v4M8 10h8M8 14h5',
  'daily-activity': 'M6 3h9l3 3v15H6zM14 3v4h4M9 12h6M9 16h6',
  'follow-ups': 'M4 6h16M4 12h10M4 18h8M18 15v6M15 18h6',
  report: 'M5 3h10l4 4v14H5zM15 3v5h5M8 12h8M8 16h6',
  'report-history': 'M12 4a8 8 0 1 0 7.5 5.2M12 7v5l3 2M17 4h3v3',
  workflow: 'M5 5h14v14H5zM8 9h8M8 13h8M8 17h5',
  workspaces: 'M4 7h6v6H4zM14 7h6v6h-6zM9 17h6v3H9zM7 13v2h10v-2',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'm6 6 12 12M18 6 6 18',
  collapse: 'm8 4 8 8-8 8',
  expand: 'm16 4-8 8 8 8',
  'chevron-left': 'm15 5-7 7 7 7',
  'chevron-right': 'm9 5 7 7-7 7',
  'arrow-right': 'M4 12h15M13 6l6 6-6 6',
  'arrow-down': 'M12 4v15M6 13l6 6 6-6',
  check: 'm5 12 4 4L19 6',
  dot: 'M12 12h.01',
}

export function AppIcon({ name, ...props }: { name: AppIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={APP_ICON_PATHS[name]} />
    </svg>
  )
}
