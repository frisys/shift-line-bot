// components/StaffEditModal.tsx
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Staff } from '@/types';
import { updateStaffProfile, updateStaffStoreSettings } from '@/services';
import { DAYS_ORDER } from '@/constants';

interface StaffEditModalProps {
  staff: Staff;
  onClose: () => void;
  onSaved: (updated: Staff) => void;
}

export default function StaffEditModal({ staff, onClose, onSaved }: StaffEditModalProps) {
  const [formData, setFormData] = useState<Staff>({ ...staff });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('max_') ? parseInt(value) || null : value,
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: profileError } = await updateStaffProfile(formData.id, {
        name: formData.name || '',
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">
            スタッフ編集: {staff.name || '未設定'}
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* 名前 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
            <input
              type="text"
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 役割 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">役割</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="staff">スタッフ</option>
              <option value="manager">店長</option>
              <option value="admin">管理者</option>
            </select>
          </div>

          {/* 勤務日数制約 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最大連勤日数</label>
              <input
                type="number"
                name="max_consecutive_days"
                value={formData.max_consecutive_days ?? ''}
                onChange={handleChange}
                min="1"
                max="7"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">週最大日数</label>
              <input
                type="number"
                name="max_weekly_days"
                value={formData.max_weekly_days ?? ''}
                onChange={handleChange}
                min="1"
                max="7"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 苦手曜日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">苦手曜日</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS_ORDER.map(({ eng, ja }) => {
                const selected = unavailableDays.includes(eng);
                return (
                  <button
                    key={eng}
                    type="button"
                    onClick={() => handleDayToggle(eng)}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-colors border ${
                      selected
                        ? 'bg-red-100 border-red-300 text-red-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {ja}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              タップして選択。苦手曜日はシフト最適化で考慮されます。
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors text-sm"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2.5 rounded-lg text-white text-sm transition-colors ${
              saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
