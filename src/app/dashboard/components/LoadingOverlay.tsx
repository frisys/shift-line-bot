// components/LoadingOverlay.tsx
'use client';

import Backdrop from '@mui/material/Backdrop';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export default function LoadingOverlay({ isLoading, message = '読み込み中...' }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <Backdrop open sx={{ zIndex: 1400 }}>
      <Paper elevation={8} sx={{ p: 4, borderRadius: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Box sx={{ display: 'inline-flex' }}>
          <CircularProgress size={56} />
        </Box>
        <Typography variant="body1" sx={{ fontWeight: 500 }} color="text.primary">
          {message}
        </Typography>
      </Paper>
    </Backdrop>
  );
}