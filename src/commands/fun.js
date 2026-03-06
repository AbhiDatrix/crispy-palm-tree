// ============================================
// 🎉 Fun Commands — Jokes, Quotes, Facts, Weather, News
// ============================================

const { log } = require('../bot.js');
const { getJokes, getQuotes, getFacts, getWeatherConditions } = require('../dataLoader');
const { newsService, VALID_TOPICS } = require('../newsService');

// 🌤️ Weather condition mapper (loaded from JSON)
function getWeatherCondition(code) {
  const conditions = getWeatherConditions();
  return conditions[code] || '🌡️ Unknown conditions';
}

/**
 * Register all fun commands with the registry
 * @param {Object} registry - Command registry instance
 */
function registerFunCommands(registry) {
  // 😄 !joke — Random joke
  registry.register('!joke', async (msg, args, context) => {
    const { isPrivate } = context;
    const jokes = getJokes();
    return { 
      text: `😄 *Here's a joke for you!*\n\n${jokes[Math.floor(Math.random() * jokes.length)]}`, 
      private: isPrivate 
    };
  }, { 
    description: 'Get a random joke',
    category: 'fun'
  });

  // 💭 !quote — Inspirational quote
  registry.register('!quote', async (msg, args, context) => {
    const { isPrivate } = context;
    const quotes = getQuotes();
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    return { 
      text: `💭 *Quote of the Moment*\n\n"${quote.text}"\n\n— ${quote.author}`, 
      private: isPrivate 
    };
  }, { 
    description: 'Get an inspirational quote',
    category: 'fun'
  });

  // 📚 !fact — Random fact
  registry.register('!fact', async (msg, args, context) => {
    const { isPrivate } = context;
    const facts = getFacts();
    return { 
      text: `📚 *Did you know?*\n\n${facts[Math.floor(Math.random() * facts.length)]}`, 
      private: isPrivate 
    };
  }, { 
    description: 'Learn a random fact',
    category: 'fun'
  });

  // 🌤️ !weather — Get weather info
  registry.register('!weather', async (msg, args, context) => {
    const { isPrivate } = context;
    
    if (!args) {
      return { 
        text: '🌤️ *Weather Command*\n\nUsage: `!weather [city name]`\n\nExamples:\n• `!weather Mumbai`\n• `!weather Delhi`\n• `!weather London`', 
        private: isPrivate 
      };
    }
    
    try {
      const city = args.trim();
      // Using Open-Meteo API (free, no API key needed)
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
      const geoData = await response.json();
      
      if (!geoData.results || geoData.results.length === 0) {
        return { 
          text: `❌ City not found: "${city}"\n\nPlease check the spelling and try again.`, 
          private: isPrivate 
        };
      }
      
      const location = geoData.results[0];
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current_weather=true`);
      const weatherData = await weatherRes.json();
      
      const temp = Math.round(weatherData.current_weather.temperature);
      const wind = weatherData.current_weather.windspeed;
      const condition = getWeatherCondition(weatherData.current_weather.weathercode);
      
      return { 
        text: `🌤️ *Weather in ${location.name}, ${location.country}*\n\n${condition}\n🌡️ Temperature: ${temp}°C\n💨 Wind: ${wind} km/h\n\n_— Powered by Open-Meteo_`, 
        private: isPrivate 
      };
    } catch (error) {
      log('error', 'Weather command error: ' + error.message);
      return { 
        text: '⚠️ Could not fetch weather data. Please try again later.', 
        private: isPrivate 
      };
    }
  }, { 
    description: 'Get weather info for a city',
    category: 'utilities',
    usage: '[city name]'
  });

  // 📰 !news — Get latest news
  registry.register('!news', async (msg, args, context) => {
    const { isPrivate } = context;
    
    // Parse the topic from args
    const topic = args ? args.trim().toLowerCase() : 'general';
    
    // Check if API is configured
    if (!newsService.isConfigured()) {
      // Fallback to sample news when no API key
      const newsItems = [
        { title: "AI continues to transform industries worldwide", source: "Tech Daily" },
        { title: "WhatsApp introduces new privacy features", source: "Social Media Today" },
        { title: "India's tech sector sees 15% growth", source: "Business Standard" },
        { title: "New smartphone innovations unveiled at tech expo", source: "Gadget News" },
        { title: "Cloud computing adoption accelerates in 2026", source: "Cloud Weekly" },
      ];
      
      const shuffled = newsItems.sort(() => 0.5 - Math.random()).slice(0, 3);
      
      let response = '📰 *Latest Tech News* (Sample)\n\n';
      shuffled.forEach((item, idx) => {
        response += `${idx + 1}. ${item.title}\n   📰 ${item.source}\n\n`;
      });
      response += '⚠️ *API Not Configured*\n';
      response += 'To get real-time news, add your GNews API key:\n';
      response += '1. Visit https://gnews.io/ for a free key\n';
      response += '2. Add `GNEWS_API_KEY=your_key` to .env\n';
      response += '3. Restart the bot\n\n';
      response += '📖 *Usage:*\n';
      response += '• `!news` - General news\n';
      response += '• `!news tech` - Technology news\n';
      response += '• `!news sports` - Sports news\n';
      response += '• `!news business` - Business news\n';
      response += '• `!news health` - Health news';
      
      return { text: response, private: isPrivate };
    }
    
    try {
      const articles = await newsService.fetchTopNews(topic);
      
      if (!articles || articles.length === 0) {
        return {
          text: `📰 No news found for topic: ${topic}\n\nTry: general, technology, business, entertainment, health, Politcal, science, sports`,
          private: isPrivate
        };
      }
      
      const topicDisplay = topic.charAt(0).toUpperCase() + topic.slice(1);
      let response = `📰 *Latest ${topicDisplay} News*\n\n`;
      
      articles.forEach((article, idx) => {
        response += `${idx + 1}. *${article.title}*\n`;
        response += `   📰 ${article.source}\n`;
        response += `   🔗 ${article.url}\n\n`;
      });
      
      response += '_— Powered by GNews API_';
      
      return { text: response, private: isPrivate };
    } catch (error) {
      log('error', 'News command error: ' + error.message);
      
      // Map error to user-friendly message
      const errorMessages = {
        'NEWS_API_KEY_NOT_CONFIGURED': '⚠️ News API is not configured. Please contact the bot administrator.',
        'NEWS_API_INVALID_KEY': '⚠️ News API key is invalid. Please contact the bot administrator.',
        'NEWS_API_RATE_LIMITED': '⚠️ News service is rate limited. Please try again later.',
        'NEWS_API_FAILED': '⚠️ Unable to fetch news at the moment. Please try again.',
        'NEWS_API_TIMEOUT': '⚠️ News service is taking too long. Please try again.',
        'NEWS_API_INVALID_TOPIC': '⚠️ Invalid topic. Try: general, technology, business, entertainment, health, science, sports'
      };
      
      const userMessage = errorMessages[error.message] || '⚠️ Could not fetch news. Please try again later.';
      return { text: userMessage, private: isPrivate };
    }
  }, { 
    description: 'Get latest news by topic',
    category: 'utilities',
    usage: '[topic]'
  });
}

module.exports = {
  registerFunCommands,
  getWeatherCondition,
};
