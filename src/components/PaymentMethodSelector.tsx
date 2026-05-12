"use client";

import { useEffect, useState } from "react";
import { Loader2, ChevronRight, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

interface PaymentMethod {
  paymentMethod: string;
  paymentName: string;
  paymentImage: string;
  totalFee: string;
}

interface Props {
  amount: number;
  onSelect: (method: string) => void;
  selectedMethod?: string;
}

export default function PaymentMethodSelector({ amount, onSelect, selectedMethod }: Props) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const res = await fetch("/api/payment/methods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        });
        const data = await res.json();
        if (data.methods) {
          setMethods(data.methods);
        } else {
          toast.error("Gagal mengambil metode pembayaran");
        }
      } catch (error) {
        console.error("Fetch methods error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMethods();
  }, [amount]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted animate-pulse">Memuat metode pembayaran...</p>
      </div>
    );
  }

  // Grouping methods (Optional, for better UX)
  const categories = {
    "E-Wallet & QRIS": methods.filter(m => ["SP", "DA", "OV", "NQ", "LA"].includes(m.paymentMethod) || m.paymentName.toLowerCase().includes("qris")),
    "Virtual Account": methods.filter(m => ["VA", "BT", "B1", "M2", "I1"].includes(m.paymentMethod) || m.paymentName.toLowerCase().includes("va") || m.paymentName.toLowerCase().includes("virtual")),
    "Retail Store": methods.filter(m => ["FT", "AL"].includes(m.paymentMethod) || m.paymentName.toLowerCase().includes("alfamart") || m.paymentName.toLowerCase().includes("indomaret")),
  };

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
      {Object.entries(categories).map(([category, items]) => (
        items.length > 0 && (
          <div key={category} className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted px-2">{category}</h3>
            <div className="grid grid-cols-1 gap-2">
              {items.map((method) => (
                <button
                  key={method.paymentMethod}
                  onClick={() => onSelect(method.paymentMethod)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${
                    selectedMethod === method.paymentMethod
                      ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                      : "border-border-light dark:border-border-dark hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl p-2 flex items-center justify-center border border-gray-100 shadow-sm group-hover:scale-105 transition-transform">
                      <img src={method.paymentImage} alt={method.paymentName} className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="text-left">
                      <p className={`font-bold text-sm ${selectedMethod === method.paymentMethod ? "text-primary" : "text-text-light dark:text-text-dark"}`}>
                        {method.paymentName}
                      </p>
                      <p className="text-[10px] text-muted font-medium">
                        Biaya: {method.totalFee.includes('%') ? method.totalFee : `Rp ${Number(method.totalFee).toLocaleString("id-ID")}`}
                      </p>
                    </div>
                  </div>
                  {selectedMethod === method.paymentMethod ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted group-hover:translate-x-1 transition-transform" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
