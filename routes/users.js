const express = require('express');
const router = express.Router();
const db = global.__shopDb;

router.get('/me', (req, res) => {
    try {
        res.json(req.user);
    } catch (e) {
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

router.get('/', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const users = db.prepare('SELECT id, tg_id, username, first_name, last_name, photo_url, is_admin, created_at FROM users ORDER BY is_admin DESC, created_at DESC').all();
        res.json(users);
    } catch (e) {
        console.error('Users GET error:', e);
        res.json([]);
    }
});

router.post('/admin/grant', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });

    const { tg_id, username } = req.body;
    if (!tg_id && !username) return res.status(400).json({ error: 'Provide tg_id or username' });

    try {
        let user;
        if (tg_id) {
            user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tg_id);
        } else if (username) {
            const cleanUsername = username.replace('@', '').trim();
            user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);
        }

        if (!user) return res.status(404).json({ error: 'User not found. They need to open the shop first.' });

        db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
        const updated = db.prepare('SELECT id, tg_id, username, first_name, last_name, photo_url, is_admin, created_at FROM users WHERE id = ?').get(user.id);
        res.json(updated);
    } catch (e) {
        console.error('Grant admin error:', e);
        res.status(500).json({ error: 'Failed to grant admin' });
    }
});

router.post('/admin/revoke', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });

    const { user_id, tg_id } = req.body;
    const SUPER_ADMIN = global.SUPER_ADMIN_TG_ID || 7175369171;

    try {
        let user;
        if (user_id) {
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
        } else if (tg_id) {
            user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tg_id);
        }

        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.tg_id == SUPER_ADMIN) {
            return res.status(403).json({ error: 'Cannot revoke super admin' });
        }

        if (req.user.tg_id != SUPER_ADMIN) {
            return res.status(403).json({ error: 'Only super admin can revoke admins' });
        }

        db.prepare('UPDATE users SET is_admin = 0 WHERE id = ?').run(user.id);
        const updated = db.prepare('SELECT id, tg_id, username, first_name, last_name, photo_url, is_admin, created_at FROM users WHERE id = ?').get(user.id);
        res.json(updated);
    } catch (e) {
        console.error('Revoke admin error:', e);
        res.status(500).json({ error: 'Failed to revoke admin' });
    }
});

module.exports = router;
