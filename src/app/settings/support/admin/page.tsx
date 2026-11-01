import { SupportDesk } from "@/components/support/SupportDesk";

// All data/actions are independently authenticated and checked by RLS/RPCs.
// Rendering this shell grants no administrator privilege.
export default function SupportAdminPage() { return <SupportDesk admin />; }
