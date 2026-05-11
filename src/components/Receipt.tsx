"use client";

import { forwardRef } from "react";
import { Utensils } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface ReceiptProps {
  order: any;
  orderItems: any[];
  customerName: string;
  cashierName?: string;
  cashReceived?: number;
  isKasirCopy?: boolean;
}

const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ order, orderItems, customerName, cashierName, cashReceived, isKasirCopy }, ref) => {
  const subtotal = orderItems.reduce((sum: number, item: any) => sum + Number(item.subtotal), 0);
  const totalAmount = Number(order.total_amount);
  const kembalian = cashReceived ? Math.max(0, cashReceived - totalAmount) : 0;

  return (
    <div ref={ref} className="bg-white text-black p-8 max-w-[380px] mx-auto font-mono text-sm receipt-font">
      {/* Header */}
      <div className="text-center mb-6 border-b-2 border-dashed border-gray-300 pb-6 relative">
        {isKasirCopy && (
          <div className="absolute top-0 right-0 font-black text-[10px] bg-gray-200 px-2 py-1 rounded">COPY KASIR</div>
        )}
        <div className="flex items-center justify-center gap-2 mb-2">
          <Utensils className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-wider text-gray-900">RestoBook</h1>
        <p className="text-xs text-gray-500 mt-1">Sistem Pemesanan Restoran</p>
        <p className="text-xs text-gray-500">Jl. Contoh No. 123, Jakarta</p>
        <p className="text-xs text-gray-500">Tel: 021-12345678</p>
      </div>

      {/* Info */}
      <div className="mb-4 text-xs space-y-1 border-b border-dashed border-gray-300 pb-4">
        <div className="flex justify-between"><span className="text-gray-500">No. Pesanan:</span><span className="font-bold">#{order.id?.split("-")[0]}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Tanggal:</span><span>{format(new Date(order.created_at || new Date()), "dd MMM yyyy, HH:mm", { locale: localeId })}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Pelanggan:</span><span className="font-bold">{customerName}</span></div>
        {cashierName && <div className="flex justify-between"><span className="text-gray-500">Kasir:</span><span>{cashierName}</span></div>}
        <div className="flex justify-between"><span className="text-gray-500">Tipe:</span><span>{order.order_type === "dine_in" ? "Dine In" : "Takeaway"}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Pembayaran:</span><span className="font-bold uppercase">
          {order.notes?.includes("[METODE:")
            ? order.notes.split("[METODE:")[1].split("]")[0]
            : order.payment_method}
        </span></div>
        <div className="flex justify-between"><span className="text-gray-500">Status:</span><span className={`font-bold uppercase ${order.payment_status === "paid" ? "text-green-600" : "text-amber-600"}`}>
          {order.payment_status === "paid" ? "LUNAS" : "PENDING"}
        </span></div>
      </div>

      {/* Items */}
      <div className="mb-4 border-b border-dashed border-gray-300 pb-4">
        <div className="flex justify-between text-xs font-bold mb-2 text-gray-600 uppercase">
          <span>Item</span><span>Subtotal</span>
        </div>
        {orderItems.map((item: any, i: number) => (
          <div key={i} className="mb-2">
            <div className="flex justify-between">
              <span className="font-medium">{item.menu_items?.name || item.name}</span>
              <span className="font-bold">Rp {Number(item.subtotal).toLocaleString("id-ID")}</span>
            </div>
            <p className="text-xs text-gray-400">{item.quantity}x @ Rp {Number(item.price).toLocaleString("id-ID")}</p>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mb-4 border-b border-dashed border-gray-300 pb-4 text-xs space-y-1">
        <div className="flex justify-between"><span>Subtotal:</span><span>Rp {subtotal.toLocaleString("id-ID")}</span></div>
        <div className="flex justify-between"><span>Pajak & Layanan:</span><span>Termasuk</span></div>
        {order.discount && order.discount > 0 && (
          <div className="flex justify-between text-green-600"><span>Diskon:</span><span>-Rp {Number(order.discount).toLocaleString("id-ID")}</span></div>
        )}
        <div className="flex justify-between text-base font-extrabold mt-2 pt-2 border-t border-gray-300">
          <span>TOTAL:</span><span>Rp {totalAmount.toLocaleString("id-ID")}</span>
        </div>
        
        {cashReceived && cashReceived > 0 && (
          <>
            <div className="flex justify-between mt-2 pt-2 border-t border-dashed border-gray-200">
              <span className="text-gray-500">Tunai Diterima:</span><span>Rp {cashReceived.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Kembalian:</span><span>Rp {kembalian.toLocaleString("id-ID")}</span>
            </div>
          </>
        )}
      </div>

      {/* Status */}
      <div className="text-center mb-4">
        <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${order.payment_status === "paid" ? "bg-green-100 text-green-700 border border-green-300" : "bg-red-100 text-red-700 border border-red-300"}`}>
          {order.payment_status === "paid" ? "LUNAS" : "BELUM LUNAS"}
        </span>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 pt-4 border-t border-dashed border-gray-300">
        <p className="font-medium text-gray-600">Terima kasih telah berkunjung!</p>
        {!isKasirCopy && <p className="mt-1">Simpan kwitansi ini sebagai bukti pembayaran</p>}
        <p className="mt-2"> {new Date().getFullYear()} RestoBook</p>
      </div>
    </div>
  );
});

Receipt.displayName = "Receipt";
export default Receipt;
