import { NextRequest } from "next/server";

// ── 1. Pola Deteksi Serangan Keamanan (Regex Patterns) ────────────────
const SQLI_PATTERNS = [
  /union\s+select/i,
  /union\s+all\s+select/i,
  /select\s+.*\s+from/i,
  /insert\s+into/i,
  /update\s+.*\s+set/i,
  /delete\s+from/i,
  /drop\s+table/i,
  /alter\s+table/i,
  /or\s+\d+=\d+/i,
  /and\s+\d+=\d+/i,
  /or\s+['"].*['"]=['"].*['"]/i,
  /syscolumns/i,
  /sysobjects/i,
  /concat\s*\(/i,
  /char\s*\(/i,
  /load_file/i,
  /outfile/i
];

const XSS_PATTERNS = [
  /<script[^>]*>/i,
  /<\/script>/i,
  /javascript:/i,
  /onerror\s*=/i,
  /onload\s*=/i,
  /onclick\s*=/i,
  /onmouseover\s*=/i,
  /onfocus\s*=/i,
  /alert\s*\(/i,
  /eval\s*\(/i,
  /document\.cookie/i,
  /document\.write/i,
  /window\.location/i,
  /src\s*=\s*['"]javascript:/i
];

const FILE_INCLUSION_PATTERNS = [
  /\.\.\//,                  // ../
  /\.\.\\/,                  // ..\
  /\/etc\/passwd/i,
  /\/etc\/hosts/i,
  /c:\\windows\\system32/i,
  /boot\.ini/i,
  /win\.ini/i,
  /169\.254\.169\.254/       // AWS/GCP Metadata IP
];

const COMMAND_INJECTION_PATTERNS = [
  /;\s*cat\s+/i,
  /;\s*rm\s+-/i,
  /;\s*sh\s+/i,
  /;\s*bash\s+/i,
  /\|\s*cat\s+/i,
  /\|\s*sh\s+/i,
  /\|\s*bash\s+/i,
  /&&\s*cat\s+/i,
  /&&\s*sh\s+/i,
  /&&\s*bash\s+/i,
  /`.*`/
];

const SSRF_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/,
  /0\.0\.0\.0/,
  /169\.254\.169\.254/,
  /192\.168\.\d+\.\d+/,
  /10\.\d+\.\d+\.\d+/,
  /172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+/
];

const SCANNING_PATHS = [
  /wp-admin/i,
  /wp-login/i,
  /wp-content/i,
  /\.env/i,
  /\.git/i,
  /phpinfo/i,
  /xmlrpc\.php/i,
  /phpmyadmin/i,
  /config\.json/i,
  /backup/i,
  /db_backup/i,
  /\.sql/i,
  /\.tar\.gz/i,
  /\.zip/i
];

const MALICIOUS_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /dirbuster/i,
  /masscan/i,
  /zgrab/i,
  /acunetix/i,
  /netsparker/i,
  /gobuster/i,
  /w3af/i
];

// Parameter Sensitif yang Dipantau WAF
const SENSITIVE_PARAMS = ["price", "discount", "total", "dp_amount", "grand_total", "role", "privilege", "id", "user_id"];

// ── 2. Fungsi Validasi Parameter Tampering & SQLi/XSS ────────────────
export function detectParameterManipulation(name: string, value: string): { manipulated: boolean; reason?: string } {
  const cleanName = name.toLowerCase();
  
  if (!SENSITIVE_PARAMS.includes(cleanName)) {
    return { manipulated: false };
  }

  // A. Validasi Parameter Harga / Finansial
  if (["price", "discount", "total", "dp_amount", "grand_total"].includes(cleanName)) {
    // Harga harus bernilai angka (dan tanda pemisah desimal opsional)
    const isNumeric = /^[0-9]+(\.[0-9]+)?$/.test(value);
    if (!isNumeric && value !== "") {
      return { 
        manipulated: true, 
        reason: `Parameter finansial '${name}' mengandung karakter non-numerik: '${value}'` 
      };
    }
    const valNum = Number(value);
    if (valNum < 0) {
      return {
        manipulated: true,
        reason: `Parameter finansial '${name}' bernilai negatif: '${value}'`
      };
    }
  }

  // B. Validasi Parameter Peran / Privilege
  if (["role", "privilege"].includes(cleanName)) {
    const allowedRoles = ["customer", "cashier", "admin", "superadmin"];
    if (!allowedRoles.includes(value.toLowerCase()) && value !== "") {
      return {
        manipulated: true,
        reason: `Eksploitasi hak akses di parameter '${name}': '${value}'`
      };
    }
  }

  // C. Validasi ID / UUID
  if (["id", "user_id"].includes(cleanName)) {
    // ID bisa berupa UUID standar atau integer ID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    const isInteger = /^\d+$/.test(value);
    
    if (!isUuid && !isInteger && value.length > 0) {
      // Izinkan string alphanumeric pendek (untuk kode referensi/bukti, max 20 karakter) jika tidak mengandung SQLi
      const isCleanAlpha = /^[a-z0-9_-]{1,24}$/i.test(value);
      if (!isCleanAlpha) {
        return {
          manipulated: true,
          reason: `Format parameter identitas '${name}' tidak valid: '${value}'`
        };
      }
    }
  }

  return { manipulated: false };
}

// ── 3. WAF Request Inspector ─────────────────────────────────────────
export interface WafResult {
  action: "allow" | "block" | "challenge" | "log_only" | "rate_limit";
  reason?: string;
  attackType?: string;
  severity?: "low" | "medium" | "high" | "critical";
}

export async function inspectRequest(request: NextRequest): Promise<WafResult> {
  const url = request.nextUrl;
  const path = url.pathname;
  const userAgent = request.headers.get("user-agent") || "";

  // A. Deteksi User-Agent Pemindai Malicious
  for (const pattern of MALICIOUS_USER_AGENTS) {
    if (pattern.test(userAgent)) {
      return {
        action: "block",
        attackType: "MALICIOUS_USER_AGENT",
        reason: `Scanner signature terdeteksi pada User-Agent: ${userAgent}`,
        severity: "critical"
      };
    }
  }

  // B. Deteksi Pola Scanning / Path Probing di URI Path
  for (const pattern of SCANNING_PATHS) {
    if (pattern.test(path)) {
      return {
        action: "block",
        attackType: "PATH_ENUMERATION",
        reason: `Percobaan pemindaian rute sensitif: ${path}`,
        severity: "high"
      };
    }
  }

  // C. Deteksi LFI / RFI & Path Traversal di URI Path
  for (const pattern of FILE_INCLUSION_PATTERNS) {
    if (pattern.test(path)) {
      return {
        action: "block",
        attackType: "PATH_TRAVERSAL",
        reason: `Pola traversal/injeksi berkas terdeteksi di URI path: ${path}`,
        severity: "critical"
      };
    }
  }

  // D. Deteksi SQLi, XSS, SSRF, & Parameter Tampering di Query String
  const searchParams = url.searchParams;
  for (const [key, value] of Array.from(searchParams.entries())) {
    // 1. Cek SQL Injection
    for (const pattern of SQLI_PATTERNS) {
      if (pattern.test(value)) {
        return {
          action: "block",
          attackType: "SQL_INJECTION",
          reason: `Pola SQLi terdeteksi pada parameter '${key}': '${value}'`,
          severity: "critical"
        };
      }
    }

    // 2. Cek Cross-Site Scripting (XSS)
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(value)) {
        return {
          action: "block",
          attackType: "XSS_ATTACK",
          reason: `Pola XSS terdeteksi pada parameter '${key}': '${value}'`,
          severity: "critical"
        };
      }
    }

    // 3. Cek Command Injection
    for (const pattern of COMMAND_INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        return {
          action: "block",
          attackType: "COMMAND_INJECTION",
          reason: `Pola Command Injection terdeteksi pada parameter '${key}': '${value}'`,
          severity: "critical"
        };
      }
    }

    // 4. Cek LFI / RFI / Traversal di Parameter
    for (const pattern of FILE_INCLUSION_PATTERNS) {
      if (pattern.test(value)) {
        return {
          action: "block",
          attackType: "FILE_INCLUSION",
          reason: `Pola file inclusion terdeteksi pada parameter '${key}': '${value}'`,
          severity: "high"
        };
      }
    }

    // 5. Cek SSRF di parameter (jika parameter terindikasi mengarah ke URL/IP)
    const looksLikeUrl = /^(https?:\/\/|localhost|\d{1,3}\.\d{1,3})/i.test(value);
    if (looksLikeUrl) {
      for (const pattern of SSRF_PATTERNS) {
        if (pattern.test(value)) {
          return {
            action: "block",
            attackType: "SSRF_ATTEMPT",
            reason: `Pola SSRF loopback IP terdeteksi pada parameter '${key}': '${value}'`,
            severity: "high"
          };
        }
      }
    }

    // 6. Cek Parameter Manipulation (Tampering)
    const tampering = detectParameterManipulation(key, value);
    if (tampering.manipulated) {
      return {
        action: "block",
        attackType: "PARAMETER_TAMPERING",
        reason: tampering.reason || `Eksploitasi parameter '${key}'`,
        severity: "high"
      };
    }
  }

  // E. Deteksi Anomali Header Request
  const contentType = request.headers.get("content-type") || "";
  const contentLength = Number(request.headers.get("content-length") || "0");

  // Jika payload JSON sangat mencurigakan (content-length besar melebihi 10MB untuk non-upload)
  const isUploadPath = path.includes("/upload") || path.includes("/api/upload");
  if (!isUploadPath && contentLength > 10 * 1024 * 1024) {
    return {
      action: "block",
      attackType: "LARGE_PAYLOAD_ANOMALY",
      reason: `Ukuran request payload terlalu besar (${(contentLength / 1024 / 1024).toFixed(2)} MB)`,
      severity: "medium"
    };
  }

  // Challenge Rule: Turnstile challenge untuk request API non-GET dari luar negeri
  const geoCountry = request.headers.get("cf-ipcountry") || request.headers.get("x-vercel-ip-country") || "";
  const isMutation = ["POST", "PUT", "DELETE"].includes(request.method);
  
  if (isMutation && geoCountry && geoCountry.toUpperCase() !== "ID") {
    // Terapkan challenge untuk endpoint sensitif dari luar negeri
    const isSensitivePath = path.includes("/api/auth/login") || 
                            path.includes("/api/register") || 
                            path.includes("/api/send-otp") || 
                            path.includes("/api/orders") || 
                            path.includes("/api/reservations");
    
    if (isSensitivePath) {
      return {
        action: "challenge",
        attackType: "GEO_CHALLENGE",
        reason: `Tantangan akses geolokasi untuk IP luar negeri (${geoCountry}) pada endpoint sensitif`,
        severity: "low"
      };
    }
  }

  // Log Only Rule: Log request aneh/mencurigakan yang masih aman tapi patut diawasi (seperti referer kosong pada mutasi)
  const referer = request.headers.get("referer") || "";
  if (isMutation && !referer && !path.startsWith("/api/payment/callback")) {
    return {
      action: "log_only",
      attackType: "MISSING_REFERER",
      reason: `Permintaan mutasi (${request.method}) tanpa referer header.`,
      severity: "low"
    };
  }

  return { action: "allow" };
}
