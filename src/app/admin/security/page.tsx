"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldAlert, ShieldCheck, Flame, UserX, Ban, Cpu, Server, 
  MapPin, Globe, RefreshCw, Plus, Trash2, Search, Filter, AlertTriangle, CheckCircle, Info 
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface SecurityLog {
  id: string;
  user_id: string | null;
  full_name: string | null;
  ip_address: string;
  browser: string | null;
  device: string | null;
  user_agent: string | null;
  activity: string;
  endpoint: string | null;
  created_at: string;
  status: string;
}

interface IPRule {
  id: string;
  ip_address: string;
  rule_type: 'blacklist' | 'whitelist';
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

interface BlockRule {
  id: string;
  field_type: 'email' | 'browser' | 'device';
  value: string;
  reason: string | null;
  created_at: string;
}

interface GeoLocationRecord {
  id: string;
  profile_id: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
  country: string;
  city: string;
  last_detected_at: string;
}

interface SecurityIncident {
  id: string;
  ip_address: string;
  fingerprint: string | null;
  asn: string | null;
  country: string | null;
  city: string | null;
  endpoint: string | null;
  payload: string | null;
  attack_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

interface SecuritySettings {
  id: string;
  emergency_mode: boolean;
  global_captcha_required: boolean;
  block_new_registrations: boolean;
  block_sensitive_endpoints: boolean;
  tightened_rate_limits: boolean;
}

export default function SecurityPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'logs' | 'ip' | 'detail' | 'geo' | 'incidents' | 'rotating'>('logs');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [ipRules, setIpRules] = useState<IPRule[]>([]);
  const [blockRules, setBlockRules] = useState<BlockRule[]>([]);
  const [geoRecords, setGeoRecords] = useState<GeoLocationRecord[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [fingerprintIps, setFingerprintIps] = useState<any[]>([]);
  const [subnetBlocks, setSubnetBlocks] = useState<any[]>([]);
  const [securityConfig, setSecurityConfig] = useState<SecuritySettings>({
    id: "",
    emergency_mode: false,
    global_captcha_required: false,
    block_new_registrations: false,
    block_sensitive_endpoints: false,
    tightened_rate_limits: false
  });
  
  // Stats States
  const [stats, setStats] = useState({
    firewallActive: true,
    rateLimiterActive: true,
    serverHealthy: true,
    attacksToday: 0,
    failedLogins: 0,
    lockedAccounts: 0,
    blockedIPs: 0
  });

  // Form States
  const [ipForm, setIpForm] = useState({ ip: "", type: "blacklist" as 'blacklist' | 'whitelist', reason: "", duration: "1440" });
  const [blockForm, setBlockForm] = useState({ fieldType: "email" as 'email' | 'browser' | 'device', value: "", reason: "" });
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
      }
    });
  };

  const fetchStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      // Count Attacks Today (DDoS, Bot, Honeypot, etc.)
      const { count: attacks } = await supabase
        .from("security_logs")
        .select("*", { count: "exact", head: true })
        .in("activity", ["DDOS_ATTEMPT_LEVEL_3", "DDOS_ATTEMPT_LEVEL_4", "BOT_BLOCKED", "REGISTER_HONEYPOT_TRIGGERED", "REGISTER_BOT_DETECTED", "IP_BLOCKED_ACCESS_ATTEMPT", "CSRF_VIOLATION"])
        .gt("created_at", todayIso);

      // Count Failed Logins Today
      const { count: failedLogins } = await supabase
        .from("security_logs")
        .select("*", { count: "exact", head: true })
        .eq("activity", "LOGIN_FAILED")
        .gt("created_at", todayIso);

      // Count Locked Accounts Currently
      const now = new Date().toISOString();
      const { count: locked } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gt("locked_until", now);

      // Count Active Blacklisted IPs
      const { count: blockedIPs } = await supabase
        .from("security_ip_rules")
        .select("*", { count: "exact", head: true })
        .eq("rule_type", "blacklist")
        .or(`expires_at.gt.${now},expires_at.is.null`);

      setStats(prev => ({
        ...prev,
        attacksToday: attacks || 0,
        failedLogins: failedLogins || 0,
        lockedAccounts: locked || 0,
        blockedIPs: blockedIPs || 0
      }));
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("security_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  };

  const fetchIpRules = async () => {
    try {
      const { data, error } = await supabase
        .from("security_ip_rules")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setIpRules(data || []);
    } catch (err) {
      console.error("Error fetching IP rules:", err);
    }
  };

  const fetchBlockRules = async () => {
    try {
      const { data, error } = await supabase
        .from("security_block_rules")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setBlockRules(data || []);
    } catch (err) {
      console.error("Error fetching block rules:", err);
    }
  };

  const fetchGeoRecords = async () => {
    try {
      const { data, error } = await supabase
        .from("security_login_locations")
        .select(`
          id,
          profile_id,
          country,
          city,
          last_detected_at,
          profiles:profile_id (
            full_name,
            email
          )
        `)
        .order("last_detected_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setGeoRecords((data as any) || []);
    } catch (err) {
      console.error("Error fetching geo records:", err);
    }
  };

  const fetchIncidents = async () => {
    try {
      const { data, error } = await supabase
        .from("security_incidents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setIncidents(data || []);
    } catch (err) {
      console.error("Error fetching incidents:", err);
    }
  };

  const fetchFingerprintIps = async () => {
    try {
      const { data, error } = await supabase
        .from("security_fingerprint_ips")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setFingerprintIps(data || []);
    } catch (err) {
      console.error("Error fetching fingerprint IPs:", err);
    }
  };

  const fetchSubnetBlocks = async () => {
    try {
      const { data, error } = await supabase
        .from("security_subnet_blocks")
        .select("*")
        .order("blocked_until", { ascending: false });
      if (error) throw error;
      setSubnetBlocks(data || []);
    } catch (err) {
      console.error("Error fetching subnet blocks:", err);
    }
  };

  const fetchSecurityConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("security_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setSecurityConfig(data);
      }
    } catch (err) {
      console.error("Error fetching security settings:", err);
    }
  };

  const initData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStats(),
      fetchLogs(),
      fetchIpRules(),
      fetchBlockRules(),
      fetchGeoRecords(),
      fetchIncidents(),
      fetchSecurityConfig(),
      fetchFingerprintIps(),
      fetchSubnetBlocks()
    ]);
    setLoading(false);
  };

  // Setup Realtime WebSocket Subscription
  useEffect(() => {
    initData();

    // Subscribe to new security logs in realtime
    const channel = supabase
      .channel("security-dashboard-sync")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "security_logs" }, (payload) => {
        setLogs(prev => [payload.new as SecurityLog, ...prev.slice(0, 49)]);
        fetchStats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "security_ip_rules" }, () => {
        fetchIpRules();
        fetchStats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "security_block_rules" }, () => {
        fetchBlockRules();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "security_incidents" }, () => {
        fetchIncidents();
        fetchStats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "security_settings" }, () => {
        fetchSecurityConfig();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "security_fingerprint_ips" }, () => {
        fetchFingerprintIps();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "security_subnet_blocks" }, () => {
        fetchSubnetBlocks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // IP Rule Actions
  const handleAddIpRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipForm.ip) return toast.error("IP Address wajib diisi");

    try {
      const expiresAt = ipForm.duration === "permanent" 
        ? null 
        : new Date(Date.now() + parseInt(ipForm.duration) * 60000).toISOString();

      const { error } = await supabase.from("security_ip_rules").upsert({
        ip_address: ipForm.ip.trim(),
        rule_type: ipForm.type,
        reason: ipForm.reason || `Ditambahkan manual oleh admin`,
        expires_at: expiresAt
      }, { onConflict: 'ip_address' });

      if (error) throw error;

      toast.success(`Aturan untuk IP ${ipForm.ip} berhasil disimpan (${ipForm.type})!`);
      setIpForm({ ip: "", type: "blacklist", reason: "", duration: "1440" });
      fetchIpRules();
    } catch (err: any) {
      toast.error(err.message || "Gagal menambahkan IP rule");
    }
  };

  const handleRemoveIpRule = async (id: string, ip: string) => {
    showConfirm(
      "Konfirmasi Hapus IP Rule",
      `Apakah Anda yakin ingin menghapus aturan pemblokiran untuk IP ${ip}?`,
      async () => {
        try {
          const { error } = await supabase.from("security_ip_rules").delete().eq("id", id);
          if (error) throw error;

          toast.success(`Aturan IP ${ip} berhasil dihapus.`);
          fetchIpRules();
        } catch (err: any) {
          toast.error(err.message || "Gagal menghapus IP rule");
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    );
  };

  // Detail Block Rule Actions
  const handleAddBlockRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockForm.value) return toast.error("Nilai pencarian wajib diisi");

    try {
      const { error } = await supabase.from("security_block_rules").upsert({
        field_type: blockForm.fieldType,
        value: blockForm.value.trim().toLowerCase(),
        reason: blockForm.reason || "Diblokir manual oleh admin"
      }, { onConflict: 'field_type,value' });

      if (error) throw error;

      toast.success(`${blockForm.fieldType} '${blockForm.value}' berhasil diblokir!`);
      setBlockForm({ fieldType: "email", value: "", reason: "" });
      fetchBlockRules();
    } catch (err: any) {
      toast.error(err.message || "Gagal memblokir nilai");
    }
  };

  const handleRemoveBlockRule = async (id: string, value: string) => {
    showConfirm(
      "Konfirmasi Hapus Cekal Detail",
      `Apakah Anda yakin ingin menghapus aturan cekal untuk '${value}'?`,
      async () => {
        try {
          const { error } = await supabase.from("security_block_rules").delete().eq("id", id);
          if (error) throw error;

          toast.success(`Cekal untuk '${value}' berhasil dihapus.`);
          fetchBlockRules();
        } catch (err: any) {
          toast.error(err.message || "Gagal menghapus aturan cekal");
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    );
  };

  // Filter & Search Logic
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.ip_address.includes(searchQuery) ||
      (log.full_name && log.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.activity && log.activity.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesActivity = activityFilter === "all" || log.activity === activityFilter;
    
    return matchesSearch && matchesActivity;
  });

  const getActivityBadgeColor = (activity: string) => {
    if (activity.includes("SUCCESS")) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    if (activity.includes("LOCKED") || activity.includes("BLOCKED")) return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    if (activity.includes("RATE_LIMIT") || activity.includes("DDOS") || activity.includes("VIOLATION") || activity.includes("BOT")) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    return "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20";
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-text-light dark:text-text-dark">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card-light dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Keamanan Sistem</h1>
            <p className="text-sm text-muted">Pantau serangan, kelola blacklist, dan atur batasan keamanan website Anda secara realtime.</p>
          </div>
        </div>
        <button 
          onClick={initData} 
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 font-bold text-xs rounded-2xl transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Segarkan Data
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Status System */}
        <div className="bg-card-light dark:bg-card-dark p-5 rounded-3xl border border-border-light dark:border-border-dark flex items-center gap-4 shadow-sm">
          <div className={`p-3.5 rounded-2xl border ${stats.firewallActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-muted tracking-wider">Status Proteksi</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <h3 className="text-base font-black">Firewall & Limiter</h3>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">Aktif & Melindungi</p>
          </div>
        </div>

        {/* Attacks Today */}
        <div className="bg-card-light dark:bg-card-dark p-5 rounded-3xl border border-border-light dark:border-border-dark flex items-center gap-4 shadow-sm">
          <div className="p-3.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl">
            <Flame className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-muted tracking-wider">Serangan Dicegah Hari Ini</p>
            <h3 className="text-2xl font-black mt-0.5">{stats.attacksToday}</h3>
            <p className="text-[11px] text-muted font-bold mt-0.5">Bot, DDoS & Exploit</p>
          </div>
        </div>

        {/* Locked Accounts */}
        <div className="bg-card-light dark:bg-card-dark p-5 rounded-3xl border border-border-light dark:border-border-dark flex items-center gap-4 shadow-sm">
          <div className="p-3.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl">
            <UserX className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-muted tracking-wider">Akun Terkunci Sementara</p>
            <h3 className="text-2xl font-black mt-0.5">{stats.lockedAccounts}</h3>
            <p className="text-[11px] text-muted font-bold mt-0.5">Brute force prevention</p>
          </div>
        </div>

        {/* Blocked IPs */}
        <div className="bg-card-light dark:bg-card-dark p-5 rounded-3xl border border-border-light dark:border-border-dark flex items-center gap-4 shadow-sm">
          <div className="p-3.5 bg-gray-500/10 text-text-light dark:text-text-dark border border-border-light dark:border-border-dark rounded-2xl">
            <Ban className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-muted tracking-wider">IP Address Terblokir</p>
            <h3 className="text-2xl font-black mt-0.5">{stats.blockedIPs}</h3>
            <p className="text-[11px] text-muted font-bold mt-0.5">Active blacklists</p>
          </div>
        </div>

      </div>

      {/* Main Sections (Tabs & Content) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1 bg-card-light dark:bg-card-dark p-4 rounded-3xl border border-border-light dark:border-border-dark space-y-2">
          <p className="text-[10px] font-black uppercase text-muted px-3 tracking-wider mb-2">Pilih Navigasi</p>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-primary/5 hover:text-primary text-muted'}`}
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5" />
              <span>Log Keamanan Realtime</span>
            </div>
            <span className="text-[10px] bg-white/20 dark:bg-gray-800 px-2 py-0.5 rounded-full font-black text-xs">Realtime</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('ip')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'ip' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-primary/5 hover:text-primary text-muted'}`}
          >
            <div className="flex items-center gap-3">
              <Ban className="w-5 h-5" />
              <span>Manajemen IP Blacklist</span>
            </div>
            <span className="text-[10px] bg-white/20 dark:bg-gray-800 px-2 py-0.5 rounded-full font-black text-xs">{ipRules.length}</span>
          </button>

          <button 
            onClick={() => setActiveTab('detail')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'detail' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-primary/5 hover:text-primary text-muted'}`}
          >
            <div className="flex items-center gap-3">
              <UserX className="w-5 h-5" />
              <span>Blacklist Detail</span>
            </div>
            <span className="text-[10px] bg-white/20 dark:bg-gray-800 px-2 py-0.5 rounded-full font-black text-xs">{blockRules.length}</span>
          </button>

          <button 
            onClick={() => setActiveTab('geo')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'geo' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-primary/5 hover:text-primary text-muted'}`}
          >
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5" />
              <span>Geolocation Security</span>
            </div>
            <span className="text-[10px] bg-white/20 dark:bg-gray-800 px-2 py-0.5 rounded-full font-black text-xs">{geoRecords.length}</span>
          </button>

          <button 
            onClick={() => setActiveTab('incidents')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'incidents' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-primary/5 hover:text-primary text-muted'}`}
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span>Insiden & Serangan</span>
            </div>
            <span className="text-[10px] bg-white/20 dark:bg-gray-800 px-2 py-0.5 rounded-full font-black text-xs">{incidents.length}</span>
          </button>

          <button 
            onClick={() => setActiveTab('rotating')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'rotating' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-primary/5 hover:text-primary text-muted'}`}
            title="Rotating IP & Botnet"
            aria-label="Rotating IP & Botnet"
          >
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              <span>Rotating IP & Botnets</span>
            </div>
            <span className="text-[10px] bg-white/20 dark:bg-gray-800 px-2 py-0.5 rounded-full font-black text-xs">{subnetBlocks.length} Blocked</span>
          </button>

          <div className="pt-4 border-t border-border-light dark:border-border-dark space-y-3 px-3">
            <p className="text-[10px] font-black uppercase text-muted tracking-wider">Mode Darurat (Emergency Mode)</p>
            
            <div className={`p-4 rounded-2xl border ${securityConfig.emergency_mode ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' : 'bg-gray-50 dark:bg-gray-900/60 border-border-light dark:border-border-dark'} space-y-3`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">Emergency Mode</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={securityConfig.emergency_mode} 
                    onChange={async (e) => {
                      const val = e.target.checked;
                      const { error } = await supabase.from('security_settings').update({ 
                        emergency_mode: val,
                        global_captcha_required: val,
                        block_new_registrations: val,
                        block_sensitive_endpoints: val,
                        tightened_rate_limits: val
                      }).eq('id', securityConfig.id);
                      if (error) toast.error("Gagal mengubah mode darurat");
                      else {
                        toast.success(val ? "Emergency Mode AKTIF! Seluruh sistem diperketat." : "Emergency Mode dinonaktifkan.");
                        fetchSecurityConfig();
                      }
                    }}
                    className="sr-only peer"
                    title="Emergency Mode"
                    aria-label="Emergency Mode"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                </label>
              </div>

              {securityConfig.emergency_mode && (
                <div className="space-y-2 pt-2 border-t border-rose-500/20 text-[11px] font-semibold">
                  <div className="flex justify-between items-center">
                    <label htmlFor="global-captcha-opt" className="cursor-pointer">Captcha Global</label>
                    <input 
                      id="global-captcha-opt"
                      type="checkbox" 
                      checked={securityConfig.global_captcha_required}
                      onChange={async (e) => {
                        await supabase.from('security_settings').update({ global_captcha_required: e.target.checked }).eq('id', securityConfig.id);
                        fetchSecurityConfig();
                      }}
                      className="rounded accent-rose-500"
                      title="Captcha Global"
                      aria-label="Captcha Global"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <label htmlFor="block-reg-opt" className="cursor-pointer">Blokir Registrasi</label>
                    <input 
                      id="block-reg-opt"
                      type="checkbox" 
                      checked={securityConfig.block_new_registrations}
                      onChange={async (e) => {
                        await supabase.from('security_settings').update({ block_new_registrations: e.target.checked }).eq('id', securityConfig.id);
                        fetchSecurityConfig();
                      }}
                      className="rounded accent-rose-500"
                      title="Blokir Registrasi"
                      aria-label="Blokir Registrasi"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <label htmlFor="block-sensitive-opt" className="cursor-pointer">Blokir API OTP / Login</label>
                    <input 
                      id="block-sensitive-opt"
                      type="checkbox" 
                      checked={securityConfig.block_sensitive_endpoints}
                      onChange={async (e) => {
                        await supabase.from('security_settings').update({ block_sensitive_endpoints: e.target.checked }).eq('id', securityConfig.id);
                        fetchSecurityConfig();
                      }}
                      className="rounded accent-rose-500"
                      title="Blokir API OTP / Login"
                      aria-label="Blokir API OTP / Login"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <label htmlFor="tighten-limits-opt" className="cursor-pointer">Perketat Rate Limits (5x)</label>
                    <input 
                      id="tighten-limits-opt"
                      type="checkbox" 
                      checked={securityConfig.tightened_rate_limits}
                      onChange={async (e) => {
                        await supabase.from('security_settings').update({ tightened_rate_limits: e.target.checked }).eq('id', securityConfig.id);
                        fetchSecurityConfig();
                      }}
                      className="rounded accent-rose-500"
                      title="Perketat Rate Limits"
                      aria-label="Perketat Rate Limits"
                    />
                  </div>
                </div>
              )}
            </div>

            <p className="text-[10px] font-black uppercase text-muted tracking-wider">Status Server Keamanan</p>
            <div className="flex items-center justify-between text-xs font-bold text-muted">
              <span>SSL/TLS Enforcement</span>
              <span className="text-emerald-500 flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> SSL Aktif</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-muted">
              <span>HSTS Preload Headers</span>
              <span className="text-emerald-500">Enabled</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-muted">
              <span>WAF (Web Application Firewall)</span>
              <span className="text-emerald-500">Proteksi Aktif</span>
            </div>
          </div>
        </div>

        {/* Main Tabs Content */}
        <div className="lg:col-span-2 bg-card-light dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-sm min-h-[500px]">
          <AnimatePresence mode="wait">
            
            {/* LOG KEAMANAN REALTIME TAB */}
            {activeTab === 'logs' && (
              <motion.div
                key="logs"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border-light dark:border-border-dark pb-4">
                  <div>
                    <h2 className="text-lg font-black">Audit Log Keamanan Terkini</h2>
                    <p className="text-xs text-muted">Aktivitas terdeteksi oleh middleware dan didelegasikan secara otomatis.</p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari IP / Nama / Activity..."
                        className="pl-9 pr-4 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none w-full"
                        title="Cari Log Keamanan"
                        aria-label="Cari Log Keamanan"
                      />
                    </div>
                    <select
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(e.target.value)}
                      className="py-2 px-3 text-xs bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl outline-none"
                      title="Filter Aktivitas Keamanan"
                      aria-label="Filter Aktivitas Keamanan"
                    >
                      <option value="all">Semua Aktivitas</option>
                      <option value="LOGIN_FAILED">LOGIN_FAILED</option>
                      <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
                      <option value="ACCOUNT_LOCKED_15M">ACCOUNT_LOCKED_15M</option>
                      <option value="ACCOUNT_LOCKED_1H">ACCOUNT_LOCKED_1H</option>
                      <option value="ACCOUNT_LOCKED_24H">ACCOUNT_LOCKED_24H</option>
                      <option value="RATE_LIMIT_EXCEEDED">RATE_LIMIT_EXCEEDED</option>
                      <option value="DDOS_ATTEMPT_LEVEL_3">DDOS_ATTEMPT_LEVEL_3</option>
                      <option value="DDOS_ATTEMPT_LEVEL_4">DDOS_ATTEMPT_LEVEL_4</option>
                      <option value="BOT_BLOCKED">BOT_BLOCKED</option>
                      <option value="CSRF_VIOLATION">CSRF_VIOLATION</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[500px] custom-scrollbar border border-border-light dark:border-border-dark rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-border-light dark:border-border-dark font-bold text-muted text-[10px] uppercase tracking-wider">
                        <th className="py-3 px-4">Waktu</th>
                        <th className="py-3 px-4">Aktivitas</th>
                        <th className="py-3 px-4">IP Klien</th>
                        <th className="py-3 px-4">Pengguna</th>
                        <th className="py-3 px-4">Detail Perangkat</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted font-bold text-xs italic">
                            Tidak ada log keamanan yang cocok.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => (
                          <tr key={log.id} className="border-b border-border-light dark:border-border-dark hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all">
                            <td className="py-3 px-4 font-mono text-muted text-[10px]" title={new Date(log.created_at).toLocaleString()}>
                              {new Date(log.created_at).toLocaleTimeString('id-ID')}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded border text-[9px] font-black tracking-wide uppercase ${getActivityBadgeColor(log.activity)}`}>
                                {log.activity}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-text-light dark:text-text-dark">
                              {log.ip_address}
                            </td>
                            <td className="py-3 px-4 font-semibold">
                              {log.full_name || <span className="text-muted italic">Guest</span>}
                            </td>
                            <td className="py-3 px-4 text-muted text-[11px]" title={log.user_agent || ''}>
                              {log.device} • {log.browser}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                log.status === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                log.status === 'blocked' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400' :
                                'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                              }`}>
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* MANAJEMEN IP BLACKLIST/WHITELIST TAB */}
            {activeTab === 'ip' && (
              <motion.div
                key="ip"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="border-b border-border-light dark:border-border-dark pb-4">
                  <h2 className="text-lg font-black">Manajemen Aturan IP Firewall</h2>
                  <p className="text-xs text-muted">Tambahkan IP Address ke dalam blacklist (cekal akses) atau whitelist (izinkan bypass limit).</p>
                </div>

                {/* Form Add IP Rule */}
                <form onSubmit={handleAddIpRule} className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 bg-gray-50 dark:bg-gray-900/60 border border-border-light dark:border-border-dark rounded-2xl">
                  <div className="sm:col-span-1 space-y-1">
                    <label htmlFor="ip-rule-type" className="text-[10px] font-black uppercase text-muted">Tipe Aturan</label>
                    <select
                      id="ip-rule-type"
                      value={ipForm.type}
                      onChange={(e) => setIpForm(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full py-2.5 px-3 text-xs bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl outline-none"
                      title="Pilih Tipe Aturan IP"
                    >
                      <option value="blacklist">Blacklist (Cekal)</option>
                      <option value="whitelist">Whitelist (Lolos)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-1 space-y-1">
                    <label htmlFor="ip-rule-address" className="text-[10px] font-black uppercase text-muted">IP Address</label>
                    <input 
                      id="ip-rule-address"
                      type="text" 
                      value={ipForm.ip}
                      onChange={(e) => setIpForm(prev => ({ ...prev, ip: e.target.value }))}
                      placeholder="e.g. 114.122.10.15"
                      className="w-full py-2 px-3 text-xs bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl outline-none"
                      title="IP Address"
                      aria-label="IP Address"
                    />
                  </div>

                  <div className="sm:col-span-1 space-y-1">
                    <label htmlFor="ip-rule-duration" className="text-[10px] font-black uppercase text-muted">Masa Cekal</label>
                    <select
                      id="ip-rule-duration"
                      value={ipForm.duration}
                      onChange={(e) => setIpForm(prev => ({ ...prev, duration: e.target.value }))}
                      className="w-full py-2.5 px-3 text-xs bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl outline-none"
                      title="Pilih Durasi Masa Cekal IP"
                    >
                      <option value="15">15 Menit</option>
                      <option value="60">1 Jam</option>
                      <option value="1440">24 Jam</option>
                      <option value="10080">7 Hari</option>
                      <option value="permanent">Permanen</option>
                    </select>
                  </div>

                  <div className="sm:col-span-1 space-y-1 flex flex-col justify-end">
                    <button 
                      type="submit"
                      className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-primary/15"
                    >
                      <Plus className="w-4 h-4" /> Tambah Aturan
                    </button>
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label htmlFor="ip-rule-reason" className="text-[10px] font-black uppercase text-muted">Alasan Pencekalan / Whitelist</label>
                    <input 
                      id="ip-rule-reason"
                      type="text" 
                      value={ipForm.reason}
                      onChange={(e) => setIpForm(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Contoh: Spam bruteforce login berulang kali"
                      className="w-full py-2 px-3 text-xs bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl outline-none"
                      title="Alasan Pencekalan / Whitelist"
                      aria-label="Alasan Pencekalan / Whitelist"
                    />
                  </div>
                </form>

                {/* List IP Rules */}
                <div className="overflow-x-auto border border-border-light dark:border-border-dark rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-border-light dark:border-border-dark font-bold text-muted text-[10px] uppercase tracking-wider">
                        <th className="py-3 px-4">IP Address</th>
                        <th className="py-3 px-4">Tipe Aturan</th>
                        <th className="py-3 px-4">Alasan</th>
                        <th className="py-3 px-4">Berakhir Pada</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ipRules.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted font-bold text-xs italic">
                            Tidak ada aturan IP firewall aktif.
                          </td>
                        </tr>
                      ) : (
                        ipRules.map((rule) => {
                          const isExpired = rule.expires_at && new Date(rule.expires_at) < new Date();
                          return (
                            <tr key={rule.id} className={`border-b border-border-light dark:border-border-dark hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all ${isExpired ? 'opacity-40 line-through' : ''}`}>
                              <td className="py-3.5 px-4 font-mono font-bold text-sm">
                                {rule.ip_address}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${rule.rule_type === 'blacklist' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-500/10' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-500/10'}`}>
                                  {rule.rule_type}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-muted max-w-[200px] truncate" title={rule.reason || ''}>
                                {rule.reason || '-'}
                              </td>
                              <td className="py-3.5 px-4 text-muted">
                                {rule.expires_at ? new Date(rule.expires_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : <span className="font-bold text-rose-500 text-[10px] uppercase">Permanen</span>}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <button 
                                  onClick={() => handleRemoveIpRule(rule.id, rule.ip_address)}
                                  className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 hover:text-rose-600 rounded-lg transition-all"
                                  title="Hapus Cekal"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* BLACKLIST DETAIL (EMAIL/BROWSER/DEVICE) TAB */}
            {activeTab === 'detail' && (
              <motion.div
                key="detail"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="border-b border-border-light dark:border-border-dark pb-4">
                  <h2 className="text-lg font-black">Manajemen Pencekalan Detail</h2>
                  <p className="text-xs text-muted">Karantina akun atau bot secara spesifik berdasarkan email terdaftar, browser penyerang, atau merk perangkat.</p>
                </div>

                {/* Form Add Detail Rule */}
                <form onSubmit={handleAddBlockRule} className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 bg-gray-50 dark:bg-gray-900/60 border border-border-light dark:border-border-dark rounded-2xl">
                  <div className="sm:col-span-1 space-y-1">
                    <label htmlFor="block-field-type" className="text-[10px] font-black uppercase text-muted">Elemen Kriteria</label>
                    <select
                      id="block-field-type"
                      value={blockForm.fieldType}
                      onChange={(e) => setBlockForm(prev => ({ ...prev, fieldType: e.target.value as any }))}
                      className="w-full py-2.5 px-3 text-xs bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl outline-none"
                      title="Pilih Elemen Kriteria Detail"
                    >
                      <option value="email">Email Pengguna</option>
                      <option value="browser">Browser</option>
                      <option value="device">Perangkat (Device)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label htmlFor="block-rule-value" className="text-[10px] font-black uppercase text-muted">Nilai Yang Dicekal</label>
                    <input 
                      id="block-rule-value"
                      type="text" 
                      value={blockForm.value}
                      onChange={(e) => setBlockForm(prev => ({ ...prev, value: e.target.value }))}
                      placeholder={blockForm.fieldType === 'email' ? 'e.g. spammer@email.com' : (blockForm.fieldType === 'browser' ? 'e.g. Firefox' : 'e.g. Mobile')}
                      className="w-full py-2 px-3 text-xs bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl outline-none"
                      title="Nilai Yang Dicekal"
                      aria-label="Nilai Yang Dicekal"
                    />
                  </div>

                  <div className="sm:col-span-1 space-y-1 flex flex-col justify-end">
                    <button 
                      type="submit"
                      className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-primary/15"
                    >
                      <Plus className="w-4 h-4" /> Blokir Nilai
                    </button>
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label htmlFor="block-rule-reason" className="text-[10px] font-black uppercase text-muted">Alasan Pemblokiran</label>
                    <input 
                      id="block-rule-reason"
                      type="text" 
                      value={blockForm.reason}
                      onChange={(e) => setBlockForm(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Alasan cekal detail"
                      className="w-full py-2 px-3 text-xs bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl outline-none"
                      title="Alasan Pemblokiran"
                      aria-label="Alasan Pemblokiran"
                    />
                  </div>
                </form>

                {/* List Block Rules */}
                <div className="overflow-x-auto border border-border-light dark:border-border-dark rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-border-light dark:border-border-dark font-bold text-muted text-[10px] uppercase tracking-wider">
                        <th className="py-3 px-4">Kriteria Elemen</th>
                        <th className="py-3 px-4">Nilai Tercekal</th>
                        <th className="py-3 px-4">Alasan</th>
                        <th className="py-3 px-4">Dibuat Pada</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockRules.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted font-bold text-xs italic">
                            Tidak ada kriteria pencekalan detail yang aktif.
                          </td>
                        </tr>
                      ) : (
                        blockRules.map((rule) => (
                          <tr key={rule.id} className="border-b border-border-light dark:border-border-dark hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all">
                            <td className="py-3 px-4 font-semibold uppercase text-[10px] text-muted">
                              {rule.field_type}
                            </td>
                            <td className="py-3 px-4 font-bold text-sm text-rose-500 font-mono">
                              {rule.value}
                            </td>
                            <td className="py-3 px-4 text-muted">
                              {rule.reason || '-'}
                            </td>
                            <td className="py-3 px-4 text-muted">
                              {new Date(rule.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button 
                                onClick={() => handleRemoveBlockRule(rule.id, rule.value)}
                                className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 hover:text-rose-600 rounded-lg transition-all"
                                title="Hapus Blokir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* GEOLOCATION SECURITY TAB */}
            {activeTab === 'geo' && (
              <motion.div
                key="geo"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="border-b border-border-light dark:border-border-dark pb-4">
                  <h2 className="text-lg font-black">Histori Geolokasi & Lokasi Login</h2>
                  <p className="text-xs text-muted">Daftar lokasi login terverifikasi per akun. Kombinasi kota/negara baru otomatis memicu notifikasi email.</p>
                </div>

                <div className="overflow-x-auto border border-border-light dark:border-border-dark rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-border-light dark:border-border-dark font-bold text-muted text-[10px] uppercase tracking-wider">
                        <th className="py-3 px-4">Akun Pengguna</th>
                        <th className="py-3 px-4">Negara</th>
                        <th className="py-3 px-4">Kota Deteksi</th>
                        <th className="py-3 px-4">Waktu Deteksi Terakhir</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {geoRecords.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted font-bold text-xs italic">
                            Tidak ada histori geolokasi terekam.
                          </td>
                        </tr>
                      ) : (
                        geoRecords.map((rec) => (
                          <tr key={rec.id} className="border-b border-border-light dark:border-border-dark hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all">
                            <td className="py-3 px-4">
                              <div className="font-bold text-text-light dark:text-text-dark">
                                {rec.profiles?.full_name || 'Pengguna Tidak Diketahui'}
                              </div>
                              <div className="text-[10px] text-muted font-mono">{rec.profiles?.email || '-'}</div>
                            </td>
                            <td className="py-3 px-4 font-semibold">
                              <span className="flex items-center gap-1.5">
                                <Globe className="w-4 h-4 text-primary shrink-0" />
                                {rec.country}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold flex items-center gap-1 mt-2">
                              <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                              {rec.city}
                            </td>
                            <td className="py-3 px-4 text-muted">
                              {new Date(rec.last_detected_at).toLocaleString('id-ID')}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 uppercase tracking-wider">
                                Terverifikasi
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* INCIDENTS INVESTIGATION TAB */}
            {activeTab === 'incidents' && (
              <motion.div
                key="incidents"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="border-b border-border-light dark:border-border-dark pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black">Investigasi Insiden Keamanan</h2>
                    <p className="text-xs text-muted">Bukti forensik serangan terdeteksi (SSRF, traversal, replay, VPN, brute force, dll).</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-rose-500/10 text-rose-500 border border-rose-500/20 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 animate-pulse">
                      <AlertTriangle className="w-4 h-4" /> Telemetri Aktif
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-border-light dark:border-border-dark rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-border-light dark:border-border-dark font-bold text-muted text-[10px] uppercase tracking-wider">
                        <th className="py-3 px-4">Waktu</th>
                        <th className="py-3 px-4">Tipe Serangan</th>
                        <th className="py-3 px-4">Klien IP / Detail</th>
                        <th className="py-3 px-4">Endpoint</th>
                        <th className="py-3 px-4">Tingkat</th>
                        <th className="py-3 px-4">Payload/Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted font-bold text-xs italic">
                            Tidak ada rekaman insiden keamanan terdeteksi.
                          </td>
                        </tr>
                      ) : (
                        incidents.map((incident) => {
                          const getSeverityColor = (sev: string) => {
                            if (sev === 'critical') return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
                            if (sev === 'high') return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
                            if (sev === 'medium') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                            return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
                          };
                          
                          return (
                            <tr key={incident.id} className="border-b border-border-light dark:border-border-dark hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all">
                              <td className="py-3.5 px-4 text-muted font-mono text-[10px]" title={new Date(incident.created_at).toLocaleString()}>
                                {new Date(incident.created_at).toLocaleTimeString('id-ID')}
                              </td>
                              <td className="py-3.5 px-4 font-bold">
                                <span className="text-rose-500 font-mono tracking-wider">{incident.attack_type}</span>
                              </td>
                              <td className="py-3.5 px-4 font-mono">
                                <div className="font-bold text-text-light dark:text-text-dark">{incident.ip_address}</div>
                                <div className="text-[9px] text-muted">{incident.city}, {incident.country} • ASN: {incident.asn || '-'}</div>
                              </td>
                              <td className="py-3.5 px-4 text-muted font-mono font-semibold">
                                {incident.endpoint || '-'}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${getSeverityColor(incident.severity)}`}>
                                  {incident.severity}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-muted max-w-[200px] truncate" title={incident.payload || ''}>
                                <code className="bg-gray-100 dark:bg-gray-950 px-1.5 py-0.5 rounded text-[10px]">{incident.payload || '-'}</code>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'rotating' && (
              <motion.div
                key="rotating"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="border-b border-border-light dark:border-border-dark pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black">Deteksi IP Rotating & Koordinasi Botnet</h2>
                    <p className="text-xs text-muted">Pelacakan sidik jari unik (Unique Fingerprint) klien yang berganti-ganti IP Address serta pemblokiran subnet otomatis.</p>
                  </div>
                </div>

                {/* Subnet Blocks Table */}
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-4 h-4" /> Subnet IP Blocked (/24 atau /64)
                  </h3>
                  <div className="overflow-x-auto border border-border-light dark:border-border-dark rounded-2xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-border-light dark:border-border-dark font-bold text-muted text-[10px] uppercase tracking-wider">
                          <th className="py-3 px-4">Subnet</th>
                          <th className="py-3 px-4">Alasan Pemblokiran</th>
                          <th className="py-3 px-4">Diblokir Sampai</th>
                          <th className="py-3 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subnetBlocks.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-muted font-bold text-xs italic">
                              Tidak ada subnet IP yang sedang diblokir saat ini.
                            </td>
                          </tr>
                        ) : (
                          subnetBlocks.map((block: any) => {
                            const isExpired = new Date(block.blocked_until) < new Date();
                            return (
                              <tr key={block.id} className="border-b border-border-light dark:border-border-dark hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                <td className="py-3 px-4 font-mono font-bold text-sm text-rose-500">
                                  {block.subnet}
                                </td>
                                <td className="py-3 px-4 text-muted">
                                  {block.reason || '-'}
                                </td>
                                <td className="py-3 px-4 font-mono text-muted text-[10px]">
                                  {new Date(block.blocked_until).toLocaleString('id-ID')}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isExpired ? 'bg-gray-100 text-gray-500' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'}`}>
                                    {isExpired ? 'Expired' : 'Blocked'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fingerprint Client IPs Mapping */}
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-4 h-4" /> Pemetaan Fingerprint ke IP Address (Multi-layer Identity)
                  </h3>
                  <div className="overflow-x-auto border border-border-light dark:border-border-dark rounded-2xl max-h-[350px] custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-border-light dark:border-border-dark font-bold text-muted text-[10px] uppercase tracking-wider">
                          <th className="py-3 px-4">Fingerprint</th>
                          <th className="py-3 px-4">IP Address</th>
                          <th className="py-3 px-4">Geolokasi</th>
                          <th className="py-3 px-4">ASN / ISP</th>
                          <th className="py-3 px-4">Terakhir Digunakan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fingerprintIps.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-muted font-bold text-xs italic">
                              Belum ada riwayat pemetaan sidik jari terekam.
                            </td>
                          </tr>
                        ) : (
                          fingerprintIps.map((rec: any) => (
                            <tr key={rec.id} className="border-b border-border-light dark:border-border-dark hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                              <td className="py-3 px-4 font-mono text-[11px] font-bold text-primary truncate max-w-[120px]" title={rec.fingerprint}>
                                {rec.fingerprint}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-text-light dark:text-text-dark">
                                {rec.ip_address}
                              </td>
                              <td className="py-3 px-4 font-semibold">
                                {rec.city}, {rec.country}
                              </td>
                              <td className="py-3 px-4 text-muted">
                                {rec.asn || '-'}
                              </td>
                              <td className="py-3 px-4 font-mono text-muted text-[10px]">
                                {new Date(rec.created_at).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      {/* Custom Premium Confirm Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-3xl shadow-2xl max-w-sm w-full space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-500">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
                <h3 className="font-black text-base text-gray-900 dark:text-white">{confirmModal.title}</h3>
              </div>
              
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 leading-relaxed">
                {confirmModal.message}
              </p>
              
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/25 rounded-xl transition-all"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
