const crypto = require("node:crypto");

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, passwordHash) {
  const [salt, storedHash] = String(passwordHash || "").split(":");
  if (!salt || !storedHash) {
    return false;
  }
  const derivedKey = await scryptAsync(password, salt);
  const storedBuffer = Buffer.from(storedHash, "hex");
  return (
    storedBuffer.length === derivedKey.length &&
    crypto.timingSafeEqual(storedBuffer, derivedKey)
  );
}

function generateRecoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const tokens = [];
  for (let groupIndex = 0; groupIndex < 4; groupIndex += 1) {
    let token = "";
    for (let index = 0; index < 4; index += 1) {
      token += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    tokens.push(token);
  }
  return tokens.join("-");
}

async function buildRecoveryCodeHash(recoveryCode) {
  return hashPassword(normalizeRecoveryCode(recoveryCode));
}

async function verifyRecoveryCode(recoveryCode, recoveryCodeHash) {
  return verifyPassword(normalizeRecoveryCode(recoveryCode), recoveryCodeHash);
}

function normalizeRecoveryCode(recoveryCode) {
  return String(recoveryCode || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateRecoveryCode,
  buildRecoveryCodeHash,
  verifyRecoveryCode,
  normalizeRecoveryCode,
};
