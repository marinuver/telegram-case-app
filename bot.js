const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = '7906044844:AAHdCBQI6TrmgL6qdTuN-iZNjh2Vr_X8RSs';
const WEB_APP_URL = 'https://sdfjklghluksdfjhgk.ru';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'друг';

    bot.sendMessage(chatId, `Привет, ${firstName}! 👋\n\nДобро пожаловать в наш магазин! Нажми кнопку ниже чтобы открыть каталог 🛒`, {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: '🛒 Открыть магазин',
                        web_app: { url: WEB_APP_URL }
                    }
                ]
            ]
        }
    });
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `📋 *Помощь*\n\n` +
        `/start — Открыть магазин\n` +
        `/help — Помощь\n\n` +
        `Нажми кнопку ниже чтобы перейти в магазин! 👇`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🛒 Открыть магазин', web_app: { url: WEB_APP_URL } }]
                ]
            }
        }
    );
});

console.log('🤖 Bot is running...');
