'use client';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ReactNode, useState } from 'react';
import createCache from '@emotion/cache';
import { useServerInsertedHTML } from 'next/navigation';
import { CacheProvider } from '@emotion/react';

const theme = createTheme({
  palette: {
    primary: { main: '#2563eb' },
    secondary: { main: '#7c3aed' },
    error: { main: '#ef4444' },
    success: { main: '#16a34a' },
    background: { default: '#f8fafc' },
  },
  typography: {
    fontFamily: '"Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans JP", Arial, sans-serif',
    button: { textTransform: 'none' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiTab: {
      styleOverrides: { root: { textTransform: 'none', minHeight: 48 } },
    },
    MuiTableCell: {
      styleOverrides: { root: { padding: '6px 12px' } },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 6 } },
    },
  },
});

export default function MuiProvider({ children }: { children: ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const c = createCache({ key: 'css' });
    c.compat = true;
    const insertedNames: string[] = [];
    const prevInsert = c.insert;
    c.insert = (...args) => {
      const name = (args[1] as { name?: string })?.name;
      if (name && c.inserted[name] === undefined) {
        insertedNames.push(name);
      }
      return prevInsert(...args);
    };
    return {
      cache: c,
      flush: () => {
        const names = [...insertedNames];
        insertedNames.length = 0;
        return names;
      },
    };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (!names.length) return null;
    const styles = names.map(n => cache.inserted[n]).join('');
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
