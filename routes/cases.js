const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `case_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', (req, res) => {
  try {
    const cases = req.db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM case_items WHERE case_id = c.id) as items_count
      FROM cases c
      WHERE c.active = 1
      ORDER BY c.sort_order ASC, c.id DESC
    `).all();
    res.json(cases);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/all', (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const cases = req.db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM case_items WHERE case_id = c.id) as items_count
      FROM cases c
      ORDER BY c.sort_order ASC, c.id DESC
    `).all();
    res.json(cases);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const caseData = req.db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const items = req.db.prepare(`
      SELECT ci.*, p.name, p.image_url, p.price
      FROM case_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.case_id = ?
      ORDER BY ci.chance DESC
    `).all(req.params.id);

    res.json({ ...caseData, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', upload.single('image'), (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { name, description, price } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url || null;

    const result = req.db.prepare(
      'INSERT INTO cases (name, description, price, image_url) VALUES (?, ?, ?, ?)'
    ).run(name, description || '', parseInt(price), image_url);

    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', upload.single('image'), (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { name, description, price, active } = req.body;
    let image_url = req.body.image_url;

    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
    }

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (price !== undefined) { updates.push('price = ?'); params.push(parseInt(price)); }
    if (image_url !== undefined) { updates.push('image_url = ?'); params.push(image_url); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }

    params.push(req.params.id);

    req.db.prepare(`UPDATE cases SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
  try {
    req.db.prepare('DELETE FROM cases WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/items', (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { product_id, chance } = req.body;
    req.db.prepare(
      'INSERT INTO case_items (case_id, product_id, chance) VALUES (?, ?, ?)'
    ).run(req.params.id, product_id, parseFloat(chance));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/items/:itemId', (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { chance } = req.body;
    req.db.prepare('UPDATE case_items SET chance = ? WHERE id = ?').run(parseFloat(chance), req.params.itemId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id/items/:itemId', (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
  try {
    req.db.prepare('DELETE FROM case_items WHERE id = ?').run(req.params.itemId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/create-invoice', async (req, res) => {
  try {
    if (req.user.is_admin) {
      return res.json({ free: true });
    }

    const caseData = req.db.prepare('SELECT * FROM cases WHERE id = ? AND active = 1').get(req.params.id);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const bot = global.__shopBot;
    if (!bot) return res.status(500).json({ error: 'Bot not available' });

    const title = `Открытие кейса: ${caseData.name}`;
    const description = caseData.description || 'Откройте кейс и получите приз!';
    const payload = JSON.stringify({ case_id: caseData.id, user_id: req.user.id });

    const invoiceLink = await bot.createInvoiceLink(
      title,
      description,
      payload,
      '',
      'XTR',
      [{ label: caseData.name, amount: caseData.price }]
    );

    res.json({ invoiceLink });
  } catch (e) {
    console.error('Create invoice error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/complete-payment', async (req, res) => {
  try {
    const caseData = req.db.prepare('SELECT * FROM cases WHERE id = ? AND active = 1').get(req.params.id);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const items = req.db.prepare(`
      SELECT ci.*, p.name, p.image_url, p.price
      FROM case_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.case_id = ?
    `).all(req.params.id);

    if (!items.length) return res.status(400).json({ error: 'Case has no items' });

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

    req.db.prepare(
      'INSERT INTO inventory (user_id, product_id, case_id) VALUES (?, ?, ?)'
    ).run(req.user.id, wonItem.product_id, caseData.id);

    res.json({
      success: true,
      item: {
        id: wonItem.product_id,
        name: wonItem.name,
        image_url: wonItem.image_url,
        price: wonItem.price
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/open', async (req, res) => {
  try {
    if (req.user.is_admin) {
      const caseData = req.db.prepare('SELECT * FROM cases WHERE id = ? AND active = 1').get(req.params.id);
      if (!caseData) return res.status(404).json({ error: 'Case not found' });

      const items = req.db.prepare(`
        SELECT ci.*, p.name, p.image_url, p.price
        FROM case_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.case_id = ?
      `).all(req.params.id);

      if (!items.length) return res.status(400).json({ error: 'Case has no items' });

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

      req.db.prepare(
        'INSERT INTO inventory (user_id, product_id, case_id) VALUES (?, ?, ?)'
      ).run(req.user.id, wonItem.product_id, caseData.id);

      return res.json({
        success: true,
        item: {
          id: wonItem.product_id,
          name: wonItem.name,
          image_url: wonItem.image_url,
          price: wonItem.price
        }
      });
    }

    return res.status(400).json({ error: 'Use create-invoice endpoint' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/reorder/all', (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { order } = req.body;
    const updateOrder = req.db.transaction((items) => {
      for (const item of items) {
        req.db.prepare('UPDATE cases SET sort_order = ? WHERE id = ?').run(item.sort_order, item.id);
      }
    });
    updateOrder(order);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

router.post('/:id/payment-success', async (req, res) => {
  try {
    const { userId } = req.body;
    const caseData = req.db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const items = req.db.prepare(`
      SELECT ci.*, p.name, p.image_url, p.price
      FROM case_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.case_id = ?
    `).all(req.params.id);

    if (!items.length) return res.status(400).json({ error: 'Case has no items' });

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

    req.db.prepare(
      'INSERT INTO inventory (user_id, product_id, case_id) VALUES (?, ?, ?)'
    ).run(userId, wonItem.product_id, caseData.id);

    res.json({
      success: true,
      item: {
        id: wonItem.product_id,
        name: wonItem.name,
        image_url: wonItem.image_url,
        price: wonItem.price
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
