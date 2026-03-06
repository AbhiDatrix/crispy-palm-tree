// ============================================
// 📝 logger.js — Structured Logging Utility
// ============================================
// Provides structured logging with levels, timestamps, and file output
// Log files are created daily in the logs/ directory
//
// UPGRADE v1.0:
// - Structured JSON logging for better parsing
// - Daily rotating log files
// - Multiple log levels: error, warn, info, debug, command, ai, message
// - Both console and file output
// ============================================

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');

// ============================================
// 🎨 Terminal Colors & Formatting (for console output)
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
};

// ============================================
// 📂 Log Level Configuration
// ============================================
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  command: 2,
  ai: 3,
  message: 4,
  info: 5,
  debug: 6,
};

const LOG_LEVEL_COLORS = {
  error: Colors.red,
  warn: Colors.yellow,
  command: Colors.magenta,
  ai: Colors.blue,
  message: Colors.white,
  info: Colors.cyan,
  debug: Colors.dim,
};

const LOG_LEVEL_EMOJIS = {
  error: '❌',
  warn: '⚠️',
  command: '🎮',
  ai: '🤖',
  message: '💬',
  info: 'ℹ️',
  debug: '🔍',
};

// ============================================
// � Logger Class
// ============================================
class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL] : LOG_LEVELS.info;
    this.ensureLogDir();
    this.logFile = this.getLogFile();
  }

  /**
   * Ensure the logs directory exists
   */
  ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  /**
   * Get today's log file path
   * @returns {string} Log file path
   */
  getLogFile() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(LOG_DIR, `bot-${date}.log`);
  }

  /**
   * Check if we should log at this level
   * @param {string} level - Log level
   * @returns {boolean}
   */
  shouldLog(level) {
    return LOG_LEVELS[level] <= this.logLevel;
  }

  /**
   * Format message as JSON for file logging
   * @param {string} level - Log level
   * @param {string} message - Message to log
   * @param {Object} meta - Additional metadata
   * @returns {string} JSON formatted message
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
  }

  /**
   * Format message for console output with colors
   * @param {string} level - Log level
   * @param {string} message - Message to log
   * @returns {string} Formatted console message
   */
  formatConsoleMessage(level, message) {
    const timestamp = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    const emoji = LOG_LEVEL_EMOJIS[level] || '';
    const color = LOG_LEVEL_COLORS[level] || Colors.white;
    
    return `${color}[${timestamp}] ${emoji}${Colors.reset} ${message}`;
  }

  /**
   * Write log message to both console and file
   * @param {string} level - Log level
   * @param {string} message - Message to log
   * @param {Object} meta - Additional metadata
   */
  write(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    // Format for file (JSON)
    const fileMessage = this.formatMessage(level, message, meta);
    
    // Format for console (colored)
    const consoleMessage = this.formatConsoleMessage(level, message);

    // Write to console
    console.log(consoleMessage);

    // Write to file
    try {
      // Check if we need a new log file (date changed)
      const currentLogFile = this.getLogFile();
      if (currentLogFile !== this.logFile) {
        this.logFile = currentLogFile;
      }
      
      fs.appendFileSync(this.logFile, fileMessage + '\n');
    } catch (err) {
      console.error('Failed to write to log file:', err.message);
    }
  }

  // ============================================
  // 🚀 Log Level Methods
  // ============================================

  /**
   * Log error level message
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   */
  error(message, meta) {
    this.write('error', message, meta);
  }

  /**
   * Log warning level message
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta) {
    this.write('warn', message, meta);
  }

  /**
   * Log info level message
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta) {
    this.write('info', message, meta);
  }

  /**
   * Log debug level message
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta) {
    this.write('debug', message, meta);
  }

  /**
   * Log command level message
   * @param {string} message - Command message
   * @param {Object} meta - Additional metadata
   */
  command(message, meta) {
    this.write('command', message, meta);
  }

  /**
   * Log AI level message
   * @param {string} message - AI message
   * @param {Object} meta - Additional metadata
   */
  ai(message, meta) {
    this.write('ai', message, meta);
  }

  /**
   * Log message level message
   * @param {string} message - Message content
   * @param {Object} meta - Additional metadata
   */
  message(message, meta) {
    this.write('message', message, meta);
  }

  /**
   * Log success level message (alias for info with green color)
   * @param {string} message - Success message
   * @param {Object} meta - Additional metadata
   */
  success(message, meta) {
    this.write('info', message, { ...meta, success: true });
  }

  // ============================================
  // 🔧 Utility Methods
  // ============================================

  /**
   * Log an error with full stack trace
   * @param {Error} error - Error object
   * @param {Object} meta - Additional metadata
   */
  logError(error, meta = {}) {
    this.error(error.message, {
      ...meta,
      stack: error.stack,
      name: error.name
    });
  }

  /**
   * Set the log level dynamically
   * @param {string} level - Log level name
   */
  setLevel(level) {
    if (LOG_LEVELS.hasOwnProperty(level)) {
      this.logLevel = LOG_LEVELS[level];
      this.info(`Log level set to: ${level}`);
    }
  }

  /**
   * Get current log level name
   * @returns {string} Current log level
   */
  getLevel() {
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === this.logLevel);
  }
}

// Create singleton instance
const logger = new Logger();

// Export both the logger instance and the class for testing
module.exports = {
  Logger,
  logger,
  LOG_LEVELS,
  Colors,
};
