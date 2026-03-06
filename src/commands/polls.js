// ============================================
// 🗳️ Poll Commands — Create, Vote, End Polls
// ============================================

const { log } = require('../bot.js');
const { createPoll, getActivePoll, votePoll, endPoll, getPollResults } = require('../db');

/**
 * Register all poll commands with the registry
 * @param {Object} registry - Command registry instance
 */
function registerPollCommands(registry) {
  // 🗳️ !poll — Create polls in groups
  registry.register('!poll', async (msg, args, context) => {
    const { isPrivate, isGroup, isAdmin, chatId, senderId } = context;
    
    if (!isGroup) {
      return { 
        text: '🗳️ Polls only work in groups!\n\nUse this command in a group chat.', 
        private: isPrivate 
      };
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
      return { 
        text: '🗳️ *Poll Command*\n\nCreate a poll in this group:\n\n`!poll "Question?" "Option 1" "Option 2" "Option 3"`\n\n• Minimum 2 options\n• Maximum 10 options\n• Use quotes for multi-word options', 
        private: isPrivate 
      };
    }

    const pollSubCommand = args.split(' ')[0].toLowerCase();

    // Handle vote
    if (pollSubCommand === 'vote') {
      const voteArgs = args.split(' ');
      const voteNum = parseInt(voteArgs[1]);
      if (isNaN(voteNum) || voteNum < 1) {
        return { 
          text: '❌ Please provide a valid option number.\nExample: `!poll vote 1`', 
          private: isPrivate 
        };
      }
      const activePoll = getActivePoll(chatId);
      if (!activePoll) {
        return { 
          text: '❌ No active poll in this group.\nCreate one with `!poll "Question?" "Yes" "No"`', 
          private: isPrivate 
        };
      }
      if (votePoll(activePoll.id, voteNum - 1, senderId)) {
        return { 
          text: `✅ Vote recorded for option ${voteNum}!`, 
          private: isPrivate 
        };
      }
      return { 
        text: '❌ Could not record vote. Make sure the option exists.', 
        private: isPrivate 
      };
    }

    // Handle end poll
    if (pollSubCommand === 'end') {
      const activePoll = getActivePoll(chatId);
      if (!activePoll) {
        return { 
          text: '❌ No active poll to end.', 
          private: isPrivate 
        };
      }
      // Only creator or admin can end
      if (activePoll.createdBy !== senderId && !isAdmin) {
        return { 
          text: '❌ Only the poll creator or admin can end this poll.', 
          private: isPrivate 
        };
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
      return { 
        text: '❌ Could not end poll.', 
        private: isPrivate 
      };
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
        return { 
          text: '❌ Invalid format!\n\nUse: `!poll "Question?" "Option 1" "Option 2"`\n\nMake sure to use quotes around each option.', 
          private: isPrivate 
        };
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
      return { 
        text: '❌ Failed to create poll. Please try again.', 
        private: isPrivate 
      };
    } catch (error) {
      log('error', 'Poll creation error: ' + error.message);
      return { 
        text: '❌ Error creating poll. Use format: `!poll "Question?" "Yes" "No"`', 
        private: isPrivate 
      };
    }
  }, { 
    description: 'Create polls in groups',
    category: 'polls',
    groupOnly: true,
    usage: '["Question?" "Opt1" "Opt2"] or [vote|end] [number]'
  });
}

module.exports = {
  registerPollCommands,
};
