// bcrypt wrapper — the only place bcryptjs is imported directly. Kept
// separate from storage.js (Supabase I/O) since hashing/comparing/detecting
// a hash's format is pure logic; the silent legacy-password migration that
// actually writes a re-hashed password back to Supabase lives in storage.js
// (see verifyAndMigratePassword), since that's the piece that touches the DB.
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

// bcrypt hashes always look like $2a$12$..., $2b$12$..., or $2y$12$... —
// used to tell an already-migrated row apart from a legacy plain-text one.
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/

export function isBcryptHash(value) {
  return typeof value === 'string' && BCRYPT_HASH_PATTERN.test(value)
}

export async function hashPassword(plainTextPassword) {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS)
}

export async function comparePassword(plainTextPassword, hash) {
  return bcrypt.compare(plainTextPassword, hash)
}
