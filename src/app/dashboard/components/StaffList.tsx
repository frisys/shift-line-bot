// components/StaffList.tsx
import { useState } from 'react';
import StaffEditModal from './StaffEditModal';
import { Staff } from '@/types';
import { STAFF_ROLE_LABELS, getJapaneseWeekday } from '@/constants';

interface StaffListProps {
  staff: Staff[];
  onStaffUpdate: (updated: Staff) => void;
}

export default function StaffList({ staff, onStaffUpdate }: StaffListProps) {
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const handleCloseModal = () => setEditingStaff(null);

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-700">スタッフ一覧</h2>
        <span className="text-sm text-gray-500">{staff.length}名</span>
      </div>

      {staff.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          この店舗にはスタッフが登録されていません
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['名前', '役割', '最大連勤', '週最大', '苦手曜日', ''].map(label => (
                  <th
                    key={label}
                    className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {s.name || '未設定'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      s.role === 'manager'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {STAFF_ROLE_LABELS[s.role as keyof typeof STAFF_ROLE_LABELS] ?? s.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {s.max_consecutive_days ?? '-'}日
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {s.max_weekly_days ?? '-'}日
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {s.unavailable_days?.map(d => getJapaneseWeekday(d)).join('・') || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => setEditingStaff(s)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      編集
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingStaff && (
        <StaffEditModal
          staff={editingStaff}
          onClose={handleCloseModal}
          onSaved={onStaffUpdate}
        />
      )}
    </section>
  );
}
