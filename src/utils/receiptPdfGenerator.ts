import jsPDF from "jspdf";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { downloadFile } from "./downloadHelper";
import { createClient } from "@/lib/supabase/client";

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export async function downloadReceiptPDF({
  order,
  orderItems,
  customerName,
  cashierName,
  settings,
}: {
  order: any;
  orderItems: OrderItem[];
  customerName: string;
  cashierName?: string;
  settings?: any;
}) {
  let activeSettings = settings;
  if (!activeSettings) {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("restaurant_settings").select("*").single();
      if (data) activeSettings = data;
    } catch (e) {
      console.error("Error fetching settings for PDF:", e);
    }
  }

  const restoName = activeSettings?.name || "RestoBook";
  const address = activeSettings?.address || "Alamat belum diatur";
  const phone = activeSettings?.phone || "-";
  
  // Calculate heights dynamically
  let baseHeight = 90; // Header, info, totals, footer
  if (order.order_type === "delivery") {
    baseHeight += 35;
  }
  const itemHeight = orderItems.length * 12;
  const pageHeight = baseHeight + itemHeight;
  
  // Create jsPDF in mm (80mm wide, dynamic height)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, Math.max(150, pageHeight)],
  });

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  
  let y = 10;
  
  // Brand Header
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text(restoName, 40, y, { align: "center" });
  
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  y += 5;
  doc.text(address, 40, y, { align: "center", maxWidth: 70 });
  y += 4;
  doc.text(`Tel: ${phone}`, 40, y, { align: "center" });
  
  y += 3;
  doc.text("------------------------------------------", 40, y, { align: "center" });
  
  // Info
  y += 4;
  doc.setFont("courier", "bold");
  doc.text(`No. Pesanan: #${order.id?.substring(0, 8).toUpperCase()}`, 5, y);
  
  doc.setFont("courier", "normal");
  y += 4;
  const dateStr = format(new Date(order.created_at || new Date()), "dd MMM yyyy, HH:mm", { locale: localeId }) + " WIB";
  doc.text(`Tanggal: ${dateStr}`, 5, y);
  
  y += 4;
  doc.text(`Pelanggan: ${customerName.toUpperCase()}`, 5, y);
  
  y += 4;
  const typeStr = order.order_type === "dine_in" ? "Dine In" : order.order_type === "delivery" ? "Delivery" : "Takeaway";
  doc.text(`Tipe: ${typeStr}`, 5, y);
  
  y += 4;
  const payStr = (order.order_type === "dine_in" || order.order_type === "takeaway")
    ? "Non-Tunai"
    : (order.payment_method === "cash" ? "Tunai" : "Non-Tunai");
  doc.text(`Pembayaran: ${payStr}`, 5, y);
  
  y += 4;
  const statusStr = order.payment_status === "paid" ? "LUNAS" : "PENDING";
  doc.text(`Status: ${statusStr}`, 5, y);
  
  if (cashierName) {
    y += 4;
    doc.text(`Kasir: ${cashierName.toUpperCase()}`, 5, y);
  }

  if (order.order_type === "delivery") {
    y += 4;
    doc.text(`Penerima: ${order.delivery_recipient_name?.toUpperCase() || "-"}`, 5, y);
    y += 4;
    doc.text(`No. HP: ${order.delivery_phone || "-"}`, 5, y);
    y += 4;
    doc.text(`Jarak: ${Number(order.distance_km || 0).toFixed(1)} km`, 5, y);
    y += 4;
    doc.text(`Alamat:`, 5, y);
    const fullAddress = `${order.delivery_address || ""}, Kel. ${order.delivery_village || ""}, Kec. ${order.delivery_district || ""}, ${order.delivery_regency || ""}, ${order.delivery_province || ""} ${order.delivery_postal_code || ""}`;
    const addrLines = doc.splitTextToSize(fullAddress, 70);
    addrLines.forEach((line: string) => {
      y += 3.5;
      doc.text(line, 5, y);
    });
  }
  
  y += 3;
  doc.text("------------------------------------------", 40, y, { align: "center" });
  
  // Items Header
  y += 4;
  doc.setFont("courier", "bold");
  doc.text("ITEM", 5, y);
  doc.text("SUBTOTAL", 75, y, { align: "right" });
  
  doc.setFont("courier", "normal");
  orderItems.forEach((item) => {
    y += 5;
    // Item name
    doc.setFont("courier", "bold");
    const nameTrunc = item.name.length > 25 ? item.name.substring(0, 22) + "..." : item.name;
    doc.text(nameTrunc, 5, y);
    const itemSubtotal = item.subtotal !== undefined && item.subtotal !== null && !isNaN(Number(item.subtotal))
      ? Number(item.subtotal)
      : Number(item.price || 0) * Number(item.quantity || 0);
    doc.text(`Rp ${itemSubtotal.toLocaleString("id-ID")}`, 75, y, { align: "right" });
    
    y += 4;
    doc.setFont("courier", "normal");
    doc.text(`${item.quantity}x @ Rp ${item.price.toLocaleString("id-ID")}`, 5, y);
  });
  
  y += 3;
  doc.text("------------------------------------------", 40, y, { align: "center" });
  
  // Totals
  const subtotal = orderItems.reduce((sum, item) => {
    const itemSubtotal = item.subtotal !== undefined && item.subtotal !== null && !isNaN(Number(item.subtotal))
      ? Number(item.subtotal)
      : Number(item.price || 0) * Number(item.quantity || 0);
    return sum + itemSubtotal;
  }, 0);
  const discount = Number(order.discount || 0);
  const taxPercent = settings?.tax_percent ? Number(settings.tax_percent) : 10;
  const taxAmount = Math.round(subtotal * taxPercent / (100 + taxPercent));
  const totalAmount = Number(order.total_amount);
  
  y += 4;
  doc.text(`Subtotal:`, 5, y);
  doc.text(`Rp ${subtotal.toLocaleString("id-ID")}`, 75, y, { align: "right" });
  
  if (discount > 0) {
    y += 4;
    doc.text(`Potongan Voucher:`, 5, y);
    doc.text(`-Rp ${discount.toLocaleString("id-ID")}`, 75, y, { align: "right" });
  }

  if (order.order_type === "delivery") {
    y += 4;
    doc.text(`Ongkos Kirim:`, 5, y);
    doc.text(`Rp ${Number(order.shipping_fee || 0).toLocaleString("id-ID")}`, 75, y, { align: "right" });
    
    if (Number(order.shipping_discount || 0) > 0) {
      y += 4;
      doc.text(`Potongan Ongkir:`, 5, y);
      doc.text(`-Rp ${Number(order.shipping_discount).toLocaleString("id-ID")}`, 75, y, { align: "right" });
    }
  }
  
  y += 4;
  doc.text(`Pajak (${taxPercent}%):`, 5, y);
  doc.text(`Rp ${taxAmount.toLocaleString("id-ID")} (Termasuk)`, 75, y, { align: "right" });
  
  y += 3;
  doc.text("------------------------------------------", 40, y, { align: "center" });
  
  y += 4;
  doc.setFont("courier", "bold");
  doc.text(`TOTAL:`, 5, y);
  doc.text(`Rp ${totalAmount.toLocaleString("id-ID")}`, 75, y, { align: "right" });
  
  y += 3;
  doc.setFont("courier", "normal");
  doc.text("------------------------------------------", 40, y, { align: "center" });
  
  // Footer
  y += 5;
  doc.setFont("courier", "bold");
  doc.text("Terima kasih atas kunjungan Anda!", 40, y, { align: "center" });
  
  y += 5;
  doc.setFont("courier", "normal");
  doc.setFontSize(5);
  doc.text("RestoBook POS System", 40, y, { align: "center" });
  
  // Get base64 string
  const base64Data = doc.output("datauristring");
  
  // Download it
  const filename = `Kwitansi_${order.id?.substring(0, 8).toUpperCase()}.pdf`;
  await downloadFile({
    dataBase64: base64Data,
    filename,
    mimeType: "application/pdf",
  });
}
