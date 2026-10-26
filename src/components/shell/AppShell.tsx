import { Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { AuthHashErrorRedirect } from "@/components/auth/AuthHashErrorRedirect";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-void">
      <div className="rg-grain" />
      <AuthHashErrorRedirect />
      <Sidebar />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-[64px] border-b border-border-soft bg-void/80" />}>
          <Header />
        </Suspense>
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
