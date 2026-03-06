// ============================================
// ⏰ scheduler.js — Advanced Cron Scheduler v2.2
// ============================================
// Uses node-cron to schedule recurring broadcasts and reminders.
//
// UPGRADE v2.2:
// - Improved error handling in scheduled tasks
// - Better cleanup of completed reminders
//
// UPGRADE v2.0:
// - Cron expression validation
// - Skip broadcast if bot is offline/disconnected
// - Track last broadcast time to prevent duplicates
// - Health check logs memory usage for monitoring
// - NEW: Reminder processing every minute
// - NEW: Recurring daily announcements
// - NEW: Birthday/anniversary reminders (placeholder)
// - NEW: Scheduled group announcements
// ============================================

const cron = require('node-cron');
const { addBroadcast, getPendingReminders, completeReminder } = require('./db');
const { executeBroadcast } = require('./commands');

// 📌 Store reference to active cron jobs for cleanup
const activeJobs = [];

// 📅 Track last broadcast to prevent duplicates on rapid restarts
let lastBroadcastTime = 0;
const MIN_BROADCAST_INTERVAL_MS = 3600000; // 1 hour minimum between broadcasts

// 🔧 Client reference for sending messages
let whatsappClient = null;

/**
 * Initialize all scheduled cron jobs.
 * 
 * @param {object} client — whatsapp-web.js Client instance
 */
