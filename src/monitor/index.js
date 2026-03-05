// ============================================
// 📊 monitor/index.js — Message Monitoring System v1.0
// ============================================
// Core monitoring module for capturing and managing
// WhatsApp messages, calls, and media.
//
// Features:
// - Fire-and-forget message recording
// - Configurable capture settings
// - Query and export functionality
// - Automatic data retention cleanup
// ============================================

const { db } = require('../db');

/**
 * Helper to dynamically require and call scheduledWrite
 * Prevents circular dependency issues during module initialization
 */
function dynamicScheduledWrite() {
  const { scheduledWrite: sw } = require('../db');
  if (typeof sw === 'function') sw();
}
const {
  processTextMessage,
  processMediaMessage,
  processStickerMessage,
  processLocationMessage,
  processContactMessage,
  processPollMessage,
  extractMessageMetadata,
} = require('./message-handler');
const {
  handleIncomingCall,
  handleOutgoingCall,
  handleCallEnd,
  handleMissedCall,
} = require('./call-handler');
const { downloadAndSave, cleanupOldMedia } = require('./media-manager');

// ============================================
// 🏗️ Module State
// ============================================
let monitorDb = null;
let isInitialized = false;

// ============================================
// 🚀 Initialization & Configuration
// ============================================

/**
 * Initialize the monitoring system with database instance.
 * @param {object} database — Database instance (uses db.js export)
 */
function initMonitor(database) {
  monitorDb = database || db;
  isInitialized = true;

  // Ensure monitor collections exist
  if (!monitorDb.data.monitorConfig) {
    monitorDb.data.monitorConfig = getDefaultConfig();
  }
  if (!monitorDb.data.monitoredMessages) {
    monitorDb.data.monitoredMessages = [];
  }
  if (!monitorDb.data.monitoredCalls) {
    monitorDb.data.monitoredCalls = [];
  }
  if (!monitorDb.data.mediaIndex) {
    monitorDb.data.mediaIndex = [];
  }

  // Override with environment variables if set
  if (process.env.MONITORING_ENABLED === 'true') {
    monitorDb.data.monitorConfig.enabled = true;
  }
  if (process.env.MONITOR_RETENTION_DAYS) {
    monitorDb.data.monitorConfig.retentionDays = parseInt(process.env.MONITOR_RETENTION_DAYS, 10);
  }
  if (process.env.MONITOR_SAVE_MEDIA === 'false') {
    monitorDb.data.monitorConfig.saveMedia = false;
  }

  dynamicScheduledWrite();
  console.log('📊 Message monitoring system initialized');
}

/**
 * Get default monitoring configuration.
 * @returns {object} Default config
 */
function getDefaultConfig() {
  return {
    enabled: false,
    captureText: true,
    captureImages: true,
    captureVideo: true,
    captureAudio: true,
    captureStickers: true,
    captureDocuments: true,
    captureLocations: true,
    captureContacts: true,
    capturePolls: true,
    captureGroups: true,
    captureDMs: true,
    captureStatus: false,
    retentionDays: 30,
    saveMedia: true,
    mediaPath: './data/media',
  };
}

/**
 * Check if monitoring is enabled.
 * @returns {boolean}
 */
function isEnabled() {
  if (!isInitialized) return false;
  return monitorDb.data.monitorConfig?.enabled || false;
}

/**
 * Get current monitoring configuration.
 * @returns {object}
 */
function getConfig() {
  if (!isInitialized) return getDefaultConfig();
  return { ...monitorDb.data.monitorConfig };
}

/**
 * Update monitoring configuration.
 * @param {object} config — Partial config to update
 */
function configureMonitor(config) {
  if (!isInitialized) {
    console.error('❌ Monitor not initialized');
    return;
  }

  monitorDb.data.monitorConfig = {
    ...monitorDb.data.monitorConfig,
    ...config,
  };
  dynamicScheduledWrite();
  console.log('📊 Monitor configuration updated');
}

// ============================================
// 💬 Message Recording
// ============================================

