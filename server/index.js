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