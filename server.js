const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');

const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = '7906044844:AAHdCBQI6TrmgL6qdTuN-iZNjh2Vr_X8RSs';
const WEB_APP_URL = 'https://sdfjklghluksdfjhgk.ru';
const SUPER_ADMIN_TG_ID = 1658774787;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

let db;
let bot;
let sellerUsername = '';

function validateInitData(initData) {
    if (!initData) return null;
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        params.delete('hash');
        const dataCheckString = [...params.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        if (computedHash === hash) {
            return JSON.parse(params.get('user') || '{}');
        }
    } catch (e) { }
    return null;
}

function authMiddleware(req, res, next) {
    const initData = req.headers['x-telegram-init-data'];
    const tgUser = validateInitData(initData);

    if (tgUser && tgUser.id) {
        try {
            let user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tgUser.id);
            if (!user) {
                const isAdmin = (tgUser.id === SUPER_ADMIN_TG_ID) ? 1 : 0;
                db.prepare('INSERT INTO users (tg_id, username, first_name, last_name, photo_url, is_admin) VALUES (?, ?, ?, ?, ?, ?)').run(
                    tgUser.id, tgUser.username || '', tgUser.first_name || '', tgUser.last_name || '', tgUser.photo_url || '', isAdmin
                );
                user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tgUser.id);
                db.prepare('INSERT INTO visits (user_id) VALUES (?)').run(user.id);
            } else {
                db.prepare('UPDATE users SET username = ?, first_name = ?, last_name = ?, photo_url = ? WHERE tg_id = ?').run(
                    tgUser.username || user.username, tgUser.first_name || user.first_name,
                    tgUser.last_name || user.last_name, tgUser.photo_url || user.photo_url, tgUser.id
                );
                const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                const alreadyVisited = db.prepare('SELECT COUNT(*) as c FROM visits WHERE user_id = ? AND visited_at >= ?').get(user.id, todayStart.toISOString());
                if (!alreadyVisited || alreadyVisited.c === 0) {
                    db.prepare('INSERT INTO visits (user_id) VALUES (?)').run(user.id);
                }
                user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tgUser.id);
            }
            req.user = user;
            return next();
        } catch (e) {
            console.error('Auth DB error:', e);
        }
    }

    if (process.env.NODE_ENV !== 'production') {
        try {
            let user = db.prepare('SELECT * FROM users WHERE is_admin = 1').get();
            if (user) { req.user = user; return next(); }
        } catch (e) { }
    }

    res.status(401).json({ error: 'Unauthorized' });
}

function adminMiddleware(req, res, next) {
    if (req.user && req.user.is_admin) return next();
    res.status(403).json({ error: 'Forbidden' });
}

