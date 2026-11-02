import { Suspense } from "react";
import { MessagesView } from "@/components/messages/MessagesView";
export default function MessagesPage() { return <Suspense fallback={<div className="rg-page">Chargement des conversations…</div>}><MessagesView /></Suspense>; }
