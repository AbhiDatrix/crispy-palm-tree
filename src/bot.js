// ==================================================
// 🤖 bot.js — Datrix WhatsApp Bot v3.0
// ==================================================
// Main entry point. Initializes the WhatsApp client,
// routes messages to handlers, manages anti-spam,
// welcomes new members, and starts all subsystems.
//
// UPGRADE v3.0:
// - Command aliases system (!j → !joke, etc.)
// - Interactive menu command (!menu)
// - Database backup system (auto + manual)
// - Rate limiting (10 commands/minute)
// - Welcome/Goodbye messages
// - Enhanced error handling
// - Conversation history limits (50 messages)
//
// UPGRADE v2.2:
// - Added message revoke/delete detection
// - Fixed anti-spam memory leaks
// - Improved error handling and logging
// - Better handling of ephemeral messages
// - Version consistency across all files
//
// UPGRADE v2.0 (Terminal Edition):
// - Removed all UI/dashboard dependencies
// - Pure terminal-based operation with colored logging
// - Uses 'message_create' event instead of 'message' for reliability
// - Robust @mention cleaning (handles name-based mentions too)
// - QR code timeout handling (warns if not scanned in 60s)
// - Welcome system respects muted groups
// - Reconnection with max retry limit
// - Anti-spam map periodic cleanup via setInterval
// - DB flush on shutdown to prevent data loss
// - Loading state tracking to prevent race conditions
// - NEW: Colored terminal output with emojis
// - NEW: Message statistics tracking per user
// - NEW: Better rate limiting with warning messages
// - NEW: Auto-reply for mentions with cooldown
// - NEW: Message type logging
// ============================================
// Optimized for: AMD Athlon Silver, 6GB RAM, AMD Radeon
// ============================================

// 🔐 Load environment variables FIRST
require('dotenv').config();

// 📦 Dependencies
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// 🧩 Internal modules
const { generateReply, generateChatbotReply } = require('./ai');
const { parseCommand, handleCommand } = require('./commands');
const { initScheduler, stopScheduler } = require('./scheduler');
const { logger } = require('./logger');
const { setupGlobalErrorHandlers } = require('./errorHandler');
const {
  trackUserMessage,
  addToConversation,
  isMuted,
  logMessage,
  incrementMessageCount,
  flushWrite,
  getUserPreference,
  // 🔄 Proxy Session Functions
  getProxySession,
  getProxySessionByTarget,
  updateProxyActivity,
  cleanupStaleProxySessions,
  // 🤖 Auto-Reply Functions
  setReplyMode,
  getReplyMode,
  updateAdminLastReply,
  shouldAutoReply,
  isGroupMentionReplyEnabled,
  // 💬 Chatbot Session Functions
  isChatbotSessionActive,
  updateChatbotActivity,
  endChatbotSession,
  isChatbotExitMessage,
  // 👋 Welcome/Goodbye Functions
  getWelcomeMessage,
  isWelcomeEnabled,
  getGoodbyeMessage,
  isGoodbyeEnabled,
} = require('./db');

// 📊 Message Monitoring System
const {
  initMonitor,
  recordMessage,
  recordCall,
  handlers: callHandlers,
} = require('./monitor');

// ============================================
// 🎨 Terminal Colors & Formatting
// ============================================
const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// ============================================
// 🤖 Bot Version
// ============================================
const BOT_VERSION = '3.0.0';

// ============================================
// ⚡ Rate Limiting System v3.0
// ============================================
const rateLimitMap = new Map(); // userId -> [{timestamp}]
const MAX_COMMANDS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

/**
 * Check if user is rate limited
 * @param {string} userId - User ID to check
 * @returns {object|null} - { remaining: number, waitSeconds: number } or null if allowed
 */
