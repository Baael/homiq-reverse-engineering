/**
 * SQLite Database Setup and Migrations
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/emulator.db');

export type DatabaseInstance = Database.Database;

/**
 * Create and initialize the database
 */
export function createDatabase(): DatabaseInstance {
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  import('fs').then(fs => {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  seedDefaultData(db);

  return db;
}

/**
 * Run database migrations
 */
function runMigrations(db: DatabaseInstance): void {
  db.exec(`
    -- Devices table
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      node_addr TEXT NOT NULL UNIQUE,
      device_type TEXT NOT NULL,
      device_id TEXT,
      online INTEGER NOT NULL DEFAULT 1,
      programming_mode INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Device properties table
    CREATE TABLE IF NOT EXISTS device_properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      cmd_read TEXT NOT NULL,
      cmd_write TEXT,
      value_type TEXT NOT NULL DEFAULT 'string',
      current_value TEXT NOT NULL DEFAULT '',
      meta TEXT,
      UNIQUE(device_id, key)
    );

    -- Device programming (EEPROM settings)
    CREATE TABLE IF NOT EXISTS device_programming (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      cmd TEXT NOT NULL,
      val TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(device_id, cmd)
    );

    -- Scenarios table
    CREATE TABLE IF NOT EXISTS scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 0,
      definition TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Faults configuration
    CREATE TABLE IF NOT EXISTS faults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 0,
      params TEXT NOT NULL DEFAULT '{}'
    );

    -- Events log
    CREATE TABLE IF NOT EXISTS events_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      direction TEXT NOT NULL,
      remote_addr TEXT NOT NULL,
      frame TEXT NOT NULL,
      parsed TEXT,
      outcome TEXT NOT NULL DEFAULT 'ok'
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_events_log_timestamp ON events_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_device_properties_device ON device_properties(device_id);
    CREATE INDEX IF NOT EXISTS idx_device_programming_device ON device_programming(device_id);

    -- Moxa configuration
    CREATE TABLE IF NOT EXISTS moxa_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      host TEXT NOT NULL DEFAULT '0.0.0.0',
      port INTEGER NOT NULL DEFAULT 4001,
      keep_alive_interval_ms INTEGER NOT NULL DEFAULT 15000,
      connection_timeout_ms INTEGER NOT NULL DEFAULT 20000,
      max_clients INTEGER NOT NULL DEFAULT 10
    );
  `);
}

/**
 * Seed default data if tables are empty
 */
function seedDefaultData(db: DatabaseInstance): void {
  // Check if devices exist
  const deviceCount = db.prepare('SELECT COUNT(*) as count FROM devices').get() as { count: number };

  if (deviceCount.count === 0) {
    console.log('Seeding default smart home devices...');

    // Insert sample devices for an anonymous smart home
    const insertDevice = db.prepare(`
      INSERT INTO devices (name, node_addr, device_type, device_id, online)
      VALUES (?, ?, ?, ?, 1)
    `);

    const insertProperty = db.prepare(`
      INSERT INTO device_properties (device_id, key, cmd_read, cmd_write, value_type, current_value)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertProgramming = db.prepare(`
      INSERT INTO device_programming (device_id, cmd, val)
      VALUES (?, ?, ?)
    `);

    // ============================================================
    // SEED: typy urządzeń = prefiksy CMD z pakietów TCP
    // Źródło: analysis/homiq_cmd_inventory.csv (observed)
    // ============================================================

    // Device 01: Wyjścia (typ O)
    const dev1 = insertDevice.run('Salon - wyjścia', '01', 'O', '00003');
    const dev1Id = dev1.lastInsertRowid as number;
    for (let i = 0; i < 10; i++) {
      insertProperty.run(dev1Id, `O.${i}`, `O.${i}`, `O.${i}`, 'bool', '0');
      insertProgramming.run(dev1Id, `ODS.${i}`, '0');
    }

    // Device 02: Wejścia (typ I)
    const dev2 = insertDevice.run('Salon - wejścia', '02', 'I', '00003');
    const dev2Id = dev2.lastInsertRowid as number;
    for (let i = 0; i < 16; i++) {
      insertProperty.run(dev2Id, `I.${i}`, `I.${i}`, null, 'bool', '0');
      insertProgramming.run(dev2Id, `IM.${i}`, '1');
      insertProgramming.run(dev2Id, `II.${i}`, '1');
      insertProgramming.run(dev2Id, `IOM.${i}`, '0');
    }

    // Device 03: Jasność (typ B)
    const dev3 = insertDevice.run('Sypialnia - jasność', '03', 'B', '00001');
    const dev3Id = dev3.lastInsertRowid as number;
    insertProperty.run(dev3Id, 'B1', 'B1', 'B1', 'int', '0');
    insertProperty.run(dev3Id, 'B2', 'B2', 'B2', 'int', '0');

    // Device 04: Temperatura (typ T)
    const dev4 = insertDevice.run('Kuchnia - temperatura', '04', 'T', '00005');
    const dev4Id = dev4.lastInsertRowid as number;
    insertProperty.run(dev4Id, 'T.0', 'T.0', null, 'float', '21.5');
    insertProperty.run(dev4Id, 'T.1', 'T.1', null, 'float', '22.0');
    insertProperty.run(dev4Id, 'T.2', 'T.2', null, 'float', '20.8');

    // Device 05: Wyjścia (typ O) - kolejny moduł
    const dev5 = insertDevice.run('Garaż - wyjścia', '05', 'O', '00007');
    const dev5Id = dev5.lastInsertRowid as number;
    for (let i = 0; i < 4; i++) {
      insertProperty.run(dev5Id, `O.${i}`, `O.${i}`, `O.${i}`, 'bool', '0');
      insertProgramming.run(dev5Id, `ODS.${i}`, '0');
    }

    console.log('✓ Seeded 5 devices (typy = prefiksy CMD z pakietów)');
  }

  // Seed default faults
  const faultCount = db.prepare('SELECT COUNT(*) as count FROM faults').get() as { count: number };
  if (faultCount.count === 0) {
    const insertFault = db.prepare('INSERT INTO faults (type, enabled, params) VALUES (?, 0, ?)');
    insertFault.run('latency', JSON.stringify({ delayMs: 100, jitterMs: 50 }));
    insertFault.run('packet_loss', JSON.stringify({ probability: 0.1 }));
    insertFault.run('bad_crc', JSON.stringify({ probability: 0.05 }));
    insertFault.run('ack_timeout', JSON.stringify({ probability: 0.1, targetCmd: null }));
    insertFault.run('device_offline', JSON.stringify({ targetDevice: null }));
    insertFault.run('noisy_inputs', JSON.stringify({ intervalMs: 5000, inputs: ['I.0', 'I.1'] }));
    console.log('✓ Seeded default fault configurations');
  }

  // Seed default scenario
  const scenarioCount = db.prepare('SELECT COUNT(*) as count FROM scenarios').get() as { count: number };
  if (scenarioCount.count === 0) {
    const insertScenario = db.prepare('INSERT INTO scenarios (name, enabled, definition) VALUES (?, ?, ?)');
    insertScenario.run('Normal Operation', 1, JSON.stringify({
      faults: [],
      pushEvents: [],
    }));
    insertScenario.run('Stress Test', 0, JSON.stringify({
      faults: [
        { type: 'latency', enabled: true, delayMs: 200 },
        { type: 'packet_loss', enabled: true, probability: 0.05 },
      ],
      pushEvents: [
        { cmd: 'I.0', deviceAddr: '01', intervalMs: 2000, valueGenerator: 'toggle' },
      ],
    }));
    console.log('✓ Seeded default scenarios');
  }

  // Seed moxa config
  const moxaCount = db.prepare('SELECT COUNT(*) as count FROM moxa_config').get() as { count: number };
  if (moxaCount.count === 0) {
    db.prepare('INSERT INTO moxa_config (id) VALUES (1)').run();
    console.log('✓ Seeded default Moxa configuration');
  }
}
