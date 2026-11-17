// fall-euaiact · Ed25519 signing helper · MIT · zero dependencies
// Uses the platform's own WebCrypto Ed25519 (Node 20+, Deno, Cloudflare Workers, current Chrome, Firefox and
// Safari). Nothing is fetched at runtime: an earlier version loaded libsodium from a CDN on first use.
// Keys are hex. A private key may be the 32-byte seed or libsodium's 64-byte secret key (seed followed by the
// public key), so keys made by the earlier version still work. Signatures are standard Ed25519 (RFC 8032).

const PKCS8_PREFIX = '302e020100300506032b657004220420'; // the fixed DER header that wraps a 32-byte Ed25519 seed
const ALG = { name: 'Ed25519' };

async function subtle() {
  if (globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto.subtle;
  return (await import('node:crypto')).webcrypto.subtle;
}

const toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

function fromHex(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) throw new TypeError('not a hex string');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const bytesOf = (message) => (typeof message === 'string' ? new TextEncoder().encode(message) : message);

/**
 * Generate a fresh Ed25519 keypair.
 * @returns {Promise<{ publicKey: string, privateKey: string }>} hex; privateKey is 64 bytes (seed + public key), as libsodium makes it
 */
export async function generateKeypair() {
  const s = await subtle();
  const kp = await s.generateKey(ALG, true, ['sign', 'verify']);
  const pkcs8 = toHex(await s.exportKey('pkcs8', kp.privateKey));
  const publicKey = toHex(await s.exportKey('raw', kp.publicKey));
  return { publicKey, privateKey: pkcs8.slice(PKCS8_PREFIX.length) + publicKey };
}

/**
 * Sign a message with an Ed25519 private key.
 * @param {string|Uint8Array} message - usually a JSON-stringified envelope
 * @param {string} privateKeyHex - 32-byte seed or 64-byte secret key, hex
 * @returns {Promise<string>} hex-encoded detached signature (64 bytes)
 */
export async function sign(message, privateKeyHex) {
  if (!privateKeyHex) throw new Error('sign() requires a privateKeyHex');
  if (privateKeyHex.length !== 64 && privateKeyHex.length !== 128) throw new TypeError('privateKeyHex must be 32 or 64 bytes of hex');
  const seed = privateKeyHex.slice(0, 64);
  fromHex(privateKeyHex); // the whole key must be hex, not just the seed half
  const s = await subtle();
  const key = await s.importKey('pkcs8', fromHex(PKCS8_PREFIX + seed), ALG, false, ['sign']);
  return toHex(await s.sign(ALG, key, bytesOf(message)));
}

/**
 * Verify an Ed25519 detached signature against a message and public key.
 * @returns {Promise<boolean>} true only if the signature is valid for this message and key; never throws
 */
export async function verify(message, signatureHex, publicKeyHex) {
  try {
    const s = await subtle();
    const key = await s.importKey('raw', fromHex(publicKeyHex), ALG, false, ['verify']);
    return await s.verify(ALG, key, fromHex(signatureHex), bytesOf(message));
  } catch (_) {
    return false;
  }
}
