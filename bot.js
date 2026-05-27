'use strict';
/*
 * TrueNET Store Inventory Bot
 * STORE-BOT-20260527
 *
 * Commands (in stock group or private):
 *   /out  [item] [qty] [note?]      — issue items from store
 *   /in   [item] [qty] [note?]      — receive items into store
 *   /damage [item] [qty] [note?]    — write off damaged items
 *   /newhome [qty] [onu_type] [cust_id?] — record new installation
 *   /stock [item?]                  — show current levels
 *   /daily [YYYY-MM-DD?]            — today / date summary
 *   /low                            — items at or below threshold
 *   /items [category?]              — list all item codes
 *   /adjust [item] [qty] [reason]   — admin stock adjustment
 *   /chatid                         — print current chat ID (setup helper)
 *   /help                           — command reference
 *
 * Deploys as PM2 process "truenet-store-bot" on SG (194.233.65.77)
 * DB: dk_imdb via 127.0.0.1:3308
 */

require('dotenv').config();
const { Telegraf }  = require('telegraf');
const mysql         = require('mysql2/promise');
const cfg           = require('./isp-config.js');

// ── DB pool ───────────────────────────────────────────────────────────────
const db = mysql.createPool(cfg.database);

// ── Bot init ──────────────────────────────────────────────────────────────
if (!cfg.telegram.botToken) {
  console.error('[store-bot] STORE_BOT_TOKEN not set in .env — exiting');
  process.exit(1);
}
const bot = new Telegraf(cfg.telegram.botToken);

// ── Helpers ───────────────────────────────────────────────────────────────

/** Myanmar timezone offset: UTC+6:30 */
function nowMMT() {
  return new Date(Date.now() + 6.5 * 3600 * 1000);
}

/** Format Date as YYYY-MM-DD in MMT */
function mmtDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Pad string to fixed width (right or left) */
function pad(s, n, right = false) {
  const str = String(s ?? '');
  if (str.length >= n) return str.slice(0, n);
  return right ? str.padEnd(n) : str.padStart(n);
}

/** Monospace HTML table row */
function row(...cells) {
  return cells.join('  ');
}

