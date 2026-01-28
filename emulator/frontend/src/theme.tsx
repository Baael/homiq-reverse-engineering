import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';

type Mode = 'light' | 'dark';
type MaxWidth = 'full' | 'centered';

interface ThemeContextType {
  mode: Mode;
  toggleMode: () => void;
  maxWidth: MaxWidth;
  toggleMaxWidth: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  toggleMode: () => {},
  maxWidth: 'full',
  toggleMaxWidth: () => {},
});

export function useThemeMode() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    const saved = localStorage.getItem('theme-mode');
    return (saved as Mode) || 'dark';
  });

  const [maxWidth, setMaxWidth] = useState<MaxWidth>(() => {
    const saved = localStorage.getItem('max-width');
    return (saved as MaxWidth) || 'full';
  });

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme-mode', next);
      return next;
    });
  };

  const toggleMaxWidth = () => {
    setMaxWidth((prev) => {
      const next = prev === 'full' ? 'centered' : 'full';
      localStorage.setItem('max-width', next);
      return next;
    });
  };

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#2196f3' },
      secondary: { main: '#9c27b0' },
      error: { main: '#f44336' },
      warning: { main: '#ff9800' },
      info: { main: '#03a9f4' },
      success: { main: '#4caf50' },
      ...(mode === 'dark' ? {
        background: { default: '#121212', paper: '#1e1e1e' },
        text: { primary: '#e0e0e0', secondary: '#9e9e9e' },
      } : {
        background: { default: '#fafafa', paper: '#ffffff' },
        text: { primary: '#212121', secondary: '#757575' },
      }),
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: 14,
    },
    shape: { borderRadius: 4 },
    components: {
      MuiButton: {
        defaultProps: { size: 'small', disableElevation: true },
        styleOverrides: { root: { textTransform: 'none' } },
      },
      MuiTextField: {
        defaultProps: { size: 'small', variant: 'outlined' },
      },
      MuiSelect: {
        defaultProps: { size: 'small' },
      },
      MuiTableCell: {
        styleOverrides: { root: { padding: '8px 12px' } },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 500 } },
      },
    },
  }), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleMode, maxWidth, toggleMaxWidth }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