/**
 * Record a message to the monitoring database.
 * Fire-and-forget pattern - never blocks main bot flow.
 * @param {object} msg — WhatsApp message object
 * @param {object} chat — WhatsApp chat object
 * @param {object} contact — WhatsApp contact object
 * @returns {Promise<string|null>} — Record ID or null
 */
function recordMessage(msg, chat, contact) {
  if (!isInitialized || !isEnabled()) {
    return Promise.resolve(null);
  }

  // Run in background - don't await for main flow
  return (async () => {
    try {
      const config = monitorDb.data.monitorConfig;

      // Skip if message is from status and status capture is disabled
      if (msg.isStatus && !config.captureStatus) return null;

      // Skip based on chat type
      const isGroup = chat.isGroup;
      if (isGroup && !config.captureGroups) return null;
      if (!isGroup && !config.captureDMs) return null;

      // Process based on message type
      let messageData = null;
      const type = msg.type || 'chat';

      switch (type) {
        case 'chat':
        case 'text':
          if (!config.captureText) return null;
          messageData = await processTextMessage(msg);
          break;

        case 'image':
          if (!config.captureImages) return null;
          messageData = await processMediaMessage(msg, 'image');
          break;

        case 'video':
          if (!config.captureVideo) return null;
          messageData = await processMediaMessage(msg, 'video');
          break;

        case 'audio':
        case 'ptt':
          if (!config.captureAudio) return null;
          messageData = await processMediaMessage(msg, type);
          break;

        case 'sticker':
          if (!config.captureStickers) return null;
          messageData = await processStickerMessage(msg);
          break;

        case 'document':
          if (!config.captureDocuments) return null;
          messageData = await processMediaMessage(msg, 'document');
          break;

        case 'location':
          if (!config.captureLocations) return null;
          messageData = await processLocationMessage(msg);
          break;

        case 'vcard':
        case 'multi_vcard':
          if (!config.captureContacts) return null;
          messageData = await processContactMessage(msg);
          break;

        case 'poll':
          if (!config.capturePolls) return null;
          messageData = await processPollMessage(msg);
          break;

        default:
          // For unknown types, just capture basic metadata
          messageData = { type, body: msg.body || '' };
      }

      if (!messageData) return null;

      // Extract common metadata
      const metadata = await extractMessageMetadata(msg, chat, contact);

      // Download and save media if applicable
      let mediaPath = null;
      if (config.saveMedia && msg.hasMedia && shouldCaptureMedia(type, config)) {
        try {
          mediaPath = await downloadAndSave(msg, config.mediaPath);
          if (mediaPath) {
            // Add to media index
            addToMediaIndex(msg.id._serialized, mediaPath, msg);
          }
        } catch (error) {
          console.error('❌ Media download error:', error.message);
        }
      }

      // Create the full record
      const record = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        messageId: msg.id._serialized,
        ...metadata,
        ...messageData,
        mediaPath,
        isForwarded: msg.isForwarded || false,
        forwardScore: msg.forwardScore || 0,
        fromMe: msg.fromMe || false,
        isStatus: msg.isStatus || false,
        quotedMessageId: msg.hasQuotedMsg ? (await msg.getQuotedMessage())?.id?._serialized : null,
        timestamp: msg.timestamp * 1000 || Date.now(),
        createdAt: Date.now(),
      };

      // Add to database
      monitorDb.data.monitoredMessages.push(record);

      // Enforce retention limit
      enforceRetentionLimit();

      dynamicScheduledWrite();

      return record.id;
    } catch (error) {
      console.error('❌ recordMessage error:', error.message);
      return null;
    }
  })();

  return null;
}

/**
 * Check if media should be captured for this message type.
 * @param {string} type — Message type
 * @param {object} config — Monitor config
 * @returns {boolean}
 */
function shouldCaptureMedia(type, config) {
  switch (type) {
    case 'image': return config.captureImages;
    case 'video': return config.captureVideo;
    case 'audio':
    case 'ptt': return config.captureAudio;
    case 'sticker': return config.captureStickers;
    case 'document': return config.captureDocuments;
    default: return false;
  }
}

/**
 * Add a media file to the index.
 * @param {string} messageId — Original message ID
 * @param {string} localPath — Local file path
 * @param {object} msg — Message object
 */