/** Format number: drop trailing .00 */
function fmtQty(v) {
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Format MMK amount */
function fmtMMK(v) {
  return Number(v).toLocaleString('en-US') + ' K';
}

/** Display name from Telegram user object */
function staffName(from) {
  if (!from) return 'Unknown';
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
  return name || from.username || String(from.id);
}

/**
 * Resolve item by partial name or exact code.
 * Returns: { found: item } | { ambiguous: [items] } | { notFound: true }
 */
async function resolveItem(query) {
  const q = query.trim();
  // Exact code match (case-insensitive)
  const [byCode] = await db.query(
    'SELECT * FROM store_items WHERE UPPER(code) = ? AND is_active = 1',
    [q.toUpperCase()]
  );
  if (byCode.length === 1) return { found: byCode[0] };
  // Partial name / code match
  const [byName] = await db.query(
    `SELECT * FROM store_items
     WHERE is_active = 1
       AND (LOWER(name) LIKE ? OR LOWER(code) LIKE ?)
     ORDER BY name`,
    [`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`]
  );
  if (byName.length === 1) return { found: byName[0] };
  if (byName.length > 1) return { ambiguous: byName };
  return { notFound: true };
}

/**
 * Post a transaction and update stock atomically.
 * type: 'in' adds, everything else ('out','damage','newhome','adjust','termination','change') subtracts
 * For 'adjust': qty can be positive (add) or negative (subtract).
 * Returns updated balance.
 */
async function postTransaction({ itemId, type, quantity, staffTgId, staffName: sName, note, serialNumber, customerId }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the item row
    const [[item]] = await conn.query(
      'SELECT id, code, name, current_stock, unit FROM store_items WHERE id = ? FOR UPDATE',
      [itemId]
    );

    let delta;
    if (type === 'in' || type === 'adjust') {
      delta = Number(quantity);        // positive = add; adjust can be negative
    } else {
      delta = -Math.abs(Number(quantity)); // all outgoing types are negative
    }

    const newBalance = Number(item.current_stock) + delta;
    if (newBalance < 0 && type !== 'adjust') {
      await conn.rollback();
      conn.release();
      return { err: `Insufficient stock. Current: ${fmtQty(item.current_stock)} ${item.unit}` };
    }

    await conn.query(
      `UPDATE store_items SET current_stock = ? WHERE id = ?`,
      [newBalance, itemId]
    );

    await conn.query(
      `INSERT INTO store_transactions
         (item_id, type, quantity, balance_after, serial_number, customer_id, staff_tg_id, staff_name, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, type, Math.abs(Number(quantity)), newBalance, serialNumber || null, customerId || null,
       staffTgId || null, sName || null, note || null]
    );

    await conn.commit();
    conn.release();
    return { ok: true, balance: newBalance, item };
  } catch (e) {
    await conn.rollback().catch(() => {});
    conn.release();
    throw e;
  }
}

/** Check if a chat is authorised for transaction commands */
function isStockGroup(ctx) {
  if (!cfg.telegram.stockGroupId) return true; // no group configured = open (dev mode)
  return ctx.chat?.id === cfg.telegram.stockGroupId;
}

/** Check if sender is admin */
function isAdmin(ctx) {
  return cfg.telegram.adminIds.includes(ctx.from?.id);
}

/** Send a low-stock alert to the alert chat if item is below threshold */
async function checkLowStock(item) {
  const balance = Number(item.current_stock);
  if (balance > Number(item.min_threshold) * cfg.stock.alertFraction) return;
  const emoji = balance <= 0 ? '🔴' : '🟠';
  const msg = `${emoji} <b>Low Stock Alert</b>\n<code>${item.code}</code> ${item.name}\nBalance: <b>${fmtQty(balance)} ${item.unit}</b> (min: ${fmtQty(item.min_threshold)})`;
  try {
    await bot.telegram.sendMessage(cfg.telegram.alertChatId, msg, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('[low-stock alert]', e.message);
  }
}

/**
 * Send a potentially long HTML message that may contain a single <pre>...</pre>
 * block. Splits the pre content into <=4000-char chunks, each wrapped in its
 * own <pre> tag, with the header prefixed to the first chunk only.
 * Falls back to a plain line-split for non-pre messages.
 */
async function sendLong(ctx, text, opts = {}) {
  const LIMIT = 4000;
  if (text.length <= LIMIT) {
    await ctx.reply(text, opts);
    return;
  }

  // Check for <pre>...</pre> pattern
  const preMatch = text.match(/^([\s\S]*?)<pre>([\s\S]*?)<\/pre>([\s\S]*)$/);
  if (preMatch) {
    const prefix  = preMatch[1]; // header text before <pre>
    const content = preMatch[2]; // lines inside <pre>
    const suffix  = preMatch[3]; // any text after </pre>

    const preLines = content.split('\n');
    let isFirst = true;
    let chunk = '';

    const flush = async (extra) => {
      const wrapped = (isFirst ? prefix : '') + '<pre>' + chunk + extra + '</pre>';
      await ctx.reply(wrapped, opts);
      isFirst = false;
      chunk = '';
    };

    for (const line of preLines) {
      const testChunk = chunk ? chunk + '\n' + line : line;
      const testMsg   = (isFirst ? prefix : '') + '<pre>' + testChunk + '</pre>';
      if (testMsg.length > LIMIT) {
        if (chunk) await flush('');
        chunk = line;
      } else {
        chunk = testChunk;
      }
    }
    if (chunk) await flush('');
    if (suffix.trim()) await ctx.reply(suffix.trim(), opts);
    return;
  }

  // Fallback: plain line split (no <pre> awareness)
  const lines = text.split('\n');
  let chunk = '';
  for (const line of lines) {
    if (chunk.length + line.length + 1 > LIMIT) {
      await ctx.reply(chunk, opts);
      chunk = line;
    } else {
      chunk = chunk ? chunk + '\n' + line : line;
    }
  }
  if (chunk) await ctx.reply(chunk, opts);
}

/** Build a monospace stock table from rows array */
function buildStockTable(rows) {
  if (!rows.length) return '<i>No items found.</i>';

  const lines = [];
  lines.push('<pre>');
  lines.push('Code         Item                 Qty    Unit');
  lines.push('─────────────────────────────────────────────');

  let prevCat = null;
  for (const r of rows) {
    if (r.category !== prevCat) {
      const catLabel = { onu:'ONU', splitter:'Splitter', connector:'Connector',
                         cable:'Cable', accessory:'Accessory', other:'Other' }[r.category] || r.category;
      lines.push(`── ${catLabel} ───────────────────────────────────`);
      prevCat = r.category;
    }
    const low = Number(r.current_stock) <= Number(r.min_threshold) ? '⚠' : ' ';
    lines.push(
      `${low}${pad(r.code, 12, true)} ${pad(r.name, 20, true)} ${pad(fmtQty(r.current_stock), 6)} ${r.unit}`
    );
  }
  lines.push('</pre>');
  return lines.join('\n');
}

// ─── Command handlers ──────────────────────────────────────────────────────

// /chatid — Setup helper
bot.command('chatid', ctx => {
  const chat = ctx.chat;
  ctx.reply(
    `<b>Chat ID:</b> <code>${chat.id}</code>\n` +
    `<b>Type:</b> ${chat.type}\n` +
    (chat.title ? `<b>Title:</b> ${chat.title}\n` : '') +
    `\nSet <code>STOCK_GROUP_CHAT_ID=${chat.id}</code> in .env and restart bot.`,
    { parse_mode: 'HTML' }
  );
});

// /help
bot.command(['help', 'start'], ctx => {
  const isGroup = ctx.chat?.type !== 'private';
  const groupNote = cfg.telegram.stockGroupId
    ? `\n📦 Transaction commands only work in the configured stock group.`
    : `\n⚠️ No group configured. Set STOCK_GROUP_CHAT_ID in .env.`;

  ctx.reply(
    `<b>🏪 TrueNET Store Bot</b>\n\n` +
    `<b>📥 Transactions (group only):</b>\n` +
    `/in [item] [qty] [note] — ပစ္စည်းဝင်ရောက်\n` +
    `/out [item] [qty] [note] — ပစ္စည်းထုတ်ပေး\n` +
    `/damage [item] [qty] [note] — ပစ္စည်းပျက်စီး\n` +
    `/newhome [qty] [onu] [cust_id] — ONU တပ်ဆင်မှတ်တမ်း\n\n` +
    `<b>📊 Reports (anywhere):</b>\n` +
    `/stock — summary · /stock onu/splitter/cable… · /stock [code]\n` +
    `/daily [date?] — နေ့စဉ် အဝင်အထွက်\n` +
    `/low — နည်းပါးနေသောပစ္စည်းများ\n` +
    `/items [category?] — ပစ္စည်းစာရင်း\n\n` +
    `<b>🔧 Admin:</b>\n` +
    `/adjust [item] [qty] [reason] — Stock adjustment\n\n` +
    `<b>Item codes:</b> Use /items to see all codes.\n` +
    `Format: /out ONU-X6AIS 2 or /out x6ais 2\n` +
    groupNote,
    { parse_mode: 'HTML' }
  );
});

// /items [category?]
bot.command('items', async ctx => {
  try {
    const args = ctx.message.text.split(/\s+/).slice(1);
    const catFilter = args[0]?.toLowerCase();

    const catMap = { onu:'onu', splitter:'splitter', connector:'connector',
                     cable:'cable', accessory:'accessory', other:'other' };
    const cat = catMap[catFilter] || null;

    const [rows] = await db.query(
      `SELECT code, name, unit, category FROM store_items WHERE is_active = 1 ${cat ? 'AND category = ?' : ''} ORDER BY category, name`,
      cat ? [cat] : []
    );

    if (!rows.length) { await ctx.reply('No items found.'); return; }

    let msg = '<b>📦 Item Codes</b>\n<pre>';
    msg += 'Code          Name                 Unit\n';
    msg += '──────────────────────────────────────\n';
    let prevCat = null;
    for (const r of rows) {
      if (r.category !== prevCat) {
        const label = { onu:'ONU', splitter:'Splitter', connector:'Connector',
                        cable:'Cable', accessory:'Accessory', other:'Other' }[r.category] || r.category;
        msg += `── ${label} ${'─'.repeat(Math.max(0, 30 - label.length - 4))}\n`;
        prevCat = r.category;
      }
      msg += `${pad(r.code, 13, true)} ${pad(r.name, 20, true)} ${r.unit}\n`;
    }
    msg += '</pre>';
    await ctx.reply(msg, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('/items', e);
    await ctx.reply('❌ Error fetching items: ' + e.message);
  }
});

// /stock [category|item?]
// /stock             -> category summary (counts per category)
// /stock onu         -> all ONU items, paginated
// /stock [code/name] -> single item detail
bot.command('stock', async ctx => {
  try {
    const args = ctx.message.text.split(/\s+/).slice(1);
    const query = args.join(' ').trim().toLowerCase();

    const CAT_MAP = {
      onu: 'onu', onus: 'onu',
      splitter: 'splitter', splitters: 'splitter',
      connector: 'connector', connectors: 'connector', con: 'connector',
      cable: 'cable', cables: 'cable',
      accessory: 'accessory', accessories: 'accessory', acc: 'accessory',
      other: 'other', others: 'other',
    };
    const CAT_LABEL = { onu: 'ONU', splitter: 'Splitter', connector: 'Connector',
                        cable: 'Cable', accessory: 'Accessory', other: 'Other' };
    const catKey = query ? CAT_MAP[query] : null;

    if (!query) {
      // ── Summary view ──────────────────────────────────────────
      const [rows] = await db.query(
        `SELECT category,
                COUNT(*) AS total,
                SUM(current_stock > 0) AS in_stock,
                SUM(current_stock <= min_threshold) AS low_cnt
         FROM store_items WHERE is_active = 1
         GROUP BY category
         ORDER BY FIELD(category,'onu','splitter','connector','cable','accessory','other')`
      );
      let table = '<pre>';
      table += 'Category      Items InStk  Low\n';
      table += '──────────────────────────────\n';
      let totItems = 0, totIn = 0, totLow = 0;
      for (const r of rows) {
        const label = CAT_LABEL[r.category] || r.category;
        table += `${pad(label, 13, true)}${pad(r.total, 5)}  ${pad(r.in_stock, 4)}   ${pad(r.low_cnt, 3)}\n`;
        totItems += Number(r.total); totIn += Number(r.in_stock); totLow += Number(r.low_cnt);
      }
      table += '──────────────────────────────\n';
      table += `${pad('TOTAL', 13, true)}${pad(totItems, 5)}  ${pad(totIn, 4)}   ${pad(totLow, 3)}\n`;
      table += '</pre>';
      const header = `<b>📦 TrueNET Store — Stock Summary</b>\n` +
        `<i>${mmtDate(nowMMT())} MMT${totLow > 0 ? ` · ⚠️ ${totLow} low` : ''}</i>\n\n`;
      const footer = '\n<i>👉 /stock onu · /stock splitter · /stock connector\n' +
        '   /stock cable · /stock accessory · /stock other\n' +
        '   /stock [code] for one item · /low for all low items</i>';
      await ctx.reply(header + table + footer, { parse_mode: 'HTML' });
      return;
    }

    if (catKey) {
      // ── Category detail view ──────────────────────────────────
      const [rows] = await db.query(
        'SELECT * FROM store_items WHERE is_active = 1 AND category = ? ORDER BY name',
        [catKey]
      );
      if (!rows.length) { await ctx.reply(`No items in category: ${catKey}`); return; }
      const lowCount = rows.filter(r => Number(r.current_stock) <= Number(r.min_threshold)).length;
      const header = `<b>📦 ${CAT_LABEL[catKey] || catKey} — ${rows.length} items</b>\n` +
        `<i>${mmtDate(nowMMT())} MMT${lowCount > 0 ? ` · ⚠️ ${lowCount} low` : ''}</i>\n\n`;
      await sendLong(ctx, header + buildStockTable(rows), { parse_mode: 'HTML' });
      return;
    }

    // ── Single item lookup ────────────────────────────────────
    const res = await resolveItem(query);
    if (res.notFound) {
      await ctx.reply(
        `❌ Not found: <code>${query}</code>\n` +
        `Try /stock onu · /stock splitter · /stock cable\nor /items to browse all codes.`,
        { parse_mode: 'HTML' }
      );
      return;
    }
    if (res.ambiguous) {
      const list = res.ambiguous.slice(0, 10).map(i => `• <code>${i.code}</code> — ${i.name}`).join('\n');
      await ctx.reply(`⚠️ Multiple matches for "${query}":\n${list}\n\nUse the exact code.`, { parse_mode: 'HTML' });
      return;
    }
    const i = res.found;
    const lowFlag = Number(i.current_stock) <= Number(i.min_threshold) ? ' ⚠️ LOW' : '';
    await ctx.reply(
      `<b>📦 ${i.name}</b> <code>(${i.code})</code>${lowFlag}\n\n` +
      `<b>Stock:</b> ${fmtQty(i.current_stock)} ${i.unit}\n` +
      `<b>Min threshold:</b> ${fmtQty(i.min_threshold)} ${i.unit}\n` +
      `<b>Category:</b> ${i.category}\n` +
      (i.price_mmk > 0 ? `<b>Price:</b> ${fmtMMK(i.price_mmk)}\n` : ''),
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    console.error('/stock', e);
    await ctx.reply('❌ Error: ' + e.message);
  }
});

// /low
bot.command('low', async ctx => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM store_items
       WHERE is_active = 1 AND current_stock <= min_threshold
       ORDER BY (current_stock / NULLIF(min_threshold,0)), category, name`
    );
    if (!rows.length) {
      await ctx.reply('✅ All items are above minimum threshold.'); return;
    }
    let msg = `<b>⚠️ Low Stock Items (${rows.length})</b>\n<pre>`;
    msg += 'Code          Name                 Qty    Min\n';
    msg += '──────────────────────────────────────────────\n';
    for (const r of rows) {
      const empty = Number(r.current_stock) <= 0 ? '🔴' : '🟠';
      msg += `${empty}${pad(r.code, 12, true)} ${pad(r.name, 20, true)} ${pad(fmtQty(r.current_stock), 6)} ${fmtQty(r.min_threshold)}\n`;
    }
    msg += '</pre>';
    await ctx.reply(msg, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('/low', e);
    await ctx.reply('❌ Error: ' + e.message);
  }
});

