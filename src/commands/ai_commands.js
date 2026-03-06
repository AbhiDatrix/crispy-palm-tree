// ============================================
// 🧠 AI Commands — Ask, Personality
// ============================================

const { askAI, generateChatbotReply } = require('../ai');
const { 
  startChatbotSession, 
  isChatbotSessionActive, 
  endChatbotSession, 
  isChatbotExitMessage,
  getUserPreference,
  setUserPreference,
  getConversationStats
} = require('../db');
const { log } = require('../bot.js');

/**
 * Register all AI commands with the registry
 * @param {Object} registry - Command registry instance
 */
function registerAICommands(registry) {
  // 🧠 !ask — AI-powered answers (ChatBot Mode)
  registry.register('!ask', async (msg, args, context) => {
    const { isPrivate, senderName, senderId } = context;
    
    if (!args) {
      return { 
        text: '❓ Please include a question! Example: `!ask What is data cleaning?`\n\n💡 *ChatBot Mode:* After asking, I\'ll continue chatting with detailed responses until you say "goodbye", "thanks", or "end".', 
        private: isPrivate 
      };
    }
    
    if (args.length > 1000) {
      return { 
        text: '⚠️ Question is too long! Please keep it under 1000 characters.', 
        private: isPrivate 
      };
    }
    
    try {
      // Start chatbot session for detailed conversational responses
      startChatbotSession(senderId);
      
      // Use chatbot mode for detailed, conversational responses
      const aiReply = await generateChatbotReply(args, senderName, senderId);
      
      return { 
        text: `🤖 *ChatBot Mode Activated!*\n\n${aiReply}\n\n_Keep chatting with me! Say "goodbye", "thanks", or "end" to finish._`, 
        private: isPrivate 
      };
    } catch (error) {
      log('error', '!ask command AI error: ' + error.message);
      return { 
        text: '⚠️ Couldn\'t get an AI response right now. Please try again!', 
        private: isPrivate 
      };
    }
  }, { 
    description: 'Ask AI anything',
    category: 'ai',
    usage: '[question]'
  });

  // 🎭 !personality — Set AI personality mode
  registry.register('!personality', async (msg, args, context) => {
    const { isPrivate, senderId } = context;
    
    if (!args) {
      const current = getUserPreference(senderId, 'personality') || 'default';
      return { 
        text: `🎭 *Current Personality:* ${current}\n\nAvailable modes:\n• \`professional\` — Formal, business-oriented\n• \`casual\` — Friendly, conversational\n• \`funny\` — Humorous, playful\n\nUsage: \`!personality casual\``, 
        private: isPrivate 
      };
    }
    
    const mode = args.toLowerCase().trim();
    if (!['professional', 'casual', 'funny'].includes(mode)) {
      return { 
        text: '❌ Invalid personality mode. Choose from: professional, casual, funny', 
        private: isPrivate 
      };
    }
    
    setUserPreference(senderId, 'personality', mode);
    return { 
      text: `🎭 Personality set to *${mode}*! This will apply to future AI conversations. 🤖`, 
      private: isPrivate 
    };
  }, { 
    description: 'Set AI style (professional/casual/funny)',
    category: 'ai',
    usage: '[mode]'
  });

  // 📜 !history — View conversation stats
  registry.register('!history', async (msg, args, context) => {
    const { isPrivate, senderId } = context;
    const stats = getConversationStats(senderId);
    
    // Create a visual progress bar
    const filled = Math.round(stats.usagePercent / 10);
    const empty = 10 - filled;
    const bar = '▓'.repeat(filled) + '░'.repeat(empty);
    
    return { 
      text: `📜 *Your Conversation History*\n\n` +
        `Messages stored: ${stats.totalMessages} / ${stats.maxMessages}\n` +
        `Progress: ${bar} ${stats.usagePercent}%\n\n` +
        `📤 Your messages: ${stats.userMessages}\n` +
        `🤖 Bot replies: ${stats.botMessages}\n\n` +
        `💡 Use \`!clear\` to clear your conversation history`,
      private: isPrivate 
    };
  }, { 
    description: 'View your conversation stats',
    category: 'ai'
  });

  // 📝 !note — Personal notes management
  registry.register('!note', async (msg, args, context) => {
    const { isPrivate, senderId } = context;
    const { addNote, getNotes, deleteNote } = require('../db');
    
    if (!args) {
      return { 
        text: '📝 *Note Commands:*\n\n• `!note add [text]` — Add a note\n• `!note list` — View all notes\n• `!note delete [number]` — Delete a note', 
        private: isPrivate 
      };
    }

    const noteArgs = args.split(' ');
    const subCommand = noteArgs[0].toLowerCase();

    if (subCommand === 'add') {
      const noteText = noteArgs.slice(1).join(' ').trim();
      if (!noteText) {
        return { 
          text: '❌ Please provide note text. Example: `!note add Buy groceries tomorrow`', 
          private: isPrivate 
        };
      }
      const noteId = addNote(senderId, noteText);
      return { 
        text: `📝 Note #${noteId} saved! ✅\n\n*${noteText.substring(0, 100)}${noteText.length > 100 ? '...' : ''}*`, 
        private: isPrivate 
      };
    }

    if (subCommand === 'list') {
      const notes = getNotes(senderId);
      if (notes.length === 0) {
        return { 
          text: '📝 You have no saved notes.\n\nUse `!note add [text]` to create one!', 
          private: isPrivate 
        };
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
        return { 
          text: '❌ Please provide a valid note number. Example: `!note delete 1`', 
          private: isPrivate 
        };
      }
      const notes = getNotes(senderId);
      if (noteNum > notes.length) {
        return { 
          text: `❌ Note #${noteNum} doesn't exist. You have ${notes.length} note(s).`, 
          private: isPrivate 
        };
      }
      if (deleteNote(senderId, notes[noteNum - 1].id)) {
        return { 
          text: `🗑️ Note #${noteNum} deleted! ✅`, 
          private: isPrivate 
        };
      }
      return { 
        text: '❌ Failed to delete note. Please try again.', 
        private: isPrivate 
      };
    }

    return { 
      text: '❌ Unknown note command. Use: add, list, or delete', 
      private: isPrivate 
    };
  }, { 
    description: 'Save personal notes',
    category: 'personal',
    usage: '[add|list|delete] [text|number]'
  });

  // ⏰ !reminder — Set reminders
  registry.register('!reminder', async (msg, args, context) => {
    const { isPrivate, senderId, chatId, isGroup } = context;
    const { addReminder, getReminders } = require('../db');
    
    if (!args) {
      return { 
        text: '⏰ *Reminder Commands:*\n\n• `!reminder [time] [message]` — Set a reminder\n• `!reminder list` — View pending reminders\n\n*Time formats:*\n• 10m = 10 minutes\n• 1h = 1 hour\n• 2h30m = 2 hours 30 minutes\n• 1d = 1 day\n\nExample: `!reminder 30m Call mom`', 
        private: isPrivate 
      };
    }

    const reminderArgs = args.split(' ');
    const subCommand = reminderArgs[0].toLowerCase();

    if (subCommand === 'list') {
      const reminders = getReminders(senderId);
      const pending = reminders.filter(r => !r.completed && r.triggerTime > Date.now());
      if (pending.length === 0) {
        return { 
          text: '⏰ You have no pending reminders.\n\nUse `!reminder [time] [message]` to set one!', 
          private: isPrivate 
        };
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
      return { 
        text: '❌ Invalid time format. Use: 30m, 1h, 2h30m, or 1d', 
        private: isPrivate 
      };
    }

    const days = parseInt(timeMatch[1] || 0);
    const hours = parseInt(timeMatch[2] || 0);
    const minutes = parseInt(timeMatch[3] || 0);

    if (days === 0 && hours === 0 && minutes === 0) {
      return { 
        text: '❌ Please specify a valid time. Example: 30m, 1h, 2h30m', 
        private: isPrivate 
      };
    }

    const totalMs = (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
    if (totalMs < 60000) {
      return { 
        text: '❌ Reminder time must be at least 1 minute.', 
        private: isPrivate 
      };
    }
    if (totalMs > 7 * 24 * 60 * 60 * 1000) {
      return { 
        text: '❌ Reminder time cannot exceed 7 days.', 
        private: isPrivate 
      };
    }

    const reminderMsg = reminderArgs.slice(1).join(' ').trim();
    if (!reminderMsg) {
      return { 
        text: '❌ Please include a reminder message. Example: `!reminder 30m Call mom`', 
        private: isPrivate 
      };
    }

    const triggerTime = Date.now() + totalMs;
    const reminderId = addReminder(senderId, chatId, reminderMsg, triggerTime, isGroup);

    const timeStr = days > 0 ? `${days}d` : hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}` : `${minutes}m`;
    return { 
      text: `⏰ Reminder set for *${timeStr}* from now!\n\n📝 ${reminderMsg}\n\nI'll notify you when it's time. ✅`, 
      private: isPrivate 
    };
  }, { 
    description: 'Set a reminder',
    category: 'personal',
    usage: '[time] [message]'
  });

  // ✅ !task — Task Management
  registry.register('!task', async (msg, args, context) => {
    const { isPrivate, senderId } = context;
    const { addTask, getTasks, completeTask, deleteTask } = require('../db');
    
    if (!args) {
      return { 
        text: '✅ *Task Management*\n\n• `!task add [task]` — Add new task\n• `!task list` — View pending tasks\n• `!task done [number]` — Mark task complete\n• `!task delete [number]` — Remove task\n\nExample: `!task add Buy groceries tomorrow`', 
        private: isPrivate 
      };
    }

    const taskArgs = args.split(' ');
    const subCommand = taskArgs[0].toLowerCase();

    if (subCommand === 'add') {
      const taskText = taskArgs.slice(1).join(' ').trim();
      if (!taskText) {
        return { 
          text: '❌ Please provide task text.\nExample: `!task add Call mom at 5pm`', 
          private: isPrivate 
        };
      }
      const taskId = addTask(senderId, taskText);
      if (taskId) {
        return { 
          text: `✅ Task added!\n\n📝 ${taskText.substring(0, 100)}${taskText.length > 100 ? '...' : ''}\n\nUse \`!task list\` to see all tasks.`, 
          private: isPrivate 
        };
      }
      return { 
        text: '❌ Failed to add task. Please try again.', 
        private: isPrivate 
      };
    }

    if (subCommand === 'list') {
      const tasks = getTasks(senderId, false);
      const allTasks = getTasks(senderId, true);
      const completedCount = allTasks.filter(t => t.completed).length;
      
      if (tasks.length === 0) {
        return { 
          text: `✅ You have no pending tasks!\n${completedCount > 0 ? `\n📊 ${completedCount} completed task(s).` : ''}\n\nUse \`!task add [task]\` to create one!`, 
          private: isPrivate 
        };
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
        return { 
          text: '❌ Please provide a valid task number.\nExample: `!task done 1`', 
          private: isPrivate 
        };
      }
      if (completeTask(senderId, taskNum)) {
        return { 
          text: `✅ Task #${taskNum} marked as complete! Great job! 🎉`, 
          private: isPrivate 
        };
      }
      return { 
        text: `❌ Could not complete task #${taskNum}. Make sure it exists and isn't already done.`, 
        private: isPrivate 
      };
    }

    if (subCommand === 'delete') {
      const taskNum = parseInt(taskArgs[1]);
      if (isNaN(taskNum) || taskNum < 1) {
        return { 
          text: '❌ Please provide a valid task number.\nExample: `!task delete 1`', 
          private: isPrivate 
        };
      }
      if (deleteTask(senderId, taskNum)) {
        return { 
          text: `🗑️ Task #${taskNum} deleted!`, 
          private: isPrivate 
        };
      }
      return { 
        text: `❌ Could not delete task #${taskNum}. Make sure it exists.`, 
        private: isPrivate 
      };
    }

    return { 
      text: '❌ Unknown task command.\nUse: `add`, `list`, `done`, or `delete`', 
      private: isPrivate 
    };
  }, { 
    description: 'Manage to-do tasks',
    category: 'personal',
    usage: '[add|list|done|delete] [task|number]'
  });
}

module.exports = {
  registerAICommands,
};
