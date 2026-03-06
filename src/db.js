// ============================================
// 📦 db.js — Lightweight Database Layer v2.2
// ============================================
// Uses lowdb v5 (CommonJS) with a JSON file backend.
// Stores: users, muted groups, broadcasts, stats, message log, notes, reminders.
//
// UPGRADE v2.2:
// - Schema version bumped for future migrations
// - Improved error handling in database operations
//
// UPGRADE v2.0:
// - Write-batching: debounced writes to reduce disk I/O
// - Schema migration: safely adds new fields to old data
// - Conversation history per user for AI context
// - Error boundaries around every db operation
// - Daily message count tracking for stats
// - NEW: Notes storage per user
// - NEW: Reminders with scheduling
// - NEW: User preferences (personality mode)
// - NEW: Command usage tracking
// - NEW: User statistics
// ============================================

const { join } = require('path');
const { mkdirSync, existsSync } = require('fs');

// lowdb v5 imports (CommonJS compatible)
const { LowSync } = require('lowdb');
const { JSONFileSync } = require('lowdb/node');

// 📂 Ensure data directory exists
const DATA_DIR = join(__dirname, '..', 'data');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
  console.log('📂 Created data directory');
}

// 🗄️ Default database schema (v5)
const DEFAULT_DATA = {
  schemaVersion: 5,
  users: {},           // { "userId": { name, firstSeen, messageCount, lastMessage, conversationHistory, preferences, notes, reminders, commandsUsed } }
  mutedGroups: [],     // [ "groupId1", "groupId2" ]
  broadcasts: [],      // [ { message, timestamp, groupCount } ]
  stats: {
    messagesHandled: 0,
    startTime: null,
    dailyCounts: {},   // { "2026-02-25": 42 } — per-day counts
    commandsUsed: {},  // { "!help": 10, "!ask": 5 }
  },
  messageLog: [],    // [ { from, body, timestamp, type } ] — last 200 entries
  scheduledReminders: [], // [ { id, userId, chatId, message, triggerTime, isGroup, completed } ]
  proxySessions: [], // [ { id, userId, targetId, targetName, startTime, active, lastActivity } ]
  replyModes: {},    // { "chatId": { enabled, groupMentions, lastAdminReply } }
  // 🗳️ Active polls in groups
  polls: [],         // [ { id, chatId, question, options: [{text, voters: []}], createdBy, createdAt, active } ]
  // 🤖 Chatbot sessions for !ask command
  chatbotSessions: {}, // { "userId": { active, startTime, lastActivity, messageCount } }
  // 📊 Message Monitoring System
  monitorConfig: {
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
  },
  monitoredMessages: [], // [ { id, messageId, type, body, chatId, senderId, timestamp, ... } ]
  monitoredCalls: [],    // [ { id, callId, type, direction, status, callerId, ... } ]
  mediaIndex: [],        // [ { id, messageId, localPath, downloadedAt, expiresAt } ]
};

// 🔧 Initialize lowdb with JSON file
let adapter, db;

try {
  adapter = new JSONFileSync(join(DATA_DIR, 'db.json'));
  db = new LowSync(adapter, DEFAULT_DATA);
  db.read();
} catch (error) {
  console.error('❌ Failed to initialize database:', error.message);
  console.log('🔄 Creating fresh database...');
  // If db.json is corrupted, recreate it
  const fs = require('fs');
  const dbPath = join(DATA_DIR, 'db.json');
  if (existsSync(dbPath)) {
    fs.renameSync(dbPath, join(DATA_DIR, `db_backup_${Date.now()}.json`));
  }
  adapter = new JSONFileSync(dbPath);
  db = new LowSync(adapter, DEFAULT_DATA);
  db.read();
}

// If db.json was empty, write defaults
if (!db.data) {
  db.data = DEFAULT_DATA;
}

// ─────────────────────────────────────────
// 🔄 Schema Migration — safely upgrade old data
// ─────────────────────────────────────────
function migrateSchema() {
  let migrated = false;

  // Ensure all top-level keys exist
  if (!db.data.schemaVersion) {
    db.data.schemaVersion = 5;
    migrated = true;
  }
  // Migrate to v5
  if (db.data.schemaVersion < 5) {
    db.data.schemaVersion = 5;
    migrated = true;
  }
  if (!db.data.users) { db.data.users = {}; migrated = true; }
  if (!db.data.mutedGroups) { db.data.mutedGroups = []; migrated = true; }
  if (!db.data.broadcasts) { db.data.broadcasts = []; migrated = true; }
  if (!db.data.stats) { db.data.stats = { messagesHandled: 0, startTime: null, dailyCounts: {}, commandsUsed: {} }; migrated = true; }
  if (!db.data.messageLog) { db.data.messageLog = []; migrated = true; }
  if (!db.data.scheduledReminders) { db.data.scheduledReminders = []; migrated = true; }
  if (!db.data.stats.dailyCounts) { db.data.stats.dailyCounts = {}; migrated = true; }
  if (!db.data.stats.commandsUsed) { db.data.stats.commandsUsed = {}; migrated = true; }
  if (!db.data.proxySessions) { db.data.proxySessions = []; migrated = true; }
  if (!db.data.replyModes) { db.data.replyModes = {}; migrated = true; }
  if (!db.data.polls) { db.data.polls = []; migrated = true; }
  if (!db.data.chatbotSessions) { db.data.chatbotSessions = {}; migrated = true; }

  // 📊 Monitoring schema migration
  if (!db.data.monitorConfig) {
    db.data.monitorConfig = {
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
    migrated = true;
  }
  if (!db.data.monitoredMessages) { db.data.monitoredMessages = []; migrated = true; }
  if (!db.data.monitoredCalls) { db.data.monitoredCalls = []; migrated = true; }
  if (!db.data.mediaIndex) { db.data.mediaIndex = []; migrated = true; }

  // Migrate existing users to include new fields
  for (const userId of Object.keys(db.data.users)) {
    const user = db.data.users[userId];
    if (!user.conversationHistory) {
      user.conversationHistory = [];
      migrated = true;
    }
    if (!user.preferences) {
      user.preferences = {};
      migrated = true;
    }
    if (!user.notes) {
      user.notes = [];
      migrated = true;
    }
    if (!user.reminders) {
      user.reminders = [];
      migrated = true;
    }
    if (!user.commandsUsed) {
      user.commandsUsed = {};
      migrated = true;
    }
    if (!user.tasks) {
      user.tasks = [];
      migrated = true;
    }
  }

  if (migrated) {
    console.log('🔄 Database schema migrated to v5');
  }
}

migrateSchema();

// Set start time if not already set
if (!db.data.stats.startTime) {
  db.data.stats.startTime = Date.now();
}

// Initial write to ensure db file exists
db.write();

// ─────────────────────────────────────────
// ⚡ Write-Batching — debounced disk writes
// ─────────────────────────────────────────
// Instead of writing on every single change, batch writes
// with a 500ms debounce. This dramatically reduces I/O on
// the low-spec hardware.
let writeTimer = null;
const WRITE_DEBOUNCE_MS = 500;

/**
 * Schedule a debounced write. Multiple calls within 500ms
 * will coalesce into a single disk write.
 */
function scheduledWrite() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      db.write();
    } catch (error) {
      console.error('❌ Database write error:', error.message);
    }
  }, WRITE_DEBOUNCE_MS);
}

