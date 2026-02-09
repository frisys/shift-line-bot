// components/StaffList.tsx
import { useState } from 'react';
import StaffEditModal from './StaffEditModal'; // 次で作る
import { Staff } from '@/types';

interface StaffListProps {
  staff: Staff[];
}

export default function StaffList({ staff }: StaffListProps) {
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const handleEdit = (s: Staff) => {
    setEditingStaff(s);
  };

  const handleCloseModal = () => {
    setEditingStaff(null);
  };

  const handleSave = (updatedStaff: Staff) => {
    // 親コンポーネントに更新を伝える（またはここでsetStaff）
    // 今回は親にコールバック渡す想定で
    // onStaffUpdate?.(updatedStaff);
    setEditingStaff(null);
  };
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">スタッフ一覧</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {staff.length}名
        </span>
      </div>

      {staff.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            この店舗にはスタッフが登録されていません
          </p>
          <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
            スタッフを追加してシフト管理を始めましょう
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  名前
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  役割
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  最大連勤
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  週最大
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  苦手曜日
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {staff.map(s => {

                return (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {s.name || '未設定'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      s.role === 'manager' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {s.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {s.max_consecutive_days ?? '-'}日
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {s.max_weekly_days ?? '-'}日
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {s.unavailable_days?.join(', ') || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleEdit(s)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      編集
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {/* 編集モーダル */}
      {editingStaff && (
        <StaffEditModal
          staff={editingStaff}
          onClose={handleCloseModal}
          // onSave={handleSave}
        />
      )}
    </section>
  );
}