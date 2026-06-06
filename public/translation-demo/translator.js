/**
 * translator.js — Core Client-Side Translation Engine
 * ──────────────────────────────────────────────────
 * Mendukung caching, multi-provider API, rate limit queue,
 * exponential backoff, serta escape HTML untuk pencegahan XSS.
 */

// ─── KONFIGURASI SISTEM ─────────────────────────────────────────────────────
const CONFIG = {
  DEFAULT_LANG: "id",
  SUPPORTED_LANGS: {
    id: { name: "Indonesia", flag: "🇮🇩" },
    en: { name: "English", flag: "🇺🇸" },
    ja: { name: "日本語", flag: "🇯🇵" },
    ko: { name: "한국어", flag: "🇰🇷" },
    zh: { name: "中文", flag: "🇨🇳" },
    ar: { name: "العربية", flag: "🇸🇦" },
    fr: { name: "Français", flag: "🇫🇷" },
    de: { name: "Deutsch", flag: "🇩🇪" }
  },
  CACHE_PREFIX: "rb_i18n_cache_",
  FAVORITES_KEY: "rb_i18n_favorites",
  RECENT_KEY: "rb_i18n_recent",
  CURRENT_LANG_KEY: "rb_i18n_lang",
  
  // API endpoints gratis
  API_PROVIDERS: {
    libre: "https://libretranslate.de/translate", // Publik instance (bisa rate-limited)
    mymemory: "https://api.mymemory.translated.net/get",
    lingva: "https://lingva.ml/api/v1"
  }
};

// ─── STATE ENGINE ────────────────────────────────────────────────────────────
const state = {
  currentLanguage: CONFIG.DEFAULT_LANG,
  fallbackDictionary: {}, // Diisi dari fallback.json
  cache: {},             // Memori cache runtime
  favorites: [],
  recent: [],
  queue: [],             // Request queue
  isProcessingQueue: false,
  status: "idle",        // translating, ready, cached, failed, fallback
  stats: {
    totalTranslated: 0,
    totalCached: 0,
    totalFailed: 0,
    apiCalls: 0
  },
  logs: []
};

// ─── HELPER: LOGGING KONSOL ─────────────────────────────────────────────────
function writeLog(type, message) {
  const timestamp = new Date().toLocaleTimeString();
  const entry = { timestamp, type, message };
  state.logs.push(entry);
  
  // Truncate logs if too many
  if (state.logs.length > 50) state.logs.shift();
  
  // Update UI konsol jika elemen ada
  const logContainer = document.getElementById("log-console");
  if (logContainer) {
    const entryDiv = document.createElement("div");
    entryDiv.className = `log-entry`;
    entryDiv.innerHTML = `
      <span class="log-time">[${timestamp}]</span>
      <span class="log-type ${type}">${type.toUpperCase()}</span>
      <span class="log-message">${escapeHTML(message)}</span>
    `;
    logContainer.appendChild(entryDiv);
    logContainer.scrollTop = logContainer.scrollHeight;
  }
}

// ─── HELPER: KEAMANAN & SANITASI (Anti-XSS) ──────────────────────────────────
function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ─── 1. DETEKSI BAHASA BROWSER ──────────────────────────────────────────────
function detectBrowserLanguage() {
  if (typeof window === "undefined") return CONFIG.DEFAULT_LANG;
  
  // 1. Cek local storage terlebih dahulu
  const savedLang = localStorage.getItem(CONFIG.CURRENT_LANG_KEY);
  if (savedLang && CONFIG.SUPPORTED_LANGS[savedLang]) {
    writeLog("info", `Menggunakan bahasa tersimpan dari LocalStorage: ${savedLang}`);
    return savedLang;
  }
  
  // 2. Deteksi browser language
  const browserLang = (navigator.language || navigator.userLanguage || "").split("-")[0];
  if (CONFIG.SUPPORTED_LANGS[browserLang]) {
    writeLog("info", `Berhasil mendeteksi bahasa browser: ${browserLang}`);
    return browserLang;
  }
  
  writeLog("info", `Gagal mencocokkan bahasa browser, default ke: ${CONFIG.DEFAULT_LANG}`);
  return CONFIG.DEFAULT_LANG;
}

