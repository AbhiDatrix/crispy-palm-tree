// ============================================
// 📩 monitor/message-handler.js — Message Type Handlers
// ============================================
// Handles processing of all WhatsApp message types:
// - Text (with emoji extraction)
// - Media (images, video, audio, documents)
// - Stickers
// - Locations
// - Contacts (vCards)
// - Polls
// ============================================

/**
 * Process a text message.
 * Extracts text content and emojis.
 * @param {object} msg — WhatsApp message object
 * @returns {Promise<object>} — Processed message data
 */
async function processTextMessage(msg) {
  const body = msg.body || '';

  // Extract emojis from text
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F400}-\u{1F4FF}]|[\u{1F500}-\u{1F5FF}]|[\u{1F700}-\u{1F77F}]|[\u{2300}-\u{23FF}]|[\u{2190}-\u{21FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F1E0}-\u{1F1FF}]/gu;
  const emojis = body.match(emojiRegex) || [];

  return {
    type: 'chat',
    body: body.substring(0, 5000), // Limit size
    emojiCount: emojis.length,
    emojis: [...new Set(emojis)].slice(0, 20), // Unique emojis, max 20
    wordCount: body.split(/\s+/).filter(w => w.length > 0).length,
    characterCount: body.length,
  };
}

/**
 * Process a media message (image, video, audio, document).
 * @param {object} msg — WhatsApp message object
 * @param {string} type — Media type: 'image', 'video', 'audio', 'ptt', 'document'
 * @returns {Promise<object>} — Processed message data
 */
async function processMediaMessage(msg, type) {
  const body = msg.body || ''; // Caption or filename

  let media = null;
  try {
    // Try to get media metadata without downloading
    if (msg._data) {
      media = {
        mimetype: msg._data.mimetype || null,
        filename: msg._data.filename || null,
        fileSize: msg._data.size || null,
        duration: msg._data.duration || null,
        width: msg._data.width || null,
        height: msg._data.height || null,
      };
    }
  } catch (error) {
    // Ignore metadata extraction errors
  }

  return {
    type,
    body: body.substring(0, 1000), // Caption or filename
    media: {
      hasMedia: true,
      mimetype: media?.mimetype || 'unknown',
      filename: media?.filename || null,
      fileSize: media?.fileSize || null,
      duration: media?.duration || null,
      width: media?.width || null,
      height: media?.height || null,
    },
  };
}

/**
 * Process a sticker message.
 * @param {object} msg — WhatsApp message object
 * @returns {Promise<object>} — Processed message data
 */
async function processStickerMessage(msg) {
  let media = null;
  try {
    if (msg._data) {
      media = {
        mimetype: msg._data.mimetype || 'image/webp',
        fileSize: msg._data.size || null,
        width: msg._data.width || 512, // Stickers are typically 512x512
        height: msg._data.height || 512,
      };
    }
  } catch (error) {
    // Ignore errors
  }

  return {
    type: 'sticker',
    body: '[Sticker]',
    media: {
      hasMedia: true,
      mimetype: media?.mimetype || 'image/webp',
      filename: null,
      fileSize: media?.fileSize || null,
      width: media?.width || null,
      height: media?.height || null,
    },
  };
}

/**
 * Process a location message.
 * @param {object} msg — WhatsApp message object
 * @returns {Promise<object>} — Processed message data
 */
async function processLocationMessage(msg) {
  let location = null;
  try {
    // Try to get location data from the message
    if (msg.location) {
      location = {
        latitude: msg.location.latitude,
        longitude: msg.location.longitude,
        description: msg.location.description || msg.body || '',
      };
    } else if (msg._data && msg._data.lat && msg._data.lng) {
      location = {
        latitude: msg._data.lat,
        longitude: msg._data.lng,
        description: msg.body || msg._data.description || '',
      };
    }
  } catch (error) {
    // Ignore location extraction errors
  }

  return {
    type: 'location',
    body: location?.description || '[Location]',
    location: location || {
      latitude: null,
      longitude: null,
      description: msg.body || '[Location]',
    },
  };
}

/**
 * Process a contact/vCard message.
 * @param {object} msg — WhatsApp message object
 * @returns {Promise<object>} — Processed message data
 */
