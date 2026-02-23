const express = require('express');
const router = express.Router();
const db = global.__shopDb;

router.get('/', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    
    try {
        const settings = {};
        const rows = db.prepare('SELECT key, value FROM settings').all();
        rows.forEach(row => {
            settings[row.key] = row.value;
        });
        
        if (!settings.seller_tg_id) {
            settings.seller_tg_id = String(global.SUPER_ADMIN_TG_ID || 7175369171);
        }
        
        res.json(settings);
    } catch (e) {
        console.error('Settings GET error:', e);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

router.put('/', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    
    const { seller_tg_id } = req.body;
    
    if (!seller_tg_id) {
        return res.status(400).json({ error: 'seller_tg_id is required' });
    }
    
    try {
        const tgId = parseInt(seller_tg_id);
        if (isNaN(tgId)) {
            return res.status(400).json({ error: 'seller_tg_id must be a number' });
        }
        
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seller_tg_id', String(tgId));
        
        global.__sellerTgId = tgId;
        
        if (global.__shopBot) {
            global.__shopBot.getChat(tgId).then(chat => {
                global.__sellerUsername = chat.username || '';
                console.log(`📇 Seller username updated: @${chat.username || 'N/A'}`);
            }).catch(e => {
                console.log('Could not resolve seller username for TG ID:', tgId);
            });
        }
        
        res.json({ success: true, seller_tg_id: String(tgId) });
    } catch (e) {
        console.error('Settings UPDATE error:', e);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

module.exports = router;