// ─── 2. SISTEM CACHING TERJEMAHAN ──────────────────────────────────────────
function loadTranslationCache() {
  try {
    const keys = Object.keys(localStorage);
    state.cache = {};
    keys.forEach(key => {
      if (key.startsWith(CONFIG.CACHE_PREFIX)) {
        const cacheItem = JSON.parse(localStorage.getItem(key));
        const originalKey = key.replace(CONFIG.CACHE_PREFIX, "");
        state.cache[originalKey] = cacheItem;
      }
    });
    
    // Load favorites & recents
    state.favorites = JSON.parse(localStorage.getItem(CONFIG.FAVORITES_KEY)) || [];
    state.recent = JSON.parse(localStorage.getItem(CONFIG.RECENT_KEY)) || [];
    
    writeLog("success", `Memuat ${Object.keys(state.cache).length} entri terjemahan dari cache Lokal.`);
  } catch (e) {
    writeLog("error", `Gagal memuat cache lokal: ${e.message}`);
  }
}

function saveTranslationCache(keyText, targetLang, translatedText) {
  try {
    const cacheKey = `${CONFIG.CACHE_PREFIX}${keyText.toLowerCase()}_${targetLang}`;
    const cacheItem = {
      text: translatedText,
      lang: targetLang,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
    state.cache[`${keyText.toLowerCase()}_${targetLang}`] = cacheItem;
  } catch (e) {
    writeLog("warn", `Gagal menyimpan terjemahan ke cache: ${e.message}`);
  }
}

function clearTranslationCache() {
  try {
    const keys = Object.keys(localStorage);
    let count = 0;
    keys.forEach(key => {
      if (key.startsWith(CONFIG.CACHE_PREFIX)) {
        localStorage.removeItem(key);
        count++;
      }
    });
    state.cache = {};
    state.stats.totalCached = 0;
    writeLog("success", `Berhasil menghapus seluruh ${count} berkas cache terjemahan.`);
    updateLanguageUI();
    renderCacheManagerTable();
  } catch (e) {
    writeLog("error", `Gagal menghapus cache: ${e.message}`);
  }
}

// ─── 3. LOGIKA API TRANSLATION (Dengan Fallback & Retries) ───────────────────
async function fetchLibreTranslate(text, targetLang) {
  // LibreTranslate memerlukan source lang. Kita asumsikan default source 'id' atau auto
  const response = await fetch(CONFIG.API_PROVIDERS.libre, {
    method: "POST",
    body: JSON.stringify({
      q: text,
      source: "auto",
      target: targetLang,
      format: "text"
    }),
    headers: { "Content-Type": "application/json" }
  });
  if (!response.ok) throw new Error(`LibreTranslate HTTP ${response.status}`);
  const data = await response.json();
  return data.translatedText;
}

async function fetchMyMemory(text, targetLang) {
  const sourceLang = CONFIG.DEFAULT_LANG;
  const url = `${CONFIG.API_PROVIDERS.mymemory}?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MyMemory HTTP ${response.status}`);
  const data = await response.json();
  if (data.responseStatus !== 200) throw new Error(data.responseDetails || "MyMemory error");
  return data.responseData.translatedText;
}

async function fetchLingva(text, targetLang) {
  const url = `${CONFIG.API_PROVIDERS.lingva}/auto/${targetLang}/${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Lingva HTTP ${response.status}`);
  const data = await response.json();
  return data.translation;
}

