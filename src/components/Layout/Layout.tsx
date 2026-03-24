import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto w-full px-6 py-12 flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
