"use client";

import { useEffect, useState } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search,
  Sliders,
  Database,
  ArrowLeft,
  Settings,
  AlertCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function AdminCalendarSettingsPage() {
  const supabase = createClient();
  
  // Reservations syncing states
  const [reservations, setReservations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoadingReservations, setIsLoadingReservations] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  useEffect(() => {
    loadReservations();
  }, []);

  // Fetch reservations with sync status
  const loadReservations = async () => {
    setIsLoadingReservations(true);
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, tables(table_number), profiles(full_name)')
        .order('reservation_date', { ascending: false });

      if (error) throw error;
      setReservations(data || []);
    } catch (err: any) {
      toast.error('Gagal memuat data reservasi: ' + err.message);
    } finally {
      setIsLoadingReservations(false);
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
    const parsed = res.notes ? (() => {
      try {
        return JSON.parse(res.notes);
      } catch {
        return null;
      }
    })() : null;

    const customerName = parsed?.atas_nama || res.profiles?.full_name || 'Guest';

    const matchesSearch = 
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
            <Settings className="w-8 h-8 text-primary" /> Log Google Calendar
          </h1>
          <p className="text-muted mt-1">Pantau dan sinkronisasi reservasi meja dengan Google Calendar</p>
        </div>
      </div>

      {/* Cloudflare Env Security Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-sm flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-text-light dark:text-text-dark">Kredensial Aman Terkonfigurasi</h4>
          <p className="text-xs text-muted leading-relaxed">
            Kredensial API Google Service Account dan Calendar ID Anda saat ini dikelola dan dibaca secara aman melalui <strong>Cloudflare Variables & Secrets</strong>. Form input manual di halaman web telah dihapus sepenuhnya untuk mematuhi standar keamanan terbaik dan menghindari paparan kunci privat secara plaintext.
          </p>
        </div>
      </div>

      {/* Sync Logs & Monitor Table (Full Width) */}
      <div className="space-y-6">
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
                aria-label="Segarkan Data"
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

                  const customerName = parsed?.atas_nama || res.profiles?.full_name || 'Guest';

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
  );
}