// /daily [YYYY-MM-DD?]
bot.command('daily', async ctx => {
  try {
    const args = ctx.message.text.split(/\s+/).slice(1);
    let dateStr = args[0]?.match(/^\d{4}-\d{2}-\d{2}$/) ? args[0] : mmtDate(nowMMT());

    // Note: DB stores UTC, transactions from bot are timestamped in UTC
    // MMT = UTC+6:30, so a MMT day starts at UTC 17:30 of the previous day.
    // We convert: MMT date YYYY-MM-DD → UTC range [date-1 17:30 .. date 17:30)
    const [yyyy, mm, dd] = dateStr.split('-').map(Number);
    // Start of MMT day in UTC: subtract 6h30m
    const startUTC = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0) - 6.5 * 3600 * 1000);
    const endUTC   = new Date(startUTC.getTime() + 24 * 3600 * 1000);

    const [rows] = await db.query(
      `SELECT t.type, t.quantity, t.balance_after, t.note, t.customer_id,
              t.staff_name, t.created_at,
              i.code, i.name, i.unit
       FROM store_transactions t
       JOIN store_items i ON i.id = t.item_id
       WHERE t.created_at >= ? AND t.created_at < ?
       ORDER BY t.created_at`,
      [startUTC, endUTC]
    );

    if (!rows.length) {
      await ctx.reply(`📅 No transactions on <b>${dateStr}</b> MMT.`, { parse_mode: 'HTML' }); return;
    }

    // Summary counts per type
    const summary = {};
    for (const r of rows) {
      summary[r.type] = (summary[r.type] || 0) + 1;
    }
    const summaryLine = Object.entries(summary).map(([t, c]) => {
      const emoji = { in:'📥', out:'📤', damage:'💥', newhome:'🏠', adjust:'🔧', termination:'🚫', change:'🔄' }[t] || '•';
      return `${emoji}${t}×${c}`;
    }).join('  ');

    let msg = `<b>📅 Daily Report — ${dateStr} MMT</b>\n<i>${summaryLine} · ${rows.length} total</i>\n\n<pre>`;
    msg += 'Time    Type      Item         Qty   Staff\n';
    msg += '──────────────────────────────────────────────────\n';
    for (const r of rows) {
      // Convert UTC stored time back to MMT for display
      const tLocal = new Date(new Date(r.created_at).getTime() + 6.5 * 3600 * 1000);
      const timeStr = tLocal.toISOString().slice(11, 16); // HH:MM
      const typeEmoji = { in:'↑', out:'↓', damage:'✗', newhome:'⌂', adjust:'±', termination:'✗', change:'⇄' }[r.type] || '?';
      const custNote = r.customer_id ? ` [${r.customer_id}]` : (r.note ? ` ${r.note.slice(0,10)}` : '');
      msg += `${timeStr}  ${typeEmoji}${pad(r.type, 9, true)} ${pad(r.code, 12, true)} ${pad(fmtQty(r.quantity), 5)} ${(r.staff_name||'?').slice(0,10)}${custNote}\n`;
    }
    msg += '</pre>';
    await ctx.reply(msg, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('/daily', e);
    await ctx.reply('❌ Error: ' + e.message);
  }
});

