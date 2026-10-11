const crypto = require("crypto");

/**
 * Generates a secure, cryptographically random hex string.
 *
 * @param {number} [bytes=32] - Number of random bytes
 * @returns {string} Hexadecimal string
 */
const generateRandomToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString("hex");
};

/**
 * Hashes a plaintext token using SHA-256 for safe database lookups.
 *
 * @param {string} token - Plain text token
 * @returns {string} SHA-256 digest hex string
 */
const hashToken = (token) => {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
};

/**
 * Generates an alphanumeric verification OTP code.
 *
 * @param {number} [length=6] - Desired OTP length
 * @returns {string} Numeric OTP string
 */
const generateNumericOTP = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return crypto.randomInt(min, max + 1).toString();
};

module.exports = {
  generateRandomToken,
  hashToken,
  generateNumericOTP,
};