export function getPaidNotification(
  order: { id: string; total_amount: number | string; order_type: string },
  method: string
) {
  const shortId = order.id.split('-')[0].toUpperCase();
  const totalAmountFormatted = Number(order.total_amount).toLocaleString('id-ID');
  
  let message = "";
  if (order.order_type === 'dine_in') {
    message = `Pembayaran sebesar Rp ${totalAmountFormatted} untuk No. Pesanan Dine-In #${shortId} telah berhasil diselesaikan menggunakan ${method}. Pesanan Anda sudah terbayar dan sedang menunggu konfirmasi kasir. Silakan duduk manis dan tunggu hidangan Anda.`;
  } else if (order.order_type === 'takeaway') {
    message = `Pembayaran sebesar Rp ${totalAmountFormatted} untuk No. Pesanan Takeaway #${shortId} telah berhasil diselesaikan menggunakan ${method}. Pesanan Anda sudah terbayar dan sedang menunggu konfirmasi kasir. Kami akan segera menyiapkan hidangan bawa pulang Anda.`;
  } else {
    // default/delivery
    message = `Pembayaran sebesar Rp ${totalAmountFormatted} untuk No. Pesanan Delivery #${shortId} telah berhasil diselesaikan menggunakan ${method}. Pesanan Anda sudah terbayar dan sedang menunggu konfirmasi kasir. Kurir kami akan segera mengirimkannya setelah siap.`;
  }
  
  return {
    title: 'Pembayaran Berhasil',
    message: message,
    status_badge: 'Menunggu dikonfirmasi'
  };
}