async function notifyAdminNewOrder(order, items, customerName, isPrize = false) {
    if (!bot || isPrize) return;
    
    try {
        let msg = `🛒 *Новый заказ #${order.id}*\n`;
        msg += `👤 От: ${customerName}\n\n`;
        for (const item of items) {
            msg += `• ${item.name} × ${item.quantity} — ${item.price * item.quantity} ₽\n`;
        }
        if (order.discount > 0) {
            msg += `\n🏷 Промокод: ${order.promo_code} (−${order.discount} ₽)`;
        }
        msg += `\n\n💰 *Итого: ${order.total} ₽*`;
        msg += `\n\n📋 Заказ #${order.id}`;
        
        await bot.sendMessage(SUPER_ADMIN_TG_ID, msg, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Failed to notify admin:', e.message);
    }
}

async function start() {
    db = await initDatabase();
    global.__shopDb = db;

    const superAdmin = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(SUPER_ADMIN_TG_ID);
    if (!superAdmin) {
        db.prepare('INSERT OR IGNORE INTO users (tg_id, username, first_name, is_admin) VALUES (?, ?, ?, ?)').run(SUPER_ADMIN_TG_ID, 'admin', 'Admin', 1);
    } else if (!superAdmin.is_admin) {
        db.prepare('UPDATE users SET is_admin = 1 WHERE tg_id = ?').run(SUPER_ADMIN_TG_ID);
    }

    app.use((req, res, next) => { req.db = db; next(); });

    global.SUPER_ADMIN_TG_ID = SUPER_ADMIN_TG_ID;

    try {
        const sellerSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('seller_tg_id');
        if (sellerSetting && sellerSetting.value) {
            global.__sellerTgId = parseInt(sellerSetting.value);
        } else {
            global.__sellerTgId = SUPER_ADMIN_TG_ID;
        }
    } catch (e) {
        global.__sellerTgId = SUPER_ADMIN_TG_ID;
    }

    const categoriesRouter = require('./routes/categories');
    const productsRouter = require('./routes/products');
    const ordersRouter = require('./routes/orders');
    const promosRouter = require('./routes/promos');
    const statsRouter = require('./routes/stats');
    const usersRouter = require('./routes/users');
    const broadcastRouter = require('./routes/broadcast');
    const casesRouter = require('./routes/cases');
    const inventoryRouter = require('./routes/inventory');
    const settingsRouter = require('./routes/settings');

    app.use('/api/categories', authMiddleware, categoriesRouter);
    app.use('/api/products', authMiddleware, productsRouter);
    app.use('/api/orders', authMiddleware, ordersRouter);
    app.use('/api/promos', authMiddleware, promosRouter);
    app.use('/api/stats', authMiddleware, adminMiddleware, statsRouter);
    app.use('/api/users', authMiddleware, usersRouter);
    app.use('/api/broadcast', authMiddleware, adminMiddleware, broadcastRouter);
    app.use('/api/cases', authMiddleware, casesRouter);
    app.use('/api/inventory', authMiddleware, inventoryRouter);
    app.use('/api/settings', authMiddleware, settingsRouter);

    app.post('/api/auth', authMiddleware, (req, res) => {
        res.json({ user: req.user, sellerUsername });
    });

    app.get('/api/config', (req, res) => {
        res.json({ sellerUsername, sellerTgId: SUPER_ADMIN_TG_ID });
    });

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    app.use((err, req, res, next) => {
        console.error('Server error:', err);
        res.status(500).json({ error: 'Internal server error' });
    });

    app.listen(PORT, () => {
        console.log(`🚀 Shop server running at http://localhost:${PORT}`);
    });

    try {
        bot = new TelegramBot(BOT_TOKEN, { polling: true });
        global.__shopBot = bot;
        global.notifyAdminNewOrder = notifyAdminNewOrder;

        try {
            const sellerTgId = global.__sellerTgId || SUPER_ADMIN_TG_ID;
            const chat = await bot.getChat(sellerTgId);
            sellerUsername = chat.username || '';
            global.__sellerUsername = sellerUsername;
            console.log(`📇 Seller username: @${sellerUsername} (TG ID: ${sellerTgId})`);
        } catch (e) {
            console.log('Could not resolve seller username');
        }

        bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const firstName = msg.from.first_name || 'друг';
            bot.sendMessage(chatId,
                `Привет, ${firstName}! 👋\n\nДобро пожаловать в наш магазин!\nНажми кнопку ниже, чтобы открыть каталог 🛒`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🛒 Открыть магазин', web_app: { url: WEB_APP_URL } }]
                    ]
                }
            });
        });

        bot.onText(/\/help/, (msg) => {
            bot.sendMessage(msg.chat.id,
                `📋 Помощь\n\n/start — Открыть магазин\n/help — Помощь`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🛒 Открыть магазин', web_app: { url: WEB_APP_URL } }]
                    ]
                }
            });
        });

        bot.on('pre_checkout_query', async (query) => {
            try {
                await bot.answerPreCheckoutQuery(query.id, true);
            } catch (e) {
                console.error('Pre-checkout error:', e);
                await bot.answerPreCheckoutQuery(query.id, false, { error_message: 'Ошибка оплаты' });
            }
        });

        bot.on('successful_payment', async (msg) => {
            try {
                const payload = JSON.parse(msg.successful_payment.invoice_payload);
                const { caseId, userId } = payload;

                const caseData = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId);
                if (!caseData) return;

                const items = db.prepare(`
                    SELECT ci.*, p.name, p.image_url, p.price
                    FROM case_items ci
                    JOIN products p ON ci.product_id = p.id
                    WHERE ci.case_id = ?
                `).all(caseId);

                if (!items.length) return;

                const totalChance = items.reduce((sum, item) => sum + item.chance, 0);
                let random = Math.random() * totalChance;
                let wonItem = null;

                for (const item of items) {
                    random -= item.chance;
                    if (random <= 0) {
                        wonItem = item;
                        break;
                    }
                }

                if (!wonItem) wonItem = items[items.length - 1];

                db.prepare(
                    'INSERT INTO inventory (user_id, product_id, case_id) VALUES (?, ?, ?)'
                ).run(userId, wonItem.product_id, caseId);

                await bot.sendMessage(msg.chat.id,
                    `🎉 Поздравляем!\n\nВы выиграли: ${wonItem.name}\n\nПриз добавлен в ваш инвентарь!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📦 Открыть инвентарь', web_app: { url: `${WEB_APP_URL}#inventory` } }]
                        ]
                    }
                });
            } catch (e) {
                console.error('Payment processing error:', e);
            }
        });

        console.log('🤖 Bot is running...');
    } catch (e) {
        console.error('Bot error:', e.message);
    }
}

start().catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
});
