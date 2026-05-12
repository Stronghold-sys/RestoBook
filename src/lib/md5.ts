export function md5(message: string): string {
  // A clean, standard MD5 implementation suitable for Edge runtime
  const k = [], i = 0;
  for (let i = 0; i < 64; i++) {
    k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * (Math.pow(2, 32)));
  }

  const str = unescape(encodeURIComponent(message));
  const words = [];
  const strLen = str.length;
  for (let i = 0; i < strLen; i++) {
    words[i >>> 2] |= (str.charCodeAt(i) & 0xff) << (8 * (i % 4));
  }
  
  words[strLen >>> 2] |= 0x80 << (8 * (strLen % 4));
  words[(((strLen + 8) >>> 6) << 4) + 14] = strLen * 8;

  let a =  1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d =  271733878;

  const r = [
    7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
    5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
    4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
    6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
  ];

  for (let i = 0; i < words.length; i += 16) {
    let A = a, B = b, C = c, D = d;

    for (let j = 0; j < 64; j++) {
      let f, g;
      if (j < 16) {
        f = (B & C) | (~B & D);
        g = j;
      } else if (j < 32) {
        f = (D & B) | (~D & C);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = B ^ C ^ D;
        g = (3 * j + 5) % 16;
      } else {
        f = C ^ (B | ~D);
        g = (7 * j) % 16;
      }
      
      const temp = D;
      D = C;
      C = B;
      B = B + (((A + f + k[j] + (words[i + g] || 0)) | 0) << r[j] | ((A + f + k[j] + (words[i + g] || 0)) | 0) >>> (32 - r[j]));
      A = temp;
    }

    a = (a + A) | 0;
    b = (b + B) | 0;
    c = (c + C) | 0;
    d = (d + D) | 0;
  }

  const hex = [];
  const result = [a, b, c, d];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let h = ((result[i] >>> (j * 8)) & 0xff).toString(16);
      if (h.length === 1) h = "0" + h;
      hex.push(h);
    }
  }

  return hex.join("");
}
