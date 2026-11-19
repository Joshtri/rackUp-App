import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import 'dayjs/locale/id'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AuthGate } from './components/AuthGate.tsx'
import { AuthProvider } from './components/AuthProvider.tsx'
import { PwaUpdater } from './components/PwaUpdater.tsx'
import { ToastProvider } from './components/Toaster.tsx'
import './styles/theme.css'
import './styles/app.css'
import { pickerLocaleText, theme } from './theme.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* injectFirst: MUI styles load first, so app.css can override them */}
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <LocalizationProvider
          dateAdapter={AdapterDayjs}
          adapterLocale="id"
          localeText={pickerLocaleText}
        >
          <ToastProvider>
            <AuthProvider>
              <AuthGate>
                <App />
              </AuthGate>
            </AuthProvider>
            <PwaUpdater />
          </ToastProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  </StrictMode>,
)
