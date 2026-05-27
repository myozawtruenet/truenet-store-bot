-- TrueNET Store Inventory Bot — Expanded 80+ items seed
-- STORE-BOT-SEED-20260527
-- Apply to dk_imdb via: mysql -h 127.0.0.1 -P 3308 -u truenet_user -p'TrueNetSecure2026' dk_imdb

-- ── ONUs (17) ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO store_items (code, name, name_mm, unit, current_stock, min_threshold, price_mmk, category) VALUES
  ('ONU-X6AIS',    'X6-AIS ONU',            'X6-AIS ONU',            'no', 0, 5, 0, 'onu'),
  ('ONU-GP5G',     'GPon5G ONU',             'GPon5G ONU',            'no', 0, 5, 0, 'onu'),
  ('ONU-4P',       'ONU 4-Port',             'ONU 4-Port',            'no', 0, 5, 0, 'onu'),
  ('ONU-2P',       'ONU 2-Port',             'ONU 2-Port',            'no', 0, 5, 0, 'onu'),
  ('ONU-OVAL',     'ONU Oval',               'ONU Oval',              'no', 0, 5, 0, 'onu'),
  ('ONU-SML',      'ONU Small',              'ONU Small',             'no', 0, 5, 0, 'onu'),
  ('ONU-HW',       'Huawei Black ONU',       'Huawei Black ONU',      'no', 0, 5, 0, 'onu'),
  ('ONU-RJ',       'Ruijie ONU',             'Ruijie ONU',            'no', 0, 5, 0, 'onu'),
  ('ONU-TPL',      'TP-Link ONU',            'TP-Link ONU',           'no', 0, 5, 0, 'onu'),
  ('ONU-TDA',      'Tenda ONU',              'Tenda ONU',             'no', 0, 5, 0, 'onu'),
  ('ONU-MCS',      'Mercusys ONU',           'Mercusys ONU',          'no', 0, 5, 0, 'onu'),
  ('ONU-HG8145X6', 'HG8145X6 ONU',           'HG8145X6 ONU',          'no', 0, 3, 0, 'onu'),
  ('ONU-HG8145V5', 'HG8145V5 ONU',           'HG8145V5 ONU',          'no', 0, 3, 0, 'onu'),
  ('ONU-HG8245H5', 'HG8245H5 ONU',           'HG8245H5 ONU',          'no', 0, 3, 0, 'onu'),
  ('ONU-HG8145X',  'HG8145X ONU',            'HG8145X ONU',           'no', 0, 3, 0, 'onu'),
  ('ONU-HWWHT',    'Huawei White ONU',       'Huawei White ONU',      'no', 0, 5, 0, 'onu'),
  ('ONU-ZTE',      'ZTE ONU',                'ZTE ONU',               'no', 0, 5, 0, 'onu');

-- ── Splitters (8) ─────────────────────────────────────────────────────────
INSERT IGNORE INTO store_items (code, name, name_mm, unit, current_stock, min_threshold, price_mmk, category) VALUES
  ('SPL-116',      'Splitter 1:16',          'Splitter 1:16',         'no', 0, 3, 0, 'splitter'),
  ('SPL-18',       'Splitter 1:8',           'Splitter 1:8',          'no', 0, 3, 0, 'splitter'),
  ('SPL-14',       'Splitter 1:4',           'Splitter 1:4',          'no', 0, 3, 0, 'splitter'),
  ('SPL-12',       'Splitter 1:2',           'Splitter 1:2',          'no', 0, 3, 0, 'splitter'),
  ('SPL-116-SC',   'Splitter 1:16 SC/APC',   'Splitter 1:16 SC/APC',  'no', 0, 3, 0, 'splitter'),
  ('SPL-18-SC',    'Splitter 1:8 SC/APC',    'Splitter 1:8 SC/APC',   'no', 0, 3, 0, 'splitter'),
  ('SPL-BOX116',   'Splitter Box 1:16',      'Splitter Box 1:16',     'no', 0, 2, 0, 'splitter'),
  ('SPL-BOX18',    'Splitter Box 1:8',       'Splitter Box 1:8',      'no', 0, 2, 0, 'splitter');

