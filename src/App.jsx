// src/App.js
import React from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { TabProvider } from './context/TabContext';
import { SupabaseProvider } from './context/SupabaseContext';
import AppLayout from './components/Layout/AppLayout';

// Create theme with all necessary styles
const theme = createTheme({
  palette: {
    primary: {
      main: '#000000',
    },
    secondary: {
      main: '#666666',
    },
    error: {
      main: '#d32f2f',
      dark: '#b71c1c',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#000000',
      secondary: '#666666',
    },
  },
  components: {
    // Buttons styling
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 4,
          '&.Mui-disabled': {
            backgroundColor: 'rgba(0, 0, 0, 0.12)',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderWidth: '1px',
          '&:hover': {
            borderWidth: '1px',
          },
        },
      },
    },
    // Paper components styling
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.05)',
        },
        outlined: {
          border: '1px solid rgba(0, 0, 0, 0.12)',
        },
      },
    },
    // Table styling
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontWeight: 600,
            backgroundColor: '#f5f5f5',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
          padding: '16px',
        },
        head: {
          color: '#000000',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        },
      },
    },
    // Form components styling
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '&:hover fieldset': {
              borderColor: 'rgba(0, 0, 0, 0.23)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#000000',
            },
          },
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            padding: '3px !important',
          },
        },
        paper: {
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.1)',
        },
        listbox: {
          padding: '8px 0',
        },
        option: {
          padding: '8px 16px',
          '&[aria-selected="true"]': {
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
          },
          '&[data-focus="true"]': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        },
      },
    },
    // Drawer styling (for sidebar)
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#000000',
          color: '#ffffff',
          width: 240,
          borderRight: 'none',
          borderRadius: 0,
        },
      },
    },
    // List items styling (for sidebar)
    MuiListItem: {
      styleOverrides: {
        root: {
          margin: '4px 8px',
          borderRadius: 4,
          '&.Mui-selected': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: 'inherit',
          minWidth: 40,
        },
      },
    },
    // Dialog styling
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          padding: 8,
        },
      },
    },
    // Alert styling
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
        standardError: {
          backgroundColor: 'rgba(211, 47, 47, 0.1)',
          color: '#d32f2f',
        },
        standardSuccess: {
          backgroundColor: 'rgba(46, 125, 50, 0.1)',
          color: '#2e7d32',
        },
      },
    },
    // Tooltip styling
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.87)',
          fontSize: '0.75rem',
        },
      },
    },
    // Chip styling
    MuiChip: {
      styleOverrides: {
        root: {
          height: 24,
        },
        outlined: {
          borderColor: 'rgba(0, 0, 0, 0.23)',
        },
      },
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
      fontSize: '1.75rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    subtitle1: {
      fontWeight: 500,
    },
    subtitle2: {
      fontWeight: 500,
    },
    body1: {
      fontSize: '0.875rem',
    },
    body2: {
      fontSize: '0.75rem',
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 4,
  },
  transitions: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
    },
  },
});

// Add custom breakpoints if needed
theme.breakpoints = {
  ...theme.breakpoints,
  values: {
    xs: 0,
    sm: 600,
    md: 960,
    lg: 1280,
    xl: 1920,
  },
};

function App() {
  return (
    <SupabaseProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline /> {/* Provides consistent baseline styles */}
            <TabProvider>
              <AppLayout />
            </TabProvider>
        </ThemeProvider>
    </SupabaseProvider>
    
  );
}

export default App;