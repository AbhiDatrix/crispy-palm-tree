// ============================================
// 🎮 commands.js — Command System v2.2 (Backward Compatibility Layer)
// ============================================
// This file now delegates to the modular command system in src/commands/
// while maintaining backward compatibility with the original API.
//
// UPGRADE v3.0 (Modular):
// - Split commands into categories: fun, utilities, group_management, ai_commands, admin, polls
// - Central CommandRegistry pattern for extensibility
// - Maintain backward compatibility with existing code
// ============================================

// Import from the new modular command system
const {
  parseCommand,
  handleCommand,
  getHelpText,
  isAdminUser,
  registry,
  executeBroadcast,
} = require('./commands/index');

// Re-export everything for backward compatibility
module.exports = {
  // Main functions
  parseCommand,
  handleCommand,
  executeBroadcast,
  isAdminUser,
  
  // For backward compatibility
  getHelpText,
  registry,
};
