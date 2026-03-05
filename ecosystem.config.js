// ============================================
// PM2 Ecosystem Configuration
// Optimized for AMD Athlon Silver / 6GB RAM
// ============================================

module.exports = {
  apps: [
    {
      name: "datrix-bot",
      script: "src/bot.js",

      // 🧠 Cap Node.js memory at 512MB for low-spec hardware
      node_args: "--max-old-space-size=512",

      // 🔄 Auto-restart policies
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000, // 5s delay between restarts
      max_memory_restart: "500M", // Restart if memory exceeds 500MB

      // 📝 Logging
      error_file: "logs/error.log",
      out_file: "logs/output.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // 🌍 Environment
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
