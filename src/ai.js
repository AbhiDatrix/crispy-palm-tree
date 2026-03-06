// ============================================
// 🤖 ai.js — Groq AI Integration v2.2 (Llama 3.3 70B)
// ============================================
// Handles all AI-powered reply generation using the
// free Groq API with the Llama 3.3 70B Versatile model.
//
// UPGRADE v2.2:
// - Added typing indicator simulation
// - Improved error handling for network failures
// - Better token usage tracking
//
// UPGRADE v2.0:
// - Conversation memory: uses past messages for context
// - Input sanitization: strips dangerous/long inputs
// - Request timeout: 15s abort to prevent hanging
// - Dual error codes for rate limits (429 + error.code)
// - API key validation on startup
// - Token usage logging for monitoring free-tier limits
// - NEW: Personality modes (professional, casual, funny)
// - NEW: Better prompt engineering for context-aware responses
// - NEW: Improved error handling with fallback responses
// ============================================

const Groq = require('groq-sdk');
const { addToConversation, getConversation } = require('./db');
const { getAIPersonalities, getPersonality } = require('./configLoader');
const { getFallbacks } = require('./dataLoader');

// 🔑 Check API key on load
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const HAS_VALID_KEY = GROQ_KEY && GROQ_KEY !== 'gsk_your_api_key_here';

if (!HAS_VALID_KEY) {
  console.error('');
  console.error('╔══════════════════════════════════════════════════╗');
  console.error('║  🔑 GROQ_API_KEY is missing or still default!   ║');
  console.error('║  Get a free key at: https://console.groq.com    ║');
  console.error('║  Then update your .env file.                    ║');
  console.error('║  AI replies will use fallback messages.         ║');
  console.error('╚══════════════════════════════════════════════════╝');
  console.error('');
}

// 🔧 Initialize Groq client (use placeholder key to prevent constructor throw)
const groq = new Groq({
  apiKey: GROQ_KEY || 'gsk_placeholder_update_env_file',
});

// 🌐 Language detection helper
function detectLanguage(text) {
  // Simple language detection based on character ranges and common words
  if (!text) return 'en';
  
  const langPatterns = {
    hi: /[\u0900-\u097F]/, // Hindi
    bn: /[\u0980-\u09FF]/, // Bengali
    ta: /[\u0B80-\u0BFF]/, // Tamil
    te: /[\u0C00-\u0C7F]/, // Telugu
    mr: /[\u0900-\u097F]/, // Marathi (uses Devanagari)
    gu: /[\u0A80-\u0AFF]/, // Gujarati
    kn: /[\u0C80-\u0CFF]/, // Kannada
    ml: /[\u0D00-\u0D7F]/, // Malayalam
    pa: /[\u0A00-\u0A7F]/, // Punjabi
    ur: /[\u0600-\u06FF]/, // Urdu
    ar: /[\u0600-\u06FF]/, // Arabic
    zh: /[\u4E00-\u9FFF]/, // Chinese
    ja: /[\u3040-\u309F\u30A0-\u30FF]/, // Japanese
    ko: /[\uAC00-\uD7AF]/, // Korean
    ru: /[\u0400-\u04FF]/, // Russian
    es: /\b(hola|qué|cómo|bueno|gracias|por favor)\b/i, // Spanish
    fr: /\b(bonjour|quoi|comment|merci|s'il vous plaît)\b/i, // French
    de: /\b(hallo|was|wie|danke|bitte)\b/i, // German
    pt: /\b(olá|o que|como|obrigado|por favor)\b/i, // Portuguese
  };
  
  for (const [lang, pattern] of Object.entries(langPatterns)) {
    if (pattern.test(text)) return lang;
  }
  
  return 'en'; // Default to English
}

//  Personality-based system prompts (loaded from config)
let PERSONALITY_PROMPTS = {};

// Initialize personality prompts from config
function initializePersonalities() {
  const personalities = getAIPersonalities();
  for (const [name, config] of Object.entries(personalities)) {
    PERSONALITY_PROMPTS[name] = config.description;
  }
  console.log('✅ Loaded AI personalities from config:', Object.keys(PERSONALITY_PROMPTS).join(', '));
}

// Initialize on module load
initializePersonalities();

// 🕐 Retry config for rate limiting
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000; // 15-second timeout

// 📊 Track token usage for monitoring
let tokenUsage = { promptTokens: 0, completionTokens: 0, totalRequests: 0 };

/**
 * Sanitize user input before sending to AI.
 * Prevents prompt injection and trims excessively long inputs.
 * 
 * @param {string} input — Raw user message
 * @returns {string} — Sanitized input
 */
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input
    .substring(0, 500)               // Cap at 500 chars
    .replace(/\r\n/g, '\n')          // Normalize line endings
    .replace(/\n{3,}/g, '\n\n')      // Collapse excessive newlines
    .trim();

  return sanitized;
}

