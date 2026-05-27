-- ============================================================
-- TrueNET Store Inventory Bot — Database Schema
-- STORE-BOT-20260527
-- Apply to dk_imdb on 10.0.10.42 (via 127.0.0.1:3308 tunnel)
-- ============================================================

-- ── Items master table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(20) NOT NULL UNIQUE,
  name            VARCHAR(100) NOT NULL,
  name_mm         VARCHAR(100) DEFAULT '',
  unit            VARCHAR(20) DEFAULT 'no',
  current_stock   DECIMAL(10,2) DEFAULT 0,
  min_threshold   DECIMAL(10,2) DEFAULT 5,
  price_mmk       DECIMAL(12,2) DEFAULT 0,
  category        ENUM('onu','splitter','connector','cable','accessory','other') DEFAULT 'other',
  is_active       TINYINT(1) DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_category (category),
  KEY idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Transactions log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_transactions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  item_id         INT NOT NULL,
  type            ENUM('in','out','damage','newhome','adjust','termination','change') NOT NULL,
  quantity        DECIMAL(10,2) NOT NULL,
  balance_after   DECIMAL(10,2) NOT NULL COMMENT 'stock balance AFTER this transaction',
  serial_number   VARCHAR(100) DEFAULT NULL,
  customer_id     VARCHAR(30) DEFAULT NULL,
  staff_tg_id     BIGINT DEFAULT NULL,
  staff_name      VARCHAR(100) DEFAULT NULL,
  note            TEXT DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES store_items(id),
  KEY idx_item_date (item_id, created_at),
  KEY idx_type (type),
  KEY idx_date (created_at),
  KEY idx_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Seed: ONUs ────────────────────────────────────────────────
INSERT IGNORE INTO store_items (code, name, name_mm, unit, current_stock, min_threshold, price_mmk, category) VALUES
  ('ONU-X6AIS',  'X6-AIS ONU',        'X6-AIS ONU',         'no', 0, 5, 0, 'onu'),
  ('ONU-GP5G',   'GPon5G ONU',         'GPon5G ONU',         'no', 0, 5, 0, 'onu'),
  ('ONU-4P',     'ONU 4-Port',         'ONU 4-Port',         'no', 0, 5, 0, 'onu'),
  ('ONU-2P',     'ONU 2-Port',         'ONU 2-Port',         'no', 0, 5, 0, 'onu'),
  ('ONU-OVAL',   'ONU Oval',           'ONU Oval',           'no', 0, 5, 0, 'onu'),
  ('ONU-SML',    'ONU Small',          'ONU Small',          'no', 0, 5, 0, 'onu'),
  ('ONU-HW',     'Huawei Black ONU',   'Huawei Black ONU',   'no', 0, 5, 0, 'onu'),
  ('ONU-RJ',     'Ruijie ONU',         'Ruijie ONU',         'no', 0, 5, 0, 'onu'),
  ('ONU-TPL',    'TP-Link ONU',        'TP-Link ONU',        'no', 0, 5, 0, 'onu'),
  ('ONU-TDA',    'Tenda ONU',          'Tenda ONU',          'no', 0, 5, 0, 'onu'),
  ('ONU-MCS',    'Mercusys ONU',       'Mercusys ONU',       'no', 0, 5, 0, 'onu');

-- ── Seed: Splitters ──────────────────────────────────────────
INSERT IGNORE INTO store_items (code, name, name_mm, unit, current_stock, min_threshold, price_mmk, category) VALUES
  ('SPL-116',    'Splitter 1:16',      'Splitter 1:16',      'no', 0, 3, 0, 'splitter'),
  ('SPL-18',     'Splitter 1:8',       'Splitter 1:8',       'no', 0, 3, 0, 'splitter'),
  ('SPL-14',     'Splitter 1:4',       'Splitter 1:4',       'no', 0, 3, 0, 'splitter'),
  ('SPL-12',     'Splitter 1:2',       'Splitter 1:2',       'no', 0, 3, 0, 'splitter');

-- ── Seed: Connectors ─────────────────────────────────────────
INSERT IGNORE INTO store_items (code, name, name_mm, unit, current_stock, min_threshold, price_mmk, category) VALUES
  ('CON-APC',    'APC Connector',      'APC Connector',      'no', 0, 20, 0, 'connector'),
  ('CON-UPC',    'UPC Connector',      'UPC Connector',      'no', 0, 20, 0, 'connector');

-- ── Seed: Cables ─────────────────────────────────────────────
INSERT IGNORE INTO store_items (code, name, name_mm, unit, current_stock, min_threshold, price_mmk, category) VALUES
  ('CBL-F1',     'Fiber 1-Core Cable', 'Fiber 1-Core',       'm',  0, 100, 0, 'cable'),
  ('CBL-F4',     'Fiber 4-Core Cable', 'Fiber 4-Core',       'm',  0, 100, 0, 'cable'),
  ('CBL-F12',    'Fiber 12-Core Cable','Fiber 12-Core',      'm',  0, 100, 0, 'cable'),
  ('CBL-F60',    'Fiber 60-Core Cable','Fiber 60-Core',      'm',  0, 100, 0, 'cable'),
  ('CBL-CAT6',   'CAT6 Cable',         'CAT6 Cable',         'm',  0, 100, 0, 'cable');

-- ── Seed: Accessories ────────────────────────────────────────
INSERT IGNORE INTO store_items (code, name, name_mm, unit, current_stock, min_threshold, price_mmk, category) VALUES
  ('ACC-SLS',    'Sleeve Small',       'Sleeve Small',       'no', 0, 50, 0, 'accessory'),
  ('ACC-SLB',    'Sleeve Big',         'Sleeve Big',         'no', 0, 30, 0, 'accessory'),
  ('ACC-CTI',    'Cable Tie',          'Cable Tie',          'no', 0, 100, 0, 'accessory'),
  ('ACC-BOX8',   'Box 1:8',            'Box 1:8',            'no', 0, 5, 0, 'accessory'),
  ('ACC-POLE',   'Pole',               'Pole',               'no', 0, 5, 0, 'accessory'),
  ('ACC-CLAMP',  'Fiber Clamp',        'Fiber Clamp',        'no', 0, 20, 0, 'accessory'),
  ('ACC-PATCH',  'Patch Cord',         'Patch Cord',         'no', 0, 10, 0, 'accessory'),
  ('ACC-PIGTAIL','Pigtail',            'Pigtail',            'no', 0, 10, 0, 'accessory'),
  ('ACC-TAPE',   'Electric Tape',      'Electric Tape',      'no', 0, 10, 0, 'accessory'),
  ('ACC-JOINT',  'Joint Box',          'Joint Box',          'no', 0, 5, 0, 'accessory');
