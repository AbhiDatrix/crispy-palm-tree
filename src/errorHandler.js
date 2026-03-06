// ============================================
// ⚠️ errorHandler.js — Centralized Error Handling
// ============================================
// Provides consistent error handling across all commands
// Maps technical errors to user-friendly messages
//
// UPGRADE v1.0:
// - Centralized error handling for all commands
// - User-friendly error messages
// - Structured error logging
// - Command-specific error handling
// - AI error handling
// ============================================

const { logger } = require('./logger');

// ============================================
// 🗺️ User-Friendly Error Messages Mapping
// ============================================
const USER_FRIENDLY_ERRORS = {
  // Connection errors
  'ECONNREFUSED': 'Unable to connect to the server. Please try again later.',
  'ETIMEDOUT': 'Request timed out. Please try again.',
  'ENOTFOUND': 'Unable to find the server. Please check your internet connection.',
  'ECONNRESET': 'Connection was reset. Please try again.',
  
  // Rate limiting
  'rate_limit': 'Too many requests. Please wait a moment and try again.',
  'RATE_LIMIT': 'Too many requests. Please wait a moment and try again.',
  'too_many_requests': 'Too many requests. Please wait a moment and try again.',
  
  // Command errors
  'invalid_args': 'Invalid arguments provided. Check the command usage with !help.',
  'INVALID_ARGS': 'Invalid arguments provided. Check the command usage with !help.',
  'missing_args': 'Missing required arguments. Check the command usage with !help.',
  'MISSING_ARGS': 'Missing required arguments. Check the command usage with !help.',
  
  // Permission errors
  'permission_denied': "You don't have permission to use this command.",
  'PERMISSION_DENIED': "You don't have permission to use this command.",
  'admin_required': "This command requires admin privileges.",
  'ADMIN_REQUIRED': "This command requires admin privileges.",
  'group_required': 'This command only works in groups.',
  'GROUP_REQUIRED': 'This command only works in groups.',
  
  // API errors
  'api_error': 'External service unavailable. Please try again later.',
  'API_ERROR': 'External service unavailable. Please try again later.',
  'invalid_api_key': 'API key is invalid. Please contact the bot admin.',
  'INVALID_API_KEY': 'API key is invalid. Please contact the bot admin.',
  
  // Database errors
  'db_error': 'Unable to complete that action. Please try again.',
  'DB_ERROR': 'Unable to complete that action. Please try again.',
  'database_error': 'Unable to complete that action. Please try again.',
  
  // Not found errors
  'not_found': 'The requested resource was not found.',
  'NOT_FOUND': 'The requested resource was not found.',
  
  // News API errors
  'NEWS_API_KEY_NOT_CONFIGURED': 'News API is not configured. Please contact the bot administrator.',
  'NEWS_API_INVALID_KEY': 'News API key is invalid. Please contact the bot administrator.',
  'NEWS_API_RATE_LIMITED': 'News service is rate limited. Please try again later.',
  'NEWS_API_FAILED': 'Unable to fetch news at the moment. Please try again.',
  'NEWS_API_SEARCH_FAILED': 'Unable to search for news. Please try a different query.',
  'NEWS_API_TIMEOUT': 'News service is taking too long. Please try again.',
  'NEWS_API_INVALID_TOPIC': 'Invalid news topic. Please try a different topic.',
  
  // Command not found
  'COMMAND_NOT_FOUND': "I don't recognize that command. Use !help to see available commands.",
  
  // Generic errors
  'unknown': 'Oops! Something went wrong. Please try again later.',
  'UNKNOWN': 'Oops! Something went wrong. Please try again later.',
};

