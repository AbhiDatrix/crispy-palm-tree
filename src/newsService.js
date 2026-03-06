// ============================================
// 📰 newsService.js — GNews API Integration
// ============================================
// Provides real news from GNews API
// Free tier: 100 requests/day
// Get API key from: https://gnews.io/
// ============================================

const axios = require('axios');

const GNEWS_BASE_URL = 'https://gnews.io/api/v4';

// Valid topics for the GNews API
const VALID_TOPICS = [
  'general',
  'technology',
  'business',
  'entertainment',
  'health',
  'science',
  'sports'
];

class NewsService {
  constructor() {
    this.apiKey = process.env.GNEWS_API_KEY || '';
    this.maxArticles = 5;
  }

  /**
   * Check if API key is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Fetch top headlines by topic
   * @param {string} topic - Topic category (general, technology, business, etc.)
   * @param {string} country - Country code (default: us)
   */
  async fetchTopNews(topic = 'general', country = 'us') {
    if (!this.apiKey) {
      throw new Error('NEWS_API_KEY_NOT_CONFIGURED');
    }

    // Validate topic
    if (!VALID_TOPICS.includes(topic.toLowerCase())) {
      topic = 'general';
    }

    try {
      const response = await axios.get(`${GNEWS_BASE_URL}/top-headlines`, {
        params: {
          topic: topic.toLowerCase(),
          country: country,
          lang: 'en',
          max: this.maxArticles
        },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 10000
      });

      return this.formatNewsResponse(response.data.articles);
    } catch (error) {
      if (error.response) {
        if (error.response.status === 401) {
          throw new Error('NEWS_API_INVALID_KEY');
        }
        if (error.response.status === 429) {
          throw new Error('NEWS_API_RATE_LIMITED');
        }
        if (error.response.status === 400) {
          // Bad request - possibly invalid topic
          throw new Error('NEWS_API_INVALID_TOPIC');
        }
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('NEWS_API_TIMEOUT');
      }
      throw new Error('NEWS_API_FAILED');
    }
  }

  /**
   * Search for news by query
   * @param {string} query - Search query
   */
  async searchNews(query) {
    if (!this.apiKey) {
      throw new Error('NEWS_API_KEY_NOT_CONFIGURED');
    }

    if (!query || query.trim().length === 0) {
      throw new Error('NEWS_API_SEARCH_FAILED');
    }

    try {
      const response = await axios.get(`${GNEWS_BASE_URL}/search`, {
        params: {
          q: query.trim(),
          lang: 'en',
          max: this.maxArticles
        },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 10000
      });

      return this.formatNewsResponse(response.data.articles);
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('NEWS_API_INVALID_KEY');
      }
      if (error.response?.status === 429) {
        throw new Error('NEWS_API_RATE_LIMITED');
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('NEWS_API_TIMEOUT');
      }
      throw new Error('NEWS_API_SEARCH_FAILED');
    }
  }

  /**
   * Format news API response into clean structure
   * @param {Array} articles - Raw articles from API
   */
  formatNewsResponse(articles) {
    if (!articles || articles.length === 0) {
      return [];
    }

    return articles.map(article => ({
      title: article.title || 'Untitled',
      description: article.description || '',
      url: article.url || '',
      source: article.source?.name || 'Unknown Source',
      publishedAt: article.publishedAt || '',
      image: article.image || null
    }));
  }

  /**
   * Get valid topics list
   */
  getValidTopics() {
    return VALID_TOPICS;
  }
}

// Export singleton instance
const newsService = new NewsService();

module.exports = {
  newsService,
  NewsService,
  VALID_TOPICS
};
