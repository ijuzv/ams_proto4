/**
 * Avatar utility functions for DiceBear integration
 */

const DEFAULT_STYLE = 'avataaars';
const DICEBEAR_BASE_URL = 'https://api.dicebear.com/9.x';

/**
 * Generate a random seed for avatar generation
 */
export function generateRandomSeed(): string {
  // Use crypto.randomUUID if available, otherwise fallback to timestamp + random
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate multiple random seeds for avatar selection
 */
export function generateAvatarSeeds(count: number = 6): string[] {
  return Array.from({ length: count }, () => generateRandomSeed());
}

/**
 * Build DiceBear avatar URL from seed and style
 */
export function getAvatarUrl(seed: string, style: string = DEFAULT_STYLE): string {
  // Add happiness parameters to make avatars more cheerful
  const params = new URLSearchParams({
    seed: seed,
    mouth: 'smile',
    eyes: 'happy'
  });
  return `${DICEBEAR_BASE_URL}/${style}/svg?${params.toString()}`;
}

/**
 * Get default avatar style
 */
export function getDefaultAvatarStyle(): string {
  return DEFAULT_STYLE;
}

/**
 * Extract seed from a DiceBear URL (for backwards compatibility if needed)
 */
export function extractSeedFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const seed = urlObj.searchParams.get('seed');
    return seed;
  } catch {
    return null;
  }
}

