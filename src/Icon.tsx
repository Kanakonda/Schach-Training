const PATHS = {
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M19 12H5M11 6l-6 6 6 6',
  down: 'M6 9l6 6 6-6',
  right: 'M9 6l6 6-6 6',
  first: 'M18 6l-6 6 6 6M7 6v12',
  prev: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  last: 'M6 6l6 6-6 6M17 6v12',
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M8.5 5v14M15.5 5v14',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z',
  hint: 'M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.8 10.6c.8.7 1.3 1.5 1.3 2.4h5c0-.9.5-1.7 1.3-2.4A6 6 0 0 0 12 3z',
  book: 'M5 4h13a1 1 0 0 1 1 1v15H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M9 8h6',
  bookmark: 'M7 3h10a1 1 0 0 1 1 1v17l-6-4.5L6 21V4a1 1 0 0 1 1-1z',
  repeat: 'M4 11a8 8 0 0 1 13.7-4.6L20 9M20 4v5h-5M20 13a8 8 0 0 1-13.7 4.6L4 15M4 20v-5h5',
  engine: 'M3 12h4l3-8 4 16 3-8h4',
  stats: 'M5 20v-9M12 20V4M19 20v-6',
  flip: 'M8 4v16M8 20l-3.5-3.5M8 20l3.5-3.5M16 20V4M16 4l-3.5 3.5M16 4l3.5 3.5',
  trash: 'M4 7h16M9.5 7V4h5v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.9-4.9',
  check: 'M5 12.5l4.5 4.5L19 7',
  plus: 'M12 5v14M5 12h14',
  undo: 'M9 5L4 10l5 5M4 10h10a5.5 5.5 0 0 1 0 11h-3',
} as const

export type IconName = keyof typeof PATHS

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="ico"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === 'play' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={name === 'play' ? 1 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