// Helper fetch dengan Retry + Exponential Backoff
async function fetchWithRetry(apiFn, text, targetLang, retries = 3, delay = 1000) {
  try {
    state.stats.apiCalls++;
    return await apiFn(text, targetLang);
  } catch (error) {
    if (retries <= 0) throw error;
    writeLog("warn", `API Gagal. Mencoba kembali dalam ${(delay/1000)}s... Sisa retry: ${retries}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(apiFn, text, targetLang, retries - 1, delay * 2);
  }
}

// Pipeline terjemahan multi-provider dengan fallback kamus lokal
async function getTranslation(text, targetLang) {
  const cacheKey = `${text.toLowerCase()}_${targetLang}`;
  
  // 1. Cek Cache Runtime/Lokal
  if (state.cache[cacheKey]) {
    state.stats.totalCached++;
    return state.cache[cacheKey].text;
  }
  
  // Jika bahasa target sama dengan bahasa asal (id), tidak perlu memanggil API
  if (targetLang === CONFIG.DEFAULT_LANG) {
    return text;
  }
  
  // 2. Coba API Primer (LibreTranslate)
  try {
    writeLog("info", `Menghubungi API LibreTranslate untuk terjemahan: "${text}"`);
    const res = await fetchWithRetry(fetchLibreTranslate, text, targetLang, 2, 800);
    saveTranslationCache(text, targetLang, res);
    state.stats.totalTranslated++;
    return res;
  } catch (e) {
    writeLog("warn", `API LibreTranslate gagal: ${e.message}. Mengalihkan ke MyMemory...`);
  }
  
  // 3. Coba API Sekunder (MyMemory)
  try {
    writeLog("info", `Menghubungi API MyMemory untuk terjemahan: "${text}"`);
    const res = await fetchWithRetry(fetchMyMemory, text, targetLang, 2, 800);
    saveTranslationCache(text, targetLang, res);
    state.stats.totalTranslated++;
    return res;
  } catch (e) {
    writeLog("warn", `API MyMemory gagal: ${e.message}. Mengalihkan ke Lingva...`);
  }

  // 4. Coba API Tersier (Lingva)
  try {
    writeLog("info", `Menghubungi API Lingva untuk terjemahan: "${text}"`);
    const res = await fetchWithRetry(fetchLingva, text, targetLang, 2, 800);
    saveTranslationCache(text, targetLang, res);
    state.stats.totalTranslated++;
    return res;
  } catch (e) {
    writeLog("error", `Seluruh API terjemahan gagal: ${e.message}. Mengaktifkan Fallback Lokal...`);
  }

  // 5. Coba Kamus Fallback Lokal
  const localVal = findInFallbackDictionary(text, targetLang);
  if (localVal) {
    writeLog("success", `Berhasil memulihkan terjemahan lewat Kamus Lokal.`);
    saveTranslationCache(text, targetLang, localVal);
    return localVal;
  }
  
  // 6. Tampilkan default jika semuanya gagal
  state.stats.totalFailed++;
  writeLog("error", `Semua metode translasi gagal untuk teks: "${text}". Teks asli ditampilkan.`);
  return text;
}

// Mencari teks di dictionary fallback lokal
function findInFallbackDictionary(text, targetLang) {
  const dict = state.fallbackDictionary[targetLang];
  if (!dict) return null;
  
  // Cari kecocokan langsung berdasarkan value bahasa indonesia atau key aslinya
  // Untuk efisiensi, kita bandingkan teks case-insensitive
  const entries = Object.entries(state.fallbackDictionary[CONFIG.DEFAULT_LANG] || {});
  const matchedEntry = entries.find(([key, val]) => val.toLowerCase() === text.toLowerCase() || key.toLowerCase() === text.toLowerCase());
  
  if (matchedEntry) {
    const [key] = matchedEntry;
    return dict[key] || null;
  }
  
  // Cek jika text adalah key i18n itu sendiri
  if (dict[text]) return dict[text];
  
  return null;
}

// ─── 4. QUEUE REQUEST MANAGER (Rate Limit Protection) ────────────────────────
function addToQueue(element, text, targetLang, attributeType = "text") {
  return new Promise((resolve) => {
    state.queue.push({ element, text, targetLang, attributeType, resolve });
    processQueueDebounced();
  });
}

// Debounce processing queue
let queueTimeout = null;
function processQueueDebounced() {
  if (queueTimeout) clearTimeout(queueTimeout);
  queueTimeout = setTimeout(() => {
    processQueue();
  }, 250);
}

// Memproses antrean satu per satu secara berurutan agar tidak membebani API publik
async function processQueue() {
  if (state.isProcessingQueue || state.queue.length === 0) return;
  
  state.isProcessingQueue = true;
  updateStatus("translating");
  
  while (state.queue.length > 0) {
    const batch = state.queue.splice(0, 5); // Ambil maks 5 item sekaligus (Batch)
    
    // Proses terjemahan paralel dalam batch kecil
    await Promise.all(batch.map(async ({ element, text, targetLang, attributeType, resolve }) => {
      try {
        const translated = await getTranslation(text, targetLang);
        
        // Render hasil dengan aman (escape HTML / textContent)
        const sanitized = escapeHTML(translated);
        
        if (attributeType === "text") {
          element.textContent = sanitized;
        } else if (attributeType === "placeholder") {
          element.setAttribute("placeholder", sanitized);
        } else if (attributeType === "title") {
          element.setAttribute("title", sanitized);
        } else if (attributeType === "alt") {
          element.setAttribute("alt", sanitized);
        }
        
        resolve(sanitized);
      } catch (err) {
        resolve(text);
      }
    }));
    
    // Jeda antar-batch untuk menghindari IP Rate Limit
    await new Promise(r => setTimeout(r, 300));
  }
  
  state.isProcessingQueue = false;
  
  // Tentukan status akhir berdasarkan statistik kegagalan
  if (state.stats.totalFailed > 0 && state.stats.totalTranslated === 0) {
    updateStatus("failed");
  } else {
    // Jika tidak ada panggilan API baru, berarti terjemahan terlayani dari cache
    const isCachedOnly = state.queue.length === 0 && state.stats.apiCalls === 0;
    updateStatus(isCachedOnly ? "cached" : "ready");
  }
  
  // Reset API Call counter setelah pemrosesan selesai
  state.stats.apiCalls = 0;
  
  updateLanguageUI();
  renderCacheManagerTable();
}

// ─── 5. PENTERJEMAHAN HALAMAN & ELEMEN DOM ──────────────────────────────────
function translateElement(element, targetLang) {
  // 1. Terjemahkan text content (data-i18n)
  const i18nKey = element.getAttribute("data-i18n");
  if (i18nKey) {
    // Simpan teks asli jika belum ada untuk penterjemahan ulang nanti
    if (!element.hasAttribute("data-i18n-orig")) {
      element.setAttribute("data-i18n-orig", element.textContent.trim());
    }
    
    // Cari di kamus fallback lokal dulu jika key dikenal langsung
    const localVal = findInFallbackDictionary(i18nKey, targetLang);
    if (localVal) {
      element.textContent = escapeHTML(localVal);
    } else {
      const origText = element.getAttribute("data-i18n-orig");
      addToQueue(element, origText, targetLang, "text");
    }
  }

  // 2. Terjemahkan placeholder (data-i18n-placeholder)
  const placeholderKey = element.getAttribute("data-i18n-placeholder");
  if (placeholderKey) {
    if (!element.hasAttribute("data-i18n-placeholder-orig")) {
      element.setAttribute("data-i18n-placeholder-orig", element.getAttribute("placeholder") || "");
    }
    const localVal = findInFallbackDictionary(placeholderKey, targetLang);
    if (localVal) {
      element.setAttribute("placeholder", escapeHTML(localVal));
    } else {
      const origText = element.getAttribute("data-i18n-placeholder-orig");
      addToQueue(element, origText, targetLang, "placeholder");
    }
  }

  // 3. Terjemahkan title (data-i18n-title)
  const titleKey = element.getAttribute("data-i18n-title");
  if (titleKey) {
    if (!element.hasAttribute("data-i18n-title-orig")) {
      element.setAttribute("data-i18n-title-orig", element.getAttribute("title") || "");
    }
    const localVal = findInFallbackDictionary(titleKey, targetLang);
    if (localVal) {
      element.setAttribute("title", escapeHTML(localVal));
    } else {
      const origText = element.getAttribute("data-i18n-title-orig");
      addToQueue(element, origText, targetLang, "title");
    }
  }
}

function translatePage(targetLang = state.currentLanguage) {
  writeLog("info", `Memulai penterjemahan seluruh elemen halaman ke: ${targetLang}`);
  
  // 1. Terjemahkan elemen-elemen dengan atribut i18n
  const elements = document.querySelectorAll("[data-i18n], [data-i18n-placeholder], [data-i18n-title]");
  elements.forEach(el => translateElement(el, targetLang));

  // 2. Terjemahkan seluruh text nodes secara otomatis
  if (typeof document !== "undefined") {
    translateTextNodes(document.body, targetLang);
  }
}

// Menjelajahi seluruh text node di halaman dan menerjemahkannya secara realtime
function translateTextNodes(root, targetLang) {
  if (!root) return;
  
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      
      const tag = parent.tagName.toLowerCase();
      // Lewati tag script, style, input, pre-formatted, code blocks, option dll.
      if (['script', 'style', 'textarea', 'input', 'pre', 'code', 'noscript', 'option'].includes(tag)) {
        return NodeFilter.FILTER_REJECT;
      }
      
      // Lewati widget switcher bahasa atau elemen berlabel data-no-translate
      if (parent.closest('#lang-switcher') || parent.closest('.lang-switcher-wrap') || parent.closest('[data-no-translate]')) {
        return NodeFilter.FILTER_REJECT;
      }
      
      // Lewati widget pemantau latency ping agar ms tidak diterjemahkan
      if (parent.closest('.pm-wrapper') || parent.closest('#pm-detail-panel')) {
        return NodeFilter.FILTER_REJECT;
      }
      
      const text = node.nodeValue.trim();
      // Lewati string kosong, satu huruf saja, atau yang hanya berisi angka/simbol/spasi
      if (!text || /^[\d\s\p{P}]+$/u.test(text) || text.length <= 1) {
        return NodeFilter.FILTER_REJECT;
      }
      
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let node;
  while (node = walk.nextNode()) {
    translateTextNode(node, targetLang);
  }
}

async function translateTextNode(node, targetLang) {
  if (!node._originalText) {
    node._originalText = node.nodeValue;
  }
  
  const original = node._originalText;
  
  // Jika bahasa target sama dengan bahasa asal (id), kembalikan ke teks asli
  if (targetLang === CONFIG.DEFAULT_LANG) {
    node.nodeValue = original;
    node._translatedText = original;
    return;
  }

  try {
    const translated = await getTranslation(original, targetLang);
    node.nodeValue = translated;
    node._translatedText = translated;
  } catch (err) {
    console.error("Gagal melakukan auto-translate text node:", err);
  }
}

let observerInstance = null;

function startTranslationObserver(targetLang) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  
  if (observerInstance) {
    observerInstance.disconnect();
  }
  
  observerInstance = new MutationObserver((mutations) => {
    // Putuskan sementara agar perubahan teks penterjemah tidak memicu loop
    observerInstance.disconnect();
    
    let needsTranslation = false;
    
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType === Node.ELEMENT_NODE) {
            if (!addedNode.closest('#lang-switcher') && !addedNode.closest('.lang-switcher-wrap') && !addedNode.closest('.pm-wrapper')) {
              needsTranslation = true;
            }
          } else if (addedNode.nodeType === Node.TEXT_NODE) {
            needsTranslation = true;
          }
        }
      } else if (mutation.type === "characterData") {
        const textNode = mutation.target;
        if (textNode.nodeType === Node.TEXT_NODE) {
          // Jika teks berubah dari luar sistem penerjemah (misal, React melakukan render ulang)
          if (textNode.nodeValue !== textNode._translatedText) {
            textNode._originalText = textNode.nodeValue;
            needsTranslation = true;
          }
        }
      }
    }
    
    if (needsTranslation) {
      translateTextNodes(document.body, targetLang);
    }
    
    // Aktifkan kembali observer
    observerInstance.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  });
  
  observerInstance.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

// ─── 6. DYNAMIC & BATCH TRANSLATION ──────────────────────────────────────────
async function translateBatch(texts, targetLang) {
  // Berguna untuk menterjemahkan array teks dinamis (seperti riwayat transaksi/notif)
  const translatedTexts = await Promise.all(texts.map(async text => {
    return await getTranslation(text, targetLang);
  }));
  return translatedTexts;
}

function syncDynamicContent(containerElement) {
  // Cari elemen di dalam container baru
  const elements = containerElement.querySelectorAll("[data-i18n], [data-i18n-placeholder]");
  elements.forEach(el => translateElement(el, state.currentLanguage));
}

// ─── 7. INTERACTIVE SWITCHER & UI CONTROL ──────────────────────────────────
function changeLanguage(lang) {
  if (!CONFIG.SUPPORTED_LANGS[lang]) {
    writeLog("error", `Bahasa tidak didukung: ${lang}`);
    return;
  }
  
  state.currentLanguage = lang;
  localStorage.setItem(CONFIG.CURRENT_LANG_KEY, lang);
  
  // Catat sebagai bahasa terakhir digunakan (Recent)
  updateRecentLanguages(lang);
  
  translatePage(lang);
  updateLanguageUI();
  
  // Mulai memantau perubahan DOM untuk auto-translate
  startTranslationObserver(lang);
  
  writeLog("success", `Bahasa aktif diubah ke: ${CONFIG.SUPPORTED_LANGS[lang].name}`);
}

function updateRecentLanguages(lang) {
  let recents = state.recent.filter(item => item !== lang);
  recents.unshift(lang); // Tambahkan ke paling depan
  recents = recents.slice(0, 4); // Maksimal 4 recent
  state.recent = recents;
  localStorage.setItem(CONFIG.RECENT_KEY, JSON.stringify(recents));
}

function updateStatus(newStatus) {
  state.status = newStatus;
  const statusElement = document.getElementById("trans-status");
  if (statusElement) {
    statusElement.className = `status-tag status-tag--${newStatus}`;
    const statusLabels = {
      idle: "Translation Ready",
      translating: "Menerjemahkan...",
      ready: "Translation Ready",
      cached: "Translation Cached",
      failed: "Translation Failed",
      fallback: "Using Fallback Translation"
    };
    statusElement.textContent = statusLabels[newStatus] || newStatus;
  }
}

function updateLanguageUI() {
  // Update tombol dropdown trigger
  const triggerBtn = document.getElementById("lang-trigger-btn");
  if (triggerBtn) {
    const current = CONFIG.SUPPORTED_LANGS[state.currentLanguage];
    triggerBtn.innerHTML = `
      <span class="current-lang">
        <span class="lang-flag">${current.flag}</span>
        <span>${current.name}</span>
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    `;
  }
  
  // Render dropdown options
  renderLanguageDropdown();
  
  // Render recent tags
  renderRecentTags();
  
  // Render statistik
  renderTranslationStats();
}

function renderLanguageDropdown(filterText = "") {
  const listContainer = document.getElementById("lang-options-list");
  if (!listContainer) return;
  
  listContainer.innerHTML = "";
  
  // Pisahkan list favorit dan non-favorit agar favorit tampil di atas
  const sortedLangs = Object.entries(CONFIG.SUPPORTED_LANGS).sort((a, b) => {
    const aFav = state.favorites.includes(a[0]);
    const bFav = state.favorites.includes(b[0]);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return a[1].name.localeCompare(b[1].name);
  });
  
  sortedLangs.forEach(([code, item]) => {
    // Filter pencarian
    if (filterText && !item.name.toLowerCase().includes(filterText.toLowerCase())) {
      return;
    }
    
    const isFav = state.favorites.includes(code);
    const optionDiv = document.createElement("div");
    optionDiv.className = `lang-option ${code === state.currentLanguage ? "active" : ""}`;
    optionDiv.innerHTML = `
      <div class="lang-option-meta" onclick="changeLanguage('${code}'); closeLanguageDropdown();">
        <span class="lang-flag">${item.flag}</span>
        <span>${item.name}</span>
      </div>
      <span class="lang-favorite-star ${isFav ? "active" : ""}" onclick="toggleFavorite(event, '${code}')">★</span>
    `;
    listContainer.appendChild(optionDiv);
  });
}

function toggleFavorite(event, code) {
  event.stopPropagation();
  let favs = [...state.favorites];
  if (favs.includes(code)) {
    favs = favs.filter(c => c !== code);
    writeLog("info", `Menghapus ${CONFIG.SUPPORTED_LANGS[code].name} dari bahasa favorit.`);
  } else {
    favs.push(code);
    writeLog("success", `Menambahkan ${CONFIG.SUPPORTED_LANGS[code].name} ke bahasa favorit.`);
  }
  state.favorites = favs;
  localStorage.setItem(CONFIG.FAVORITES_KEY, JSON.stringify(favs));
  renderLanguageDropdown();
}

function renderRecentTags() {
  const container = document.getElementById("recent-langs-container");
  if (!container) return;
  
  container.innerHTML = "";
  if (state.recent.length === 0) {
    container.innerHTML = `<span style="font-size:11px;color:var(--text-muted);">Belum ada riwayat bahasa.</span>`;
    return;
  }
  
  state.recent.forEach(code => {
    const item = CONFIG.SUPPORTED_LANGS[code];
    if (!item) return;
    const tag = document.createElement("span");
    tag.className = "recent-tag";
    tag.innerHTML = `<span>${item.flag}</span> <span>${item.name}</span>`;
    tag.onclick = () => changeLanguage(code);
    container.appendChild(tag);
  });
}

function renderTranslationStats() {
  const keys = [
    { id: "stat-translated", val: state.stats.totalTranslated },
    { id: "stat-cached", val: Object.keys(state.cache).length },
    { id: "stat-failed", val: state.stats.totalFailed },
    { id: "stat-queue", val: state.queue.length }
  ];
  keys.forEach(k => {
    const el = document.getElementById(k.id);
    if (el) el.textContent = k.val;
  });
}

// ─── 8. CACHE MANAGER PANEL UI ──────────────────────────────────────────────
function renderCacheManagerTable() {
  const tbody = document.getElementById("cache-table-body");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  const cacheEntries = Object.entries(state.cache);
  
  if (cacheEntries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Tidak ada cache terjemahan aktif.</td></tr>`;
    return;
  }
  
  // Urutkan berdasarkan timestamp terbaru
  cacheEntries.sort((a, b) => b[1].timestamp - a[1].timestamp);
  
  cacheEntries.forEach(([key, value]) => {
    const [origText, targetLang] = key.split("_");
    const dateStr = new Date(value.timestamp).toLocaleTimeString();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:700;">${escapeHTML(origText)}</td>
      <td><span class="recent-tag" style="padding:2px 6px;">${CONFIG.SUPPORTED_LANGS[targetLang]?.flag || ""} ${targetLang.toUpperCase()}</span></td>
      <td style="color:var(--color-success);">${escapeHTML(value.text)}</td>
      <td style="color:var(--text-muted);">${dateStr}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Ekspor & Impor Cache Terjemahan (JSON)
function exportTranslationCache() {
  try {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.cache));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `restobook_translation_cache.json`);
    dlAnchorElem.click();
    writeLog("success", "Berhasil mengekspor cache terjemahan ke format berkas JSON.");
  } catch (e) {
    writeLog("error", `Gagal mengekspor cache: ${e.message}`);
  }
}

function importTranslationCache(fileInputEvent) {
  const fileReader = new FileReader();
  fileReader.onload = function(event) {
    try {
      const importedCache = JSON.parse(event.target.result);
      let count = 0;
      Object.entries(importedCache).forEach(([key, value]) => {
        const cacheKey = `${CONFIG.CACHE_PREFIX}${key}`;
        localStorage.setItem(cacheKey, JSON.stringify(value));
        state.cache[key] = value;
        count++;
      });
      writeLog("success", `Berhasil mengimpor ${count} data cache terjemahan dari JSON.`);
      updateLanguageUI();
      renderCacheManagerTable();
    } catch (e) {
      writeLog("error", `Format berkas JSON tidak valid: ${e.message}`);
    }
  };
  fileReader.readAsText(fileInputEvent.target.files[0]);
}

// ─── 9. INISIALISASI UTAMA ──────────────────────────────────────────────────
async function initLanguageSystem() {
  updateStatus("translating");
  writeLog("info", "Memulai inisialisasi Sistem Multi-Language...");
  
  // 1. Load cache lokal
  loadTranslationCache();
  
  // 2. Load kamus fallback lokal (fallback.json)
  try {
    const res = await fetch("/translation-demo/fallback.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.fallbackDictionary = await res.json();
    writeLog("success", "Berhasil memuat kamus fallback lokal (fallback.json).");
  } catch (e) {
    writeLog("error", `Gagal memuat kamus fallback lokal: ${e.message}. Beberapa fallback lokal mungkin tidak bekerja.`);
  }
  
  // 3. Deteksi bahasa aktif
  const detected = detectBrowserLanguage();
  state.currentLanguage = detected;
  localStorage.setItem(CONFIG.CURRENT_LANG_KEY, detected);
  
  // 4. Update UI bahasa
  updateLanguageUI();
  
  // 5. Terjemahkan halaman awal
  translatePage(detected);
  
  // Mulai memantau perubahan DOM untuk auto-translate
  startTranslationObserver(detected);
}

// UI Dropdown controls
function toggleLanguageDropdown() {
  const dropdown = document.getElementById("lang-dropdown-menu");
  if (dropdown) dropdown.classList.toggle("show");
}
function closeLanguageDropdown() {
  const dropdown = document.getElementById("lang-dropdown-menu");
  if (dropdown) dropdown.classList.remove("show");
}

// Close dropdown on click outside
if (typeof window !== "undefined") {
  window.addEventListener("click", (e) => {
    const switcher = document.getElementById("lang-switcher");
    if (switcher && !switcher.contains(e.target)) {
      closeLanguageDropdown();
    }
  });
}

// Export function global agar dapat dipanggil dari inline HTML
if (typeof window !== "undefined") {
  window.initLanguageSystem = initLanguageSystem;
  window.changeLanguage = changeLanguage;
  window.toggleLanguageDropdown = toggleLanguageDropdown;
  window.closeLanguageDropdown = closeLanguageDropdown;
  window.clearTranslationCache = clearTranslationCache;
  window.exportTranslationCache = exportTranslationCache;
  window.importTranslationCache = importTranslationCache;
  window.renderLanguageDropdown = renderLanguageDropdown;
  window.toggleFavorite = toggleFavorite;
  window.syncDynamicContent = syncDynamicContent;
  window.startTranslationObserver = startTranslationObserver;
  window.translateTextNodes = translateTextNodes;
  window.CONFIG = CONFIG;
  window.translationState = state;
}
