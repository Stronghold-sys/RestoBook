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

    function translateCurrencyInString(text: string, targetLang: "id" | "en"): string {
      if (targetLang === "en") {
        // Replace Rp / Rp. with IDR, and convert Indonesian number formatting to English (dots to commas)
        return text.replace(/(?:Rp\.?\s?)([0-9]+(?:\.[0-9]{3})*(?:,[0-9]+)?)/gi, (match, numStr) => {
          const cleanNum = numStr.replace(/\./g, "").replace(/,/g, ".");
          const val = Number(cleanNum);
          if (!isNaN(val)) {
            const formatted = new Intl.NumberFormat("en-US", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            }).format(val);
            return `IDR ${formatted}`;
          }
          return `IDR ${numStr}`;
        }).replace(/\brp\b/gi, "IDR");
      } else {
        // Replace IDR with Rp, and convert English number formatting to Indonesian (commas to dots)
        return text.replace(/(?:IDR\s?)([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/gi, (match, numStr) => {
          const cleanNum = numStr.replace(/,/g, "");
          const val = Number(cleanNum);
          if (!isNaN(val)) {
            const formatted = new Intl.NumberFormat("id-ID", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            }).format(val);
            return `Rp ${formatted}`;
          }
          return `Rp ${numStr}`;
        }).replace(/\bidr\b/gi, "Rp");
      }
    }

    function translateTextNode(node: Node) {
      const text = node.nodeValue;
      if (!text) return;

      const trimmed = text.trim();
      if (!trimmed || trimmed.length <= 1) return;

      // Check if we have the original value cached
      const origText = (node as any)._originalVal || text;
      const cleanOrig = origText.trim().toLowerCase();

      let translated = origText;
      if (lang === "en") {
        if (idToEnMap.has(cleanOrig)) {
          translated = idToEnMap.get(cleanOrig) || origText;
        }
      } else {
        if (enToIdMap.has(cleanOrig)) {
          translated = enToIdMap.get(cleanOrig) || origText;
        }
      }

      // Now apply currency translation on the translated string
      const finalVal = translateCurrencyInString(translated, lang);
      
      if (node.nodeValue !== finalVal) {
        (node as any)._originalVal = origText;
        node.nodeValue = finalVal;
      }
    }

    function translateAttributes(el: HTMLElement) {
      const attrs = ["placeholder", "title", "alt", "aria-label"];
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i];
        const val = el.getAttribute(attr);
        if (!val) continue;

        const origVal = (el as any)[`_orig_${attr}`] || val;
        const cleanOrig = origVal.trim().toLowerCase();

        let translated = origVal;
        if (lang === "en") {
          if (idToEnMap.has(cleanOrig)) {
            translated = idToEnMap.get(cleanOrig) || origVal;
          }
        } else {
          if (enToIdMap.has(cleanOrig)) {
            translated = enToIdMap.get(cleanOrig) || origVal;
          }
        }

        const finalVal = translateCurrencyInString(translated, lang);
        if (val !== finalVal) {
          (el as any)[`_orig_${attr}`] = origVal;
          el.setAttribute(attr, finalVal);
        }
      }
    }

    function walk(root: Node) {
      if (root.nodeType === Node.ELEMENT_NODE) {
        const el = root as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (!["script", "style", "pre", "code", "noscript"].includes(tag) && 
            !el.closest("#lang-switcher") && !el.closest(".lang-switcher-wrap") && !el.closest("[data-no-translate]")) {
          translateAttributes(el);
          
          const allElements = el.getElementsByTagName("*");
          for (let i = 0; i < allElements.length; i++) {
            const childEl = allElements[i] as HTMLElement;
            const childTag = childEl.tagName.toLowerCase();
            if (!["script", "style", "pre", "code", "noscript"].includes(childTag) &&
                !childEl.closest("#lang-switcher") && !childEl.closest(".lang-switcher-wrap") && !childEl.closest("[data-no-translate]")) {
              translateAttributes(childEl);
            }
          }
        }
      }

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
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        if (mutation.type === "childList") {
          const addedNodes = mutation.addedNodes;
          for (let j = 0; j < addedNodes.length; j++) {
            const addedNode = addedNodes[j];
            if (addedNode.nodeType === Node.ELEMENT_NODE) {
              if (!(addedNode as HTMLElement).closest("#lang-switcher") && !(addedNode as HTMLElement).closest(".lang-switcher-wrap")) {
                walk(addedNode);
              }
            } else if (addedNode.nodeType === Node.TEXT_NODE) {
              const parent = addedNode.parentElement;
              if (parent && !parent.closest("#lang-switcher") && !parent.closest(".lang-switcher-wrap") && !parent.closest("[data-no-translate]")) {
                translateTextNode(addedNode);
              }
            }
          }
        } else if (mutation.type === "characterData") {
          const node = mutation.target;
          if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentElement;
            if (parent && !parent.closest("#lang-switcher") && !parent.closest(".lang-switcher-wrap") && !parent.closest("[data-no-translate]")) {
              translateTextNode(node);
            }
          }
        } else if (mutation.type === "attributes") {
          const node = mutation.target;
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (!el.closest("#lang-switcher") && !el.closest(".lang-switcher-wrap") && !el.closest("[data-no-translate]")) {
              translateAttributes(el);
            }
          }
        }
      }
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["placeholder", "title", "alt", "aria-label"],
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "alt", "aria-label"],
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
