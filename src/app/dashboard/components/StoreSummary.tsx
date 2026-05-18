// components/StoreSummary.tsx
'use client';

import { useState, useEffect } from 'react';
import { Store } from '@/types';
import toast from 'react-hot-toast';
import { DAYS_ORDER, getJapaneseWeekday } from '@/constants';
import { updateRequiredStaff } from '@/services';
import ShiftSlotsSettings from './ShiftSlotsSettings';

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
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-6 text-gray-700">店舗情報</h2>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{store.name}</h3>
              <p className="text-sm text-gray-600">
                店舗コード（スタッフに伝えてください）：
                <span className="ml-2 font-mono text-lg font-bold text-blue-600 tracking-widest">
                  {store.store_code || '未設定'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  編集
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={loading || !hasChanges()}
                    className={`px-5 py-2.5 rounded-lg font-medium text-white transition-colors ${
                      loading || !hasChanges() ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {loading ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 必要人数テーブル */}
        <div className="p-6">
          <p className="text-sm font-medium text-gray-700 mb-3">曜日ごとの必要人数（勤務区分別）</p>
          {slots.length === 0 ? (
            <div className="rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-400">
              下の「勤務区分の設定」で勤務区分を追加すると、ここで曜日ごとに必要人数を設定できます。
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5 border-b border-r border-gray-200 min-w-[90px]">
                      勤務区分
                    </th>
                    {DAYS_ORDER.map(({ eng, ja }) => {
                      const isWeekend = eng === 'sun' || eng === 'sat';
                      return (
                        <th
                          key={eng}
                          className={`text-center text-xs font-medium px-2 py-2.5 border-b border-gray-200 min-w-[52px] ${
                            eng === 'sun' ? 'text-red-500' : eng === 'sat' ? 'text-blue-500' : 'text-gray-500'
                          } ${isWeekend ? 'bg-gray-100' : ''}`}
                        >
                          {ja}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {slots.map(slot => (
                    <tr key={slot} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap">
                        {slot}
                      </td>
                      {DAYS_ORDER.map(({ eng }) => {
                        const count = getCount(eng, slot);
                        const isChanged = count !== getOriginal(eng, slot);
                        const isWeekend = eng === 'sun' || eng === 'sat';
                        return (
                          <td key={eng} className={`px-2 py-2 text-center ${isWeekend ? 'bg-gray-50' : ''}`}>
                            {isEditing ? (
                              <input
                                type="number"
                                value={count}
                                onChange={(e) => handleInputChange(eng, slot, e.target.value)}
                                className={`w-10 text-center text-sm font-bold border-b-2 bg-transparent focus:outline-none transition-colors mx-auto block ${
                                  isChanged
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-gray-300 text-gray-800'
                                }`}
                                min="0"
                                max="20"
                              />
                            ) : (
                              <span
                                onClick={() => setIsEditing(true)}
                                className={`cursor-pointer text-sm font-bold block text-center ${
                                  count > 0 ? 'text-gray-800' : 'text-gray-300'
                                }`}
                              >
                                {count > 0 ? count : '-'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ShiftSlotsSettings store={store} />

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">変更を確認</h3>
              <p className="mt-2 text-gray-600 text-sm">以下の設定を変更します。よろしいですか？</p>
            </div>
            <div className="p-6 max-h-80 overflow-y-auto">
              {changedCells.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-4">変更内容がありません</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-2 font-medium text-gray-700">曜日・区分</th>
                      <th className="pb-2 font-medium text-gray-700">変更前</th>
                      <th className="pb-2 font-medium text-gray-700">変更後</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changedCells.map(({ day, slot, orig, next }) => (
                      <tr key={`${day}-${slot}`} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2 text-gray-700">{getJapaneseWeekday(day)}・{slot}</td>
                        <td className="py-2 text-gray-400">{orig}人</td>
                        <td className="py-2 font-bold text-blue-600">{next}人</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={loading}
                className={`px-5 py-2.5 rounded-lg text-white text-sm transition-colors ${
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
