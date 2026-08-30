import "server-only"
import crypto from "node:crypto"

/**
 * Encryption at rest for third-party provider tokens (Facebook Page tokens,
 * LinkedIn access/refresh tokens) stored in the database.
 *
 * Long-lived Page tokens and LinkedIn refresh tokens are the kind of secret
 * that a leaked DB backup or any SQL-read capability would otherwise hand over
 * in plaintext. AES-256-GCM gives confidentiality and an auth tag that detects
 * tampering.
 *
 * The key comes from TOKEN_ENCRYPTION_KEY — a 32-byte key, base64 or hex. Miss
 * it and encrypt() throws (so we never write plaintext believing it encrypted),
 * while decrypt() of an already-plaintext value returns it unchanged.
 *
 * MIGRATION: existing rows hold plaintext. decrypt() detects the "v1:" prefix
 * this module writes; anything without it is returned verbatim, so old tokens
 * keep working until the connection is re-established and re-encrypted. There is
 * no plaintext fallback on the *encrypt* path — new writes are always encrypted.
 */

const PREFIX = "v1:"

function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set — cannot encrypt provider tokens")
  }
  // Accept base64 or hex; both must decode to exactly 32 bytes for AES-256.
  let key
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex")
  } else {
    key = Buffer.from(raw, "base64")
  }
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes (base64 or hex)")
  }
  return key
}

/** Encrypts a token. Returns "v1:<iv b64>:<tag b64>:<ciphertext b64>". */
export function encryptToken(plaintext) {
  if (plaintext == null) return plaintext
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`
}

/**
 * Decrypts a value produced by encryptToken(). A value without the version
 * prefix is assumed to be a pre-migration plaintext token and returned as-is.
 */
export function decryptToken(value) {
  if (value == null) return value
  const s = String(value)
  if (!s.startsWith(PREFIX)) return s // pre-migration plaintext
  const [, ivB64, tagB64, ctB64] = s.split(":")
  const key = getKey()
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()])
  return pt.toString("utf8")
}
