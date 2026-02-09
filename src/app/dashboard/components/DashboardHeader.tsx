// components/DashboardHeader.tsx
import { User } from '@/types/user';
import { Store } from '@/types/store';

interface DashboardProps {
    user: User;
    stores: Store[];
    selectedStoreId: string | null;
    setSelectedStoreId: (id: string) => void;
}

export default function DashboardHeader({ user, stores, selectedStoreId, setSelectedStoreId }: DashboardProps) {
  const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedStoreId(id);
    localStorage.setItem('selectedStoreId', id);
  };

  return (
    <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ダッシュボード</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            ようこそ、{user.email}さん
          </p>
        </div>

        {stores.length > 1 && (
          <div className="w-full md:w-64">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              表示店舗を選択
            </label>
            <select
              value={selectedStoreId || ''}
              onChange={handleStoreChange}
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {stores.map(store => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}