// ─── Transaction commands (group-only) ────────────────────────────────────

/**
 * Parse: /cmd [item_query] [qty] [note?]
 * item_query = one or more words (before the numeric qty)
 * qty = first number found after item
 */
function parseTxArgs(text) {
  // Strip command prefix
  const body = text.replace(/^\/\w+(@\S+)?\s*/, '').trim();
  if (!body) return null;

  // Find the first standalone number (qty)
  // Pattern: everything before the first number = item, number = qty, rest = note
  const m = body.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  return {
    itemQuery: m[1].trim(),
    qty:       Number(m[2]),
    note:      m[3].trim() || null,
  };
}

async function handleTx(ctx, type) {
  if (!isStockGroup(ctx)) {
    await ctx.reply('⚠️ Transaction commands only work in the stock group.'); return;
  }

  const parsed = parseTxArgs(ctx.message.text);
  if (!parsed) {
    const usage = {
      in:      '/in [item] [qty] [note]',
      out:     '/out [item] [qty] [note]',
      damage:  '/damage [item] [qty] [note]',
    }[type] || `/${type} [item] [qty]`;
    await ctx.reply(`Usage: <code>${usage}</code>`, { parse_mode: 'HTML' }); return;
  }

  const { itemQuery, qty, note } = parsed;
  if (qty <= 0) { await ctx.reply('❌ Quantity must be positive.'); return; }

  const res = await resolveItem(itemQuery);
  if (res.notFound) {
    await ctx.reply(`❌ Item not found: <code>${itemQuery}</code>\nUse /items to see all item codes.`, { parse_mode: 'HTML' }); return;
  }
  if (res.ambiguous) {
    const list = res.ambiguous.slice(0, 8).map(i => `• <code>${i.code}</code> — ${i.name}`).join('\n');
    await ctx.reply(`⚠️ Multiple matches for "<b>${itemQuery}</b>":\n${list}\n\nPlease use the exact item code.`, { parse_mode: 'HTML' }); return;
  }

  const item = res.found;
  try {
    const tx = await postTransaction({
      itemId:    item.id,
      type,
      quantity:  qty,
      staffTgId: ctx.from.id,
      staffName: staffName(ctx.from),
      note,
    });
    if (tx.err) { await ctx.reply(`❌ ${tx.err}`); return; }

    const typeEmoji  = { in:'📥', out:'📤', damage:'💥' }[type] || '✅';
    const typeLabel  = { in:'Received', out:'Issued', damage:'Damaged' }[type] || type;
    const lowWarning = Number(tx.balance) <= Number(item.min_threshold) ? `\n⚠️ <b>LOW STOCK</b> — Below minimum (${fmtQty(item.min_threshold)} ${item.unit})` : '';

    await ctx.reply(
      `${typeEmoji} <b>${typeLabel}</b>\n` +
      `Item: <code>${item.code}</code> ${item.name}\n` +
      `Qty: <b>${fmtQty(qty)} ${item.unit}</b>\n` +
      `Balance: <b>${fmtQty(tx.balance)} ${item.unit}</b>\n` +
      `By: ${staffName(ctx.from)}` +
      (note ? `\nNote: ${note}` : '') +
      lowWarning,
      { parse_mode: 'HTML' }
    );

    // Fetch updated item for threshold check
    const [[updatedItem]] = await db.query('SELECT * FROM store_items WHERE id = ?', [item.id]);
    await checkLowStock(updatedItem);
  } catch (e) {
    console.error(`/${type}`, e);
    await ctx.reply('❌ DB error: ' + e.message);
  }
}

