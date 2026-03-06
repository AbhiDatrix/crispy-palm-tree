// ============================================
// 📋 Command Registry — Central Command Management
// ============================================
// Provides a central system for registering and looking up commands
// Supports admin-only commands with the adminOnly option
// Supports command aliases for quick access

class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.categories = new Map();
    this.aliases = new Map();
    
    // Default command aliases
    this.aliases.set('!j', '!joke');
    this.aliases.set('!q', '!quote');
    this.aliases.set('!f', '!fact');
    this.aliases.set('!w', '!weather');
    this.aliases.set('!n', '!news');
    this.aliases.set('!a', '!ask');
    this.aliases.set('!p', '!personality');
    this.aliases.set('!h', '!help');
    this.aliases.set('!s', '!status');
  }

  /**
   * Add a command alias
   * @param {string} alias - The alias (e.g., '!j')
   * @param {string} command - The actual command (e.g., '!joke')
   */
  addAlias(alias, command) {
    if (this.commands.has(command)) {
      this.aliases.set(alias, command);
    }
    return this;
  }

  /**
   * Get the resolved command name from an alias
   * @param {string} name - Command name or alias
   * @returns {string|null} - Resolved command name or null
   */
  resolveAlias(name) {
    if (this.commands.has(name)) return name;
    return this.aliases.get(name) || null;
  }

  /**
   * Register a command with the registry
   * @param {string} name - Command name (e.g., '!joke')
   * @param {Function} handler - Async function to handle the command
   * @param {Object} options - Command options
   * @param {string} options.description - Command description for help
   * @param {string} options.category - Command category
   * @param {boolean} options.adminOnly - Whether only admins can use this command
   * @param {boolean} options.groupOnly - Whether command only works in groups
   * @param {string} options.usage - Usage example
   */
  register(name, handler, options = {}) {
    const commandData = {
      name,
      handler,
      description: options.description || '',
      category: options.category || 'general',
      adminOnly: options.adminOnly || false,
      groupOnly: options.groupOnly || false,
      usage: options.usage || '',
    };

    this.commands.set(name, commandData);

    // Track categories
    if (!this.categories.has(commandData.category)) {
      this.categories.set(commandData.category, []);
    }
    this.categories.get(commandData.category).push(name);

    return this;
  }

  /**
   * Get a command by name (resolves aliases)
   * @param {string} name - Command name or alias
   * @returns {Object|null} - Command data or null if not found
   */
  get(name) {
    // First check if it's a direct command
    if (this.commands.has(name)) {
      return this.commands.get(name);
    }
    // Then check if it's an alias
    const resolved = this.aliases.get(name);
    if (resolved && this.commands.has(resolved)) {
      return this.commands.get(resolved);
    }
    return null;
  }

  /**
   * Generate help text for aliases
   * @returns {string} - Formatted alias help text
   */
  generateAliasHelp() {
    let help = '⚡ *Quick Aliases:*\n';
    const aliasList = [];
    for (const [alias, command] of this.aliases) {
      aliasList.push({ alias, command });
    }
    // Sort by alias
    aliasList.sort((a, b) => a.alias.localeCompare(b.alias));
    aliasList.forEach(({ alias, command }) => {
      help += `• \`${alias}\` → \`${command}\`\n`;
    });
    return help;
  }

  /**
   * Get all registered commands
   * @returns {Map} - Map of all commands
   */
  getAll() {
    return this.commands;
  }

  /**
   * Get all commands in a specific category
   * @param {string} category - Category name
   * @returns {string[]} - Array of command names
   */
  getByCategory(category) {
    return this.categories.get(category) || [];
  }

  /**
   * Get all categories
   * @returns {string[]} - Array of category names
   */
  getCategories() {
    return Array.from(this.categories.keys());
  }

  /**
   * Check if a command exists (or is an alias)
   * @param {string} name - Command name or alias
   * @returns {boolean}
   */
  has(name) {
    return this.commands.has(name) || this.aliases.has(name);
  }

  /**
   * Get all aliases as an array
   * @returns {Array} - Array of {alias, command} objects
   */
  getAliases() {
    const aliasList = [];
    for (const [alias, command] of this.aliases) {
      aliasList.push({ alias, command });
    }
    return aliasList;
  }

  /**
   * Get all admin commands
   * @returns {Object[]} - Array of admin command objects
   */
  getAdminCommands() {
    const adminCmds = [];
    for (const [name, data] of this.commands) {
      if (data.adminOnly) {
        adminCmds.push({ name, ...data });
      }
    }
    return adminCmds;
  }

  /**
   * Get all public commands (non-admin)
   * @returns {Object[]} - Array of public command objects
   */
  getPublicCommands() {
    const publicCmds = [];
    for (const [name, data] of this.commands) {
      if (!data.adminOnly) {
        publicCmds.push({ name, ...data });
      }
    }
    return publicCmds;
  }

  /**
   * Generate help text for all commands
   * @param {boolean} isAdmin - Whether the user is an admin
   * @returns {string} - Formatted help text
   */
  generateHelp(isAdmin = false) {
    const categories = {
      general: [],
      ai: [],
      messaging: [],
      personal: [],
      fun: [],
      utilities: [],
      group: [],
      polls: [],
      admin: [],
    };

    // Sort commands into categories
    for (const [name, data] of this.commands) {
      if (data.adminOnly && !isAdmin) continue;
      
      if (!categories[data.category]) {
        categories[data.category] = [];
      }
      categories[data.category].push(data);
    }

    let help = '🤖 *Datrix Bot v3.0 — Command Guide*\n\n';

    // General commands
    if (categories.general.length > 0) {
      help += '📋 *General Commands:*\n';
      categories.general.forEach(cmd => {
        help += `• \`${cmd.name}\` — ${cmd.description}\n`;
      });
      help += '\n';
    }

    // AI & Chat
    if (categories.ai.length > 0) {
      help += '🧠 *AI & Chat:*\n';
      categories.ai.forEach(cmd => {
        help += `• \`${cmd.name}${cmd.usage ? ' ' + cmd.usage : ''}\` — ${cmd.description}\n`;
      });
      help += '\n';
    }

    // Messaging
    if (categories.messaging.length > 0) {
      help += '📤 *Messaging:*\n';
      categories.messaging.forEach(cmd => {
        help += `• \`${cmd.name}${cmd.usage ? ' ' + cmd.usage : ''}\` — ${cmd.description}\n`;
      });
      help += '\n';
    }

    // Personal Tools
    if (categories.personal.length > 0) {
      help += '📝 *Personal Tools:*\n';
      categories.personal.forEach(cmd => {
        help += `• \`${cmd.name}${cmd.usage ? ' ' + cmd.usage : ''}\` — ${cmd.description}\n`;
      });
      help += '\n';
    }

    // Fun Commands
    if (categories.fun.length > 0) {
      help += '🎉 *Fun Commands:*\n';
      categories.fun.forEach(cmd => {
        help += `• \`${cmd.name}\` — ${cmd.description}\n`;
      });
      help += '\n';
    }

    // Utilities
    if (categories.utilities.length > 0) {
      help += '🌤️ *Utilities:*\n';
      categories.utilities.forEach(cmd => {
        help += `• \`${cmd.name}${cmd.usage ? ' ' + cmd.usage : ''}\` — ${cmd.description}\n`;
      });
      help += '\n';
    }

    // Polls
    if (categories.polls.length > 0) {
      help += '🗳️ *Polls (Groups):*\n';
      categories.polls.forEach(cmd => {
        help += `• \`${cmd.name}${cmd.usage ? ' ' + cmd.usage : ''}\` — ${cmd.description}\n`;
      });
      help += '\n';
    }

    // Group Management
    if (categories.group.length > 0) {
      help += '🔧 *Group Management:*\n';
      categories.group.forEach(cmd => {
        help += `• \`${cmd.name}${cmd.usage ? ' ' + cmd.usage : ''}\` — ${cmd.description}\n`;
      });
      help += '\n';
    }

    // Admin Commands
    if (isAdmin && categories.admin.length > 0) {
      help += '🔐 *Admin Commands:*\n';
      categories.admin.forEach(cmd => {
        help += `• \`${cmd.name}${cmd.usage ? ' ' + cmd.usage : ''}\` — ${cmd.description}\n`;
      });
      help += '\n';
    }

    help += '💡 *Tips:*\n';
    help += '• In groups, @mention me to get a response\n';
    help += '• In DMs, just chat naturally!\n';
    help += '• All commands start with `!`\n';
    help += '• Use `!shorthelp` for quick alias reference\n';
    
    // Aliases section
    help += '\n⚡ *Command Aliases:*\n';
    const aliasList = this.getAliases();
    aliasList.sort((a, b) => a.alias.localeCompare(b.alias));
    aliasList.forEach(({ alias, command }) => {
      help += `• \`${alias}\` → \`${command}\`\n`;
    });

    return help;
  }
}

// Create singleton instance
const registry = new CommandRegistry();

module.exports = {
  CommandRegistry,
  registry,
};
