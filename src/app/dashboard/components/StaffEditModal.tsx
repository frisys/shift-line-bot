// components/StaffEditModal.tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Staff } from '@/types';

interface StaffEditModalProps {
  staff: Staff;
  onClose: () => void;
//   onSave: (updated: Staff) => void;
}

export default function StaffEditModal({ staff, onClose }: StaffEditModalProps) {
  const [formData, setFormData] = useState<Staff>({ ...staff });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('max_') ? parseInt(value) || null : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // profiles更新（名前、連勤日数など）
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
        })
        .eq('id', formData.id);

      if (profileError) throw profileError;

      // user_stores更新（role）
      const { error: storesError  } = await supabase
        .from('user_stores')
        .update({
        role: formData.role,
        max_consecutive_days: formData.max_consecutive_days,
        max_weekly_days: formData.max_weekly_days,
        unavailable_days: formData.unavailable_days,
        preferred_time_slots: formData.preferred_time_slots,
        })
        .eq('user_id', formData.id)
        .eq('store_id', formData.store_id);  // 店舗指定で更新（複数店舗対応）

      if (storesError ) throw storesError ;

      toast.success('スタッフ情報を更新しました！');
    //   onSave(formData);
      onClose();
    } catch (err: unknown) {
      toast.error('更新に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            スタッフ編集: {staff.name || '未設定'}
          </h3>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              名前
            </label>
            <input
              type="text"
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              役割
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="staff">スタッフ</option>
              <option value="manager">店長</option>
              <option value="admin">管理者</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                最大連勤日数
              </label>
              <input
                type="number"
                name="max_consecutive_days"
                value={formData.max_consecutive_days ?? ''}
                onChange={handleChange}
                min="1"
                max="7"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                週最大日数
              </label>
              <input
                type="number"
                name="max_weekly_days"
                value={formData.max_weekly_days ?? ''}
                onChange={handleChange}
                min="1"
                max="7"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2.5 rounded-lg text-white transition-colors ${
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