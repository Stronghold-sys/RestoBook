#!/bin/bash
# =========================================================================
# RESTOBOOK ENTERPRISE FIREWALL RULES SCRIPT (UFW & IPTABLES)
# Jalankan script ini sebagai root (sudo) di VPS / Dedicated Server Linux Anda.
# =========================================================================

# Pastikan dijalankan sebagai root
if [ "$EUID" -ne 0 ]; then
  echo "Harap jalankan script ini menggunakan hak akses administrator (sudo)."
  exit 1
fi

echo "=========================================="
echo "Memulai Konfigurasi Keamanan Firewall..."
echo "=========================================="

# ── 1. Reset Aturan Firewall Default ─────────────────────────────────────
ufw --force reset

# Set default policy: Tolak semua koneksi masuk, Izinkan semua koneksi keluar
ufw default deny incoming
ufw default allow outgoing

# ── 2. Buka Port-Port Utama Aplikasi ──────────────────────────────────────
# Port SSH (Ganti 22 jika Anda menggunakan port SSH kustom)
ufw allow 22/tcp comment 'Allow SSH'

# Port Web Server (Nginx / Apache / Next.js)
ufw allow 80/tcp comment 'Allow HTTP'
ufw allow 443/tcp comment 'Allow HTTPS'

# ── 3. Proteksi Terhadap Serangan DDoS Level Jaringan (iptables) ─────────

# Batasi jumlah koneksi TCP baru per IP per 10 detik (SSH rate limit)
iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set
iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 60 --hitcount 4 -j DROP

# Cegah serangan Port Scanning (Ping of Death, NULL packets)
iptables -A INPUT -p tcp --tcp-flags ALL NONE -j DROP
iptables -A INPUT -p tcp --tcp-flags ALL ALL -j DROP

# Cegah SYN Flood attack (Batasi koneksi setengah terbuka)
iptables -A INPUT -p tcp ! --syn -m state --state NEW -j DROP
sysctl -w net.ipv4.tcp_syncookies=1

# ── 4. Aktifkan Firewall ────────────────────────────────────────────────
echo "Mengaktifkan UFW..."
ufw --force enable

echo "=========================================="
echo "Konfigurasi Firewall Berhasil Diaktifkan!"
echo "Status UFW saat ini:"
echo "=========================================="
ufw status verbose