bot.command('in',     ctx => handleTx(ctx, 'in'));
bot.command('out',    ctx => handleTx(ctx, 'out'));
bot.command('damage', ctx => handleTx(ctx, 'damage'));

// /newhome [qty] [onu_type] [cust_id?]
// Example: /newhome 1 ONU-X6AIS TF11100001
bot.command('newhome', async ctx => {
  if (!isStockGroup(ctx)) {
    await ctx.reply('⚠️ Transaction commands only work in the stock group.'); return;
  }

  const args = ctx.message.text.replace(/^\/\w+(@\S+)?\s*/, '').trim().split(/\s+/);
  if (args.length < 2) {
    await ctx.reply(
      'Usage: <code>/newhome [qty] [onu_code] [cust_id?] [note?]</code>\n' +
      'Example: <code>/newhome 1 ONU-X6AIS TF11100001</code>',
      { parse_mode: 'HTML' }
    ); return;
  }

  let qty = Number(args[0]);
  let onuQuery = args[1];
  let customerId = args[2] || null;
  let note = args.slice(3).join(' ') || null;

  // Allow: /newhome ONU-X6AIS 1 TF... (item first, qty second)
  if (isNaN(qty) || qty <= 0) {
    onuQuery = args[0];
    qty = Number(args[1]);
    customerId = args[2] || null;
    note = args.slice(3).join(' ') || null;
  }
  if (!qty || qty <= 0) { await ctx.reply('❌ Invalid quantity.'); return; }

  const res = await resolveItem(onuQuery);
  if (res.notFound) {
    await ctx.reply(`❌ ONU type not found: <code>${onuQuery}</code>\nUse /items onu to see ONU codes.`, { parse_mode: 'HTML' }); return;
  }
  if (res.ambiguous) {
    const list = res.ambiguous.slice(0, 8).map(i => `• <code>${i.code}</code> — ${i.name}`).join('\n');
    await ctx.reply(`⚠️ Multiple ONU matches:\n${list}\n\nUse the exact code.`, { parse_mode: 'HTML' }); return;
  }

  const item = res.found;
  try {
    const tx = await postTransaction({
      itemId:     item.id,
      type:       'newhome',
      quantity:   qty,
      staffTgId:  ctx.from.id,
      staffName:  staffName(ctx.from),
      customerId,
      note:       note || (customerId ? `New installation for ${customerId}` : 'New installation'),
    });
    if (tx.err) { await ctx.reply(`❌ ${tx.err}`); return; }

    const lowWarning = Number(tx.balance) <= Number(item.min_threshold)
      ? `\n⚠️ <b>LOW STOCK</b> — Only ${fmtQty(tx.balance)} remaining!` : '';

    await ctx.reply(
      `🏠 <b>New Installation Recorded</b>\n` +
      `ONU: <code>${item.code}</code> ${item.name} × ${fmtQty(qty)}\n` +
      (customerId ? `Customer: <code>${customerId}</code>\n` : '') +
      `ONU Balance: <b>${fmtQty(tx.balance)} no</b>\n` +
      `By: ${staffName(ctx.from)}` +
      (note ? `\nNote: ${note}` : '') +
      lowWarning,
      { parse_mode: 'HTML' }
    );

    const [[updatedItem]] = await db.query('SELECT * FROM store_items WHERE id = ?', [item.id]);
    await checkLowStock(updatedItem);
  } catch (e) {
    console.error('/newhome', e);
    await ctx.reply('❌ DB error: ' + e.message);
  }
});

