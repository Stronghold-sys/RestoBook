"use client";

import React, { useState, useEffect, useRef } from "react";
import { Globe, Star, Search, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Language {
  name: string;
  flag: string;
}

const SUPPORTED_LANGS: Record<string, Language> = {
  id: { name: "Indonesia", flag: "🇮🇩" },
  en: { name: "English", flag: "🇺🇸" },
  ja: { name: "日本語", flag: "🇯🇵" },
  ko: { name: "한국어", flag: "🇰🇷" },
  zh: { name: "中文", flag: "🇨🇳" },
  ar: { name: "العربية", flag: "🇸🇦" },
  fr: { name: "Français", flag: "🇫🇷" },
  de: { name: "Deutsch", flag: "🇩🇪" }
};

export default function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState("id");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Muat status bahasa aktif, favorit, dan recent dari localStorage pada saat klien ter-mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedLang = localStorage.getItem("rb_i18n_lang");
    if (savedLang && SUPPORTED_LANGS[savedLang]) {
      setCurrentLang(savedLang);
    }

    try {
      const savedFavs = JSON.parse(localStorage.getItem("rb_i18n_favorites") || "[]");
      setFavorites(savedFavs);

      const savedRecents = JSON.parse(localStorage.getItem("rb_i18n_recent") || "[]");
      setRecents(savedRecents);
    } catch (e) {
      console.error("Gagal memuat preferensi bahasa:", e);
    }
  }, []);

  // Sinkronisasi preferensi bahasa pengguna dari metadata cloud Supabase (lintas perangkat)
  useEffect(() => {
    const syncUserLanguage = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const metaLang = session.user.user_metadata?.lang;
        const localLang = localStorage.getItem("rb_i18n_lang") || "id";
        if (metaLang && metaLang !== localLang && SUPPORTED_LANGS[metaLang]) {
          localStorage.setItem("rb_i18n_lang", metaLang);
          document.cookie = `rb_i18n_lang=${metaLang}; path=/; max-age=31536000; SameSite=Lax; Secure`;
          setCurrentLang(metaLang);
          if (typeof window !== "undefined" && (window as any).changeLanguage) {
            (window as any).changeLanguage(metaLang);
          }
        }
      }
    };
    syncUserLanguage().catch(console.error);
  }, []);

  // Event listener untuk menutup dropdown saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update daftar bahasa baru-baru ini ketika bahasa dipilih
  const updateRecents = (code: string) => {
    let updated = recents.filter(item => item !== code);
    updated.unshift(code);
    updated = updated.slice(0, 4); // Batasi 4 bahasa terakhir
    setRecents(updated);
    localStorage.setItem("rb_i18n_recent", JSON.stringify(updated));
  };

  const handleSelectLanguage = async (code: string) => {
    localStorage.setItem("rb_i18n_lang", code);
    document.cookie = `rb_i18n_lang=${code}; path=/; max-age=31536000; SameSite=Lax; Secure`;
    setCurrentLang(code);
    updateRecents(code);
    setIsOpen(false);

    if (typeof window !== "undefined" && (window as any).changeLanguage) {
      (window as any).changeLanguage(code);
    }

    // Sinkronisasi preferensi bahasa ke user metadata cloud Supabase
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.auth.updateUser({
          data: { lang: code }
        });
      }
    } catch (e) {
      console.error("Gagal sinkronisasi bahasa ke cloud:", e);
    }
  };

  const toggleFavorite = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    let updated = [...favorites];
    if (updated.includes(code)) {
      updated = updated.filter(c => c !== code);
    } else {
      updated.push(code);
    }
    setFavorites(updated);
    localStorage.setItem("rb_i18n_favorites", JSON.stringify(updated));
  };

  // Urutkan bahasa: Favorit tampil di atas, diikuti nama bahasa secara alfabetis
  const sortedLanguages = Object.entries(SUPPORTED_LANGS).sort((a, b) => {
    const aFav = favorites.includes(a[0]);
    const bFav = favorites.includes(b[0]);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return a[1].name.localeCompare(b[1].name);
  });

  const filteredLanguages = sortedLanguages.filter(([_, lang]) =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeLangConfig = SUPPORTED_LANGS[currentLang] || SUPPORTED_LANGS.id;

  return (
    <div className="relative" ref={containerRef} id="lang-switcher">
      {/* Tombol Pemicu Dropdown */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Pilih Bahasa"
        title="Ganti Bahasa"
        className="flex items-center gap-1.5 sm:gap-2 px-2 py-2 sm:px-3 sm:py-2.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-muted hover:text-primary hover:border-primary transition-all relative outline-none cursor-pointer"
      >
        <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-muted hover:text-primary transition-colors" />
        <span className="text-xs font-black flex items-center gap-1 sm:gap-1.5">
          <span>{activeLangConfig.flag}</span>
          <span className="hidden sm:inline">{activeLangConfig.name}</span>
        </span>
      </button>

      {/* Dropdown Menu Glassmorphism */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white/90 dark:bg-slate-900/90 border border-border-light dark:border-border-dark rounded-2xl shadow-xl z-[99999] overflow-hidden backdrop-blur-xl animate-in fade-in duration-200">
          {/* Kolom Pencarian */}
          <div className="p-3 border-b border-border-light dark:border-border-dark flex items-center gap-2">
            <Search className="h-4 w-4 text-muted flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari bahasa..."
              className="w-full bg-transparent text-xs text-text-light dark:text-text-dark placeholder-muted outline-none border-none p-0 focus:ring-0 focus:outline-none"
            />
          </div>

          {/* Daftar Bahasa */}
          <div className="max-h-56 overflow-y-auto divide-y divide-border-light/40 dark:divide-border-dark/40">
            {filteredLanguages.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted">
                Tidak ada bahasa ditemukan.
              </div>
            ) : (
              filteredLanguages.map(([code, lang]) => {
                const isSelected = code === currentLang;
                const isFav = favorites.includes(code);

                return (
                  <div
                    key={code}
                    onClick={() => handleSelectLanguage(code)}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer text-xs font-semibold hover:bg-primary/5 hover:text-primary transition-all ${
                      isSelected ? "text-primary bg-primary/5" : "text-text-light dark:text-text-dark"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{lang.flag}</span>
                      <span>{lang.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary ml-1" />}
                    </div>
                    
                    <button
                      onClick={(e) => toggleFavorite(e, code)}
                      aria-label={isFav ? "Hapus dari Favorit" : "Tambah ke Favorit"}
                      className={`p-1 hover:scale-125 transition-transform ${
                        isFav ? "text-amber-400" : "text-muted hover:text-amber-400"
                      }`}
                    >
                      <Star className="h-3.5 w-3.5 fill-current" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Bagian Riwayat Bahasa (Recent) */}
          {recents.length > 0 && (
            <div className="p-3 bg-background-light/50 dark:bg-background-dark/50 border-t border-border-light dark:border-border-dark">
              <span className="text-[10px] font-black uppercase text-muted tracking-wider block mb-2">
                Baru-baru ini digunakan
              </span>
              <div className="flex gap-2 flex-wrap">
                {recents.map((code) => {
                  const lang = SUPPORTED_LANGS[code];
                  if (!lang) return null;
                  return (
                    <button
                      key={code}
                      onClick={() => handleSelectLanguage(code)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-[11px] font-bold text-text-light dark:text-text-dark hover:border-primary hover:text-primary transition-all"
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
