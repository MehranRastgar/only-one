'use client';

import { ThemeProvider } from 'next-themes';
import { ClientProvider } from '@/components/client-provider';
import { Toaster } from 'sonner';

export function RootWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ClientProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster />
      </ThemeProvider>
    </ClientProvider>
  );
} 