# 🤖 Datrix WhatsApp AI Employee Bot v2.2

> Production-ready WhatsApp AI assistant for **Datrix** — a data intelligence startup.

Built with `whatsapp-web.js`, `Groq AI (Llama 3.3 70B)`, `lowdb`, and `node-cron`.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **🧠 AI DM Handler** | Auto-replies to every DM using Groq AI with Datrix persona |
| **🎭 Personality Modes** | Choose between professional, casual, or funny AI styles |
| **👥 Community Manager** | Only responds when @mentioned or via commands in groups |
| **📢 Channel Broadcasting** | Scheduled & on-demand announcements to all groups |
| **👋 Welcome System** | Auto-welcomes new group members with Datrix branding |
| **📝 Notes & Reminders** | Personal note-taking and reminder system |
| **📤 Send Messages** | Send messages to contacts directly via `!send` command |
| **🔄 Proxy Chat** | Anonymous bidirectional messaging through the bot |
| **🎉 Fun Commands** | Jokes, quotes, and facts on demand |
| **🛡️ Anti-Spam** | 10-second cooldown per user, ignores forwarded messages |
| **📊 Terminal Logging** | Beautiful colored terminal output with emojis |
| **⏰ Scheduled Updates** | Weekly Monday 9 AM IST auto-broadcast to all groups |
| **⏰ Reminder System** | Set reminders with natural time formats (30m, 1h, 2d) |
| **💾 Memory System** | Remembers users, muted groups, notes, reminders, preferences |
| **🔧 PC Optimized** | Tuned for low-spec hardware (AMD Athlon Silver, 6GB RAM) |
| **🤖 Auto-Reply Mode** | Reply on your behalf after 2 hours of inactivity |
| **👥 Group Mention Replies** | Auto-reply when someone mentions you in groups |
| **🎯 Targeted Replies** | Send AI-generated messages to specific people in groups |
| **🌍 Multilingual** | Responds in the same language as the user (Hindi, English, etc.) |
| **✅ Task Management** | Add, complete, and track your to-do tasks |
| **🗳️ Polls** | Create and vote on polls in groups |
| **🌤️ Weather** | Get weather info for any city |
| **📰 News** | Latest tech and world news |

---

## 📋 Prerequisites

