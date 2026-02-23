require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const PORT = process.env.PORT || 3000

const app = express()
app.use(cors())
app.use(express.json())

const crypto = require('crypto')

function verifyTelegramData(initData) {
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(process.env.BOT_TOKEN)
    .digest()

  const urlParams = new URLSearchParams(initData)
  const hash = urlParams.get("hash")
  urlParams.delete("hash")

  const dataCheckString = Array.from(urlParams.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")

  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex")

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
    const { telegram_id } = req.body

    const userResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegram_id]
    )

    const user = userResult.rows[0]
    const cost = 100

    if (!user || user.balance < cost) {
      return res.status(400).json({ error: "Недостаточно средств" })
    }

    const items = [
      { emoji: "🪙", name: "Монета", value: 40, rarity: "common", chance: 40 },
      { emoji: "💰", name: "Мешок денег", value: 80, rarity: "rare", chance: 30 },
      { emoji: "⭐", name: "Звезда", value: 120, rarity: "epic", chance: 20 },
      { emoji: "💎", name: "Алмаз", value: 250, rarity: "legendary", chance: 10 }
    ]

    function getRandomItem(items) {
      const totalChance = items.reduce((sum, item) => sum + item.chance, 0)
      const random = Math.random() * totalChance

      let cumulative = 0
      for (const item of items) {
        cumulative += item.chance
        if (random <= cumulative) {
          return item
        }
      }
    }

    const item = getRandomItem(items)

    const newBalance = user.balance - cost + item.value

    await pool.query(
      'UPDATE users SET balance = $1 WHERE telegram_id = $2',
      [newBalance, telegram_id]
    )

    res.json({
      item,
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

app.use(express.static('client'))

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`)
})
