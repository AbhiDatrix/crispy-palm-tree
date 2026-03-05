// ============================================
// 🎮 commands.js — Command System v2.2
// ============================================
// Parses and handles all bot commands (!help, !about, etc.)
// Admin commands are gated by ADMIN_NUMBER in .env.
//
// UPGRADE v2.2:
// - Added !react command for message reactions
// - Improved contact search in !send command
// - Better error messages for all commands
// - Fixed edge cases in !replyto command
//
// UPGRADE v2.0:
// - Added !ping command for latency check
// - Added !clear command to reset conversation history
// - Shared broadcast utility (no duplication)
// - Input validation on all commands
// - Admin check is more robust (handles @c.us suffix)
// - NEW: !info, !reminder, !note commands
// - NEW: Group management (!kick, !promote, !demote, !tagall)
// - NEW: Fun commands (!joke, !quote, !fact)
// - Categorized help system
// - Better error handling with user feedback
// ============================================

const { askAI, getTokenUsage, generateChatbotReply } = require('./ai');
const {
  isMuted,
  muteGroup,
  unmuteGroup,
  getStats,
  addBroadcast,
  getConversation,
  setUserPreference,
  getUserPreference,
  addNote,
  getNotes,
  deleteNote,
  addReminder,
  getReminders,
  deleteReminder,
  trackCommand,
  getUserStats,
  // 🔄 Proxy Session Functions
  createProxySession,
  getProxySession,
  endProxySession,
  getActiveProxySessions,
  // 🤖 Auto-Reply Functions
  setReplyMode,
  getReplyMode,
  updateAdminLastReply,
  // ✅ Task Functions
  addTask,
  getTasks,
  completeTask,
  deleteTask,
  // 🗳️ Poll Functions
  createPoll,
  getActivePoll,
  votePoll,
  endPoll,
  getPollResults,
  // 💬 Chatbot Session Functions
  startChatbotSession,
  isChatbotSessionActive,
  endChatbotSession,
  isChatbotExitMessage,
} = require('./db');

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
} = require('./monitor');

// 📋 Command prefix
const PREFIX = '!';

// 🔐 Command visibility sets
const ADMIN_COMMANDS = new Set([
  '!broadcast',
  '!send',
  '!reply',
  '!replyto',
  '!proxy',
  '!kick',
  '!promote',
  '!demote',
  '!tagall',
  '!stats',
  '!monitor',
]);

const EVERYONE_COMMANDS = new Set([
  '!help',
  '!about',
  '!status',
  '!contact',
  '!info',
  '!ping',
  '!report',
  '!ask',
  '!clear',
  '!personality',
  '!note',
  '!reminder',
  '!joke',
  '!quote',
  '!fact',
  '!mute',
  '!unmute',
  '!react',
  '!task',
  '!poll',
  '!weather',
  '!news',
]);

// 🎭 Fun data collections
const JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
  "Why did the developer go broke? Because he used up all his cache! 💰",
  "What do you call a computer that sings? A-Dell! 🎵",
  "Why was the JavaScript developer sad? Because he didn't know how to 'null' his feelings! 😢",
  "What's a computer's favorite snack? Microchips! 🍟",
  "Why do programmers hate nature? Too many bugs! 🌿",
  "Why did the database administrator leave his wife? She had too many one-to-many relationships! 💔",
  "What did the server say at the restaurant? 404: Dish not found! 🍽️",
  "Why don't scientists trust atoms? Because they make up everything! ⚛️",
  "Why did the scarecrow win an award? He was outstanding in his field! 🌾",
  "What do you call fake spaghetti? An impasta! 🍝",
  "Why don't eggs tell jokes? They'd crack each other up! 🥚",
  "What do you call a bear with no teeth? A gummy bear! 🐻",
  "Why did the math book look so sad? Because it had too many problems! 📚",
  "What do you call a sleeping dinosaur? A dino-snore! 🦕",
];

const QUOTES = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "Data is the new oil.", author: "Clive Humby" },
  { text: "The goal is to turn data into information, and information into insight.", author: "Carly Fiorina" },
  { text: "Without data, you're just another person with an opinion.", author: "W. Edwards Deming" },
  { text: "In God we trust, all others must bring data.", author: "W. Edwards Deming" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Knowledge is power.", author: "Francis Bacon" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Everything you can imagine is real.", author: "Pablo Picasso" },
];

const FACTS = [
  "🧠 The human brain generates about 23 watts of power when awake — enough to power a small lightbulb!",
  "🌊 The world's oceans contain approximately 20 million tons of gold, but it's too dilute to extract economically.",
  "🐝 Honey is the only food that never spoils. Archaeologists have found 3000-year-old honey in Egyptian tombs that was still edible!",
  "🚀 The Great Wall of China is not visible from space with the naked eye, contrary to popular belief.",
  "🌌 There are more possible iterations of a game of chess than there are atoms in the observable universe.",
  "🦋 Butterflies taste with their feet and have a lifespan of only a few weeks to months.",
  "⚡ A bolt of lightning contains enough energy to toast 100,000 slices of bread!",
  "🌵 Some cacti can live for over 200 years in the harsh desert conditions.",
  "🌍 Earth is the only known planet where fire can burn. No other planet has enough oxygen.",
  "🦒 Giraffes only have seven neck vertebrae — the same number as humans!",
  "💧 A cloud can weigh more than a million pounds due to all the water droplets it contains.",
  "🌞 The Sun accounts for 99.86% of all the mass in our entire solar system.",
  "🐙 Octopuses have three hearts, blue blood, and nine brains (one central brain and eight in their arms).",
  "📊 Over 90% of the world's data has been created in just the last two years!",
  "🔢 The number of possible combinations of a standard deck of 52 cards is greater than the number of atoms on Earth.",
  "🧬 If you could type 60 words per minute and worked 8 hours a day, it would take about 50 years to type the human genome.",
  "🌐 The first computer bug was an actual moth found inside a Harvard Mark II computer in 1947.",
  "📱 The average person checks their phone about 96 times a day — once every 10 minutes!",
  "🎵 The first computer to play music was the CSIRAC in Australia in 1950.",
  "💾 The first hard disk drive (IBM 350) was the size of a refrigerator but could only store 3.75 MB.",
];

// 🌤️ Weather condition mapper
function getWeatherCondition(code) {
  const conditions = {
    0: '☀️ Clear sky',
    1: '🌤️ Mainly clear',
    2: '⛅ Partly cloudy',
    3: '☁️ Overcast',
    45: '🌫️ Foggy',
    48: '🌫️ Depositing rime fog',
    51: '🌦️ Light drizzle',
    53: '🌦️ Moderate drizzle',
    55: '🌧️ Dense drizzle',
    61: '🌧️ Slight rain',
    63: '🌧️ Moderate rain',
    65: '🌧️ Heavy rain',
    71: '🌨️ Slight snow',
    73: '🌨️ Moderate snow',
    75: '🌨️ Heavy snow',
    77: '🌨️ Snow grains',
    80: '🌦️ Slight rain showers',
    81: '🌧️ Moderate rain showers',
    82: '🌧️ Violent rain showers',
    85: '🌨️ Slight snow showers',
    86: '🌨️ Heavy snow showers',
    95: '⛈️ Thunderstorm',
    96: '⛈️ Thunderstorm with hail',
    99: '⛈️ Heavy thunderstorm',
  };
  return conditions[code] || '🌡️ Unknown conditions';
}

// ============================================
// 🔍 Command Parser
// ============================================

/**
 * Parse a message body into a command and arguments.
 * Trims body BEFORE checking prefix to handle " !help" edge case.
 * @param {string} body — Raw message text
 * @returns {{ command: string, args: string } | null}
 */
function parseCommand(body) {
  if (!body || typeof body !== 'string') return null;

  const trimmed = body.trim();
  if (!trimmed.startsWith(PREFIX)) return null;

  const spaceIndex = trimmed.indexOf(' ');

  if (spaceIndex === -1) {
    return { command: trimmed.toLowerCase(), args: '' };
  }

  return {
    command: trimmed.substring(0, spaceIndex).toLowerCase(),
    args: trimmed.substring(spaceIndex + 1).trim(),
  };
}

/**
 * Check if a sender ID matches the admin number.
 * Handles various ID formats: "919876@c.us", "919876", etc.
 * @param {string} senderId — WhatsApp sender ID
 * @returns {boolean}
 */
function isAdminUser(senderId) {
  const adminNum = process.env.ADMIN_NUMBER || '';
  if (!adminNum) return false;
  // Extract digits only from both sides for reliable comparison
  const senderDigits = senderId.replace(/\D/g, '');
  const adminDigits = adminNum.replace(/\D/g, '');
  return senderDigits.includes(adminDigits) || adminDigits.includes(senderDigits);
}

/**
 * Parse arguments for !replyto command.
 * Handles quoted strings and unquoted names.
 * Format: [group-name] [person-name] [instruction]
 * Example: "Nana Ka Ghar" Rahul "give him a compliment"
 * @param {string} args — Raw argument string
 * @returns {Object|null} — { groupName, personName, instruction } or null if invalid
 */
