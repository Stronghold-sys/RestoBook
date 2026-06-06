import { supabaseAdmin } from './supabase/admin';

export interface CalendarEventData {
  id?: string;
  atas_nama: string;
  telepon: string;
  reservation_date: string; // YYYY-MM-DD
  reservation_time: string; // HH:MM or HH:MM:SS
  guest_count: number;
  notes?: string;
  meja?: string;
}

export async function getCalendarCredentials() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID;
  const timezone = process.env.GOOGLE_CALENDAR_TIMEZONE || 'Asia/Jakarta';
  const credentialsJsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!calendarId || !credentialsJsonStr) {
    console.warn("Google Calendar: Menggunakan konfigurasi fallback dari database karena Environment Variables (GOOGLE_CALENDAR_ID atau GOOGLE_SERVICE_ACCOUNT_JSON) tidak disetel.");
    const { data, error } = await supabaseAdmin
      .from('google_calendar_credentials')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  }

  try {
    const credentials_json = JSON.parse(credentialsJsonStr);
    return {
      calendar_id: calendarId,
      timezone: timezone,
      credentials_json
    };
  } catch (err: any) {
    console.error("Gagal melakukan parse GOOGLE_SERVICE_ACCOUNT_JSON dari Environment Variable:", err.message);
    return null;
  }
}

// Helper: Base64Url encoding
function base64url(source: ArrayBuffer): string {
  const bytes = new Uint8Array(source);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const encoded = btoa(binary);
  return encoded.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlEncodeString(str: string): string {
  let encoded = btoa(unescape(encodeURIComponent(str)));
  return encoded.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Helper: Convert PEM key string to ArrayBuffer for Web Crypto RS256
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleanPem = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const raw = atob(cleanPem);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    buf[i] = raw.charCodeAt(i);
  }
  return buf.buffer;
}

// Exchange Service Account credentials for Google OAuth access token
async function getGoogleAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    exp: expiry,
    iat: now
  };

  const base64Header = base64urlEncodeString(JSON.stringify(header));
  const base64Claim = base64urlEncodeString(JSON.stringify(claimSet));
  const inputToSign = `${base64Header}.${base64Claim}`;

  // Sanitize private key newlines
  const sanitizedKey = privateKeyPem.replace(/\\n/g, '\n');
  const privateKeyBuffer = pemToArrayBuffer(sanitizedKey);

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" }
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(inputToSign)
  );

  const base64Signature = base64url(signature);
  const jwt = `${inputToSign}.${base64Signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Google OAuth error: ${data.error_description || data.error}`);
  }

  return data.access_token;
}

// Helper: safe date formatter for timezone-neutral YYYY-MM-DDTHH:MM:SS format
function formatDateTimeString(dateStr: string, timeStr: string, addHours = 0): string {
  // Extract time parts (ignoring seconds if any)
  const timeClean = timeStr.substring(0, 5); // "HH:MM"
  const dateParts = dateStr.split('-'); // ["YYYY", "MM", "DD"]
  const timeParts = timeClean.split(':'); // ["HH", "MM"]

  const year = parseInt(dateParts[0]) || 2026;
  const month = (parseInt(dateParts[1]) || 1) - 1;
  const day = parseInt(dateParts[2]) || 1;
  const hour = parseInt(timeParts[0]) || 12;
  const minute = parseInt(timeParts[1]) || 0;

  // Perform date shift in UTC representation to avoid timezone shifts & safely handle midnight rollover
  const utcDate = new Date(Date.UTC(year, month, day, hour + addHours, minute, 0));

  const yyyy = utcDate.getUTCFullYear();
  const mm = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utcDate.getUTCDate()).padStart(2, '0');
  const hh = String(utcDate.getUTCHours()).padStart(2, '0');
  const min = String(utcDate.getUTCMinutes()).padStart(2, '0');
  const ss = String(utcDate.getUTCSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
}

