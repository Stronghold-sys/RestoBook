"use client";

import { useState, useEffect } from "react";
import { Lock, Mail, Phone, Eye, EyeOff, Loader2, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import BaseModal from "@/components/BaseModal";
import { useActivityStore } from "@/store/useActivityStore";

interface ProfilePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  phone: string;
  fullName: string;
  role: string;
}

export default function ProfilePasswordModal({
  isOpen,
  onClose,
  email,
  phone,
  fullName,
  role
}: ProfilePasswordModalProps) {
  const supabase = createClient();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [otpMethod, setOtpMethod] = useState<"email" | "whatsapp">("email");
  const [submittingPass, setSubmittingPass] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [waCountdown, setWaCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (waCountdown > 0) {
      timer = setInterval(() => setWaCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [waCountdown]);

  const handleSendOTP = async () => {
    if (!oldPassword.trim()) return toast.error("Masukkan password lama Anda terlebih dahulu");
    setSubmittingPass(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword
      });
      if (signInError) throw new Error("Password lama tidak sesuai. Silakan coba kembali.");

      if (role === "admin") {
        toast.success("Password lama terverifikasi! Masukkan password baru Anda.");
        setStep("verify");
        return;
      }

      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          phone,
          method: otpMethod,
          type: "change_password",
          name: fullName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim OTP");
      
      toast.success(`Kode OTP dikirim via ${otpMethod === 'email' ? 'Email' : 'WhatsApp'}!`);
      setStep("verify");
      if (otpMethod === 'email') setCountdown(60);
      else setWaCountdown(60);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmittingPass(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) return toast.error("Password baru minimal 6 karakter");
    if (role !== "admin" && otp.length < 6) return toast.error("Masukkan kode OTP 6 digit");
    setSubmittingPass(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp: role === "admin" ? undefined : otp,
          newPassword,
          userId: session?.user.id,
          isAdminBypass: role === "admin"
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal ganti password");
      
      toast.success("Password berhasil diubah!");
      useActivityStore.getState().addLog("Ubah Keamanan", "Berhasil mengubah password akun secara aman.");
      onClose();
      // Reset state
      setStep("request");
      setOtp("");
      setNewPassword("");
      setOldPassword("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmittingPass(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} showCloseButton={true}>
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-2xl font-black text-text-light dark:text-text-dark uppercase tracking-wide">
          Ganti Password
        </h3>
        <p className="text-sm text-muted mt-2">
          {step === "request"
            ? "Masukkan password lama dan pilih metode OTP"
            : "Masukkan kode OTP yang diterima & password baru"}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <div className="flex-1 h-1.5 rounded-full bg-primary" />
        <div
          className={`flex-1 h-1.5 rounded-full transition-all ${
            step === "verify" ? "bg-primary" : "bg-gray-200 dark:bg-gray-750"
          }`}
        />
      </div>

      {step === "request" ? (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="oldPasswordModalInput" className="text-xs font-black uppercase text-muted ml-1">
              Password Lama
            </label>
            <div className="relative">
              <input
                id="oldPasswordModalInput"
                type={showOldPass ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 font-mono text-text-light dark:text-text-dark"
                placeholder="Masukkan password saat ini..."
                title="Password Lama"
              />
              <button
                type="button"
                onClick={() => setShowOldPass(!showOldPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-text-light dark:hover:text-text-dark"
              >
                {showOldPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase text-muted ml-1">Kirim OTP Ke</label>
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl gap-2">
              <button
                type="button"
                onClick={() => setOtpMethod("email")}
                className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                  otpMethod === "email" ? "bg-white dark:bg-gray-700 shadow-sm text-primary" : "text-muted"
                }`}
              >
                <Mail className="w-4 h-4" /> Email
              </button>
              <button
                type="button"
                onClick={() => setOtpMethod("whatsapp")}
                className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                  otpMethod === "whatsapp" ? "bg-white dark:bg-gray-700 shadow-sm text-green-500" : "text-muted"
                }`}
              >
                <Phone className="w-4 h-4" /> WhatsApp
              </button>
            </div>
          </div>

          <button
            onClick={handleSendOTP}
            disabled={submittingPass || !oldPassword.trim()}
            className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 uppercase text-xs disabled:opacity-50"
          >
            {submittingPass ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : role === "admin" ? (
              "Verifikasi Password"
            ) : (
              "Verifikasi & Kirim OTP"
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {role !== "admin" && (
            <div className="space-y-1.5">
              <label htmlFor="otpModalInput" className="text-xs font-black uppercase text-muted ml-1">
                Kode OTP
              </label>
              <input
                id="otpModalInput"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                type="text"
                inputMode="numeric"
                className="w-full px-4 py-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 text-center text-2xl font-black tracking-[10px] text-text-light dark:text-text-dark"
                placeholder="000000"
                title="Masukkan Kode OTP"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="newPasswordModalInput" className="text-xs font-black uppercase text-muted ml-1">
              Password Baru
            </label>
            <div className="relative">
              <input
                id="newPasswordModalInput"
                type={showNewPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 font-mono text-text-light dark:text-text-dark"
                placeholder="Minimal 6 karakter..."
                title="Password Baru"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-text-light dark:hover:text-text-dark"
              >
                {showNewPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button
            onClick={handleChangePassword}
            disabled={submittingPass}
            className="w-full py-4 bg-green-500 text-white rounded-2xl font-black shadow-xl shadow-green-500/20 hover:bg-green-600 transition-all flex items-center justify-center gap-2 uppercase text-xs"
          >
            {submittingPass ? <Loader2 className="w-5 h-5 animate-spin" /> : "Konfirmasi Ganti Password"}
          </button>

          <div className="text-center space-y-2 mt-4">
            {role !== "admin" && (
              <>
                <p className="text-[10px] font-black uppercase text-muted">Belum menerima kode?</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setOtpMethod("email");
                      handleSendOTP();
                    }}
                    disabled={countdown > 0 || submittingPass}
                    className="text-[11px] font-bold text-primary hover:underline disabled:text-muted flex items-center justify-center gap-2 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl"
                  >
                    <Mail className="w-3.5 h-3.5" />{" "}
                    {countdown > 0 ? `Kirim Ulang Email (${countdown}s)` : "Kirim Ulang via Email"}
                  </button>
                  <button
                    onClick={() => {
                      setOtpMethod("whatsapp");
                      handleSendOTP();
                    }}
                    disabled={waCountdown > 0 || submittingPass}
                    className="text-[11px] font-bold text-green-600 hover:underline disabled:text-muted flex items-center justify-center gap-2 py-2 bg-green-50 dark:bg-green-900/20 rounded-xl"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />{" "}
                    {waCountdown > 0 ? `Kirim via WhatsApp (${waCountdown}s)` : "Kirim via WhatsApp Saja"}
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setStep("request");
                setOtp("");
                setNewPassword("");
              }}
              className="text-[11px] font-bold text-muted hover:text-text-light dark:hover:text-text-dark py-2"
            >
              ← Kembali
            </button>
          </div>
        </div>
      )}
    </BaseModal>
  );
}
