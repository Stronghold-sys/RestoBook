import { supabaseAdmin } from './supabase/admin';

export interface CalendarEventData {
  atas_nama: string;
  telepon: string;
  reservation_date: string; // YYYY-MM-DD
  reservation_time: string; // HH:MM
  guest_count: number;
  notes?: string;
}

export async function getCalendarCredentials() {
  const { data, error } = await supabaseAdmin
    .from('google_calendar_credentials')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
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

  const startDateTime = new Date(`${eventData.reservation_date}T${eventData.reservation_time}:00`);
  // Event duration is 2 hours by default
  const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);

  const eventPayload = {
    summary: `Reservasi: ${eventData.atas_nama}`,
    description: `Nama: ${eventData.atas_nama}\nTelepon: ${eventData.telepon}\nTamu: ${eventData.guest_count} orang\nCatatan: ${eventData.notes || '-'}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: timezone || 'Asia/Jakarta'
    },
    end: {
      dateTime: endDateTime.toISOString(),
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

  const startDateTime = new Date(`${eventData.reservation_date}T${eventData.reservation_time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);

  const eventPayload = {
    summary: `Reservasi: ${eventData.atas_nama}`,
    description: `Nama: ${eventData.atas_nama}\nTelepon: ${eventData.telepon}\nTamu: ${eventData.guest_count} orang\nCatatan: ${eventData.notes || '-'}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: timezone || 'Asia/Jakarta'
    },
    end: {
      dateTime: endDateTime.toISOString(),
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