/**
 * Force an immediate write (for critical operations like shutdown).
 */
function flushWrite() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  try {
    db.write();
  } catch (error) {
    console.error('❌ Database flush write error:', error.message);
  }
}

// ─────────────────────────────────────────
// 👋 Welcome/Goodbye Message System
// ─────────────────────────────────────────

/**
 * Set welcome message for a group
 * @param {string} chatId - Group chat ID
 * @param {string} message - Welcome message
 */
function setWelcomeMessage(chatId, message) {
  try {
    if (!db.data.welcomeMessages) {
      db.data.welcomeMessages = {};
    }
    db.data.welcomeMessages[chatId] = {
      message: message.substring(0, 500),
      updatedAt: Date.now(),
    };
    scheduledWrite();
  } catch (error) {
    console.error('❌ setWelcomeMessage error:', error.message);
  }
}

/**
 * Get welcome message for a group
 * @param {string} chatId - Group chat ID
 * @returns {string|null}
 */
function getWelcomeMessage(chatId) {
  try {
    if (!db.data.welcomeMessages) return null;
    return db.data.welcomeMessages[chatId]?.message || null;
  } catch (error) {
    console.error('❌ getWelcomeMessage error:', error.message);
    return null;
  }
}

/**
 * Set goodbye message for a group
 * @param {string} chatId - Group chat ID
 * @param {string} message - Goodbye message
 */
function setGoodbyeMessage(chatId, message) {
  try {
    if (!db.data.goodbyeMessages) {
      db.data.goodbyeMessages = {};
    }
    db.data.goodbyeMessages[chatId] = {
      message: message.substring(0, 500),
      updatedAt: Date.now(),
    };
    scheduledWrite();
  } catch (error) {
    console.error('❌ setGoodbyeMessage error:', error.message);
  }
}

/**
 * Get goodbye message for a group
 * @param {string} chatId - Group chat ID
 * @returns {string|null}
 */
function getGoodbyeMessage(chatId) {
  try {
    if (!db.data.goodbyeMessages) return null;
    return db.data.goodbyeMessages[chatId]?.message || null;
  } catch (error) {
    console.error('❌ getGoodbyeMessage error:', error.message);
    return null;
  }
}

/**
 * Check if welcome is enabled for a group
 * @param {string} chatId - Group chat ID
 * @returns {boolean}
 */
function isWelcomeEnabled(chatId) {
  try {
    if (!db.data.welcomeEnabled) return false;
    return db.data.welcomeEnabled[chatId] || false;
  } catch (error) {
    return false;
  }
}

/**
 * Set welcome enabled status for a group
 * @param {string} chatId - Group chat ID
 * @param {boolean} enabled
 */
function setWelcomeEnabled(chatId, enabled) {
  try {
    if (!db.data.welcomeEnabled) {
      db.data.welcomeEnabled = {};
    }
    db.data.welcomeEnabled[chatId] = enabled;
    scheduledWrite();
  } catch (error) {
    console.error('❌ setWelcomeEnabled error:', error.message);
  }
}

/**
 * Check if goodbye is enabled for a group
 * @param {string} chatId - Group chat ID
 * @returns {boolean}
 */
function isGoodbyeEnabled(chatId) {
  try {
    if (!db.data.goodbyeEnabled) return false;
    return db.data.goodbyeEnabled[chatId] || false;
  } catch (error) {
    return false;
  }
}

/**
 * Set goodbye enabled status for a group
 * @param {string} chatId - Group chat ID
 * @param {boolean} enabled
 */
function setGoodbyeEnabled(chatId, enabled) {
  try {
    if (!db.data.goodbyeEnabled) {
      db.data.goodbyeEnabled = {};
    }
    db.data.goodbyeEnabled[chatId] = enabled;
    scheduledWrite();
  } catch (error) {
    console.error('❌ setGoodbyeEnabled error:', error.message);
  }
}

// ─────────────────────────────────────────
// 💾 Database Backup System v3.0
// ─────────────────────────────────────────
const { readdirSync, renameSync, unlinkSync, readFileSync, writeFileSync } = require('fs');

const BACKUP_DIR = join(DATA_DIR, 'backups');
const MAX_BACKUPS = 5;
let lastBackupTime = 0;
const BACKUP_DEBOUNCE_MS = 60000; // 1 minute between automatic backups

// Ensure backup directory exists
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  console.log('📂 Created backup directory');
}

/**
 * Create a database backup
 * @param {boolean} isManual - Whether this is a manual backup
 * @returns {string|null} - Backup filename or null if skipped
 */
