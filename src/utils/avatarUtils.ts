/**
 * Avatar Utilities
 * Storage optimization: avatar uploading to Firebase Storage has been completely removed
 * to eliminate cloud storage costs and bandwidth consumption.
 * Replaced with lightweight initials and static icon generation.
 */

/**
 * Returns customer initial letter
 */
export const getCustomerInitial = (name?: string): string => {
  if (!name || typeof name !== 'string') return 'U';
  const clean = name.trim().replace(/^[@#]/, '');
  return (clean.charAt(0) || 'U').toUpperCase();
};

/**
 * No-op stubs for backward compatibility
 */
export const optimizeGoogleAvatarUrl = (_url?: string): string => {
  return '';
};

export const handleUploadAvatar = async (_file: File, _userId: string): Promise<string> => {
  console.warn("Avatar upload is disabled for storage optimization.");
  return '';
};

export const handleDeleteAvatar = async (_userId: string): Promise<void> => {
  console.log("Avatar is managed via initials.");
};
