// ============================================
// 🔧 Group Management Commands — Mute, Unmute, Tagall, Kick, Promote, Demote, Welcome, Goodbye
// ============================================

const { log } = require('../bot.js');
const { muteGroup, unmuteGroup, setWelcomeMessage, getWelcomeMessage, setGoodbyeMessage, getGoodbyeMessage, isWelcomeEnabled, setWelcomeEnabled, isGoodbyeEnabled, setGoodbyeEnabled } = require('../db');

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
 * Register all group management commands with the registry
 * @param {Object} registry - Command registry instance
 */
function registerGroupManagementCommands(registry) {
  // 🔇 !mute — Silence in group
  registry.register('!mute', async (msg, args, context) => {
    const { isPrivate, isGroup, chatId } = context;
    
    if (!isGroup) {
      return { 
        text: '🔇 This command only works in groups.', 
        private: isPrivate 
      };
    }
    
    if (muteGroup(chatId)) {
      return { 
        text: '🔇 Bot muted in this group. Use `!unmute` to resume.', 
        private: isPrivate 
      };
    }
    return { 
      text: '🔇 This group is already muted.', 
      private: isPrivate 
    };
  }, { 
    description: 'Silence bot in this group',
    category: 'group',
    groupOnly: true
  });

  // 🔊 !unmute — Resume in group
  registry.register('!unmute', async (msg, args, context) => {
    const { isPrivate, isGroup, chatId } = context;
    
    if (!isGroup) {
      return { 
        text: '🔊 This command only works in groups.', 
        private: isPrivate 
      };
    }
    
    if (unmuteGroup(chatId)) {
      return { 
        text: '🔊 Bot unmuted! I\'m back and listening. 🤖', 
        private: isPrivate 
      };
    }
    return { 
      text: '🔊 This group isn\'t muted.', 
      private: isPrivate 
    };
  }, { 
    description: 'Resume bot replies',
    category: 'group',
    groupOnly: true
  });

  // 🏷️ !tagall — Mention all members (admin only)
  registry.register('!tagall', async (msg, args, context) => {
    const { isPrivate, isGroup, isAdmin, chatId } = context;
    
    if (!isGroup) {
      return { 
        text: '👥 This command only works in groups.', 
        private: isPrivate 
      };
    }
    
    try {
      const chat = await msg.getChat();
      if (!chat.isGroup) {
        return { 
          text: '❌ This command only works in groups.', 
          private: isPrivate 
        };
      }

      const participants = chat.participants || [];
      if (participants.length === 0) {
        return { 
          text: '❌ Could not retrieve group participants.', 
          private: isPrivate 
        };
      }

      let tagMessage = args ? `📢 *Announcement:*\n\n${args}\n\n` : '📢 *Attention everyone!*\n\n';

      const mentions = [];
      participants.forEach(participant => {
        const id = participant.id._serialized;
        mentions.push(id);
        tagMessage += `@${id.split('@')[0]} `;
      });

      await msg.reply(tagMessage, null, { mentions });
      log('command', `Tagall sent to ${participants.length} members in ${chat.name}`);
      return null; // Message already sent directly
    } catch (error) {
      log('error', 'Tagall error: ' + error.message);
      return { 
        text: '⚠️ Failed to tag all members. Please try again.', 
        private: isPrivate 
      };
    }
  }, { 
    description: 'Mention all members',
    category: 'admin',
    adminOnly: true,
    groupOnly: true,
    usage: '[message]'
  });

  // 👢 !kick — Admin only group management
  registry.register('!kick', async (msg, args, context) => {
    const { isPrivate, isGroup, isAdmin } = context;
    
    if (!isGroup) {
      return { 
        text: '👥 This command only works in groups.', 
        private: isPrivate 
      };
    }
    
    if (!args || !args.includes('@')) {
      return { 
        text: '❌ Please mention the user to kick. Example: `!kick @username`', 
        private: isPrivate 
      };
    }
    
    try {
      const chat = await msg.getChat();
      if (!chat.isGroup) {
        return { 
          text: '❌ This command only works in groups.', 
          private: isPrivate 
        };
      }
      // Note: whatsapp-web.js doesn't support kicking directly without admin privileges
      // This is a placeholder for when the feature becomes available
      return { 
        text: '⚠️ Kick functionality requires admin privileges. Please use WhatsApp directly to remove members.', 
        private: isPrivate 
      };
    } catch (error) {
      log('error', 'Kick error: ' + error.message);
      return { 
        text: '⚠️ Failed to process kick command.', 
        private: isPrivate 
      };
    }
  }, { 
    description: 'Remove user from group',
    category: 'admin',
    adminOnly: true,
    groupOnly: true,
    usage: '@user'
  });

  // ⬆️ !promote — Admin only
  registry.register('!promote', async (msg, args, context) => {
    const { isPrivate, isGroup } = context;
    
    if (!isGroup) {
      return { 
        text: '👥 This command only works in groups.', 
        private: isPrivate 
      };
    }
    
    if (!args || !args.includes('@')) {
      return { 
        text: '❌ Please mention the user to promote. Example: `!promote @username`', 
        private: isPrivate 
      };
    }
    
    return { 
      text: '⚠️ Promote functionality requires group admin privileges. Please use WhatsApp directly to promote members.', 
      private: isPrivate 
    };
  }, { 
    description: 'Make user admin',
    category: 'admin',
    adminOnly: true,
    groupOnly: true,
    usage: '@user'
  });

  // ⬇️ !demote — Admin only
  registry.register('!demote', async (msg, args, context) => {
    const { isPrivate, isGroup } = context;
    
    if (!isGroup) {
      return { 
        text: '👥 This command only works in groups.', 
        private: isPrivate 
      };
    }
    
    if (!args || !args.includes('@')) {
      return { 
        text: '❌ Please mention the user to demote. Example: `!demote @username`', 
        private: isPrivate 
      };
    }
    
    return { 
      text: '⚠️ Demote functionality requires group admin privileges. Please use WhatsApp directly to demote members.', 
      private: isPrivate 
    };
  }, { 
    description: 'Remove admin rights',
    category: 'admin',
    adminOnly: true,
    groupOnly: true,
    usage: '@user'
  });

  // 👋 !welcome — Set welcome message
  registry.register('!welcome', async (msg, args, context) => {
    const { isPrivate, isGroup, chatId, isAdmin } = context;
    
    if (!isGroup) {
      return { 
        text: '👋 This command only works in groups.', 
        private: isPrivate 
      };
    }
    
    if (!args) {
      // Show current welcome settings
      const enabled = isWelcomeEnabled(chatId);
      const message = getWelcomeMessage(chatId);
      return { 
        text: `👋 *Welcome Settings*\n\n` +
          `Status: ${enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
          `Message: ${message || '(none set)'}\n\n` +
          `*Usage:*\n` +
          `• \`!welcome <message>\` — Set welcome message\n` +
          `• \`!welcome on\` — Enable welcome\n` +
          `• \`!welcome off\` — Disable welcome\n\n` +
          `*Variables:* \`{name}\`, \`{phone}\`, \`{group}\``,
        private: isPrivate 
      };
    }
    
    const arg = args.toLowerCase().trim();
    
    if (arg === 'on') {
      setWelcomeEnabled(chatId, true);
      return { 
        text: '✅ Welcome messages enabled!', 
        private: isPrivate 
      };
    }
    
    if (arg === 'off') {
      setWelcomeEnabled(chatId, false);
      return { 
        text: '❌ Welcome messages disabled.', 
        private: isPrivate 
      };
    }
    
    // Set welcome message
    setWelcomeMessage(chatId, args);
    setWelcomeEnabled(chatId, true);
    return { 
      text: `✅ Welcome message set!\n\n${args}\n\nVariables: {name}, {phone}, {group}`,
      private: isPrivate 
    };
  }, { 
    description: 'Set welcome message for group',
    category: 'group',
    adminOnly: true,
    groupOnly: true,
    usage: '<message> | on | off'
  });

  // 👋 !goodbye — Set goodbye message
  registry.register('!goodbye', async (msg, args, context) => {
    const { isPrivate, isGroup, chatId, isAdmin } = context;
    
    if (!isGroup) {
      return { 
        text: '👋 This command only works in groups.', 
        private: isPrivate 
      };
    }
    
    if (!args) {
      // Show current goodbye settings
      const enabled = isGoodbyeEnabled(chatId);
      const message = getGoodbyeMessage(chatId);
      return { 
        text: `👋 *Goodbye Settings*\n\n` +
          `Status: ${enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
          `Message: ${message || '(none set)'}\n\n` +
          `*Usage:*\n` +
          `• \`!goodbye <message>\` — Set goodbye message\n` +
          `• \`!goodbye on\` — Enable goodbye\n` +
          `• \`!goodbye off\` — Disable goodbye\n\n` +
          `*Variables:* \`{name}\`, \`{phone}\`, \`{group}\``,
        private: isPrivate 
      };
    }
    
    const arg = args.toLowerCase().trim();
    
    if (arg === 'on') {
      setGoodbyeEnabled(chatId, true);
      return { 
        text: '✅ Goodbye messages enabled!', 
        private: isPrivate 
      };
    }
    
    if (arg === 'off') {
      setGoodbyeEnabled(chatId, false);
      return { 
        text: '❌ Goodbye messages disabled.', 
        private: isPrivate 
      };
    }
    
    // Set goodbye message
    setGoodbyeMessage(chatId, args);
    setGoodbyeEnabled(chatId, true);
    return { 
      text: `✅ Goodbye message set!\n\n${args}\n\nVariables: {name}, {phone}, {group}`,
      private: isPrivate 
    };
  }, { 
    description: 'Set goodbye message for group',
    category: 'group',
    adminOnly: true,
    groupOnly: true,
    usage: '<message> | on | off'
  });
}

module.exports = {
  registerGroupManagementCommands,
  extractQuotedArg,
};
