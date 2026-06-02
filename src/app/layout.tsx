import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./providers/SupabaseProvider";
import { Toaster } from 'react-hot-toast';
import MuiProvider from "./providers/MuiProvider";

export const metadata: Metadata = {
  title: "シフト管理システム",
  description: "店長向けシフト管理ポータル",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <MuiProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster position="top-center" toastOptions={{
            duration: 3000,
            style: { borderRadius: '10px', background: '#333', color: '#fff' },
          }} />
        </MuiProvider>
      </body>
    </html>
  );
}