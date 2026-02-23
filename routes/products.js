const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const db = global.__shopDb;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `product_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function downloadImage(url) {
    return new Promise((resolve, reject) => {
        const filename = `product_${Date.now()}.jpg`;
        const filepath = path.join(__dirname, '..', 'uploads', filename);
        const proto = url.startsWith('https') ? https : http;

        proto.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadImage(response.headers.location).then(resolve).catch(reject);
                return;
            }
            const file = fs.createWriteStream(filepath);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(`/uploads/${filename}`);
            });
        }).on('error', reject);
    });
}

router.get('/', (req, res) => {
    try {
        const { category_id, search } = req.query;
        let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id';
        const params = [];
        const conditions = [];

        if (category_id) {
            conditions.push('p.category_id = ?');
            params.push(category_id);
        }
        if (search) {
            conditions.push('p.name LIKE ?');
            params.push(`%${search}%`);
        }
        if (conditions.length) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY p.created_at DESC';

        const products = db.prepare(query).all(...params);
        res.json(products);
    } catch (e) {
        console.error('Products GET error:', e);
        res.json([]);
    }
});

router.get('/:id', (req, res) => {
    try {
        const product = db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?').get(req.params.id);
        if (!product) return res.status(404).json({ error: 'Not found' });
        res.json(product);
    } catch (e) {
        console.error('Product GET error:', e);
        res.status(500).json({ error: 'Failed to get product' });
    }
});

router.post('/', upload.single('image'), async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    const { name, description, price, stars_price, category_id, image_url, stock } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price required' });

    try {
        let finalImageUrl = '';
        if (req.file) {
            finalImageUrl = `/uploads/${req.file.filename}`;
        } else if (image_url) {
            try {
                finalImageUrl = await downloadImage(image_url);
            } catch (e) {
                finalImageUrl = image_url;
            }
        }

        const result = db.prepare(
            'INSERT INTO products (name, description, price, stars_price, category_id, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(name, description || '', parseFloat(price), parseInt(stars_price) || 0, category_id || null, finalImageUrl, stock !== undefined ? parseInt(stock) : -1);

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
        res.json(product || { id: result.lastInsertRowid, name, price: parseFloat(price), stars_price: parseInt(stars_price) || 0 });
    } catch (e) {
        console.error('Product create error:', e);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

router.put('/:id', upload.single('image'), async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    const { name, description, price, stars_price, category_id, image_url, stock } = req.body;

    try {
        let finalImageUrl = undefined;
        if (req.file) {
            finalImageUrl = `/uploads/${req.file.filename}`;
        } else if (image_url) {
            try {
                finalImageUrl = await downloadImage(image_url);
            } catch (e) {
                finalImageUrl = image_url;
            }
        }

        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Not found' });

        db.prepare(
            'UPDATE products SET name = ?, description = ?, price = ?, stars_price = ?, category_id = ?, image_url = ?, stock = ? WHERE id = ?'
        ).run(
            name || existing.name,
            description !== undefined ? description : existing.description,
            price ? parseFloat(price) : existing.price,
            stars_price !== undefined ? parseInt(stars_price) : (existing.stars_price || 0),
            category_id !== undefined ? (category_id || null) : existing.category_id,
            finalImageUrl !== undefined ? finalImageUrl : existing.image_url,
            stock !== undefined ? parseInt(stock) : existing.stock,
            req.params.id
        );

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        res.json(product);
    } catch (e) {
        console.error('Product update error:', e);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

router.delete('/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    try {
        db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (e) {
        console.error('Product delete error:', e);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

module.exports = router;
