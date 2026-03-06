// ============================================
// 📋 Commands Index — Modular Command System Entry Point
// ============================================
// This file registers all command categories and provides
// a unified command handling interface that maintains
// backward compatibility with the original commands.js

// Import the command registry
const { CommandRegistry, registry } = require('./registry');

// Import all command modules
const { registerFunCommands } = require('./fun');
const { registerUtilityCommands } = require('./utilities');
const { registerGroupManagementCommands } = require('./group_management');
const { registerAICommands } = require('./ai_commands');
const { registerAdminCommands } = require('./admin');
const { registerPollCommands } = require('./polls');

// Import utilities
const { logger } = require('../logger');
const { trackCommand } = require('../db');
const { 
  handleCommandError, 
  handleUnknownCommand,
  withCommandErrorHandling,
  USER_FRIENDLY_ERRORS
} = require('../errorHandler');

// Command prefix
const PREFIX = '!';

// ============================================
// Register All Command Categories
// ============================================

function initializeCommands() {
  // Register all command categories
  registerFunCommands(registry);
  registerUtilityCommands(registry);
  registerGroupManagementCommands(registry);
  registerAICommands(registry);
  registerAdminCommands(registry);
  registerPollCommands(registry);

  logger.command(`Registered ${registry.getAll().size} commands in ${registry.getCategories().length} categories`);
  
  // Log registered commands for debugging
  const categories = registry.getCategories();
  categories.forEach(category => {
    const commands = registry.getByCategory(category);
    logger.debug(`Category '${category}': ${commands.join(', ')}`);
  });
}

// Initialize commands on module load
initializeCommands();

// ============================================
// Helper Functions
// ============================================

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
 * Handle a command using the modular registry
 * @param {string} command — Command name
 * @param {string} args — Command arguments
 * @param {object} context — Context object
 * @returns {Promise<{text: string, private: boolean}|null>}
 */
async function handleCommand(command, args, context) {
  const { msg, client, senderId, senderName, isGroup, chatId, fromMe } = context;
  
  // Check if user is admin
  const isAdmin = isAdminUser(senderId) || fromMe;
  
  // Build extended context with additional properties
  const extendedContext = {
    ...context,
    isAdmin,
    isPrivate: false, // Will be set below
  };
  
  // Get the command from registry
  const cmd = registry.get(command);
  
  // Command not found - return null (unknown command)
  if (!cmd) {
    return null;
  }
  
  // Check admin-only permission
  if (cmd.adminOnly && !isAdmin) {
    logger.debug(`Command blocked: ${command} is admin-only but user is not admin`);
    return null;
  }
  
  // Check group-only permission
  if (cmd.groupOnly && !isGroup) {
    return { 
      text: `❌ This command only works in groups.`, 
      private: cmd.adminOnly 
    };
  }
  
  // Track command usage
  trackCommand(command, senderId);
  
  // Determine if response should be private (admin commands = private)
  const isPrivate = cmd.adminOnly;
  extendedContext.isPrivate = isPrivate;
  
  try {
    // Execute the command handler
    const result = await cmd.handler(msg, args, extendedContext);
    return result;
  } catch (error) {
    // Use the centralized error handler
    handleCommandError(msg, error, command);
    return { 
      text: null, 
      error: true,
      private: isPrivate 
    };
  }
}

/**
 * Get help text for the registry
 * @param {boolean} isAdmin — Whether user is admin
 * @returns {string} — Formatted help text
 */
function getHelpText(isAdmin = false) {
  return registry.generateHelp(isAdmin);
}

// ============================================
// Module Exports
// ============================================

module.exports = {
  // Main exports
  parseCommand,
  handleCommand,
  getHelpText,
  isAdminUser,
  registry,
  CommandRegistry,
  
  // Re-export for backward compatibility
  executeBroadcast: require('./admin').executeBroadcast,
};