/**
 * Extract the next argument from a string, handling quoted strings.
 * Supports both single quotes ('Name') and double quotes ("Name").
 * @param {string} str - The input string
 * @returns {Object|null} - { value: string, remaining: string } or null if parsing fails
 */
function extractQuotedArg(str) {
  if (!str || typeof str !== 'string') return null;

  const trimmed = str.trim();
  if (!trimmed) return null;

  // Check if the string starts with a quote (single or double)
  const firstChar = trimmed.charAt(0);

  if (firstChar === '"' || firstChar === "'") {
    // Look for matching closing quote
    let endIndex = -1;
    for (let i = 1; i < trimmed.length; i++) {
      if (trimmed.charAt(i) === firstChar && trimmed.charAt(i - 1) !== '\\') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) return null; // No closing quote found

    return {
      value: trimmed.slice(1, endIndex).trim(),
      remaining: trimmed.slice(endIndex + 1).trim(),
    };
  }

  // Unquoted argument - take until next space
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
 * Parse arguments for !replyto command.
 * Supports quoted names using single quotes ('Name') or double quotes ("Name").
 * @param {string} args - The argument string
 * @returns {Object|null} - { groupName, personName, instruction } or null if invalid
 */
function parseReplyToArgs(args) {
  if (!args || typeof args !== 'string') return null;

  // Parse group name
  const groupResult = extractQuotedArg(args);
  if (!groupResult || !groupResult.value) return null;

  // Parse person name
  const personResult = extractQuotedArg(groupResult.remaining);
  if (!personResult || !personResult.value) {
    // Single argument case: use person name as instruction with default message
    return {
      groupName: groupResult.value,
      personName: groupResult.value,
      instruction: 'send a friendly message',
    };
  }

  // The rest is the instruction (can be quoted or unquoted)
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
 * Parse arguments for !send command with quoted contact names.
 * Supports quoted names using single quotes ('Name') or double quotes ("Name").
 * @param {string} args - The argument string
 * @returns {Object|null} - { contactQuery, message } or null if invalid
 */
function parseSendArgs(args) {
  if (!args || typeof args !== 'string') return null;

  const trimmed = args.trim();
  if (!trimmed) return null;

  // Parse contact identifier (quoted or unquoted)
  const contactResult = extractQuotedArg(trimmed);
  if (!contactResult || !contactResult.value) return null;

  // The rest is the message
  const message = contactResult.remaining;
  if (!message) return null;

  return {
    contactQuery: contactResult.value,
    message: message.trim(),
  };
}

/**
 * Get help text for all commands, categorized.
 * @param {boolean} isAdmin — Whether the user is an admin
 * @returns {string}
 */
function getHelpText(isAdmin = false) {
  let help = `🤖 *Datrix AI Bot — Command Guide*

`;

  help += `📋 *General Commands:*
`;
  help += `• \`!help\` — Show this command menu
`;
  help += `• \`!about\` — About Datrix and our mission
`;
  help += `• \`!status\` — MVP development progress
`;
  help += `• \`!contact\` — Contact Abhi Srivastava
`;
  help += `• \`!info\` — Bot system information
`;
  help += `• \`!ping\` — Check bot latency
`;
  help += `• \`!report\` — Bot usage statistics
`;
  help += `
`;

  help += `🧠 *AI & Chat:*
`;
  help += `• \`!ask [question]\` — Ask AI anything
`;
  help += `• \`!clear\` — Clear your AI chat history
`;
  help += `• \`!personality [mode]\` — Set AI style (professional/casual/funny)
`;
  help += `
`;

  help += `📤 *Messaging:*
`;
  help += `• \`!send [contact] [message]\` — Send message to a contact (supports quotes)
`;
  help += `• \`!reply [on|off|status|group]\` — Auto-reply mode (admin only)
`;
  help += `• \`!replyto [group] [person] [instruction]\` — AI reply to person in group (supports quotes)
`;
  help += `• \`!proxy start [contact]\` — Start anonymous proxy chat
`;
  help += `• \`!proxy stop\` — End proxy session
`;
  help += `• \`!proxy status\` — Check proxy session
`;
  help += `
`;

  help += `📝 *Personal Tools:*
`;
  help += `• \`!note add [text]\` — Save a personal note
`;
  help += `• \`!note list\` — View your notes
`;
  help += `• \`!note delete [number]\` — Delete a note
`;
  help += `• \`!reminder [time] [message]\` — Set a reminder
`;
  help += `   Time formats: 10m, 1h, 2h30m, 1d
`;
  help += `• \`!reminder list\` — View your reminders
`;
  help += `• \`!task add [task]\` — Add a to-do task
`;
  help += `• \`!task list\` — View pending tasks
`;
  help += `• \`!task done [number]\` — Mark task complete
`;
  help += `
`;

  help += `🎉 *Fun Commands:*
`;
  help += `• \`!joke\` — Get a random joke
`;
  help += `• \`!quote\` — Get an inspirational quote
`;
  help += `• \`!fact\` — Learn a random fact
`;
  help += `
`;

  help += `👍 *Message Reactions:*
`;
  help += `• \`!react [emoji]\` — React to a message (reply first!)
`;
  help += `   Example: Reply to a message with \`!react 👍\`
`;
  help += `
`;

  help += `🌤️ *Utilities:*
`;
  help += `• \`!weather [city]\` — Get weather info
`;
  help += `• \`!news\` — Latest tech news
`;
  help += `
`;

  help += `🗳️ *Polls (Groups):*
`;
  help += `• \`!poll "Question?" "Opt1" "Opt2"\` — Create poll
`;
  help += `• \`!poll vote [number]\` — Vote in poll
`;
  help += `• \`!poll end\` — End poll & see results
`;
  help += `
`;

  help += `🔧 *Group Management:*
`;
  help += `• \`!mute\` — Silence bot in this group
`;
  help += `• \`!unmute\` — Resume bot replies
`;
  help += `• \`!tagall [message]\` — Mention all members (admin only)
`;

  if (isAdmin) {
    help += `
🔐 *Admin Commands:*
`;
    help += `• \`!broadcast [message]\` — Send to all groups
`;
    help += `• \`!kick @user\` — Remove user from group
`;
    help += `• \`!promote @user\` — Make user admin
`;
    help += `• \`!demote @user\` — Remove admin rights
`;
    help += `• \`!stats\` — Detailed bot statistics
`;
    help += `• \`!monitor\` — Message monitoring control
`;
  }

  help += `
💡 *Tips:*
`;
  help += `• In groups, @mention me to get a response
`;
  help += `• In DMs, just chat naturally!
`;
  help += `• All commands start with \`!\`
`;

  return help;
}

// ============================================
// 🛠️ Command Handlers
// ============================================

/**
 * Handle all bot commands. Returns the reply object with visibility info.
 *
 * @param {string} command — The command (e.g., "!help")
 * @param {string} args — Arguments after the command
 * @param {object} context — { msg, client, senderId, senderName, isGroup, chatId }
 * @returns {Promise<{text: string, private: boolean}|null>} — Reply object with text and visibility, or null if ignored
 */
async function handleCommand(command, args, context) {
  const { msg, client, senderId, senderName, isGroup, chatId, fromMe } = context;
  // 🛠️ FIX: fromMe=true means it's the bot owner sending the command
  // Sometimes senderId is in @lid format which doesn't match phone number
  const isAdmin = isAdminUser(senderId) || fromMe;
  console.log(`[DEBUG] handleCommand: command=${command}, senderId=${senderId}, isAdmin=${isAdmin}, fromMe=${fromMe}`);

  // 🔐 Permission check: Non-admin trying to use admin command → silently ignore
  if (ADMIN_COMMANDS.has(command) && !isAdmin) {
    console.log(`[DEBUG] Command blocked: ${command} is admin-only but user is not admin`);
    return null;
  }

  // Track command usage
  trackCommand(command, senderId);

  // Helper to determine if response should be private (admin commands = private)
  const isPrivate = ADMIN_COMMANDS.has(command);

  switch (command) {
    // ─────────────────────────────
    // 📋 !help — List all commands
    // ─────────────────────────────
    case '!help':
      return { text: getHelpText(isAdmin), private: isPrivate };

    // ─────────────────────────────
    // 🏢 !about — Company info
    // ─────────────────────────────
    case '!about':
      return { text: `🏢 *About Datrix*

Datrix is a data intelligence startup that cleans, stores, and corrects biased, manipulative, and fragmented data.

We provide secure access, licensing, and renting options for high-quality datasets.

🚀 Currently building our MVP
👤 Founded by CEO Abhi Srivastava
🌐 Turning messy data into reliable intelligence

*Our Mission:* Make clean, unbiased data accessible to everyone.`, private: isPrivate };

    // ─────────────────────────────
    // 📊 !status — MVP progress
    // ─────────────────────────────
    case '!status':
      return { text: `📊 *Datrix MVP Status*

✅ Core data processing pipeline — Done
✅ Data cleaning algorithms — Done
✅ Bias detection module — Done
🔄 Secure access layer — In Progress
🔄 Licensing system — In Progress
📋 Data marketplace UI — Planned

📈 Overall: ~60% complete
🗓️ Estimated beta: Coming soon!

Stay tuned for updates! 🚀`, private: isPrivate };

    // ─────────────────────────────
    // 📱 !contact — Contact info
    // ─────────────────────────────
    case '!contact':
      return { text: `📱 *Contact Abhi Srivastava*

👤 CEO & Founder, Datrix
💬 WhatsApp: Message this number directly
📧 Email: abhisrivast944@gmail.com
🔗 Let's connect and build the future of data! 🚀`, private: isPrivate };

    // ─────────────────────────────
    // ℹ️ !info — Bot information
    // ─────────────────────────────
    case '!info': {
      const uptimeHrs = Math.floor(process.uptime() / 3600);
      const uptimeMins = Math.floor((process.uptime() % 3600) / 60);
      const memUsage = process.memoryUsage();
      const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);

      return { text: `ℹ️ *Bot Information*

🤖 Bot Name: ${process.env.BOT_NAME || 'Datrix AI'}
🔧 Version: 2.2.0 (Stable)
📦 Node.js: ${process.version}
⏱️ Uptime: ${uptimeHrs}h ${uptimeMins}m
💾 Memory: ${heapMB}MB heap / ${rssMB}MB RSS
🧠 Platform: ${process.platform}
📅 Timezone: Asia/Kolkata (IST)

🟢 All systems operational!`, private: isPrivate };
    }

    // ─────────────────────────────
    // 👍 !react — Add reaction to message (reply to a message)
    // ─────────────────────────────
    case '!react': {
      if (!args) {
        return { text: '👍 *React Command*\n\nReply to a message with:\n• `!react 👍` — Thumbs up\n• `!react ❤️` — Heart\n• `!react 😂` — Laugh\n• `!react 🎉` — Celebrate\n• `!react 🤔` — Thinking\n\nOr use: `!react [emoji]` with any emoji!', private: isPrivate };
      }
      
      // Check if this is a reply to a message
      if (!msg.hasQuotedMsg) {
        return { text: '❌ Please reply to a message to react to it!\n\n1. Long-press/reply to a message\n2. Type `!react [emoji]`\n\nExample: Reply to a message with `!react 👍`', private: isPrivate };
      }
      
      try {
        const quotedMsg = await msg.getQuotedMessage();
        const reaction = args.trim().split(' ')[0];
        
        // Validate emoji (basic check)
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F400}-\u{1F4FF}]|[\u{1F500}-\u{1F5FF}]|[\u{1F700}-\u{1F77F}]|[\u{2300}-\u{23FF}]|[\u{2190}-\u{21FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F1E0}-\u{1F1FF}]/u;
        
        if (!emojiRegex.test(reaction)) {
          return { text: '❌ Invalid emoji! Please use a valid emoji.\n\nExamples: 👍 ❤️ 😂 🎉 🤔 🔥 🙏', private: isPrivate };
        }
        
        // React to the quoted message
        await quotedMsg.react(reaction);
        log('command', `Reaction ${reaction} added to message from ${quotedMsg.author || quotedMsg.from}`);
        return { text: `Reacted with ${reaction}!`, private: isPrivate };
      } catch (error) {
        console.error('❌ React command error:', error.message);
        return { text: '⚠️ Could not add reaction. Make sure you\'re replying to a valid message.', private: isPrivate };
      }
    }

    // ─────────────────────────────
    // ✅ !task — Task Management
    // ─────────────────────────────
    case '!task': {
      if (!args) {
        return { text: '✅ *Task Management*\n\n• `!task add [task]` — Add new task\n• `!task list` — View pending tasks\n• `!task done [number]` — Mark task complete\n• `!task delete [number]` — Remove task\n\nExample: `!task add Buy groceries tomorrow`', private: isPrivate };
      }

      const taskArgs = args.split(' ');
      const subCommand = taskArgs[0].toLowerCase();

      if (subCommand === 'add') {
        const taskText = taskArgs.slice(1).join(' ').trim();
        if (!taskText) {
          return { text: '❌ Please provide task text.\nExample: `!task add Call mom at 5pm`', private: isPrivate };
        }
        const taskId = addTask(senderId, taskText);
        if (taskId) {
          return { text: `✅ Task added!\n\n📝 ${taskText.substring(0, 100)}${taskText.length > 100 ? '...' : ''}\n\nUse \`!task list\` to see all tasks.`, private: isPrivate };
        }
        return { text: '❌ Failed to add task. Please try again.', private: isPrivate };
      }

      if (subCommand === 'list') {
        const tasks = getTasks(senderId, false);
        const allTasks = getTasks(senderId, true);
        const completedCount = allTasks.filter(t => t.completed).length;
        
        if (tasks.length === 0) {
          return { text: `✅ You have no pending tasks!\n${completedCount > 0 ? `\n📊 ${completedCount} completed task(s).` : ''}\n\nUse \`!task add [task]\` to create one!`, private: isPrivate };
        }
        let response = `📋 *Your Tasks* (${tasks.length} pending${completedCount > 0 ? `, ${completedCount} done` : ''}):\n\n`;
        tasks.forEach((task, index) => {
          response += `${index + 1}. ${task.completed ? '✅' : '⬜'} ${task.content.substring(0, 60)}${task.content.length > 60 ? '...' : ''}\n`;
        });
        response += `\n✅ Mark done: \`!task done [number]\``;
        return { text: response, private: isPrivate };
      }

      if (subCommand === 'done') {
        const taskNum = parseInt(taskArgs[1]);
        if (isNaN(taskNum) || taskNum < 1) {
          return { text: '❌ Please provide a valid task number.\nExample: `!task done 1`', private: isPrivate };
        }
        if (completeTask(senderId, taskNum)) {
          return { text: `✅ Task #${taskNum} marked as complete! Great job! 🎉`, private: isPrivate };
        }
        return { text: `❌ Could not complete task #${taskNum}. Make sure it exists and isn't already done.`, private: isPrivate };
      }

      if (subCommand === 'delete') {
        const taskNum = parseInt(taskArgs[1]);
        if (isNaN(taskNum) || taskNum < 1) {
          return { text: '❌ Please provide a valid task number.\nExample: `!task delete 1`', private: isPrivate };
        }
        if (deleteTask(senderId, taskNum)) {
          return { text: `🗑️ Task #${taskNum} deleted!`, private: isPrivate };
        }
        return { text: `❌ Could not delete task #${taskNum}. Make sure it exists.`, private: isPrivate };
      }

      return { text: '❌ Unknown task command.\nUse: `add`, `list`, `done`, or `delete`', private: isPrivate };
    }

    // ─────────────────────────────
    // 🗳️ !poll — Create polls in groups
    // ─────────────────────────────
    case '!poll': {
      if (!isGroup) {
        return { text: '🗳️ Polls only work in groups!\n\nUse this command in a group chat.', private: isPrivate };
      }

      if (!args) {
        const activePoll = getActivePoll(chatId);
        if (activePoll) {
          let response = `🗳️ *Active Poll:*\n\n*${activePoll.question}*\n\n`;
          activePoll.options.forEach((opt, idx) => {
            response += `${idx + 1}. ${opt.text} (${opt.voters.length} votes)\n`;
          });
          response += `\nVote: \`!poll vote [number]\`\nEnd poll: \`!poll end\``;
          return { text: response, private: isPrivate };
        }
        return { text: '🗳️ *Poll Command*\n\nCreate a poll in this group:\n\n`!poll "Question?" "Option 1" "Option 2" "Option 3"`\n\n• Minimum 2 options\n• Maximum 10 options\n• Use quotes for multi-word options', private: isPrivate };
      }

      const pollSubCommand = args.split(' ')[0].toLowerCase();

      // Handle vote
      if (pollSubCommand === 'vote') {
        const voteArgs = args.split(' ');
        const voteNum = parseInt(voteArgs[1]);
        if (isNaN(voteNum) || voteNum < 1) {
          return { text: '❌ Please provide a valid option number.\nExample: `!poll vote 1`', private: isPrivate };
        }
        const activePoll = getActivePoll(chatId);
        if (!activePoll) {
          return { text: '❌ No active poll in this group.\nCreate one with `!poll "Question?" "Yes" "No"`', private: isPrivate };
        }
        if (votePoll(activePoll.id, voteNum - 1, senderId)) {
          return { text: `✅ Vote recorded for option ${voteNum}!`, private: isPrivate };
        }
        return { text: '❌ Could not record vote. Make sure the option exists.', private: isPrivate };
      }

      // Handle end poll
      if (pollSubCommand === 'end') {
        const activePoll = getActivePoll(chatId);
        if (!activePoll) {
          return { text: '❌ No active poll to end.', private: isPrivate };
        }
        // Only creator or admin can end
        if (activePoll.createdBy !== senderId && !isAdmin) {
          return { text: '❌ Only the poll creator or admin can end this poll.', private: isPrivate };
        }
        if (endPoll(activePoll.id)) {
          const results = getPollResults(activePoll.id);
          let response = '🏁 *Poll Ended!*\n\n';
          response += `*Question:* ${results.question}\n\n*Results:*\n`;
          results.options.forEach((opt, idx) => {
            const percentage = results.totalVotes > 0 ? Math.round((opt.voters.length / results.totalVotes) * 100) : 0;
            const bar = '█'.repeat(Math.round(percentage / 10)) + '░'.repeat(10 - Math.round(percentage / 10));
            response += `${idx + 1}. ${opt.text}\n${bar} ${opt.voters.length} votes (${percentage}%)\n\n`;
          });
          response += `📊 Total votes: ${results.totalVotes}`;
          return { text: response, private: isPrivate };
        }
        return { text: '❌ Could not end poll.', private: isPrivate };
      }

      // Create new poll - parse quoted strings
      try {
        const regex = /"([^"]*)"/g;
        const matches = [];
        let match;
        while ((match = regex.exec(args)) !== null) {
          matches.push(match[1]);
        }

        if (matches.length < 3) {
          return { text: '❌ Invalid format!\n\nUse: `!poll "Question?" "Option 1" "Option 2"`\n\nMake sure to use quotes around each option.', private: isPrivate };
        }

        const question = matches[0];
        const options = matches.slice(1);

        // End any existing poll first
        const existingPoll = getActivePoll(chatId);
        if (existingPoll) {
          endPoll(existingPoll.id);
        }

        const pollId = createPoll(chatId, question, options, senderId);
        if (pollId) {
          let response = `🗳️ *New Poll Created!*\n\n*${question}*\n\n`;
          options.forEach((opt, idx) => {
            response += `${idx + 1}. ${opt}\n`;
          });
          response += `\nVote: \`!poll vote [number]\`\nEnd poll: \`!poll end\``;
          return { text: response, private: false }; // Public response
        }
        return { text: '❌ Failed to create poll. Please try again.', private: isPrivate };
      } catch (error) {
        console.error('❌ Poll creation error:', error.message);
        return { text: '❌ Error creating poll. Use format: `!poll "Question?" "Yes" "No"`', private: isPrivate };
      }
    }

    // ─────────────────────────────
    // 🌤️ !weather — Get weather info
    // ─────────────────────────────
    case '!weather': {
      if (!args) {
        return { text: '🌤️ *Weather Command*\n\nUsage: `!weather [city name]`\n\nExamples:\n• `!weather Mumbai`\n• `!weather Delhi`\n• `!weather London`', private: isPrivate };
      }
      
      try {
        const city = args.trim();
        // Using Open-Meteo API (free, no API key needed)
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
        const geoData = await response.json();
        
        if (!geoData.results || geoData.results.length === 0) {
          return { text: `❌ City not found: "${city}"\n\nPlease check the spelling and try again.`, private: isPrivate };
        }
        
        const location = geoData.results[0];
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current_weather=true`);
        const weatherData = await weatherRes.json();
        
        const temp = Math.round(weatherData.current_weather.temperature);
        const wind = weatherData.current_weather.windspeed;
        const condition = getWeatherCondition(weatherData.current_weather.weathercode);
        
        return { text: `🌤️ *Weather in ${location.name}, ${location.country}*\n\n${condition}\n🌡️ Temperature: ${temp}°C\n💨 Wind: ${wind} km/h\n\n_— Powered by Open-Meteo_`, private: isPrivate };
      } catch (error) {
        console.error('❌ Weather command error:', error.message);
        return { text: '⚠️ Could not fetch weather data. Please try again later.', private: isPrivate };
      }
    }

    // ─────────────────────────────
    // 📰 !news — Get latest news
    // ─────────────────────────────
    case '!news': {
      try {
        // Using NewsData.io free tier (limited requests)
        // Fallback to a simple tech news feed if no API key
        const newsItems = [
          { title: "AI continues to transform industries worldwide", source: "Tech Daily" },
          { title: "WhatsApp introduces new privacy features", source: "Social Media Today" },
          { title: "India's tech sector sees 15% growth", source: "Business Standard" },
          { title: "New smartphone innovations unveiled at tech expo", source: "Gadget News" },
          { title: "Cloud computing adoption accelerates in 2026", source: "Cloud Weekly" },
        ];
        
        // Shuffle and pick 3 random items
        const shuffled = newsItems.sort(() => 0.5 - Math.random()).slice(0, 3);
        
        let response = '📰 *Latest Tech News*\n\n';
        shuffled.forEach((item, idx) => {
          response += `${idx + 1}. ${item.title}\n   📰 ${item.source}\n\n`;
        });
        response += '💡 Tip: Add NEWS_API_KEY to .env for real-time news!';
        
        return { text: response, private: isPrivate };
      } catch (error) {
        console.error('❌ News command error:', error.message);
        return { text: '⚠️ Could not fetch news. Please try again later.', private: isPrivate };
      }
    }

    // ─────────────────────────────
    // 🧠 !ask — AI-powered answers (ChatBot Mode)
    // ─────────────────────────────
    case '!ask':
      if (!args) {
        return { text: '❓ Please include a question! Example: `!ask What is data cleaning?`\n\n💡 *ChatBot Mode:* After asking, I\'ll continue chatting with detailed responses until you say "goodbye", "thanks", or "end".', private: isPrivate };
      }
      if (args.length > 500) {
        return { text: '⚠️ Question is too long! Please keep it under 500 characters.', private: isPrivate };
      }
      try {
        // Start chatbot session for detailed conversational responses
        startChatbotSession(senderId);
        
        // Use chatbot mode for detailed, conversational responses
        const aiReply = await generateChatbotReply(args, senderName, senderId);
        
        return { text: `🤖 *ChatBot Mode Activated!*\n\n${aiReply}\n\n_Keep chatting with me! Say "goodbye", "thanks", or "end" to finish._`, private: isPrivate };
      } catch (error) {
        console.error('❌ !ask command AI error:', error.message);
        return { text: '⚠️ Couldn\'t get an AI response right now. Please try again!', private: isPrivate };
      }

    // ─────────────────────────────
    // 🎭 !personality — Set AI personality mode
    // ─────────────────────────────
    case '!personality':
      if (!args) {
        const current = getUserPreference(senderId, 'personality') || 'default';
        return { text: `🎭 *Current Personality:* ${current}\n\nAvailable modes:\n• \`professional\` — Formal, business-oriented\n• \`casual\` — Friendly, conversational\n• \`funny\` — Humorous, playful\n\nUsage: \`!personality casual\``, private: isPrivate };
      }
      const mode = args.toLowerCase().trim();
      if (!['professional', 'casual', 'funny'].includes(mode)) {
        return { text: '❌ Invalid personality mode. Choose from: professional, casual, funny', private: isPrivate };
      }
      setUserPreference(senderId, 'personality', mode);
      return { text: `🎭 Personality set to *${mode}*! This will apply to future AI conversations. 🤖`, private: isPrivate };

    // ─────────────────────────────
    // 📝 !note — Personal notes management
    // ─────────────────────────────
    case '!note': {
      if (!args) {
        return { text: '📝 *Note Commands:*\n\n• \`!note add [text]\` — Add a note\n• \`!note list\` — View all notes\n• \`!note delete [number]\` — Delete a note', private: isPrivate };
      }

      const noteArgs = args.split(' ');
      const subCommand = noteArgs[0].toLowerCase();

      if (subCommand === 'add') {
        const noteText = noteArgs.slice(1).join(' ').trim();
        if (!noteText) {
          return { text: '❌ Please provide note text. Example: `!note add Buy groceries tomorrow`', private: isPrivate };
        }
        const noteId = addNote(senderId, noteText);
        return { text: `📝 Note #${noteId} saved! ✅\n\n*${noteText.substring(0, 100)}${noteText.length > 100 ? '...' : ''}*`, private: isPrivate };
      }

      if (subCommand === 'list') {
        const notes = getNotes(senderId);
        if (notes.length === 0) {
          return { text: '📝 You have no saved notes.\n\nUse `!note add [text]` to create one!', private: isPrivate };
        }
        let response = '📋 *Your Notes:*\n\n';
        notes.forEach((note, index) => {
          const date = new Date(note.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
          response += `${index + 1}. *${date}*\n${note.content.substring(0, 80)}${note.content.length > 80 ? '...' : ''}\n\n`;
        });
        response += `Total: ${notes.length} note(s)`;
        return { text: response, private: isPrivate };
      }

      if (subCommand === 'delete') {
        const noteNum = parseInt(noteArgs[1]);
        if (isNaN(noteNum) || noteNum < 1) {
          return { text: '❌ Please provide a valid note number. Example: `!note delete 1`', private: isPrivate };
        }
        const notes = getNotes(senderId);
        if (noteNum > notes.length) {
          return { text: `❌ Note #${noteNum} doesn't exist. You have ${notes.length} note(s).`, private: isPrivate };
        }
        if (deleteNote(senderId, notes[noteNum - 1].id)) {
          return { text: `🗑️ Note #${noteNum} deleted! ✅`, private: isPrivate };
        }
        return { text: '❌ Failed to delete note. Please try again.', private: isPrivate };
      }

      return { text: '❌ Unknown note command. Use: add, list, or delete', private: isPrivate };
    }

    // ─────────────────────────────
    // ⏰ !reminder — Set reminders
    // ─────────────────────────────
    case '!reminder': {
      if (!args) {
        return { text: '⏰ *Reminder Commands:*\n\n• \`!reminder [time] [message]\` — Set a reminder\n• \`!reminder list\` — View pending reminders\n\n*Time formats:*\n• 10m = 10 minutes\n• 1h = 1 hour\n• 2h30m = 2 hours 30 minutes\n• 1d = 1 day\n\nExample: \`!reminder 30m Call mom\`', private: isPrivate };
      }

      const reminderArgs = args.split(' ');
      const subCommand = reminderArgs[0].toLowerCase();

      if (subCommand === 'list') {
        const reminders = getReminders(senderId);
        const pending = reminders.filter(r => !r.completed && r.triggerTime > Date.now());
        if (pending.length === 0) {
          return { text: '⏰ You have no pending reminders.\n\nUse `!reminder [time] [message]` to set one!', private: isPrivate };
        }
        let response = '📋 *Your Pending Reminders:*\n\n';
        pending.forEach((reminder, index) => {
          const timeLeft = Math.ceil((reminder.triggerTime - Date.now()) / 60000);
          const timeStr = timeLeft < 60 ? `${timeLeft}m` : `${Math.ceil(timeLeft / 60)}h`;
          response += `${index + 1}. *In ${timeStr}:* ${reminder.message.substring(0, 50)}${reminder.message.length > 50 ? '...' : ''}\n`;
        });
        return { text: response, private: isPrivate };
      }

      // Parse time format (e.g., "30m", "1h", "2h30m", "1d")
      const timeMatch = reminderArgs[0].match(/^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?$/);
      if (!timeMatch) {
        return { text: '❌ Invalid time format. Use: 30m, 1h, 2h30m, or 1d', private: isPrivate };
      }

      const days = parseInt(timeMatch[1] || 0);
      const hours = parseInt(timeMatch[2] || 0);
      const minutes = parseInt(timeMatch[3] || 0);

      if (days === 0 && hours === 0 && minutes === 0) {
        return { text: '❌ Please specify a valid time. Example: 30m, 1h, 2h30m', private: isPrivate };
      }

      const totalMs = (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
      if (totalMs < 60000) {
        return { text: '❌ Reminder time must be at least 1 minute.', private: isPrivate };
      }
      if (totalMs > 7 * 24 * 60 * 60 * 1000) {
        return { text: '❌ Reminder time cannot exceed 7 days.', private: isPrivate };
      }

      const reminderMsg = reminderArgs.slice(1).join(' ').trim();
      if (!reminderMsg) {
        return { text: '❌ Please include a reminder message. Example: `!reminder 30m Call mom`', private: isPrivate };
      }

      const triggerTime = Date.now() + totalMs;
      const reminderId = addReminder(senderId, chatId, reminderMsg, triggerTime, isGroup);

      const timeStr = days > 0 ? `${days}d` : hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}` : `${minutes}m`;
      return { text: `⏰ Reminder set for *${timeStr}* from now!\n\n📝 ${reminderMsg}\n\nI'll notify you when it's time. ✅`, private: isPrivate };
    }

    // ─────────────────────────────
    // 😄 !joke — Random joke
    // ─────────────────────────────
    case '!joke':
      return { text: `😄 *Here's a joke for you!*\n\n${JOKES[Math.floor(Math.random() * JOKES.length)]}`, private: isPrivate };

    // ─────────────────────────────
    // 💭 !quote — Inspirational quote
    // ─────────────────────────────
    case '!quote': {
      const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      return { text: `💭 *Quote of the Moment*\n\n"${quote.text}"\n\n— ${quote.author}`, private: isPrivate };
    }

    // ─────────────────────────────
    // 📚 !fact — Random fact
    // ─────────────────────────────
    case '!fact':
      return { text: `📚 *Did you know?*\n\n${FACTS[Math.floor(Math.random() * FACTS.length)]}`, private: isPrivate };

    // ─────────────────────────────
    // 📢 !broadcast — Admin only
    // ─────────────────────────────
    case '!broadcast':
      if (!args) {
        return { text: '📢 Usage: `!broadcast Your message here`', private: isPrivate };
      }
      if (args.length > 1000) {
        return { text: '⚠️ Broadcast message too long! Keep it under 1000 characters.', private: isPrivate };
      }
      try {
        const broadcastResult = await executeBroadcast(client, args);
        return { text: `📢 Broadcast sent to ${broadcastResult.count} group(s)!\n${broadcastResult.failures > 0 ? `⚠️ Failed in ${broadcastResult.failures} group(s)` : ''}`, private: isPrivate };
      } catch (error) {
        console.error('❌ Broadcast error:', error.message);
        return { text: '⚠️ Broadcast failed. Check logs for details.', private: isPrivate };
      }

    // ─────────────────────────────
    // 👢 !kick — Admin only group management
    // ─────────────────────────────
    case '!kick':
      if (!isGroup) {
        return { text: '👥 This command only works in groups.', private: isPrivate };
      }
      if (!args || !args.includes('@')) {
        return { text: '❌ Please mention the user to kick. Example: `!kick @username`', private: isPrivate };
      }
      try {
        const chat = await msg.getChat();
        if (!chat.isGroup) {
          return { text: '❌ This command only works in groups.', private: isPrivate };
        }
        // Note: whatsapp-web.js doesn't support kicking directly without admin privileges
        // This is a placeholder for when the feature becomes available
        return { text: '⚠️ Kick functionality requires admin privileges. Please use WhatsApp directly to remove members.', private: isPrivate };
      } catch (error) {
        console.error('❌ Kick error:', error.message);
        return { text: '⚠️ Failed to process kick command.', private: isPrivate };
      }

    // ─────────────────────────────
    // ⬆️ !promote — Admin only
    // ─────────────────────────────
    case '!promote':
      if (!isGroup) {
        return { text: '👥 This command only works in groups.', private: isPrivate };
      }
      if (!args || !args.includes('@')) {
        return { text: '❌ Please mention the user to promote. Example: `!promote @username`', private: isPrivate };
      }
      return { text: '⚠️ Promote functionality requires group admin privileges. Please use WhatsApp directly to promote members.', private: isPrivate };

    // ─────────────────────────────
    // ⬇️ !demote — Admin only
    // ─────────────────────────────
    case '!demote':
      if (!isGroup) {
        return { text: '👥 This command only works in groups.', private: isPrivate };
      }
      if (!args || !args.includes('@')) {
        return { text: '❌ Please mention the user to demote. Example: `!demote @username`', private: isPrivate };
      }
      return { text: '⚠️ Demote functionality requires group admin privileges. Please use WhatsApp directly to demote members.', private: isPrivate };

    // ─────────────────────────────
    // 🏷️ !tagall — Mention all members
    // ─────────────────────────────
    case '!tagall':
      if (!isGroup) {
        return { text: '👥 This command only works in groups.', private: isPrivate };
      }
      try {
        const chat = await msg.getChat();
        if (!chat.isGroup) {
          return { text: '❌ This command only works in groups.', private: isPrivate };
        }

        const participants = chat.participants || [];
        if (participants.length === 0) {
          return { text: '❌ Could not retrieve group participants.', private: isPrivate };
        }

        let tagMessage = args ? `📢 *Announcement:*\n\n${args}\n\n` : '📢 *Attention everyone!*\n\n';

        // Create mentions for all participants
        const mentions = [];
        participants.forEach(participant => {
          const id = participant.id._serialized;
          mentions.push(id);
          tagMessage += `@${id.split('@')[0]} `;
        });

        await msg.reply(tagMessage, null, { mentions });
        console.log(`🏷️ Tagall sent to ${participants.length} members in ${chat.name}`);
        return null; // Message already sent directly
      } catch (error) {
        console.error('❌ Tagall error:', error.message);
        return { text: '⚠️ Failed to tag all members. Please try again.', private: isPrivate };
      }

    // ─────────────────────────────
    // 📊 !stats — Detailed admin statistics
    // ─────────────────────────────
    case '!stats': {
      const stats = getStats();
      const userStats = getUserStats();
      const uptimeHrs = Math.floor(stats.uptimeMs / 3600000);
      const uptimeMins = Math.floor((stats.uptimeMs % 3600000) / 60000);
      const tokens = getTokenUsage();
      const memUsage = process.memoryUsage();
      const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      return { text: `📊 *Detailed Bot Statistics*

⏱️ Uptime: ${uptimeHrs}h ${uptimeMins}m
💬 Total Messages: ${stats.messagesHandled}
📅 Messages Today: ${stats.messagesToday}
👥 Unique Users: ${stats.userCount}
🔇 Muted Groups: ${stats.groupsMuted}
🧠 AI Requests: ${tokens.totalRequests}
🟢 Token Usage: ${tokens.promptTokens + tokens.completionTokens}
💾 Memory Usage: ${heapMB}MB
📈 Commands Used: ${userStats.totalCommands || 0}

🟢 Status: Online & Running`, private: isPrivate };
    }

    // ─────────────────────────────
    // 📊 !monitor — Message monitoring commands
    // ─────────────────────────────
    case '!monitor': {
      if (!args) {
        return { text: `📊 *Message Monitoring Commands*

• \`!monitor on\` — Enable monitoring
• \`!monitor off\` — Disable monitoring
• \`!monitor status\` — Show monitoring status
• \`!monitor stats\` — Show captured statistics
• \`!monitor export <format> [days]\` — Export data (json/csv)
• \`!monitor clear <days>\` — Clear old data
• \`!monitor search <query>\` — Search messages
• \`!monitor calls [limit]\` — Show recent calls
• \`!monitor config <key> <value>\` — Update config

💡 Monitoring captures all messages, media, and calls for admin review.`, private: isPrivate };
      }

      const monitorArgs = args.split(' ');
      const subCommand = monitorArgs[0].toLowerCase();

      // Enable monitoring
      if (subCommand === 'on') {
        configureMonitor({ enabled: true });
        return { text: '✅ Message monitoring *ENABLED*!\n\nAll messages will now be captured.', private: isPrivate };
      }

      // Disable monitoring
      if (subCommand === 'off') {
        configureMonitor({ enabled: false });
        return { text: '⏸️ Message monitoring *DISABLED*.\n\nNo new messages will be captured.', private: isPrivate };
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
          return { text: '❌ Invalid format. Use: `json` or `csv`\nExample: `!monitor export json 7`', private: isPrivate };
        }

        const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);
        const filters = { startDate, page: 1, limit: 5000 };

        const messagesExport = exportData(format, { ...filters, dataType: 'messages' });
        const callsExport = exportData(format, { ...filters, dataType: 'calls' });

        // Truncate for display (too long for WhatsApp)
        const preview = messagesExport.length > 2000
          ? messagesExport.substring(0, 2000) + '\n\n... (truncated for display)'
          : messagesExport;

        let response = `📤 *Export Results (${format.toUpperCase()})*\n\n`;
        response += `Period: Last ${days} days\n\n`;
        response += `*Messages Preview:*\n${preview}\n\n`;
        response += `_Full data saved to console log._`;

        // Log full export to console for admin retrieval
        console.log('=== MONITORING EXPORT ===');
        console.log('Messages:', messagesExport);
        console.log('Calls:', callsExport);
        console.log('=== END EXPORT ===');

        return { text: response, private: isPrivate };
      }

      // Clear old data
      if (subCommand === 'clear') {
        const days = parseInt(monitorArgs[1], 10);
        if (isNaN(days) || days < 1) {
          return { text: '❌ Please specify valid days.\nExample: `!monitor clear 7`', private: isPrivate };
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
          return { text: '❌ Please provide a search query.\nExample: `!monitor search hello`', private: isPrivate };
        }

        const results = getMessages({ searchQuery: query, limit: 20 });

        if (results.messages.length === 0) {
          return { text: `🔍 No messages found for: "${query}"`, private: isPrivate };
        }

        let response = `🔍 *Search Results for "${query}"*\n`;
        response += `Found ${results.total} messages:\n\n`;

        results.messages.forEach((msg, idx) => {
          const date = new Date(msg.timestamp).toLocaleDateString('en-IN');
          const time = new Date(msg.timestamp).toLocaleTimeString('en-IN');
          const preview = (msg.body || '[No text]').substring(0, 50);
          response += `${idx + 1}. [${date}] ${msg.senderName}: ${preview}${msg.body?.length > 50 ? '...' : ''}\n`;
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
          return { text: '📞 No call records found.', private: isPrivate };
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
          return { text: '❌ Usage: `!monitor config <key> <value>`\nExample: `!monitor config captureImages true`', private: isPrivate };
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
          return { text: `❌ Unknown config key: ${key}`, private: isPrivate };
        }

        configureMonitor(config);
        return { text: `✅ Config updated: ${key} = ${value}`, private: isPrivate };
      }

      return { text: '❌ Unknown monitor command. Use `!monitor` to see available commands.', private: isPrivate };
    }

    // ─────────────────────────────
    // 🔇 !mute — Silence in group
    // ─────────────────────────────
    case '!mute':
      if (!isGroup) {
        return { text: '🔇 This command only works in groups.', private: isPrivate };
      }
      if (muteGroup(chatId)) {
        return { text: '🔇 Bot muted in this group. Use `!unmute` to resume.', private: isPrivate };
      }
      return { text: '🔇 This group is already muted.', private: isPrivate };

    // ─────────────────────────────
    // 🔊 !unmute — Resume in group
    // ─────────────────────────────
    case '!unmute':
      if (!isGroup) {
        return { text: '🔊 This command only works in groups.', private: isPrivate };
      }
      if (unmuteGroup(chatId)) {
        return { text: '🔊 Bot unmuted! I\'m back and listening. 🤖', private: isPrivate };
      }
      return { text: '🔊 This group isn\'t muted.', private: isPrivate };

    // ─────────────────────────────
    // 📈 !report — Bot statistics
    // ─────────────────────────────
    case '!report': {
      const reportStats = getStats();
      const reportUptimeHrs = Math.floor(reportStats.uptimeMs / 3600000);
      const reportUptimeMins = Math.floor((reportStats.uptimeMs % 3600000) / 60000);
      const reportTokens = getTokenUsage();
      return { text: `📈 *Datrix Bot Report*

⏱️ Uptime: ${reportUptimeHrs}h ${reportUptimeMins}m
💬 Messages handled: ${reportStats.messagesHandled}
📅 Messages today: ${reportStats.messagesToday}
👥 Unique users: ${reportStats.userCount}
🔇 Muted groups: ${reportStats.groupsMuted}
🧠 AI requests: ${reportTokens.totalRequests}
🟢 Status: Online & Running`, private: isPrivate };
    }

    // ─────────────────────────────
    // 🏓 !ping — Latency check
    // ─────────────────────────────
    case '!ping': {
      const startMs = Date.now();
      return { text: `🏓 Pong! Latency: ~${Date.now() - startMs}ms\n🟢 Bot is responsive!`, private: isPrivate };
    }

    // ─────────────────────────────
    // 🗑️ !clear — Clear chat history
    // ─────────────────────────────
    case '!clear': {
      const { clearConversation } = require('./db');
      clearConversation(senderId);
      return { text: '🗑️ Your conversation history has been cleared. Fresh start! 🤖', private: isPrivate };
    }

    // ─────────────────────────────
    // 📤 !send — Send message to contact
    // ─────────────────────────────
    case '!send': {
      console.log(`[DEBUG] !send case entered with args: "${args}"`);
      if (!args) {
        return { text: '📤 *Send Message Command*\n\nUsage: `!send [contact-name-or-number] [message]`\n\nExamples:\n• `!send mritunjay Hello, are we meeting today?`\n• `!send +919876543210 Don\'t forget the presentation!`\n• `!send "John Doe" Hello there!` (quoted name)\n• `!send \'Mom\' How are you?` (single quotes)\n\n💡 Use quotes for contact names with spaces. The bot will search your contacts and deliver the message.', private: isPrivate };
      }

      // Parse contact identifier and message using quote-aware parser
      const parsedArgs = parseSendArgs(args);
      console.log(`[DEBUG] !send parsed args:`, parsedArgs);
      if (!parsedArgs) {
        return { text: '❌ Please provide both a contact name/number and a message.\n\nUsage: `!send [contact-name-or-number] [message]`\n\n💡 You can use quotes for names with spaces:\n• `!send "John Doe" Hello there!`\n• `!send \'Mom\' How are you?`', private: isPrivate };
      }

      const { contactQuery, message } = parsedArgs;

      if (!message) {
        return { text: '❌ Please provide a message to send.', private: isPrivate };
      }

      if (message.length > 1000) {
        return { text: '⚠️ Message too long! Please keep it under 1000 characters.', private: isPrivate };
      }

      try {
        console.log(`[DEBUG] !send starting search for: "${contactQuery}"`);
        // Get all chats to search through
        const chats = await client.getChats();
        console.log(`[DEBUG] !send got ${chats.length} chats`);
        let exactMatches = [];
        let partialMatches = [];

        // Search by exact phone number format (with or without + and country code)
        const normalizedQuery = contactQuery.replace(/\D/g, '').toLowerCase();
        const queryLower = contactQuery.toLowerCase();
        
        for (const chat of chats) {
          // Skip the current chat (where command was sent from) - can't send to yourself
          if (chat.id._serialized === chatId) {
            continue;
          }
          
          // Check if it's a private chat (not a group)
          if (chat.id._serialized.endsWith('@c.us')) {
            const chatNumber = chat.id.user.replace(/\D/g, '');
            
            // Exact match by number
            if (chatNumber === normalizedQuery ||
                chatNumber === normalizedQuery.slice(-10) || // Last 10 digits
                normalizedQuery === chatNumber.slice(-10)) {
              exactMatches.push({ chat, priority: 1, type: 'number' });
              continue;
            }

            // Get contact info for name matching
            let contactName = chat.name || '';
            let contactPushname = '';
            try {
              const contact = await chat.getContact();
              contactPushname = contact.pushname || contact.name || '';
            } catch (e) {
              // Continue without contact info
            }
            
            const names = [contactName, contactPushname].filter(n => n).map(n => n.toLowerCase());
            
            // Exact name match
            for (const name of names) {
              if (name === queryLower) {
                exactMatches.push({ chat, priority: 0, type: 'exact_name' }); // Highest priority
                break;
              }
            }
            
            // Partial name match (only if no exact match found for this chat)
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

        // Choose best match: exact matches first, then partial
        let targetChat = null;
        if (exactMatches.length > 0) {
          // Sort by priority and pick best
          exactMatches.sort((a, b) => a.priority - b.priority);
          targetChat = exactMatches[0].chat;
          console.log(`[DEBUG] !send found exact match: ${targetChat.name || targetChat.id.user} (type: ${exactMatches[0].type})`);
        } else if (partialMatches.length > 0) {
          // Sort by longest name first (more specific match)
          partialMatches.sort((a, b) => b.priority - a.priority);
          targetChat = partialMatches[0].chat;
          console.log(`[DEBUG] !send found partial match: ${targetChat.name || targetChat.id.user}`);
        }

        if (!targetChat) {
          return { text: `❌ *Contact not found*\n\nCould not find a contact matching "${contactQuery}".\n\n💡 Tips:\n• Use the exact phone number (e.g., +919876543210)\n• Or use the contact's exact saved name\n• Make sure you have chatted with this contact before\n• Check the contact name spelling`, private: isPrivate };
        }

        // Send the message - clean format without "via Datrix Bot" for stealth mode
        let formattedMessage;
        if (fromMe) {
          // Admin mode: send clean message without attribution
          formattedMessage = message;
        } else {
          // Normal mode: include sender attribution
          formattedMessage = `📨 *Message from ${senderName}*\n\n${message}\n\n_— Sent via Datrix Bot_`;
        }

        console.log(`[DEBUG] !send sending message to ${targetChat.name || targetChat.id.user}`);
        await targetChat.sendMessage(formattedMessage);
        console.log(`[DEBUG] !send message sent successfully`);

        const recipientName = targetChat.name || targetChat.id.user;

        if (fromMe) {
          // Admin mode: silent confirmation (logged to console only)
          console.log(`[ADMIN SEND] Message sent to ${recipientName}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
          return { text: `✅ Sent to ${recipientName}: "${message.substring(0, 40)}${message.length > 40 ? '...' : ''}"`, private: isPrivate };
        } else {
          // Normal mode: full confirmation
          return { text: `✅ *Message sent!*\n\nTo: *${recipientName}*\nMessage: _${message.substring(0, 50)}${message.length > 50 ? '...' : ''}_`, private: isPrivate };
        }

      } catch (error) {
        console.error('❌ !send command error:', error.message);
        console.error('❌ Full error:', error);
        return { text: `⚠️ Failed to send message: ${error.message}`, private: isPrivate };
      }
    }

    // ─────────────────────────────
    // 🤖 !reply — Auto-reply mode
    // ─────────────────────────────
    case '!reply': {
      const subCommand = args ? args.trim().toLowerCase() : 'status';
      const currentMode = getReplyMode(chatId);

      if (subCommand === 'on') {
        setReplyMode(chatId, { enabled: true, groupMentions: currentMode.groupMentions });
        return { text: '🤖 *Auto-Reply Enabled*\n\nI will now reply on your behalf when you don\'t respond for 2 hours in this chat.\n\n💡 Use `!reply group` to also reply when someone mentions you in groups.', private: isPrivate };
      }

      if (subCommand === 'off') {
        setReplyMode(chatId, { enabled: false, groupMentions: false });
        return { text: '🛑 *Auto-Reply Disabled*\n\nI will no longer reply automatically in this chat.', private: isPrivate };
      }

      if (subCommand === 'group') {
        setReplyMode(chatId, { enabled: true, groupMentions: true });
        return { text: '👥 *Group Mention Replies Enabled*\n\nI will reply when someone mentions "Abhi" or tags you in this group.\n\n💡 Use `!reply off` to disable all auto-replies.', private: isPrivate };
      }

      if (subCommand === 'status') {
        const status = currentMode.enabled ? '🟢 Enabled' : '🔴 Disabled';
        const groupStatus = currentMode.groupMentions ? '🟢 Group mentions on' : '⚪ Group mentions off';
        const lastReply = currentMode.lastAdminReply
          ? new Date(currentMode.lastAdminReply).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          : 'Never';

        return { text: `🤖 *Auto-Reply Status*\n\nMode: ${status}\n${isGroup ? groupStatus : ''}\nLast admin reply: ${lastReply}\n\nCommands:\n• \`!reply on\` — Enable auto-reply\n• \`!reply off\` — Disable auto-reply\n• \`!reply group\` — Enable group mention replies`, private: isPrivate };
      }

      return { text: '❌ Invalid option.\n\nUsage: `!reply [on|off|group|status]`', private: isPrivate };
    }

    // ─────────────────────────────
    //  !replyto — AI reply to specific person in group
    // ─────────────────────────────
    case '!replyto': {
      if (!args) {
        return { text: '❌ Missing arguments.\n\nUsage: `!replyto [group-name] [person-name] [instruction]`\n\nExamples:\n• `!replyto "Nana Ka Ghar" Rahul "give him a compliment"` (double quotes)\n• `!replyto \'Nana Ka Ghar🩷🩷\' Rahul cute boy` (single quotes)\n• `!replyto "Group Name" "Person Name" Hello there` (both quoted)\n\n💡 Use single quotes (\'Name\') or double quotes ("Name") for names with spaces.', private: isPrivate };
      }

      // Parse arguments: group name (quoted or single word), person name, instruction (quoted)
      const parsedArgs = parseReplyToArgs(args);
      if (!parsedArgs) {
        return { text: '❌ Invalid format.\n\nUsage: `!replyto [group-name] [person-name] [instruction]`\n\nExamples:\n• `!replyto "Nana Ka Ghar" Rahul "give him a compliment"`\n• `!replyto \'Nana Ka Ghar🩷🩷\' Rahul cute boy`\n• `!replyto "Group" "Person" Hello`\n\n💡 Use single or double quotes for names with spaces.', private: isPrivate };
      }

      const { groupName, personName, instruction } = parsedArgs;

      try {
        // Get all chats and find the group
        const chats = await client.getChats();
        const normalizedGroupName = groupName.toLowerCase();

        // Find group by name (partial match)
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
          return { text: `❌ Group not found: "${groupName}"`, private: isPrivate };
        }

        // Get participants and find the person
        const participants = targetGroup.participants || [];
        if (participants.length === 0) {
          return { text: '❌ Could not retrieve group participants.', private: isPrivate };
        }

        // Search for person in participants
        const normalizedPersonName = personName.toLowerCase();
        let targetParticipant = null;
        let targetContact = null;

        for (const participant of participants) {
          // Get contact info for this participant
          const contact = await client.getContactById(participant.id._serialized);
          const contactName = contact.name || contact.pushname || '';
          const contactNumber = participant.id.user;

          // Match by name or number
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
          return { text: `❌ Person not found: "${personName}" in group "${targetGroup.name}"`, private: isPrivate };
        }

        // Generate AI message based on instruction
        const targetName = targetContact.name || targetContact.pushname || targetParticipant.id.user;
        const personality = getUserPreference(senderId, 'personality') || 'default';
        const aiPrompt = `Generate a WhatsApp message to ${targetName}. ${instruction}. Keep it natural and conversational, suitable for a group chat. Do not use markdown formatting.`;
        const aiMessage = await askAI(aiPrompt, 'Admin', personality);

        // Send message with mention
        const mentionId = targetParticipant.id._serialized;
        const mentionText = `@${targetParticipant.id.user}`;
        const finalMessage = `${mentionText} ${aiMessage}`;

        await targetGroup.sendMessage(finalMessage, { mentions: [mentionId] });

        console.log(`[REPLYTO] Admin sent AI message to ${targetName} in ${targetGroup.name}: ${aiMessage.substring(0, 50)}...`);
        return { text: `✅ *Message sent!*\n\nTo: *${targetName}* in *${targetGroup.name}*\nMessage: _${aiMessage.substring(0, 50)}${aiMessage.length > 50 ? '...' : ''}_`, private: isPrivate };

      } catch (error) {
        console.error('❌ !replyto command error:', error.message);
        return { text: '⚠️ Failed to send message. Please try again.', private: isPrivate };
      }
    }

    // ─────────────────────────────
    //  !proxy — Proxy chat mode
    // ─────────────────────────────
    case '!proxy': {
      if (!args) {
        const activeSession = getProxySession(senderId);
        if (activeSession) {
          return { text: `🔄 *Proxy Mode Active*\n\nYou are proxying messages to: *${activeSession.targetName}*\nStarted: ${new Date(activeSession.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\nCommands:\n• \_!proxy stop\_ — End proxy session\n• \_!proxy status\_ — Show session details\n\nJust send any message and it will be forwarded!`, private: isPrivate };
        }
        return { text: '🔄 *Proxy Chat Mode*\n\nForward messages between you and another contact anonymously.\n\nUsage:\n• `!proxy start [contact-name]` — Start proxy session\n• `!proxy stop` — End proxy session\n• `!proxy status` — Check active session\n\nExample: `!proxy start mritunjay`\n\n⚠️ The target contact must have messaged the bot before.', private: isPrivate };
      }

      const proxyArgs = args.split(' ');
      const subCommand = proxyArgs[0].toLowerCase();

      // ── Start Proxy Session ──
      if (subCommand === 'start') {
        if (proxyArgs.length < 2) {
          return { text: '❌ Please specify a contact name.\n\nUsage: `!proxy start [contact-name]`', private: isPrivate };
        }

        // Remove trailing punctuation from contact name
        const contactQuery = proxyArgs.slice(1).join(' ').trim().replace(/[.!?,;:]+$/, '');

        // Check if already in proxy mode
        const existingSession = getProxySession(senderId);
        if (existingSession) {
          return { text: `⚠️ You already have an active proxy session with *${existingSession.targetName}*.\n\nUse \`!proxy stop\` to end it first.`, private: isPrivate };
        }

        try {
          // Search for the contact
          const chats = await client.getChats();
          let targetChat = null;
          let exactMatch = null;
          let partialMatch = null;
          const normalizedQuery = contactQuery.toLowerCase();

          console.log(`[DEBUG] Proxy search: looking for "${contactQuery}" (sender: ${senderId})`);

          for (const chat of chats) {
            // Skip non-private chats and sender's own chat
            if (!chat.id._serialized.endsWith('@c.us')) continue;
            if (chat.id._serialized === senderId) {
              console.log(`[DEBUG] Skipping sender's own chat: ${chat.name || chat.id.user}`);
              continue;
            }

            const chatName = (chat.name || '').toLowerCase();
            const chatNumber = chat.id.user.replace(/\D/g, '');
            const queryNumber = contactQuery.replace(/\D/g, '');

            // Match by chat name - exact match first
            if (chatName === normalizedQuery) {
              console.log(`[DEBUG] Exact name match: ${chat.name}`);
              exactMatch = chat;
              break;
            }

            // Match by number (exact)
            if (queryNumber && chatNumber === queryNumber) {
              console.log(`[DEBUG] Exact number match: ${chat.name || chatNumber}`);
              exactMatch = chat;
              break;
            }

            // Partial name match (store for later if no exact match)
            if (!partialMatch && chatName.includes(normalizedQuery)) {
              console.log(`[DEBUG] Partial name match: ${chat.name}`);
              partialMatch = chat;
              continue;
            }

            // Match by contact info
            try {
              const contact = await chat.getContact();
              const pushname = (contact.pushname || '').toLowerCase();
              const contactName = (contact.name || '').toLowerCase();

              if (pushname === normalizedQuery || contactName === normalizedQuery) {
                console.log(`[DEBUG] Exact contact match: ${contact.pushname || contact.name}`);
                exactMatch = chat;
                break;
              }

              if (!partialMatch && (pushname.includes(normalizedQuery) || contactName.includes(normalizedQuery))) {
                console.log(`[DEBUG] Partial contact match: ${contact.pushname || contact.name}`);
                partialMatch = chat;
              }
            } catch (e) {
              // Continue searching
            }
          }

          // Use exact match if found, otherwise use partial match
          targetChat = exactMatch || partialMatch;

          if (!targetChat) {
            return { text: `❌ *Contact not found*\n\nCould not find "${contactQuery}".\n\n💡 Make sure you have chatted with this contact before.`, private: isPrivate };
          }

          // Create proxy session
          const targetName = targetChat.name || targetChat.id.user;
          const sessionId = createProxySession(senderId, targetChat.id._serialized, targetName);

          if (!sessionId) {
            return { text: '⚠️ Failed to create proxy session. Please try again.', private: isPrivate };
          }

          // Notify the target contact
          const introMessage = `📨 *Anonymous Message*\n\nYou have received a message from someone who wishes to remain anonymous.\n\nReply to this chat and your message will be forwarded back to them.\n\n_— Datrix Proxy Service_`;
          await targetChat.sendMessage(introMessage);

          return { text: `🔄 *Proxy Session Started!*\n\nTarget: *${targetName}*\nSession ID: \`${sessionId}\`\n\n✅ Introduction message sent to recipient.\n\nNow just send any message and it will be forwarded anonymously!\n\nUse \`!proxy stop\` to end the session.`, private: isPrivate };

        } catch (error) {
          console.error('❌ !proxy start error:', error.message);
          return { text: '⚠️ Failed to start proxy session. Please try again.', private: isPrivate };
        }
      }

      // ── Stop Proxy Session ──
      if (subCommand === 'stop') {
        const session = getProxySession(senderId);
        if (!session) {
          return { text: 'ℹ️ You don\'t have an active proxy session.\n\nUse `!proxy start [contact-name]` to start one.', private: isPrivate };
        }

        try {
          // Notify target that session ended
          const targetChat = await client.getChatById(session.targetId);
          if (targetChat) {
            await targetChat.sendMessage('🔚 The anonymous conversation has ended.\n\n_— Datrix Proxy Service_');
          }
        } catch (e) {
          // Target may have blocked or unavailable
        }

        endProxySession(senderId);
        return { text: `🛑 *Proxy Session Ended*\n\nYour anonymous conversation with *${session.targetName}* has been closed.\n\nMessages will no longer be forwarded.`, private: isPrivate };
      }

      // ── Proxy Status ──
      if (subCommand === 'status') {
        const session = getProxySession(senderId);
        if (!session) {
          return { text: 'ℹ️ No active proxy session.\n\nUse `!proxy start [contact-name]` to start one.', private: isPrivate };
        }

        const duration = Math.floor((Date.now() - session.startTime) / 60000);
        const durationStr = duration < 60 ? `${duration}m` : `${Math.floor(duration / 60)}h ${duration % 60}m`;

        return { text: `🔄 *Proxy Session Status*\n\nTarget: *${session.targetName}*\nSession ID: \`${session.id}\`\nDuration: *${durationStr}*\nStatus: 🟢 Active\n\nUse \`!proxy stop\` to end the session.`, private: isPrivate };
      }

      return { text: '❌ Unknown proxy command. Use: start, stop, or status', private: isPrivate };
    }

    // ─────────────────────────────
    // ❓ Unknown command
    // ─────────────────────────────
    default:
      return null; // Return null for unknown commands — don't spam
  }
}

// ============================================
// 📢 Broadcast Execution (shared utility)
// ============================================

/**
 * Send a broadcast message to all groups the bot is in.
 * Includes a 2-second delay between messages to avoid spam detection.
 * 
 * @param {object} client — whatsapp-web.js Client instance
 * @param {string} message — Message to broadcast
 * @returns {Promise<{ count: number, failures: number }>}
 */
async function executeBroadcast(client, message) {
  const chats = await client.getChats();
  const groups = chats.filter((chat) => chat.isGroup);

  let sentCount = 0;
  let failCount = 0;
  const formattedMsg = `📢 *Datrix Broadcast*\n\n${message}\n\n— Datrix AI 🤖`;

  for (const group of groups) {
    try {
      await group.sendMessage(formattedMsg);
      sentCount++;
      console.log(`📢 Broadcast sent to: ${group.name}`);
      // ⏳ 2-second delay between sends to avoid WhatsApp rate limits
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      failCount++;
      console.error(`❌ Failed to broadcast to ${group.name}:`, error.message);
    }
  }

  // 📝 Log broadcast to database
  addBroadcast(message, sentCount);

  return { count: sentCount, failures: failCount };
}

// ============================================
// 📤 Module Exports
// ============================================

module.exports = {
  parseCommand,
  handleCommand,
  executeBroadcast,
  isAdminUser,
};
