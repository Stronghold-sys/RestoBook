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

  // Cashier name is only relevant for dine_in and takeaway orders (not delivery/online)
  const isInPersonOrder = order?.order_type === 'dine_in' || order?.order_type === 'takeaway';

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("restaurant_settings").select("*").single();
      if (data) setSettings(data);
    };
    fetchSettings();

    // Auto-fetch cashier name only for in-person orders and only for kasir copies
    // (to avoid showing customer's own name as cashier in their receipt)
    if (!initialCashierName && isKasirCopy && isInPersonOrder) {
      const fetchCurrentCashier = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data } = await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).single();
          if (data) setResolvedCashierName(data.full_name);
        }
      };
      fetchCurrentCashier();
    }
  }, [initialCashierName, isKasirCopy, isInPersonOrder]);

  const subtotal = orderItems.reduce((sum: number, item: any) => {
    const itemPrice = Number(item.price || item.menu_items?.price || 0);
    const itemQty = Number(item.quantity || item.qty || 0);
    const itemSubtotal = item.subtotal !== undefined && item.subtotal !== null && !isNaN(Number(item.subtotal))
      ? Number(item.subtotal)
      : itemPrice * itemQty;
    return sum + itemSubtotal;
  }, 0);
  const totalAmount = Number(order.total_amount);
  const kembalian = cashReceived ? Math.max(0, cashReceived - totalAmount) : 0;
  const taxPercent = settings?.tax_percent !== undefined && settings?.tax_percent !== null ? Number(settings.tax_percent) : 10.00;
  const taxAmount = Math.round(subtotal * taxPercent / (100 + taxPercent));

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
            font-family: 'Courier New', Courier, monospace !important;
          }
          .receipt-container {
            width: 80mm !important;
            padding: 4mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            background: white !important;
          }
          .receipt-brand-name {
            color: #ff5722 !important;
            font-size: 24px !important;
            font-weight: bold !important;
          }
          .dashed-line {
            border-bottom: 1.5px dashed #333 !important;
            margin: 8px 0 !important;
            width: 100% !important;
          }
          .flex-row {
            display: flex !important;
            justify-content: space-between !important;
            width: 100% !important;
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
        .dashed-line {
          border-bottom: 1.5px dashed #ccc;
          margin: 12px 0;
        }
      `}} />
      {/* Header */}
      <div className="text-center mb-4 relative" style={{ textAlign: 'center' }}>
        {isKasirCopy && (
          <div className="absolute top-0 right-0 font-black text-[10px] bg-gray-200 px-2 py-1 rounded">COPY KASIR</div>
        )}
        <div className="flex items-center justify-center gap-2 mb-2" style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
          <Utensils className="w-8 h-8 text-orange-500" />
        </div>
        <h1 
          className="text-2xl font-extrabold tracking-wider receipt-brand-name"
          style={{ color: '#ff5722', fontSize: '24px', fontWeight: 'bold', margin: '0' }}
        >
          {settings?.name || "RestoBook"}
        </h1>
        <p className="text-xs text-gray-600 font-bold mt-2" style={{ fontSize: '11px', margin: '4px 0' }}>{settings?.address || "Alamat belum diatur"}</p>
        <p className="text-xs text-gray-600 font-bold" style={{ fontSize: '11px' }}>Tel: {settings?.phone || "-"}</p>
      </div>

      <div className="dashed-line" />

      {/* Info Section */}
      <div className="mb-4 text-xs space-y-1.5" style={{ fontSize: '12px' }}>
        <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#666' }}>No. Pesanan:</span>
          <span className="font-bold">#{order.id?.substring(0, 8).toUpperCase()}</span>
        </div>
        <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#666' }}>Tanggal:</span>
          <span>{new Date(order.created_at || new Date()).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })} WIB</span>
        </div>
        <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#666' }}>Pelanggan:</span>
          <span className="font-bold uppercase">{customerName}</span>
        </div>
        <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#666' }}>Tipe:</span>
          <span className="font-bold uppercase">
            {order.order_type === "dine_in" ? "Dine In" : order.order_type === "delivery" ? "Delivery" : "Takeaway"}
          </span>
        </div>
        <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#666' }}>Pembayaran:</span>
          <span className="font-bold uppercase">
            {(order.order_type === "dine_in" || order.order_type === "takeaway")
              ? "Non-Tunai"
              : (order.payment_method === "cash" ? "Tunai" : "Non-Tunai")}
          </span>
        </div>
        <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#666' }}>Status:</span>
          <span className={`font-bold uppercase`} style={{ color: order.payment_status === "paid" ? "#059669" : "#d97706" }}>
            {order.payment_status === "paid" ? "LUNAS" : "PENDING"}
          </span>
        </div>
        {isInPersonOrder && resolvedCashierName && (
          <div className="flex justify-between flex-row pt-1.5 mt-1.5 border-t border-gray-100" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666' }}>Kasir:</span>
            <span className="font-bold uppercase">{resolvedCashierName}</span>
          </div>
        )}
      </div>

      <div className="dashed-line" />

      {/* Items Section */}
      <div className="mb-4">
        <div className="flex justify-between flex-row text-[10px] font-black mb-3 text-gray-400 uppercase tracking-widest" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#999', marginBottom: '12px' }}>
          <span>ITEM</span>
          <span>SUBTOTAL</span>
        </div>
        {orderItems.map((item: any, i: number) => {
          const itemPrice = Number(item.price || item.menu_items?.price || 0);
          const itemQty = Number(item.quantity || item.qty || 0);
          const itemSubtotal = item.subtotal !== undefined && item.subtotal !== null && !isNaN(Number(item.subtotal))
            ? Number(item.subtotal)
            : itemPrice * itemQty;
          return (
            <div key={i} className="mb-3">
              <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="font-bold text-xs leading-tight flex-1 pr-4" style={{ fontWeight: 'bold', fontSize: '12px' }}>{item.menu_items?.name || item.name}</span>
                <span className="font-black" style={{ fontWeight: '900' }}>Rp {itemSubtotal.toLocaleString("id-ID")}</span>
              </div>
              <p className="text-[10px] text-gray-500 font-bold mt-0.5" style={{ fontSize: '10px', color: '#666', margin: '2px 0' }}>{itemQty}x @ Rp {itemPrice.toLocaleString("id-ID")}</p>
            </div>
          );
        })}
      </div>

      <div className="dashed-line" />

      {/* Totals Section */}
      <div className="space-y-1.5" style={{ marginTop: '8px' }}>
        <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span>Subtotal:</span>
          <span className="font-bold">Rp {subtotal.toLocaleString("id-ID")}</span>
        </div>
        {order.discount > 0 && (
          <>
            <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#059669' }}>
              <span>Potongan Voucher:</span>
              <span className="font-bold">-Rp {Number(order.discount).toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#059669' }}>
              <span>Total Dihemat:</span>
              <span className="font-bold">Rp {Number(order.discount).toLocaleString("id-ID")}</span>
            </div>
          </>
        )}
        <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span>Pajak ({taxPercent}%):</span>
          <span className="font-bold">Rp {taxAmount.toLocaleString("id-ID")} (Termasuk)</span>
        </div>
        
        <div className="h-[2px] bg-black my-2" style={{ height: '2px', backgroundColor: '#000', margin: '8px 0' }} />
        
        <div className="flex justify-between flex-row py-1 items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-sm font-black" style={{ fontSize: '14px', fontWeight: '900' }}>TOTAL:</span>
          <span className="text-lg font-black" style={{ fontSize: '18px', fontWeight: '900' }}>Rp {totalAmount.toLocaleString("id-ID")}</span>
        </div>

        {cashReceived && cashReceived > 0 && (
          <div className="mt-4 space-y-1 pt-3 border-t border-dashed border-gray-200" style={{ marginTop: '16px', borderTop: '1px dashed #eee', paddingTop: '12px' }}>
            <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: '#666' }}>Tunai Diterima:</span>
              <span className="font-bold">Rp {cashReceived.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between flex-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: '#666' }}>Kembalian:</span>
              <span className="font-bold">Rp {kembalian.toLocaleString("id-ID")}</span>
            </div>
          </div>
        )}
      </div>

      <div className="dashed-line" style={{ marginTop: '16px' }} />

      {/* Status Badge */}
      <div className="text-center my-4" style={{ textAlign: 'center', margin: '16px 0' }}>
        <div 
          className="inline-block px-8 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border-2"
          style={{ 
            display: 'inline-block',
            padding: '8px 32px',
            borderRadius: '999px',
            fontSize: '10px',
            fontWeight: '900',
            border: `2px solid ${order.payment_status === "paid" ? "#d1fae5" : "#fee2e2"}`,
            backgroundColor: order.payment_status === "paid" ? "#f0fdf4" : "#fef2f2",
            color: order.payment_status === "paid" ? "#15803d" : "#b91c1c"
          }}
        >
          {order.payment_status === "paid" ? "LUNAS" : "BELUM LUNAS"}
        </div>
      </div>

      {/* Footer Section */}
      <div className="text-center mt-6 space-y-2 pt-4 border-t border-dashed border-gray-300" style={{ textAlign: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed #ccc' }}>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest" style={{ fontSize: '11px', fontWeight: 'bold', color: '#000' }}>Terima kasih telah berkunjung!</p>
        {!isKasirCopy && (
          <div className="bg-gray-100 py-1 rounded text-[10px] font-bold" style={{ backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '4px', fontSize: '10px' }}>
            Simpan kwitansi ini sebagai bukti pembayaran
          </div>
        )}
        <p className="text-[9px] text-gray-400 font-medium mt-4" style={{ fontSize: '9px', color: '#999', marginTop: '16px' }}>
          RestoBook POS System • {new Date().getFullYear()}
        </p>
      </div>
      </div>
  );
});

Receipt.displayName = "Receipt";
export default Receipt;
