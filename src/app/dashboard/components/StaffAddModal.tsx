'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Staff } from '@/types';
import { createStaff } from '@/services';
import { DAYS_ORDER } from '@/constants';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';

interface StaffAddModalProps {
  storeId: string;
  timeSlots?: string[];
  onClose: () => void;
  onAdded: (newStaff: Staff) => void;
}

export default function StaffAddModal({ storeId, timeSlots = [], onClose, onAdded }: StaffAddModalProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Staff['role']>('staff');
  const [maxConsecutive, setMaxConsecutive] = useState('');
  const [maxWeekly, setMaxWeekly] = useState('');
  const [hourlyWage, setHourlyWage] = useState('');
  const [unavailableDays, setUnavailableDays] = useState<string[]>([]);
  const [preferredSlots, setPreferredSlots] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleDayToggle = (eng: string) => {
    setUnavailableDays(prev =>
      prev.includes(eng) ? prev.filter(d => d !== eng) : [...prev, eng]
    );
  };

  const handleSlotToggle = (slot: string) => {
    setPreferredSlots(prev =>
      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('名前を入力してください');
      return;
    }
    setSaving(true);
    try {
      const { staff, error } = await createStaff(storeId, {
        name: name.trim(),
        role,
        max_consecutive_days: maxConsecutive ? parseInt(maxConsecutive) : null,
        max_weekly_days: maxWeekly ? parseInt(maxWeekly) : null,
        unavailable_days: unavailableDays,
        preferred_time_slots: preferredSlots,
        hourly_wage: hourlyWage ? parseInt(hourlyWage) : null,
      });
      if (error || !staff) throw error ?? new Error('作成に失敗しました');
      toast.success('スタッフを追加しました');
      onAdded(staff);
      onClose();
    } catch (err: unknown) {
      toast.error('追加に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider', fontWeight: 600 }}>
        スタッフを追加
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 3 }}>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="名前"
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            size="small"
            required
            autoFocus
          />

          <FormControl fullWidth size="small">
            <InputLabel>役割</InputLabel>
            <Select
              label="役割"
              value={role}
              onChange={e => setRole(e.target.value as Staff['role'])}
            >
              <MenuItem value="staff">スタッフ</MenuItem>
              <MenuItem value="manager">店長</MenuItem>
              <MenuItem value="admin">管理者</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
            <TextField
              label="最大連勤日数"
              type="number"
              value={maxConsecutive}
              onChange={e => setMaxConsecutive(e.target.value)}
              slotProps={{ htmlInput: { min: 1, max: 7 } }}
              size="small"
            />
            <TextField
              label="週最大日数"
              type="number"
              value={maxWeekly}
              onChange={e => setMaxWeekly(e.target.value)}
              slotProps={{ htmlInput: { min: 1, max: 7 } }}
              size="small"
            />
            <TextField
              label="時給 (円)"
              type="number"
              value={hourlyWage}
              onChange={e => setHourlyWage(e.target.value)}
              slotProps={{ htmlInput: { min: 0 } }}
              size="small"
            />
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>
              苦手曜日
            </Typography>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {DAYS_ORDER.map(({ eng, ja }) => {
                const selected = unavailableDays.includes(eng);
                return (
                  <Button
                    key={eng}
                    variant={selected ? 'contained' : 'outlined'}
                    color={selected ? 'error' : 'inherit'}
                    size="small"
                    onClick={() => handleDayToggle(eng)}
                    sx={{ minWidth: 40, width: 40, height: 40, borderRadius: '50%', p: 0, fontSize: 13 }}
                  >
                    {ja}
                  </Button>
                );
              })}
            </Stack>
          </Box>

          {timeSlots.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>
                苦手時間帯
              </Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {timeSlots.map(slot => {
                  const selected = preferredSlots.includes(slot);
                  return (
                    <Button
                      key={slot}
                      variant={selected ? 'contained' : 'outlined'}
                      color={selected ? 'error' : 'inherit'}
                      size="small"
                      onClick={() => handleSlotToggle(slot)}
                      sx={{ minHeight: 32, px: 1.5, fontSize: 12 }}
                    >
                      {slot}
                    </Button>
                  );
                })}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2.5, gap: 1 }}>
        <Button variant="outlined" onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {saving ? '追加中...' : '追加'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
