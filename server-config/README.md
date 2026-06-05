# Panduan Konfigurasi Keamanan & Rate Limiter Sisi Server

Direktori ini berisi templat konfigurasi siap-pakai untuk mengamankan infrastruktur server (VPS/Dedicated) dan database aplikasi RestoBook.

---

## 1. Konfigurasi Firewall & Port Security
Script `firewall-rules.sh` akan membatasi port masuk hanya untuk SSH (22), HTTP (80), dan HTTPS (443) dengan tambahan proteksi serangan SYN flood dan port scanning.

**Langkah Instalasi:**
```bash
# Berikan izin eksekusi script
chmod +x firewall-rules.sh

# Jalankan script sebagai root
sudo ./firewall-rules.sh
```

---

## 2. Batasan Rate Limiter Nginx
File `nginx-rate-limit.conf` mengimplementasikan pembatasan laju request pada level web server/reverse proxy. Hal ini penting guna menahan beban sebelum diteruskan ke Next.js.
- Membatasi concurrent connection per IP (maksimum 10).
- Membatasi request global API ke 60 per menit.
- Membatasi login, register, dan kirim OTP ke 5 request per menit.

**Langkah Instalasi:**
1. Salin blok `limit_req_zone` ke dalam blok `http` di `/etc/nginx/nginx.conf`.
2. Salin baris header keamanan dan blok `location` ke dalam blok `server` port 443 di konfigurasi situs Anda (misal `/etc/nginx/sites-available/default`).
3. Tes konfigurasi: `sudo nginx -t`
4. Muat ulang Nginx: `sudo systemctl reload nginx`

---

## 3. Fail2Ban Jail (Blokir Otomatis)
Fail2Ban memantau log akses Nginx. Bila terdeteksi aktivitas mencurigakan yang berulang (misal 5 kali gagal login dalam 15 menit), Fail2Ban akan otomatis menyuruh iptables memblokir IP tersebut secara total di level jaringan.

**Langkah Instalasi:**
1. Salin snippet dari `fail2ban-jail.local` ke `/etc/fail2ban/jail.d/restobook.local`.
2. Buat file filter `/etc/fail2ban/filter.d/restobook-auth.conf` dan tempel regex yang disediakan di dalam file.
3. Buat file filter `/etc/fail2ban/filter.d/restobook-ddos.conf` dan tempel regex ddos yang disediakan.
4. Restart service Fail2Ban: `sudo systemctl restart fail2ban`

---

## 4. SSL/TLS & HSTS
Semua lalu lintas wajib dienkripsi dengan SSL. Konfigurasi Nginx dan Apache di folder ini mewajibkan penggunaan TLS 1.2 & TLS 1.3 dan menambahkan header **HSTS** (`Strict-Transport-Security`). Hal ini memaksa browser pengunjung untuk *hanya* menghubungi website lewat HTTPS secara aman.

---

## 5. Keamanan Database & Backup Otomatis
1. **Enkripsi Sandi:** Semua password pengguna dienkripsi secara aman menggunakan enkripsi standard industri Supabase Auth (Argon2id / bcrypt modern).
2. **Koneksi SSL:** Pastikan connection string database Anda selalu menyertakan flag SSL (misal `?sslmode=require`).
3. **Backup Otomatis Harian:** 
   Simpan script backup di server Anda (misal `/opt/db_backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/restobook"
DB_NAME="postgres"
DB_USER="postgres"
DB_HOST="dazsblmccvxtewtmaljf.supabase.co"
DB_PORT="5432"
DATE=$(date +%Y-%m-%d_%H%M%S)

# Buat folder backup jika belum ada
mkdir -p "$BACKUP_DIR"

# Jalankan pg_dump (Pastikan PGPASSWORD telah diset)
export PGPASSWORD="password_db_anda"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c -b -v -f "$BACKUP_DIR/backup_$DATE.dump"

# Hapus backup yang lebih lama dari 7 hari agar disk tidak penuh
find "$BACKUP_DIR" -type f -name "*.dump" -mtime +7 -delete
```

Daftarkan di cron job (`crontab -e`) untuk berjalan setiap jam 2 pagi:
```cron
0 2 * * * /opt/db_backup.sh > /dev/null 2>&1
```
