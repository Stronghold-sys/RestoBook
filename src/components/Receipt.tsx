"use client";

import { forwardRef, useEffect, useState } from "react";
import { Utensils } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";

interface ReceiptProps {
  order: any;
  orderItems: any[];
  customerName: string;
  cashierName?: string;
  cashReceived?: number;
  isKasirCopy?: boolean;
}

const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ order, orderItems, customerName, cashierName: initialCashierName, cashReceived, isKasirCopy }, ref) => {
  const [settings, setSettings] = useState<any>(null);
  const [resolvedCashierName, setResolvedCashierName] = useState(initialCashierName);
  const supabase = createClient();

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("restaurant_settings").select("*").single();
      if (data) setSettings(data);
    };
    fetchSettings();

    // If no cashier name provided but it's a cashier/admin copy, try to fetch current user
    if (!initialCashierName) {
      const fetchCurrentCashier = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data } = await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).single();
          if (data) setResolvedCashierName(data.full_name);
        }
      };
      fetchCurrentCashier();
    }
  }, [initialCashierName]);

  const subtotal = orderItems.reduce((sum: number, item: any) => sum + Number(item.subtotal), 0);
  const totalAmount = Number(order.total_amount);
  const kembalian = cashReceived ? Math.max(0, cashReceived - totalAmount) : 0;

  return (
    <div ref={ref} className="bg-white text-black p-8 w-[380px] mx-auto font-mono text-sm receipt-font receipt-container border border-gray-100 shadow-sm overflow-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .receipt-container {
            width: 80mm !important;
            padding: 5mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: black !important;
            display: block !important;
            background: white !important;
          }
          .receipt-brand-name {
            color: #ff5722 !important; /* Brand Color for Print */
          }
          .no-print {
            display: none !important;
          }
          * {
            box-sizing: border-box !important;
          }
        }
        .receipt-font {
          font-family: 'Courier New', Courier, monospace;
        }
      `}} />
      {/* Header */}
      <div className="text-center mb-6 border-b-2 border-dashed border-gray-300 pb-6 relative">
        {isKasirCopy && (
          <div className="absolute top-0 right-0 font-black text-[10px] bg-gray-200 px-2 py-1 rounded">COPY KASIR</div>
        )}
        <div className="flex items-center justify-center gap-2 mb-2">
          <Utensils className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-wider text-primary receipt-brand-name">{settings?.name || "RestoBook"}</h1>
        <p className="text-xs text-gray-600 font-bold mt-2">{settings?.address || "Alamat belum diatur"}</p>
        <p className="text-xs text-gray-600 font-bold">Tel: {settings?.phone || "-"}</p>
      </div>

        {/* Info */}
        <div className="mb-4 text-xs space-y-1.5 border-b border-dashed border-gray-300 pb-4">
          <div className="flex justify-between"><span className="text-gray-500">No. Pesanan:</span><span className="font-bold">#{order.id?.substring(0, 8).toUpperCase()}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Tanggal:</span><span>{format(new Date(order.created_at || new Date()), "dd MMM yyyy, HH:mm", { locale: localeId })}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Pelanggan:</span><span className="font-bold uppercase">{customerName}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Tipe:</span><span className="font-bold uppercase">{order.order_type === "dine_in" ? "Dine In" : "Takeaway"}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Pembayaran:</span><span className="font-bold uppercase">
            {order.notes?.includes("[METODE:")
              ? order.notes.split("[METODE:")[1].split("]")[0]
              : order.payment_method}
          </span></div>
          <div className="flex justify-between"><span className="text-gray-500">Status:</span><span className={`font-bold uppercase ${order.payment_status === "paid" ? "text-green-600" : "text-amber-600"}`}>
            {order.payment_status === "paid" ? "LUNAS" : "PENDING"}
          </span></div>
          {resolvedCashierName && <div className="flex justify-between border-t border-gray-100 pt-1.5 mt-1.5"><span className="text-gray-500">Kasir:</span><span className="font-bold uppercase">{resolvedCashierName}</span></div>}
        </div>

        {/* Items */}
        <div className="mb-4 border-b border-dashed border-gray-300 pb-4">
          <div className="flex justify-between text-[10px] font-black mb-3 text-gray-400 uppercase tracking-widest">
            <span>Item</span><span>Subtotal</span>
          </div>
          {orderItems.map((item: any, i: number) => {
            const itemPrice = Number(item.price || item.menu_items?.price || 0);
            return (
              <div key={i} className="mb-3">
                <div className="flex justify-between">
                  <span className="font-bold text-xs leading-tight flex-1 pr-4">{item.menu_items?.name || item.name}</span>
                  <span className="font-black">Rp {Number(item.subtotal).toLocaleString("id-ID")}</span>
                </div>
                <p className="text-[10px] text-gray-500 font-bold mt-0.5">{item.quantity}x @ Rp {itemPrice.toLocaleString("id-ID")}</p>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="mb-4 border-b border-dashed border-gray-300 pb-4 text-xs space-y-1.5">
          <div className="flex justify-between"><span>Subtotal:</span><span className="font-bold">Rp {subtotal.toLocaleString("id-ID")}</span></div>
          <div className="flex justify-between text-gray-500"><span>Pajak & Layanan:</span><span>Termasuk</span></div>
          {order.discount && order.discount > 0 && (
            <div className="flex justify-between text-green-600"><span>Diskon:</span><span>-Rp {Number(order.discount).toLocaleString("id-ID")}</span></div>
          )}
          <div className="flex justify-between text-lg font-black mt-3 pt-3 border-t-2 border-gray-900">
            <span>TOTAL:</span><span>Rp {totalAmount.toLocaleString("id-ID")}</span>
          </div>
          
          {cashReceived && cashReceived > 0 && (
            <>
              <div className="flex justify-between mt-3 pt-3 border-t border-dashed border-gray-200">
                <span className="text-gray-500">Tunai Diterima:</span><span className="font-bold">Rp {cashReceived.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Kembalian:</span><span className="font-bold">Rp {kembalian.toLocaleString("id-ID")}</span>
              </div>
            </>
          )}
        </div>

        {/* Status Badge in Receipt */}
        <div className="text-center mb-6">
          <div className={`inline-block px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border-2 ${order.payment_status === "paid" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {order.payment_status === "paid" ? "LUNAS" : "BELUM LUNAS"}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-gray-400 pt-5 border-t border-dashed border-gray-300">
          <p className="font-black text-gray-800 text-xs uppercase tracking-widest">Terima kasih telah berkunjung!</p>
          {!isKasirCopy && <p className="mt-1.5 font-bold">Simpan kwitansi ini sebagai bukti pembayaran</p>}
          <div className="mt-4 opacity-20 font-black text-[8px] uppercase tracking-[0.3em]">
             RestoBook POS System • {new Date().getFullYear()}
          </div>
        </div>
      </div>
  );
});

Receipt.displayName = "Receipt";
export default Receipt;
