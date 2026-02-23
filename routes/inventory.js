const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const items = req.db.prepare(`
      SELECT i.id, i.created_at,
        p.id as product_id, p.name, p.image_url, p.price,
        c.name as case_name
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN cases c ON i.case_id = c.id
      WHERE i.user_id = ?
      ORDER BY i.created_at DESC
    `).all(req.user.id);
    
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/claim', (req, res) => {
  try {
    const item = req.db.prepare(`
      SELECT i.*, p.price, p.name, c.name as case_name
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN cases c ON i.case_id = c.id
      WHERE i.id = ? AND i.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!item) return res.status(404).json({ error: 'Item not found' });

    console.log('Claiming item:', item);

    req.db.prepare(
      'INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)'
    ).run(req.user.id, 0, 'pending');

    const lastOrder = req.db.prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id);
    const orderId = lastOrder ? lastOrder.id : 0;
    
    console.log('Order ID:', orderId);

    req.db.prepare(
      'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)'
    ).run(orderId, item.product_id, 1, 0);

    req.db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);

    const sellerUsername = global.__sellerUsername || '';
    
    let message = `Здравствуйте! 👋\n\n🎁 Я выиграл приз из кейса!\n\n`;
    message += `📦 Товар: ${item.name}`;
    if (item.case_name) {
      message += `\n🎰 Из кейса: ${item.case_name}`;
    }
    message += `\n\nИтого: БЕСПЛАТНО (приз)`;
    message += `\n\nЗаказ #${orderId}`;

    console.log('Response:', { orderId, itemName: item.name, message });

    res.json({ 
      success: true, 
      orderId: orderId,
      sellerUsername,
      message,
      itemName: item.name
    });
  } catch (e) {
    console.error('Claim item error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/sell', (req, res) => {
  try {
    const item = req.db.prepare(`
      SELECT i.*, p.price, p.name
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE i.id = ? AND i.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!item) return res.status(404).json({ error: 'Item not found' });

    const sellPrice = Math.floor(item.price * 0.5);

    req.db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);

    const existingBalance = req.db.prepare('SELECT balance FROM user_stars WHERE user_id = ?').get(req.user.id);
    
    if (existingBalance) {
      req.db.prepare('UPDATE user_stars SET balance = balance + ? WHERE user_id = ?').run(sellPrice, req.user.id);
    } else {
      req.db.prepare('INSERT INTO user_stars (user_id, balance) VALUES (?, ?)').run(req.user.id, sellPrice);
    }

    res.json({ success: true, stars: sellPrice });
  } catch (e) {
    console.error('Sell item error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/stars', (req, res) => {
  try {
    const balance = req.db.prepare('SELECT balance FROM user_stars WHERE user_id = ?').get(req.user.id);
    res.json({ balance: balance ? balance.balance : 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
