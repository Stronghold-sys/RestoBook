import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function triggerWebDownload(rawBase64: string, filename: string, mimeType: string) {
  const byteCharacters = atob(rawBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadFile({
  dataBase64,
  filename,
  mimeType,
}: {
  dataBase64: string;
  filename: string;
  mimeType: string;
}) {
  // Strip base64 prefix if exists
  let rawBase64 = dataBase64;
  if (dataBase64.includes('base64,')) {
    rawBase64 = dataBase64.split('base64,')[1];
  }

  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Write the file to the Cache directory (no permissions required)
      const result = await Filesystem.writeFile({
        path: filename,
        data: rawBase64,
        directory: Directory.Cache,
      });

      // 2. Share the file so the user can open it, save it, or send it on their device
      await Share.share({
        title: `Simpan ${filename}`,
        url: result.uri,
      });
      
      return true;
    } catch (error) {
      console.error('Error downloading/sharing file on mobile native method:', error);
      console.log('Falling back to standard web download inside WebView...');
      try {
        triggerWebDownload(rawBase64, filename, mimeType);
        return true;
      } catch (fallbackError) {
        console.error('Web download fallback also failed:', fallbackError);
        throw error;
      }
    }
  } else {
    triggerWebDownload(rawBase64, filename, mimeType);
    return true;
  }
}