function createBackup(isManual = false) {
  const now = Date.now();
  
  // Debounce automatic backups (only one per minute)
  if (!isManual && (now - lastBackupTime) < BACKUP_DEBOUNCE_MS) {
    return null;
  }
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFilename = `datastore_backup_${timestamp}.json`;
    const backupPath = join(BACKUP_DIR, backupFilename);
    
    // Read current database data
    const dbPath = join(DATA_DIR, 'db.json');
    const data = readFileSync(dbPath, 'utf8');
    
    // Write backup
    writeFileSync(backupPath, data, 'utf8');
    lastBackupTime = now;
    
    console.log(`💾 Database backup created: ${backupFilename}`);
    
    // Clean old backups (keep only last MAX_BACKUPS)
    cleanupOldBackups();
    
    return backupFilename;
  } catch (error) {
    console.error('❌ Backup creation failed:', error.message);
    return null;
  }
}

/**
 * Clean up old backups, keeping only the most recent ones
 */
function cleanupOldBackups() {
  try {
    const files = readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('datastore_backup_') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    // Delete old backups beyond MAX_BACKUPS
    if (files.length > MAX_BACKUPS) {
      for (let i = MAX_BACKUPS; i < files.length; i++) {
        const filePath = join(BACKUP_DIR, files[i]);
        unlinkSync(filePath);
        console.log(`🗑️ Deleted old backup: ${files[i]}`);
      }
    }
  } catch (error) {
    console.error('❌ Backup cleanup error:', error.message);
  }
}

/**
 * List all available backups
 * @returns {Array} - Array of backup info objects
 */
function listBackups() {
  try {
    const files = readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('datastore_backup_') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    return files.map(filename => {
      const match = filename.match(/datastore_backup_(.+)\.json/);
      return {
        filename,
        timestamp: match ? match[1].replace(/-/g, ':').slice(0, 19) : 'Unknown'
      };
    });
  } catch (error) {
    console.error('❌ listBackups error:', error.message);
    return [];
  }
}

/**
 * Restore database from a backup file
 * @param {string} backupFilename - Name of the backup file
 * @returns {boolean} - Success status
 */
function restoreBackup(backupFilename) {
  try {
    const backupPath = join(BACKUP_DIR, backupFilename);
    
    if (!existsSync(backupPath)) {
      console.error(`❌ Backup file not found: ${backupFilename}`);
      return false;
    }
    
    // Read backup data
    const backupData = readFileSync(backupPath, 'utf8');
    
    // Validate JSON
    JSON.parse(backupData);
    
    // Create current db backup before restoring
    createBackup(true);
    
    // Write backup data to current db
    const dbPath = join(DATA_DIR, 'db.json');
    writeFileSync(dbPath, backupData, 'utf8');
    
    // Reload database
    db.read();
    
    console.log(`♻️ Database restored from: ${backupFilename}`);
    return true;
  } catch (error) {
    console.error('❌ Restore failed:', error.message);
    return false;
  }
}

// Modify scheduledWrite to create backup before writing (debounced)
const originalScheduledWrite = scheduledWrite;
scheduledWrite = function() {
  // Create backup if it's been a while
  if (Date.now() - lastBackupTime > BACKUP_DEBOUNCE_MS) {
    createBackup(false);
  }
  originalScheduledWrite();
};

// ============================================
// 🛠️ Database Helper Functions
// ============================================

/**
 * Get today's date string in YYYY-MM-DD format (IST).
 * @returns {string}
 */
function getTodayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Get a user record by their WhatsApp ID.
 * @param {string} userId — WhatsApp user ID (e.g., "919876543210@c.us")
 * @returns {object|null} — User object or null if not found
 */
function getUser(userId) {
  try {
    return db.data.users[userId] || null;
  } catch (error) {
    console.error('❌ getUser error:', error.message);
    return null;
  }
}

/**
 * Create or update a user record.
 * @param {string} userId — WhatsApp user ID
 * @param {object} data — Fields to set/update
 */
function setUser(userId, data) {
  try {
    if (!db.data.users[userId]) {
      // 🆕 First-time user
      db.data.users[userId] = {
        name: data.name || 'Unknown',
        firstSeen: Date.now(),
        messageCount: 0,
        lastMessage: null,
        conversationHistory: [],
        preferences: {},
        notes: [],
        reminders: [],
        commandsUsed: {},
      };
    }
    // Merge provided data (but don't overwrite arrays/objects with undefined)
    const { conversationHistory, preferences, notes, reminders, commandsUsed, ...safeData } = data;
    Object.assign(db.data.users[userId], safeData);
    scheduledWrite();
  } catch (error) {
    console.error('❌ setUser error:', error.message);
  }
}

/**
 * Increment a user's message count and update last message time.
 * @param {string} userId — WhatsApp user ID
 * @param {string} name — User's display name
 * @returns {boolean} — true if this is a first-time user
 */
function trackUserMessage(userId, name) {
  try {
    const isFirstTime = !db.data.users[userId];
    if (isFirstTime) {
      setUser(userId, { name });
    }
    db.data.users[userId].messageCount += 1;
    db.data.users[userId].lastMessage = Date.now();
    if (db.data.users[userId].name === 'Unknown' && name && name !== 'User') {
      db.data.users[userId].name = name;
    }
    scheduledWrite();
    return isFirstTime;
  } catch (error) {
    console.error('❌ trackUserMessage error:', error.message);
    return false;
  }
}

/**
 * Add a message to a user's conversation history (for AI context).
 * Keeps last 10 exchanges (20 messages max: 10 user + 10 bot).
 * @param {string} userId — WhatsApp user ID
 * @param {string} role — "user" or "assistant"
 * @param {string} content — Message content
 */
function addToConversation(userId, role, content) {
  try {
    if (!db.data.users[userId]) return;
    if (!db.data.users[userId].conversationHistory) {
      db.data.users[userId].conversationHistory = [];
    }
    db.data.users[userId].conversationHistory.push({
      role,
      content: content.substring(0, 300), // Cap per-message size
      timestamp: Date.now(),
    });
    // Keep last 50 messages (25 exchanges) - UPGRADED v3.0
    if (db.data.users[userId].conversationHistory.length > 50) {
      db.data.users[userId].conversationHistory =
        db.data.users[userId].conversationHistory.slice(-50);
    }
    scheduledWrite();
  } catch (error) {
    console.error('❌ addToConversation error:', error.message);
  }
}

