import { Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-void">
      <div className="rg-grain" />
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Suspense fallback={<div className="h-[64px] border-b border-border-soft bg-void/80" />}>
          <Header />
        </Suspense>
        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
