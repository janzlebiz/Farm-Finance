/**
 * Cryptographic Utilities for Farm Finance
 * Provides deterministic SHA-256 digest computation for backup verification.
 */
export async function computeSha256(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback for non-subtle crypto environments (using standard sha256 implementation)
  return fallbackSha256(text);
}

/**
 * Deterministically stringifies any object or array by recursively sorting object keys.
 * This guarantees canonical byte representation for cryptographic hashing.
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }

  const sortedKeys = Object.keys(obj).sort();
  const entries: string[] = [];
  for (const key of sortedKeys) {
    if (obj[key] !== undefined) {
      entries.push(`${JSON.stringify(key)}:${canonicalJsonStringify(obj[key])}`);
    }
  }
  return '{' + entries.join(',') + '}';
}

// Synchronous SHA-256 implementation
export function computeSha256Sync(text: string): string {
  return fallbackSha256(text);
}

function fallbackSha256(str: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i = 0, j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = str.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let compositeClear = true;
  for (let m = 0; m < str.length; m++) {
    const code = str.charCodeAt(m);
    if (code > 255) {
      compositeClear = false;
      break;
    }
  }

  const utf8String = compositeClear ? str : unescape(encodeURIComponent(str));
  const utf8Length = utf8String.length;

  for (let idx = 0; idx < utf8Length; idx++) {
    words[idx >> 2] |= (utf8String.charCodeAt(idx) & 0xff) << (8 * (3 - (idx % 4)));
  }

  words[utf8Length >> 2] |= 0x80 << (8 * (3 - (utf8Length % 4)));
  words[(((utf8Length + 8) >> 6) << 4) + 15] = utf8Length * 8;

  const w = new Array(64);
  for (i = 0; i < words.length; i += 16) {
    const h = hash.slice(0);
    for (j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] | 0;
      } else {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      const s1 = rightRotate(h[4], 6) ^ rightRotate(h[4], 11) ^ rightRotate(h[4], 25);
      const ch = (h[4] & h[5]) ^ (~h[4] & h[6]);
      const temp1 = (h[7] + s1 + ch + k[j] + w[j]) | 0;
      const s0 = rightRotate(h[0], 2) ^ rightRotate(h[0], 13) ^ rightRotate(h[0], 22);
      const maj = (h[0] & h[1]) ^ (h[0] & h[2]) ^ (h[1] & h[2]);
      const temp2 = (s0 + maj) | 0;

      h[7] = h[6];
      h[6] = h[5];
      h[5] = h[4];
      h[4] = (h[3] + temp1) | 0;
      h[3] = h[2];
      h[2] = h[1];
      h[1] = h[0];
      h[0] = (temp1 + temp2) | 0;
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + h[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}