async function processContactMessage(msg) {
  const contacts = [];

  try {
    // Single vcard
    if (msg.vCards && msg.vCards.length > 0) {
      msg.vCards.forEach((vcard, idx) => {
        contacts.push({
          displayName: extractVCardName(vcard) || `Contact ${idx + 1}`,
          vcardData: vcard.substring(0, 2000),
        });
      });
    }

    // Try to get from _data
    if (contacts.length === 0 && msg._data) {
      if (msg._data.contacts) {
        msg._data.contacts.forEach((contact, idx) => {
          contacts.push({
            displayName: contact.name || contact.displayName || `Contact ${idx + 1}`,
            phoneNumber: contact.phoneNumber || null,
            vcardData: contact.vcard || null,
          });
        });
      }
    }

    // Fallback - try to parse from body
    if (contacts.length === 0 && msg.body) {
      contacts.push({
        displayName: msg.body.substring(0, 100),
        vcardData: null,
      });
    }
  } catch (error) {
    // Ignore contact extraction errors
  }

  return {
    type: contacts.length > 1 ? 'multi_vcard' : 'vcard',
    body: contacts.length > 1
      ? `${contacts.length} contacts shared`
      : contacts[0]?.displayName || '[Contact]',
    contacts: contacts.length > 0 ? contacts : [{ displayName: '[Contact]' }],
  };
}

/**
 * Extract name from vCard data.
 * @param {string} vcard — vCard string
 * @returns {string|null} — Display name
 */
function extractVCardName(vcard) {
  if (!vcard) return null;

  // Try FN (Formatted Name) first
  const fnMatch = vcard.match(/FN[:;]([^\r\n]+)/i);
  if (fnMatch) return fnMatch[1].trim();

  // Try N (Name) field
  const nMatch = vcard.match(/N[:;]([^\r\n]+)/i);
  if (nMatch) {
    const parts = nMatch[1].split(';');
    return parts.filter(p => p.trim()).join(' ').trim() || null;
  }

  return null;
}

/**
 * Process a poll message.
 * @param {object} msg — WhatsApp message object
 * @returns {Promise<object>} — Processed message data
 */
async function processPollMessage(msg) {
  let pollData = null;

  try {
    if (msg.pollData) {
      pollData = {
        pollId: msg.pollData.pollId || null,
        question: msg.pollData.question || msg.body || '[Poll]',
        options: msg.pollData.options || [],
        allowMultipleAnswers: msg.pollData.allowMultipleAnswers || false,
      };
    } else if (msg._data && msg._data.pollOptions) {
      pollData = {
        pollId: msg._data.pollId || null,
        question: msg._data.pollName || msg.body || '[Poll]',
        options: msg._data.pollOptions.map(opt => opt.name || opt),
        allowMultipleAnswers: msg._data.pollSelectableOptionsCount > 1,
      };
    }
  } catch (error) {
    // Ignore poll extraction errors
  }

  return {
    type: 'poll',
    body: pollData?.question || msg.body || '[Poll]',
    poll: pollData || {
      question: msg.body || '[Poll]',
      options: [],
      allowMultipleAnswers: false,
    },
  };
}

/**
 * Extract common metadata from a message, chat, and contact.
 * @param {object} msg — WhatsApp message object
 * @param {object} chat — WhatsApp chat object
 * @param {object} contact — WhatsApp contact object
 * @returns {Promise<object>} — Metadata object
 */
async function extractMessageMetadata(msg, chat, contact) {
  const metadata = {
    chatId: '',
    chatName: 'Unknown',
    isGroup: false,
    senderId: '',
    senderName: 'Unknown',
    senderNumber: '',
    author: '',
  };

  try {
    // Chat info
    if (chat) {
      metadata.chatId = chat.id?._serialized || chat.id || '';
      metadata.chatName = chat.name || chat.pushname || 'Unknown';
      metadata.isGroup = chat.isGroup || false;
    }

    // Sender info
    // In groups, msg.author is the sender; in DMs, msg.from is the sender
    const senderId = msg.author || msg.from || '';
    metadata.senderId = senderId;
    metadata.author = senderId;
    metadata.senderNumber = senderId.replace(/\D/g, '');

    // Get sender name from contact or message
    if (contact) {
      metadata.senderName = contact.pushname || contact.name || contact.shortName || 'Unknown';
    }

    // Try to get name from msg._data if still unknown
    if (metadata.senderName === 'Unknown' && msg._data) {
      metadata.senderName = msg._data.notifyName || msg._data.pushname || 'Unknown';
    }

    // For group messages, try to get author info
    if (metadata.isGroup && msg.author) {
      // Extract name from author if possible
      const authorContact = await msg.getContact().catch(() => null);
      if (authorContact) {
        metadata.senderName = authorContact.pushname || authorContact.name || metadata.senderName;
      }
    }
  } catch (error) {
    // Non-critical error, continue with defaults
  }

  return metadata;
}

// ============================================
// 📤 Module Exports
// ============================================
module.exports = {
  processTextMessage,
  processMediaMessage,
  processStickerMessage,
  processLocationMessage,
  processContactMessage,
  processPollMessage,
  extractMessageMetadata,
};
