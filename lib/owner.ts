/**
 * Canonical SaaS Owner Identity and Verification
 * Project: Tech With Salman — Social Media OS
 * Authorized Owner: Salman Designer (salmandesigner24@gmail.com)
 */

export const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.SUPER_ADMIN_EMAIL ||
  'salmandesigner24@gmail.com'
).toLowerCase().trim();

export const OWNER_NAME = 'Salman Designer 24';

/**
 * Normalized comparison to verify if an email belongs to the canonical owner
 */
export function isOwnerEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.toLowerCase().trim();
  return normalized === OWNER_EMAIL || normalized === 'salmandesigner24@gmail.com';
}

/**
 * Verify whether a User entity represents the canonical owner
 */
export function isOwnerUser(user?: { email?: string | null } | null): boolean {
  return isOwnerEmail(user?.email);
}

/**
 * Verify whether a Session represents the canonical owner
 */
export function isOwnerSession(session?: { email?: string | null } | null): boolean {
  return isOwnerEmail(session?.email);
}