/**
 * Get a user's conversation history for AI context.
 * @param {string} userId — WhatsApp user ID
 * @returns {Array<{role: string, content: string}>}
 */
function getConversation(userId) {
  try {
    return db.data.users[userId]?.conversationHistory || [];
  } catch (error) {
    console.error('❌ getConversation error:', error.message);
    return [];
  }
}

/**
 * Get conversation statistics for a user
 * @param {string} userId — WhatsApp user ID
 * @returns {object} — Conversation stats
 */
function getConversationStats(userId) {
  try {
    const history = db.data.users[userId]?.conversationHistory || [];
    const userMessages = history.filter(m => m.role === 'user').length;
    const botMessages = history.filter(m => m.role === 'assistant').length;
    
    return {
      totalMessages: history.length,
      userMessages,
      botMessages,
      maxMessages: 50,
      usagePercent: Math.round((history.length / 50) * 100),
    };
  } catch (error) {
    console.error('❌ getConversationStats error:', error.message);
    return { totalMessages: 0, userMessages: 0, botMessages: 0, maxMessages: 50, usagePercent: 0 };
  }
}

/**
 * Clear a user's conversation history.
 * @param {string} userId — WhatsApp user ID
 */
function clearConversation(userId) {
  try {
    if (db.data.users[userId] && db.data.users[userId].conversationHistory) {
      db.data.users[userId].conversationHistory = [];
      scheduledWrite();
    }
  } catch (error) {
    console.error('❌ clearConversation error:', error.message);
  }
}

// ─────────────────────────────────────────
// 🎭 User Preferences
// ─────────────────────────────────────────

/**
 * Set a user preference.
 * @param {string} userId — WhatsApp user ID
 * @param {string} key — Preference key (e.g., "personality")
 * @param {any} value — Preference value
 */
function setUserPreference(userId, key, value) {
  try {
    if (!db.data.users[userId]) {
      setUser(userId, { name: 'Unknown' });
    }
    if (!db.data.users[userId].preferences) {
      db.data.users[userId].preferences = {};
    }
    db.data.users[userId].preferences[key] = value;
    scheduledWrite();
  } catch (error) {
    console.error('❌ setUserPreference error:', error.message);
  }
}

/**
 * Get a user preference.
 * @param {string} userId — WhatsApp user ID
 * @param {string} key — Preference key
 * @returns {any|null} — Preference value or null
 */
function getUserPreference(userId, key) {
  try {
    return db.data.users[userId]?.preferences?.[key] || null;
  } catch (error) {
    console.error('❌ getUserPreference error:', error.message);
    return null;
  }
}

// ─────────────────────────────────────────
// 📝 Notes System
// ─────────────────────────────────────────

/**
 * Add a note for a user.
 * @param {string} userId — WhatsApp user ID
 * @param {string} content — Note content
 * @returns {string} — Note ID
 */
function addNote(userId, content) {
  try {
    if (!db.data.users[userId]) {
      setUser(userId, { name: 'Unknown' });
    }
    if (!db.data.users[userId].notes) {
      db.data.users[userId].notes = [];
    }
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    db.data.users[userId].notes.push({
      id: noteId,
      content: content.substring(0, 500), // Cap note size
      timestamp: Date.now(),
    });
    // Keep only last 50 notes per user
    if (db.data.users[userId].notes.length > 50) {
      db.data.users[userId].notes = db.data.users[userId].notes.slice(-50);
    }
    scheduledWrite();
    return noteId;
  } catch (error) {
    console.error('❌ addNote error:', error.message);
    return null;
  }
}

/**
 * Get all notes for a user.
 * @param {string} userId — WhatsApp user ID
 * @returns {Array}
 */
function getNotes(userId) {
  try {
    return db.data.users[userId]?.notes || [];
  } catch (error) {
    console.error('❌ getNotes error:', error.message);
    return [];
  }
}

/**
 * Delete a specific note.
 * @param {string} userId — WhatsApp user ID
 * @param {string} noteId — Note ID to delete
 * @returns {boolean}
 */
