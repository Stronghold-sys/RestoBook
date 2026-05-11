"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Mail, Lock, CheckCircle, Loader2, ArrowLeft, Phone, MessageSquare } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    identifier: "", // Can be email or phone
    code: "",
    password: "",
    confirmPassword: "",
  });
  const [method, setMethod] = useState<"email" | "whatsapp">("email");

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
    if (waCountdown > 0) {
      const timer = setTimeout(() => setWaCountdown(waCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [waCountdown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendOTP = async (targetMethod?: "email" | "whatsapp") => {
    if (!formData.identifier) return toast.error("Email atau No. HP tidak boleh kosong");

    const isPhone = /^\d+$/.test(formData.identifier) || formData.identifier.startsWith('08') || formData.identifier.startsWith('62');
    const selectedMethod = targetMethod || (isPhone ? "whatsapp" : "email");
    setMethod(selectedMethod);

    setLoading(true);
    try {
      const payload: any = { 
        type: "forgot_password", 
        name: "Pengguna",
        method: selectedMethod
      };

      if (selectedMethod === "whatsapp") {
        if (isPhone) {
          payload.phone = formData.identifier;
        } else {
          payload.email = formData.identifier;
        }
      } else {
        payload.email = formData.identifier;
      }

      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      toast.success(`Kode reset password telah dikirim via ${selectedMethod === 'email' ? 'Email' : 'WhatsApp'}!`);
      setStep(2);
      if (selectedMethod === 'email') {
        setCountdown(60);
      } else {
        setWaCountdown(60);
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim kode");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || formData.code.length !== 6) return toast.error("Masukkan 6 digit kode OTP");
    if (!formData.password || formData.password.length < 6) return toast.error("Password baru minimal 6 karakter");
    if (formData.password !== formData.confirmPassword) return toast.error("Konfirmasi password tidak cocok");

    setLoading(true);
    try {
      // Verify OTP
      const resVerify = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.identifier, code: formData.code, type: "forgot_password" }),
      });
      const dataVerify = await resVerify.json();

      if (!resVerify.ok) throw new Error(dataVerify.error);

      // Reset Password
      const resReset = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.identifier, code: formData.code, password: formData.password }),
      });
      const dataReset = await resReset.json();

      if (!resReset.ok) throw new Error(dataReset.error);

      toast.success("Password berhasil diubah!");
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Gagal mereset password");
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
            layoutId="icon-container-fp"
            className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            {step === 3 ? (
              <CheckCircle className="w-8 h-8 text-white" />
            ) : (
              <KeyRound className="w-8 h-8 text-white" />
            )}
          </motion.div>
          <h1 className="text-2xl font-bold text-white">
            {step === 1 ? "Lupa Password" : step === 2 ? "Set Password Baru" : "Sukses!"}
          </h1>
          <p className="text-white/80 mt-2 text-sm">
            {step === 1 ? "Masukkan email yang terdaftar" : step === 2 ? `Masukkan kode OTP dan password baru` : "Password Anda telah berhasil diubah."}
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
                onSubmit={(e) => { e.preventDefault(); handleSendOTP(); }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="fpIdentifier" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Email atau No. WhatsApp</label>
                  <div className="relative">
                    {/^\d+$/.test(formData.identifier) ? (
                      <Phone className="absolute left-3 top-3 h-5 w-5 text-muted" />
                    ) : (
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-muted" />
                    )}
                    <input id="fpIdentifier" title="Email atau No. HP" type="text" name="identifier" value={formData.identifier} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="Email atau 0812..." />
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={loading} type="submit" className="w-full mt-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium flex justify-center items-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Kirim OTP"}
                </motion.button>
                <p className="text-center text-sm text-muted mt-4"><Link href="/login" className="text-primary font-medium hover:underline">Kembali ke Login</Link></p>
              </motion.form>
            )}

            {step === 2 && (
              <motion.form
                key="step2"
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -100, opacity: 0 }}
                onSubmit={handleVerifyAndReset}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="fpCode" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Kode OTP 6 Digit</label>
                  <input id="fpCode" title="Kode OTP" type="text" maxLength={6} name="code" value={formData.code} onChange={handleChange} autoComplete="off" className="w-full text-center text-xl tracking-[0.3em] font-bold py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="000000" />
                </div>
                <div>
                  <label htmlFor="fpPassword" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Password Baru</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-muted" />
                    <input id="fpPassword" title="Password Baru" type="password" name="password" value={formData.password} onChange={handleChange} autoComplete="new-password" className="w-full pl-10 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="********" />
                  </div>
                </div>
                <div>
                  <label htmlFor="fpConfirm" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Konfirmasi Password Baru</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-muted" />
                    <input id="fpConfirm" title="Konfirmasi Password Baru" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} autoComplete="new-password" className="w-full pl-10 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="********" />
                  </div>
                </div>
                
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={loading} type="submit" className="w-full mt-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium flex justify-center items-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Simpan Password Baru"}
                </motion.button>

                <div className="text-center mt-4 space-y-3">
                  <div className="flex flex-col items-center gap-2 mt-6">
                    <p className="text-sm text-muted">Belum menerima kode?</p>
                    
                    <button 
                      type="button"
                      onClick={() => handleSendOTP('email')} 
                      disabled={loading || countdown > 0}
                      className="flex items-center gap-2 text-sm text-primary font-medium hover:underline disabled:text-muted disabled:no-underline"
                    >
                      <Mail className="w-4 h-4" /> 
                      {countdown > 0 ? `Kirim ulang Email (${countdown}s)` : "Kirim Ulang via Email"}
                    </button>

                    <button 
                      type="button"
                      onClick={() => handleSendOTP('whatsapp')} 
                      disabled={loading || waCountdown > 0}
                      className="flex items-center gap-2 text-sm text-green-600 font-medium hover:underline disabled:text-muted disabled:no-underline"
                    >
                      <MessageSquare className="w-4 h-4" /> 
                      {waCountdown > 0 ? `Kirim via WhatsApp (${waCountdown}s)` : "Kirim via WhatsApp Saja"}
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
                <p className="text-text-light dark:text-text-dark">Sekarang Anda dapat login menggunakan password baru.</p>
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
