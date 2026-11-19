import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { useId, useState, type ReactNode } from 'react'
import { MoreIcon } from './icons'

export type MoreMenuItem = {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

/** "⋯" button that opens a small action menu. */
export function MoreMenu({
  label,
  items,
  header,
  className,
}: {
  label: string
  items: MoreMenuItem[]
  /** Small text above the items, e.g. who is logged in. */
  header?: ReactNode
  className?: string
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const id = useId()
  const open = !!anchor

  return (
    <>
      <IconButton
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-controls={open ? id : undefined}
        aria-expanded={open || undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={open ? { bgcolor: 'var(--surface-hover)', color: 'text.primary' } : undefined}
      >
        <MoreIcon />
      </IconButton>
      <Menu
        id={id}
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 180, mt: 0.75 } } }}
      >
        {header && (
          <li className="more-menu__header" role="presentation">
            {header}
          </li>
        )}
        {items.map((item) => (
          <MenuItem
            key={item.label}
            disabled={item.disabled}
            onClick={() => {
              setAnchor(null)
              item.onClick()
            }}
            sx={item.danger ? { color: 'error.main' } : undefined}
          >
            <ListItemIcon sx={{ color: item.danger ? 'inherit' : 'text.secondary' }}>
              {item.icon}
            </ListItemIcon>
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