function initScheduler(client) {
  console.log('⏰ Initializing scheduler...');
  whatsappClient = client;

  // ─────────────────────────────────────────
  // 📅 Weekly Monday 9 AM IST — Datrix Update
  // Cron: minute(0) hour(9) dayOfMonth(*) month(*) dayOfWeek(1=Monday)
  // ─────────────────────────────────────────
  const weeklyExpression = '0 9 * * 1';

  if (!cron.validate(weeklyExpression)) {
    console.error('❌ Invalid cron expression for weekly update:', weeklyExpression);
  } else {
    const weeklyUpdate = cron.schedule(
      weeklyExpression,
      async () => {
        console.log('📅 Running weekly Datrix update broadcast...');
        
        // ⛔ Skip if bot is offline
        if (!client?.info) {
          console.log('⚠️ Bot is offline, skipping scheduled broadcast');
          return;
        }

        // ⛔ Skip if recently broadcasted (prevents duplication on restart)
        const now = Date.now();
        if (now - lastBroadcastTime < MIN_BROADCAST_INTERVAL_MS) {
          console.log('⚠️ Skipping — broadcast was sent less than 1 hour ago');
          return;
        }

        lastBroadcastTime = now;
        await sendScheduledBroadcast(client, getWeeklyUpdateMessage());
      },
      {
        timezone: 'Asia/Kolkata', // IST timezone
        scheduled: true,
      }
    );

    activeJobs.push(weeklyUpdate);
    console.log('✅ Scheduled: Weekly Datrix update — Every Monday 9:00 AM IST');
  }

  // ─────────────────────────────────────────
  // 🌅 Daily Good Morning — 8 AM IST (Optional)
  // ─────────────────────────────────────────
  const morningExpression = '0 8 * * *';
  
  if (cron.validate(morningExpression)) {
    const morningGreeting = cron.schedule(
      morningExpression,
      async () => {
        if (!client?.info) {
          console.log('⚠️ Bot is offline, skipping morning greeting');
          return;
        }
        
        console.log('🌅 Sending morning greetings...');
        // Morning greeting is sent only to a specific group if configured
        // This is a placeholder for future implementation
      },
      {
        timezone: 'Asia/Kolkata',
        scheduled: true, // Enabled
      }
    );
    
    activeJobs.push(morningGreeting);
    console.log('✅ Scheduled: Daily morning greeting — 8:00 AM IST (enabled)');
  }

  // ─────────────────────────────────────────
  // ⏰ Reminder Checker — Every minute
  // Checks for and sends pending reminders
  // ─────────────────────────────────────────
  const reminderExpression = '* * * * *';
  
  if (cron.validate(reminderExpression)) {
    const reminderChecker = cron.schedule(
      reminderExpression,
      async () => {
        if (!client?.info) {
          return; // Skip if bot is offline
        }
        
        try {
          const pendingReminders = getPendingReminders();
          
          for (const reminder of pendingReminders) {
            try {
              // 🐛 DEBUG: Log reminder attempt
              console.log(`[DEBUG] Processing reminder ${reminder.id} for chat ${reminder.chatId}`);
              
              // Skip invalid/test chat IDs
              if (!reminder.chatId || reminder.chatId.includes('test_') || !reminder.chatId.includes('@')) {
                console.log(`[DEBUG] Skipping invalid chat ID: ${reminder.chatId}`);
                completeReminder(reminder.id); // Mark as completed to prevent infinite retries
                continue;
              }
              
              // Get the chat to send reminder
              const chat = await client.getChatById(reminder.chatId);
              if (chat) {
                const reminderMsg = `⏰ *Reminder!*\n\n${reminder.message}\n\n— Robert 🤖`;
                await chat.sendMessage(reminderMsg);
                completeReminder(reminder.id);
                console.log(`⏰ Reminder sent to ${reminder.userId}`);
              } else {
                console.log(`[DEBUG] Chat not found: ${reminder.chatId}, marking reminder as completed`);
                completeReminder(reminder.id); // Mark as completed to prevent infinite retries
              }
            } catch (error) {
              console.error(`❌ Failed to send reminder ${reminder.id}:`, error.message);
              // Mark as completed after failure to prevent infinite retry loop
              console.log(`[DEBUG] Marking reminder ${reminder.id} as completed after failure`);
              completeReminder(reminder.id);
            }
          }
        } catch (error) {
          console.error('❌ Reminder checker error:', error.message);
        }
      },
      {
        timezone: 'Asia/Kolkata',
        scheduled: true,
      }
    );
    
    activeJobs.push(reminderChecker);
    console.log('✅ Scheduled: Reminder checker — Every minute');
  }

  // ─────────────────────────────────────────
  // 🏓 Daily health check log — 8:30 PM IST
  // Logs system health + memory usage for monitoring
  // ─────────────────────────────────────────
  const healthExpression = '30 20 * * *';

  if (!cron.validate(healthExpression)) {
    console.error('❌ Invalid cron expression for health check:', healthExpression);
  } else {
    const healthCheck = cron.schedule(
      healthExpression,
      () => {
        const memUsage = process.memoryUsage();
        const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const rssMB = Math.round(memUsage.rss / 1024 / 1024);
        console.log(`🏓 Health check — Heap: ${heapMB}MB | RSS: ${rssMB}MB | Bot: ${client?.info ? '🟢 Online' : '🔴 Offline'}`);
      },
      {
        timezone: 'Asia/Kolkata',
        scheduled: true,
      }
    );

    activeJobs.push(healthCheck);
    console.log('✅ Scheduled: Daily health check — Every day 8:30 PM IST');
  }

  // ─────────────────────────────────────────
  // 🌙 Nightly cleanup — 9 PM IST
  // Cleans up old completed reminders
  // ─────────────────────────────────────────
  const cleanupExpression = '0 21 * * *';
  
  if (cron.validate(cleanupExpression)) {
    const nightlyCleanup = cron.schedule(
      cleanupExpression,
      () => {
        console.log('🌙 Running nightly cleanup...');
        try {
          // Cleanup old completed reminders older than 7 days
          const { db, flushWrite } = require('./db');
          const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          const initialCount = db.data.scheduledReminders.length;
          
          db.data.scheduledReminders = db.data.scheduledReminders.filter(r => {
            // Keep if pending or completed within last 7 days
            return !r.completed || r.triggerTime > oneWeekAgo;
          });
          
          const removed = initialCount - db.data.scheduledReminders.length;
          if (removed > 0) {
            flushWrite();
            console.log(`🧹 Cleaned up ${removed} old reminders`);
          }
        } catch (error) {
          console.error('❌ Nightly cleanup error:', error.message);
        }
      },
      {
        timezone: 'Asia/Kolkata',
        scheduled: true,
      }
    );
    
    activeJobs.push(nightlyCleanup);
    console.log('✅ Scheduled: Nightly cleanup — Every day 9:00 PM IST');
  }

  console.log('⏰ Scheduler ready!\n');
}

