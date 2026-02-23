const express = require('express');
const router = express.Router();
const db = global.__shopDb;

router.get('/', (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();

        const usersTotal = db.prepare('SELECT COUNT(*) as c FROM users').get();
        const usersDay = db.prepare('SELECT COUNT(*) as c FROM users WHERE created_at >= ?').get(todayStart);
        const usersWeek = db.prepare('SELECT COUNT(*) as c FROM users WHERE created_at >= ?').get(weekStart);
        const usersMonth = db.prepare('SELECT COUNT(*) as c FROM users WHERE created_at >= ?').get(monthStart);

        const salesTotalRow = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as sum FROM orders WHERE status = 'completed'").get();
        const salesDayRow = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as sum FROM orders WHERE status = 'completed' AND created_at >= ?").get(todayStart);
        const salesWeekRow = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as sum FROM orders WHERE status = 'completed' AND created_at >= ?").get(weekStart);
        const salesMonthRow = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as sum FROM orders WHERE status = 'completed' AND created_at >= ?").get(monthStart);

        const visitsTotal = db.prepare('SELECT COUNT(*) as c FROM visits').get();
        const visitsDay = db.prepare('SELECT COUNT(*) as c FROM visits WHERE visited_at >= ?').get(todayStart);
        const visitsWeek = db.prepare('SELECT COUNT(*) as c FROM visits WHERE visited_at >= ?').get(weekStart);
        const visitsMonth = db.prepare('SELECT COUNT(*) as c FROM visits WHERE visited_at >= ?').get(monthStart);

        const productsCount = db.prepare('SELECT COUNT(*) as c FROM products').get();
        const categoriesCount = db.prepare('SELECT COUNT(*) as c FROM categories').get();
        const promosCount = db.prepare('SELECT COUNT(*) as c FROM promo_codes').get();

        const totalRevenue = db.prepare("SELECT COALESCE(SUM(total),0) as r FROM orders WHERE status = 'completed'").get();
        const totalDiscounts = db.prepare("SELECT COALESCE(SUM(discount),0) as d FROM orders WHERE status = 'completed' AND discount > 0").get();

        res.json({
            users: {
                total: usersTotal?.c || 0,
                day: usersDay?.c || 0,
                week: usersWeek?.c || 0,
                month: usersMonth?.c || 0
            },
            sales: {
                total: { count: salesTotalRow?.count || 0, sum: salesTotalRow?.sum || 0 },
                day: { count: salesDayRow?.count || 0, sum: salesDayRow?.sum || 0 },
                week: { count: salesWeekRow?.count || 0, sum: salesWeekRow?.sum || 0 },
                month: { count: salesMonthRow?.count || 0, sum: salesMonthRow?.sum || 0 }
            },
            visits: {
                total: visitsTotal?.c || 0,
                day: visitsDay?.c || 0,
                week: visitsWeek?.c || 0,
                month: visitsMonth?.c || 0
            },
            products: {
                count: productsCount?.c || 0,
                categories: categoriesCount?.c || 0,
                promos: promosCount?.c || 0
            },
            financial: {
                revenue: totalRevenue?.r || 0,
                discounts: totalDiscounts?.d || 0
            }
        });
    } catch (e) {
        console.error('Stats error:', e);
        res.json({
            users: { total: 0, day: 0, week: 0, month: 0 },
            sales: {
                total: { count: 0, sum: 0 },
                day: { count: 0, sum: 0 },
                week: { count: 0, sum: 0 },
                month: { count: 0, sum: 0 }
            },
            visits: { total: 0, day: 0, week: 0, month: 0 },
            products: { count: 0, categories: 0, promos: 0 },
            financial: { revenue: 0, discounts: 0 }
        });
    }
});

module.exports = router;
