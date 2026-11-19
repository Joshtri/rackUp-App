import { createTheme } from '@mui/material/styles'
import type { PickersLocaleText } from '@mui/x-date-pickers/locales'

/*
 * Tema MUI. Warnanya disamakan dengan token di src/styles/theme.css —
 * kalau ganti warna di sana, ganti juga di sini.
 *
 * MUI memasang <html data-theme="dark|light"> sesuai setting perangkat,
 * dan theme.css ikut membaca atribut yang sama.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-theme' },
  colorSchemes: {
    dark: {
      palette: {
        primary: { main: '#e9c25b', contrastText: '#241a02' },
        error: { main: '#f06a5a', contrastText: '#2a0905' },
        background: { default: '#0b2219', paper: '#143a2d' },
        text: { primary: '#f3efe3', secondary: '#a3bcae', disabled: '#6f8d7f' },
        divider: 'rgb(243 239 227 / 0.1)',
      },
    },
    light: {
      palette: {
        primary: { main: '#0f5a3d', contrastText: '#f7f3e6' },
        error: { main: '#c8372a', contrastText: '#fff' },
        background: { default: '#f4f0e4', paper: '#fffdf7' },
        text: { primary: '#14231c', secondary: '#55695f', disabled: '#8a9a91' },
        divider: 'rgb(20 35 28 / 0.1)',
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    button: { textTransform: 'none', fontWeight: 650, fontSize: '0.95rem' },
  },
  components: {
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, minHeight: 44, paddingInline: 18 },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 650, fontSize: '1rem' },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { color: 'var(--text-muted)' } },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          '&:not(.MuiBackdrop-invisible)': {
            backgroundColor: 'var(--backdrop)',
            backdropFilter: 'blur(2px)',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--popup)',
          boxShadow: 'var(--shadow-popup)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: 'var(--font-display)',
          fontSize: '1.3rem',
          fontWeight: 750,
          letterSpacing: '-0.01em',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--popup)',
          boxShadow: 'var(--shadow-popup)',
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--popup)',
          boxShadow: 'var(--shadow-popup)',
        },
        option: { gap: 10, minHeight: 42 },
      },
    },
    MuiMenuItem: {
      styleOverrides: { root: { minHeight: 42, fontSize: '0.92rem' } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--surface-2)',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border-strong)' },
        },
        // 16px stops iOS from zooming in on focus
        input: { fontSize: 16 },
      },
    },
    MuiToggleButton: {
      defaultProps: { color: 'primary' },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 650, fontSize: '0.92rem', minHeight: 42 },
      },
    },
    MuiTab: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 650 } },
    },
  },
})

/** MUI X belum punya terjemahan Indonesia, jadi teks yang tampil diisi di sini. */
export const pickerLocaleText: Partial<PickersLocaleText> = {
  previousMonth: 'Bulan sebelumnya',
  nextMonth: 'Bulan berikutnya',
  cancelButtonLabel: 'Batal',
  clearButtonLabel: 'Hapus',
  okButtonLabel: 'OK',
  todayButtonLabel: 'Hari ini',
  datePickerToolbarTitle: 'Pilih tanggal',
  openDatePickerDialogue: (formatted) =>
    formatted ? `Pilih tanggal, sekarang ${formatted}` : 'Pilih tanggal',
  fieldDayPlaceholder: () => 'HH',
  fieldMonthPlaceholder: (p) => (p.contentType === 'letter' ? 'Bulan' : 'BB'),
  fieldYearPlaceholder: (p) => 'T'.repeat(p.digitAmount),
}
