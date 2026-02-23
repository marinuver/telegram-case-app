require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3000

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

app.get('/', (req, res) => {
  res.send('Backend работает ')
})

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
      'SELECT * FROM spins WHERE telegram_id = $1 ORDER BY created_at DESC',
      [telegram_id]
    )

    res.json(result.rows)

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/auth', async (req, res) => {
  try {
    const { telegram_id, username } = req.body

    if (!telegram_id) {
      return res.status(400).json({ error: "telegram_id required" })
    }

    // проверяем существует ли пользователь
    let user = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegram_id]
    )

    // если нет — создаём
    if (user.rows.length === 0) {
      user = await pool.query(
        'INSERT INTO users (telegram_id, username) VALUES ($1, $2) RETURNING *',
        [telegram_id, username]
      )
    }

    res.json(user.rows[0])

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

    let cost = 0
    let minWin = 0
    let maxWin = 0

    if (case_type === "cheap") {
      cost = 100
      minWin = 50
      maxWin = 150
    } else if (case_type === "medium") {
      cost = 200
      minWin = 100
      maxWin = 400
    } else if (case_type === "expensive") {
      cost = 500
      minWin = 100
      maxWin = 700
    } else {
      return res.status(400).json({ error: "Invalid case type" })
    }

    if (user.balance < cost) {
      return res.status(400).json({ error: "Not enough balance" })
    }

    const win = Math.floor(Math.random() * (maxWin - minWin + 1)) + minWin
    const newBalance = user.balance - cost + win
    console.log("INSERTING SPIN:", telegram_id, case_type, cost, win)

    // обновляем баланс
    await pool.query(
      'UPDATE users SET balance = $1 WHERE telegram_id = $2',
      [newBalance, telegram_id]
    )

    // записываем историю
    await pool.query(
      'INSERT INTO spins (telegram_id, case_type, cost, win) VALUES ($1, $2, $3, $4)',
      [telegram_id, case_type, cost, win]
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
console.log('Server started on port ${PORT}')
})