function checkRateLimit(userId) {
  const now = Date.now();
  
  // Get or create user's command timestamps
  if (!rateLimitMap.has(userId)) {
    rateLimitMap.set(userId, []);
  }
  
  const timestamps = rateLimitMap.get(userId);
  
  // Filter to only timestamps within the window
  const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  
  if (recentTimestamps.length >= MAX_COMMANDS_PER_MINUTE) {
    const oldestTimestamp = recentTimestamps[0];
    const waitSeconds = Math.ceil((oldestTimestamp + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { remaining: 0, waitSeconds };
  }
  
  // Add current timestamp
  recentTimestamps.push(now);
  rateLimitMap.set(userId, recentTimestamps);
  
  return { remaining: MAX_COMMANDS_PER_MINUTE - recentTimestamps.length, waitSeconds: 0 };
}

/**
 * Clean up old rate limit entries periodically
 */
function cleanupRateLimits() {
  const now = Date.now();
  for (const [userId, timestamps] of rateLimitMap) {
    const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    if (recentTimestamps.length === 0) {
      rateLimitMap.delete(userId);
    } else {
      rateLimitMap.set(userId, recentTimestamps);
    }
  }
}

// Clean up rate limits every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

/**
 * Log a formatted message to terminal.
 * Now uses the new structured logger for both console and file output.
 * @param {string} type — Message type (info, success, warning, error, command, ai)
 * @param {string} message — Message to log
 */
function log(type, message) {
  // Use the new structured logger
  switch (type) {
    case 'info':
      logger.info(message);
      break;
    case 'success':
      logger.success(message);
      break;
    case 'warning':
      logger.warn(message);
      break;
    case 'error':
      logger.error(message);
      break;
    case 'command':
      logger.command(message);
      break;
    case 'ai':
      logger.ai(message);
      break;
    case 'message':
      logger.message(message);
      break;
    case 'group':
      logger.message(message, { category: 'group' });
      break;
    case 'dm':
      logger.message(message, { category: 'dm' });
      break;
    default:
      logger.info(message);
  }
}

/**
 * Print a banner to the terminal.
 */
function printBanner() {
  console.log('');
  console.log(`${Colors.cyan}╔══════════════════════════════════════════════════════╗${Colors.reset}`);
  console.log(`${Colors.cyan}║${Colors.reset}     ${Colors.bright}🤖 Datrix WhatsApp AI Bot v2.2${Colors.reset}                  ${Colors.cyan}║${Colors.reset}`);
  console.log(`${Colors.cyan}║${Colors.reset}     ${Colors.dim}Terminal Edition — Stable Release${Colors.reset}               ${Colors.cyan}║${Colors.reset}`);
  console.log(`${Colors.cyan}║${Colors.reset}     ${Colors.green}Data Intelligence, Simplified.${Colors.reset}                 ${Colors.cyan}║${Colors.reset}`);
  console.log(`${Colors.cyan}╚══════════════════════════════════════════════════════╝${Colors.reset}`);
  console.log('');
}

/**
 * 🧹 Clean up stale WhatsApp Web session files.
 * Prevents "browser is already running" errors.
 */
function cleanupStaleSession() {
  const authPath = path.join(process.cwd(), '.wwebjs_auth');
  const sessionPath = path.join(authPath, 'session');

  // Check if session folder exists
  if (!fs.existsSync(sessionPath)) {
    return;
  }

  try {
    // Remove lock files that prevent new browser instances
    const lockFiles = [
      'SingletonLock',
      'SingletonCookie',
      'SingletonSocket',
    ];

    let cleaned = false;
    for (const lockFile of lockFiles) {
      const lockPath = path.join(sessionPath, lockFile);
      if (fs.existsSync(lockPath)) {
        try {
          fs.unlinkSync(lockPath);
          cleaned = true;
        } catch (err) {
          // Ignore permission errors
        }
      }
    }

    // Clean up old DevToolsActivePort file if exists
    const devToolsPath = path.join(sessionPath, 'DevToolsActivePort');
    if (fs.existsSync(devToolsPath)) {
      try {
        fs.unlinkSync(devToolsPath);
        cleaned = true;
      } catch (err) {
        // Ignore permission errors
      }
    }

    if (cleaned) {
      console.log(`${Colors.yellow}[CLEANUP]${Colors.reset} Removed stale session lock files`);
    }
  } catch (error) {
    // Non-critical error, continue anyway
    console.log(`${Colors.yellow}[CLEANUP]${Colors.reset} Could not clean session files: ${error.message}`);
  }
}

// ============================================
// ⚙️ Configuration
// ============================================

const BOT_NAME = process.env.BOT_NAME || 'Robert';

// 🛡️ Anti-spam: map of userId → { lastReply, warningCount }
const antiSpamMap = new Map();
const ANTI_SPAM_COOLDOWN_MS = 10000; // 10 seconds
const MAX_WARNINGS = 3;

// 📊 Message statistics
const messageStats = {
  commandsHandled: 0,
  aiReplies: 0,
  mentionsReplied: 0,
  dmsHandled: 0,
  groupsHandled: 0,
  startTime: Date.now(),
};

// 🔄 Reconnection tracking
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// 📱 QR timeout tracking
let qrTimerId = null;
let isReady = false;

// ============================================
// 🚀 Initialize WhatsApp Client
// ============================================

printBanner();

// 🧹 Clean up stale session files before starting
cleanupStaleSession();

const client = new Client({
  authStrategy: new LocalAuth(),

  // 🧠 Puppeteer optimization for low-spec hardware
  puppeteer: {
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-update',
      '--disable-domain-reliability',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-notifications',
      '--disable-renderer-backgrounding',
      '--disable-speech-api',
      '--disable-sync',
      '--hide-scrollbars',
      '--ignore-gpu-blacklist',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--no-experiments',
      '--no-pings',
      '--password-store=basic',
      '--use-mock-keychain',
      '--window-size=1280,720',
    ],
  },
  // ⏳ Handling for slow machines
  qrMaxRetries: 5,
  authTimeoutMs: 60000,
  takeoverOnConflict: true,
  takeoverTimeoutMs: 5000,
});

// ⏱️ Initialization timeout - force exit if stuck
const INIT_TIMEOUT = 120000; // 2 minutes
const initTimeoutId = setTimeout(() => {
  console.error('');
  console.error(`${Colors.red}❌ Bot initialization timed out after ${INIT_TIMEOUT/1000} seconds${Colors.reset}`);
  console.error(`${Colors.yellow}💡 This usually means Chrome is stuck or there's a session conflict${Colors.reset}`);
  console.error(`${Colors.yellow}💡 Run this command to fix:${Colors.reset}`);
  console.error(`${Colors.cyan}   .\fix-chrome.ps1${Colors.reset}`);
  console.error(`${Colors.cyan}   npm start${Colors.reset}`);
  console.error('');
  process.exit(1);
}, INIT_TIMEOUT);

// Clear timeout when ready
client.on('ready', () => {
  clearTimeout(initTimeoutId);
});

// ============================================
// 📱 QR Code Event — Scan to authenticate
// ============================================

client.on('qr', (qr) => {
  console.log('📱 Scan the QR code below with WhatsApp:\n');
  qrcodeTerminal.generate(qr, { small: true });
  
  console.log('\n⏳ Waiting for QR scan...\n');

  // ⏱️ Set QR timeout warning (60 seconds)
  if (qrTimerId) clearTimeout(qrTimerId);
  qrTimerId = setTimeout(() => {
    if (!isReady) {
      console.log('');
      log('warning', 'QR code not scanned for 60 seconds!');
      log('info', '💡 Open WhatsApp → Settings → Linked Devices → Link a Device');
      log('info', '💡 Then scan the QR code shown above.');
      log('info', '💡 If QR expired, a new one will appear automatically.\n');
    }
  }, 60000);
});

// ============================================
// ✅ Ready Event — Bot is online
// ============================================

client.on('ready', () => {
  isReady = true;
  reconnectAttempts = 0; // Reset on successful connection
  if (qrTimerId) { clearTimeout(qrTimerId); qrTimerId = null; }

  console.log('');
  console.log(`${Colors.green}╔══════════════════════════════════════════════════════╗${Colors.reset}`);
  console.log(`${Colors.green}║${Colors.reset}       ${Colors.bright}✅ Datrix Bot is READY!${Colors.reset}                          ${Colors.green}║${Colors.reset}`);
  console.log(`${Colors.green}║${Colors.reset}       ${Colors.bright}🟢 All systems operational${Colors.reset}                     ${Colors.green}║${Colors.reset}`);
  console.log(`${Colors.green}╚══════════════════════════════════════════════════════╝${Colors.reset}`);
  console.log('');
  log('info', `🤖 Bot Name: ${BOT_NAME}`);
  log('info', `👤 Admin Number: ${process.env.ADMIN_NUMBER || 'Not set'}`);
  log('info', `📊 Starting subsystems...\n`);

  // 🚀 Start subsystems
  initScheduler(client);

  // 🧹 Clean up stale proxy sessions from previous runs
  cleanupStaleProxySessions();

  // 📊 Initialize message monitoring system
  initMonitor();

  log('success', '🎉 All systems go! Bot is fully operational.\n');

  // 👋 Send startup greeting to admin
  const adminNumber = process.env.ADMIN_NUMBER;
  if (adminNumber) {
    const adminId = adminNumber.includes('@c.us') ? adminNumber : `${adminNumber}@c.us`;
    const startupMessage = `🤖 *Datrix Bot is Online!*\n\n` +
      `✅ All systems operational\n` +
      `⏰ Started at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n` +
      `Ready to assist you! 🚀`;
    client.sendMessage(adminId, startupMessage).catch((err) => {
      log('warning', `Failed to send startup greeting: ${err.message}`);
    });
  }
});

// ============================================
// 💬 Message Event — Core message router
// ============================================
// Using 'message_create' instead of 'message' for:
// - More reliable message capture
// - Works with recent whatsapp-web.js versions
// - We filter out fromMe manually
// ============================================

client.on('message_create', async (msg) => {
  try {
    // 🐛 DEBUG: Log all incoming messages
    console.log(`[DEBUG] message_create event fired. fromMe: ${msg.fromMe}, body: ${msg.body?.substring(0, 50)}`);

    //  Ignore messages from the bot itself (but allow commands from admin)
    if (msg.fromMe) {
      const body = msg.body?.trim() || '';
      const isCommand = body.startsWith('!');
      
      // If it's from the bot itself, it's from the admin (only admin can send from bot)
      // msg.fromMe is the most reliable check when senderId is in @lid format
      if (!isCommand) {
        console.log('[DEBUG] Ignoring message from bot itself (not a command)');
        return;
      }
      
      console.log('[DEBUG] Processing admin command from bot itself');
    }

    // 🚫 Ignore status updates
    if (msg.isStatus) {
      console.log('[DEBUG] Ignoring status update');
      return;
    }

    // 🚫 Ignore forwarded messages (anti-spam measure)
    if (msg.isForwarded) {
      console.log('[DEBUG] Ignoring forwarded message');
      return;
    }

    // 📋 Extract message details (with individual error handling)
    let chat, contact, senderId, senderName, isGroup, chatId, body;

    try {
      chat = await msg.getChat();
    } catch (error) {
      log('error', `Failed to get chat: ${error.message}`);
      return;
    }

    try {
      contact = await msg.getContact();
    } catch (error) {
      log('error', `Failed to get contact: ${error.message}`);
      contact = { pushname: null, name: null };
    }

    senderId = msg.author || msg.from; // msg.author exists in groups
    senderName = contact.pushname || contact.name || 'User';
    isGroup = chat.isGroup;
    chatId = chat.id._serialized;
    body = msg.body?.trim();

    // 🚫 Ignore empty messages or media-only messages
    if (!body) return;

    // 📝 Log the message
    logMessage({
      from: senderName,
      body: body,
      timestamp: Date.now(),
      type: isGroup ? 'group' : 'dm',
    });

    // 📊 Increment global message counter
    incrementMessageCount();

    // Update stats
    if (isGroup) {
      messageStats.groupsHandled++;
    } else {
      messageStats.dmsHandled++;
    }

    // 📊 Record message for monitoring (fire-and-forget, non-blocking)
    recordMessage(msg, chat, contact).catch(() => {
      // Silently ignore monitoring errors - never block main bot flow
    });

    //  Log to terminal with color coding
    const truncatedBody = body.substring(0, 60) + (body.length > 60 ? '...' : '');
    if (isGroup) {
      log('group', `[${chat.name || 'Group'}] ${senderName}: ${truncatedBody}`);
    } else {
      log('dm', `${senderName}: ${truncatedBody}`);
    }

    // ─────────────────────────────────────────
    // 🎮 Check for commands (works in DMs and groups)
    // ─────────────────────────────────────────
    console.log(`[DEBUG] Parsing command from: "${body?.substring(0, 50)}"`);
    const parsed = parseCommand(body);

    if (parsed) {
      console.log(`[DEBUG] Command detected: ${parsed.command}, args: ${parsed.args?.substring(0, 30)}`);
      
      // ⚡ Rate Limiting Check
      const rateLimit = checkRateLimit(senderId);
      if (rateLimit && rateLimit.waitSeconds > 0) {
        await msg.reply(`⚡ *Slow down!*\n\nYou've used too many commands. Wait ${rateLimit.waitSeconds} seconds before using another command.\n\n🕐 Limit: ${MAX_COMMANDS_PER_MINUTE} commands per minute.`);
        log('warning', `Rate limited: ${senderName} (${senderId}) - wait ${rateLimit.waitSeconds}s`);
        return;
      }
      
      // 🔇 Allow !unmute even in muted groups
      if (isGroup && isMuted(chatId) && parsed.command !== '!unmute') {
        log('warning', `Muted group, ignoring command: ${parsed.command}`);
        return;
      }

      const reply = await handleCommand(parsed.command, parsed.args, {
        msg,
        client,
        senderId,
        senderName,
        isGroup,
        chatId,
        fromMe: msg.fromMe,
      });

      // Send command reply based on visibility setting
      if (reply) {
        if (reply.private) {
          // 🔒 Private response: Send directly to the sender (DM)
          try {
            const senderChat = await client.getChatById(senderId);
            await senderChat.sendMessage(reply.text);
            log('command', `[PRIVATE] ${parsed.command} → ${senderName}`);
          } catch (error) {
            log('error', `Failed to send private response: ${error.message}`);
            // Fallback: reply in the original chat if DM fails
            await msg.reply(reply.text);
          }
        } else {
          // 📢 Public response: Reply in the chat where command was used
          await msg.reply(reply.text);
          log('command', `[PUBLIC] ${parsed.command} in ${isGroup ? 'group' : 'DM'}`);
        }

        // Also log to terminal for admin tracking
        if (msg.fromMe) {
          log('command', `[ADMIN] ${parsed.command}: ${reply.text.substring(0, 60)}${reply.text.length > 60 ? '...' : ''}`);
        }

        messageStats.commandsHandled++;
      }
      
      // Update admin last reply timestamp for auto-reply tracking
      if (msg.fromMe) {
        updateAdminLastReply(chatId);
      }
      return;
    }

    // ─────────────────────────────────────────
    // 🔄 Proxy Chat Message Forwarding
    // ─────────────────────────────────────────
    
    // Check if this message should be forwarded via proxy
    if (!isGroup) {
      // Check if sender has an active proxy session (sending to target)
      const proxySession = getProxySession(senderId);
      if (proxySession) {
        try {
          const targetChat = await client.getChatById(proxySession.targetId);
          if (targetChat) {
            const forwardMsg = `📨 *Anonymous:*\n\n${body}\n\n_Reply to chat with the bot to respond anonymously_`;
            await targetChat.sendMessage(forwardMsg);
            updateProxyActivity(proxySession.id);
            log('dm', `Proxied message from ${senderName} to ${proxySession.targetName}`);
            
            // Confirm to sender
            await msg.reply('✅ Message forwarded anonymously!');
          }
        } catch (error) {
          log('error', `Proxy forward error: ${error.message}`);
          await msg.reply('⚠️ Failed to forward message. The recipient may be unavailable.');
        }
        return;
      }

      // Check if sender is a target of a proxy session (replying back)
      const reverseSession = getProxySessionByTarget(senderId);
      if (reverseSession) {
        try {
          const initiatorChat = await client.getChatById(reverseSession.userId);
          if (initiatorChat) {
            const forwardMsg = `📨 *Reply from ${reverseSession.targetName}:*\n\n${body}`;
            await initiatorChat.sendMessage(forwardMsg);
            updateProxyActivity(reverseSession.id);
            log('dm', `Proxied reply from ${senderName} to initiator`);
          }
        } catch (error) {
          log('error', `Proxy reply error: ${error.message}`);
        }
        return;
      }
    }

    // ─────────────────────────────────────────
    // 💬 ChatBot Mode Handling (DM only)
    // ─────────────────────────────────────────
    if (!isGroup && isChatbotSessionActive(senderId)) {
      // Check if user wants to end the chatbot session
      if (isChatbotExitMessage(body)) {
        endChatbotSession(senderId);
        await msg.reply('👋 *ChatBot session ended!*\n\nThanks for chatting with me. Feel free to use `!ask` anytime to start a new conversation! 🤖');
        log('dm', `ChatBot session ended for ${senderName}`);
        return;
      }

      // Continue chatbot conversation
      try {
        trackUserMessage(senderId, senderName);
        const aiReply = await generateChatbotReply(body, senderName, senderId);
        updateChatbotActivity(senderId);
        await msg.reply(aiReply);
        log('ai', `ChatBot reply to ${senderName} (${aiReply.length} chars)`);
        return;
      } catch (error) {
        log('error', `ChatBot error: ${error.message}`);
        await msg.reply('⚠️ I had a little hiccup. Could you try that again?');
        return;
      }
    }

    // ─────────────────────────────────────────
    // 👥 Group message handling
    // ─────────────────────────────────────────
    if (isGroup) {
      // 🔇 Ignore muted groups
      if (isMuted(chatId)) return;

      // Only respond if bot is mentioned (@bot)
      let isMentioned = false;
      try {
        const mentions = await msg.getMentions();
        const botId = client.info?.wid?._serialized;
        if (botId && mentions.length > 0) {
          isMentioned = mentions.some(
            (mention) => mention.id?._serialized === botId
          );
        }
      } catch (error) {
        // getMentions can fail on some message types — check body text instead
        const botNumber = client.info?.wid?.user;
        if (botNumber && body.includes(`@${botNumber}`)) {
          isMentioned = true;
        }
      }

      // 🤖 Check for @Abhi mentions in groups (auto-reply mode)
      const adminName = process.env.ADMIN_NAME || 'Abhi';
      const adminNumber = (process.env.ADMIN_NUMBER || '').replace(/\D/g, '');
      const mentionsAbhi = body.toLowerCase().includes(`@${adminName.toLowerCase()}`) ||
                           body.toLowerCase().includes('@abhi') ||
                           (adminNumber && body.includes('@' + adminNumber));
      
      // Auto-reply if someone mentions Abhi and group replies are enabled
      if (mentionsAbhi && !msg.fromMe && isGroupMentionReplyEnabled(chatId)) {
        console.log(`[AUTO-REPLY] ${senderName} mentioned ${adminName} in group ${chat.name}`);
        
        trackUserMessage(senderId, senderName);
        const personality = getUserPreference(senderId, 'personality') || 'default';
        
        // Generate contextual reply on behalf of admin
        const prompt = `Someone mentioned ${adminName} (your owner/admin) in a group chat with this message: "${body.substring(0, 200)}".
        Reply briefly and helpfully as if you are ${adminName}'s assistant. Keep it professional and friendly. Do not claim to be ${adminName} himself, but his AI assistant.`;
        
        const aiReply = await generateReply(prompt, senderName, senderId, personality);
        await msg.reply(aiReply);
        
        log('ai', `Auto-replied to @${adminName} mention from ${senderName} in ${chat.name}`);
        return;
      }

      if (!isMentioned) {
        // 🤫 Not mentioned — don't reply to casual group chatter
        return;
      }

      // Bot was mentioned — check anti-spam and reply
      const rateLimitStatus = isRateLimited(senderId);
      if (rateLimitStatus.limited) {
        if (rateLimitStatus.shouldWarn) {
          await msg.reply(`⏳ ${senderName}, please wait a moment before mentioning me again. I'm getting too many messages! 😅`);
        }
        log('warning', `Rate limited: ${senderName} (warnings: ${rateLimitStatus.warnings})`);
        return;
      }

      // Remove @mentions from the message for cleaner AI input
      // Handles both @number and @name formats
      const botNumber = client.info?.wid?.user || '';
      let cleanBody = body
        .replace(new RegExp(`@${botNumber}`, 'g'), '')  // Remove @botNumber
        .replace(/@\S+/g, '')                           // Remove any @mentions
        .trim();

      if (!cleanBody) {
        await msg.reply(`Hey ${senderName}! Did you want to ask me something? 🤔`);
        return;
      }

      trackUserMessage(senderId, senderName);
      const personality = getUserPreference(senderId, 'personality') || 'default';
      const aiReply = await generateReply(cleanBody, senderName, senderId, personality);
      await msg.reply(aiReply);
      messageStats.mentionsReplied++;
      messageStats.aiReplies++;
      log('ai', `Replied to @mention from ${senderName} in ${chat.name || 'group'}`);
      return;
    }

    // ─────────────────────────────────────────
    // 👤 DM (private message) handling
    // ─────────────────────────────────────────

    // 🛡️ Anti-spam check
    const dmRateLimit = isRateLimited(senderId);
    if (dmRateLimit.limited) {
      if (dmRateLimit.shouldWarn) {
        await msg.reply(`⏳ Hey ${senderName}, you're sending messages too quickly! Please wait a moment. 😅`);
      }
      log('warning', `Rate limited DM from: ${senderName}`);
      return;
    }

    // 📝 Track user and check if first-time
    const isFirstTime = trackUserMessage(senderId, senderName);

    // 🆕 Special greeting for first-time users
    if (isFirstTime) {
      const welcomeDM = `👋 Hey ${senderName}! Welcome to Datrix!

I'm ${BOT_NAME}, your AI assistant here. I can help you with:

• Information about Datrix and our data solutions
• Answering your questions using AI
• Connecting you with our CEO, Abhi

Type *!help* to see all available commands, or just chat with me naturally! 🤖`;
      
      await msg.reply(welcomeDM);
      // Save the welcome as conversation context
      addToConversation(senderId, 'assistant', welcomeDM);
      log('success', `First-time user greeted: ${senderName}`);
      return;
    }

    // 🤖 Auto-reply mode: Reply on behalf of admin if inactive for 2+ hours
    const replyMode = getReplyMode(chatId);
    const isAdminInactive = shouldAutoReply(chatId);
    
    if (replyMode.enabled && isAdminInactive && !msg.fromMe) {
      console.log(`[AUTO-REPLY] Admin inactive for 2+ hours in DM with ${senderName}`);
      
      const personality = getUserPreference(senderId, 'personality') || 'default';
      const adminName = process.env.ADMIN_NAME || 'Abhi';
      
      // Generate reply as admin's assistant
      const prompt = `Someone sent this message to ${adminName} (who is currently unavailable): "${body.substring(0, 300)}".
      
Reply helpfully and professionally on behalf of ${adminName}'s AI assistant. Inform them briefly that ${adminName} is currently busy and will reply when available. Be friendly and helpful - answer what you can, or note that you'll pass the message along.`;
      
      const aiReply = await generateReply(prompt, senderName, senderId, personality);
      await msg.reply(aiReply);
      
      messageStats.aiReplies++;
      log('ai', `Auto-replied to DM from ${senderName} (admin inactive)`);
      return;
    }

    // 🤖 Generate AI reply for regular DMs (with conversation memory)
    const personality = getUserPreference(senderId, 'personality') || 'default';
    const aiReply = await generateReply(body, senderName, senderId, personality);
    await msg.reply(aiReply);
    messageStats.aiReplies++;
    log('ai', `Replied to DM from: ${senderName}`);

  } catch (error) {
    log('error', `Message handler error: ${error.message}`);
    // Don't crash — just log and continue
    try {
      await msg.reply('⚠️ Oops, something went wrong on my end. Please try again!');
    } catch (replyError) {
      log('error', `Failed to send error reply: ${replyError.message}`);
    }
  }
});

// ============================================
// 👋 Group Join Event — Welcome new members
// ============================================

client.on('group_join', async (notification) => {
  try {
    const chat = await notification.getChat();
    const chatId = chat.id._serialized;

    // 🔇 Skip welcome in muted groups
    if (isMuted(chatId)) {
      log('info', `Skipping welcome in muted group: ${chat.name}`);
      return;
    }

    let memberName = 'there';
    let memberPhone = '';
    try {
      const contact = await notification.getContact();
      memberName = contact.pushname || contact.name || 'there';
      memberPhone = contact.number || '';
    } catch (error) {
      // Some notifications don't have accessible contacts
      log('warning', 'Could not get joining member name');
    }

    log('info', `New member joined ${chat.name}: ${memberName}`);

    // Check if custom welcome message is set
    let welcomeMessage;
    const customMessage = getWelcomeMessage(chatId);
    const welcomeEnabled = isWelcomeEnabled(chatId);
    
    if (welcomeEnabled && customMessage) {
      // Use custom message with variables
      welcomeMessage = customMessage
        .replace(/{name}/g, memberName)
        .replace(/{phone}/g, memberPhone)
        .replace(/{group}/g, chat.name || 'this group');
    } else if (!welcomeEnabled) {
      // Welcome is disabled
      log('info', `Welcome disabled for group: ${chat.name}`);
      return;
    } else {
      // Default welcome message
      welcomeMessage = `👋 Welcome to the group, *${memberName}*!

🏢 This group is powered by *Datrix* — a data intelligence startup building the future of clean, unbiased data.

🤖 I'm Datrix Bot, your AI assistant. Here's what I can do:

📋 Type *!help* to see all commands
🧠 Type *!ask [question]* to ask me anything
🏢 Type *!about* to learn about Datrix

Feel free to ask questions anytime! 🚀`;
    }

    await chat.sendMessage(welcomeMessage);
    log('success', `Welcome message sent for ${memberName}`);

  } catch (error) {
    log('error', `Welcome message error: ${error.message}`);
  }
});

// ============================================
// 🗑️ Message Delete Event — Handle deleted messages
// ============================================

client.on('message_revoke_everyone', async (after, before) => {
  // 'before' is the original message that was deleted
  // 'after' is the notification that the message was deleted
  if (before) {
    try {
      const chat = await before.getChat();
      const sender = before.author || before.from;
      const senderName = before._data?.notifyName || 'Someone';
      
      // Log deleted message for admin awareness (optional)
      log('warning', `🗑️ Message deleted by ${senderName} in ${chat.isGroup ? chat.name : 'DM'}: "${before.body?.substring(0, 50)}..."`);
      
      // In groups, notify about deletion if it's not from admin
      if (chat.isGroup && !isMuted(chat.id._serialized)) {
        const adminNumber = process.env.ADMIN_NUMBER?.replace(/\D/g, '');
        const senderNumber = sender?.replace(/\D/g, '');
        
        // Only notify if not admin deleting and group has > 10 members (larger groups)
        if (adminNumber && senderNumber && !senderNumber.includes(adminNumber)) {
          const participants = chat.participants || [];
          if (participants.length > 10) {
            // Optional: Log for monitoring but don't spam
            log('info', `Message deleted in large group: ${chat.name} (${participants.length} members)`);
          }
        }
      }
    } catch (error) {
      // Silent fail - don't crash on delete handling
      log('error', `Message revoke handler error: ${error.message}`);
    }
  }
});

// ============================================
// 👋 Group Leave Event — Log member departures
// ============================================

client.on('group_leave', async (notification) => {
  try {
    const chat = await notification.getChat();
    const chatId = chat.id._serialized;
    
    // 🔇 Skip goodbye in muted groups
    if (isMuted(chatId)) {
      log('info', `Skipping goodbye in muted group: ${chat.name}`);
      return;
    }

    let memberName = 'Someone';
    let memberPhone = '';
    try {
      const contact = await notification.getContact();
      memberName = contact.pushname || contact.name || 'Someone';
      memberPhone = contact.number || '';
    } catch (error) {
      // Ignore
    }
    
    log('info', `Member left ${chat.name}: ${memberName}`);
    
    // Check if custom goodbye message is set
    const customMessage = getGoodbyeMessage(chatId);
    const goodbyeEnabled = isGoodbyeEnabled(chatId);
    
    if (goodbyeEnabled && customMessage) {
      // Use custom message with variables
      const goodbyeMessage = customMessage
        .replace(/{name}/g, memberName)
        .replace(/{phone}/g, memberPhone)
        .replace(/{group}/g, chat.name || 'this group');
      
      await chat.sendMessage(goodbyeMessage);
      log('success', `Goodbye message sent for ${memberName}`);
    } else if (!goodbyeEnabled) {
      // Goodbye is disabled
      log('info', `Goodbye disabled for group: ${chat.name}`);
    }
    // No default goodbye message - only send if custom is set
    
  } catch (error) {
    log('error', `Group leave handler error: ${error.message}`);
  }
});

// ============================================
// 📞 Call Event — Track call events
// ============================================

client.on('call', async (call) => {
  try {
    // Get chat info if available
    let chatName = 'Unknown';
    try {
      const chat = await call.getChat();
      chatName = chat.name || chatName;
    } catch (error) {
      // Chat might not be available
    }

    // Determine call data based on state
    let callData;

    if (call.isGroup) {
      // Group call handling
      callData = {
        callId: call.id,
        chatId: call.chatId || '',
        chatName: chatName,
        isGroupCall: true,
        callerId: call.from || '',
        callerName: call.sender || 'Unknown',
        type: call.isVideo ? 'video' : 'audio',
        direction: call.fromMe ? 'outgoing' : 'incoming',
        status: call.status || 'ringing',
        startedAt: Date.now(),
      };
    } else {
      // Individual call handling
      if (call.status === 'missed') {
        callData = callHandlers.handleMissedCall(call);
      } else if (call.status === 'ended' && call.duration) {
        callData = callHandlers.handleCallEnd(call, call.duration);
      } else if (call.fromMe) {
        callData = callHandlers.handleOutgoingCall(call);
      } else {
        callData = callHandlers.handleIncomingCall(call);
      }
    }

    // Override with more accurate data if available
    if (chatName !== 'Unknown') {
      callData.chatName = chatName;
    }

    // Record the call event (fire-and-forget)
    recordCall(callData).catch(() => {
      // Silently ignore monitoring errors
    });

    log('info', `Call ${callData.direction} ${callData.status} from ${callData.callerName} (${callData.type})`);
  } catch (error) {
    log('error', `Call event handler error: ${error.message}`);
  }
});

// ============================================
//  Disconnected Event — Handle disconnections
// ============================================

client.on('disconnected', (reason) => {
  isReady = false;
  log('error', `Bot disconnected: ${reason}`);

  reconnectAttempts++;

  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    log('error', `Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) exceeded. Exiting...`);
    log('info', '💡 PM2 will restart the process.');
    flushWrite(); // Save any pending data
    process.exit(1);
  }

  const delay = Math.min(5000 * reconnectAttempts, 30000); // Cap at 30s
  log('warning', `Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s...`);

  setTimeout(() => {
    try {
      client.initialize();
      log('info', 'Re-initialization triggered');
    } catch (error) {
      log('error', `Re-initialization failed: ${error.message}`);
      flushWrite();
      process.exit(1); // Let PM2 restart us
    }
  }, delay);
});

