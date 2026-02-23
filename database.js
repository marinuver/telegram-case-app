const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'shop.db');

class DatabaseWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
  }

  _save() {
    const data = this._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  exec(sql) {
    this._db.run(sql);
    this._save();
  }

  prepare(sql) {
    const db = this._db;
    const self = this;

    return {
      all(...params) {
        let stmt;
        try {
          stmt = db.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          return results;
        } finally {
          if (stmt) stmt.free();
        }
      },

      get(...params) {
        let stmt;
        try {
          stmt = db.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          if (stmt) stmt.free();
        }
      },

      run(...params) {
        db.run(sql, params);
        self._save();

        let lastInsertRowid = 0;
        let changes = 0;
        try {
          const ridStmt = db.prepare('SELECT last_insert_rowid() as rid');
          if (ridStmt.step()) {
            const row = ridStmt.getAsObject();
            lastInsertRowid = Number(row.rid) || 0;
          }
          ridStmt.free();
        } catch (e) { /* игнорим */ }
        try {
          const chStmt = db.prepare('SELECT changes() as ch');
          if (chStmt.step()) {
            const row = chStmt.getAsObject();
            changes = Number(row.ch) || 0;
          }
          chStmt.free();
        } catch (e) { /* игнорим */ }

        return { lastInsertRowid, changes };
      }
    };
  }

  transaction(fn) {
    const self = this;
    return function (...args) {
      self._db.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        self._db.run('COMMIT');
        self._save();
        return result;
      } catch (e) {
        self._db.run('ROLLBACK');
        throw e;
      }
    };
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();

  let db;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  const wrapper = new DatabaseWrapper(db);

  wrapper.exec('PRAGMA foreign_keys = ON');

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tg_id INTEGER UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      photo_url TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stars_price INTEGER DEFAULT 0,
      image_url TEXT,
      stock INTEGER DEFAULT -1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL,
      promo_code TEXT,
      discount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      max_uses INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      visited_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      image_url TEXT,
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS case_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      chance REAL NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      case_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
    )
  `);

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS user_stars (
      user_id INTEGER PRIMARY KEY,
      balance INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  wrapper._save();

  try {
    const cols = db.exec("PRAGMA table_info(products)");
    if (cols.length > 0) {
      const colNames = cols[0].values.map(row => row[1]);
      if (colNames.includes('in_stock') && !colNames.includes('stock')) {
        db.run("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT -1");
        db.run("UPDATE products SET stock = CASE WHEN in_stock = 1 THEN -1 ELSE 0 END");
        wrapper._save();
        console.log('✅ Migrated in_stock -> stock');
      }
    }
  } catch (e) {
  }

  try {
    const cols = db.exec("PRAGMA table_info(products)");
    if (cols.length > 0) {
      const colNames = cols[0].values.map(row => row[1]);
      if (!colNames.includes('stars_price')) {
        db.run("ALTER TABLE products ADD COLUMN stars_price INTEGER DEFAULT 0");
        wrapper._save();
        console.log('✅ Added stars_price column to products');
      }
    }
  } catch (e) {
  }

  const adminExists = wrapper.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get();
  if (!adminExists || adminExists.count === 0) {
    wrapper.prepare('INSERT OR IGNORE INTO users (tg_id, username, first_name, is_admin) VALUES (?, ?, ?, ?)').run(7175369171, 'admin', 'Admin', 1);
  }

  return wrapper;
}

module.exports = { initDatabase };
