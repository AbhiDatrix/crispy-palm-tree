// ============================================
// 🔐 Admin Commands — Broadcast, Send, Reply, Replyto, Proxy, Stats, Monitor
// ============================================

const { log } = require('../bot.js');
const { getStats, getUserStats } = require('../db');
const { getTokenUsage } = require('../ai');

// 📊 Message Monitoring System
const {
  isEnabled: isMonitorEnabled,
  getConfig: getMonitorConfig,
  configureMonitor,
  getMessages,
  getCalls,
  exportData,
  clearOldData,
  getStats: getMonitorStats,
} = require('../monitor');

/**
 * Extract quoted argument from string
 * @param {string} str - The input string
 * @returns {Object|null} - { value: string, remaining: string } or null
 */
function extractQuotedArg(str) {
  if (!str || typeof str !== 'string') return null;

  const trimmed = str.trim();
  if (!trimmed) return null;

  const firstChar = trimmed.charAt(0);

  if (firstChar === '"' || firstChar === "'") {
    let endIndex = -1;
    for (let i = 1; i < trimmed.length; i++) {
      if (trimmed.charAt(i) === firstChar && trimmed.charAt(i - 1) !== '\\') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) return null;

    return {
      value: trimmed.slice(1, endIndex).trim(),
      remaining: trimmed.slice(endIndex + 1).trim(),
    };
  }

  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) {
    return { value: trimmed, remaining: '' };
  }

  return {
    value: trimmed.slice(0, firstSpace).trim(),
    remaining: trimmed.slice(firstSpace + 1).trim(),
  };
}

/**
 * Parse contact identifier and message for !send command
 * @param {string} args - The argument string
 * @returns {Object|null} - { contactQuery, message } or null
 */
function parseSendArgs(args) {
  if (!args || typeof args !== 'string') return null;

  const trimmed = args.trim();
  if (!trimmed) return null;

  const contactResult = extractQuotedArg(trimmed);
  if (!contactResult || !contactResult.value) return null;

  const message = contactResult.remaining;
  if (!message) return null;

  return {
    contactQuery: contactResult.value,
    message: message.trim(),
  };
}

/**
 * Parse arguments for !replyto command
 * @param {string} args - The argument string
 * @returns {Object|null} - { groupName, personName, instruction } or null
 */
function parseReplyToArgs(args) {
  if (!args || typeof args !== 'string') return null;

  const groupResult = extractQuotedArg(args);
  if (!groupResult || !groupResult.value) return null;

  const personResult = extractQuotedArg(groupResult.remaining);
  if (!personResult || !personResult.value) {
    return {
      groupName: groupResult.value,
      personName: groupResult.value,
      instruction: 'send a friendly message',
    };
  }

  let instruction = personResult.remaining;
  if (instruction.startsWith('"') || instruction.startsWith("'")) {
    const instResult = extractQuotedArg(personResult.remaining);
    if (instResult && instResult.value) {
      instruction = instResult.value;
    }
  }

  if (!instruction) {
    instruction = 'send a friendly message';
  }

  return {
    groupName: groupResult.value,
    personName: personResult.value,
    instruction: instruction.trim(),
  };
}

/**
 * Execute broadcast to all groups
 * @param {object} client - WhatsApp client
 * @param {string} message - Message to broadcast
 * @returns {Promise<{count: number, failures: number}>}
 */
