// components/StoreSummary.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Store } from '@/types';  // 型をインポート（src/types/store.tsから）
import toast from 'react-hot-toast';

const weekdayMap: { [key: string]: string } = {
  mon: '月',
  tue: '火',
  wed: '水',
  thu: '木',
  fri: '金',
  sat: '土',
  sun: '日',
};

const getJapaneseWeekday = (eng: string) => weekdayMap[eng.toLowerCase()] || eng;

interface StoreSummaryProps {
  selectedStoreId: string | null;
  stores: Store[];
  onUpdateStores?: (updatedStores: Store[]) => void;  // 親に更新を伝えるコールバック（任意）
}

export default function StoreSummary({ selectedStoreId, stores, onUpdateStores }: StoreSummaryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRequired, setEditedRequired] = useState<{ [key: string]: number }>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const store = stores.find(s => s.id === selectedStoreId);
  const [originalRequired, setOriginalRequired] = useState<{ [key: string]: number }>({});
  
  useEffect(() => {
    const current = store?.required_staff || {};
    setOriginalRequired(current);
    setEditedRequired(current); // 編集中もリセット
    setIsEditing(false);
    setShowConfirm(false);
  }, [selectedStoreId, store]);

  const handleInputChange = (day: string, value: string) => {
    const num = parseInt(value) || 0;
    setEditedRequired(prev => ({
      ...prev,
      [day]: Math.max(0, Math.min(10, num))  // 0〜10に制限
    }));
  };

  const handleSaveClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    if (!selectedStoreId || !store) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ required_staff: editedRequired })
        .eq('id', selectedStoreId);

      if (error) throw error;

      // 親コンポーネントに更新を伝える（任意）
      if (onUpdateStores) {
        const updatedStores = stores.map(s =>
          s.id === selectedStoreId ? { ...s, required_staff: editedRequired } : s
        );
        onUpdateStores(updatedStores);
      }

      setIsEditing(false);
      setShowConfirm(false);
      toast.success('必要人数を更新しました！', {
        icon: '✅',
        style: {
          border: '1px solid #10B981',
          padding: '16px',
          color: '#10B981',
        },
      });
    } catch (err: unknown) {
      console.error('更新エラー:', err);
      toast.error('更新に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'), {
        style: {
          border: '1px solid #EF4444',
          padding: '16px',
          color: '#EF4444',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedRequired(originalRequired); // ← これで確実に元に戻す
    setIsEditing(false);
    setShowConfirm(false);
  };

  if (!store) return null;

  const days = [
    { eng: 'sun', ja: '日' },
    { eng: 'mon', ja: '月' },
    { eng: 'tue', ja: '火' },
    { eng: 'wed', ja: '水' },
    { eng: 'thu', ja: '木' },
    { eng: 'fri', ja: '金' },
    { eng: 'sat', ja: '土' },
  ];

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-3">
        <span className="inline-block w-2 h-8 bg-blue-600 rounded-full"></span>
        店舗情報
      </h2>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
        {/* ヘッダーエリア */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {store.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                店舗コード（スタッフに伝えてください）：
                <span className="ml-2 font-mono text-lg font-bold text-blue-600 dark:text-blue-400 tracking-widest">
                  {store.store_code || '未設定'}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-4">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  編集
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveClick}
                    disabled={loading}
                    className={`px-5 py-2.5 rounded-lg font-medium text-white transition-colors ${
                      loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {loading ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 必要人数カードエリア */}
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
            {days.map(({ eng, ja }) => {
              const count = editedRequired[eng] ?? originalRequired[eng] ?? 0;
              const isChanged = editedRequired[eng] !== undefined && editedRequired[eng] !== originalRequired[eng];

              let bgClass = 'bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-700';
              let textClass = 'text-gray-900 dark:text-white';
              if (count >= 5) {
                bgClass = 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30 border-red-200 dark:border-red-800';
                textClass = 'text-red-700 dark:text-red-300';
              } else if (count >= 3) {
                bgClass = 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30 border-yellow-200 dark:border-yellow-800';
                textClass = 'text-yellow-700 dark:text-yellow-300';
              } else if (count > 0) {
                bgClass = 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 border-green-200 dark:border-green-800';
                textClass = 'text-green-700 dark:text-green-300';
              }

              return (
                <div
                  key={eng}
                  className={`rounded-xl border shadow-sm p-5 text-center transition-all hover:shadow-md ${bgClass} ${
                    isChanged ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                  }`}
                >
                  <div className={`text-4xl font-extrabold mb-2 ${textClass}`}>
                    {ja}
                  </div>

                  {isEditing ? (
                    <input
                      type="number"
                      value={count}
                      onChange={(e) => handleInputChange(eng, e.target.value)}
                      className={`w-20 mx-auto block text-5xl font-black text-center bg-transparent border-b-3 focus:outline-none focus:border-blue-500 transition-colors ${
                        isChanged ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'
                      }`}
                      min="0"
                      max="10"
                    />
                  ) : (
                    <div
                      onClick={() => setIsEditing(true)}
                      className={`text-6xl font-black cursor-pointer transition-colors hover:scale-105 ${textClass}`}
                    >
                      {count}
                    </div>
                  )}

                  <div className="text-sm mt-3 opacity-80 text-gray-600 dark:text-gray-400">
                    人
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">変更を確認</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300">
                以下の曜日で必要人数を変更します。よろしいですか？
              </p>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-3 font-medium text-gray-700 dark:text-gray-300">曜日</th>
                    <th className="pb-3 font-medium text-gray-700 dark:text-gray-300">変更前</th>
                    <th className="pb-3 font-medium text-gray-700 dark:text-gray-300">変更後</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(editedRequired).map(([day, newCount]) => {
                    const original = originalRequired[day] ?? 0;
                    if (newCount === original) return null;

                    return (
                      <tr key={day} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                        <td className="py-3">{getJapaneseWeekday(day)}</td>
                        <td className="py-3 text-gray-500 dark:text-gray-400">{original}人</td>
                        <td className="py-3 font-bold text-blue-600 dark:text-blue-400">{newCount}人</td>
                      </tr>
                    );
                  })}
                  {Object.keys(editedRequired).every(day => editedRequired[day] === originalRequired[day]) && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-gray-500 dark:text-gray-400">
                        変更内容がありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={loading}
                className={`px-5 py-2.5 rounded-lg text-white transition-colors ${
                  loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {loading ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}