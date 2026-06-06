"use client";

import React, { useState, useEffect, useRef } from "react";
import { Globe, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface Language {
  name: string;
  flag: string;
}

const SUPPORTED_LANGS: Record<string, Language> = {
  id: { name: "Indonesia", flag: "🇮🇩" },
  en: { name: "English", flag: "🇺🇸" }
};

export default function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { lang, setLanguage } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectLanguage = async (code: "id" | "en") => {
    await setLanguage(code);
    setIsOpen(false);
  };

  const activeLangConfig = SUPPORTED_LANGS[lang] || SUPPORTED_LANGS.id;

  return (
    <div className="relative inline-block text-left" ref={containerRef} id="lang-switcher">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Pilih Bahasa / Select Language"
        title="Ganti Bahasa"
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-muted hover:text-primary hover:border-primary transition-all relative outline-none cursor-pointer shadow-sm hover:shadow-md"
      >
        <Globe className="h-4 w-4 text-muted group-hover:text-primary transition-colors" />
        <span className="text-xs font-bold flex items-center gap-1 sm:gap-1.5">
          <span>{activeLangConfig.flag}</span>
          <span className="hidden sm:inline text-text-light dark:text-text-dark font-semibold">
            {activeLangConfig.name}
          </span>
        </span>
      </button>

      {/* Dropdown Menu Glassmorphism */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white/95 dark:bg-slate-900/95 border border-border-light dark:border-border-dark rounded-2xl shadow-xl z-[99999] overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-1.5 space-y-1">
            {(Object.keys(SUPPORTED_LANGS) as Array<"id" | "en">).map((code) => {
              const isSelected = code === lang;
              const item = SUPPORTED_LANGS[code];

              return (
                <button
                  key={code}
                  onClick={() => handleSelectLanguage(code)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs font-bold transition-all text-left outline-none ${
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{item.flag}</span>
                    <span>{item.name}</span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
