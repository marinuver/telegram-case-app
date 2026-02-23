const express = require('express');
const router = express.Router();
const db = global.__shopDb;

router.post('/validate', (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.json({ valid: false, error: 'No code provided' });

        const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ? AND active = 1').get(code.toUpperCase());
        if (!promo) return res.json({ valid: false, error: 'Invalid code' });

        if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
            return res.json({ valid: false, error: 'Code exhausted' });
        }
        if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
            return res.json({ valid: false, error: 'Code expired' });
        }

        res.json({
            valid: true,
            discount_percent: promo.discount_percent,
            discount_amount: promo.discount_amount
        });
    } catch (e) {
        console.error('Promo validate error:', e);
        res.json({ valid: false, error: 'Validation error' });
    }
});

router.get('/', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const promos = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
        res.json(promos);
    } catch (e) {
        console.error('Promos GET error:', e);
        res.json([]);
    }
});

router.post('/', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });

    try {
        const { code, discount_percent, discount_amount, max_uses, expires_at } = req.body;
        if (!code) return res.status(400).json({ error: 'Code is required' });

        const result = db.prepare(
            'INSERT INTO promo_codes (code, discount_percent, discount_amount, max_uses, expires_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
            code.toUpperCase(),
            discount_percent || 0,
            discount_amount || 0,
            max_uses || 0,
            expires_at || null
        );

        const promo = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(result.lastInsertRowid);
        res.json(promo || { id: result.lastInsertRowid, code: code.toUpperCase() });
    } catch (e) {
        console.error('Promo create error:', e);
        if (e.message && e.message.includes('UNIQUE')) {
            res.status(400).json({ error: 'Code already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create promo' });
        }
    }
});

router.put('/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { active, discount_percent, discount_amount, max_uses, expires_at } = req.body;

        const existing = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Not found' });

        db.prepare(
            'UPDATE promo_codes SET active = ?, discount_percent = ?, discount_amount = ?, max_uses = ?, expires_at = ? WHERE id = ?'
        ).run(
            active !== undefined ? active : existing.active,
            discount_percent !== undefined ? discount_percent : existing.discount_percent,
            discount_amount !== undefined ? discount_amount : existing.discount_amount,
            max_uses !== undefined ? max_uses : existing.max_uses,
            expires_at !== undefined ? expires_at : existing.expires_at,
            req.params.id
        );

        const promo = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(req.params.id);
        res.json(promo);
    } catch (e) {
        console.error('Promo update error:', e);
        res.status(500).json({ error: 'Failed to update' });
    }
});

router.delete('/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    try {
        db.prepare('DELETE FROM promo_codes WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (e) {
        console.error('Promo delete error:', e);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

module.exports = router;