// /adjust [item] [qty] [reason?]   (admin only)
// qty can be positive (add) or negative (subtract) or "=N" (set absolute)
bot.command('adjust', async ctx => {
  if (!isAdmin(ctx)) { await ctx.reply('❌ Admin only command.'); return; }

  const body = ctx.message.text.replace(/^\/\w+(@\S+)?\s*/, '').trim();
  const m = body.match(/^(.+?)\s+(=?-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) {
    await ctx.reply(
      'Usage: <code>/adjust [item] [qty] [reason]</code>\n' +
      'qty: positive to add, negative to subtract, =N to set absolute\n' +
      'Example: <code>/adjust ONU-X6AIS 10 Opening stock</code>',
      { parse_mode: 'HTML' }
    ); return;
  }

  const [, itemQuery, qtyStr, reason] = m;
  const res = await resolveItem(itemQuery);
  if (res.notFound) { await ctx.reply(`❌ Item not found: ${itemQuery}`); return; }
  if (res.ambiguous) {
    const list = res.ambiguous.slice(0,6).map(i => `• ${i.code} — ${i.name}`).join('\n');
    await ctx.reply(`⚠️ Ambiguous:\n${list}`); return;
  }

  const item = res.found;
  let qty, note;

  if (qtyStr.startsWith('=')) {
    // Absolute set: calculate delta
    const target = Number(qtyStr.slice(1));
    qty = target - Number(item.current_stock);
    note = `Absolute set to ${target}` + (reason ? ` — ${reason}` : '');
  } else {
    qty = Number(qtyStr);
    note = reason || 'Manual adjustment';
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[locked]] = await conn.query('SELECT * FROM store_items WHERE id = ? FOR UPDATE', [item.id]);
    const newBalance = Number(locked.current_stock) + qty;
    await conn.query('UPDATE store_items SET current_stock = ? WHERE id = ?', [newBalance, item.id]);
    await conn.query(
      `INSERT INTO store_transactions (item_id, type, quantity, balance_after, staff_tg_id, staff_name, note)
       VALUES (?, 'adjust', ?, ?, ?, ?, ?)`,
      [item.id, Math.abs(qty), newBalance, ctx.from.id, staffName(ctx.from), note]
    );
    await conn.commit();
    conn.release();

    await ctx.reply(
      `🔧 <b>Stock Adjusted</b>\n` +
      `Item: <code>${item.code}</code> ${item.name}\n` +
      `Change: ${qty >= 0 ? '+' : ''}${fmtQty(qty)} → Balance: <b>${fmtQty(newBalance)} ${item.unit}</b>\n` +
      `Reason: ${note}\nBy: ${staffName(ctx.from)}`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    await conn.rollback().catch(() => {});
    conn.release();
    await ctx.reply('❌ Error: ' + e.message);
  }
});

// ─── Daily summary cron (8 PM MMT = 13:30 UTC) ────────────────────────────
async function sendDailySummary() {
  if (!cfg.telegram.stockGroupId) return;
  try {
    const today = mmtDate(nowMMT());
    const [yyyy, mm, dd] = today.split('-').map(Number);
    const startUTC = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0) - 6.5 * 3600 * 1000);
    const endUTC   = new Date(startUTC.getTime() + 24 * 3600 * 1000);

    const [rows] = await db.query(
      `SELECT t.type, COUNT(*) as cnt, SUM(t.quantity) as total_qty,
              GROUP_CONCAT(DISTINCT i.name ORDER BY i.name SEPARATOR ', ') as items_used
       FROM store_transactions t
       JOIN store_items i ON i.id = t.item_id
       WHERE t.created_at >= ? AND t.created_at < ?
       GROUP BY t.type
       ORDER BY t.type`,
      [startUTC, endUTC]
    );

    const [lowRows] = await db.query(
      'SELECT code, name, current_stock, min_threshold, unit FROM store_items WHERE is_active=1 AND current_stock <= min_threshold ORDER BY current_stock'
    );

    if (!rows.length && !lowRows.length) return; // no activity, skip summary

    let msg = `<b>📦 Daily Stock Summary — ${today}</b>\n\n`;
    if (rows.length) {
      msg += '<b>Transactions today:</b>\n<pre>';
      for (const r of rows) {
        const emoji = { in:'📥', out:'📤', damage:'💥', newhome:'🏠', adjust:'🔧' }[r.type] || '•';
        msg += `${emoji} ${pad(r.type, 10, true)} ${pad(r.cnt + 'x', 4)} (${fmtQty(r.total_qty)} units)\n`;
      }
      msg += '</pre>';
    }
    if (lowRows.length) {
      msg += `\n⚠️ <b>Low stock (${lowRows.length}):</b>\n<pre>`;
      for (const r of lowRows) {
        const flag = Number(r.current_stock) <= 0 ? '🔴' : '🟠';
        msg += `${flag}${pad(r.code, 12, true)} ${fmtQty(r.current_stock)}/${fmtQty(r.min_threshold)} ${r.unit}\n`;
      }
      msg += '</pre>';
    }

    await bot.telegram.sendMessage(cfg.telegram.stockGroupId, msg, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('[daily-summary]', e.message);
  }
}

