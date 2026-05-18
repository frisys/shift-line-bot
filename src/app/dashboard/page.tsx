'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardData } from '@/hooks';
import StoreSummary from './components/StoreSummary';
import StaffList from './components/StaffList';
import ShiftPreferencesTable from './components/ShiftPreferencesTable';
import { supabase } from '@/lib/supabase/client';
import type { Staff } from '@/types';

type Tab = 'shifts' | 'staff' | 'store';

const TABS: { id: Tab; label: string }[] = [
  { id: 'shifts', label: 'シフト希望' },
  { id: 'staff', label: 'スタッフ' },
  { id: 'store', label: '店舗設定' },
];

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('shifts');
  const {
    user,
    stores,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow p-6 text-center max-w-md w-full">
          <p className="text-red-600 font-medium">{errorMsg}</p>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="mt-4 px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            ログイン画面へ
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const selectedStore = stores.find(s => s.id === selectedStoreId);

  const handleStoreChange = (id: string) => {
    setSelectedStoreId(id);
    localStorage.setItem('selectedStoreId', id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* 左: タイトル + 店舗セレクタ */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg font-bold text-gray-900 whitespace-nowrap">📅 シフト管理</span>
            {stores.length > 1 ? (
              <select
                value={selectedStoreId || ''}
                onChange={(e) => handleStoreChange(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 truncate"
              >
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : selectedStore ? (
              <span className="text-sm text-gray-600 truncate">{selectedStore.name}</span>
            ) : null}
          </div>

          {/* 右: ユーザー + ログアウト */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-gray-500 hidden sm:block truncate max-w-[200px]">
              {user.email}
            </span>
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* タブナビゲーション */}
        {selectedStoreId && (
          <div className="max-w-7xl mx-auto px-4 flex border-t border-gray-100">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {!selectedStoreId ? (
          <div className="text-center text-gray-400 py-20">店舗を選択してください</div>
        ) : (
          <>
            {activeTab === 'shifts' && (
              <ShiftPreferencesTable preferences={preferences} store={selectedStore ?? null} />
            )}
            {activeTab === 'staff' && (
              <StaffList staff={staff} onStaffUpdate={handleStaffUpdate} />
            )}
            {activeTab === 'store' && (
              <StoreSummary selectedStoreId={selectedStoreId} stores={stores} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