function addToMediaIndex(messageId, localPath, msg) {
  try {
    const mediaRecord = {
      id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      messageId,
      localPath,
      downloadedAt: Date.now(),
      expiresAt: Date.now() + (monitorDb.data.monitorConfig.retentionDays * 24 * 60 * 60 * 1000),
    };

    monitorDb.data.mediaIndex.push(mediaRecord);
    dynamicScheduledWrite();
  } catch (error) {
    console.error('❌ addToMediaIndex error:', error.message);
  }
}

// ============================================
// 📞 Call Recording
// ============================================

/**
 * Record a call event.
 * @param {object} callData — Call event data
 * @returns {Promise<string|null>} — Record ID or null
 */
function recordCall(callData) {
  if (!isInitialized || !isEnabled()) {
    return Promise.resolve(null);
  }

  // Run in background
  return (async () => {
    try {
      const record = {
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        callId: callData.callId || callData.id,
        chatId: callData.chatId,
        chatName: callData.chatName || 'Unknown',
        isGroupCall: callData.isGroupCall || false,
        callerId: callData.callerId,
        callerName: callData.callerName || 'Unknown',
        type: callData.type || 'audio', // audio | video
        direction: callData.direction, // incoming | outgoing
        status: callData.status, // ringing | accepted | ended | missed
        startedAt: callData.startedAt || Date.now(),
        answeredAt: callData.answeredAt || null,
        endedAt: callData.endedAt || null,
        duration: callData.duration || 0,
        endReason: callData.endReason || null,
        timestamp: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      monitorDb.data.monitoredCalls.push(record);

      // Enforce retention limit
      enforceRetentionLimit();

      dynamicScheduledWrite();

      return record.id;
    } catch (error) {
      console.error('❌ recordCall error:', error.message);
      return null;
    }
  })();

  return null;
}

// ============================================
// 🔍 Query Operations
// ============================================

/**
 * Query stored messages with filters.
 * @param {object} query — Query options
 * @returns {object} — Paginated results
 */
function getMessages(query = {}) {
  if (!isInitialized) return { messages: [], total: 0, page: 1, totalPages: 0 };

  try {
    let messages = [...monitorDb.data.monitoredMessages];

    // Apply filters
    if (query.types && query.types.length > 0) {
      messages = messages.filter(m => query.types.includes(m.type));
    }

    if (query.chatId) {
      messages = messages.filter(m => m.chatId === query.chatId);
    }

    if (query.senderId) {
      messages = messages.filter(m => m.senderId === query.senderId);
    }

    if (query.isGroup !== undefined) {
      messages = messages.filter(m => m.isGroup === query.isGroup);
    }

    if (query.fromMe !== undefined) {
      messages = messages.filter(m => m.fromMe === query.fromMe);
    }

    if (query.hasMedia !== undefined) {
      messages = messages.filter(m => !!m.mediaPath === query.hasMedia);
    }

    if (query.startDate) {
      messages = messages.filter(m => m.timestamp >= query.startDate);
    }

    if (query.endDate) {
      messages = messages.filter(m => m.timestamp <= query.endDate);
    }

    if (query.searchQuery) {
      const search = query.searchQuery.toLowerCase();
      messages = messages.filter(m =>
        (m.body && m.body.toLowerCase().includes(search)) ||
        (m.senderName && m.senderName.toLowerCase().includes(search)) ||
        (m.chatName && m.chatName.toLowerCase().includes(search))
      );
    }

    // Sort
    const sortBy = query.sortBy || 'timestamp';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    messages.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === 1 ? aVal - bVal : bVal - aVal;
    });

    // Paginate
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 500);
    const total = messages.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedMessages = messages.slice(startIndex, startIndex + limit);

    return {
      messages: paginatedMessages,
      total,
      page,
      totalPages,
    };
  } catch (error) {
    console.error('❌ getMessages error:', error.message);
    return { messages: [], total: 0, page: 1, totalPages: 0 };
  }
}

/**
 * Query call logs with filters.
 * @param {object} query — Query options
 * @returns {object} — Paginated results
 */
