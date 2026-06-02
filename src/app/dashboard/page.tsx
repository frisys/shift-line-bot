'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardData } from '@/hooks';
import StoreSummary from './components/StoreSummary';
import StaffList from './components/StaffList';
import ShiftPreferencesTable from './components/ShiftPreferencesTable';
import PaymentSettings from './components/PaymentSettings';
import { supabase } from '@/lib/supabase/client';
import type { Staff, Store } from '@/types';
import { updateStaffStoreSettings } from '@/services';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LogoutIcon from '@mui/icons-material/Logout';

type DashTab = 'shifts' | 'staff' | 'store' | 'payment';

const STORE_TABS: { id: DashTab; label: string }[] = [
  { id: 'shifts', label: 'シフト希望' },
  { id: 'staff', label: 'スタッフ' },
  { id: 'store', label: '店舗設定' },
];

const ALL_TABS: { id: DashTab; label: string }[] = [
  ...STORE_TABS,
  { id: 'payment', label: '支払い' },
];

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DashTab>('shifts');
  const {
    user,
    stores,
    setStores,
    selectedStoreId,
    setSelectedStoreId,
    staff,
    setStaff,
    preferences,
    loading,
    errorMsg,
  } = useDashboardData();

  const handleStaffUpdate = (updated: Staff) => {
    setStaff(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const handleStaffAdd = (newStaff: Staff) => {
    setStaff(prev => [...prev, newStaff]);
  };

  const handleUpdateStores = (updatedStores: Store[]) => {
    const oldSlots = stores.find(s => s.id === selectedStoreId)?.time_slots ?? [];
    const newSlots = updatedStores.find(s => s.id === selectedStoreId)?.time_slots ?? [];
    const deletedSlots = oldSlots.filter(slot => !newSlots.includes(slot));

    if (deletedSlots.length > 0) {
      setStaff(prev => prev.map(s => {
        if (!s.preferred_time_slots?.some(slot => deletedSlots.includes(slot))) return s;
        const cleaned = (s.preferred_time_slots ?? []).filter(slot => !deletedSlots.includes(slot));
        updateStaffStoreSettings(s.line_user_id, s.store_id, { preferred_time_slots: cleaned });
        return { ...s, preferred_time_slots: cleaned };
      }));
    }

    setStores(updatedStores);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>読み込み中...</Typography>
        </Box>
      </Box>
    );
  }

  if (errorMsg) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
        <Paper elevation={2} sx={{ p: 4, borderRadius: 3, textAlign: 'center', maxWidth: 440, width: '100%' }}>
          <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>
          <Button variant="outlined" onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}>
            ログイン画面へ
          </Button>
        </Paper>
      </Box>
    );
  }

  if (!user) {
    return null;
  }

  const selectedStore = stores.find(s => s.id === selectedStoreId);

  const handleStoreChange = (id: string) => {
    setSelectedStoreId(id);
    localStorage.setItem('selectedStoreId', id);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="default" elevation={1} sx={{ bgcolor: 'white' }}>
        <Toolbar sx={{ gap: 2, minHeight: { xs: 56 } }}>
          <CalendarMonthIcon color="primary" />
          <Typography variant="subtitle1" noWrap sx={{ fontWeight: 'bold', mr: 1 }}>
            シフト管理
          </Typography>

          {stores.length > 1 ? (
            <Select
              value={selectedStoreId || ''}
              onChange={(e) => handleStoreChange(e.target.value)}
              size="small"
              sx={{ minWidth: 140 }}
            >
              {stores.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </Select>
          ) : selectedStore ? (
            <Typography variant="body2" color="text.secondary" noWrap>
              {selectedStore.name}
            </Typography>
          ) : null}

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="body2" color="text.secondary" noWrap sx={{ display: { xs: 'none', sm: 'block' }, maxWidth: 200 }}>
            {user.email}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<LogoutIcon />}
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
          >
            ログアウト
          </Button>
        </Toolbar>

        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ borderTop: '1px solid', borderColor: 'divider', minHeight: 42 }}
          slotProps={{ indicator: { sx: { height: 3 } } }}
        >
          {ALL_TABS.map(tab => (
            <Tab key={tab.id} value={tab.id} label={tab.label} sx={{ minHeight: 42, py: 1 }} />
          ))}
        </Tabs>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {activeTab === 'payment' ? (
          <PaymentSettings />
        ) : !selectedStoreId ? (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography color="text.disabled">店舗を選択してください</Typography>
          </Box>
        ) : (
          <>
            {activeTab === 'shifts' && (
              <ShiftPreferencesTable preferences={preferences} store={selectedStore ?? null} staff={staff} />
            )}
            {activeTab === 'staff' && (
              <StaffList staff={staff} storeId={selectedStoreId} timeSlots={selectedStore?.time_slots ?? []} onStaffUpdate={handleStaffUpdate} onStaffAdd={handleStaffAdd} />
            )}
            {activeTab === 'store' && (
              <StoreSummary selectedStoreId={selectedStoreId} stores={stores} onUpdateStores={handleUpdateStores} />
            )}
          </>
        )}
      </Container>
    </Box>
  );
}
