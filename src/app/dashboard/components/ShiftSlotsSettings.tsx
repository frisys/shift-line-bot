'use client';

import { useState, useEffect } from 'react';
import { Store } from '@/types';
import toast from 'react-hot-toast';
import { updateTimeSlots } from '@/services';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';

const DEFAULT_SLOTS = ['早番', '日勤', '遅番', '夜勤', 'フル'];

interface Props {
  store: Store;
  onUpdate?: (slots: string[]) => void;
}

export default function ShiftSlotsSettings({ store, onUpdate }: Props) {
  const [slots, setSlots] = useState<string[]>(store.time_slots ?? DEFAULT_SLOTS);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSlots(store.time_slots ?? DEFAULT_SLOTS);
    setDirty(false);
    setInputValue('');
  }, [store.id, store.time_slots]);

  const handleAdd = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || slots.includes(trimmed)) return;
    const next = [...slots, trimmed];
    setSlots(next);
    setInputValue('');
    setLoading(true);
    try {
      const { error } = await updateTimeSlots(store.id, next);
      if (error) throw error;
      onUpdate?.(next);
      toast.success('勤務区分を保存しました');
    } catch {
      setSlots(slots);
      toast.error('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (slot: string) => {
    setSlots(prev => prev.filter(s => s !== slot));
    setDirty(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await updateTimeSlots(store.id, slots);
      if (error) throw error;
      onUpdate?.(slots);
      setDirty(false);
      toast.success('勤務区分を保存しました');
    } catch {
      toast.error('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const isDuplicateInput = slots.includes(inputValue.trim()) && inputValue.trim() !== '';

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }} color="text.secondary">
        勤務区分の設定
      </Typography>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Typography variant="body2" color="text.secondary">
            LINEでスタッフが選択できる勤務区分を設定します。並び順はそのまま反映されます。
          </Typography>
        </Box>

        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5, minHeight: 36 }}>
            {slots.map(slot => (
              <Chip
                key={slot}
                label={slot}
                onDelete={() => handleDelete(slot)}
                color="primary"
                variant="outlined"
                size="small"
              />
            ))}
            {slots.length === 0 && (
              <Typography variant="body2" color="text.disabled">勤務区分がありません。追加してください。</Typography>
            )}
          </Box>

          <Stack direction="row" sx={{ gap: 1.5, alignItems: 'flex-start' }}>
            <TextField
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              placeholder="例: 早番"
              size="small"
              sx={{ width: 144 }}
              slotProps={{ htmlInput: { maxLength: 10 } }}
              error={isDuplicateInput}
              helperText={isDuplicateInput ? 'すでに登録済みです' : ''}
            />
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAdd}
              disabled={!inputValue.trim() || isDuplicateInput}
              sx={{ mt: 0.25 }}
            >
              追加
            </Button>
          </Stack>

          {dirty && (
            <>
              <Divider sx={{ mt: 2.5, mb: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? '保存中...' : '保存する'}
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
