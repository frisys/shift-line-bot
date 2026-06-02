// components/StoreSummary.tsx
'use client';

import { useState, useEffect } from 'react';
import { Store } from '@/types';
import toast from 'react-hot-toast';
import { DAYS_ORDER, getJapaneseWeekday } from '@/constants';
import { updateRequiredStaff } from '@/services';
import ShiftSlotsSettings from './ShiftSlotsSettings';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import EditIcon from '@mui/icons-material/Edit';

interface StoreSummaryProps {
  selectedStoreId: string | null;
  stores: Store[];
  onUpdateStores?: (updatedStores: Store[]) => void;
}

type NestedRequired = Record<string, Record<string, number>>;

function parseRequired(raw: Record<string, number | Record<string, number>>): NestedRequired {
  const result: NestedRequired = {};
  for (const { eng } of DAYS_ORDER) {
    const val = raw[eng];
    if (val !== undefined && typeof val === 'object' && val !== null) {
      result[eng] = val as Record<string, number>;
    } else {
      result[eng] = {};
    }
  }
  return result;
}

export default function StoreSummary({ selectedStoreId, stores, onUpdateStores }: StoreSummaryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRequired, setEditedRequired] = useState<NestedRequired>({});
  const [originalRequired, setOriginalRequired] = useState<NestedRequired>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const store = stores.find(s => s.id === selectedStoreId);

  useEffect(() => {
    const parsed = parseRequired(store?.required_staff || {});
    setOriginalRequired(parsed);
    setEditedRequired(JSON.parse(JSON.stringify(parsed)));
    setIsEditing(false);
    setShowConfirm(false);
  }, [selectedStoreId, store]);

  const getCount = (day: string, slot: string) => editedRequired[day]?.[slot] ?? 0;
  const getOriginal = (day: string, slot: string) => originalRequired[day]?.[slot] ?? 0;

  const handleInputChange = (day: string, slot: string, value: string) => {
    const num = Math.max(0, Math.min(20, parseInt(value) || 0));
    setEditedRequired(prev => ({
      ...prev,
      [day]: { ...(prev[day] || {}), [slot]: num },
    }));
  };

  const hasChanges = () => {
    const slots = store?.time_slots ?? [];
    return DAYS_ORDER.some(({ eng }) =>
      slots.some(slot => getCount(eng, slot) !== getOriginal(eng, slot))
    );
  };

  const handleConfirmSave = async () => {
    if (!selectedStoreId || !store) return;
    setLoading(true);
    try {
      const { error } = await updateRequiredStaff(selectedStoreId, editedRequired);
      if (error) throw error;
      if (onUpdateStores) {
        onUpdateStores(stores.map(s =>
          s.id === selectedStoreId ? { ...s, required_staff: editedRequired } : s
        ));
      }
      setOriginalRequired(JSON.parse(JSON.stringify(editedRequired)));
      setIsEditing(false);
      setShowConfirm(false);
      toast.success('必要人数を更新しました！', {
        icon: '✅',
        style: { border: '1px solid #10B981', padding: '16px', color: '#10B981' },
      });
    } catch (err: unknown) {
      toast.error('更新に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'), {
        style: { border: '1px solid #EF4444', padding: '16px', color: '#EF4444' },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedRequired(JSON.parse(JSON.stringify(originalRequired)));
    setIsEditing(false);
    setShowConfirm(false);
  };

  if (!store) return null;

  const slots = store.time_slots?.filter(Boolean) ?? [];

  const changedCells = DAYS_ORDER.flatMap(({ eng }) =>
    (store.time_slots ?? []).flatMap(slot => {
      const orig = getOriginal(eng, slot);
      const next = getCount(eng, slot);
      return next !== orig ? [{ day: eng, slot, orig, next }] : [];
    })
  );

  return (
    <Box sx={{ mb: 5 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }} color="text.secondary">
        店舗情報
      </Typography>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {/* ヘッダー */}
        <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between', gap: 3 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{store.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                店舗コード（スタッフに伝えてください）：
                <Box component="span" sx={{ ml: 1, fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: 'primary.main', letterSpacing: 4 }}>
                  {store.store_code || '未設定'}
                </Box>
              </Typography>
            </Box>
            <Box>
              {!isEditing ? (
                <Button variant="contained" startIcon={<EditIcon />} onClick={() => setIsEditing(true)}>
                  編集
                </Button>
              ) : (
                <Stack direction="row" sx={{ gap: 1.5 }}>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => setShowConfirm(true)}
                    disabled={loading || !hasChanges()}
                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
                  >
                    {loading ? '保存中...' : '保存'}
                  </Button>
                  <Button variant="outlined" onClick={handleCancel}>キャンセル</Button>
                </Stack>
              )}
            </Box>
          </Stack>
        </Box>

        {/* 必要人数テーブル */}
        <Box sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1.5 }} color="text.secondary">
            曜日ごとの必要人数（勤務区分別）
          </Typography>
          {slots.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 1.5 }}>
              <Typography variant="body2" color="text.disabled">
                下の「勤務区分の設定」で勤務区分を追加すると、ここで曜日ごとに必要人数を設定できます。
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', minWidth: 90, borderRight: '1px solid', borderColor: 'divider' }}>
                      勤務区分
                    </TableCell>
                    {DAYS_ORDER.map(({ eng, ja }) => (
                      <TableCell
                        key={eng}
                        align="center"
                        sx={{
                          fontWeight: 600, fontSize: 12, minWidth: 52,
                          color: eng === 'sun' ? 'error.main' : eng === 'sat' ? 'primary.main' : 'text.secondary',
                          bgcolor: (eng === 'sun' || eng === 'sat') ? 'grey.100' : 'transparent',
                        }}
                      >
                        {ja}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {slots.map(slot => (
                    <TableRow key={slot} hover>
                      <TableCell sx={{ fontWeight: 500, color: 'text.secondary', borderRight: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' }}>
                        {slot}
                      </TableCell>
                      {DAYS_ORDER.map(({ eng }) => {
                        const count = getCount(eng, slot);
                        const isChanged = count !== getOriginal(eng, slot);
                        const isWeekend = eng === 'sun' || eng === 'sat';
                        return (
                          <TableCell key={eng} align="center" sx={{ bgcolor: isWeekend ? 'grey.50' : 'transparent' }}>
                            {isEditing ? (
                              <TextField
                                type="number"
                                value={count}
                                onChange={(e) => handleInputChange(eng, slot, e.target.value)}
                                slotProps={{ htmlInput: { min: 0, max: 20, style: { textAlign: 'center', fontWeight: 700, padding: '2px 4px', width: 40 } } }}
                                variant="standard"
                                sx={{ '& .MuiInput-underline:before': { borderColor: isChanged ? 'primary.main' : 'divider' }, '& input': { color: isChanged ? 'primary.main' : 'text.primary' } }}
                              />
                            ) : (
                              <Typography
                                variant="body2"
                                color={count > 0 ? 'text.primary' : 'text.disabled'}
                                sx={{ fontWeight: 700, cursor: 'pointer' }}
                                onClick={() => setIsEditing(true)}
                              >
                                {count > 0 ? count : '-'}
                              </Typography>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Paper>

      <ShiftSlotsSettings
        store={store}
        onUpdate={(slots) => {
          onUpdateStores?.(stores.map(s =>
            s.id === store.id ? { ...s, time_slots: slots } : s
          ));
        }}
      />

      {/* 確認ダイアログ */}
      <Dialog open={showConfirm} onClose={() => setShowConfirm(false)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>変更を確認</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            以下の設定を変更します。よろしいですか？
          </Typography>
          {changedCells.length === 0 ? (
            <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>
              変更内容がありません
            </Typography>
          ) : (
            <TableContainer sx={{ maxHeight: 320 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['曜日・区分', '変更前', '変更後'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, color: 'text.secondary' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {changedCells.map(({ day, slot, orig, next }) => (
                    <TableRow key={`${day}-${slot}`}>
                      <TableCell>{getJapaneseWeekday(day)}・{slot}</TableCell>
                      <TableCell sx={{ color: 'text.disabled' }}>{orig}人</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>{next}人</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setShowConfirm(false)}>キャンセル</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirmSave}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? '保存中...' : '保存する'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
