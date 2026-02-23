const express = require('express');
const router = express.Router();
const db = global.__shopDb;

router.get('/', (req, res) => {
    try {
        const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC').all();
        res.json(categories);
    } catch (e) {
        console.error('Categories GET error:', e);
        res.json([]);
    }
});

router.post('/', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM categories').get();
        const sortOrder = ((maxOrder && maxOrder.max) || 0) + 1;

        const result = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, sortOrder);
        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
        res.json(category || { id: result.lastInsertRowid, name, sort_order: sortOrder });
    } catch (e) {
        console.error('Category create error:', e);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

router.put('/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    const { name } = req.body;
    try {
        db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, req.params.id);
        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
        res.json(category);
    } catch (e) {
        console.error('Category update error:', e);
        res.status(500).json({ error: 'Failed to update' });
    }
});

router.put('/reorder/all', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    const { order } = req.body;

    try {
        const reorder = db.transaction((items) => {
            for (const item of items) {
                db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').run(item.sort_order, item.id);
            }
        });
        reorder(order);

        const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
        res.json(categories);
    } catch (e) {
        console.error('Category reorder error:', e);
        res.status(500).json({ error: 'Failed to reorder' });
    }
});

router.delete('/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    try {
        db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (e) {
        console.error('Category delete error:', e);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

module.exports = router;
