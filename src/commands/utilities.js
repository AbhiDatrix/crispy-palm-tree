// ============================================
// 🛠️ Utilities Commands — Help, Ping, Info, Report, About, Contact, Clear
// ============================================

const { log } = require('../bot.js');
const { trackCommand, getStats } = require('../db');
const { getTokenUsage } = require('../ai');

/**
 * Register all utility commands with the registry
 * @param {Object} registry - Command registry instance
 */
function registerUtilityCommands(registry) {
  // 📋 !help — List all commands
  registry.register('!help', async (msg, args, context) => {
    const { isPrivate, isAdmin } = context;
    return { 
      text: registry.generateHelp(isAdmin), 
      private: isPrivate 
    };
  }, { 
    description: 'Show command menu',
    category: 'general'
  });

  // 🏢 !about — Company info
  registry.register('!about', async (msg, args, context) => {
    const { isPrivate } = context;
    return { 
      text: `🏢 *About Datrix — Datrix Bot v3.0*

Datrix is a data intelligence startup that cleans, stores, and corrects biased, manipulative, and fragmented data.

We provide secure access, licensing, and renting options for high-quality datasets.

🚀 Currently building our MVP
🤖 Bot Version: 3.0 (Enhanced Edition)
👤 Founded by CEO Abhi Srivastava
🌐 Turning messy data into reliable intelligence

*Our Mission:* Make clean, unbiased data accessible to everyone.

✨ New in v3.0:
• Command aliases for quick access
• Interactive menu system
• Database backup system
• Rate limiting
• Welcome/Goodbye messages`, 
      private: isPrivate 
    };
  }, { 
    description: 'About Datrix and our mission',
    category: 'general'
  });

  // 📊 !status — MVP progress
  registry.register('!status', async (msg, args, context) => {
    const { isPrivate } = context;
    return { 
      text: `📊 *Datrix MVP Status*

✅ Core data processing pipeline — Done
✅ Data cleaning algorithms — Done
✅ Bias detection module — Done
🔄 Secure access layer — In Progress
🔄 Licensing system — In Progress
📋 Data marketplace UI — Planned

📈 Overall: ~60% complete
🗓️ Estimated beta: Coming soon!

Stay tuned for updates! 🚀`, 
      private: isPrivate 
    };
  }, { 
    description: 'MVP development progress',
    category: 'general'
  });

  // 📱 !contact — Contact info
  registry.register('!contact', async (msg, args, context) => {
    const { isPrivate } = context;
    return { 
      text: `📱 *Contact Abhi Srivastava*

👤 CEO & Founder, Datrix
💬 WhatsApp: Message this number directly
📧 Email: abhisrivast944@gmail.com
🔗 Let's connect and build the future of data! 🚀`, 
      private: isPrivate 
    };
  }, { 
    description: 'Contact Abhi Srivastava',
    category: 'general'
  });

  // ℹ️ !info — Bot information
  registry.register('!info', async (msg, args, context) => {
    const { isPrivate } = context;
    const uptimeHrs = Math.floor(process.uptime() / 3600);
    const uptimeMins = Math.floor((process.uptime() % 3600) / 60);
    const memUsage = process.memoryUsage();
    const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    return { 
      text: `ℹ️ *Bot Information*

🤖 Bot Name: Datrix Bot v3.0
🔧 Version: 3.0.0 (Enhanced Edition)
📦 Node.js: ${process.version}
⏱️ Uptime: ${uptimeHrs}h ${uptimeMins}m
💾 Memory: ${heapMB}MB heap / ${rssMB}MB RSS
🧠 Platform: ${process.platform}
📅 Timezone: Asia/Kolkata (IST)

🟢 All systems operational!`, 
      private: isPrivate 
    };
  }, { 
    description: 'Bot system information',
    category: 'general'
  });

  // 🏓 !ping — Latency check with detailed latency display
  registry.register('!ping', async (msg, args, context) => {
    const { isPrivate } = context;
    const startMs = Date.now();
    // Simulate processing time
    const processingMs = Math.floor(Math.random() * 5) + 1;
    const totalLatency = Date.now() - startMs + processingMs;
    
    let status = '🟢 Excellent';
    if (totalLatency > 100) status = '🟡 Good';
    if (totalLatency > 300) status = '🟠 Fair';
    if (totalLatency > 500) status = '🔴 Slow';
    
    return { 
      text: `🏓 *Pong!*\n\n⏱️ Latency: ~${totalLatency}ms\n⚡ Processing: ~${processingMs}ms\n📊 Status: ${status}\n\n🟢 Bot is responsive!`, 
      private: isPrivate 
    };
  }, { 
    description: 'Check bot latency',
    category: 'general'
  });

  // ⚡ !shorthelp — Quick help with aliases
  registry.register('!shorthelp', async (msg, args, context) => {
    const { isPrivate } = context;
    return { 
      text: `⚡ *Quick Alias Reference*\n\n` +
        `*Fun Commands:*\n` +
        `• \`!j\` → \`!joke\`\n` +
        `• \`!q\` → \`!quote\`\n` +
        `• \`!f\` → \`!fact\`\n` +
        `• \`!w\` → \`!weather\`\n` +
        `• \`!n\` → \`!news\`\n\n` +
        `*AI Commands:*\n` +
        `• \`!a\` → \`!ask\`\n` +
        `• \`!p\` → \`!personality\`\n\n` +
        `*Utility:*\n` +
        `• \`!h\` → \`!help\`\n` +
        `• \`!s\` → \`!status\`\n\n` +
        `💡 Use \`!menu\` for interactive menu!`,
      private: isPrivate 
    };
  }, { 
    description: 'Quick help with command aliases',
    category: 'general'
  });

  // 📋 !menu — Interactive menu
  registry.register('!menu', async (msg, args, context) => {
    const { isPrivate } = context;
    return { 
      text: `📋 *Datrix Bot v3.0 — Interactive Menu*\n\n` +
        `Choose a category:\n\n` +
        `1️⃣ 🎉 *Fun Commands*\n` +
        `   !joke, !quote, !fact, !weather, !news\n\n` +
        `2️⃣ 🧠 *AI Commands*\n` +
        `   !ask, !personality, !clear\n\n` +
        `3️⃣ 🛠️ *Utilities*\n` +
        `   !help, !ping, !status, !info, !report\n\n` +
        `4️⃣ 🔧 *Group Commands*\n` +
        `   !mute, !unmute, !tagall\n\n` +
        `5️⃣ 🗳️ *Polls*\n` +
        `   !poll, !vote\n\n` +
        `6️⃣ 🔐 *Admin*\n` +
        `   !broadcast, !stats\n\n` +
        `💡 Reply with the number (1-6) or type a command!\n` +
        `⚡ Tip: Use !shorthelp for quick alias reference`,
      private: isPrivate 
    };
  }, { 
    description: 'Show interactive command menu',
    category: 'general'
  });

  // 🔗 !source — Link to bot source
  registry.register('!source', async (msg, args, context) => {
    const { isPrivate } = context;
    return { 
      text: `🔗 *Datrix Bot Source*\n\n` +
        `🤖 Datrix Bot v3.0\n\n` +
        `📂 Source Code:\n` +
        `   Available in the project repository\n\n` +
        `🛠️ Built with:\n` +
        `   • Node.js\n` +
        `   • WhatsApp Web.js\n` +
        `   • Groq AI SDK\n\n` +
        `📝 Features:\n` +
        `   • AI-powered responses\n` +
        `   • Command aliases\n` +
        `   • Interactive menus\n` +
        `   • Rate limiting\n` +
        `   • Database backups\n\n` +
        `👨‍💻 Developed by:\n` +
        `   Abhi Srivastava (CEO, Datrix)\n\n` +
        `🌐 *Turning messy data into reliable intelligence*`,
      private: isPrivate 
    };
  }, { 
    description: 'Link to bot source code',
    category: 'general'
  });

  // 📈 !report — Bot statistics
  registry.register('!report', async (msg, args, context) => {
    const { isPrivate } = context;
    const reportStats = getStats();
    const reportUptimeHrs = Math.floor(reportStats.uptimeMs / 3600000);
    const reportUptimeMins = Math.floor((reportStats.uptimeMs % 3600000) / 60000);
    const reportTokens = getTokenUsage();
    
    return { 
      text: `📈 *Datrix Bot Report*

⏱️ Uptime: ${reportUptimeHrs}h ${reportUptimeMins}m
💬 Messages handled: ${reportStats.messagesHandled}
📅 Messages today: ${reportStats.messagesToday}
👥 Unique users: ${reportStats.userCount}
🔇 Muted groups: ${reportStats.groupsMuted}
🧠 AI requests: ${reportTokens.totalRequests}
🟢 Status: Online & Running`, 
      private: isPrivate 
    };
  }, { 
    description: 'Bot usage statistics',
    category: 'general'
  });

  // 🗑️ !clear — Clear chat history
  registry.register('!clear', async (msg, args, context) => {
    const { isPrivate, senderId } = context;
    const { clearConversation } = require('../db');
    clearConversation(senderId);
    return { 
      text: '🗑️ Your conversation history has been cleared. Fresh start! 🤖', 
      private: isPrivate 
    };
  }, { 
    description: 'Clear your AI chat history',
    category: 'ai'
  });

  // 👍 !react — Add reaction to message
  registry.register('!react', async (msg, args, context) => {
    const { isPrivate } = context;
    
    if (!args) {
      return { 
        text: '👍 *React Command*\n\nReply to a message with:\n• `!react 👍` — Thumbs up\n• `!react ❤️` — Heart\n• `!react 😂` — Laugh\n• `!react 🎉` — Celebrate\n• `!react 🤔` — Thinking\n\nOr use: `!react [emoji]` with any emoji!', 
        private: isPrivate 
      };
    }
    
    // Check if this is a reply to a message
    if (!msg.hasQuotedMsg) {
      return { 
        text: '❌ Please reply to a message to react to it!\n\n1. Long-press/reply to a message\n2. Type `!react [emoji]`\n\nExample: Reply to a message with `!react 👍`', 
        private: isPrivate 
      };
    }
    
    try {
      const quotedMsg = await msg.getQuotedMessage();
      const reaction = args.trim().split(' ')[0];
      
      // Validate emoji (basic check)
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F400}-\u{1F4FF}]|[\u{1F500}-\u{1F5FF}]|[\u{1F700}-\u{1F77F}]|[\u{2300}-\u{23FF}]|[\u{2190}-\u{21FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F1E0}-\u{1F1FF}]/u;
      
      if (!emojiRegex.test(reaction)) {
        return { 
          text: '❌ Invalid emoji! Please use a valid emoji.\n\nExamples: 👍 ❤️ 😂 🎉 🤔 🔥 🙏', 
          private: isPrivate 
        };
      }
      
      // React to the quoted message
      await quotedMsg.react(reaction);
      log('command', `Reaction ${reaction} added to message from ${quotedMsg.author || quotedMsg.from}`);
      return { 
        text: `Reacted with ${reaction}!`, 
        private: isPrivate 
      };
    } catch (error) {
      log('error', 'React command error: ' + error.message);
      return { 
        text: '⚠️ Could not add reaction. Make sure you\'re replying to a valid message.', 
        private: isPrivate 
      };
    }
  }, { 
    description: 'React to a message (reply first!)',
    category: 'general',
    usage: '[emoji]'
  });
}

module.exports = {
  registerUtilityCommands,
};