-- ── Connectors (9) ────────────────────────────────────────────────────────
INSERT IGNORE INTO store_items (code, name, name_mm, unit, current_stock, min_threshold, price_mmk, category) VALUES
  ('CON-APC',      'APC Connector',          'APC Connector',         'no', 0, 20, 0, 'connector'),
  ('CON-UPC',      'UPC Connector',          'UPC Connector',         'no', 0, 20, 0, 'connector'),
  ('CON-SC-APC',   'SC/APC Field Connector', 'SC/APC Connector',      'no', 0, 20, 0, 'connector'),
  ('CON-SC-UPC',   'SC/UPC Field Connector', 'SC/UPC Connector',      'no', 0, 20, 0, 'connector'),
  ('CON-FC-UPC',   'FC/UPC Connector',       'FC/UPC Connector',      'no', 0, 10, 0, 'connector'),
  ('CON-RJ45',     'RJ45 Connector',         'RJ45 Connector',        'no', 0, 50, 0, 'connector'),
  ('CON-FTYPE',    'F-Type Connector',       'F-Type Connector',      'no', 0, 20, 0, 'connector'),
  ('CON-FAST',     'Fast Connector',         'Fast Connector',        'no', 0, 30, 0, 'connector'),
  ('CON-SC-ADAP',  'SC Adapter (Coupler)',   'SC Adapter',            'no', 0, 10, 0, 'connector');

-- ── Cables (12) ───────────────────────────────────────────────────────────
INSERT IGNORE INTO store_items (code, name, name_mm, unit, current_stock, min_threshold, price_mmk, category) VALUES
  ('CBL-F1',       'Fiber 1-Core Cable',     'Fiber 1-Core',          'm',  0, 100, 0, 'cable'),
  ('CBL-F2',       'Fiber 2-Core Cable',     'Fiber 2-Core',          'm',  0, 100, 0, 'cable'),
  ('CBL-F4',       'Fiber 4-Core Cable',     'Fiber 4-Core',          'm',  0, 100, 0, 'cable'),
  ('CBL-F8',       'Fiber 8-Core Cable',     'Fiber 8-Core',          'm',  0, 200, 0, 'cable'),
  ('CBL-F12',      'Fiber 12-Core Cable',    'Fiber 12-Core',         'm',  0, 100, 0, 'cable'),
  ('CBL-F24',      'Fiber 24-Core Cable',    'Fiber 24-Core',         'm',  0, 200, 0, 'cable'),
  ('CBL-F48',      'Fiber 48-Core Cable',    'Fiber 48-Core',         'm',  0, 200, 0, 'cable'),
  ('CBL-F60',      'Fiber 60-Core Cable',    'Fiber 60-Core',         'm',  0, 100, 0, 'cable'),
  ('CBL-DROP',     'Drop Wire Cable',        'Drop Wire',             'm',  0, 500, 0, 'cable'),
  ('CBL-CAT6',     'CAT6 Cable',             'CAT6 Cable',            'm',  0, 100, 0, 'cable'),
  ('CBL-UTP',      'UTP Cable',              'UTP Cable',             'm',  0, 100, 0, 'cable'),
  ('CBL-COAX',     'Coaxial Cable',          'Coaxial Cable',         'm',  0, 100, 0, 'cable');

