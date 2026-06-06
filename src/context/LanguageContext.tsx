"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import idTranslations from "../../locales/id.json";
import enTranslations from "../../locales/en.json";

type Language = "id" | "en";

interface LanguageContextType {
  lang: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (path: string, defaultValue?: string) => string;
  formatCurrency: (amount: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Helper to resolve nested keys like 'common.save' from JSON
function resolvePath(obj: any, path: string): string | null {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return null;
    current = current[part];
  }
  return typeof current === "string" ? current : null;
}

// Build a flat dictionary mapping for text nodes: ID text -> EN text
function buildTranslationMaps(idObj: any, enObj: any, idToEnMap: Map<string, string>, enToIdMap: Map<string, string>) {
  function recurse(idVal: any, enVal: any) {
    if (typeof idVal === "string" && typeof enVal === "string") {
      const idClean = idVal.trim().toLowerCase();
      const enClean = enVal.trim().toLowerCase();
      idToEnMap.set(idClean, enVal);
      enToIdMap.set(enClean, idVal);
    } else if (typeof idVal === "object" && typeof enVal === "object" && idVal !== null && enVal !== null) {
      for (const key in idVal) {
        if (Object.prototype.hasOwnProperty.call(idVal, key) && enVal[key]) {
          recurse(idVal[key], enVal[key]);
        }
      }
    }
  }
  recurse(idObj, enObj);
}

const idToEnMap = new Map<string, string>();
const enToIdMap = new Map<string, string>();
buildTranslationMaps(idTranslations, enTranslations, idToEnMap, enToIdMap);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("id");

  // Read initial language on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Check localStorage
    const saved = localStorage.getItem("rb_i18n_lang");
    if (saved === "id" || saved === "en") {
      setLangState(saved);
      return;
    }

    // 2. Check cookies
    const cookieLang = document.cookie
      .split("; ")
      .find((row) => row.startsWith("rb_i18n_lang="))
      ?.split("=")[1];
    if (cookieLang === "id" || cookieLang === "en") {
      setLangState(cookieLang);
      return;
    }

    // 3. Check browser settings
    const browserLang = navigator.language.split("-")[0];
    if (browserLang === "id" || browserLang === "en") {
      setLangState(browserLang);
      return;
    }

    // Default fallback
    setLangState("id");
  }, []);

  const setLanguage = async (newLang: Language) => {
    setLangState(newLang);
    if (typeof window === "undefined") return;

    // Persist in localStorage
    localStorage.setItem("rb_i18n_lang", newLang);

    // Persist in cookie (1 year expiration)
    document.cookie = `rb_i18n_lang=${newLang}; path=/; max-age=31536000; SameSite=Lax; Secure`;

    // Re-render HTML lang attribute
    document.documentElement.lang = newLang;

    // Sync to Supabase user profile metadata if logged in
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.auth.updateUser({
          data: { lang: newLang },
        });
      }
    } catch (err) {
      console.error("Gagal sinkronisasi bahasa ke Supabase metadata:", err);
    }
  };

  // Translation lookup t(key)
  const t = (path: string, defaultValue?: string): string => {
    const translations = lang === "id" ? idTranslations : enTranslations;
    const resolved = resolvePath(translations, path);
    if (resolved) return resolved;

    // Fallback to English if current is Indonesian and key is missing
    if (lang === "id") {
      const fallbackResolved = resolvePath(enTranslations, path);
      if (fallbackResolved) return fallbackResolved;
    } else {
      // Fallback to Indonesian if current is English and key is missing
      const fallbackResolved = resolvePath(idTranslations, path);
      if (fallbackResolved) return fallbackResolved;
    }

    return defaultValue || path;
  };

  // Currency Formatter formatCurrency(amount)
  const formatCurrency = (amount: number): string => {
    const num = Number(amount) || 0;
    if (lang === "id") {
      // format: Rp 1.000.000
      const formatted = new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
      return `Rp ${formatted}`;
    } else {
      // format: IDR 1,000,000
      const formatted = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
      return `IDR ${formatted}`;
    }
  };

  // DOM mutation observer for untranslated text nodes (100% offline local matching)
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    function translateTextNode(node: Node) {
      const text = node.nodeValue?.trim();
      if (!text || text.length <= 1 || /^[0-9\s!@#$%^&*()_+\-=\[\]{};':",./<>?|\\`~]*$/.test(text)) return;

      const cleanText = text.toLowerCase();
      if (lang === "en") {
        // If we want English, find if the text is in ID translations
        if (idToEnMap.has(cleanText)) {
          const enVal = idToEnMap.get(cleanText);
          if (enVal) {
            // Store original text in node property for reference
            (node as any)._originalVal = node.nodeValue;
            node.nodeValue = enVal;
          }
        }
      } else {
        // If we want Indonesian, find if text is in EN translations and revert
        if (enToIdMap.has(cleanText)) {
          const idVal = enToIdMap.get(cleanText);
          if (idVal) {
            (node as any)._originalVal = node.nodeValue;
            node.nodeValue = idVal;
          }
        }
      }
    }

    function walk(root: Node) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (["script", "style", "textarea", "input", "pre", "code", "noscript", "option"].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest("#lang-switcher") || parent.closest(".lang-switcher-wrap") || parent.closest("[data-no-translate]")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      let node;
      while ((node = walker.nextNode())) {
        translateTextNode(node);
      }
    }

    // Run on initial load
    walk(document.body);

    // Watch for dynamic DOM changes
    const observer = new MutationObserver((mutations) => {
      observer.disconnect(); // Avoid feedback loops
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const addedNodes = mutation.addedNodes;
          for (let i = 0; i < addedNodes.length; i++) {
            const addedNode = addedNodes[i];
            if (addedNode.nodeType === Node.ELEMENT_NODE) {
              if (!(addedNode as HTMLElement).closest("#lang-switcher")) {
                walk(addedNode);
              }
            } else if (addedNode.nodeType === Node.TEXT_NODE) {
              const parent = addedNode.parentElement;
              if (parent && !parent.closest("#lang-switcher") && !parent.closest("[data-no-translate]")) {
                translateTextNode(addedNode);
              }
            }
          }
        } else if (mutation.type === "characterData") {
          const node = mutation.target;
          if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentElement;
            if (parent && !parent.closest("#lang-switcher") && !parent.closest("[data-no-translate]")) {
              translateTextNode(node);
            }
          }
        }
      }
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t, formatCurrency }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
