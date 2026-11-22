const URL_SAFE_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';

const HEX_ALPHABET = '0123456789abcdef';

function cryptoApi(): Crypto {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues fehlt in dieser Umgebung.');
  }
  return c;
}

/**
 * Rejection sampling: values at or above `limit` are dropped so the modulo
 * cannot bias the result. 256 is a multiple of 64, so for our alphabets the
 * loop practically never repeats.
 */
function randomIndex(alphabetLength: number): number {
  const crypto = cryptoApi();
  const limit = Math.floor(256 / alphabetLength) * alphabetLength;
  const buf = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % alphabetLength;
  }
}

function randomString(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[randomIndex(alphabet.length)];
  }
  return out;
}

/** 16 URL-safe characters, ~96 bit. Used for round ids and host tokens. */
export function randomId(length = 16): string {
  return randomString(URL_SAFE_ALPHABET, length);
}

/** 32 hex characters, 128 bit. Used as the device secret. */
export function randomHex(length = 32): string {
  return randomString(HEX_ALPHABET, length);
}
