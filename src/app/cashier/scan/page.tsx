"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function CashierScanRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cashier/reservations?scan=true");
  }, [router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-muted">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm font-semibold">Mengalihkan ke Halaman Reservasi...</p>
    </div>
  );
}
