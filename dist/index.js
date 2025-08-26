import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { Bot, InlineKeyboard, session } from 'grammy';
import admin from 'firebase-admin';
import { createRequire } from 'module';
import { adminKeyboard, catalogKeyboard, categoryKeyboard, changeCredentialsKeyboard, cancelKeyboard, paymentMethodsKeyboard, productsManagementKeyboard, profileKeyboard, pubgKeyboard, returnKeyboard, starsKeyboard, telegramKeyboard, cryptobotKeyboard, manageAdminsKeyboard, adminReturnKeyboard, deleteProductListKeyboard, manageCodesKeyboard, manageCodesListKeyboard, toMenuKeyboard, depositKeyboard, orderRequestKeyboard, depositRequestKeyboard } from './keyboards.js';
import { ADMIN_CHAT_ID, database, deletePendingChecks, DEPOSIT_GROUP_ID, getAdmins, getAllBalances, getPaymentDetails, getPendingChecks, getStarsPrice, getUserBalance, initializeFirebaseData, refs, setAdmins, setPaymentDetails, setPendingCheck, setStarsPrice, setUserBalance } from './globals.js';
import { currentProducts, getUserTag, handlePubgIdInput, isAdmin, processCryptoBotMessage, purchaseCodes, purchasePremium, purchaseWithId, sendBroadcastMessage, sendDepositRequest, sendMainMessage, sendOrderRequest, sendUnusedCodes, updateCartMessage, updateProducts } from './botUtils.js';
const app = express();
app.use(express.json());
const require = createRequire(import.meta.url);
const serviceAccount = require('../secrets/serviceAccount.json');
const token = process.env.token || '';
export const bot = new Bot(token);
// Firebase configuration
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://ronidbot-default-rtdb.firebaseio.com"
});
initializeFirebaseData();
// Initialize session middleware
bot.use(session({
    initial: () => ({})
}));
const IMAGES = {
    welcome: 'https://ibb.co/8LVZ1Qcd',
    pack: 'https://ibb.co/wF0vRw5J',
    payment: 'https://ibb.co/W4VVcZWz',
    amount: 'https://ibb.co/W4VVcZWz'
};
// Command handlers
bot.command('start', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId)
        return;
    if (getUserBalance(chatId) === undefined) {
        await setUserBalance(chatId, 0);
    }
    await sendMainMessage(ctx);
});
// Callback query handlers
bot.on('callback_query:data', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId)
        return;
    const data = ctx.callbackQuery.data;
    const messageId = ctx.msg.message_id;
    try {
        if (data === 'return') {
            ctx.session.cart = undefined;
            ctx.session.state = undefined;
            await sendMainMessage(ctx, messageId);
        }
        else if (data === 'main-message') {
            ctx.session.cart = undefined;
            ctx.session.state = undefined;
            await sendMainMessage(ctx);
        }
        else if (data === 'catalog') {
            await ctx.editMessageText('Выберите раздел:', {
                reply_markup: catalogKeyboard
            });
        }
        else if (data === 'pubg') {
            await ctx.editMessageText('Выберите категорию товара:', {
                reply_markup: pubgKeyboard
            });
        }
        else if (data === 'telegram') {
            await ctx.editMessageText('Выберите категорию товара:', {
                reply_markup: telegramKeyboard
            });
        }
        else if (data.startsWith('open-shop')) {
            const type = data.split('_')[1] || '';
            if (type === 'stars') {
                ctx.session.state = { type: 'awaiting_stars_amount' };
                await ctx.editMessageText(`1⭐️ = ${getStarsPrice()}₽ . Напишите сколько звезд вы хотите купить:`, {
                    reply_markup: new InlineKeyboard().text('❌ Отмена', 'return')
                });
                return;
            }
            if (!ctx.session.cart) {
                ctx.session.cart = { items: [], total: 0 };
            }
            await updateCartMessage(ctx, type);
        }
        else if (data === 'admin-panel') {
            if (!isAdmin(chatId)) {
                return;
            }
            ctx.session.cart = undefined;
            ctx.session.state = undefined;
            await ctx.editMessageMedia({
                type: 'photo',
                media: IMAGES.welcome,
                caption: 'Добро пожаловать в Админ панель!'
            }, {
                reply_markup: adminKeyboard
            });
        }
        else if (data === 'my-profile') {
            ctx.session.cart = undefined;
            ctx.session.state = undefined;
            await ctx.editMessageCaption({
                caption: `<b>✦ Ваш профиль!
👤Пользователь : <code>${chatId}</code> 
💳Баланс : <u>${getUserBalance(chatId)}₽</u></b>`,
                reply_markup: profileKeyboard
            });
        }
        else if (data === 'my-orders') {
            try {
                const snapshot = await refs.orders.child(`${chatId}`).once('value');
                const orders = snapshot.val();
                if (!orders) {
                    return ctx.api.sendMessage(chatId, '📭 У вас еще нет заказов');
                }
                const ordersList = Object.entries(orders)
                    .map(([orderId, order]) => {
                    let details = '';
                    if (order.type === 'codes') {
                        // Форматируем коды для отображения
                        const codesText = order.codes
                            ? Object.entries(order.codes)
                                .map(([label, codes]) => `➥ ${label} UC:\n${codes.join('\n')}`)
                                .join('\n\n')
                            : 'Нет доступных кодов';
                        details = `\n🔑 Полученные коды:\n${codesText}`;
                    }
                    else {
                        details = `\n🆔 Игровой ID: ${order.pubgId}`;
                    }
                    return `🆔 Заказ #${orderId}
📅 Дата: ${new Date(order.timestamp).toLocaleDateString()}
🛍 Товаров: ${order.items.length}
💵 Сумма: ${order.total}₽
📊 Статус: ${getStatusEmoji(order.status)} ${order.status}
${details}`;
                })
                    .join('\n\n────────────────\n');
                ctx.api.sendMessage(chatId, `📋 История ваших заказов:\n\n${ordersList}`, {
                    parse_mode: 'HTML',
                    reply_markup: returnKeyboard
                });
                ctx.api.deleteMessage(chatId, messageId);
            }
            catch (error) {
                console.error('Ошибка получения заказов:', error);
            }
            function getStatusEmoji(status) {
                switch (status) {
                    case 'confirmed': return '✅';
                    default: return '⏳';
                }
            }
        }
        else if (data === 'deposit') {
            ctx.api.editMessageMedia(chatId, messageId, {
                type: 'photo',
                media: IMAGES.payment,
                caption: 'Выберите способ оплаты'
            }, {
                reply_markup: paymentMethodsKeyboard
            });
            return;
        }
        else if (data === 'deposit-with-bybit') {
            ctx.api.editMessageMedia(chatId, messageId, {
                type: 'photo',
                media: IMAGES.amount,
                caption: 'Отправьте сумму, на которую хотите пополнить баланс: '
            }, {
                reply_markup: cancelKeyboard
            });
            ctx.session.state.type = 'awaiting_deposit';
            return;
        }
        else if (data === 'deposit-with-cryptobot') {
            ctx.api.editMessageMedia(chatId, messageId, {
                type: 'photo',
                media: IMAGES.amount,
                caption: '<b>➤ Оплатите счёт ниже на сумму которую хотите внести! </b>',
                parse_mode: 'HTML'
            }, {
                reply_markup: cryptobotKeyboard
            });
        }
        else if (data.startsWith('add-to-cart_')) {
            const [, label, price, type] = data.split('_');
            const products = currentProducts(type);
            const product = products.find((p) => p.label === label);
            if (!product) {
                await ctx.answerCallbackQuery({ text: '❌ Товар не найден' });
                return;
            }
            if (!ctx.session.cart) {
                ctx.session.cart = { items: [], total: 0 };
            }
            ctx.session.cart.items.push(product);
            ctx.session.cart.total = Math.round((ctx.session.cart.total + parseFloat(price)) * 100) / 100;
            await updateCartMessage(ctx, type);
            await ctx.answerCallbackQuery({ text: `✅ ${label} добавлен в корзину` });
        }
        else if (data.startsWith('cart_')) {
            const [, action, type] = data.split('_');
            switch (action) {
                case 'clear':
                    delete ctx.session.cart;
                    await updateCartMessage(ctx, type);
                    await ctx.answerCallbackQuery({ text: '🗑 Корзина очищена' });
                    break;
                case 'buy-with-id':
                    await purchaseWithId(ctx);
                    break;
                case 'buy-codes':
                    await purchaseCodes(ctx);
                    break;
                // case 'buy-promo':
                //   await purchasePromo(ctx);
                //   break;
            }
        }
        else if (data.startsWith('buy-premium_')) {
            const [, label, price] = data.split('_');
            await purchasePremium(ctx, label, parseInt(price));
        }
        else if (data === 'edit-payment-details') {
            await ctx.editMessageCaption({
                caption: 'Выберите способ оплаты для редактирования:',
                reply_markup: changeCredentialsKeyboard
            });
            return;
        }
        else if (data.startsWith('select-payment-method_')) {
            const method = data.split('_')[1];
            ctx.session.state = {
                type: 'awaiting_to_change_credentials',
                data: { method }
            };
            await ctx.editMessageCaption({
                caption: `Введите новые реквизиты для ${method}:`,
                reply_markup: cancelKeyboard
            });
            return;
        }
        else if (data === 'manage-balances') {
            if (ctx.session.state) {
                ctx.session.state.type = 'awaiting_user_to_change_balance';
            }
            ;
            await ctx.editMessageCaption({
                caption: 'Введите ID пользователя, чей баланс вы хотите изменить:',
                reply_markup: cancelKeyboard
            });
            return;
        }
        else if (data === 'manage-products') {
            await ctx.editMessageCaption({
                caption: '📦 Выберите категорию товаров:',
                reply_markup: categoryKeyboard
            });
            return;
        }
        else if (data.startsWith('manage-category_')) {
            const categoryNames = {
                codes: 'UC по кодам',
                id: 'UC по ID',
                promo: 'Акции',
                premium: 'Premium'
            };
            const category = data.split('_')[1];
            if (category === 'stars') {
                ctx.editMessageCaption({
                    caption: '⭐ Выберите, что вы хотите сделать с звездами',
                    reply_markup: starsKeyboard
                });
                return;
            }
            await ctx.editMessageCaption({
                caption: `🛠 Управление товарами (${categoryNames[category]}):`,
                reply_markup: productsManagementKeyboard(category)
            });
            return;
        }
        else if (data.startsWith('edit-product_')) {
            const [, category, label] = data.split('_');
            if (!isAdmin(chatId)) {
                return;
            }
            const products = currentProducts(category);
            const product = products.find(p => p.label === label);
            if (!product) {
                ctx.api.sendMessage(chatId, `Товар с меткой ${label} не найден.`, {
                    reply_markup: returnKeyboard
                });
                return;
            }
            ctx.api.sendMessage(chatId, `Введите новую цену для товара ${label}:`, {
                reply_markup: cancelKeyboard
            });
            ctx.session.state = {
                type: 'awaiting_to_change_product',
                data: { category }
            };
            return;
        }
        else if (data.startsWith('delete-product-list_')) {
            const category = data.split('_')[1];
            ctx.editMessageCaption({
                caption: 'Выберите товар, который хотите удалить:',
                reply_markup: deleteProductListKeyboard(category)
            });
            return;
        }
        else if (data.startsWith('delete-product_')) {
            const [, category, labelToDelete] = data.split('_');
            if (!isAdmin(chatId)) {
                return;
            }
            const products = currentProducts(category);
            // Проверка наличия товара
            const product = products.find(p => p.label === labelToDelete);
            if (!product) {
                ctx.api.sendMessage(chatId, `Товар с меткой ${labelToDelete} не найден.`, {
                    reply_markup: returnKeyboard
                });
                return;
            }
            const index = products.findIndex(product => product.label === labelToDelete);
            // Проверяем, найден ли товар
            if (index !== -1) {
                // Удаляем товар из массива
                products.splice(index, 1);
                updateProducts(chatId, category, products);
            }
            else {
                ctx.api.sendMessage(chatId, `Товар ${labelToDelete} не найден.`, {
                    reply_markup: returnKeyboard
                });
            }
            return;
        }
        else if (data.startsWith('add-product_')) {
            const category = data.split('_')[1];
            ctx.session.state = {
                type: 'awaiting_new_product_label',
                data: category
            };
            await ctx.editMessageCaption({
                caption: 'Введите название нового товара:',
                reply_markup: cancelKeyboard
            });
        }
        else if (data === 'manage-admins') {
            await ctx.editMessageCaption({
                caption: '👥 Управление администраторами:',
                reply_markup: manageAdminsKeyboard
            });
            return;
        }
        else if (data === 'add-admin') {
            await ctx.editMessageCaption({
                caption: 'Введите ID пользователя, которого хотите сделать администратором',
                reply_markup: cancelKeyboard
            });
            ctx.session.state.type = 'awaiting_to_add_admin';
            return;
        }
        else if (data === 'remove-admin') {
            await ctx.editMessageCaption({
                caption: 'Введите ID администратора, которого хотите удалить',
                reply_markup: cancelKeyboard
            });
            ctx.session.state.type = 'awaiting_to_remove_admin';
            return;
        }
        else if (data === 'send-broadcast') {
            if (!isAdmin(chatId)) {
                return;
            }
            ;
            await ctx.editMessageCaption({
                caption: 'Отправьте текст сообщения, которое хотите разослать всем пользователям:',
                reply_markup: adminReturnKeyboard
            });
            ctx.session.state.type = 'awaiting_to_create_mailing';
        }
        else if (data === 'manage-codes') {
            ctx.session.cart = undefined;
            ctx.session.state = undefined;
            await ctx.editMessageCaption({
                caption: 'Выберите, что вы хотите сделать с кодами',
                reply_markup: manageCodesKeyboard
            });
            return;
        }
        else if (data === 'add-codes-list') {
            await ctx.editMessageCaption({
                caption: 'Выберите товар для добавления кодов:',
                reply_markup: manageCodesListKeyboard('add')
            });
            return;
        }
        else if (data === 'remove-codes-list') {
            await ctx.editMessageCaption({
                caption: 'Выберите товар для удаления кодов:',
                reply_markup: manageCodesListKeyboard('remove')
            });
            return;
        }
        else if (data.startsWith('add-codes_')) {
            const productLabel = data.split('_')[1];
            sendUnusedCodes(ctx, productLabel);
            ctx.session.state = {
                type: 'awaiting_codes_for_product',
                data: { productLabel }
            };
            ctx.editMessageCaption({
                caption: `Отправьте коды для ${productLabel} UC (по одному в строке):`,
                reply_markup: returnKeyboard
            });
            return;
        }
        else if (data.startsWith('remove-codes_')) {
            const productLabel = data.split('_')[1];
            sendUnusedCodes(ctx, productLabel);
            ctx.session.state = {
                type: 'awaiting_code_to_delete',
                data: productLabel
            };
            ctx.editMessageCaption({
                caption: 'Отправьте код, который вы хотите удалить (Скопируйте нажатием по нему)',
                reply_markup: returnKeyboard
            });
            return;
        }
        else if (data.startsWith('confirm_')) {
            if (!isAdmin(chatId)) {
                return;
            }
            ;
            const userId = data.split('_')[1];
            const userInfo = getPendingChecks()[userId];
            if (userInfo) {
                const depositAmount = userInfo.amount;
                const balance = getUserBalance(userId);
                const newBalance = balance + depositAmount;
                await setUserBalance(userId, newBalance);
                sendDepositRequest(`Пополнение на ${depositAmount}₽ для ${userInfo.userTag} (ID: ${userId}) подтверждено.`);
                bot.api.sendMessage(userId, `Ваш баланс был пополнен на ${depositAmount}₽. Текущий баланс: ${balance}₽.`, {
                    reply_markup: toMenuKeyboard
                });
                deletePendingChecks(userId);
            }
            ;
        }
        else if (data.startsWith('reject_')) {
            if (!isAdmin(chatId)) {
                return;
            }
            ;
            const userId = data.split('_')[1];
            const userInfo = getPendingChecks()[userId];
            if (userInfo) {
                sendDepositRequest(`Пополнение на ${userInfo.amount}₽ для ${userInfo.userTag} (ID: ${userId}) отменено.`);
                bot.api.sendMessage(userId, `Ваше пополнение на сумму ${userInfo.amount}₽ было отклонено. Пожалуйста, попробуйте снова.`, {
                    reply_markup: toMenuKeyboard
                });
                deletePendingChecks(userId);
            }
            ;
        }
        else if (data.startsWith('order-completed_')) {
            if (!isAdmin(chatId)) {
                return;
            }
            ;
            const [, userId, orderId] = data.split('_');
            try {
                await refs.orders.child(userId).child(orderId).update({
                    status: 'confirmed',
                    confirmedAt: Date.now(),
                    adminId: chatId
                });
                sendOrderRequest(`✅ Заказ для пользователя с ID ${userId} был выполнен.`);
                bot.api.sendMessage(userId, '✅ Заказ выполнен', {
                    reply_markup: toMenuKeyboard
                });
                ctx.editMessageReplyMarkup({
                    reply_markup: new InlineKeyboard()
                });
            }
            catch (error) {
                console.error('Ошибка подтверждения заказа: ', error);
            }
            return;
        }
        else if (data.startsWith('order-declined_')) {
            if (!isAdmin(chatId)) {
                return;
            }
            ;
            const [, userId, orderId, amount] = data.split('_');
            try {
                await refs.orders.child(userId).child(orderId).update({
                    status: 'declined',
                    confirmedAt: Date.now(),
                    adminId: chatId
                });
                const newBalance = getUserBalance(userId) + Math.round(parseFloat(amount) * 100) / 100;
                await setUserBalance(userId, newBalance);
                await sendOrderRequest(`❌ Заказ для пользователя с ID ${userId} был отменен.`);
                bot.api.sendMessage(userId, '⛔️ Ваш заказ отклонён, причину узнайте у администратора', {
                    reply_markup: toMenuKeyboard
                });
                ctx.editMessageReplyMarkup({
                    reply_markup: new InlineKeyboard()
                });
            }
            catch (error) {
                console.error('Ошибка подтверждения заказа: ', error);
            }
            return;
        }
        // ... (другие обработчики callback-запросов)
        await ctx.answerCallbackQuery();
    }
    catch (error) {
        console.error('Callback query error:', error);
    }
});
// Message handler
bot.on('message', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !ctx.msg.text)
        return;
    const userTag = getUserTag(ctx);
    const text = ctx.msg.text;
    const state = ctx.session.state;
    try {
        // Process CryptoBot messages
        await processCryptoBotMessage(ctx);
        // Handle admin replies
        if (ctx.msg.reply_to_message && isAdmin(chatId)) {
            // const replyTo = ctx.msg.reply_to_message;
            // if (replyTo.forward_from) {
            //   const userId = replyTo.forward_from.id;
            //   await ctx.api.sendMessage(userId, `Ответ от администратора: ${text}`);
            //   await sendMessageToAllAdmins(`Ответ отправлен пользователю ${userId}`);
            // }
            console.log(ctx.msg);
        }
        if (state) {
            if (state.type === 'awaiting_pubg_id') {
                handlePubgIdInput(ctx, text);
            }
            else if (state.type === 'awaiting_stars_amount') {
            }
            else if (state.type === 'awaiting_user_tag') {
                const starsAmount = state.data.starsAmount;
            }
            else if (state.type === 'awaiting_premium_tag') {
                try {
                    const tag = text;
                    if (!tag.startsWith('@')) {
                        ctx.api.sendMessage(chatId, 'Пришлите настояищий тег пользователя, начинающийся с @', {
                            reply_markup: cancelKeyboard
                        });
                        return;
                    }
                    ;
                    const label = state.data.label;
                    const price = state.data.price;
                    const balance = getUserBalance(chatId);
                    if (price > balance) {
                        ctx.api.sendMessage(chatId, '❌ Недостаточно средств! Пополните свой баланс.', {
                            reply_markup: depositKeyboard
                        });
                        ctx.session = undefined;
                        return;
                    }
                    ;
                    const orderNumber = Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);
                    const newBalance = balance - price;
                    await setUserBalance(chatId, newBalance);
                    const orderData = {
                        orderId: orderNumber,
                        userId: chatId,
                        type: 'premium',
                        tag: tag,
                        items: label,
                        total: price,
                        status: 'pending',
                        timestamp: Date.now(),
                        userInfo: {
                            username: userTag,
                            balanceBefore: balance,
                            balanceAfter: newBalance
                        }
                    };
                    await refs.orders.child(chatId.toString()).child(orderNumber).set(orderData);
                    const orderText = [
                        '✅ Новый заказ',
                        `🧾#${orderNumber}`,
                        'Тип заказа: Premium',
                        `Товары: ${label}`,
                        `💵Стоимость: ${price}`,
                        `🆔: ${tag}`,
                        `🪪Пользователь: ${userTag} (ID: ${chatId}).`,
                        '⚠️Выберите действие ниж'
                    ].join('\n');
                    sendOrderRequest(orderText, orderRequestKeyboard(chatId, orderNumber, price));
                    ctx.api.sendMessage(chatId, `Ваш заказ ${label} Telegram Premium за ${price}₽ на аккаунт ${tag} отправлен администратору. Ожидайте пополнения`, {
                        reply_markup: toMenuKeyboard
                    });
                }
                catch (error) {
                    console.error('Ошибка сохранения заказа:', error);
                    await ctx.api.sendMessage(chatId, '❌ Ошибка оформления заказа, попробуйте позже');
                }
                return;
            }
            else if (state.type === 'awaiting_deposit') {
                const amount = parseFloat(text);
                if (isNaN(amount)) {
                    await ctx.api.sendMessage(chatId, 'Вы отправили некорректную сумму', {
                        reply_markup: cancelKeyboard
                    });
                }
                ;
                await ctx.api.sendMessage(chatId, `<b>➤ByBit UID - <code>${getPaymentDetails().ByBit}</code> \n ▫️Отправьте ${amount}₽ на указанный выше ID, после оплаты отправьте скриншот!</b>`, {
                    reply_markup: cancelKeyboard,
                    parse_mode: 'HTML'
                });
                ctx.session.state = {
                    type: 'awaiting_receipt',
                    data: {
                        amount,
                        userTag,
                        userId: chatId
                    }
                };
                return;
            }
            else if (state.type === 'awaiting_receipt') {
                const userInfo = {
                    amount: state.data.amount,
                    userTag: state.data.userTag,
                    userId: state.data.userId
                };
                await setPendingCheck(chatId, userInfo);
                await bot.api.forwardMessage(DEPOSIT_GROUP_ID, chatId, ctx.message.message_id);
                await sendDepositRequest(`🆕 Запрос на пополнение баланса\n` +
                    `👤 Пользователь: ${userTag} (ID: ${chatId})\n` +
                    `💵 Сумма: ${userInfo.amount}₽\n` +
                    `📅 Время: ${new Date().toLocaleString()}`, depositRequestKeyboard(chatId));
                await ctx.api.sendMessage(chatId, 'Чек получен и отправлен администратору на проверку. Ожидайте подтверждения.', {
                    reply_markup: toMenuKeyboard
                });
                ctx.session.state = undefined;
                ctx.session.cart = undefined;
                return;
            }
            else if (state.type === 'awaiting_to_change_product') {
                const category = state.data.category;
                const newPrice = parseFloat(text);
                if (isNaN(newPrice)) {
                    await ctx.api.sendMessage(chatId, 'Пожалуйста, введите корректную цену.', {
                        reply_markup: adminReturnKeyboard
                    });
                    return;
                }
                ;
                await updateProducts(chatId, category);
                ctx.session.state = undefined;
                return;
            }
            else if (state.type === 'awaiting_new_product_label') {
                const newLabel = text;
                await ctx.api.sendMessage(chatId, `Введите цену для нового товара (${newLabel}): `, {
                    reply_markup: adminReturnKeyboard
                });
                ctx.session.state = {
                    type: 'awaiting_new_product_price',
                    data: {
                        newLabel,
                        category: state.data.category
                    }
                };
                return;
            }
            else if (state.type === 'awaiting_new_product_price') {
                const newPrice = parseFloat(text);
                if (isNaN(newPrice)) {
                    await ctx.api.sendMessage(chatId, 'Пожалуйста, введите корректную цену', {
                        reply_markup: adminReturnKeyboard
                    });
                    return;
                }
                ;
                const newLabel = state.data.newLabel;
                const category = state.data.category;
                const products = currentProducts(category);
                products.push({ label: newLabel, price: newPrice });
                products.sort((a, b) => {
                    return parseInt(a.label, 10) - parseInt(b.label, 10);
                });
                await updateProducts(chatId, category, products);
                ctx.session.state = undefined;
                return;
            }
            else if (state.type === 'awaiting_stars_price') {
                const newPrice = parseFloat(text);
                if (isNaN(newPrice)) {
                    await ctx.api.sendMessage(chatId, 'Пожалуйста, введите корректную цену', {
                        reply_markup: adminReturnKeyboard
                    });
                    return;
                }
                ;
                await setStarsPrice(newPrice);
                await ctx.api.sendMessage(chatId, 'Цена на звезды обновлена', {
                    reply_markup: toMenuKeyboard
                });
                ctx.session.state = undefined;
                return;
            }
            else if (state.type === 'awaiting_to_change_credentials') {
                const method = state.data.method;
                const newValue = text;
                await setPaymentDetails(method, newValue);
                await ctx.api.sendMessage(chatId, `✅ Реквизиты для ${method} успешно обновлены!`, {
                    reply_markup: toMenuKeyboard
                });
                ctx.session.state = undefined;
                return;
            }
            else if (state.type === 'awaiting_user_to_change_balance') {
                const userId = text;
                await ctx.api.sendMessage(chatId, `Баланс пользователя ${getUserBalance(userId)}. Введите новую сумму для баланса:`, {
                    reply_markup: adminReturnKeyboard
                });
                ctx.session.state = {
                    type: 'awaiting_to_change_balance',
                    data: { userId }
                };
                return;
            }
            else if (state.type === 'awaiting_to_change_balance') {
                const newBalance = parseFloat(text);
                const userId = state.data.userId;
                if (isNaN(newBalance)) {
                    await ctx.api.sendMessage(chatId, 'Пожалуйста, введите корректную сумму.', {
                        reply_markup: adminReturnKeyboard
                    });
                    return;
                }
                ;
                const userBalance = getUserBalance(chatId);
                if (userBalance || userBalance === 0) {
                    await setUserBalance(chatId, newBalance);
                    await ctx.api.sendMessage(chatId, `Баланс пользователя с ID ${userId} был изменен на ${newBalance}₽.`, {
                        reply_markup: toMenuKeyboard
                    });
                }
                else {
                    await ctx.api.sendMessage(chatId, 'Пользователя с таким id нет.', {
                        reply_markup: toMenuKeyboard
                    });
                }
                ;
                ctx.session.state = undefined;
                return;
            }
            else if (state.type === 'awaiting_to_create_mailing') {
                const broadcastMessage = text;
                if (!broadcastMessage) {
                    await ctx.api.sendMessage(chatId, 'Сообщение не может быть пустым.', {
                        reply_markup: adminReturnKeyboard
                    });
                    return;
                }
                ;
                sendBroadcastMessage(ctx, broadcastMessage);
                ctx.session.state = undefined;
                return;
            }
            else if (state.type === 'awaiting_to_add_admin') {
                const newAdminId = text;
                const users = getAllBalances();
                if (!Object.prototype.hasOwnProperty.call(users, newAdminId)) {
                    await ctx.api.sendMessage(chatId, `Пользователь с ID "${newAdminId}" не существует. Пожалуйста, проверьте введенный ID и попробуйте еще раз. Возможно пользователь не зарегистрирован в боте`, {
                        reply_markup: toMenuKeyboard
                    });
                }
                ;
                const admins = getAdmins();
                if (!admins[chatId]) {
                    const newAdmins = { ...admins, [newAdminId]: true };
                    await setAdmins(newAdmins);
                    await ctx.api.sendMessage(chatId, `Пользователь с ID ${newAdminId} добавлен как администратор.`, {
                        reply_markup: toMenuKeyboard
                    });
                    await bot.api.sendMessage(newAdminId, 'Вы были добавлены в качестве администратора.', {
                        reply_markup: toMenuKeyboard
                    });
                }
                else {
                    await ctx.api.sendMessage(chatId, `Пользователь с ID ${newAdminId} уже является администратором.`, {
                        reply_markup: toMenuKeyboard
                    });
                }
                ;
                ctx.session.state = undefined;
                return;
            }
            else if (state.type === 'awaiting_to_remove_admin') {
                const adminIdToRemove = text;
                const admins = getAdmins();
                if (admins[adminIdToRemove]) {
                    if (adminIdToRemove === ADMIN_CHAT_ID) {
                        await ctx.api.sendMessage(chatId, 'Нельзя удалить главного администратора', {
                            reply_markup: toMenuKeyboard
                        });
                    }
                    else {
                        delete admins[adminIdToRemove];
                        await setAdmins(admins);
                        await ctx.api.sendMessage(chatId, `Пользователь с ID ${adminIdToRemove} был удален из списка администраторов.`, {
                            reply_markup: toMenuKeyboard
                        });
                        await bot.api.sendMessage(adminIdToRemove, 'Вы были удалены из списка администраторов.', {
                            reply_markup: toMenuKeyboard
                        });
                    }
                    ;
                }
                ;
                ctx.session.state = undefined;
                return;
            }
            else if (state.type === 'awaiting_codes_for_product') {
                const codes = text.split('\n')
                    .map(code => code.trim())
                    .filter(code => code.length > 0);
                const productLabel = state.data.productLabel;
                const updates = {};
                codes.forEach(code => {
                    const newCodeRef = refs.codes.child(productLabel).push();
                    updates[newCodeRef.key] = {
                        code: code,
                        used: false,
                        addedAt: Date.now()
                    };
                });
                await refs.codes.child(productLabel).update(updates)
                    .then(async () => {
                    await ctx.api.sendMessage(chatId, `✅ Добавлено ${codes.length} кодов для ${productLabel} UC`, {
                        reply_markup: toMenuKeyboard
                    });
                    ctx.session.state = undefined;
                })
                    .catch(async (error) => {
                    await ctx.api.sendMessage(chatId, `❌ Ошибка сохранения кодов: ${error.message}`, {
                        reply_markup: adminReturnKeyboard
                    });
                });
                return;
            }
        }
        // State machine
        if (state) {
            switch (state.type) {
                case 'awaiting_pubg_id':
                    await handlePubgIdInput(ctx, text);
                    break;
                case 'awaiting_stars_amount':
                    let starsAmount = parseInt(text);
                    if (isNaN(starsAmount)) {
                        await ctx.reply('Пожалуйста, введите число');
                        return;
                    }
                    ctx.session.state = {
                        type: 'awaiting_stars_tag',
                        // starsAmount,
                        messageId: ctx.msg.message_id
                    };
                    await ctx.reply(`Пришлите тег аккаунта для получения ${starsAmount}⭐️`);
                    break;
                case 'awaiting_stars_tag':
                    if (!text.startsWith('@')) {
                        await ctx.reply('Тег должен начинаться с @');
                        return;
                    }
                    // starsAmount = state.starsAmount;
                    starsAmount = 1;
                    const total = starsAmount * getStarsPrice();
                    const balance = getUserBalance(chatId);
                    if ((balance || 0) < total) {
                        await ctx.reply('❌ Недостаточно средств! Пополните баланс.', {
                            reply_markup: new InlineKeyboard().text('💳Пополнить баланс', 'deposit')
                        });
                        ctx.session.state = undefined;
                        return;
                    }
                    // Create order
                    const orderNumber = Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);
                    const newBalance = balance - total;
                    await setUserBalance(chatId, newBalance);
                    const orderData = {
                        orderId: orderNumber,
                        userId: chatId,
                        type: 'stars',
                        tag: text,
                        items: [{ label: `${starsAmount}⭐️`, price: total }],
                        total: total,
                        status: 'pending',
                        timestamp: Date.now(),
                        userInfo: {
                            username: `${ctx.chat.first_name || ''} ${ctx.chat.last_name || ''}`.trim(),
                            balanceBefore: balance,
                            balanceAfter: newBalance
                        }
                    };
                    // Save order to Firebase
                    try {
                        await database.ref(`orders/${chatId}/${orderNumber}`).set(orderData);
                    }
                    catch (error) {
                        console.error('Ошибка сохранения заказа:', error);
                        await ctx.reply('❌ Ошибка оформления заказа, попробуйте позже');
                        return;
                    }
                    // Send order to admin group
                    const orderText = `✅Новый заказ 
🧾#${orderNumber} 
🛍Товары : 
${starsAmount}⭐️ 
💵Стоимость : ${total} 
🆔 : ${text} 
🪪Пользователь : ${orderData.userInfo.username} (ID: ${chatId}) .
⚠️Выберите действие ниже`;
                    const orderKeyboard = new InlineKeyboard()
                        .text('✅ Заказ выполнен', `order-completed_${chatId}_${orderNumber}`)
                        .text('❌ Отменить заказ', `order-declined_${chatId}_${orderNumber}_${total}`);
                    sendOrderRequest(orderText, orderKeyboard);
                    await ctx.reply(`Ваш заказ ${starsAmount}⭐️ за ${total}₽ на аккаунт ${text} отправлен администратору. Ожидайте пополнения`, {
                        reply_markup: new InlineKeyboard().text('На главную', 'return')
                    });
                    ctx.session.state = undefined;
                    break;
                // ... (другие состояния)
            }
        }
    }
    catch (error) {
        console.error('Message handling error:', error);
    }
});
// Pre-checkout handler
bot.on('pre_checkout_query', async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
});
// Successful payment handler
// bot.on(':successful_payment', async (ctx) => {
//   const chatId = ctx.chat?.id;
//   if (!chatId) return;
//   // Handle successful payment
//   const payment = ctx.msg.successful_payment;
//   const amount = payment.total_amount / 100;
//   userBalances[chatId] = (userBalances[chatId] || 0) + amount;
//   await database.ref(`userBalances/${chatId}`).set(userBalances[chatId]);
//   await ctx.reply(`✅ Ваш баланс пополнен на ${amount}₽`);
//   await sendMainMessage(ctx);
// });
// Setup webhook
// bot.api.setWebhook(`${URL}/bot${token}`);
// // Start server
// app.use(express.json());
// app.post(`/bot${token}`, webhookCallback(bot, 'express'));
// app.listen(PORT, async () => {
//   await initializeFirebaseData();
//   console.log(`🚀 Bot is running on port ${PORT}`);
// });
const startBot = async () => {
    // Удалите все webhook-настройки если они есть
    // Запускаем бота на polling
    await bot.start({
        onStart: (botInfo) => {
            console.log(`Bot @${botInfo.username} is running on polling!`);
        },
        // Дополнительные опции (необязательно):
        drop_pending_updates: true, // Игнорировать обновления, пока бот был оффлайн
        allowed_updates: ['message', 'callback_query'] // Получать только нужные типы обновлений
    });
};
startBot().catch(console.error);
