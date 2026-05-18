'use client';

import { useState, useEffect } from 'react';
import { Store } from '@/types';
import toast from 'react-hot-toast';
import { updateTimeSlots } from '@/services';

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
  }, [store.id]);

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || slots.includes(trimmed)) return;
    setSlots(prev => [...prev, trimmed]);
    setInputValue('');
    setDirty(true);
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
      toast.success('勤務区分を保存しました', {
        icon: '✅',
        style: { border: '1px solid #10B981', padding: '16px', color: '#10B981' },
      });
    } catch {
      toast.error('保存に失敗しました', {
        style: { border: '1px solid #EF4444', padding: '16px', color: '#EF4444' },
      });
    } finally {
      setLoading(false);
    }
  };

  const isDuplicateInput = slots.includes(inputValue.trim()) && inputValue.trim() !== '';

  return (
    <section className="mt-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-700">勤務区分の設定</h2>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-500">
            LINEでスタッフが選択できる勤務区分を設定します。並び順はそのまま反映されます。
          </p>
        </div>

        <div className="p-5">
          {/* 区分タグ一覧 */}
          <div className="flex flex-wrap gap-2 mb-4 min-h-[36px]">
            {slots.map(slot => (
              <span
                key={slot}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-sm font-medium"
              >
                {slot}
                <button
                  onClick={() => handleDelete(slot)}
                  className="text-blue-300 hover:text-red-500 transition-colors font-bold text-base leading-none ml-0.5"
                  aria-label={`${slot}を削除`}
                >
                  ×
                </button>
              </span>
            ))}
            {slots.length === 0 && (
              <span className="text-gray-400 text-sm">勤務区分がありません。追加してください。</span>
            )}
          </div>

          {/* 追加フォーム */}
          <div className="flex gap-2 items-start">
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                placeholder="例: 早番"
                className={`border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 transition-colors w-36 ${
                  isDuplicateInput
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                maxLength={10}
              />
              {isDuplicateInput && (
                <span className="text-xs text-red-500">すでに登録済みです</span>
              )}
            </div>
            <button
              onClick={handleAdd}
              disabled={!inputValue.trim() || isDuplicateInput}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              追加
            </button>
          </div>

          {/* 保存ボタン（変更時のみ表示） */}
          {dirty && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={handleSave}
                disabled={loading}
                className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {loading ? '保存中...' : '保存する'}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