- **Node.js** v18+ — [Download](https://nodejs.org/)
- **Groq API Key** (free) — [Get one here](https://console.groq.com)
- **WhatsApp Account** — For the bot to use
- **Google Chrome or Chromium** — Required by Puppeteer

---

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
cd "L:\WhatsApp Bot"
npm install
```

### 2. Configure Environment

Edit the `.env` file with your details:

```env
GROQ_API_KEY=gsk_your_actual_api_key_here
ADMIN_NUMBER=919876543210
BOT_NAME=Datrix AI
PORT=3000
```

- **GROQ_API_KEY**: Get free from [console.groq.com](https://console.groq.com)
- **ADMIN_NUMBER**: Your WhatsApp number with country code, no `+` sign
- **BOT_NAME**: Display name for the bot

### 3. First Run (Development)

```bash
npm run dev
```

A QR code will appear in the terminal. **Scan it with WhatsApp** (Settings → Linked Devices → Link a Device).

Once scanned, you'll see:
```
✅ Datrix Bot is READY!
🟢 All systems operational
🎉 All systems go! Bot is fully operational.
```

### 4. Production (PM2 — 24/7)

Install PM2 globally:
```bash
npm install -g pm2
```

Start the bot with PM2:
```bash
npm run pm2:start
```

Other PM2 commands:
```bash
npm run pm2:stop      # Stop the bot
npm run pm2:restart   # Restart the bot
npm run pm2:logs      # View live logs
```

### 🔧 Fixing Chrome Issues

If the bot gets stuck at "Initializing WhatsApp client", Chrome processes may be hanging:

```powershell
# Run the cleanup script (keeps your login session)
.\fix-chrome.ps1

# Then start the bot
npm start
```

**Tip:** Only delete `.wwebjs_auth` if you want to force a new QR code scan. Otherwise, use `fix-chrome.ps1` to preserve your session.

---

## 📁 Project Structure

```
WhatsApp Bot/
├── src/
│   ├── bot.js          # Main entry — WhatsApp client, event routing
│   ├── ai.js           # Groq AI integration with personality modes
│   ├── commands.js     # All command handlers (20+ commands!)
│   ├── scheduler.js    # Cron-based scheduled broadcasts & reminders
│   └── db.js           # lowdb database with notes & reminders
├── data/
│   └── db.json         # Database file (auto-created)
├── .env                # API keys and config (gitignored)
├── .env.example        # Template for .env
├── ecosystem.config.js # PM2 configuration
├── package.json        # Dependencies & scripts
└── README.md           # This file
```

---

## 🎮 Bot Commands

### 🔐 Command Visibility Rules

Commands are divided into **two groups** based on user permissions:

| Group | Description |
|-------|-------------|
| 👑 **Admin Only** | Restricted to the bot administrator only |
| 🌐 **Everyone** | Available to all users |

#### Visibility Behavior

| User Type | Command Group | Response Type |
|-----------|---------------|---------------|
| Non-admin | Admin Only | ❌ **No response** (silently ignored) |
| Admin | Admin Only | 🔒 **Private response** (only admin sees it) |
| Anyone | Everyone | 📢 **Public response** (visible to all) |

#### Command Groups

**👑 Admin Only Commands:**
`!broadcast` `!send` `!reply` `!replyto` `!proxy` `!kick` `!promote` `!demote` `!tagall` `!stats`

**🌐 Everyone Commands:**
`!help` `!about` `!status` `!contact` `!info` `!ping` `!report` `!ask` `!clear` `!personality` `!note` `!reminder` `!task` `!poll` `!weather` `!news` `!joke` `!quote` `!fact` `!react` `!mute` `!unmute`

---

### 📋 General Commands

| Command | Description | Access |
|---------|-------------|--------|
| `!help` | List all commands with categories | Everyone |
| `!about` | Datrix company info and mission | Everyone |
| `!status` | Current MVP progress | Everyone |
| `!contact` | Contact Abhi Srivastava | Everyone |
| `!info` | Bot system information | Everyone |
| `!ping` | Check bot latency | Everyone |
| `!report` | Bot statistics & uptime | Everyone |

### 🧠 AI & Chat Commands

| Command | Description | Access |
|---------|-------------|--------|
| `!ask [question]` | Ask AI anything | Everyone |
| `!clear` | Clear your AI chat history | Everyone |
| `!personality [mode]` | Set AI style (professional/casual/funny) | Everyone |

### 📝 Personal Tools

| Command | Description | Access |
|---------|-------------|--------|
| `!note add [text]` | Save a personal note | Everyone |
| `!note list` | View all your notes | Everyone |
| `!note delete [number]` | Delete a specific note | Everyone |
| `!reminder [time] [message]` | Set a reminder | Everyone |
| `!reminder list` | View pending reminders | Everyone |

**Time formats for reminders:**
- `30m` = 30 minutes
- `1h` = 1 hour
- `2h30m` = 2 hours 30 minutes
- `1d` = 1 day

**Example:** `!reminder 30m Call mom`

### 📤 Messaging Commands

Send messages to contacts, use proxy chat mode, and control auto-reply features.

| Command | Description | Access |
|---------|-------------|--------|
| `!send [contact] [message]` | Send a message to a specific contact | Admin only |
| `!reply [on/off/group/status]` | Auto-reply when you're inactive | Admin only |
| `!replyto [group] [person] [instruction]` | AI-generated message to someone in a group | Admin only |
| `!proxy start [contact]` | Start anonymous proxy chat session | Admin only |
| `!proxy stop` | End proxy chat session | Admin only |
| `!proxy status` | Check active proxy session | Admin only |

#### Send Command
Send messages directly to any contact:
```
!send mritunjay Hello, are we meeting today?
!send +919876543210 Don't forget the presentation!
```

The bot will search your contacts and deliver the message with your name.

#### Proxy Chat Mode
Forward messages anonymously between two people through the bot:

1. **Start a proxy session:**
   ```
   !proxy start mritunjay
   ```
   The target receives: *"You have a message from someone who wishes to remain anonymous..."*

2. **Send messages** - Just type normally and messages are forwarded anonymously

3. **Target replies** - Their replies are forwarded back to you

4. **End the session:**
   ```
   !proxy stop
   ```

**Features:**
- Bidirectional anonymous messaging
- Multiple concurrent sessions supported
- Auto-cleanup after 24 hours of inactivity
- Status checking with `!proxy status`

#### Auto-Reply Mode
Automatically reply on your behalf when you're busy or inactive:

```
!reply on          # Enable auto-reply in current chat
!reply off         # Disable auto-reply
!reply group       # Also reply when mentioned in groups
!reply status      # Check settings and last activity
```

**How it works:**
- After **2 hours of inactivity**, the bot auto-replies to DMs on your behalf
- In groups, it replies when someone mentions `@Abhi` (your name)
- AI generates contextual responses based on the conversation
- Your last reply time is tracked per chat

#### Targeted Replies (!replyto)
Send AI-generated messages to specific people in specific groups:

```
!replyto "Nana Ka Ghar" Rahul "give him a compliment"
!replyto "Family Group" Mritunjay "ask how his day was"
!replyto Friends Priya "send birthday wishes"
```

The bot will:
1. Find the group by name
2. Find the person in that group
3. Generate an AI message based on your instruction
4. Send it with a proper mention

**Example Instructions:**
- `"give them a compliment"`
- `"ask about their work"`
- `"send birthday wishes"`
- `"ask if they need help"`
- Any custom instruction you want!

### 🎉 Fun Commands

| Command | Description | Access |
|---------|-------------|--------|
| `!joke` | Get a random joke | Everyone |
| `!quote` | Get an inspirational quote | Everyone |
| `!fact` | Learn a random fact | Everyone |

### 👍 Message Reactions

| Command | Description | Access |
|---------|-------------|--------|
| `!react [emoji]` | React to a message with emoji | Everyone |

**Usage:** Reply to any message, then type `!react 👍`

**Example:**
1. Long-press or reply to a message
2. Type `!react 🎉`
3. The bot will add that reaction to the message

Available emojis: `👍` `❤️` `😂` `🎉` `🤔` `🔥` `🙏` or any emoji!

###  Group Management

| Command | Description | Access |
|---------|-------------|--------|
| `!mute` | Silence bot in this group | Group only |
| `!unmute` | Resume bot replies | Group only |
| `!tagall [message]` | Mention all members | Admin only |

### 🔐 Admin Commands

| Command | Description | Access |
|---------|-------------|--------|
| `!broadcast [message]` | Send message to all groups | Admin only |
| `!kick @user` | Remove user from group | Admin only |
| `!promote @user` | Make user admin | Admin only |
| `!demote @user` | Remove admin rights | Admin only |
| `!stats` | Detailed bot statistics | Admin only |

---

## 🌍 Multilingual Support

The bot automatically detects the language of incoming messages and responds in the same language. Supported languages include:

- **English** (Default)
- **Hindi** (हिंदी)
- **Bengali** (বাংলা)
- **Tamil** (தமிழ்)
- **Telugu** (తెలుగు)
- **Marathi** (मराठी)
- **Gujarati** (ગુજરાતી)
- **Kannada** (ಕನ್ನಡ)
- **Malayalam** (മലയാളം)
- **Punjabi** (ਪੰਜਾਬੀ)
- **Urdu** (اردو)
- **Arabic** (العربية)
- **Spanish** (Español)
- **French** (Français)
- **German** (Deutsch)
- **Portuguese** (Português)
- **Chinese** (中文)
- **Japanese** (日本語)
- **Korean** (한국어)
- **Russian** (Русский)

**Example:**
```
User: नमस्ते, आप कैसे हैं?
Bot: नमस्ते! मैं ठीक हूँ, धन्यवाद। आप कैसे हैं? 🤖
```

---

##  Personality Modes

The bot supports three AI personality modes:

### Professional
Formal, business-oriented responses. Perfect for professional communication.
```
!personality professional
```

### Casual
Friendly, conversational style. Great for relaxed interactions.
```
!personality casual
```

### Funny
Humorous and playful responses. Adds a touch of fun!
```
!personality funny
```

To check your current personality:
```
!personality
```

---

## 📝 Notes System

Save personal notes that persist across conversations:

```
!note add Buy groceries tomorrow
!note add Meeting with team at 3pm
```

View your notes:
```
!note list
```

Delete a note:
```
!note delete 1
```

---

## ⏰ Reminders System

Set reminders and the bot will notify you when it's time:

```
!reminder 30m Take a break
!reminder 1h30m Meeting starts
!reminder 2d Project deadline
```

View pending reminders:
```
!reminder list
```

---

## ✅ Task Management

Manage your to-do list:

Add a task:
```
!task add Buy groceries tomorrow
!task add Call mom at 5pm
```

View pending tasks:
```
!task list
```

Mark task complete:
```
!task done 1
```

Delete a task:
```
!task delete 1
```

---

## 🗳️ Poll System (Groups)

Create polls in group chats:

Create a poll:
```
!poll "Where should we meet?" "Cafe" "Park" "Mall"
```

Vote in a poll:
```
!poll vote 1
```

End poll and see results:
```
!poll end
```

---

## 🌤️ Weather Command

Get weather information for any city:

```
!weather Mumbai
!weather Delhi
!weather London
```

---

## 📰 News Command

Get the latest tech news:

```
!news
```

---

## 🖥️ Terminal Output

The bot features beautiful colored terminal output:

- **Cyan** — Information messages
- **Green** — Success messages
- **Yellow** — Warning messages
- **Red** — Error messages
- **Magenta** — Command handling
- **Blue** — AI responses

Example output:
```
[10:30:15 AM] 💬 John: Hey bot, how are you?
[10:30:16 AM] 🤖 Replied to DM from: John
[10:31:22 AM] 🎮 Handled: !help from Sarah
```

---

## ⏰ Scheduled Events

The scheduler automatically handles:

| Event | Schedule | Description |
|-------|----------|-------------|
| Weekly Update | Every Monday 9:00 AM IST | Auto-broadcast to all groups |
| Health Check | Every day 12:00 PM IST | Memory and status logging |
| Nightly Cleanup | Every day 3:00 AM IST | Cleanup old completed reminders |
| Reminder Checker | Every minute | Check and send pending reminders |

---

## 📊 Bot Statistics

Track your bot's usage with `!stats` (admin only):

- Total messages handled
- Messages today
- Unique users
- AI requests made
- Token usage
- Memory consumption
- Command usage counts

---

## ⚠️ Known Limitations

1. **whatsapp-web.js** is unofficial — WhatsApp updates may temporarily break it
2. **Channel posting** support is experimental in the library
3. **Groq free tier** has rate limits (~30 RPM) — the bot handles this with exponential backoff
4. **Session expiry** — if WhatsApp logs out the linked device, you'll need to re-scan QR
5. **Avoid spam** — sending too many automated messages can trigger WhatsApp's anti-spam system

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| QR code not showing | Make sure Chrome/Chromium is installed |
| Bot not responding | Check `.env` has valid `GROQ_API_KEY` |
| Memory issues | Bot is already capped at 512MB via PM2 config |
| Auth failure | Delete `.wwebjs_auth/` folder and re-scan QR |
| Commands not working | Ensure you're using the `!` prefix |
| AI personality not changing | Use exact mode names: professional, casual, funny |
| "Browser already running" error | Run `npm run fix-session` then `npm start` |
| Bot stuck at "Initializing" | Run `.\fix-chrome.ps1` to kill Chrome processes |
| Command responses not visible | Commands sent from bot number appear in your "Note to Self" |
| Must re-scan QR every time | Don't delete `.wwebjs_auth` folder, only use `fix-chrome.ps1` |

---

## 🔄 Version History

### v2.2 (Current)
- **Task Management** — `!task` command to add, complete, and track to-do items
- **Poll System** — Create and vote on polls in groups with `!poll`
- **Weather Command** — Get weather info for any city with `!weather`
- **News Command** — Latest tech news with `!news`
- **Message Reactions** — `!react` command to add emoji reactions to messages
- **Message Delete Detection** — Logs when messages are deleted (for transparency)
- **Group Leave Detection** — Tracks when members leave groups
- **Improved Anti-Spam** — Better memory management and error handling
- **Bug Fixes** — Fixed edge cases in rate limiting and command handling

### v2.1
- **Auto-Reply Mode** — Reply on your behalf after 2 hours of inactivity
- **Group Mention Replies** — Auto-reply when someone mentions you in groups  
- **Targeted Replies** (`!replyto`) — Send AI-generated messages to specific people
- **Multilingual Support** — Responds in Hindi, English, and 15+ languages
- **Admin Command Visibility** — Command responses now show in WhatsApp
- **Chrome Cleanup Script** — `fix-chrome.ps1` for stuck processes
- **Initialization Timeout** — Auto-exit if bot hangs during startup

### v2.0
- Added personality modes (professional, casual, funny)
- Added notes and reminders system
- Added fun commands (joke, quote, fact)
- Added group management commands (tagall, kick, promote, demote)
- Added colored terminal logging
- Enhanced command help system with categories
- Improved rate limiting with warning system
- Added message statistics tracking

### v1.2
- Terminal-only operation (no UI)
- Optimized for low-spec hardware
- Anti-spam protection
- Conversation memory

### v1.0
- Initial release
- Basic commands
- AI integration

---

## 📜 License

MIT — Built for Datrix by Abhi Srivastava.

---

## 💬 Support

Need help? Contact:
- **WhatsApp:** Message the bot directly
- **Email:** abhisrivast944@gmail.com

Happy botting! 🤖✨
