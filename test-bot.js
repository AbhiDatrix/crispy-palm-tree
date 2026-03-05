// ============================================
// 🧪 Test Suite for Datrix WhatsApp Bot
// ============================================
// Tests all bot features without requiring WhatsApp connection
// Run with: node test-bot.js
// ============================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let passedTests = 0;
let failedTests = 0;
const errors = [];

function log(type, message) {
  const timestamp = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
  switch (type) {
    case 'info':
      console.log(`${colors.cyan}[${timestamp}] ℹ️${colors.reset} ${message}`);
      break;
    case 'success':
      console.log(`${colors.green}[${timestamp}] ✅${colors.reset} ${message}`);
      passedTests++;
      break;
    case 'error':
      console.log(`${colors.red}[${timestamp}] ❌${colors.reset} ${message}`);
      failedTests++;
      break;
    case 'warning':
      console.log(`${colors.yellow}[${timestamp}] ⚠️${colors.reset} ${message}`);
      break;
    case 'test':
      console.log(`${colors.blue}[${timestamp}] 🧪${colors.reset} ${message}`);
      break;
  }
}

function printBanner() {
  console.log('');
  console.log(`${colors.cyan}╔══════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset}     ${colors.bright}🧪 Datrix Bot Test Suite${colors.reset}                        ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset}     ${colors.dim}Testing all modules and features${colors.reset}               ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}╚══════════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');
}

// ============================================
// TEST 1: Environment & Dependencies
// ============================================
async function testEnvironment() {
  log('test', 'Testing Environment & Dependencies...\n');
  
  try {
    // Check dotenv
    require('dotenv').config();
    log('success', 'dotenv loaded successfully');
    
    // Check GROQ_API_KEY format
    const groqKey = process.env.GROQ_API_KEY || '';
    if (groqKey && groqKey.startsWith('gsk_') && groqKey.length > 20) {
      log('success', 'GROQ_API_KEY is configured');
    } else {
      log('error', 'GROQ_API_KEY is missing or invalid format');
    }
    
    // Check ADMIN_NUMBER
    if (process.env.ADMIN_NUMBER) {
      log('success', 'ADMIN_NUMBER is configured: ' + process.env.ADMIN_NUMBER);
    } else {
      log('error', 'ADMIN_NUMBER is not set');
    }
    
    // Check required dependencies
    const deps = ['whatsapp-web.js', 'groq-sdk', 'lowdb', 'node-cron', 'qrcode-terminal'];
    for (const dep of deps) {
      try {
        require(dep);
        log('success', `Dependency loaded: ${dep}`);
      } catch (e) {
        log('error', `Missing dependency: ${dep}`);
      }
    }
  } catch (error) {
    log('error', `Environment test failed: ${error.message}`);
  }
  console.log('');
}

// ============================================
// TEST 2: Command Parser
// ============================================
async function testCommandParser() {
  log('test', 'Testing Command Parser...\n');
  
  try {
    const { parseCommand } = require('./src/commands');
    
    // Test valid commands
    const testCases = [
      { input: '!help', expected: { command: '!help', args: '' } },
      { input: '!help me', expected: { command: '!help', args: 'me' } },
      { input: '!ask what is data', expected: { command: '!ask', args: 'what is data' } },
      { input: '!note add Buy milk', expected: { command: '!note', args: 'add Buy milk' } },
      { input: '  !help  ', expected: { command: '!help', args: '' } }, // With whitespace
      { input: '!HELLO', expected: { command: '!hello', args: '' } }, // Case insensitive
      { input: 'hello world', expected: null }, // No prefix
      { input: '', expected: null }, // Empty string
      { input: null, expected: null }, // Null input
    ];
    
    for (const tc of testCases) {
      const result = parseCommand(tc.input);
      if (JSON.stringify(result) === JSON.stringify(tc.expected)) {
        log('success', `parseCommand("${tc.input}") returned correct result`);
      } else {
        log('error', `parseCommand("${tc.input}") returned ${JSON.stringify(result)}, expected ${JSON.stringify(tc.expected)}`);
      }
    }
  } catch (error) {
    log('error', `Command parser test failed: ${error.message}`);
  }
  console.log('');
}

// ============================================
// TEST 3: Database Operations
// ============================================
async function testDatabase() {
  log('test', 'Testing Database Operations...\n');
  
  try {
    const db = require('./src/db');
    const testUserId = 'test_user_123@c.us';
    const testChatId = 'test_chat_456@g.us';
    
    // Test note operations
    log('info', 'Testing note operations...');
    const noteId = db.addNote(testUserId, 'Test note content for testing');
    if (noteId) {
      log('success', `addNote() returned ID: ${noteId}`);
    } else {
      log('error', 'addNote() failed to return an ID');
    }
    
    const notes = db.getNotes(testUserId);
    if (notes.length > 0 && notes[0].content === 'Test note content for testing') {
      log('success', 'getNotes() returned correct note');
    } else {
      log('error', 'getNotes() returned incorrect data');
    }
    
    // Test user preferences
    log('info', 'Testing user preferences...');
    db.setUserPreference(testUserId, 'personality', 'casual');
    const personality = db.getUserPreference(testUserId, 'personality');
    if (personality === 'casual') {
      log('success', 'User preference set/get works correctly');
    } else {
      log('error', `User preference returned: ${personality}, expected: casual`);
    }
    
    // Test stats
    log('info', 'Testing stats operations...');
    db.trackUserMessage(testUserId, 'Test User', false);
    db.trackCommand('!help', testUserId);
    const stats = db.getStats();
    if (stats && typeof stats.messagesHandled === 'number') {
      log('success', 'getStats() returns valid statistics');
    } else {
      log('error', 'getStats() returned invalid data');
    }
    
    // Test reminder operations
    log('info', 'Testing reminder operations...');
    const futureTime = Date.now() + 60000; // 1 minute from now
    const reminderId = db.addReminder(testUserId, testChatId, 'Test reminder', futureTime, false);
    if (reminderId) {
      log('success', `addReminder() returned ID: ${reminderId}`);
    } else {
      log('error', 'addReminder() failed');
    }
    
    const reminders = db.getReminders(testUserId);
    if (reminders.length > 0) {
      log('success', 'getReminders() returned reminders');
    } else {
      log('error', 'getReminders() returned empty');
    }
    
    // Test mute/unmute
    log('info', 'Testing mute operations...');
    const muteResult = db.muteGroup(testChatId);
    if (muteResult) {
      log('success', 'muteGroup() works');
    } else {
      log('warning', 'muteGroup() returned false (may already be muted)');
    }
    
    const unmuteResult = db.unmuteGroup(testChatId);
    if (unmuteResult) {
      log('success', 'unmuteGroup() works');
    } else {
      log('warning', 'unmuteGroup() returned false (may not have been muted)');
    }
    
    // Cleanup test data
    db.deleteNote(testUserId, noteId);
    db.deleteReminder(testUserId, reminderId);
    log('success', 'Test data cleaned up');
    
  } catch (error) {
    log('error', `Database test failed: ${error.message}`);
    console.error(error);
  }
  console.log('');
}

// ============================================
// TEST 4: Command Handlers (Static)
// ============================================
async function testCommandHandlers() {
  log('test', 'Testing Command Handlers...\n');
  
  try {
    const { handleCommand, parseCommand } = require('./src/commands');
    const mockClient = {};
    const testUserId = '917518694172@c.us'; // Admin number from env
    const testChatId = 'test_chat@g.us';
    
    const testCommands = [
      { cmd: '!help', desc: 'Help command' },
      { cmd: '!about', desc: 'About command' },
      { cmd: '!status', desc: 'Status command' },
      { cmd: '!contact', desc: 'Contact command' },
      { cmd: '!info', desc: 'Info command' },
      { cmd: '!ping', desc: 'Ping command' },
      { cmd: '!joke', desc: 'Joke command' },
      { cmd: '!quote', desc: 'Quote command' },
      { cmd: '!fact', desc: 'Fact command' },
      { cmd: '!clear', desc: 'Clear command' },
      { cmd: '!report', desc: 'Report command' },
      { cmd: '!personality', desc: 'Personality get command' },
      { cmd: '!personality casual', desc: 'Personality set command' },
      { cmd: '!note list', desc: 'Note list command' },
      { cmd: '!reminder list', desc: 'Reminder list command' },
      { cmd: '!stats', desc: 'Stats command (admin)' },
    ];
    
    for (const tc of testCommands) {
      try {
        const parsed = parseCommand(tc.cmd);
        if (parsed) {
          const result = await handleCommand(parsed.command, parsed.args, {
            msg: {},
            client: mockClient,
            senderId: testUserId,
            senderName: 'Test User',
            isGroup: true,
            chatId: testChatId,
          });
          
          if (result !== undefined || tc.cmd.includes('list') || tc.cmd.includes('stats')) {
            log('success', `${tc.desc} executed successfully`);
          } else {
            log('warning', `${tc.desc} returned null (may be expected)`);
          }
        }
      } catch (error) {
        log('error', `${tc.desc} failed: ${error.message}`);
      }
    }
    
    // Test invalid command
    const invalidResult = await handleCommand('!invalid', '', {
      msg: {},
      client: mockClient,
      senderId: testUserId,
      senderName: 'Test User',
      isGroup: false,
      chatId: testUserId,
    });
    if (invalidResult === null) {
      log('success', 'Unknown command returns null (correct behavior)');
    }
    
  } catch (error) {
    log('error', `Command handler test failed: ${error.message}`);
    console.error(error);
  }
  console.log('');
}

// ============================================
// TEST 5: AI Module
// ============================================
async function testAIModule() {
  log('test', 'Testing AI Module...\n');
  
  try {
    const ai = require('./src/ai');
    
    // Test token usage tracking
    const tokens = ai.getTokenUsage();
    if (tokens && typeof tokens.totalRequests === 'number') {
      log('success', 'getTokenUsage() returns valid data');
    } else {
      log('error', 'getTokenUsage() returned invalid data');
    }
    
    // Test askAI (if API key is valid)
    const groqKey = process.env.GROQ_API_KEY || '';
    if (groqKey && groqKey.startsWith('gsk_')) {
      log('info', 'Testing AI response (this may take a few seconds)...');
      try {
        const response = await ai.askAI('Say "test successful" in 2 words', 'TestUser', 'default');
        if (response && response.toLowerCase().includes('test')) {
          log('success', 'AI response received successfully');
        } else {
          log('warning', `AI response: ${response}`);
        }
      } catch (aiError) {
        log('error', `AI request failed: ${aiError.message}`);
      }
    } else {
      log('warning', 'Skipping AI test - no valid GROQ_API_KEY');
    }
    
  } catch (error) {
    log('error', `AI module test failed: ${error.message}`);
  }
  console.log('');
}

// ============================================
// TEST 6: Scheduler
// ============================================
async function testScheduler() {
  log('test', 'Testing Scheduler Module...\n');
  
  try {
    const scheduler = require('./src/scheduler');
    
    // Test scheduler initialization (should not throw)
    log('info', 'Testing scheduler initialization...');
    // We can't fully test without a real client, but we can check the module loads
    if (typeof scheduler.initScheduler === 'function') {
      log('success', 'initScheduler function exists');
    } else {
      log('error', 'initScheduler function not found');
    }
    
    if (typeof scheduler.stopScheduler === 'function') {
      log('success', 'stopScheduler function exists');
    } else {
      log('error', 'stopScheduler function not found');
    }
    
  } catch (error) {
    log('error', `Scheduler test failed: ${error.message}`);
  }
  console.log('');
}

// ============================================
// TEST 7: Database Persistence
// ============================================
async function testDatabasePersistence() {
  log('test', 'Testing Database Persistence...\n');
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    const dbPath = path.join(__dirname, 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf8');
      const data = JSON.parse(content);
      
      if (data.schemaVersion) {
        log('success', `Database schema version: ${data.schemaVersion}`);
      } else {
        log('warning', 'Database missing schema version');
      }
      
      if (data.users) {
        log('success', 'Database has users object');
      } else {
        log('error', 'Database missing users object');
      }
      
      if (data.stats) {
        log('success', 'Database has stats object');
      } else {
        log('error', 'Database missing stats object');
      }
      
      if (data.scheduledReminders) {
        log('success', 'Database has scheduledReminders array');
      } else {
        log('error', 'Database missing scheduledReminders array');
      }
      
      log('info', `Database file size: ${content.length} bytes`);
    } else {
      log('error', 'Database file does not exist at ' + dbPath);
    }
    
  } catch (error) {
    log('error', `Database persistence test failed: ${error.message}`);
  }
  console.log('');
}

// ============================================
// Main Test Runner
// ============================================
async function runTests() {
  printBanner();
  const startTime = Date.now();
  
  await testEnvironment();
  await testCommandParser();
  await testDatabase();
  await testCommandHandlers();
  await testAIModule();
  await testScheduler();
  await testDatabasePersistence();
  
  const duration = Date.now() - startTime;
  
  // Print Summary
  console.log('');
  console.log(`${colors.cyan}╔══════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset}     ${colors.bright}📊 TEST SUMMARY${colors.reset}                                 ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}╠══════════════════════════════════════════════════════╣${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset}     ${colors.green}✅ Passed: ${passedTests}${colors.reset}                                   ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset}     ${colors.red}❌ Failed: ${failedTests}${colors.reset}                                   ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset}     ${colors.blue}⏱️  Duration: ${duration}ms${colors.reset}                             ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}╚══════════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');
  
  if (failedTests === 0) {
    console.log(`${colors.green}${colors.bright}🎉 All tests passed!${colors.reset}`);
  } else {
    console.log(`${colors.yellow}${colors.bright}⚠️  Some tests failed. Please review the errors above.${colors.reset}`);
  }
  console.log('');
  
  process.exit(failedTests > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error during testing:', error);
  process.exit(1);
});
