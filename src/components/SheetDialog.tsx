import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Slide from '@mui/material/Slide'
import type { TransitionProps } from '@mui/material/transitions'
import useMediaQuery from '@mui/material/useMediaQuery'
import { forwardRef, useId, type ReactElement, type ReactNode, type Ref } from 'react'
import { CloseIcon } from './icons'

const SlideUp = forwardRef(function SlideUp(
  props: TransitionProps & { children: ReactElement },
  ref: Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />
})

/** Dialog with a title and close button; on phones it slides up from the bottom like a sheet. */
export function SheetDialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}) {
  const sheet = useMediaQuery('(max-width: 559.95px)')
  const titleId = useId()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      aria-labelledby={titleId}
      slots={sheet ? { transition: SlideUp } : undefined}
      sx={sheet ? { '& .MuiDialog-container': { alignItems: 'flex-end' } } : undefined}
      slotProps={{
        paper: {
          sx: sheet
            ? {
                m: 0,
                width: '100%',
                maxWidth: 'none',
                maxHeight: '100dvh',
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                p: '20px 16px calc(16px + env(safe-area-inset-bottom))',
              }
            : { maxWidth: 480, p: 3 },
        },
      }}
    >
      <header className="dialog-header">
        <div>
          <DialogTitle id={titleId} sx={{ p: 0 }}>
            {title}
          </DialogTitle>
          {description && <p className="dialog-description">{description}</p>}
        </div>
        <IconButton aria-label="Tutup" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </header>
      {children}
    </Dialog>
  )
}