function getCalls(query = {}) {
  if (!isInitialized) return { calls: [], total: 0, page: 1, totalPages: 0 };

  try {
    let calls = [...monitorDb.data.monitoredCalls];

    // Apply filters
    if (query.types && query.types.length > 0) {
      calls = calls.filter(c => query.types.includes(c.type));
    }

    if (query.directions && query.directions.length > 0) {
      calls = calls.filter(c => query.directions.includes(c.direction));
    }

    if (query.statuses && query.statuses.length > 0) {
      calls = calls.filter(c => query.statuses.includes(c.status));
    }

    if (query.chatId) {
      calls = calls.filter(c => c.chatId === query.chatId);
    }

    if (query.callerId) {
      calls = calls.filter(c => c.callerId === query.callerId);
    }

    if (query.isGroupCall !== undefined) {
      calls = calls.filter(c => c.isGroupCall === query.isGroupCall);
    }

    if (query.startDate) {
      calls = calls.filter(c => c.timestamp >= query.startDate);
    }

    if (query.endDate) {
      calls = calls.filter(c => c.timestamp <= query.endDate);
    }

    // Sort
    const sortBy = query.sortBy || 'timestamp';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    calls.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === 1 ? aVal - bVal : bVal - aVal;
    });

    // Paginate
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 500);
    const total = calls.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedCalls = calls.slice(startIndex, startIndex + limit);

    return {
      calls: paginatedCalls,
      total,
      page,
      totalPages,
    };
  } catch (error) {
    console.error('❌ getCalls error:', error.message);
    return { calls: [], total: 0, page: 1, totalPages: 0 };
  }
}

// ============================================
// 📤 Export Operations
// ============================================

/**
 * Export data to JSON or CSV format.
 * @param {string} format — 'json' or 'csv'
 * @param {object} filters — Query filters
 * @returns {string} — Export string
 */
function exportData(format, filters = {}) {
  if (!isInitialized) return '';

  try {
    const data = filters.dataType === 'calls' ? getCalls(filters) : getMessages(filters);
    const items = filters.dataType === 'calls' ? data.calls : data.messages;

    if (format === 'csv') {
      return exportToCSV(items, filters.dataType);
    }

    // Default to JSON
    return JSON.stringify(items, null, 2);
  } catch (error) {
    console.error('❌ exportData error:', error.message);
    return '';
  }
}

/**
 * Convert items to CSV format.
 * @param {Array} items — Items to export
 * @param {string} dataType — 'messages' or 'calls'
 * @returns {string} — CSV string
 */
