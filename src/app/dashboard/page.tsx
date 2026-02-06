'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardData } from './hooks/useDashboardData';
import DashboardHeader from './components/DashboardHeader';
import StoreSummary from './components/StoreSummary';
import StaffList from './components/StaffList';
import ShiftPreferencesTable from './components/ShiftPreferencesTable';
import LoadingOverlay from './components/LoadingOverlay';
import { supabase } from '@/lib/supabase/client';

export default function Dashboard() {
  const router = useRouter();
  const {
    user,
    stores,
    selectedStoreId,
    setSelectedStoreId,
    staff,
    preferences,
    loading,
    errorMsg
  } = useDashboardData();

const [isEditingRequired, setIsEditingRequired] = useState(false);
const [editedRequiredStaff, setEditedRequiredStaff] = useState<{ [key: string]: number }>({});
const [showConfirmDialog, setShowConfirmDialog] = useState(false);


  if (loading) return <div className="p-8 text-center">読み込み中...</div>;
  if (errorMsg) return <div className="p-8 text-red-600">{errorMsg}</div>;
  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        <DashboardHeader user={user} stores={stores} selectedStoreId={selectedStoreId} setSelectedStoreId={setSelectedStoreId} />

        {selectedStoreId && (
          <>
            <LoadingOverlay isLoading={loading} message="店舗データを読み込み中..." />
            <StoreSummary selectedStoreId={selectedStoreId} stores={stores} />

            <StaffList staff={staff} />

            <ShiftPreferencesTable preferences={preferences} />
          </>
        )}

        <button
          onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
          className="mt-8 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}