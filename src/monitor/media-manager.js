// ============================================
// 🖼️ monitor/media-manager.js — Media Download & Storage
// ============================================
// Handles downloading and storing media files from WhatsApp.
// Organizes files by date: data/media/YYYY/MM/DD/
// ============================================

const fs = require('fs');
const path = require('path');

// ============================================
// 📁 Path Utilities
// ============================================

/**
 * Generate a file path for storing media.
 * Organized by date: YYYY/MM/DD/
 * @param {string} mimetype — MIME type of the media
 * @param {number} timestamp — Unix timestamp
 * @returns {string} — Full file path
 */
function generateFilePath(mimetype, timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear().toString();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Get category from mimetype
  const category = getCategoryFromMimetype(mimetype);

  // Generate filename
  const extension = getExtensionFromMimetype(mimetype);
  const filename = `${category}_${timestamp}_${Math.random().toString(36).substr(2, 9)}${extension}`;

  // Build path
  const basePath = path.join(process.cwd(), 'data', 'media');
  const dirPath = path.join(basePath, year, month, day);

  return {
    dirPath,
    filePath: path.join(dirPath, filename),
    relativePath: path.join('data', 'media', year, month, day, filename),
    category,
    filename,
  };
}

/**
 * Get category folder from MIME type.
 * @param {string} mimetype — MIME type
 * @returns {string} — Category: images, videos, audio, documents, stickers
 */
function getCategoryFromMimetype(mimetype) {
  if (!mimetype) return 'documents';

  const type = mimetype.toLowerCase();

  if (type.startsWith('image/')) {
    return type.includes('webp') ? 'stickers' : 'images';
  }
  if (type.startsWith('video/')) return 'videos';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('voice/') || type === 'ptt') return 'audio';

  return 'documents';
}

/**
 * Get file extension from MIME type.
 * @param {string} mimetype — MIME type
 * @returns {string} — File extension with dot
 */
function getExtensionFromMimetype(mimetype) {
  if (!mimetype) return '.bin';

  const extensions = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'video/mp4': '.mp4',
    'video/avi': '.avi',
    'video/mov': '.mov',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/aac': '.aac',
    'audio/mp4': '.m4a',
    'audio/webm': '.webm',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt',
    'application/zip': '.zip',
    'application/x-rar-compressed': '.rar',
  };

  return extensions[mimetype.toLowerCase()] || '.bin';
}

// ============================================
// 💾 Download Operations
// ============================================

/**
 * Download media from a message and save to disk.
 * @param {object} msg — WhatsApp message object with media
 * @param {string} customBasePath — Optional custom base path
 * @returns {Promise<string|null>} — Path to saved file or null
 */
async function downloadAndSave(msg, customBasePath) {
  try {
    // Download the media
    const media = await msg.downloadMedia();

    if (!media || !media.data) {
      console.log('⚠️ No media data found in message');
      return null;
    }

    // Generate file path
    const timestamp = msg.timestamp ? msg.timestamp * 1000 : Date.now();
    const paths = generateFilePath(media.mimetype, timestamp);

    // Ensure directory exists
    if (!fs.existsSync(paths.dirPath)) {
      fs.mkdirSync(paths.dirPath, { recursive: true });
    }

    // Decode base64 and save
    const buffer = Buffer.from(media.data, 'base64');
    fs.writeFileSync(paths.filePath, buffer);

    console.log(`💾 Media saved: ${paths.relativePath} (${formatBytes(buffer.length)})`);

    return paths.relativePath;
  } catch (error) {
    console.error('❌ downloadAndSave error:', error.message);
    return null;
  }
}

/**
 * Format bytes to human-readable string.
 * @param {number} bytes — Size in bytes
 * @returns {string} — Formatted size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// ============================================
// 🧹 Cleanup Operations
// ============================================

/**
 * Remove media files older than specified days.
 * @param {number} days — Number of days to keep
 * @param {Array} mediaIndex — Media index array from database
 * @returns {number} — Number of files removed
 */
function cleanupOldMedia(days, mediaIndex) {
  if (!days || days < 1) return 0;

  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  let removed = 0;

  try {
    // Clean up based on media index
    if (mediaIndex && Array.isArray(mediaIndex)) {
      const toRemove = mediaIndex.filter(item => item.downloadedAt < cutoff);

      for (const item of toRemove) {
        try {
          const fullPath = path.join(process.cwd(), item.localPath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            removed++;
            console.log(`🗑️ Removed old media: ${item.localPath}`);
          }
        } catch (err) {
          // Ignore individual file errors
        }
      }
    }

    // Also clean up empty directories
    cleanupEmptyDirs(path.join(process.cwd(), 'data', 'media'));
  } catch (error) {
    console.error('❌ cleanupOldMedia error:', error.message);
  }

  return removed;
}

/**
 * Recursively remove empty directories.
 * @param {string} dirPath — Directory to clean
 */
function cleanupEmptyDirs(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return;

    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        cleanupEmptyDirs(fullPath);

        // Check if empty now
        const remaining = fs.readdirSync(fullPath);
        if (remaining.length === 0) {
          fs.rmdirSync(fullPath);
          console.log(`🗑️ Removed empty directory: ${fullPath}`);
        }
      }
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Get storage statistics for media.
 * @returns {object} — Storage stats
 */
function getStorageStats() {
  const basePath = path.join(process.cwd(), 'data', 'media');

  const stats = {
    totalSize: 0,
    fileCount: 0,
    byCategory: {},
  };

  try {
    if (!fs.existsSync(basePath)) {
      return stats;
    }

    scanDirectory(basePath, stats);
  } catch (error) {
    console.error('❌ getStorageStats error:', error.message);
  }

  return stats;
}

/**
 * Recursively scan directory for stats.
 * @param {string} dirPath — Directory path
 * @param {object} stats — Stats accumulator
 */
function scanDirectory(dirPath, stats) {
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath, stats);
    } else {
      stats.totalSize += stat.size;
      stats.fileCount++;

      // Categorize by extension
      const ext = path.extname(item).toLowerCase();
      const category = getCategoryFromExtension(ext);
      stats.byCategory[category] = (stats.byCategory[category] || 0) + stat.size;
    }
  }
}

/**
 * Get category from file extension.
 * @param {string} extension — File extension
 * @returns {string} — Category
 */
function getCategoryFromExtension(extension) {
  const ext = extension.toLowerCase();

  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext)) return 'images';
  if (ext === '.webp') return 'stickers';
  if (['.mp4', '.avi', '.mov'].includes(ext)) return 'videos';
  if (['.mp3', '.ogg', '.wav', '.aac', '.m4a', '.webm'].includes(ext)) return 'audio';

  return 'documents';
}

// ============================================
// 📤 Module Exports
// ============================================
module.exports = {
  downloadAndSave,
  generateFilePath,
  cleanupOldMedia,
  getStorageStats,
  formatBytes,
  getCategoryFromMimetype,
  getExtensionFromMimetype,
};