function exportToCSV(items, dataType) {
  if (items.length === 0) return '';

  if (dataType === 'calls') {
    const headers = ['ID', 'Timestamp', 'Direction', 'Type', 'Status', 'Caller', 'Duration', 'Chat'];
    const rows = items.map(c => [
      c.id,
      new Date(c.timestamp).toISOString(),
      c.direction,
      c.type,
      c.status,
      c.callerName,
      c.duration,
      c.chatName,
    ]);
    return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  }

  // Messages
  const headers = ['ID', 'Timestamp', 'Type', 'Chat', 'Sender', 'Content', 'IsGroup', 'FromMe'];
  const rows = items.map(m => [
    m.id,
    new Date(m.timestamp).toISOString(),
    m.type,
    m.chatName,
    m.senderName,
    (m.body || '').substring(0, 100).replace(/"/g, '""'),
    m.isGroup,
    m.fromMe,
  ]);
  return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
}

// ============================================
// 🧹 Maintenance Operations
// ============================================

/**
 * Enforce retention limits on messages and calls.
 */
function enforceRetentionLimit() {
  try {
    const config = monitorDb.data.monitorConfig;
    const retentionMs = config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;

    // Filter messages
    const initialMsgCount = monitorDb.data.monitoredMessages.length;
    monitorDb.data.monitoredMessages = monitorDb.data.monitoredMessages.filter(
      m => m.timestamp >= cutoff
    );

    // Filter calls
    const initialCallCount = monitorDb.data.monitoredCalls.length;
    monitorDb.data.monitoredCalls = monitorDb.data.monitoredCalls.filter(
      c => c.timestamp >= cutoff
    );

    // Limit array sizes (hard limit to prevent memory issues)
    const MAX_MESSAGES = 10000;
    const MAX_CALLS = 1000;

    if (monitorDb.data.monitoredMessages.length > MAX_MESSAGES) {
      monitorDb.data.monitoredMessages = monitorDb.data.monitoredMessages.slice(-MAX_MESSAGES);
    }

    if (monitorDb.data.monitoredCalls.length > MAX_CALLS) {
      monitorDb.data.monitoredCalls = monitorDb.data.monitoredCalls.slice(-MAX_CALLS);
    }

    const removed = (initialMsgCount - monitorDb.data.monitoredMessages.length) +
                    (initialCallCount - monitorDb.data.monitoredCalls.length);

    if (removed > 0) {
      dynamicScheduledWrite();
    }
  } catch (error) {
    console.error('❌ enforceRetentionLimit error:', error.message);
  }
}

/**
 * Clear old data based on retention settings.
 * @returns {object} — Cleanup stats
 */
function clearOldData() {
  if (!isInitialized) return { cleared: 0 };

  try {
    const config = monitorDb.data.monitorConfig;
    const retentionMs = config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;

    // Clear old messages
    const initialMsgCount = monitorDb.data.monitoredMessages.length;
    monitorDb.data.monitoredMessages = monitorDb.data.monitoredMessages.filter(
      m => m.timestamp >= cutoff
    );

    // Clear old calls
    const initialCallCount = monitorDb.data.monitoredCalls.length;
    monitorDb.data.monitoredCalls = monitorDb.data.monitoredCalls.filter(
      c => c.timestamp >= cutoff
    );

    // Cleanup old media
    let clearedMedia = 0;
    if (config.saveMedia) {
      clearedMedia = cleanupOldMedia(config.retentionDays, monitorDb.data.mediaIndex);
    }

    const clearedMessages = initialMsgCount - monitorDb.data.monitoredMessages.length;
    const clearedCalls = initialCallCount - monitorDb.data.monitoredCalls.length;

    dynamicScheduledWrite();

    return {
      clearedMessages,
      clearedCalls,
      clearedMedia,
      totalCleared: clearedMessages + clearedCalls + clearedMedia,
    };
  } catch (error) {
    console.error('❌ clearOldData error:', error.message);
    return { cleared: 0 };
  }
}

/**
 * Get monitoring statistics.
 * @returns {object} — Stats object
 */
function getStats() {
  if (!isInitialized) {
    return {
      enabled: false,
      totalMessages: 0,
      totalCalls: 0,
      mediaFiles: 0,
    };
  }

  try {
    const messages = monitorDb.data.monitoredMessages;
    const calls = monitorDb.data.monitoredCalls;

    // Type counts
    const typeCounts = {};
    messages.forEach(m => {
      typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
    });

    // Daily counts (last 7 days)
    const dailyCounts = {};
    const now = Date.now();
    for (let i = 0; i < 7; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      dailyCounts[dateKey] = messages.filter(
        m => new Date(m.timestamp).toISOString().split('T')[0] === dateKey
      ).length;
    }

    return {
      enabled: monitorDb.data.monitorConfig.enabled,
      config: monitorDb.data.monitorConfig,
      totalMessages: messages.length,
      totalCalls: calls.length,
      mediaFiles: monitorDb.data.mediaIndex.length,
      typeCounts,
      dailyCounts,
    };
  } catch (error) {
    console.error('❌ getStats error:', error.message);
    return {
      enabled: false,
      totalMessages: 0,
      totalCalls: 0,
      mediaFiles: 0,
    };
  }
}

// ============================================
// 📤 Module Exports
// ============================================
module.exports = {
  // Initialization
  initMonitor,
  isEnabled,
  getConfig,
  configureMonitor,

  // Recording
  recordMessage,
  recordCall,

  // Queries
  getMessages,
  getCalls,

  // Export
  exportData,

  // Maintenance
  clearOldData,
  getStats,

  // Re-export handlers for advanced use
  handlers: {
    handleIncomingCall,
    handleOutgoingCall,
    handleCallEnd,
    handleMissedCall,
  },
};