function deleteNote(userId, noteId) {
  try {
    if (!db.data.users[userId]?.notes) return false;
    const initialLength = db.data.users[userId].notes.length;
    db.data.users[userId].notes = db.data.users[userId].notes.filter(n => n.id !== noteId);
    if (db.data.users[userId].notes.length < initialLength) {
      scheduledWrite();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ deleteNote error:', error.message);
    return false;
  }
}

// ─────────────────────────────────────────
// ✅ Task Management System
// ─────────────────────────────────────────

/**
 * Add a task for a user.
 * @param {string} userId — WhatsApp user ID
 * @param {string} content — Task content
 * @returns {string} — Task ID
 */
function addTask(userId, content) {
  try {
    if (!db.data.users[userId]) {
      setUser(userId, { name: 'Unknown' });
    }
    if (!db.data.users[userId].tasks) {
      db.data.users[userId].tasks = [];
    }
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    db.data.users[userId].tasks.push({
      id: taskId,
      content: content.substring(0, 200),
      completed: false,
      createdAt: Date.now(),
      completedAt: null,
    });
    // Keep only last 100 tasks per user
    if (db.data.users[userId].tasks.length > 100) {
      db.data.users[userId].tasks = db.data.users[userId].tasks.slice(-100);
    }
    scheduledWrite();
    return taskId;
  } catch (error) {
    console.error('❌ addTask error:', error.message);
    return null;
  }
}

/**
 * Get all tasks for a user.
 * @param {string} userId — WhatsApp user ID
 * @param {boolean} includeCompleted — Whether to include completed tasks
 * @returns {Array}
 */
function getTasks(userId, includeCompleted = false) {
  try {
    const tasks = db.data.users[userId]?.tasks || [];
    if (includeCompleted) return tasks;
    return tasks.filter(t => !t.completed);
  } catch (error) {
    console.error('❌ getTasks error:', error.message);
    return [];
  }
}

/**
 * Mark a task as completed.
 * @param {string} userId — WhatsApp user ID
 * @param {number} taskIndex — Task index (1-based)
 * @returns {boolean}
 */
function completeTask(userId, taskIndex) {
  try {
    const tasks = getTasks(userId, true);
    if (taskIndex < 1 || taskIndex > tasks.length) return false;
    const task = tasks[taskIndex - 1];
    if (task.completed) return false;
    task.completed = true;
    task.completedAt = Date.now();
    scheduledWrite();
    return true;
  } catch (error) {
    console.error('❌ completeTask error:', error.message);
    return false;
  }
}

/**
 * Delete a task.
 * @param {string} userId — WhatsApp user ID
 * @param {number} taskIndex — Task index (1-based)
 * @returns {boolean}
 */
function deleteTask(userId, taskIndex) {
  try {
    const tasks = getTasks(userId, true);
    if (taskIndex < 1 || taskIndex > tasks.length) return false;
    tasks.splice(taskIndex - 1, 1);
    scheduledWrite();
    return true;
  } catch (error) {
    console.error('❌ deleteTask error:', error.message);
    return false;
  }
}

// ─────────────────────────────────────────
// ⏰ Reminders System
// ─────────────────────────────────────────

/**
 * Add a reminder.
 * @param {string} userId — WhatsApp user ID
 * @param {string} chatId — Chat ID where reminder was set
 * @param {string} message — Reminder message
 * @param {number} triggerTime — Timestamp when to trigger
 * @param {boolean} isGroup — Whether this is a group chat
 * @returns {string} — Reminder ID
 */
function addReminder(userId, chatId, message, triggerTime, isGroup = false) {
  try {
    const reminderId = `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const reminder = {
      id: reminderId,
      userId,
      chatId,
      message: message.substring(0, 200),
      triggerTime,
      isGroup,
      createdAt: Date.now(),
      completed: false,
    };
    
    db.data.scheduledReminders.push(reminder);
    
    // Keep only last 100 reminders in database
    if (db.data.scheduledReminders.length > 100) {
      // Remove completed old reminders first
      const completed = db.data.scheduledReminders.filter(r => r.completed);
      const pending = db.data.scheduledReminders.filter(r => !r.completed);
      if (completed.length > 50) {
        db.data.scheduledReminders = [...pending, ...completed.slice(-50)];
      }
    }
    
    scheduledWrite();
    return reminderId;
  } catch (error) {
    console.error('❌ addReminder error:', error.message);
    return null;
  }
}

/**
 * Get all reminders for a user.
 * @param {string} userId — WhatsApp user ID
 * @returns {Array}
 */
function getReminders(userId) {
  try {
    return db.data.scheduledReminders.filter(r => r.userId === userId);
  } catch (error) {
    console.error('❌ getReminders error:', error.message);
    return [];
  }
}

/**
 * Get pending reminders that should be triggered now.
 * @returns {Array}
 */
function getPendingReminders() {
  try {
    const now = Date.now();
    return db.data.scheduledReminders.filter(r => !r.completed && r.triggerTime <= now);
  } catch (error) {
    console.error('❌ getPendingReminders error:', error.message);
    return [];
  }
}

/**
 * Mark a reminder as completed.
 * @param {string} reminderId — Reminder ID
 * @returns {boolean}
 */
function completeReminder(reminderId) {
  try {
    const reminder = db.data.scheduledReminders.find(r => r.id === reminderId);
    if (reminder) {
      reminder.completed = true;
      scheduledWrite();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ completeReminder error:', error.message);
    return false;
  }
}

/**
 * Delete a reminder.
 * @param {string} reminderId — Reminder ID
 * @returns {boolean}
 */
function deleteReminder(reminderId) {
  try {
    const initialLength = db.data.scheduledReminders.length;
    db.data.scheduledReminders = db.data.scheduledReminders.filter(r => r.id !== reminderId);
    if (db.data.scheduledReminders.length < initialLength) {
      scheduledWrite();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ deleteReminder error:', error.message);
    return false;
  }
}

// ─────────────────────────────────────────
// 🔄 Proxy Chat Session Management
// ─────────────────────────────────────────

/**
 * Create a new proxy session.
 * @param {string} userId — WhatsApp user ID (initiator)
 * @param {string} targetId — Target contact ID
 * @param {string} targetName — Target contact name
 * @returns {string|null} — Session ID or null if error
 */
function createProxySession(userId, targetId, targetName) {
  try {
    // End any existing active session for this user
    endProxySession(userId);
    
    const sessionId = `proxy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      userId,
      targetId,
      targetName: targetName || 'Unknown',
      startTime: Date.now(),
      active: true,
      lastActivity: Date.now(),
    };
    
    db.data.proxySessions.push(session);
    scheduledWrite();
    return sessionId;
  } catch (error) {
    console.error('❌ createProxySession error:', error.message);
    return null;
  }
}

/**
 * Get active proxy session for a user.
 * @param {string} userId — WhatsApp user ID
 * @returns {object|null} — Active session or null
 */
function getProxySession(userId) {
  try {
    return db.data.proxySessions.find(s => s.userId === userId && s.active) || null;
  } catch (error) {
    console.error('❌ getProxySession error:', error.message);
    return null;
  }
}

/**
 * Get active proxy session by target ID (for receiving messages).
 * @param {string} targetId — Target contact ID
 * @returns {object|null} — Active session or null
 */
function getProxySessionByTarget(targetId) {
  try {
    return db.data.proxySessions.find(s => s.targetId === targetId && s.active) || null;
  } catch (error) {
    console.error('❌ getProxySessionByTarget error:', error.message);
    return null;
  }
}

/**
 * End a proxy session.
 * @param {string} userId — WhatsApp user ID
 * @returns {boolean}
 */
