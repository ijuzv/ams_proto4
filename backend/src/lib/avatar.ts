/**
 * Avatar utility functions for DiceBear integration (Backend)
 */

const DEFAULT_STYLE = 'avataaars';
const DICEBEAR_BASE_URL = 'https://api.dicebear.com/9.x';

/**
 * Generate a random seed for avatar generation
 */
export function generateRandomSeed(): string {
  // For Node.js, use crypto module
  const crypto = require('crypto');
  return crypto.randomUUID();
}

/**
 * Build DiceBear avatar URL from seed and style
 */
export function getAvatarUrl(seed: string, style: string = DEFAULT_STYLE): string {
  return `${DICEBEAR_BASE_URL}/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

/**
 * Get default avatar style
 */
export function getDefaultAvatarStyle(): string {
  return DEFAULT_STYLE;
}

