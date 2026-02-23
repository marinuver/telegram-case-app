const express = require('express');
const router = express.Router();
const db = global.__shopDb;

router.get('/', (req, res) => {
    try {
        const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
        for (const order of orders) {
            order.items = db.prepare(
                'SELECT oi.*, p.name as product_name, p.image_url FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?'
            ).all(order.id);
        }
        res.json(orders);
    } catch (e) {
        console.error('Orders GET error:', e);
        res.json([]);
    }
});

router.get('/all', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const orders = db.prepare(
            'SELECT o.*, u.username, u.first_name, u.last_name, u.tg_id as customer_tg_id FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC'
        ).all();
        for (const order of orders) {
            order.items = db.prepare(
                'SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?'
            ).all(order.id);
        }
        res.json(orders);
    } catch (e) {
        console.error('Admin orders error:', e);
        res.json([]);
    }
});

router.put('/:id/status', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    const { status } = req.body;
    if (!['pending', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    try {
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
        res.json(order);
    } catch (e) {
        console.error('Order status update error:', e);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

router.post('/', (req, res) => {
    try {
        const { items, promo_code } = req.body;
        if (!items || !items.length) return res.status(400).json({ error: 'No items' });

        let discount = 0;
        let promoCode = null;

        if (promo_code) {
            const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ? AND active = 1').get(promo_code.toUpperCase());
            if (promo) {
                if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
                    return res.status(400).json({ error: 'Promo code exhausted' });
                }
                if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
                    return res.status(400).json({ error: 'Promo code expired' });
                }
                promoCode = promo.code;
                let subtotal = 0;
                for (const item of items) {
                    const product = db.prepare('SELECT price FROM products WHERE id = ?').get(item.product_id);
                    if (product) subtotal += product.price * item.quantity;
                }
                if (promo.discount_percent > 0) {
                    discount = subtotal * (promo.discount_percent / 100);
                } else if (promo.discount_amount > 0) {
                    discount = promo.discount_amount;
                }
                db.prepare('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?').run(promo.id);
            }
        }

        let total = 0;
        const orderItems = [];
        for (const item of items) {
            const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
            if (!product) continue;
            if (product.stock === 0) continue;
            if (product.stock > 0 && product.stock < item.quantity) {
                return res.status(400).json({ error: `"${product.name}" — осталось ${product.stock} шт.` });
            }
            total += product.price * item.quantity;
            orderItems.push({ product_id: product.id, quantity: item.quantity, price: product.price, name: product.name });
        }
        if (!orderItems.length) return res.status(400).json({ error: 'No valid items' });

        total = Math.max(0, total - discount);

        db.prepare(
            'INSERT INTO orders (user_id, total, promo_code, discount, status) VALUES (?, ?, ?, ?, ?)'
        ).run(req.user.id, total, promoCode, discount, 'pending');

        const lastOrder = db.prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id);
        const orderId = lastOrder ? lastOrder.id : 0;
        for (const item of orderItems) {
            db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)').run(
                orderId, item.product_id, item.quantity, item.price
            );
            db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock > 0').run(
                item.quantity, item.product_id
            );
        }

        const order = { id: orderId, total, status: 'pending', discount, promo_code: promoCode };

        const customerName = req.user.first_name + (req.user.username ? ` (@${req.user.username})` : '');
        if (global.notifyAdminNewOrder) {
            global.notifyAdminNewOrder(order, orderItems, customerName);
        }

        res.json({
            ...order,
            sellerUsername: global.__sellerUsername || '',
            items: orderItems
        });
    } catch (e) {
        console.error('Order create error:', e);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

module.exports = router;
