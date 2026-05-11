"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Search, Mail, Phone, Calendar, 
  MoreVertical, UserPlus, Filter, Download,
  User, Shield, Trash2, Edit, Loader2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";

export default function AdminCustomersPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const supabase = createClient();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      // Mengambil profile dengan role 'customer'
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'customer')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast.error("Gagal mengambil data pelanggan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => 
    customer.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery)
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black text-text-light dark:text-text-dark tracking-tight">Data Pelanggan</h1>
          </div>
          <p className="text-muted text-sm font-medium">Manajemen data pelanggan setia RestoBook</p>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-primary text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export Data
          </motion.button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Total Pelanggan", value: customers.length, icon: Users, color: "bg-blue-500" },
          { label: "Bergabung Bulan Ini", value: customers.filter(c => new Date(c.created_at).getMonth() === new Date().getMonth()).length, icon: UserPlus, color: "bg-green-500" },
          { label: "Pelanggan Aktif", value: customers.length, icon: Shield, color: "bg-purple-500" },
        ].map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-6 bg-white dark:bg-gray-800 rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm flex items-center gap-5"
          >
            <div className={`p-4 ${stat.color} text-white rounded-2xl shadow-lg`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-muted text-xs font-bold uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-2xl font-black text-text-light dark:text-text-dark mt-0.5">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter & Table Section */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="p-8 border-b border-border-light dark:border-border-dark flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text" 
              placeholder="Cari nama, email, atau no. telepon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-primary rounded-2xl outline-none transition-all text-sm font-medium"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border border-border-light dark:border-border-dark">
              <Filter className="w-4 h-4 text-muted" />
              <select 
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none"
                title="Filter Status Pelanggan"
                aria-label="Filter Status Pelanggan"
              >
                <option value="all">Semua Pelanggan</option>
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">Pelanggan</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">Kontak</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">Tgl Bergabung</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted font-bold">Sedang memuat data...</p>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-muted font-medium italic">
                    Tidak ada pelanggan yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gray-100 border-2 border-white dark:border-gray-700 shadow-sm flex-shrink-0">
                          {customer.avatar_url ? (
                            <img src={customer.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                              <User className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-black text-text-light dark:text-text-dark text-sm">{customer.full_name || "Tanpa Nama"}</p>
                          <p className="text-[10px] font-mono text-muted uppercase">UID: {customer.user_id?.split('-')[0]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted">
                          <Mail className="w-3 h-3" /> {customer.email}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-muted">
                          <Phone className="w-3 h-3" /> {customer.phone || "-"}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-xs font-bold text-text-light dark:text-text-dark">
                        <Calendar className="w-4 h-4 text-primary/50" />
                        {format(new Date(customer.created_at), 'dd MMM yyyy', { locale: id })}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-[10px] font-black uppercase tracking-wider">
                        Aktif
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 hover:bg-amber-100 hover:text-amber-600 rounded-xl transition-colors text-muted" title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors text-muted" title="Hapus">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
