// ============================================
// 📂 dataLoader.js — JSON Data Loading Utility
// ============================================
// Provides utilities to load externalized data from JSON files.
// Falls back to empty arrays/objects if files are missing.
// ============================================

const fs = require('fs');
const path = require('path');

// Get the data directory (project root/data)
const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Load data from a JSON file.
 * @param {string} filename - Name of the JSON file to load
 * @returns {object|null} - Parsed JSON data or null if error
 */
function loadData(filename) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`⚠️ Error loading data from ${filename}:`, error.message);
    return null;
  }
}

/**
 * Load jokes from jokes.json
 * @returns {string[]} Array of jokes
 */
function loadJokes() {
  const data = loadData('jokes.json');
  return data?.jokes || [];
}

/**
 * Load quotes from quotes.json
 * @returns {Array} Array of quote objects with text and author
 */
function loadQuotes() {
  const data = loadData('quotes.json');
  return data?.quotes || [];
}

/**
 * Load facts from facts.json
 * @returns {string[]} Array of facts
 */
function loadFacts() {
  const data = loadData('facts.json');
  return data?.facts || [];
}

/**
 * Load weather conditions from weather-conditions.json
 * @returns {object} Object mapping weather codes to descriptions
 */
function loadWeatherConditions() {
  const data = loadData('weather-conditions.json');
  return data?.conditions || {};
}

// Cached data for performance (load once)
let cachedJokes = null;
let cachedQuotes = null;
let cachedFacts = null;
let cachedWeatherConditions = null;
let cachedFallbacks = null;

/**
 * Get jokes (with caching)
 * @returns {string[]}
 */
function getJokes() {
  if (!cachedJokes) {
    cachedJokes = loadJokes();
  }
  return cachedJokes;
}

/**
 * Get quotes (with caching)
 * @returns {Array}
 */
function getQuotes() {
  if (!cachedQuotes) {
    cachedQuotes = loadQuotes();
  }
  return cachedQuotes;
}

/**
 * Get facts (with caching)
 * @returns {string[]}
 */
function getFacts() {
  if (!cachedFacts) {
    cachedFacts = loadFacts();
  }
  return cachedFacts;
}

/**
 * Get weather conditions (with caching)
 * @returns {object}
 */
function getWeatherConditions() {
  if (!cachedWeatherConditions) {
    cachedWeatherConditions = loadWeatherConditions();
  }
  return cachedWeatherConditions;
}

/**
 * Load fallback responses from fallbacks.json
 * @returns {string[]} Array of fallback responses
 */
function loadFallbacks() {
  const data = loadData('fallbacks.json');
  return data?.fallbacks || [];
}

/**
 * Get fallback responses (with caching)
 * @returns {string[]}
 */
function getFallbacks() {
  if (!cachedFallbacks) {
    cachedFallbacks = loadFallbacks();
  }
  return cachedFallbacks;
}

/**
 * Reload all data (useful for development hot-reload)
 */
function reloadAllData() {
  cachedJokes = null;
  cachedQuotes = null;
  cachedFacts = null;
  cachedWeatherConditions = null;
  cachedFallbacks = null;
  console.log('🔄 Data reloaded from JSON files');
}

module.exports = {
  loadData,
  loadJokes,
  loadQuotes,
  loadFacts,
  loadWeatherConditions,
  loadFallbacks,
  getJokes,
  getQuotes,
  getFacts,
  getWeatherConditions,
  getFallbacks,
  reloadAllData,
};
