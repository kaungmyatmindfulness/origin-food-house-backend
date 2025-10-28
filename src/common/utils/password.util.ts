import * as bcrypt from "bcrypt";

/**
 * Shared password hashing utilities
 * Centralizes password hashing logic to avoid duplication
 */

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Hashes a password using bcrypt with the configured salt rounds
 * @param password Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compares a plain text password with a hashed password
 * @param password Plain text password
 * @param hashedPassword Hashed password from database
 * @returns True if passwords match, false otherwise
 */
export async function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}
