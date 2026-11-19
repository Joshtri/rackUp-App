import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Portal from '@mui/material/Portal'
import Snackbar, { type SnackbarCloseReason } from '@mui/material/Snackbar'
import { useMemo, useReducer, useRef, type ReactNode } from 'react'
import { ToastContext, type ToastOptions } from '../lib/toast'
import { CloseIcon } from './icons'

type ToastItem = ToastOptions & { id: number }

type State = { current: ToastItem | null; open: boolean; queue: ToastItem[] }

type Action =
  | { type: 'add'; toast: ToastItem }
  | { type: 'close'; id?: number }
  | { type: 'exited' }

// One Snackbar at a time: a new toast closes the current one, then shows after it exits.
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add':
      return state.current
        ? { ...state, open: false, queue: [...state.queue, action.toast] }
        : { ...state, current: action.toast, open: true }
    case 'close':
      if (action.id === undefined || action.id === state.current?.id)
        return { ...state, open: false }
      return { ...state, queue: state.queue.filter((t) => t.id !== action.id) }
    case 'exited': {
      const [next, ...rest] = state.queue
      return { current: next ?? null, open: !!next, queue: rest }
    }
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [{ current, open }, dispatch] = useReducer(reducer, {
    current: null,
    open: false,
    queue: [],
  })
  const nextId = useRef(0)

  const api = useMemo(
    () => ({
      add: (toast: ToastOptions) => {
        const id = ++nextId.current
        dispatch({ type: 'add', toast: { ...toast, id } })
        return id
      },
      close: (id: number) => dispatch({ type: 'close', id }),
    }),
    [],
  )

  function handleClose(_: unknown, reason?: SnackbarCloseReason) {
    if (reason !== 'clickaway') dispatch({ type: 'close' })
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Portal: keeps toasts reachable while a full-screen dialog (play session) is open,
          since MUI hides everything inside #root from screen readers then. */}
      <Portal>
        <Snackbar
          key={current?.id}
          open={open}
          autoHideDuration={current?.timeout === undefined ? 4000 : current.timeout}
          onClose={handleClose}
          anchorOrigin={{ vertical: current?.placement ?? 'bottom', horizontal: 'center' }}
          slotProps={{ transition: { onExited: () => dispatch({ type: 'exited' }) } }}
          sx={
            current?.placement === 'top'
              ? { top: { xs: 'calc(12px + env(safe-area-inset-top))' } }
              : {
                  bottom: {
                    xs: 'calc(84px + env(safe-area-inset-bottom))',
                    sm: 'calc(92px + env(safe-area-inset-bottom))',
                  },
                }
          }
        >
          <Paper className="toast" data-type={current?.type} role="status">
            <div className="toast__text">
              <p className="toast__title">{current?.title}</p>
              {current?.description && (
                <p className="toast__description">{current.description}</p>
              )}
            </div>
            {current?.action && (
              <Button size="small" onClick={current.action.onClick} sx={{ minHeight: 36 }}>
                {current.action.label}
              </Button>
            )}
            <IconButton aria-label="Tutup" onClick={() => dispatch({ type: 'close' })}>
              <CloseIcon />
            </IconButton>
          </Paper>
        </Snackbar>
      </Portal>
    </ToastContext.Provider>
  )
}
