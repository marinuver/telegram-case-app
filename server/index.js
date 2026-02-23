require('dotenv').config()
const express = require('express')
const crypto = require('crypto')
const cors = require('cors')
const { Pool } = require('pg')
const PORT = process.env.PORT || 3000

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static('client'))

function verifyTelegramData(initData) {
  const secret = crypto
    .createHash('sha256')
    .update(process.env.BOT_TOKEN)
    .digest()

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort()
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex')

  return hmac === hash
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

// Автоматическое создание таблицы spins
pool.query(`
  CREATE TABLE IF NOT EXISTS spins (
    id SERIAL PRIMARY KEY,
    telegram_id VARCHAR(255) NOT NULL,
    case_type VARCHAR(50) NOT NULL,
    cost INTEGER NOT NULL,
    win INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`)
.then(() => console.log("Spins table ready"))
.catch(err => console.error("Error creating spins table:", err))

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()')
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users')
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/history/:telegram_id', async (req, res) => {
  try {
    const { telegram_id } = req.params

    const result = await pool.query(
      `
      SELECT *
      FROM spins
      WHERE telegram_id = $1
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [telegram_id]
    )

    res.json(result.rows)

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/auth', async (req, res) => {
  try {
    const { initData } = req.body

    console.log("INIT DATA:", initData)
    console.log("BOT TOKEN:", process.env.BOT_TOKEN)

    if (!initData || !verifyTelegramData(initData)) {
      return res.status(403).json({ error: "Invalid Telegram data" })
    }

    const params = new URLSearchParams(initData)
    const user = JSON.parse(params.get('user'))

    let userResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [user.id]
    )

    if (userResult.rows.length === 0) {
      userResult = await pool.query(
        'INSERT INTO users (telegram_id, username) VALUES ($1, $2) RETURNING *',
        [user.id, user.username]
      )
    }

    res.json(userResult.rows[0])

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/spin', async (req, res) => {
  try {
    const { telegram_id, case_type } = req.body

    if (!telegram_id || !case_type) {
      return res.status(400).json({ error: "telegram_id and case_type required" })
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegram_id]
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    const user = userResult.rows[0]

    let cost = 100
    let minWin = 50
    let maxWin = 150

    if (user.balance < cost) {
      return res.status(400).json({ error: "Not enough balance" })
    }

    const win = Math.floor(Math.random() * (maxWin - minWin + 1)) + minWin
    const newBalance = user.balance - cost + win

    await pool.query(
      'UPDATE users SET balance = $1 WHERE telegram_id = $2',
      [newBalance, telegram_id]
    )

    await pool.query(
      'INSERT INTO spins (telegram_id, case_type, cost, win) VALUES ($1, $2, $3, $4)',
      [String(telegram_id), case_type, cost, win]
    )

    res.json({
      case_type,
      cost,
      win,
      new_balance: newBalance
    })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

async function initDB() {
  try {
    const query =
      "CREATE TABLE IF NOT EXISTS users (" +
      "id SERIAL PRIMARY KEY," +
      "telegram_id BIGINT UNIQUE NOT NULL," +
      "username TEXT," +
      "balance INTEGER DEFAULT 1000," +
      "role TEXT DEFAULT 'user'," +
      "created_at TIMESTAMP DEFAULT NOW()" +
      ")"

    await pool.query(query)

    console.log("Users table ready ")
  } catch (err) {
    console.error("DB init error:", err)
  }
}

initDB()

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`)
})