// components/StaffEditModal.tsx
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Staff } from '@/types';
import { updateStaffProfile, updateStaffStoreSettings } from '@/services';
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

interface StaffEditModalProps {
  staff: Staff;
  timeSlots?: string[];
  onClose: () => void;
  onSaved: (updated: Staff) => void;
}

export default function StaffEditModal({ staff, timeSlots = [], onClose, onSaved }: StaffEditModalProps) {
  const [formData, setFormData] = useState<Staff>({ ...staff });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name.includes('max_') || name === 'hourly_wage') ? parseInt(value) || null : value,
    }));
  };

  const handleDayToggle = (eng: string) => {
    setFormData(prev => {
      const current = prev.unavailable_days ?? [];
      const next = current.includes(eng)
        ? current.filter(d => d !== eng)
        : [...current, eng];
      return { ...prev, unavailable_days: next };
    });
  };

  const handleSlotToggle = (slot: string) => {
    setFormData(prev => {
      const current = prev.preferred_time_slots ?? [];
      const next = current.includes(slot)
        ? current.filter(s => s !== slot)
        : [...current, slot];
      return { ...prev, preferred_time_slots: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: profileError } = await updateStaffProfile(formData.id, {
        display_name: formData.display_name || null,
      });
      if (profileError) throw profileError;

      const { error: storesError } = await updateStaffStoreSettings(
        formData.line_user_id,
        formData.store_id,
        {
          role: formData.role,
          max_consecutive_days: formData.max_consecutive_days,
          max_weekly_days: formData.max_weekly_days,
          unavailable_days: formData.unavailable_days,
          preferred_time_slots: formData.preferred_time_slots,
          hourly_wage: formData.hourly_wage,
        }
      );
      if (storesError) throw storesError;

      toast.success('スタッフ情報を更新しました！');
      onSaved(formData);
      onClose();
    } catch (err: unknown) {
      toast.error('更新に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'));
    } finally {
      setSaving(false);
    }
  };

  const unavailableDays = formData.unavailable_days ?? [];

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider', fontWeight: 600 }}>
        スタッフ編集: {staff.name || '未設定'}
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 3 }}>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="LINE名"
            value={formData.name || '未設定'}
            fullWidth
            size="small"
            slotProps={{ input: { readOnly: true } }}
            sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
          />
          <TextField
            label="表示名（任意）"
            name="display_name"
            value={formData.display_name || ''}
            onChange={handleChange}
            fullWidth
            size="small"
            placeholder="未設定の場合は登録時の氏名を使用"
          />

          <FormControl fullWidth size="small">
            <InputLabel>役割</InputLabel>
            <Select
              label="役割"
              name="role"
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as Staff['role'] }))}
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
              name="max_consecutive_days"
              value={formData.max_consecutive_days ?? ''}
              onChange={handleChange}
              slotProps={{ htmlInput: { min: 1, max: 7 } }}
              size="small"
            />
            <TextField
              label="週最大日数"
              type="number"
              name="max_weekly_days"
              value={formData.max_weekly_days ?? ''}
              onChange={handleChange}
              slotProps={{ htmlInput: { min: 1, max: 7 } }}
              size="small"
            />
            <TextField
              label="時給 (円)"
              type="number"
              name="hourly_wage"
              value={formData.hourly_wage ?? ''}
              onChange={handleChange}
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
            <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
              タップして選択。苦手曜日はシフト最適化で考慮されます。
            </Typography>
          </Box>

          {timeSlots.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>
                苦手時間帯
              </Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {timeSlots.map(slot => {
                  const selected = (formData.preferred_time_slots ?? []).includes(slot);
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
              <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                タップして選択。苦手時間帯はシフト最適化で考慮されます。
              </Typography>
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
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