// ============================================
// 🔑 Authentication Events
// ============================================

client.on('authenticated', () => {
  log('success', 'Authentication successful');
});

client.on('auth_failure', (msg) => {
  log('error', `Authentication failed: ${msg}`);
  log('info', '💡 Try deleting .wwebjs_auth folder and scanning QR again');
});

// ============================================
// 🛡️ Anti-Spam Rate Limiter
// ============================================

/**
 * Check if a user is rate-limited with warning system.
 * Updates the timestamp and warning count if rate-limited.
 * 
 * @param {string} userId — WhatsApp user ID
 * @returns {{ limited: boolean, shouldWarn: boolean, warnings: number }}
 */
function isRateLimited(userId) {
  try {
    if (!userId || typeof userId !== 'string') {
      return { limited: false, shouldWarn: false, warnings: 0 };
    }
    
    const now = Date.now();
    const userData = antiSpamMap.get(userId) || { lastReply: 0, warnings: 0 };

    if (userData.lastReply && now - userData.lastReply < ANTI_SPAM_COOLDOWN_MS) {
      // Still in cooldown
      userData.warnings = (userData.warnings || 0) + 1;
      const shouldWarn = userData.warnings <= MAX_WARNINGS;
      antiSpamMap.set(userId, userData);
      return { limited: true, shouldWarn, warnings: userData.warnings };
    }

    // Reset warnings and update timestamp
    userData.lastReply = now;
    userData.warnings = 0;
    antiSpamMap.set(userId, userData);
    return { limited: false, shouldWarn: false, warnings: 0 };
  } catch (error) {
    log('error', `Rate limit check error: ${error.message}`);
    return { limited: false, shouldWarn: false, warnings: 0 };
  }
}