async function executeBroadcast(client, message) {
  const chats = await client.getChats();
  const groups = chats.filter((chat) => chat.isGroup);

  let sentCount = 0;
  let failCount = 0;
  const formattedMsg = `📢 *Robert Broadcast*\n\n${message}\n\n— Robert 🤖`;

  for (const group of groups) {
    try {
      await group.sendMessage(formattedMsg);
      sentCount++;
      log('command', `Broadcast sent to: ${group.name}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      failCount++;
      log('error', `Failed to broadcast to ${group.name}: ` + error.message);
    }
  }

  return { count: sentCount, failures: failCount };
}

/**
 * Register all admin commands with the registry
 * @param {Object} registry - Command registry instance
 */
function registerAdminCommands(registry) {
  // 📢 !broadcast — Admin only
  registry.register('!broadcast', async (msg, args, context) => {
    const { isPrivate, client } = context;
    const { addBroadcast } = require('../db');
    
    if (!args) {
      return { 
        text: '📢 Usage: `!broadcast Your message here`', 
        private: isPrivate 
      };
    }
    
    if (args.length > 1000) {
      return { 
        text: '⚠️ Broadcast message too long! Keep it under 1000 characters.', 
        private: isPrivate 
      };
    }
    
    try {
      const broadcastResult = await executeBroadcast(client, args);
      addBroadcast(args, broadcastResult.count);
      return { 
        text: `📢 Broadcast sent to ${broadcastResult.count} group(s)!\n${broadcastResult.failures > 0 ? `⚠️ Failed in ${broadcastResult.failures} group(s)` : ''}`, 
        private: isPrivate 
      };
    } catch (error) {
      log('error', 'Broadcast error: ' + error.message);
      return { 
        text: '⚠️ Broadcast failed. Check logs for details.', 
        private: isPrivate 
      };
    }
  }, { 
    description: 'Send message to all groups',
    category: 'admin',
    adminOnly: true,
    usage: '[message]'
  });

  // 📤 !send — Send message to contact (admin only)
  registry.register('!send', async (msg, args, context) => {
    const { isPrivate, client, chatId, senderName, fromMe } = context;
    
    if (!args) {
      return { 
        text: '📤 *Send Message Command*\n\nUsage: `!send [contact-name-or-number] [message]`\n\nExamples:\n• `!send mritunjay Hello, are we meeting today?`\n• `!send +919876543210 Don\'t forget the presentation!`\n• `!send "John Doe" Hello there!` (quoted name)\n• `!send \'Mom\' How are you?` (single quotes)\n\n💡 Use quotes for contact names with spaces. The bot will search your contacts and deliver the message.', 
        private: isPrivate 
      };
    }

    const parsedArgs = parseSendArgs(args);
    if (!parsedArgs) {
      return { 
        text: '❌ Please provide both a contact name/number and a message.\n\nUsage: `!send [contact-name-or-number] [message]`\n\n💡 You can use quotes for names with spaces:\n• `!send "John Doe" Hello there!`\n• `!send \'Mom\' How are you?`', 
        private: isPrivate 
      };
    }

    const { contactQuery, message } = parsedArgs;

    if (!message) {
      return { 
        text: '❌ Please provide a message to send.', 
        private: isPrivate 
      };
    }

    if (message.length > 1000) {
      return { 
        text: '⚠️ Message too long! Please keep it under 1000 characters.', 
        private: isPrivate 
      };
    }

    try {
      const chats = await client.getChats();
      let exactMatches = [];
      let partialMatches = [];

      const normalizedQuery = contactQuery.replace(/\D/g, '').toLowerCase();
      const queryLower = contactQuery.toLowerCase();
      
      for (const chat of chats) {
        if (chat.id._serialized === chatId) {
          continue;
        }
        
        if (chat.id._serialized.endsWith('@c.us')) {
          const chatNumber = chat.id.user.replace(/\D/g, '');
          
          if (chatNumber === normalizedQuery ||
              chatNumber === normalizedQuery.slice(-10) ||
              normalizedQuery === chatNumber.slice(-10)) {
            exactMatches.push({ chat, priority: 1, type: 'number' });
            continue;
          }

          let contactName = chat.name || '';
          let contactPushname = '';
          try {
            const contact = await chat.getContact();
            contactPushname = contact.pushname || contact.name || '';
          } catch (e) {
            // Continue without contact info
          }
          
          const names = [contactName, contactPushname].filter(n => n).map(n => n.toLowerCase());
          
          for (const name of names) {
            if (name === queryLower) {
              exactMatches.push({ chat, priority: 0, type: 'exact_name' });
              break;
            }
          }
          
          if (!exactMatches.find(m => m.chat === chat)) {
            for (const name of names) {
              if (name.includes(queryLower) || queryLower.includes(name)) {
                partialMatches.push({ chat, priority: name.length, type: 'partial_name' });
                break;
              }
            }
          }
        }
      }

      let targetChat = null;
      if (exactMatches.length > 0) {
        exactMatches.sort((a, b) => a.priority - b.priority);
        targetChat = exactMatches[0].chat;
      } else if (partialMatches.length > 0) {
        partialMatches.sort((a, b) => b.priority - a.priority);
        targetChat = partialMatches[0].chat;
      }

      if (!targetChat) {
        return { 
          text: `❌ *Contact not found*\n\nCould not find a contact matching "${contactQuery}".\n\n💡 Tips:\n• Use the exact phone number (e.g., +919876543210)\n• Or use the contact's exact saved name\n• Make sure you have chatted with this contact before\n• Check the contact name spelling`, 
          private: isPrivate 
        };
      }

      let formattedMessage;
      if (fromMe) {
        formattedMessage = message;
      } else {
        formattedMessage = `📨 *Message from ${senderName}*\n\n${message}\n\n_— Sent via Datrix Bot_`;
      }

      await targetChat.sendMessage(formattedMessage);

      const recipientName = targetChat.name || targetChat.id.user;

      if (fromMe) {
        log('admin', `Message sent to ${recipientName}: ${message.substring(0, 50)}...`);
        return { 
          text: `✅ Sent to ${recipientName}: "${message.substring(0, 40)}${message.length > 40 ? '...' : ''}"`, 
          private: isPrivate 
        };
      } else {
        return { 
          text: `✅ *Message sent!*\n\nTo: *${recipientName}*\nMessage: _${message.substring(0, 50)}${message.length > 50 ? '...' : ''}_`, 
          private: isPrivate 
        };
      }

    } catch (error) {
      log('error', '!send command error: ' + error.message);
      return { 
        text: `⚠️ Failed to send message: ${error.message}`, 
        private: isPrivate 
      };
    }
  }, { 
    description: 'Send message to a contact',
    category: 'admin',
    adminOnly: true,
    usage: '[contact] [message]'
  });

  // 🤖 !reply — Auto-reply mode (admin only)
  registry.register('!reply', async (msg, args, context) => {
    const { isPrivate, chatId } = context;
    const { getReplyMode, setReplyMode } = require('../db');
    
    const subCommand = args ? args.trim().toLowerCase() : 'status';
    const currentMode = getReplyMode(chatId);

    if (subCommand === 'on') {
      setReplyMode(chatId, { enabled: true, groupMentions: currentMode.groupMentions });
      return { 
        text: '🤖 *Auto-Reply Enabled*\n\nI will now reply on your behalf when you don\'t respond for 2 hours in this chat.\n\n💡 Use `!reply group` to also reply when someone mentions you in groups.', 
        private: isPrivate 
      };
    }

    if (subCommand === 'off') {
      setReplyMode(chatId, { enabled: false, groupMentions: false });
      return { 
        text: '🛑 *Auto-Reply Disabled*\n\nI will no longer reply automatically in this chat.', 
        private: isPrivate 
      };
    }

    if (subCommand === 'group') {
      setReplyMode(chatId, { enabled: true, groupMentions: true });
      return { 
        text: '👥 *Group Mention Replies Enabled*\n\nI will reply when someone mentions "Abhi" or tags you in this group.\n\n💡 Use `!reply off` to disable all auto-replies.', 
        private: isPrivate 
      };
    }

    if (subCommand === 'status') {
      const status = currentMode.enabled ? '🟢 Enabled' : '🔴 Disabled';
      const groupStatus = currentMode.groupMentions ? '🟢 Group mentions on' : '⚪ Group mentions off';
      const lastReply = currentMode.lastAdminReply
        ? new Date(currentMode.lastAdminReply).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : 'Never';

      return { 
        text: `🤖 *Auto-Reply Status*\n\nMode: ${status}\n${context.isGroup ? groupStatus : ''}\nLast admin reply: ${lastReply}\n\nCommands:\n• \`!reply on\` — Enable auto-reply\n• \`!reply off\` — Disable auto-reply\n• \`!reply group\` — Enable group mention replies`, 
        private: isPrivate 
      };
    }

    return { 
      text: '❌ Invalid option.\n\nUsage: `!reply [on|off|group|status]`', 
      private: isPrivate 
    };
  }, { 
    description: 'Auto-reply mode',
    category: 'admin',
    adminOnly: true,
    usage: '[on|off|status|group]'
  });

  // !replyto — AI reply to specific person in group (admin only)
  registry.register('!replyto', async (msg, args, context) => {
    const { isPrivate, client, senderId } = context;
    const { askAI } = require('../ai');
    const { getUserPreference } = require('../db');
    
    if (!args) {
      return { 
        text: '❌ Missing arguments.\n\nUsage: `!replyto [group-name] [person-name] [instruction]`\n\nExamples:\n• `!replyto "Nana Ka Ghar" Rahul "give him a compliment"` (double quotes)\n• `!replyto \'Nana Ka Ghar🩷🩷\' Rahul cute boy` (single quotes)\n• `!replyto "Group Name" "Person Name" Hello there` (both quoted)\n\n💡 Use single quotes (\'Name\') or double quotes ("Name") for names with spaces.', 
        private: isPrivate 
      };
    }

    const parsedArgs = parseReplyToArgs(args);
    if (!parsedArgs) {
      return { 
        text: '❌ Invalid format.\n\nUsage: `!replyto [group-name] [person-name] [instruction]`\n\nExamples:\n• `!replyto "Nana Ka Ghar" Rahul "give him a compliment"`\n• `!replyto \'Nana Ka Ghar🩷🩷\' Rahul cute boy`\n• `!replyto "Group" "Person" Hello`\n\n💡 Use single or double quotes for names with spaces.', 
        private: isPrivate 
      };
    }

    const { groupName, personName, instruction } = parsedArgs;

    try {
      const chats = await client.getChats();
      const normalizedGroupName = groupName.toLowerCase();

      let targetGroup = null;
      for (const chat of chats) {
        if (chat.isGroup && chat.name) {
          if (chat.name.toLowerCase().includes(normalizedGroupName)) {
            targetGroup = chat;
            break;
          }
        }
      }

      if (!targetGroup) {
        return { 
          text: `❌ Group not found: "${groupName}"`, 
          private: isPrivate 
        };
      }

      const participants = targetGroup.participants || [];
      if (participants.length === 0) {
        return { 
          text: '❌ Could not retrieve group participants.', 
          private: isPrivate 
        };
      }

      const normalizedPersonName = personName.toLowerCase();
      let targetParticipant = null;
      let targetContact = null;

      for (const participant of participants) {
        const contact = await client.getContactById(participant.id._serialized);
        const contactName = contact.name || contact.pushname || '';
        const contactNumber = participant.id.user;

        if (
          contactName.toLowerCase().includes(normalizedPersonName) ||
          contactNumber.includes(personName)
        ) {
          targetParticipant = participant;
          targetContact = contact;
          break;
        }
      }

      if (!targetParticipant) {
        return { 
          text: `❌ Person not found: "${personName}" in group "${targetGroup.name}"`, 
          private: isPrivate 
        };
      }

      const targetName = targetContact.name || targetContact.pushname || targetParticipant.id.user;
      const personality = getUserPreference(senderId, 'personality') || 'default';
      const aiPrompt = `Generate a WhatsApp message to ${targetName}. ${instruction}. Keep it natural and conversational, suitable for a group chat. Do not use markdown formatting.`;
      const aiMessage = await askAI(aiPrompt, 'Admin', personality);

      const mentionId = targetParticipant.id._serialized;
      const mentionText = `@${targetParticipant.id.user}`;
      const finalMessage = `${mentionText} ${aiMessage}`;

      await targetGroup.sendMessage(finalMessage, { mentions: [mentionId] });

      log('admin', `Admin sent AI message to ${targetName} in ${targetGroup.name}: ${aiMessage.substring(0, 50)}...`);
      return { 
        text: `✅ *Message sent!*\n\nTo: *${targetName}* in *${targetGroup.name}*\nMessage: _${aiMessage.substring(0, 50)}${aiMessage.length > 50 ? '...' : ''}_`, 
        private: isPrivate 
      };

    } catch (error) {
      log('error', '!replyto command error: ' + error.message);
      return { 
        text: '⚠️ Failed to send message. Please try again.', 
        private: isPrivate 
      };
    }
  }, { 
    description: 'AI reply to person in group',
    category: 'admin',
    adminOnly: true,
    usage: '[group] [person] [instruction]'
  });

  // !proxy — Proxy chat mode (admin only)
  registry.register('!proxy', async (msg, args, context) => {
    const { isPrivate, client, senderId } = context;
    const { getProxySession, createProxySession, endProxySession } = require('../db');
    
    if (!args) {
      const activeSession = getProxySession(senderId);
      if (activeSession) {
        return { 
          text: `🔄 *Proxy Mode Active*\n\nYou are proxying messages to: *${activeSession.targetName}*\nStarted: ${new Date(activeSession.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\nCommands:\n• \_!proxy stop\_ — End proxy session\n• \_!proxy status\_ — Show session details\n\nJust send any message and it will be forwarded!`, 
          private: isPrivate 
        };
      }
      return { 
        text: '🔄 *Proxy Chat Mode*\n\nForward messages between you and another contact anonymously.\n\nUsage:\n• `!proxy start [contact-name]` — Start proxy session\n• `!proxy stop` — End proxy session\n• `!proxy status` — Check active session\n\nExample: `!proxy start mritunjay`\n\n⚠️ The target contact must have messaged the bot before.', 
        private: isPrivate 
      };
    }

    const proxyArgs = args.split(' ');
    const subCommand = proxyArgs[0].toLowerCase();

    // Start Proxy Session
    if (subCommand === 'start') {
      if (proxyArgs.length < 2) {
        return { 
          text: '❌ Please specify a contact name.\n\nUsage: `!proxy start [contact-name]`', 
          private: isPrivate 
        };
      }

      const contactQuery = proxyArgs.slice(1).join(' ').trim().replace(/[.!?,;:]+$/, '');

      const existingSession = getProxySession(senderId);
      if (existingSession) {
        return { 
          text: `⚠️ You already have an active proxy session with *${existingSession.targetName}*.\n\nUse \`!proxy stop\` to end it first.`, 
          private: isPrivate 
        };
      }

      try {
        const chats = await client.getChats();
        let targetChat = null;
        let exactMatch = null;
        let partialMatch = null;
        const normalizedQuery = contactQuery.toLowerCase();

        for (const chat of chats) {
          if (!chat.id._serialized.endsWith('@c.us')) continue;
          if (chat.id._serialized === senderId) continue;

          const chatName = (chat.name || '').toLowerCase();
          const chatNumber = chat.id.user.replace(/\D/g, '');
          const queryNumber = contactQuery.replace(/\D/g, '');

          if (chatName === normalizedQuery) {
            exactMatch = chat;
            break;
          }

          if (queryNumber && chatNumber === queryNumber) {
            exactMatch = chat;
            break;
          }

          if (!partialMatch && chatName.includes(normalizedQuery)) {
            partialMatch = chat;
            continue;
          }

          try {
            const contact = await chat.getContact();
            const pushname = (contact.pushname || '').toLowerCase();
            const contactName = (contact.name || '').toLowerCase();

            if (pushname === normalizedQuery || contactName === normalizedQuery) {
              exactMatch = chat;
              break;
            }

            if (!partialMatch && (pushname.includes(normalizedQuery) || contactName.includes(normalizedQuery))) {
              partialMatch = chat;
            }
          } catch (e) {
            // Continue searching
          }
        }

        targetChat = exactMatch || partialMatch;

        if (!targetChat) {
          return { 
            text: `❌ *Contact not found*\n\nCould not find "${contactQuery}".\n\n💡 Make sure you have chatted with this contact before.`, 
            private: isPrivate 
          };
        }

        const targetName = targetChat.name || targetChat.id.user;
        const sessionId = createProxySession(senderId, targetChat.id._serialized, targetName);

        if (!sessionId) {
          return { 
            text: '⚠️ Failed to create proxy session. Please try again.', 
            private: isPrivate 
          };
        }

        const introMessage = `📨 *Anonymous Message*\n\nYou have received a message from someone who wishes to remain anonymous.\n\nReply to this chat and your message will be forwarded back to them.\n\n_— Datrix Proxy Service_`;
        await targetChat.sendMessage(introMessage);

        return { 
          text: `🔄 *Proxy Session Started!*\n\nTarget: *${targetName}*\nSession ID: \`${sessionId}\`\n\n✅ Introduction message sent to recipient.\n\nNow just send any message and it will be forwarded anonymously!\n\nUse \`!proxy stop\` to end the session.`, 
          private: isPrivate 
        };

      } catch (error) {
        log('error', '!proxy start error: ' + error.message);
        return { 
          text: '⚠️ Failed to start proxy session. Please try again.', 
          private: isPrivate 
        };
      }
    }

    // Stop Proxy Session
    if (subCommand === 'stop') {
      const session = getProxySession(senderId);
      if (!session) {
        return { 
          text: 'ℹ️ You don\'t have an active proxy session.\n\nUse `!proxy start [contact-name]` to start one.', 
          private: isPrivate 
        };
      }

      try {
        const targetChat = await client.getChatById(session.targetId);
        if (targetChat) {
          await targetChat.sendMessage('🔚 The anonymous conversation has ended.\n\n_— Datrix Proxy Service_');
        }
      } catch (e) {
        // Target may have blocked or unavailable
      }

      endProxySession(senderId);
      return { 
        text: `🛑 *Proxy Session Ended*\n\nYour anonymous conversation with *${session.targetName}* has been closed.\n\nMessages will no longer be forwarded.`, 
        private: isPrivate 
      };
    }

    // Proxy Status
    if (subCommand === 'status') {
      const session = getProxySession(senderId);
      if (!session) {
        return { 
          text: 'ℹ️ No active proxy session.\n\nUse `!proxy start [contact-name]` to start one.', 
          private: isPrivate 
        };
      }

      const duration = Math.floor((Date.now() - session.startTime) / 60000);
      const durationStr = duration < 60 ? `${duration}m` : `${Math.floor(duration / 60)}h ${duration % 60}m`;

      return { 
        text: `🔄 *Proxy Session Status*\n\nTarget: *${session.targetName}*\nSession ID: \`${session.id}\`\nDuration: *${durationStr}*\nStatus: 🟢 Active\n\nUse \`!proxy stop\` to end the session.`, 
        private: isPrivate 
      };
    }

    return { 
      text: '❌ Unknown proxy command. Use: start, stop, or status', 
      private: isPrivate 
    };
  }, { 
    description: 'Anonymous proxy chat',
    category: 'admin',
    adminOnly: true,
    usage: '[start|stop|status] [contact]'
  });

  // 📊 !stats — Detailed admin statistics
  registry.register('!stats', async (msg, args, context) => {
    const { isPrivate } = context;
    
    const stats = getStats();
    const userStats = getUserStats();
    const uptimeHrs = Math.floor(stats.uptimeMs / 3600000);
    const uptimeMins = Math.floor((stats.uptimeMs % 3600000) / 60000);
    const tokens = getTokenUsage();
    const memUsage = process.memoryUsage();
    const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    return { 
      text: `📊 *Detailed Bot Statistics*

⏱️ Uptime: ${uptimeHrs}h ${uptimeMins}m
💬 Total Messages: ${stats.messagesHandled}
📅 Messages Today: ${stats.messagesToday}
👥 Unique Users: ${stats.userCount}
🔇 Muted Groups: ${stats.groupsMuted}
🧠 AI Requests: ${tokens.totalRequests}
🟢 Token Usage: ${tokens.promptTokens + tokens.completionTokens}
💾 Memory Usage: ${heapMB}MB
📈 Commands Used: ${userStats.totalCommands || 0}

🟢 Status: Online & Running`, 
      private: isPrivate 
    };
  }, { 
    description: 'Detailed bot statistics',
    category: 'admin',
    adminOnly: true
  });

  // 📊 !monitor — Message monitoring commands
  registry.register('!monitor', async (msg, args, context) => {
    const { isPrivate } = context;
    
    if (!args) {
      return { 
        text: `📊 *Message Monitoring Commands*

• \`!monitor on\` — Enable monitoring
• \`!monitor off\` — Disable monitoring
• \`!monitor status\` — Show monitoring status
• \`!monitor stats\` — Show captured statistics
• \`!monitor export <format> [days]\` — Export data (json/csv)
• \`!monitor clear <days>\` — Clear old data
• \`!monitor search <query>\` — Search messages
• \`!monitor calls [limit]\` — Show recent calls
• \`!monitor config <key> <value>\` — Update config

💡 Monitoring captures all messages, media, and calls for admin review.`, 
        private: isPrivate 
      };
    }

    const monitorArgs = args.split(' ');
    const subCommand = monitorArgs[0].toLowerCase();

    // Enable monitoring
    if (subCommand === 'on') {
      configureMonitor({ enabled: true });
      return { 
        text: '✅ Message monitoring *ENABLED*!\n\nAll messages will now be captured.', 
        private: isPrivate 
      };
    }

    // Disable monitoring
    if (subCommand === 'off') {
      configureMonitor({ enabled: false });
      return { 
        text: '⏸️ Message monitoring *DISABLED*.\n\nNo new messages will be captured.', 
        private: isPrivate 
      };
    }

    // Show status
    if (subCommand === 'status') {
      const config = getMonitorConfig();
      const statusText = config.enabled ? '🟢 *ENABLED*' : '🔴 *DISABLED*';
      let response = `📊 *Monitoring Status*\n\nStatus: ${statusText}\n\n*Capture Settings:*\n`;
      response += `• Text: ${config.captureText ? '✅' : '❌'}\n`;
      response += `• Images: ${config.captureImages ? '✅' : '❌'}\n`;
      response += `• Video: ${config.captureVideo ? '✅' : '❌'}\n`;
      response += `• Audio: ${config.captureAudio ? '✅' : '❌'}\n`;
      response += `• Stickers: ${config.captureStickers ? '✅' : '❌'}\n`;
      response += `• Documents: ${config.captureDocuments ? '✅' : '❌'}\n`;
      response += `• Locations: ${config.captureLocations ? '✅' : '❌'}\n`;
      response += `• Contacts: ${config.captureContacts ? '✅' : '❌'}\n`;
      response += `• Polls: ${config.capturePolls ? '✅' : '❌'}\n`;
      response += `• Groups: ${config.captureGroups ? '✅' : '❌'}\n`;
      response += `• DMs: ${config.captureDMs ? '✅' : '❌'}\n`;
      response += `• Status: ${config.captureStatus ? '✅' : '❌'}\n`;
      response += `\n💾 Save Media: ${config.saveMedia ? '✅' : '❌'}\n`;
      response += `🗑️ Retention: ${config.retentionDays} days`;
      return { text: response, private: isPrivate };
    }

    // Show statistics
    if (subCommand === 'stats') {
      const stats = getMonitorStats();
      let response = `📊 *Monitoring Statistics*\n\n`;
      response += `Status: ${stats.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n`;
      response += `Total Messages: ${stats.totalMessages.toLocaleString()}\n`;
      response += `Total Calls: ${stats.totalCalls.toLocaleString()}\n`;
      response += `Media Files: ${stats.mediaFiles.toLocaleString()}\n`;

      if (stats.typeCounts && Object.keys(stats.typeCounts).length > 0) {
        response += `\n*Message Types:*\n`;
        Object.entries(stats.typeCounts)
          .sort((a, b) => b[1] - a[1])
          .forEach(([type, count]) => {
            response += `• ${type}: ${count.toLocaleString()}\n`;
          });
      }

      if (stats.dailyCounts) {
        response += `\n*Last 7 Days Activity:*\n`;
        const sortedDates = Object.entries(stats.dailyCounts)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 7);
        sortedDates.forEach(([date, count]) => {
          response += `• ${date}: ${count} msgs\n`;
        });
      }

      return { text: response, private: isPrivate };
    }

    // Export data
    if (subCommand === 'export') {
      const format = monitorArgs[1] || 'json';
      const days = parseInt(monitorArgs[2], 10) || 7;

      if (!['json', 'csv'].includes(format)) {
        return { 
          text: '❌ Invalid format. Use: `json` or `csv`\nExample: `!monitor export json 7`', 
          private: isPrivate 
        };
      }

      const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);
      const filters = { startDate, page: 1, limit: 5000 };

      const messagesExport = exportData(format, { ...filters, dataType: 'messages' });
      const callsExport = exportData(format, { ...filters, dataType: 'calls' });

      const preview = messagesExport.length > 2000
        ? messagesExport.substring(0, 2000) + '\n\n... (truncated for display)'
        : messagesExport;

      let response = `📤 *Export Results (${format.toUpperCase()})*\n\n`;
      response += `Period: Last ${days} days\n\n`;
      response += `*Messages Preview:*\n${preview}\n\n`;
      response += `_Full data saved to console log._`;

      log('admin', '=== MONITORING EXPORT ===');
      log('admin', 'Messages: ' + messagesExport);
      log('admin', 'Calls: ' + callsExport);
      log('admin', '=== END EXPORT ===');

      return { text: response, private: isPrivate };
    }

    // Clear old data
    if (subCommand === 'clear') {
      const days = parseInt(monitorArgs[1], 10);
      if (isNaN(days) || days < 1) {
        return { 
          text: '❌ Please specify valid days.\nExample: `!monitor clear 7`', 
          private: isPrivate 
        };
      }

      const result = clearOldData();
      return {
        text: `🗑️ *Cleanup Complete*\n\nCleared ${result.totalCleared} items:\n` +
              `• Messages: ${result.clearedMessages}\n` +
              `• Calls: ${result.clearedCalls}\n` +
              `• Media: ${result.clearedMedia}`,
        private: isPrivate
      };
    }

    // Search messages
    if (subCommand === 'search') {
      const query = monitorArgs.slice(1).join(' ').trim();
      if (!query) {
        return { 
          text: '❌ Please provide a search query.\nExample: `!monitor search hello`', 
          private: isPrivate 
        };
      }

      const results = getMessages({ searchQuery: query, limit: 20 });

      if (results.messages.length === 0) {
        return { 
          text: `🔍 No messages found for: "${query}"`, 
          private: isPrivate 
        };
      }

      let response = `🔍 *Search Results for "${query}"*\n`;
      response += `Found ${results.total} messages:\n\n`;

      results.messages.forEach((m, idx) => {
        const date = new Date(m.timestamp).toLocaleDateString('en-IN');
        const preview = (m.body || '[No text]').substring(0, 50);
        response += `${idx + 1}. [${date}] ${m.senderName}: ${preview}${m.body?.length > 50 ? '...' : ''}\n`;
      });

      if (results.total > 20) {
        response += `\n_Showing first 20 of ${results.total} results_`;
      }

      return { text: response, private: isPrivate };
    }

    // Show recent calls
    if (subCommand === 'calls') {
      const limit = parseInt(monitorArgs[1], 10) || 10;
      const results = getCalls({ limit });

      if (results.calls.length === 0) {
        return { 
          text: '📞 No call records found.', 
          private: isPrivate 
        };
      }

      let response = `📞 *Recent Calls*\n\n`;

      results.calls.forEach((call, idx) => {
        const date = new Date(call.timestamp).toLocaleDateString('en-IN');
        const time = new Date(call.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const duration = call.duration > 0 ? ` (${Math.floor(call.duration / 60)}m ${call.duration % 60}s)` : '';
        const direction = call.direction === 'incoming' ? '📲' : '📞';
        const type = call.type === 'video' ? '📹' : '📞';
        const status = call.status === 'missed' ? '❌ Missed' : '✅ Completed';

        response += `${idx + 1}. ${type} ${direction} ${call.callerName}\n`;
        response += `   ${status}${duration} • ${date} ${time}\n`;
        if (call.chatName && call.chatName !== 'Unknown') {
          response += `   📍 ${call.chatName}\n`;
        }
        response += `\n`;
      });

      if (results.total > limit) {
        response += `\n_Showing ${limit} of ${results.total} calls_`;
      }

      return { text: response, private: isPrivate };
    }

    // Update config
    if (subCommand === 'config') {
      const key = monitorArgs[1];
      const value = monitorArgs[2];

      if (!key || !value) {
        return { 
          text: '❌ Usage: `!monitor config <key> <value>`\nExample: `!monitor config captureImages true`', 
          private: isPrivate 
        };
      }

      const config = getMonitorConfig();
      const boolValue = value.toLowerCase() === 'true';

      if (key === 'captureText') config.captureText = boolValue;
      else if (key === 'captureImages') config.captureImages = boolValue;
      else if (key === 'captureVideo') config.captureVideo = boolValue;
      else if (key === 'captureAudio') config.captureAudio = boolValue;
      else if (key === 'captureStickers') config.captureStickers = boolValue;
      else if (key === 'captureDocuments') config.captureDocuments = boolValue;
      else if (key === 'captureLocations') config.captureLocations = boolValue;
      else if (key === 'captureContacts') config.captureContacts = boolValue;
      else if (key === 'capturePolls') config.capturePolls = boolValue;
      else if (key === 'captureGroups') config.captureGroups = boolValue;
      else if (key === 'captureDMs') config.captureDMs = boolValue;
      else if (key === 'captureStatus') config.captureStatus = boolValue;
      else if (key === 'saveMedia') config.saveMedia = boolValue;
      else if (key === 'retentionDays') config.retentionDays = parseInt(value, 10);
      else {
        return { 
          text: `❌ Unknown config key: ${key}`, 
          private: isPrivate 
        };
      }

      configureMonitor(config);
      return { 
        text: `✅ Config updated: ${key} = ${value}`, 
        private: isPrivate 
      };
    }

    return { 
      text: '❌ Unknown monitor command. Use `!monitor` to see available commands.', 
      private: isPrivate 
    };
  }, { 
    description: 'Message monitoring control',
    category: 'admin',
    adminOnly: true,
    usage: '[on|off|status|stats|export|clear|search|calls|config]'
  });

  // 💾 !backup — Manual database backup (admin only)
  registry.register('!backup', async (msg, args, context) => {
    const { isPrivate, isAdmin } = context;
    const { createBackup, listBackups } = require('../db');
    
    // Create backup
    const backupFile = createBackup(true);
    
    if (backupFile) {
      const backups = listBackups();
      let backupList = '';
      backups.slice(0, 5).forEach((b, i) => {
        backupList += `${i + 1}. ${b.filename}\n`;
      });
      
      return { 
        text: `💾 *Backup Created!*\n\n` +
          `File: ${backupFile}\n\n` +
          `*Recent Backups:*\n${backupList}\n` +
          `Use \`!restore <filename>\` to restore a backup.`,
        private: isPrivate 
      };
    }
    return { 
      text: '❌ Failed to create backup.', 
      private: isPrivate 
    };
  }, { 
    description: 'Create database backup',
    category: 'admin',
    adminOnly: true
  });

  // ♻️ !restore — Restore from backup (admin only)
  registry.register('!restore', async (msg, args, context) => {
    const { isPrivate, isAdmin } = context;
    const { listBackups, restoreBackup } = require('../db');
    
    if (!args) {
      // Show available backups
      const backups = listBackups();
      if (backups.length === 0) {
        return { 
          text: '❌ No backups available.', 
          private: isPrivate 
        };
      }
      
      let response = '📋 *Available Backups:*\n\n';
      backups.forEach((b, i) => {
        response += `${i + 1}. ${b.filename}\n   ${b.timestamp}\n\n`;
      });
      response += 'Usage: `!restore <filename>`\n';
      response += 'Example: `!restore datastore_backup_2026-03-06_12-00-00.json`';
      
      return { text: response, private: isPrivate };
    }
    
    // Attempt restore
    const filename = args.trim();
    const success = restoreBackup(filename);
    
    if (success) {
      return { 
        text: `✅ *Database Restored!*\n\n` +
          `Restored from: ${filename}\n\n` +
          `⚠️ The bot will use the restored data. Restart if needed.`,
        private: isPrivate 
      };
    }
    return { 
      text: `❌ Failed to restore from: ${filename}\n` +
        `Use \`!restore\` to see available backups.`, 
      private: isPrivate 
    };
  }, { 
    description: 'Restore database from backup',
    category: 'admin',
    adminOnly: true,
    usage: '[filename]'
  });
}

module.exports = {
  registerAdminCommands,
  extractQuotedArg,
  parseSendArgs,
  parseReplyToArgs,
  executeBroadcast,
};