// Check every minute, send at 20:00 MMT (13:30 UTC)
let lastSummaryDate = null;
setInterval(async () => {
  const now = nowMMT();
  const h = now.getUTCHours() + (6 * 60 + 30) / 60;
  // Actually simpler: check if it's 20:xx MMT (13:30-14:29 UTC)
  // nowMMT() is already shifted, so hours() in UTC on that date gives MMT hours
  const mmtHour = now.toISOString().slice(11, 13);
  const today = mmtDate(now);
  if (mmtHour === '20' && lastSummaryDate !== today) {
    lastSummaryDate = today;
    await sendDailySummary();
  }
}, 60 * 1000);

// ─── Auto-register when bot is added to a group ───────────────────────────
// When @truenet_mcp_bot (store bot) is added to any group, it DMs Myo Zaw
// with the group name and chat ID so it can be set in STOCK_GROUP_CHAT_ID.
bot.on('my_chat_member', async ctx => {
  try {
    const member = ctx.myChatMember;
    const chat   = member.chat;
    const newStatus = member.new_chat_member?.status;
    if (!['member','administrator'].includes(newStatus)) return; // only care about being added
    const groupName = chat.title || chat.username || 'unnamed';
    const groupId   = chat.id;
    const groupType = chat.type;

    console.log(`[store-bot] Added to ${groupType}: "${groupName}" (${groupId})`);

    // Notify admin
    const msg =
      `🏪 <b>Store Bot Added to Group</b>\n\n` +
      `<b>Group:</b> ${groupName}\n` +
      `<b>ID:</b> <code>${groupId}</code>\n` +
      `<b>Type:</b> ${groupType}\n\n` +
      `To configure as the stock group, run on SG:\n` +
      `<code>cd /root/truenet-store-bot && sed -i 's/^# STOCK_GROUP_CHAT_ID=.*/STOCK_GROUP_CHAT_ID=${groupId}/' .env; grep -q '^STOCK_GROUP_CHAT_ID' .env || echo 'STOCK_GROUP_CHAT_ID=${groupId}' >> .env; pm2 restart truenet-store-bot</code>`;

    await bot.telegram.sendMessage(cfg.telegram.alertChatId, msg, { parse_mode: 'HTML' });

    // Also greet the group
    await ctx.telegram.sendMessage(groupId,
      `👋 <b>TrueNET Store Bot is ready!</b>\n\nType /help to see commands.\nType /chatid to get this group's ID.`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    console.error('[my_chat_member]', e.message);
  }
});

// ─── Error handler ────────────────────────────────────────────────────────
bot.catch((err, ctx) => {
  console.error('[bot error]', ctx?.updateType, err.message);
});

// ─── Launch ───────────────────────────────────────────────────────────────
async function main() {
  // Test DB connection
  try {
    const conn = await db.getConnection();
    await conn.ping();
    conn.release();
    console.log('[store-bot] DB connected (dk_imdb:3308)');
  } catch (e) {
    console.error('[store-bot] DB connection failed:', e.message);
    process.exit(1);
  }

  // Log current config
  console.log('[store-bot] Stock group ID:', cfg.telegram.stockGroupId || '(not set — open mode)');
  console.log('[store-bot] Admin IDs:', cfg.telegram.adminIds.join(', '));

  await bot.launch({ dropPendingUpdates: true });
  console.log('[store-bot] Bot started (polling)');

  // Graceful shutdown
  process.once('SIGINT',  () => { console.log('[store-bot] SIGINT'); bot.stop('SIGINT');  });
  process.once('SIGTERM', () => { console.log('[store-bot] SIGTERM'); bot.stop('SIGTERM'); });
}

main().catch(e => {
  console.error("[store-bot] Fatal:", e.message || e);
  
  
  process.exit(1);
});
