// ============================================
// 📞 monitor/call-handler.js — Call Event Handlers
// ============================================
// Handles tracking of WhatsApp call events:
// - Incoming calls
// - Outgoing calls
// - Call completion
// - Missed calls
// ============================================

/**
 * Handle an incoming call event.
 * @param {object} call — Call event object from whatsapp-web.js
 * @returns {object} — Call data for recording
 */
function handleIncomingCall(call) {
  const callData = {
    callId: call.id || `call_${Date.now()}`,
    chatId: call.chatId || '',
    chatName: call.chatName || 'Unknown',
    isGroupCall: call.isGroup || false,
    callerId: call.from || '',
    callerName: call.fromMe ? 'You' : (call.sender || call.from || 'Unknown'),
    type: call.isVideo ? 'video' : 'audio',
    direction: 'incoming',
    status: 'ringing',
    startedAt: Date.now(),
    answeredAt: null,
    endedAt: null,
    duration: 0,
    endReason: null,
  };

  return callData;
}

/**
 * Handle an outgoing call event.
 * @param {object} call — Call event object
 * @returns {object} — Call data for recording
 */
function handleOutgoingCall(call) {
  const callData = {
    callId: call.id || `call_${Date.now()}`,
    chatId: call.chatId || '',
    chatName: call.chatName || 'Unknown',
    isGroupCall: call.isGroup || false,
    callerId: call.from || '',
    callerName: 'You',
    type: call.isVideo ? 'video' : 'audio',
    direction: 'outgoing',
    status: 'ringing',
    startedAt: Date.now(),
    answeredAt: null,
    endedAt: null,
    duration: 0,
    endReason: null,
  };

  return callData;
}

/**
 * Handle call completion/end event.
 * @param {object} call — Call event object
 * @param {number} duration — Call duration in seconds
 * @returns {object} — Updated call data
 */
function handleCallEnd(call, duration) {
  const now = Date.now();

  const callData = {
    callId: call.id || `call_${now}`,
    chatId: call.chatId || '',
    chatName: call.chatName || 'Unknown',
    isGroupCall: call.isGroup || false,
    callerId: call.from || '',
    callerName: call.fromMe ? 'You' : (call.sender || 'Unknown'),
    type: call.isVideo ? 'video' : 'audio',
    direction: call.fromMe ? 'outgoing' : 'incoming',
    status: 'completed',
    startedAt: call.startedAt || now - (duration * 1000),
    answeredAt: call.answeredAt || call.startedAt,
    endedAt: now,
    duration: duration || 0,
    endReason: 'ended',
  };

  return callData;
}

/**
 * Handle a missed call event.
 * @param {object} call — Call event object
 * @returns {object} — Call data for recording
 */
function handleMissedCall(call) {
  const now = Date.now();

  const callData = {
    callId: call.id || `call_${now}`,
    chatId: call.chatId || '',
    chatName: call.chatName || 'Unknown',
    isGroupCall: call.isGroup || false,
    callerId: call.from || '',
    callerName: call.sender || 'Unknown',
    type: call.isVideo ? 'video' : 'audio',
    direction: 'incoming',
    status: 'missed',
    startedAt: call.startedAt || now,
    answeredAt: null,
    endedAt: now,
    duration: 0,
    endReason: 'missed',
  };

  return callData;
}

/**
 * Format call duration for display.
 * @param {number} seconds — Duration in seconds
 * @returns {string} — Formatted duration string
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 1) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Get call status emoji.
 * @param {string} status — Call status
 * @param {string} direction — Call direction
 * @returns {string} — Emoji
 */
function getCallStatusEmoji(status, direction) {
  switch (status) {
    case 'completed':
      return direction === 'incoming' ? '📲' : '📞';
    case 'missed':
      return '❌';
    case 'rejected':
      return '🚫';
    case 'ringing':
      return '🔔';
    default:
      return '📞';
  }
}

/**
 * Get call type emoji.
 * @param {string} type — Call type
 * @returns {string} — Emoji
 */
function getCallTypeEmoji(type) {
  return type === 'video' ? '📹' : '📞';
}

// ============================================
// 📤 Module Exports
// ============================================
module.exports = {
  handleIncomingCall,
  handleOutgoingCall,
  handleCallEnd,
  handleMissedCall,
  formatDuration,
  getCallStatusEmoji,
  getCallTypeEmoji,
};