-- ── Accessories (30) ──────────────────────────────────────────────────────
INSERT IGNORE INTO store_items (code, name, name_mm, unit, current_stock, min_threshold, price_mmk, category) VALUES
  ('ACC-SLS',      'Sleeve Small',           'Sleeve Small',          'no', 0, 50,  0, 'accessory'),
  ('ACC-SLB',      'Sleeve Big',             'Sleeve Big',            'no', 0, 30,  0, 'accessory'),
  ('ACC-CTI',      'Cable Tie',              'Cable Tie',             'no', 0, 100, 0, 'accessory'),
  ('ACC-BOX8',     'Box 1:8',                'Box 1:8',               'no', 0, 5,   0, 'accessory'),
  ('ACC-BOX16',    'Box 1:16',               'Box 1:16',              'no', 0, 5,   0, 'accessory'),
  ('ACC-POLE',     'Pole',                   'Pole',                  'no', 0, 5,   0, 'accessory'),
  ('ACC-CLAMP',    'Fiber Clamp',            'Fiber Clamp',           'no', 0, 20,  0, 'accessory'),
  ('ACC-PATCH',    'Patch Cord',             'Patch Cord',            'no', 0, 10,  0, 'accessory'),
  ('ACC-PIGTAIL',  'Pigtail',                'Pigtail',               'no', 0, 10,  0, 'accessory'),
  ('ACC-TAPE',     'Electric Tape',          'Electric Tape',         'no', 0, 10,  0, 'accessory'),
  ('ACC-JOINT',    'Joint Box',              'Joint Box',             'no', 0, 5,   0, 'accessory'),
  ('ACC-SPLICE',   'Splice Tray',            'Splice Tray',           'no', 0, 5,   0, 'accessory'),
  ('ACC-CLOSURE',  'Fiber Closure',          'Fiber Closure',         'no', 0, 3,   0, 'accessory'),
  ('ACC-FANOUT',   'Fan-Out Kit',            'Fan-Out Kit',           'no', 0, 10,  0, 'accessory'),
  ('ACC-ANCHOR',   'Anchor Bolt',            'Anchor Bolt',           'no', 0, 50,  0, 'accessory'),
  ('ACC-HOOK',     'Hook Clamp',             'Hook Clamp',            'no', 0, 20,  0, 'accessory'),
  ('ACC-FACEPLATE','Faceplate',              'Faceplate',             'no', 0, 10,  0, 'accessory'),
  ('ACC-OUTLET',   'Wall Outlet Box',        'Wall Outlet Box',       'no', 0, 10,  0, 'accessory'),
  ('ACC-MARKER',   'Cable Marker',           'Cable Marker',          'no', 0, 20,  0, 'accessory'),
  ('ACC-SCREWM6',  'Screw M6',               'Screw M6',              'no', 0, 100, 0, 'accessory'),
  ('ACC-SCREWM8',  'Screw M8',               'Screw M8',              'no', 0, 100, 0, 'accessory'),
  ('ACC-RAWLM6',   'Rawl Plug M6',           'Rawl Plug M6',          'no', 0, 100, 0, 'accessory'),
  ('ACC-RAWLM8',   'Rawl Plug M8',           'Rawl Plug M8',          'no', 0, 100, 0, 'accessory'),
  ('ACC-BUCKLE',   'Buckle Clamp',           'Buckle Clamp',          'no', 0, 30,  0, 'accessory'),
  ('ACC-SPIRAL',   'Spiral Wrap',            'Spiral Wrap',           'no', 0, 10,  0, 'accessory'),
  ('ACC-CONDUIT',  'Conduit Pipe',           'Conduit Pipe',          'no', 0, 10,  0, 'accessory'),
  ('ACC-CNDCPL',   'Conduit Coupler',        'Conduit Coupler',       'no', 0, 10,  0, 'accessory'),
  ('ACC-CNDLBW',   'Conduit Elbow',          'Conduit Elbow',         'no', 0, 10,  0, 'accessory'),
  ('ACC-GREASE',   'Fiber Gel',              'Fiber Gel',             'no', 0, 5,   0, 'accessory'),
  ('ACC-GLAND',    'Cable Gland',            'Cable Gland',           'no', 0, 20,  0, 'accessory');

-- ── Other / Equipment (10) ────────────────────────────────────────────────
INSERT IGNORE INTO store_items (code, name, name_mm, unit, current_stock, min_threshold, price_mmk, category) VALUES
  ('OTH-PSU12V',   '12V Power Adapter',      '12V Power Adapter',     'no', 0, 5,  0, 'other'),
  ('OTH-PSU5V',    '5V Power Adapter',       '5V Power Adapter',      'no', 0, 5,  0, 'other'),
  ('OTH-PSU24V',   '24V Power Adapter',      '24V Power Adapter',     'no', 0, 3,  0, 'other'),
  ('OTH-SW5P',     '5-Port Switch',          '5-Port Switch',         'no', 0, 2,  0, 'other'),
  ('OTH-SW8P',     '8-Port Switch',          '8-Port Switch',         'no', 0, 2,  0, 'other'),
  ('OTH-POE',      'PoE Injector',           'PoE Injector',          'no', 0, 3,  0, 'other'),
  ('OTH-CLEAVER',  'Fiber Cleaver Blade',    'Fiber Cleaver Blade',   'no', 0, 2,  0, 'other'),
  ('OTH-CLEAN',    'Fiber Cleaner Pen',      'Fiber Cleaner Pen',     'no', 0, 3,  0, 'other'),
  ('OTH-PROTECT',  'Fiber Protection Tube',  'Protection Tube',       'no', 0, 20, 0, 'other'),
  ('OTH-FUSESPL',  'Fusion Splice Tube',     'Fusion Splice Tube',    'no', 0, 50, 0, 'other');
