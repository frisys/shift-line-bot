// components/StaffList.tsx
import { useState } from 'react';
import StaffEditModal from './StaffEditModal';
import StaffAddModal from './StaffAddModal';
import { Staff } from '@/types';
import { STAFF_ROLE_LABELS, getJapaneseWeekday } from '@/constants';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Stack from '@mui/material/Stack';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

interface StaffListProps {
  staff: Staff[];
  storeId: string;
  timeSlots?: string[];
  onStaffUpdate: (updated: Staff) => void;
  onStaffAdd: (newStaff: Staff) => void;
}

export default function StaffList({ staff, storeId, timeSlots = [], onStaffUpdate, onStaffAdd }: StaffListProps) {
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [addingStaff, setAddingStaff] = useState(false);

  const handleCloseModal = () => setEditingStaff(null);

  return (
    <Box sx={{ mb: 5 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
            スタッフ一覧
          </Typography>
          <Typography variant="body2" color="text.disabled">{staff.length}名</Typography>
        </Stack>
        <Button
          variant="contained"
          size="small"
          startIcon={<PersonAddIcon />}
          onClick={() => setAddingStaff(true)}
        >
          スタッフを追加
        </Button>
      </Stack>

      {staff.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="text.secondary">この店舗にはスタッフが登録されていません</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ bgcolor: 'grey.50' }}>
              <TableRow>
                {['名前', '役割', '最大連勤', '週最大', '苦手曜日', '苦手時間帯', '時給', ''].map(label => (
                  <TableCell
                    key={label}
                    sx={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.05em' }}
                  >
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {staff.map(s => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {s.name || '未設定'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={STAFF_ROLE_LABELS[s.role as keyof typeof STAFF_ROLE_LABELS] ?? s.role}
                      size="small"
                      color={s.role === 'manager' ? 'secondary' : 'primary'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {s.max_consecutive_days != null ? `${s.max_consecutive_days}日` : '-'}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {s.max_weekly_days != null ? `${s.max_weekly_days}日` : '-'}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {s.unavailable_days?.map(d => getJapaneseWeekday(d)).join('・') || '-'}
                  </TableCell>
                  <TableCell>
                    {s.preferred_time_slots?.length ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {s.preferred_time_slots.map(slot => (
                          <Chip key={slot} label={slot} size="small" color="warning" variant="outlined" />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.disabled">-</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    {s.hourly_wage != null ? `¥${s.hourly_wage.toLocaleString()}/h` : '-'}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<EditIcon />} onClick={() => setEditingStaff(s)}>
                      編集
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {editingStaff && (
        <StaffEditModal
          staff={editingStaff}
          timeSlots={timeSlots}
          onClose={handleCloseModal}
          onSaved={onStaffUpdate}
        />
      )}

      {addingStaff && (
        <StaffAddModal
          storeId={storeId}
          timeSlots={timeSlots}
          onClose={() => setAddingStaff(false)}
          onAdded={onStaffAdd}
        />
      )}
    </Box>
  );
}
