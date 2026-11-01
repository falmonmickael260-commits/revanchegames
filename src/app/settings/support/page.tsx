import { Suspense } from "react";
import { SupportDesk } from "@/components/support/SupportDesk";

async function Content({ searchParams }: { searchParams: Promise<{ transaction?: string }> }) {
  const params = await searchParams;
  return <SupportDesk transaction={typeof params.transaction === "string" ? params.transaction.slice(0, 160) : ""} />;
}
export default function SupportPage(props: { searchParams: Promise<{ transaction?: string }> }) {
  return <Suspense fallback={<p className="p-8 text-text-dim">Chargement de l’assistance…</p>}><Content {...props} /></Suspense>;
}
