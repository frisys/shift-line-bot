'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase/client';
import type { Store } from '@/types';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';

interface JoinStoreModalProps {
  onClose: () => void;
  onJoined: (store: Store) => void;
}

export default function JoinStoreModal({ onClose, onJoined }: JoinStoreModalProps) {
  const [storeCode, setStoreCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!storeCode.trim()) {
      toast.error('店舗コードを入力してください');
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('ログインが必要です');

      const res = await fetch('/api/stores/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeCode: storeCode.trim() }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      toast.success(`「${json.store.name}」に参加しました`);
      onJoined(json.store as Store);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '参加に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider', fontWeight: 600 }}>
        店舗に参加
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 3 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            管理者から受け取った店舗コードを入力してください。
          </Typography>
          <TextField
            label="店舗コード"
            value={storeCode}
            onChange={e => setStoreCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            fullWidth
            size="small"
            autoFocus
            placeholder="例: STORE01"
            slotProps={{ htmlInput: { maxLength: 10 } }}
          />
        </Stack>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2.5, gap: 1 }}>
        <Button variant="outlined" onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleJoin}
          disabled={loading || !storeCode.trim()}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading ? '参加中...' : '参加'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