function endProxySession(userId) {
  try {
    const session = db.data.proxySessions.find(s => s.userId === userId && s.active);
    if (session) {
      session.active = false;
      session.endTime = Date.now();
      scheduledWrite();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ endProxySession error:', error.message);
    return false;
  }
}

/**
 * Update last activity time for a proxy session.
 * @param {string} sessionId — Session ID
 */
function updateProxyActivity(sessionId) {
  try {
    const session = db.data.proxySessions.find(s => s.id === sessionId);
    if (session) {
      session.lastActivity = Date.now();
      scheduledWrite();
    }
  } catch (error) {
    console.error('❌ updateProxyActivity error:', error.message);
  }
}

/**
 * Get all active proxy sessions.
 * @returns {Array}
 */
function getActiveProxySessions() {
  try {
    return db.data.proxySessions.filter(s => s.active);
  } catch (error) {
    console.error('❌ getActiveProxySessions error:', error.message);
    return [];
  }
}

/**
 * Clean up stale proxy sessions (older than 24 hours).
 * Call this on bot startup.
 */
function cleanupStaleProxySessions() {
  try {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    let cleaned = 0;
    db.data.proxySessions.forEach(session => {
      if (session.active && session.lastActivity < cutoff) {
        session.active = false;
        cleaned++;
      }
    });
    if (cleaned > 0) {
      scheduledWrite();
      console.log(`🧹 Cleaned up ${cleaned} stale proxy session(s)`);
    }
  } catch (error) {
    console.error('❌ cleanupStaleProxySessions error:', error.message);
  }
}

// ─────────────────────────────────────────
// 🤖 Chatbot Session Management
// ─────────────────────────────────────────

/**
 * Start a chatbot session for a user.
 * @param {string} userId — WhatsApp user ID
 */
function startChatbotSession(userId) {
  try {
    if (!db.data.chatbotSessions) {
      db.data.chatbotSessions = {};
    }
    db.data.chatbotSessions[userId] = {
      active: true,
      startTime: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
    };
    scheduledWrite();
    console.log(`🤖 Chatbot session started for ${userId}`);
  } catch (error) {
    console.error('❌ startChatbotSession error:', error.message);
  }
}

/**
 * Check if user has an active chatbot session.
 * @param {string} userId — WhatsApp user ID
 * @returns {boolean}
 */
function isChatbotSessionActive(userId) {
  try {
    if (!db.data.chatbotSessions) return false;
    const session = db.data.chatbotSessions[userId];
    if (!session || !session.active) return false;
    
    // Auto-expire after 30 minutes of inactivity
    const cutoff = Date.now() - (30 * 60 * 1000);
    if (session.lastActivity < cutoff) {
      session.active = false;
      scheduledWrite();
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ isChatbotSessionActive error:', error.message);
    return false;
  }
}

/**
 * Update chatbot session activity.
 * @param {string} userId — WhatsApp user ID
 */
function updateChatbotActivity(userId) {
  try {
    if (!db.data.chatbotSessions) return;
    const session = db.data.chatbotSessions[userId];
    if (session && session.active) {
      session.lastActivity = Date.now();
      session.messageCount = (session.messageCount || 0) + 1;
      scheduledWrite();
    }
  } catch (error) {
    console.error('❌ updateChatbotActivity error:', error.message);
  }
}

/**
 * End a chatbot session.
 * @param {string} userId — WhatsApp user ID
 */
function endChatbotSession(userId) {
  try {
    if (!db.data.chatbotSessions) return;
    const session = db.data.chatbotSessions[userId];
    if (session) {
      session.active = false;
      scheduledWrite();
      console.log(`🛑 Chatbot session ended for ${userId}`);
    }
  } catch (error) {
    console.error('❌ endChatbotSession error:', error.message);
  }
}

/**
 * Check if message is an exit command to end chatbot session.
 * @param {string} message — User message
 * @returns {boolean}
 */
function isChatbotExitMessage(message) {
  if (!message) return false;
  const exitWords = ['end', 'goodbye', 'bye', 'thanks', 'thank you', 'thankyou', 'exit', 'stop', 'quit', 'done', 'close', 'finished'];
  const lowerMessage = message.toLowerCase().trim();
  return exitWords.some(word => lowerMessage === word || lowerMessage.startsWith(word + ' ') || lowerMessage.endsWith(' ' + word));
}

// ─────────────────────────────────────────
//  Command Usage Tracking
// ─────────────────────────────────────────

/**
 * Track command usage.
 * @param {string} command — Command name
 * @param {string} userId — WhatsApp user ID
 */
function trackCommand(command, userId) {
  try {
    // Global command stats
    if (!db.data.stats.commandsUsed) {
      db.data.stats.commandsUsed = {};
    }
    db.data.stats.commandsUsed[command] = (db.data.stats.commandsUsed[command] || 0) + 1;
    
    // Per-user command stats
    if (!db.data.users[userId]) {
      setUser(userId, { name: 'Unknown' });
    }
    if (!db.data.users[userId].commandsUsed) {
      db.data.users[userId].commandsUsed = {};
    }
    db.data.users[userId].commandsUsed[command] = (db.data.users[userId].commandsUsed[command] || 0) + 1;
    
    scheduledWrite();
  } catch (error) {
    console.error('❌ trackCommand error:', error.message);
  }
}

/**
 * Get user statistics.
 * @returns {object}
 */
function getUserStats() {
  try {
    const users = Object.keys(db.data.users);
    let totalCommands = 0;
    const commandCounts = {};
    
    users.forEach(userId => {
      const user = db.data.users[userId];
      if (user.commandsUsed) {
        Object.entries(user.commandsUsed).forEach(([cmd, count]) => {
          commandCounts[cmd] = (commandCounts[cmd] || 0) + count;
          totalCommands += count;
        });
      }
    });
    
    return {
      totalUsers: users.length,
      totalCommands,
      commandCounts,
      mostActiveUsers: users
        .map(id => ({ id, ...db.data.users[id] }))
        .sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))
        .slice(0, 5),
    };
  } catch (error) {
    console.error('❌ getUserStats error:', error.message);
    return { totalUsers: 0, totalCommands: 0, commandCounts: {}, mostActiveUsers: [] };
  }
}

// ─────────────────────────────────────────
// 🗳️ Poll System
// ─────────────────────────────────────────

/**
 * Create a new poll in a group.
 * @param {string} chatId — Group chat ID
 * @param {string} question — Poll question
 * @param {string[]} options — Array of option strings
 * @param {string} createdBy — User ID who created the poll
 * @returns {string|null} — Poll ID or null
 */
