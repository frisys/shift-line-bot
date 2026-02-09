// components/LoadingOverlay.tsx
'use client';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export default function LoadingOverlay({ isLoading, message = '読み込み中...' }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-gray-200 dark:border-gray-600 animate-spin"></div>
        </div>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-200">{message}</p>
      </div>
    </div>
  );
}