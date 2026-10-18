import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function encryptionKey(value) {
  if (!/^[a-f\d]{64}$/i.test(value || "")) {
    throw new Error("FRIEND_CODE_ENCRYPTION_KEY precisa conter 32 bytes em hexadecimal.");
  }
  return Buffer.from(value, "hex");
}

export function encryptFriendCode(value, key, associatedData = "") {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  if (associatedData) cipher.setAAD(Buffer.from(associatedData));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { ciphertext, nonce, tag: cipher.getAuthTag() };
}

export function decryptFriendCode({ ciphertext, nonce, tag }, key, associatedData = "") {
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  if (associatedData) decipher.setAAD(Buffer.from(associatedData));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