// ============================================
// 📝 Command Error Class
// ============================================
class CommandError extends Error {
  /**
   * Create a command error
   * @param {string} message - Technical error message
   * @param {string} code - Error code
   * @param {string} userMessage - User-friendly message
   */
  constructor(message, code, userMessage) {
    super(message);
    this.name = 'CommandError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

// ============================================
// 🔧 Error Handler Functions
// ============================================

/**
 * Handle errors from command execution
 * @param {Object} msg - WhatsApp message object
 * @param {Error} error - Error object
 * @param {string} commandName - Name of the command that failed
 */
function handleCommandError(msg, error, commandName) {
  // Log the error with full details
  const chatId = msg?.chatId?.user || msg?.chatId || 'unknown';
  
  logger.error(`Command error: ${commandName}`, {
    chatId,
    command: commandName,
    error: error.message,
    stack: error.stack,
    code: error.code
  });

  // Determine user-friendly message
  let userMessage = error.userMessage;
  
  if (!userMessage) {
    // Try to find in mapping by error code
    if (error.code) {
      userMessage = USER_FRIENDLY_ERRORS[error.code];
    }
    // Try to find in mapping by error message keyword
    if (!userMessage) {
      const errorKey = Object.keys(USER_FRIENDLY_ERRORS).find(
        key => error.message.toLowerCase().includes(key.toLowerCase().replace(/_/g, ' '))
      );
      userMessage = USER_FRIENDLY_ERRORS[errorKey];
    }
    // Default fallback
    if (!userMessage) {
      userMessage = USER_FRIENDLY_ERRORS.unknown;
    }
  }

  // Send user-friendly message to user
  try {
    if (msg && typeof msg.reply === 'function') {
      msg.reply(userMessage);
    }
  } catch (replyError) {
    logger.error('Failed to send error reply', {
      originalError: error.message,
      replyError: replyError.message
    });
  }
}

/**
 * Handle errors from AI processing
 * @param {Object} msg - WhatsApp message object
 * @param {Error} error - Error object
 */
function handleAIError(msg, error) {
  const chatId = msg?.chatId?.user || msg?.chatId || 'unknown';
  
  logger.error('AI processing error', {
    chatId,
    error: error.message,
    stack: error.stack
  });

  // Send generic error message
  try {
    if (msg && typeof msg.reply === 'function') {
      msg.reply("I'm having trouble processing your request right now. Please try again in a moment.");
    }
  } catch (replyError) {
    logger.error('Failed to send AI error reply', {
      replyError: replyError.message
    });
  }
}

/**
 * Handle database errors
 * @param {Object} msg - WhatsApp message object
 * @param {Error} error - Error object
 */
function handleDatabaseError(msg, error) {
  const chatId = msg?.chatId?.user || msg?.chatId || 'unknown';
  
  logger.error('Database error', {
    chatId,
    error: error.message,
    stack: error.stack
  });

  try {
    if (msg && typeof msg.reply === 'function') {
      msg.reply(USER_FRIENDLY_ERRORS.database_error);
    }
  } catch (replyError) {
    logger.error('Failed to send database error reply', {
      replyError: replyError.message
    });
  }
}

/**
 * Handle permission errors
 * @param {Object} msg - WhatsApp message object
 * @param {string} permissionType - Type of permission that was denied
 */
function handlePermissionError(msg, permissionType = 'permission_denied') {
  const userMessage = USER_FRIENDLY_ERRORS[permissionType] || USER_FRIENDLY_ERRORS.permission_denied;
  
  logger.warn('Permission denied', {
    chatId: msg?.chatId?.user || msg?.chatId || 'unknown',
    permissionType
  });

  try {
    if (msg && typeof msg.reply === 'function') {
      msg.reply(userMessage);
    }
  } catch (replyError) {
    logger.error('Failed to send permission error reply', {
      replyError: replyError.message
    });
  }
}

/**
 * Handle not found errors
 * @param {Object} msg - WhatsApp message object
 * @param {string} resource - Type of resource that wasn't found
 */
function handleNotFoundError(msg, resource = 'item') {
  const userMessage = `The ${resource} you're looking for wasn't found.`;
  
  logger.debug('Resource not found', {
    chatId: msg?.chatId?.user || msg?.chatId || 'unknown',
    resource
  });

  try {
    if (msg && typeof msg.reply === 'function') {
      msg.reply(userMessage);
    }
  } catch (replyError) {
    logger.error('Failed to send not found error reply', {
      replyError: replyError.message
    });
  }
}

/**
 * Handle invalid arguments errors
 * @param {Object} msg - WhatsApp message object
 * @param {string} usage - Correct usage example
 */
function handleInvalidArgsError(msg, usage = '') {
  const userMessage = usage 
    ? `Invalid usage. Example: ${usage}`
    : USER_FRIENDLY_ERRORS.invalid_args;
  
  logger.debug('Invalid arguments', {
    chatId: msg?.chatId?.user || msg?.chatId || 'unknown',
    usage
  });

  try {
    if (msg && typeof msg.reply === 'function') {
      msg.reply(userMessage);
    }
  } catch (replyError) {
    logger.error('Failed to send invalid args error reply', {
      replyError: replyError.message
    });
  }
}

/**
 * Handle unknown command errors
 * @param {Object} msg - WhatsApp message object
 */
function handleUnknownCommand(msg) {
  try {
    if (msg && typeof msg.reply === 'function') {
      msg.reply(USER_FRIENDLY_ERRORS.COMMAND_NOT_FOUND);
    }
  } catch (replyError) {
    logger.error('Failed to send unknown command error reply', {
      replyError: replyError.message
    });
  }
}

// ============================================
// 🔄 Wrapper Functions
// ============================================

/**
 * Wrap a function with error handling
 * @param {Function} handler - Function to wrap
 * @param {Object} options - Options
 * @returns {Function} Wrapped function
 */
function withErrorHandling(handler, options = {}) {
  const {
    commandName = 'unknown',
    msg,
    onError = null,
  } = options;

  return async function(...args) {
    try {
      return await handler(...args);
    } catch (error) {
      logger.error(`Error in ${commandName}`, {
        command: commandName,
        error: error.message,
        stack: error.stack
      });

      if (onError) {
        onError(error);
      } else if (msg) {
        handleCommandError(msg, error, commandName);
      }

      // Return null to indicate failure without throwing
      return null;
    }
  };
}

/**
 * Wrap a command handler with error handling
 * @param {Function} handler - Command handler function
 * @param {string} commandName - Name of the command
 * @returns {Function} Wrapped handler
 */
function withCommandErrorHandling(handler, commandName) {
  return async function(msg, args, context) {
    try {
      return await handler(msg, args, context);
    } catch (error) {
      handleCommandError(msg, error, commandName);
      return { 
        text: null,
        error: true 
      };
    }
  };
}

// ============================================
// 🌐 Global Exception Handlers
// ============================================

/**
 * Setup global exception handlers
 * @param {Object} app - Express app or other server
 */
function setupGlobalErrorHandlers(app = null) {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack
    });
    
    // Exit with non-zero code for process manager to restart
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || String(reason),
      stack: reason?.stack
    });
  });

  logger.info('Global error handlers initialized');
}

// ============================================
// 📤 Module Exports
// ============================================

module.exports = {
  // Error classes
  CommandError,
  
  // Error handling functions
  handleCommandError,
  handleAIError,
  handleDatabaseError,
  handlePermissionError,
  handleNotFoundError,
  handleInvalidArgsError,
  handleUnknownCommand,
  
  // Wrapper functions
  withErrorHandling,
  withCommandErrorHandling,
  
  // Global error handlers
  setupGlobalErrorHandlers,
  
  // Error message mapping (for external use)
  USER_FRIENDLY_ERRORS,
};