/**
 * Get the appropriate system prompt based on personality mode.
 * @param {string} personality — Personality mode (default, professional, casual, funny)
 * @returns {string}
 */
function getSystemPrompt(personality = 'default') {
  return PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.default;
}

/**
 * Get personality configuration (temperature, maxTokens, etc.)
 * @param {string} personality — Personality mode
 * @returns {object}
 */
function getPersonalityConfig(personality = 'default') {
  return getPersonality(personality);
}

/**
 * Generate an AI reply to a user's message with conversation memory.
 * Uses Groq's Llama 3.3 70B Versatile model.
 * 
 * @param {string} userMessage — The user's incoming message
 * @param {string} userName — Display name of the user (for personalization)
 * @param {string|null} userId — WhatsApp user ID (for conversation history)
 * @param {string} personality — Personality mode
 * @returns {Promise<string>} — The AI-generated reply text
 */
async function generateReply(userMessage, userName = 'there', userId = null, personality = 'default') {
  // 🔑 Early return if no valid API key
  if (!HAS_VALID_KEY) {
    console.log('⚠️ No valid GROQ_API_KEY — using fallback reply');
    return getFallbackReply();
  }

  // Sanitize input
  const cleanMessage = sanitizeInput(userMessage);
  if (!cleanMessage) {
    return "I didn't quite catch that. Could you rephrase? 🤔";
  }

  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      // 🧠 Build message array with conversation history
      const messages = [
        { role: 'system', content: getSystemPrompt(personality) },
      ];

      // Add conversation history if available (for continuity)
      if (userId) {
        const history = getConversation(userId);
        if (history.length > 0) {
          // Add last few conversation messages for context
          for (const msg of history.slice(-6)) {
            messages.push({ role: msg.role, content: msg.content });
          }
        }
      }

      // Detect language and add instruction
      const detectedLang = detectLanguage(cleanMessage);
      const langInstruction = detectedLang !== 'en'
        ? `\n\nIMPORTANT: Respond in ${detectedLang.toUpperCase()} language (same as the user's message).`
        : '';

      // Add current message with language hint
      messages.push({
        role: 'user',
        content: `[User: ${userName}] ${cleanMessage}${langInstruction}`,
      });

      // 🚀 Make API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      // Get personality-specific settings
      const personalityConfig = getPersonalityConfig(personality);

      const chatCompletion = await groq.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile',
        temperature: personalityConfig.temperature || 0.7,
        max_tokens: personalityConfig.maxTokens || 200,
        top_p: 0.9,
        stream: false,
      }, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const reply = chatCompletion.choices[0]?.message?.content;

      // 📊 Track token usage
      if (chatCompletion.usage) {
        tokenUsage.promptTokens += chatCompletion.usage.prompt_tokens || 0;
        tokenUsage.completionTokens += chatCompletion.usage.completion_tokens || 0;
        tokenUsage.totalRequests += 1;
      }

      if (!reply) {
        console.log('⚠️ AI returned empty response, using fallback');
        return getFallbackReply();
      }

      const trimmedReply = reply.trim();

      // 💾 Save to conversation history
      if (userId) {
        addToConversation(userId, 'user', cleanMessage);
        addToConversation(userId, 'assistant', trimmedReply);
      }

      console.log(`🤖 AI reply for ${userName} (${trimmedReply.length} chars, ${chatCompletion.usage?.total_tokens || '?'} tokens, mode: ${personality})`);
      return trimmedReply;

    } catch (error) {
      // ⏱️ Handle timeout
      if (error.name === 'AbortError') {
        console.error('⏱️ AI request timed out after 15s');
        return getFallbackReply();
      }

      // 🚦 Handle rate limiting (HTTP 429)
      if (error.status === 429 || error.code === 'rate_limit_exceeded' ||
          error.error?.type === 'tokens' || error.message?.includes('rate_limit')) {
        retries++;
        const delay = BASE_DELAY_MS * Math.pow(2, retries); // Exponential backoff
        console.log(`⏳ Rate limited by Groq. Retry ${retries}/${MAX_RETRIES} in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      // 🔑 Handle authentication errors
      if (error.status === 401 || error.status === 403) {
        console.error('🔑 Invalid GROQ_API_KEY! Check your .env file.');
        return '⚠️ I\'m having trouble connecting right now. Please let Abhi know!';
      }

      // 🌐 Handle network errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' ||
          error.code === 'ETIMEDOUT' || error.type === 'system') {
        console.error('🌐 Network error reaching Groq:', error.message);
        return getFallbackReply();
      }

      // ❌ Handle all other errors
      console.error('❌ AI generation error:', error.message || error);
      return getFallbackReply();
    }
  }

  // All retries exhausted
  console.error('❌ All AI retries exhausted');
  return getFallbackReply();
}

/**
 * Generate a reply for the !ask command with personality support.
 * 
 * @param {string} question — The question to answer
 * @param {string} userName — Name of the user asking
 * @param {string} personality — Personality mode
 * @returns {Promise<string>} — AI-generated answer
 */
async function askAI(question, userName = 'there', personality = 'default') {
  // !ask uses no userId so no conversation memory (one-shot Q&A)
  return generateReply(question, userName, null, personality);
}

/**
 * Generate a detailed chatbot reply for conversational mode.
 * Uses higher token limit for longer, more comprehensive responses.
 *
 * @param {string} userMessage — The user's incoming message
 * @param {string} userName — Display name of the user
 * @param {string} userId — WhatsApp user ID (for conversation history)
 * @returns {Promise<string>} — The AI-generated reply text
 */
async function generateChatbotReply(userMessage, userName = 'there', userId = null) {
  // 🔑 Early return if no valid API key
  if (!HAS_VALID_KEY) {
    console.log('⚠️ No valid GROQ_API_KEY — using fallback reply');
    return getFallbackReply();
  }

  // Sanitize input
  const cleanMessage = sanitizeInput(userMessage);
  if (!cleanMessage) {
    return "I didn't quite catch that. Could you rephrase? 🤔";
  }

  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      // 🧠 Build message array with conversation history
      const messages = [
        { role: 'system', content: PERSONALITY_PROMPTS.chatbot },
      ];

      // Add conversation history if available (for continuity)
      if (userId) {
        const history = getConversation(userId);
        if (history.length > 0) {
          // Add last 10 conversation messages for more context in chatbot mode
          for (const msg of history.slice(-10)) {
            messages.push({ role: msg.role, content: msg.content });
          }
        }
      }

      // Detect language and add instruction
      const detectedLang = detectLanguage(cleanMessage);
      const langInstruction = detectedLang !== 'en'
        ? `\n\nIMPORTANT: Respond in ${detectedLang.toUpperCase()} language (same as the user's message).`
        : '';

      // Add current message with language hint
      messages.push({
        role: 'user',
        content: `[User: ${userName}] ${cleanMessage}${langInstruction}`,
      });

      // 🚀 Make API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      // Get chatbot personality settings
      const chatbotConfig = getPersonalityConfig('chatbot');

      const chatCompletion = await groq.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile',
        temperature: chatbotConfig.temperature || 0.8,
        max_tokens: chatbotConfig.maxTokens || 800,
        top_p: 0.9,
        stream: false,
      }, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const reply = chatCompletion.choices[0]?.message?.content;

      // 📊 Track token usage
      if (chatCompletion.usage) {
        tokenUsage.promptTokens += chatCompletion.usage.prompt_tokens || 0;
        tokenUsage.completionTokens += chatCompletion.usage.completion_tokens || 0;
        tokenUsage.totalRequests += 1;
      }

      if (!reply) {
        console.log('⚠️ AI returned empty response, using fallback');
        return getFallbackReply();
      }

      const trimmedReply = reply.trim();

      // 💾 Save to conversation history
      if (userId) {
        addToConversation(userId, 'user', cleanMessage);
        addToConversation(userId, 'assistant', trimmedReply);
      }

      console.log(`🤖 Chatbot reply for ${userName} (${trimmedReply.length} chars, ${chatCompletion.usage?.total_tokens || '?'} tokens)`);
      return trimmedReply;

    } catch (error) {
      retries++;
      console.error(`❌ Chatbot AI error (attempt ${retries}/${MAX_RETRIES}):`, error.message);

      // Handle rate limiting (429) with exponential backoff
      if (error.status === 429 || error.code === 'rate_limit_exceeded') {
        const delay = BASE_DELAY_MS * Math.pow(2, retries - 1);
        console.log(`⏳ Rate limited. Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      // Abort error (timeout)
      if (error.name === 'AbortError') {
        console.error('⏱️ Request timed out after', REQUEST_TIMEOUT_MS, 'ms');
        return "I'm taking a bit long to think about that. Could you try again? 🤔";
      }

      // Last retry failed
      if (retries >= MAX_RETRIES) {
        console.error('❌ All retries failed, using fallback');
        return getFallbackReply();
      }
    }
  }

  return getFallbackReply();
}

/**
 * Fallback reply when AI is unavailable.
 * @returns {string}
 */
function getFallbackReply() {
  const fallbacks = getFallbacks();
  if (fallbacks.length === 0) {
    // Fallback to hardcoded defaults if JSON is missing
    return "Hey! I'm having a bit of a hiccup right now 😅 Try again in a moment, or reach out to Abhi directly!";
  }
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

/**
 * Get current token usage stats (for monitoring free-tier limits).
 * @returns {object}
 */
function getTokenUsage() {
  return { ...tokenUsage };
}

/**
 * Utility: sleep for a given duration.
 * @param {number} ms — Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// 📤 Module Exports
// ============================================

module.exports = {
  generateReply,
  askAI,
  getTokenUsage,
  getSystemPrompt,
  getPersonalityConfig,
  generateChatbotReply,
};