// 🧹 Periodic cleanup of anti-spam map (every 5 minutes)
// Prevents unbounded memory growth from unique users
setInterval(() => {
  try {
    const now = Date.now();
    const cutoff = now - ANTI_SPAM_COOLDOWN_MS * 6; // 60s old entries
    let cleaned = 0;
    for (const [key, data] of antiSpamMap) {
      if (!data || !data.lastReply || data.lastReply < cutoff) {
        antiSpamMap.delete(key);
        cleaned++;
      }
    }
    
    // Hard limit: if map grows too large, clear oldest entries
    if (antiSpamMap.size > 10000) {
      const entries = Array.from(antiSpamMap.entries());
      entries.sort((a, b) => (a[1]?.lastReply || 0) - (b[1]?.lastReply || 0));
      const toRemove = entries.slice(0, antiSpamMap.size - 5000);
      for (const [key] of toRemove) {
        antiSpamMap.delete(key);
        cleaned++;
      }
      log('warning', `Anti-spam map exceeded 10k entries, removed ${toRemove.length} oldest`);
    }
    
    if (cleaned > 0) {
      log('info', `🧹 Anti-spam cleanup: removed ${cleaned} expired entries (${antiSpamMap.size} active)`);
    }
  } catch (error) {
    log('error', `Anti-spam cleanup error: ${error.message}`);
  }
}, 300000); // 5 minutes

