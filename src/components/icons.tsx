import { useId, type ComponentProps } from 'react'

type IconProps = ComponentProps<'svg'>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
)

export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </Icon>
)

export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Icon>
)

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </Icon>
)

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </Icon>
)

export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21V9M7 14l5-5 5 5M5 3h14" />
  </Icon>
)

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Icon>
)

export const FriendsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
)

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
)

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
)

export const SwapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
  </Icon>
)

export const TimerIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2 2M9 2h6" />
  </Icon>
)

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4v16l13-8Z" fill="currentColor" />
  </Icon>
)

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor" />
  </Icon>
)

export const ResetIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
)

export const SoundIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 5 6 9H3v6h3l5 4Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
  </Icon>
)

export const MuteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 5 6 9H3v6h3l5 4Z" />
    <path d="m16 9 6 6M22 9l-6 6" />
  </Icon>
)

export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 20v-5M12 20V10M18 20V4" />
  </Icon>
)

export const FlagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Icon>
)

/**
 * Glossy 8-ball, same artwork as public/favicon.svg.
 * `tile` adds the felt app-icon background (header logo); without it you get just the ball.
 */
export function EightBall({ tile = false, ...props }: IconProps & { tile?: boolean }) {
  // Gradient ids must be unique per instance; useId can contain characters url(#…) dislikes.
  const id = useId().replace(/[^\w-]/g, '')
  const u = (name: string) => `url(#${name}-${id})`
  return (
    <svg
      viewBox={tile ? '0 0 64 64' : '9 8 46 50'}
      width="32"
      height="32"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <radialGradient id={`felt-${id}`} cx="50%" cy="36%" r="72%">
          <stop offset="0" stopColor="#23a06a" />
          <stop offset="0.45" stopColor="#11583c" />
          <stop offset="0.85" stopColor="#0b2219" />
        </radialGradient>
        <radialGradient id={`ball-${id}`} cx="36%" cy="30%" r="75%">
          <stop offset="0" stopColor="#6b7178" />
          <stop offset="0.22" stopColor="#2a2d31" />
          <stop offset="0.7" stopColor="#0b0c0e" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <linearGradient id={`rim-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="#4be3a0" stopOpacity="0" />
          <stop offset="1" stopColor="#4be3a0" stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id={`spot-${id}`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.6" stopColor="#f3eee1" />
          <stop offset="1" stopColor="#bdb5a2" />
        </radialGradient>
        <radialGradient id={`spec-${id}`}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`shadow-${id}`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.6" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      {tile && <rect width="64" height="64" rx="15" fill={u('felt')} />}
      <ellipse cx="33" cy="54.5" rx="18" ry="4.5" fill={u('shadow')} />
      <circle cx="32" cy="31" r="21" fill={u('ball')} />
      <circle cx="32" cy="31" r="20.2" fill="none" stroke={u('rim')} strokeWidth="1.6" />
      <g transform="rotate(-18 28 26)">
        <ellipse cx="28" cy="26" rx="9" ry="8.2" fill={u('spot')} />
        <g fill="none" stroke="#141414" strokeWidth="2">
          <circle cx="28" cy="22.9" r="2.3" />
          <circle cx="28" cy="28.3" r="2.9" />
        </g>
      </g>
      <ellipse cx="21.5" cy="17" rx="7" ry="3.6" transform="rotate(-35 21.5 17)" fill={u('spec')} />
    </svg>
  )
}
