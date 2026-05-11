"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Mail, Lock, User, Phone, CheckCircle, Loader2, ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    code: "",
  });
  const [otpMethod, setOtpMethod] = useState<"email" | "whatsapp">("email");

  const [countdown, setCountdown] = useState(0);
  const [waCountdown, setWaCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (waCountdown > 0) {
      timer = setTimeout(() => setWaCountdown(waCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [waCountdown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.fullName) return toast.error("Nama lengkap tidak boleh kosong");
    if (!formData.email) return toast.error("Email tidak boleh kosong");
    if (!formData.password || formData.password.length < 6) return toast.error("Password minimal 6 karakter");
    if (formData.password !== formData.confirmPassword) return toast.error("Password dan konfirmasi password tidak cocok");

    setLoading(true);
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: formData.email, 
          phone: formData.phone,
          method: otpMethod,
          type: "registration", 
          name: formData.fullName 
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      toast.success(`Kode OTP telah dikirim via ${otpMethod === 'email' ? 'Email' : 'WhatsApp'}!`);
      setStep(2);
      if (otpMethod === 'email') setCountdown(60);
      else setWaCountdown(60);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || formData.code.length !== 6) return toast.error("Masukkan 6 digit kode OTP");

    setLoading(true);
    try {
      // Verify OTP
      const resVerify = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, code: formData.code, type: "registration" }),
      });
      const dataVerify = await resVerify.json();

      if (!resVerify.ok) throw new Error(dataVerify.error);

      // Register User
      const resReg = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const dataReg = await resReg.json();

      if (!resReg.ok) throw new Error(dataReg.error);

      toast.success("Pendaftaran berhasil!");
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Gagal verifikasi/pendaftaran");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4 overflow-hidden">
      <motion.div
        layout
        className="max-w-md w-full bg-card-light dark:bg-card-dark rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="bg-primary p-8 text-center relative">
          {step === 2 && (
            <button onClick={() => setStep(1)} aria-label="Kembali" title="Kembali" className="absolute top-4 left-4 text-white/80 hover:text-white transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <motion.div
            layoutId="icon-container"
            className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            {step === 3 ? (
              <CheckCircle className="w-8 h-8 text-white" />
            ) : (
              <UserPlus className="w-8 h-8 text-white" />
            )}
          </motion.div>
          <h1 className="text-2xl font-bold text-white">
            {step === 1 ? "Buat Akun Baru" : step === 2 ? "Verifikasi Email" : "Pendaftaran Selesai!"}
          </h1>
          <p className="text-white/80 mt-2 text-sm">
            {step === 1 ? "Bergabunglah dengan RestoBook" : step === 2 ? `Masukkan kode OTP yang dikirim ke ${formData.email}` : "Akun Anda telah berhasil dibuat."}
          </p>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.form
                key="step1"
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                onSubmit={handleSendOTP}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="regName" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Nama Lengkap</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-muted" />
                    <input id="regName" title="Nama Lengkap" name="fullName" value={formData.fullName} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="Budi Santoso" />
                  </div>
                </div>
                <div>
                  <label htmlFor="regEmail" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-muted" />
                    <input id="regEmail" title="Email" type="email" name="email" value={formData.email} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="budi@email.com" />
                  </div>
                </div>
                <div>
                  <label htmlFor="regPassword" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-muted" />
                    <input id="regPassword" title="Password" type="password" name="password" value={formData.password} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="Minimal 6 karakter" />
                  </div>
                </div>
                <div>
                  <label htmlFor="regConfirmPassword" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Konfirmasi Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-muted" />
                    <input id="regConfirmPassword" title="Konfirmasi Password" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="Ulangi password" />
                  </div>
                </div>
                <div>
                  <label htmlFor="regPhone" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">No Telepon (Opsional)</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-5 w-5 text-muted" />
                    <input id="regPhone" title="No Telepon" type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="08123456789" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase text-muted ml-1">Kirim OTP Via:</label>
                  <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl gap-2">
                    <button 
                      type="button"
                      onClick={() => setOtpMethod("email")}
                      className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${otpMethod === "email" ? "bg-white dark:bg-gray-700 shadow-sm text-primary" : "text-muted"}`}
                    >
                      <Mail className="w-4 h-4" /> Email
                    </button>
                    <button 
                      type="button"
                      onClick={() => setOtpMethod("whatsapp")}
                      className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${otpMethod === "whatsapp" ? "bg-white dark:bg-gray-700 shadow-sm text-green-500" : "text-muted"}`}
                    >
                      <MessageSquare className="w-4 h-4" /> WhatsApp
                    </button>
                  </div>
                </div>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={loading} type="submit" className="w-full mt-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium flex justify-center items-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Lanjutkan & Kirim OTP"}
                </motion.button>
                <p className="text-center text-sm text-muted mt-4">Sudah punya akun? <Link href="/login" className="text-primary font-medium hover:underline">Masuk di sini</Link></p>
              </motion.form>
            )}

            {step === 2 && (
              <motion.form
                key="step2"
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -100, opacity: 0 }}
                onSubmit={handleVerifyAndRegister}
                className="space-y-6"
              >
                <div>
                  <label htmlFor="regCode" className="text-sm font-medium text-text-light dark:text-text-dark mb-2 block text-center">Kode OTP 6 Digit</label>
                  <input id="regCode" title="Kode OTP" type="text" maxLength={6} name="code" value={formData.code} onChange={handleChange} className="w-full text-center text-2xl tracking-[0.5em] font-bold py-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark" placeholder="000000" />
                </div>
                
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={loading} type="submit" className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium flex justify-center items-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verifikasi & Daftar"}
                </motion.button>

                <div className="text-center space-y-3">
                  <p className="text-sm text-muted">Belum menerima kode?</p>
                  <div className="flex flex-col gap-2">
                    <button 
                      type="button" 
                      disabled={countdown > 0 || loading} 
                      onClick={() => {
                        setOtpMethod("email");
                        handleSendOTP();
                      }} 
                      className="text-xs font-bold text-primary hover:underline disabled:text-muted flex items-center justify-center gap-2 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl"
                    >
                      <Mail className="w-4 h-4" /> {countdown > 0 ? `Kirim ulang Email (${countdown}s)` : "Kirim Ulang via Email"}
                    </button>
                    
                    <button 
                      type="button" 
                      disabled={waCountdown > 0 || loading} 
                      onClick={() => {
                        setOtpMethod("whatsapp");
                        handleSendOTP();
                      }} 
                      className="text-xs font-bold text-green-600 hover:underline disabled:text-muted flex items-center justify-center gap-2 py-2 bg-green-50 dark:bg-green-900/20 rounded-xl"
                    >
                      <MessageSquare className="w-4 h-4" /> {waCountdown > 0 ? `Kirim via WhatsApp (${waCountdown}s)` : "Kirim via WhatsApp Saja"}
                    </button>
                  </div>
                </div>
              </motion.form>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-6"
              >
                <p className="text-text-light dark:text-text-dark">Silakan login untuk mulai memesan meja dan makanan favorit Anda!</p>
                <Link href="/login" className="block w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors">
                  Pergi ke Halaman Login
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
