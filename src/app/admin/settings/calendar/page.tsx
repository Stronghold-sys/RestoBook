"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Save, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search,
  Sliders,
  Database,
  ArrowLeft,
  Settings,
  HelpCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function AdminCalendarSettingsPage() {
  const supabase = createClient();
  
  // Settings form states
  const [calendarId, setCalendarId] = useState('');
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [credentialsJson, setCredentialsJson] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);

  // Reservations syncing states
  const [reservations, setReservations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoadingReservations, setIsLoadingReservations] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  useEffect(() => {
    loadSettings();
    loadReservations();
  }, []);

  // Fetch current Google Calendar credentials
  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('google_calendar_credentials')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCalendarId(data.calendar_id || '');
        setTimezone(data.timezone || 'Asia/Jakarta');
        // Mask the private key for security in client view if desired, 
        // but since only admin is reading it, we can just load or show placeholder
        if (data.credentials_json) {
          setCredentialsJson(
            typeof data.credentials_json === 'string'
              ? data.credentials_json
              : JSON.stringify(data.credentials_json, null, 2)
          );
          setHasExistingConfig(true);
        }
      }
    } catch (err: any) {
      console.error('Gagal memuat pengaturan kalender:', err.message);
    }
  };

  // Fetch reservations with sync status
  const loadReservations = async () => {
    setIsLoadingReservations(true);
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, tables(table_number)')
        .order('reservation_date', { ascending: false });

      if (error) throw error;
      setReservations(data || []);
    } catch (err: any) {
      toast.error('Gagal memuat data reservasi: ' + err.message);
    } finally {
      setIsLoadingReservations(false);
    }
  };

  // Save credentials to database
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calendarId) return toast.error('Google Calendar ID wajib diisi.');
    if (!credentialsJson) return toast.error('Isi JSON Kredensial Service Account wajib diisi.');

    // Simple validation of JSON structure
    try {
      const parsed = JSON.parse(credentialsJson);
      if (!parsed.client_email || !parsed.private_key) {
        return toast.error('JSON tidak valid. Harus mengandung client_email dan private_key.');
      }
    } catch (err) {
      return toast.error('Format JSON Kredensial tidak valid. Silakan periksa kembali.');
    }

    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('google_calendar_credentials')
        .select('id')
        .maybeSingle();

      const payload = {
        calendar_id: calendarId,
        timezone: timezone,
        credentials_json: JSON.parse(credentialsJson),
        updated_at: new Date().toISOString()
      };

      let saveError;
      if (existing?.id) {
        const { error } = await supabase
          .from('google_calendar_credentials')
          .update(payload)
          .eq('id', existing.id);
        saveError = error;
      } else {
        const { error } = await supabase
          .from('google_calendar_credentials')
          .insert(payload);
        saveError = error;
      }

      if (saveError) throw saveError;

      toast.success('Pengaturan Google Calendar berhasil disimpan!');
      setHasExistingConfig(true);
      loadSettings();
    } catch (err: any) {
      toast.error('Gagal menyimpan pengaturan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Sync a single reservation to Google Calendar
  const handleSyncSingle = async (resId: string, action: 'create' | 'update' | 'delete') => {
    setSyncingId(resId);
    try {
      const response = await fetch('/api/reservations/sync-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: resId, action })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Terjadi kesalahan sinkronisasi.');
      }

      toast.success('Sinkronisasi kalender berhasil!');
      loadReservations();
    } catch (err: any) {
      toast.error(`Sinkronisasi gagal: ${err.message}`);
      loadReservations(); // Reload to show updated error columns
    } finally {
      setSyncingId(null);
    }
  };

  // Bulk sync all un-synced reservations (pending/failed status)
  const handleSyncAllFailed = async () => {
    const targets = reservations.filter(
      r => r.status === 'confirmed' && (r.sync_status === 'pending' || r.sync_status === 'failed')
    );

    if (targets.length === 0) {
      return toast('Tidak ada data reservasi gagal/pending yang perlu disinkronkan.');
    }

    setIsSyncingAll(true);
    let successCount = 0;
    let failCount = 0;

    toast.loading(`Menyinkronkan ${targets.length} reservasi...`, { id: 'bulk-sync' });

    for (const res of targets) {
      try {
        const response = await fetch('/api/reservations/sync-calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId: res.id, action: 'create' })
        });
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    setIsSyncingAll(false);
    loadReservations();
    toast.success(`Bulk Sync Selesai! Berhasil: ${successCount}, Gagal: ${failCount}`, { id: 'bulk-sync' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400 px-2.5 py-1 rounded-full border border-green-200/50 dark:border-green-900/50">
            <CheckCircle2 className="w-3.5 h-3.5" /> Tersinkron
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400 px-2.5 py-1 rounded-full border border-red-200/50 dark:border-red-900/50">
            <XCircle className="w-3.5 h-3.5" /> Gagal Sync
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-50 dark:bg-gray-800 dark:text-gray-400 px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700">
            <XCircle className="w-3.5 h-3.5" /> Dibatalkan
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-200/50 dark:border-amber-900/50">
            <Clock className="w-3.5 h-3.5" /> Pending Sync
          </span>
        );
    }
  };

  // Filter & Search Logic
  const filteredReservations = reservations.filter(res => {
    const matchesSearch = 
      res.atas_nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.id.includes(searchQuery);

    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'pending' && (!res.sync_status || res.sync_status === 'pending')) ||
      res.sync_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <button 
        onClick={() => window.history.back()} 
        className="flex items-center gap-2 text-sm font-bold text-muted hover:text-primary transition-all mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark flex items-center gap-2">
            <Settings className="w-8 h-8 text-primary" /> Pengaturan Google Calendar
          </h1>
          <p className="text-muted mt-1">Konfigurasi Service Account dan pantau sinkronisasi reservasi otomatis</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Config Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-text-light dark:text-text-dark mb-4 flex items-center gap-2 border-b border-border-light dark:border-border-dark pb-3">
              <Calendar className="w-5 h-5 text-primary" /> Kredensial API
            </h2>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label htmlFor="calendarIdInput" className="text-xs text-muted font-bold block mb-1 uppercase">Google Calendar ID</label>
                <input
                  id="calendarIdInput"
                  type="text"
                  value={calendarId}
                  onChange={e => setCalendarId(e.target.value)}
                  placeholder="primary atau email-kalender@group.calendar.google.com"
                  className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="timezoneSelect" className="text-xs text-muted font-bold block mb-1 uppercase">Zona Waktu</label>
                <select
                  id="timezoneSelect"
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm"
                >
                  <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                  <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                  <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="credentialsJsonInput" className="text-xs text-muted font-bold block uppercase">JSON Google Service Account</label>
                  <span className="text-[10px] text-primary font-bold flex items-center gap-0.5">
                    <HelpCircle className="w-3 h-3" /> PKCS8 Format
                  </span>
                </div>
                <textarea
                  id="credentialsJsonInput"
                  value={credentialsJson}
                  onChange={e => setCredentialsJson(e.target.value)}
                  placeholder='Paste isi file JSON Google Service Account di sini...'
                  className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-xs font-mono h-56 resize-none"
                  required
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-primary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {hasExistingConfig ? 'Perbarui Pengaturan' : 'Simpan Pengaturan'}
              </motion.button>
            </form>
          </div>

          {/* Guidelines Box */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-sm space-y-2.5">
            <h4 className="font-bold text-primary flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> Cara Konfigurasi:
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted leading-relaxed">
              <li>Buka <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a>.</li>
              <li>Buat Service Account & unduh kunci file berformat <strong>JSON</strong>.</li>
              <li>Aktifkan <strong>Google Calendar API</strong> di project Cloud Anda.</li>
              <li>Buka Google Calendar target Anda, masuk ke Pengaturan Kalender.</li>
              <li>Bagikan kalender (Share with specific people) kepada email Service Account Anda dengan izin <strong>Make changes to events</strong>.</li>
              <li>Salin <strong>Calendar ID</strong> dan paste ke form di atas beserta isi JSON Service Account.</li>
            </ol>
          </div>
        </div>

        {/* Right Column: Sync Logs & Monitor Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-border-light dark:border-border-dark">
              <div>
                <h2 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" /> Log Pelacakan Sinkronisasi
                </h2>
                <p className="text-xs text-muted mt-0.5">Pantau status sinkronisasi setiap reservasi aktif</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={loadReservations}
                  disabled={isLoadingReservations}
                  className="p-2.5 border border-border-light dark:border-border-dark rounded-xl text-muted hover:text-primary transition-all bg-background-light dark:bg-background-dark"
                  title="Segarkan Data"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingReservations ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleSyncAllFailed}
                  disabled={isSyncingAll || isLoadingReservations}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} /> Sinkronkan Semua Gagal/Pending
                </button>
              </div>
            </div>

            {/* Filter and search bars */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
                <input
                  type="text"
                  placeholder="Cari atas nama atau catatan..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-muted" />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm"
                  aria-label="Filter status sinkronisasi"
                  title="Filter status sinkronisasi"
                >
                  <option value="all">Semua Status</option>
                  <option value="synced">Tersinkron</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Gagal</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-border-light dark:border-border-dark">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark text-xs font-bold text-muted uppercase">
                    <th className="p-4">Reservasi</th>
                    <th className="p-4">Jadwal</th>
                    <th className="p-4">Status Kalender</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm text-text-light dark:text-text-dark">
                  {filteredReservations.map(res => {
                    const parsed = res.notes ? (() => {
                      try {
                        return JSON.parse(res.notes);
                      } catch {
                        return null;
                      }
                    })() : null;

                    const customerName = parsed?.atas_nama || res.atas_nama || 'Guest';

                    return (
                      <tr key={res.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition-colors">
                        <td className="p-4">
                          <p className="font-bold">{customerName}</p>
                          <p className="text-xs text-muted">ID: {res.id.substring(0, 8)}...</p>
                        </td>
                        <td className="p-4">
                          <p className="font-medium">
                            {format(new Date(res.reservation_date), 'dd MMM yyyy', { locale: localeId })}
                          </p>
                          <p className="text-xs text-muted">{res.reservation_time.substring(0, 5)} WIB</p>
                        </td>
                        <td className="p-4">
                          <div>{getStatusBadge(res.sync_status)}</div>
                          {res.sync_error && (
                            <p className="text-[10px] text-red-500 font-medium max-w-[200px] truncate mt-1" title={res.sync_error}>
                              Error: {res.sync_error}
                            </p>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              const syncAction = (res.status === 'cancelled' || res.status === 'completed') ? 'delete' : (res.google_event_id ? 'update' : 'create');
                              handleSyncSingle(res.id, syncAction);
                            }}
                            disabled={syncingId === res.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-light dark:border-border-dark text-xs font-bold rounded-lg hover:border-primary hover:text-primary transition-all bg-background-light dark:bg-background-dark"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${syncingId === res.id ? 'animate-spin' : ''}`} />
                            Sync
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredReservations.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted">
                        Tidak ada log/data reservasi yang sesuai filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