function createPoll(chatId, question, options, createdBy) {
  try {
    const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const poll = {
      id: pollId,
      chatId,
      question: question.substring(0, 200),
      options: options.slice(0, 10).map(opt => ({
        text: opt.substring(0, 100),
        voters: [],
      })),
      createdBy,
      createdAt: Date.now(),
      active: true,
    };
    db.data.polls.push(poll);
    // Keep only last 50 polls
    if (db.data.polls.length > 50) {
      db.data.polls = db.data.polls.slice(-50);
    }
    scheduledWrite();
    return pollId;
  } catch (error) {
    console.error('❌ createPoll error:', error.message);
    return null;
  }
}

/**
 * Get active poll for a chat.
 * @param {string} chatId — Chat ID
 * @returns {object|null}
 */
function getActivePoll(chatId) {
  try {
    return db.data.polls.find(p => p.chatId === chatId && p.active) || null;
  } catch (error) {
    console.error('❌ getActivePoll error:', error.message);
    return null;
  }
}

/**
 * Vote in a poll.
 * @param {string} pollId — Poll ID
 * @param {number} optionIndex — Option index (0-based)
 * @param {string} voterId — User ID voting
 * @returns {boolean}
 */
function votePoll(pollId, optionIndex, voterId) {
  try {
    const poll = db.data.polls.find(p => p.id === pollId && p.active);
    if (!poll) return false;
    if (optionIndex < 0 || optionIndex >= poll.options.length) return false;
    
    // Remove previous vote from this user
    poll.options.forEach(opt => {
      opt.voters = opt.voters.filter(v => v !== voterId);
    });
    
    // Add new vote
    poll.options[optionIndex].voters.push(voterId);
    scheduledWrite();
    return true;
  } catch (error) {
    console.error('❌ votePoll error:', error.message);
    return false;
  }
}

/**
 * End a poll.
 * @param {string} pollId — Poll ID
 * @returns {boolean}
 */
function endPoll(pollId) {
  try {
    const poll = db.data.polls.find(p => p.id === pollId);
    if (!poll) return false;
    poll.active = false;
    poll.endedAt = Date.now();
    scheduledWrite();
    return true;
  } catch (error) {
    console.error('❌ endPoll error:', error.message);
    return false;
  }
}

/**
 * Get poll results.
 * @param {string} pollId — Poll ID
 * @returns {object|null}
 */
function getPollResults(pollId) {
  try {
    const poll = db.data.polls.find(p => p.id === pollId);
    if (!poll) return null;
    return {
      ...poll,
      totalVotes: poll.options.reduce((sum, opt) => sum + opt.voters.length, 0),
    };
  } catch (error) {
    console.error('❌ getPollResults error:', error.message);
    return null;
  }
}

// ─────────────────────────────────────────
// 🔇 Group Management
// ─────────────────────────────────────────

/**
 * Check if a group is muted.
 * @param {string} groupId — Group chat ID
 * @returns {boolean}
 */
function isMuted(groupId) {
  try {
    return db.data.mutedGroups.includes(groupId);
  } catch (error) {
    console.error('❌ isMuted error:', error.message);
    return false;
  }
}

/**
 * Mute a group — bot stops replying there.
 * @param {string} groupId — Group chat ID
 * @returns {boolean} — true if newly muted, false if already muted
 */
function muteGroup(groupId) {
  try {
    if (db.data.mutedGroups.includes(groupId)) return false;
    db.data.mutedGroups.push(groupId);
    scheduledWrite();
    return true;
  } catch (error) {
    console.error('❌ muteGroup error:', error.message);
    return false;
  }
}

/**
 * Unmute a group — bot resumes replying.
 * @param {string} groupId — Group chat ID
 * @returns {boolean} — true if unmuted, false if wasn't muted
 */
function unmuteGroup(groupId) {
  try {
    const index = db.data.mutedGroups.indexOf(groupId);
    if (index === -1) return false;
    db.data.mutedGroups.splice(index, 1);
    scheduledWrite();
    return true;
  } catch (error) {
    console.error('❌ unmuteGroup error:', error.message);
    return false;
  }
}

/**
 * Log a message to the recent log (keeps last 200 entries).
 * @param {object} entry — { from, body, timestamp, type }
 */
function logMessage(entry) {
  try {
    db.data.messageLog.push({
      from: entry.from || 'unknown',
      body: (entry.body || '').substring(0, 100), // Truncate for storage
      timestamp: entry.timestamp || Date.now(),
      type: entry.type || 'incoming',
    });
    // 🧹 Keep only last 200 log entries to save memory
    if (db.data.messageLog.length > 200) {
      db.data.messageLog = db.data.messageLog.slice(-200);
    }
    scheduledWrite();
  } catch (error) {
    console.error('❌ logMessage error:', error.message);
  }
}

/**
 * Increment the global messages-handled counter + daily count.
 */
function incrementMessageCount() {
  try {
    db.data.stats.messagesHandled += 1;
    // Track daily count
    const today = getTodayKey();
    db.data.stats.dailyCounts[today] = (db.data.stats.dailyCounts[today] || 0) + 1;

    // 🧹 Clean old daily counts (keep last 30 days)
    const keys = Object.keys(db.data.stats.dailyCounts).sort();
    if (keys.length > 30) {
      for (const key of keys.slice(0, keys.length - 30)) {
        delete db.data.stats.dailyCounts[key];
      }
    }
    scheduledWrite();
  } catch (error) {
    console.error('❌ incrementMessageCount error:', error.message);
  }
}

/**
 * Get bot statistics.
 * @returns {object} — { messagesHandled, messagesToday, startTime, uptimeMs, userCount, groupsMuted }
 */
function getStats() {
  try {
    const today = getTodayKey();
    return {
      messagesHandled: db.data.stats.messagesHandled,
      messagesToday: db.data.stats.dailyCounts[today] || 0,
      startTime: db.data.stats.startTime,
      uptimeMs: Date.now() - db.data.stats.startTime,
      userCount: Object.keys(db.data.users).length,
      groupsMuted: db.data.mutedGroups.length,
    };
  } catch (error) {
    console.error('❌ getStats error:', error.message);
    return { messagesHandled: 0, messagesToday: 0, startTime: 0, uptimeMs: 0, userCount: 0, groupsMuted: 0 };
  }
}