/**
 * Send a scheduled broadcast to all groups the bot is in.
 * Uses the shared executeBroadcast function from commands.js
 * 
 * @param {object} client — whatsapp-web.js Client instance
 * @param {string} message — The message to broadcast
 */
async function sendScheduledBroadcast(client, message) {
  try {
    // Double-check client is ready
    if (!client?.info) {
      console.log('⚠️ Client offline during broadcast execution — aborting');
      return;
    }

    const formattedMsg = `📢 *Robert Broadcast*\n\n${message}\n\n— Robert 🤖`;
    const result = await executeBroadcast(client, formattedMsg);
    
    // 📝 Log to database
    addBroadcast(`[Scheduled] ${message.substring(0, 100)}`, result.count);
    console.log(`📅 Scheduled broadcast complete — sent to ${result.count}/${result.count + result.failures} groups (${result.failures} failures)`);

  } catch (error) {
    console.error('❌ Scheduled broadcast error:', error.message);
  }
}

/**
 * Send an announcement to a specific group.
 * @param {string} groupId — Group chat ID
 * @param {string} message — Announcement message
 * @returns {Promise<boolean>}
 */
async function sendGroupAnnouncement(groupId, message) {
  try {
    if (!whatsappClient?.info) {
      console.log('⚠️ Client offline, cannot send announcement');
      return false;
    }
    
    const chat = await whatsappClient.getChatById(groupId);
    if (chat && chat.isGroup) {
      const formattedMsg = `📢 *Announcement*\n\n${message}\n\n— Robert 🤖`;
      await chat.sendMessage(formattedMsg);
      console.log(`📢 Announcement sent to group: ${chat.name}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Group announcement error:', error.message);
    return false;
  }
}

/**
 * Schedule a one-time announcement for a specific date/time.
 * @param {string} groupId — Group chat ID
 * @param {string} message — Announcement message
 * @param {Date} scheduledTime — When to send
 * @returns {string|null} — Job ID or null if failed
 */
function scheduleGroupAnnouncement(groupId, message, scheduledTime) {
  try {
    const now = new Date();
    const delay = scheduledTime.getTime() - now.getTime();
    
    if (delay <= 0) {
      console.log('⚠️ Scheduled time is in the past');
      return null;
    }
    
    const jobId = `announce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setTimeout(async () => {
      await sendGroupAnnouncement(groupId, message);
    }, delay);
    
    console.log(`📅 Scheduled announcement for ${scheduledTime.toISOString()}`);
    return jobId;
  } catch (error) {
    console.error('❌ Schedule announcement error:', error.message);
    return null;
  }
}

/**
 * Generate the weekly Datrix update message.
 * Update this message content as the startup progresses!
 * 
 * @returns {string}
 */
function getWeeklyUpdateMessage() {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  return `📊 *Datrix Weekly Update*
📅 ${today}

Hey team! 👋 Here's your weekly Datrix roundup:

🔬 *This Week's Progress:*
• Continued building our data cleaning pipeline
• Improving bias detection algorithms  
• Working on secure data access layer

🎯 *Coming Up:*
• Beta testing preparations
• Data marketplace UI wireframes

💡 Have ideas or feedback? Drop a message anytime!

— Robert 🤖`;
}

/**
 * Stop all scheduled cron jobs (for graceful shutdown).
 */
function stopScheduler() {
  activeJobs.forEach((job) => {
    try {
      job.stop();
    } catch (error) {
      console.error('❌ Error stopping cron job:', error.message);
    }
  });
  console.log('⏰ All scheduled jobs stopped');
}

// ============================================
// 📤 Module Exports
// ============================================

module.exports = {
  initScheduler,
  stopScheduler,
  sendScheduledBroadcast,
  sendGroupAnnouncement,
  scheduleGroupAnnouncement,
  getWeeklyUpdateMessage,
};
