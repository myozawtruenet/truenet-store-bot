'use strict';
// STORE-BOT-CONFIG-20260527
// Central config for TrueNET Store Inventory Bot.
// Secrets (tokens, passwords) are in .env only — this file is git-safe.

module.exports = {
  isp: {
    name:   'TrueNET',
    nameMM: 'TrueNET',
  },

  telegram: {
    botToken:    process.env.STORE_BOT_TOKEN,
    adminIds:    (process.env.ADMIN_IDS || '6441861375').split(',').map(s => Number(s.trim())).filter(Boolean),
    // TN Daily Stock group. Set STOCK_GROUP_CHAT_ID in .env after bot is added to the group.
    stockGroupId: process.env.STOCK_GROUP_CHAT_ID ? Number(process.env.STOCK_GROUP_CHAT_ID) : null,
    // Notify Myo Zaw on low-stock alert
    alertChatId:  process.env.ALERT_CHAT_ID ? Number(process.env.ALERT_CHAT_ID) : 6441861375,
  },

  database: {
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     Number(process.env.DB_PORT || 3308),
    user:     process.env.DB_USER     || 'truenet_user',
    password: process.env.DB_PASS,      // secret → .env only
    database: process.env.DB_NAME     || 'dk_imdb',
    connectionLimit: 5,
    waitForConnections: true,
    timezone: '+06:30',                 // MMT = UTC+6:30
    charset:  'utf8mb4',
  },

  stock: {
    // When stock drops below this fraction of min_threshold, trigger an alert
    alertFraction: Number(process.env.ALERT_FRACTION || 1.0),
    // Max items to show in /stock table before truncating
    tableMaxRows:  Number(process.env.TABLE_MAX_ROWS || 50),
  },
};