// 📊 Periodic stats logging (every 30 minutes)
setInterval(() => {
  const uptime = Math.floor((Date.now() - messageStats.startTime) / 60000);
  const memUsage = process.memoryUsage();
  const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  log('info', `📊 Session Stats — Uptime: ${uptime}m | Commands: ${messageStats.commandsHandled} | AI Replies: ${messageStats.aiReplies} | Memory: ${heapMB}MB`);
}, 1800000); // 30 minutes

// ============================================
// 🛑 Graceful Shutdown
// ============================================

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return; // Prevent double shutdown
  isShuttingDown = true;

  console.log(`\n${Colors.yellow}🛑 Received ${signal}. Shutting down gracefully...${Colors.reset}`);
  
  try {
    stopScheduler();
    flushWrite(); // 💾 Flush any pending database writes
    await client.destroy();
    log('success', 'Bot shut down cleanly');
  } catch (error) {
    log('error', `Error during shutdown: ${error.message}`);
  }

  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 🚫 Catch unhandled errors — bot should NEVER crash
// Using the new structured logger for better error tracking
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  console.error(error.stack);
  // Don't exit — let PM2 decide
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || String(reason),
    stack: reason?.stack
  });
  // Don't exit — let PM2 decide
});

// ============================================
// 🏁 Start the bot!
// ============================================

log('info', 'Starting subsystems...\n');

log('info', '⏳ Initializing WhatsApp client...\n');

// Initialize with error handling for browser conflicts
client.initialize().catch((error) => {
  if (error.message && error.message.includes('browser is already running')) {
    log('error', '⚠️  Browser session conflict detected!');
    log('info', '💡 Run these commands to fix:');
    log('info', '   1. Taskkill /F /IM chrome.exe /IM chromium.exe');
    log('info', '   2. rd /s /q .wwebjs_auth');
    log('info', '   3. npm start');
    log('info', '\n   Or use: npm run fix-session');
  } else {
    log('error', `Initialization failed: ${error.message}`);
  }
  process.exit(1);
});

// ============================================
// 📤 Module Exports (for backward compatibility)
// ============================================
// Export the log function for backward compatibility
// The log function now uses the new structured logger
module.exports = {
  log,
  logger,
  printBanner,
};
