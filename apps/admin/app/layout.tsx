import type { Metadata } from 'next';
import './style.css';
export const metadata: Metadata = { title: 'Administration · Revanche Games', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
