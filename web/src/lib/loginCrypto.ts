// Encrypts the login password for transport instead of sending it in the
// clear. Browsers only expose the Web Crypto API (SubtleCrypto — the thing
// that would normally do ECDH/AES-GCM) in secure contexts (HTTPS or
// localhost). apanel explicitly allows logging in over plain HTTP too
// (behind an interstitial warning, see HttpRiskDialog), which is exactly
// the case this needs to work in — so this uses a small, audited, pure-JS
// implementation (@noble/curves + @noble/ciphers) instead, which has no
// such restriction. The server decrypts the recovered password and checks
// it against the stored bcrypt hash exactly as before: this only keeps the
// password off the wire, it doesn't change how it's stored.
import { gcm } from '@noble/ciphers/aes.js'
import { randomBytes } from '@noble/ciphers/utils.js'
import { p256 } from '@noble/curves/nist.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { apiFetch } from './api'

interface Challenge {
  challengeId: string
  publicKey: string
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export interface EncryptedLogin {
  challengeId: string
  clientPublicKey: string
  iv: string
  ciphertext: string
}

export async function encryptLoginPassword(password: string): Promise<EncryptedLogin> {
  const { challengeId, publicKey } = await apiFetch<Challenge>('/login/challenge')

  const clientSecretKey = p256.utils.randomSecretKey()
  // Uncompressed: Go's crypto/ecdh only accepts SEC1's uncompressed point
  // encoding for NIST curves, not the compressed form.
  const clientPublicKey = p256.getPublicKey(clientSecretKey, false)
  const serverPublicKey = base64ToBytes(publicKey)

  // Both sides need the exact same key from the shared point. p256's
  // getSharedSecret returns the full SEC1-encoded point (a 0x02/0x03 prefix
  // byte + the X coordinate when compressed); dropping that prefix leaves
  // just the X coordinate, which is what Go's crypto/ecdh ECDH() returns
  // for NIST curves — so slicing it off here is what keeps the two sides
  // compatible without needing to agree on a point-encoding convention.
  const sharedX = p256.getSharedSecret(clientSecretKey, serverPublicKey, true).slice(1)
  const aesKey = sha256(sharedX)

  const iv = randomBytes(12)
  // Binds the ciphertext to this specific challenge, so it can't be replayed
  // against a different (still-valid) one.
  const aad = new TextEncoder().encode(challengeId)
  const plaintext = new TextEncoder().encode(JSON.stringify({ password }))
  const ciphertext = gcm(aesKey, iv, aad).encrypt(plaintext)

  return {
    challengeId,
    clientPublicKey: bytesToBase64(clientPublicKey),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  }
}
