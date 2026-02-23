const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = global.__shopDb;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'public', 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `bc_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/', upload.single('photo'), async (req, res) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { text, photo_url, parse_mode } = req.body;
    let photoSource = null;
    if (req.file) {
        photoSource = { type: 'file', path: req.file.path };
    } else if (photo_url) {
        photoSource = { type: 'url', url: photo_url };
    }

    if (!text && !photoSource) {
        return res.status(400).json({ error: 'Нужен текст или фото' });
    }

    const bot = global.__shopBot;
    if (!bot) {
        return res.status(500).json({ error: 'Бот не запущен' });
    }

    try {
        const users = db.prepare('SELECT tg_id FROM users WHERE tg_id IS NOT NULL AND tg_id > 0').all();

        let sent = 0;
        let failed = 0;
        const mode = parse_mode || 'HTML';

        for (const user of users) {
            try {
                if (photoSource) {
                    let photo;
                    if (photoSource.type === 'file') {
                        photo = fs.createReadStream(photoSource.path);
                    } else {
                        photo = photoSource.url;
                    }
                    await bot.sendPhoto(user.tg_id, photo, {
                        caption: text || '',
                        parse_mode: mode
                    });
                } else {
                    await bot.sendMessage(user.tg_id, text, {
                        parse_mode: mode,
                        disable_web_page_preview: false
                    });
                }
                sent++;
            } catch (e) {
                failed++;
            }

            if (sent % 25 === 0) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch (e) { /* игнорим */ }
        }

        res.json({ sent, failed, total: users.length });
    } catch (e) {
        console.error('Broadcast error:', e);
        res.status(500).json({ error: 'Ошибка рассылки' });
    }
});

module.exports = router;