/**
 * Record a broadcast event.
 * @param {string} message — The broadcast message
 * @param {number} groupCount — Number of groups it was sent to
 */
function addBroadcast(message, groupCount) {
  try {
    db.data.broadcasts.push({
      message: message.substring(0, 200),
      timestamp: Date.now(),
      groupCount,
    });
    // Keep last 50 broadcasts
    if (db.data.broadcasts.length > 50) {
      db.data.broadcasts = db.data.broadcasts.slice(-50);
    }
    scheduledWrite();
  } catch (error) {
    console.error('❌ addBroadcast error:', error.message);
  }
}

/**
 * Get the recent message log.
 * @param {number} count — Number of entries to return (default 50)
 * @returns {Array}
 */
function getRecentLogs(count = 50) {
  try {
    return db.data.messageLog.slice(-count);
  } catch (error) {
    console.error('❌ getRecentLogs error:', error.message);
    return [];
  }
}

/**
 * Get list of muted groups.
 * @returns {string[]}
 */
function getMutedGroups() {
  try {
    return db.data.mutedGroups;
  } catch (error) {
    console.error('❌ getMutedGroups error:', error.message);
    return [];
  }
}

// ─────────────────────────────────────────
// 🤖 Auto-Reply Mode Tracking
// ─────────────────────────────────────────

const REPLY_INACTIVITY_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Set auto-reply mode for a chat.
 * @param {string} chatId — Chat ID
 * @param {object} settings — { enabled: boolean, groupMentions: boolean, lastAdminReply: number }
 */
function setReplyMode(chatId, settings) {
  try {
    if (!db.data.replyModes) {
      db.data.replyModes = {};
    }
    
    db.data.replyModes[chatId] = {
      ...db.data.replyModes[chatId],
      ...settings,
      updatedAt: Date.now(),
    };
    scheduledWrite();
    return true;
  } catch (error) {
    console.error('❌ setReplyMode error:', error.message);
    return false;
  }
}

/**
 * Get auto-reply mode for a chat.
 * @param {string} chatId — Chat ID
 * @returns {object} — Reply mode settings
 */
function getReplyMode(chatId) {
  try {
    if (!db.data.replyModes) {
      db.data.replyModes = {};
    }
    return db.data.replyModes[chatId] || { enabled: false, groupMentions: false, lastAdminReply: null };
  } catch (error) {
    console.error('❌ getReplyMode error:', error.message);
    return { enabled: false, groupMentions: false, lastAdminReply: null };
  }
}

/**
 * Update admin's last reply timestamp for a chat.
 * @param {string} chatId — Chat ID
 */
function updateAdminLastReply(chatId) {
  try {
    setReplyMode(chatId, { lastAdminReply: Date.now() });
  } catch (error) {
    console.error('❌ updateAdminLastReply error:', error.message);
  }
}

/**
 * Check if auto-reply should trigger (admin inactive for 2+ hours).
 * @param {string} chatId — Chat ID
 * @returns {boolean}
 */
function shouldAutoReply(chatId) {
  try {
    const mode = getReplyMode(chatId);
    if (!mode.enabled) return false;
    
    // If never replied, allow auto-reply immediately
    if (!mode.lastAdminReply) return true;
    
    const inactiveTime = Date.now() - mode.lastAdminReply;
    return inactiveTime >= REPLY_INACTIVITY_MS;
  } catch (error) {
    console.error('❌ shouldAutoReply error:', error.message);
    return false;
  }
}

/**
 * Check if group mention auto-reply is enabled.
 * @param {string} chatId — Chat ID
 * @returns {boolean}
 */
function isGroupMentionReplyEnabled(chatId) {
  try {
    const mode = getReplyMode(chatId);
    return mode.enabled && mode.groupMentions;
  } catch (error) {
    console.error('❌ isGroupMentionReplyEnabled error:', error.message);
    return false;
  }
}

// ============================================
// 📤 Module Exports
// ============================================

module.exports = {
  db,
  getUser,
  setUser,
  trackUserMessage,
  addToConversation,
  getConversation,
  getConversationStats,
  clearConversation,
  setUserPreference,
  getUserPreference,
  addNote,
  getNotes,
  deleteNote,
  // ✅ Task Exports
  addTask,
  getTasks,
  completeTask,
  deleteTask,
  addReminder,
  getReminders,
  getPendingReminders,
  completeReminder,
  deleteReminder,
  trackCommand,
  getUserStats,
  isMuted,
  muteGroup,
  unmuteGroup,
  logMessage,
  incrementMessageCount,
  getStats,
  addBroadcast,
  getRecentLogs,
  getMutedGroups,
  flushWrite,
  scheduledWrite,
  // 🔄 Proxy Session Exports
  createProxySession,
  getProxySession,
  getProxySessionByTarget,
  endProxySession,
  updateProxyActivity,
  getActiveProxySessions,
  cleanupStaleProxySessions,
  // 🗳️ Poll Exports
  createPoll,
  getActivePoll,
  votePoll,
  endPoll,
  getPollResults,
  // 🤖 Auto-Reply Exports
  setReplyMode,
  getReplyMode,
  updateAdminLastReply,
  shouldAutoReply,
  isGroupMentionReplyEnabled,
  // 💬 Chatbot Session Exports
  startChatbotSession,
  isChatbotSessionActive,
  updateChatbotActivity,
  endChatbotSession,
  isChatbotExitMessage,
  // 💾 Backup System Exports
  createBackup,
  listBackups,
  restoreBackup,
  // 👋 Welcome/Goodbye System Exports
  setWelcomeMessage,
  getWelcomeMessage,
  setGoodbyeMessage,
  getGoodbyeMessage,
  isWelcomeEnabled,
  setWelcomeEnabled,
  isGoodbyeEnabled,
  setGoodbyeEnabled,
};