export async function createGoogleEvent(eventData: CalendarEventData): Promise<string> {
  const credentials = await getCalendarCredentials();
  if (!credentials) {
    throw new Error("Kredensial Google Calendar belum dikonfigurasi.");
  }

  const { calendar_id, timezone, credentials_json } = credentials;
  const config = typeof credentials_json === 'string' ? JSON.parse(credentials_json) : credentials_json;
  
  if (!config.client_email || !config.private_key) {
    throw new Error("Kredensial JSON tidak valid. Membutuhkan client_email dan private_key.");
  }

  const accessToken = await getGoogleAccessToken(config.client_email, config.private_key);

  const startISO = formatDateTimeString(eventData.reservation_date, eventData.reservation_time, 0);
  const endISO = formatDateTimeString(eventData.reservation_date, eventData.reservation_time, 2); // default 2 jam

  let formattedDate = eventData.reservation_date;
  try {
    formattedDate = new Date(eventData.reservation_date).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    // fallback
  }

  const formattedTime = eventData.reservation_time.substring(0, 5) + ' WIB';
  const displayId = eventData.id ? `#${eventData.id.substring(0, 8).toUpperCase()}` : '-';
  const mejaListText = eventData.meja || '-';

  const descriptionText = [
    `✨ DETAIL RESERVASI RESTOBOOK ✨`,
    `──────────────────────────`,
    `• ID Reservasi    : ${displayId}`,
    `• Nama Pemesan   : ${eventData.atas_nama}`,
    `• Nomor Telepon  : ${eventData.telepon}`,
    `• Tanggal         : ${formattedDate}`,
    `• Waktu Datang    : ${formattedTime}`,
    `• Jumlah Tamu     : ${eventData.guest_count} Orang`,
    `• Nomor Meja      : Meja ${mejaListText}`,
    `• Catatan Khusus  : ${eventData.notes || '-'}`,
    `──────────────────────────`,
    `Info: Reservasi ini telah terdaftar secara otomatis di sistem RestoBook.`
  ].join('\n');

  const eventPayload = {
    summary: `Reservasi: ${eventData.atas_nama} (Meja ${mejaListText})`,
    description: descriptionText,
    start: {
      dateTime: startISO,
      timeZone: timezone || 'Asia/Jakarta'
    },
    end: {
      dateTime: endISO,
      timeZone: timezone || 'Asia/Jakarta'
    }
  };

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar_id)}/events`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(eventPayload)
  });

  const responseData = await response.json();
  if (!response.ok) {
    throw new Error(`Gagal membuat event: ${responseData.error?.message || JSON.stringify(responseData)}`);
  }

  return responseData.id as string;
}

export async function updateGoogleEvent(eventId: string, eventData: CalendarEventData): Promise<string> {
  const credentials = await getCalendarCredentials();
  if (!credentials) {
    throw new Error("Kredensial Google Calendar belum dikonfigurasi.");
  }

  const { calendar_id, timezone, credentials_json } = credentials;
  const config = typeof credentials_json === 'string' ? JSON.parse(credentials_json) : credentials_json;
  
  if (!config.client_email || !config.private_key) {
    throw new Error("Kredensial JSON tidak valid.");
  }

  const accessToken = await getGoogleAccessToken(config.client_email, config.private_key);

  const startISO = formatDateTimeString(eventData.reservation_date, eventData.reservation_time, 0);
  const endISO = formatDateTimeString(eventData.reservation_date, eventData.reservation_time, 2);

  let formattedDate = eventData.reservation_date;
  try {
    formattedDate = new Date(eventData.reservation_date).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    // fallback
  }

  const formattedTime = eventData.reservation_time.substring(0, 5) + ' WIB';
  const displayId = eventData.id ? `#${eventData.id.substring(0, 8).toUpperCase()}` : '-';
  const mejaListText = eventData.meja || '-';

  const descriptionText = [
    `✨ DETAIL RESERVASI RESTOBOOK ✨`,
    `──────────────────────────`,
    `• ID Reservasi    : ${displayId}`,
    `• Nama Pemesan   : ${eventData.atas_nama}`,
    `• Nomor Telepon  : ${eventData.telepon}`,
    `• Tanggal         : ${formattedDate}`,
    `• Waktu Datang    : ${formattedTime}`,
    `• Jumlah Tamu     : ${eventData.guest_count} Orang`,
    `• Nomor Meja      : Meja ${mejaListText}`,
    `• Catatan Khusus  : ${eventData.notes || '-'}`,
    `──────────────────────────`,
    `Info: Reservasi ini telah terdaftar secara otomatis di sistem RestoBook.`
  ].join('\n');

  const eventPayload = {
    summary: `Reservasi: ${eventData.atas_nama} (Meja ${mejaListText})`,
    description: descriptionText,
    start: {
      dateTime: startISO,
      timeZone: timezone || 'Asia/Jakarta'
    },
    end: {
      dateTime: endISO,
      timeZone: timezone || 'Asia/Jakarta'
    }
  };

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar_id)}/events/${eventId}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(eventPayload)
  });

  const responseData = await response.json();
  if (!response.ok) {
    throw new Error(`Gagal mengubah event: ${responseData.error?.message || JSON.stringify(responseData)}`);
  }

  return responseData.id as string;
}

export async function deleteGoogleEvent(eventId: string): Promise<boolean> {
  const credentials = await getCalendarCredentials();
  if (!credentials) {
    throw new Error("Kredensial Google Calendar belum dikonfigurasi.");
  }

  const { calendar_id, credentials_json } = credentials;
  const config = typeof credentials_json === 'string' ? JSON.parse(credentials_json) : credentials_json;
  
  if (!config.client_email || !config.private_key) {
    throw new Error("Kredensial JSON tidak valid.");
  }

  const accessToken = await getGoogleAccessToken(config.client_email, config.private_key);

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar_id)}/events/${eventId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if (!response.ok && response.status !== 404) {
    const responseData = await response.json().catch(() => ({}));
    throw new Error(`Gagal menghapus event: ${responseData.error?.message || "Error tidak diketahui"}`);
  }

  return true;
}
