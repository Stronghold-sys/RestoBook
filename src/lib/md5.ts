import { createHash } from 'crypto';

export async function md5(message: string): Promise<string> {
  try {
    return createHash('md5').update(message).digest('hex');
  } catch (e) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('MD5' as any, data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

