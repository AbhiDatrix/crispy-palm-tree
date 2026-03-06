// ============================================
// ⚙️ configLoader.js — Configuration Loading Utility
// ============================================
// Provides utilities to load configuration from JSON files.
// Falls back to defaults if files are missing.
// ============================================

const fs = require('fs');
const path = require('path');

// Get the config directory (project root/config)
const CONFIG_DIR = path.join(process.cwd(), 'config');

/**
 * Load configuration from a JSON file.
 * @param {string} filename - Name of the JSON config file to load
 * @returns {object|null} - Parsed JSON config or null if error
 */
function loadConfig(filename) {
  const filePath = path.join(CONFIG_DIR, filename);
  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`⚠️ Error loading config from ${filename}:`, error.message);
    return null;
  }
}

/**
 * Load AI personalities from ai_personalities.json
 * @returns {object} Object mapping personality names to their configurations
 */
function loadAIPersonalities() {
  const data = loadConfig('ai_personalities.json');
  return data || {};
}

// Default fallback personalities (used if config file is missing)
const DEFAULT_PERSONALITIES = {
  default: {
    description: "You are a helpful, knowledgeable AI assistant.",
    temperature: 0.7,
    maxTokens: 200,
    tone: "professional yet friendly"
  },
  professional: {
    description: "You are a formal, business-oriented AI assistant.",
    temperature: 0.7,
    maxTokens: 200,
    tone: "formal and professional"
  },
  casual: {
    description: "You are a friendly, conversational AI assistant.",
    temperature: 0.7,
    maxTokens: 200,
    tone: "friendly and conversational"
  },
  funny: {
    description: "You are a humorous, playful AI assistant.",
    temperature: 0.8,
    maxTokens: 200,
    tone: "humorous and playful"
  },
  chatbot: {
    description: "You are a detailed, comprehensive AI assistant like ChatGPT.",
    temperature: 0.8,
    maxTokens: 800,
    tone: "conversational and detailed"
  }
};

// Cached personalities for performance
let cachedPersonalities = null;

/**
 * Get AI personalities (with caching)
 * @returns {object} Personality configurations
 */
function getAIPersonalities() {
  if (!cachedPersonalities) {
    const loaded = loadAIPersonalities();
    // Merge loaded config with defaults to ensure all personalities exist
    cachedPersonalities = { ...DEFAULT_PERSONALITIES, ...loaded };
  }
  return cachedPersonalities;
}

/**
 * Get a specific personality by name
 * @param {string} name - Name of the personality
 * @returns {object} Personality configuration
 */
function getPersonality(name) {
  const personalities = getAIPersonalities();
  return personalities[name] || personalities.default;
}

/**
 * Reload AI personalities (useful for development hot-reload)
 */
function reloadAIPersonalities() {
  cachedPersonalities = null;
  console.log('🔄 AI personalities reloaded from config');
}

module.exports = {
  loadConfig,
  loadAIPersonalities,
  getAIPersonalities,
  getPersonality,
  reloadAIPersonalities,
  DEFAULT_PERSONALITIES,
};
