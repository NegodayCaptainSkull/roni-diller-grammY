import { GrammyError, InlineKeyboard } from "grammy";
import { DEPOSIT_GROUP_ID, getAdmins, getProductsPremium, getProductsCodes, getProductsId, ORDERS_GROUP_ID, getProductsPromo, setProductsCodes, setProductsId, setProductsPremium, setProductsPromo, getUserBalance, deleteUserBalance, database, CRYPTOBOT_ID, getCryptobotDeposits, setUserBalance, deleteCryptobotDeposits, refs, getAllBalances } from "./globals.js";
import { generateShopKeyboard, mainKeyboard, toMenuKeyboard } from "./keyboards.js";
import { bot } from "./index.js";
export function isAdmin(chatId) {
    return getAdmins()[chatId.toString()] === true;
}
;
export function safeRound(num) {
    const stringNum = num.toFixed(10);
    const match = stringNum.match(/\.(\d{2})(9{4,})/);
    return match ? Number(stringNum.slice(0, match.index + 3)) : num;
}
;
export function getUserTag(ctx) {
    const username = ctx.chat?.username ? `@${ctx.chat.username}` : `${ctx.chat?.first_name || 'User'}`;
    return username;
}
export async function sendToGroup(groupId, message, inlineKeyboard) {
    try {
        await bot.api.sendMessage(groupId, message, {
            parse_mode: 'HTML',
            reply_markup: inlineKeyboard
        });
    }
    catch (error) {
        console.error('Error sending to group:', error);
    }
}
;
export async function sendDepositRequest(message, inlineKeyboard) {
    await sendToGroup(DEPOSIT_GROUP_ID, message, inlineKeyboard);
}
;
export async function sendOrderRequest(message, inlineKeyboard) {
    await sendToGroup(ORDERS_GROUP_ID, message, inlineKeyboard);
}
;
export function currentProducts(category) {
    switch (category) {
        case 'codes': return getProductsCodes();
        case 'id': return getProductsId();
        case 'premium': return getProductsPremium();
        case 'promo': return getProductsPromo();
        default: return [];
    }
}
;
export async function updateProducts(chatId, category, products) {
    try {
        const prods = products || currentProducts(category);
        switch (category) {
            case 'codes':
                await setProductsCodes(prods);
                break;
            case 'id':
                await setProductsId(prods);
                break;
            case 'premium':
                await setProductsPremium(prods);
                break;
            case 'promo':
                await setProductsPromo(prods);
                break;
        }
        await bot.api.sendMessage(chatId, `Товары обновлены.`, {
            reply_markup: new InlineKeyboard().text('🔙 В главное меню', 'return')
        });
    }
    catch (error) {
        console.error('Firebase error:', error);
        await bot.api.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.');
    }
}
function generateCartText(cart, type) {
    if (type === 'premium') {
        return `<b>➤ Выберите длительность Premium</b>`;
    }
    if (!cart || cart.items.length === 0) {
        return `<b>➤ Выберите UC для покупки (можно несколько)\n🛒 Ваша корзина пуста</b>`;
    }
    const itemsCount = {};
    for (const item of cart.items) {
        itemsCount[item.label] = (itemsCount[item.label] || 0) + 1;
    }
    const itemsText = Object.entries(itemsCount)
        .map(([label, count]) => {
        const product = currentProducts(type).find(p => p.label === label);
        return `<b>➥ ${label} UC × ${count} = ${Math.round(count * product.price * 100) / 100}₽</b>`;
    })
        .join('\n');
    return `<b>➤ Выберите UC для покупки (можно несколько)\n🛒 Ваша корзина:\n\n${itemsText}\n\n✦ Итого: <u>${cart.total}₽</u></b>`;
}
;
export async function updateCartMessage(ctx, type) {
    const chatId = ctx.chat?.id;
    if (!chatId)
        return;
    const messageId = ctx.msg?.message_id;
    const cart = ctx.session.cart;
    const caption = generateCartText(cart, type);
    const keyboard = await generateShopKeyboard(cart, type);
    try {
        if (messageId) {
            await ctx.api.editMessageCaption(chatId, messageId, {
                caption: caption,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        }
        else {
            const sentMessage = await ctx.api.sendPhoto(chatId, 'https://ibb.co/wF0vRw5J', {
                caption: caption,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
            // ctx.session.state = { ...ctx.session.state, messageId: sentMessage.message_id };
        }
    }
    catch (error) {
        console.error('Error updating cart message:', error);
        await ctx.api.sendMessage(chatId, caption, {
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    }
}
;
export async function sendMainMessage(ctx, messageId) {
    const chatId = ctx.chat?.id;
    if (!chatId)
        return;
    const firstName = ctx.chat.first_name || '';
    const lastName = ctx.chat.last_name || '';
    const greetingName = lastName ? `${firstName} ${lastName}` : firstName;
    const keyboard = mainKeyboard(chatId);
    const caption = `🙋‍♂ Добрый день, ${greetingName}!\n💰 Ваш текущий баланс - ${getUserBalance(chatId) || 0}₽.`;
    try {
        if (messageId) {
            await ctx.api.editMessageMedia(chatId, messageId, {
                type: 'photo',
                media: 'https://ibb.co/8LVZ1Qcd',
                caption: caption,
                parse_mode: 'HTML'
            }, {
                reply_markup: keyboard
            });
        }
        else {
            await ctx.api.sendPhoto(chatId, 'https://ibb.co/8LVZ1Qcd', {
                caption: caption,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        }
    }
    catch (error) {
        if (error.description.includes('403')) {
            console.log(`User ${chatId} blocked the bot. Removing...`);
            await deleteUserBalance(chatId.toString());
        }
        else {
            console.error('Error sending main message:', error);
        }
    }
}
;
export async function processCryptoBotMessage(ctx) {
    if (!ctx.msg?.text || !ctx.chat || ctx.chat.id.toString() !== DEPOSIT_GROUP_ID || ctx.msg.from?.id.toString() !== CRYPTOBOT_ID) {
        return;
    }
    const messageText = ctx.msg.text;
    const lines = messageText.split(' ');
    const senderIndex = lines.findIndex(line => line === 'отправил(а)');
    if (senderIndex === -1 || senderIndex + 2 >= lines.length || lines[senderIndex + 1] !== '🪙') {
        await ctx.api.sendMessage(DEPOSIT_GROUP_ID, '❌ Ошибка парсинга данных перевода');
        return;
    }
    const paymentData = {
        username: lines.slice(0, senderIndex).join(' ').trim(),
        amount: parseFloat(lines[senderIndex + 2].replace(',', '.')),
        currency: 'USDT'
    };
    const [userId, deposit] = Object.entries(getCryptobotDeposits()).find(([_, d]) => d.username === paymentData.username) || [];
    if (userId && deposit) {
        const cleanedAmount = safeRound(paymentData.amount);
        const newBalance = (getUserBalance(userId) || 0) + cleanedAmount;
        await setUserBalance(userId, newBalance);
        await deleteCryptobotDeposits(userId);
        await ctx.api.sendMessage(DEPOSIT_GROUP_ID, `✅ Перевод ${cleanedAmount} ${paymentData.currency} подтвержден\nID: ${userId}\nНовый баланс: ${newBalance}`, { reply_to_message_id: ctx.msg.message_id });
        await ctx.api.sendMessage(parseInt(userId), `💳 Ваш баланс пополнен на ${cleanedAmount}₽\nТекущий баланс: ${newBalance}₽`, {
            reply_markup: new InlineKeyboard().text('🛒 Открыть магазин', 'open-shop')
        });
        if (deposit.messageId) {
            try {
                await ctx.api.deleteMessage(parseInt(userId), deposit.messageId);
            }
            catch (deleteError) {
                console.error('Error deleting message:', deleteError);
            }
        }
    }
    else {
        await ctx.api.sendMessage(DEPOSIT_GROUP_ID, `⚠️ Не найден заказ для перевода\nPayment ID: ${paymentData.username}\nСумма: ${paymentData.amount} ${paymentData.currency}`, { reply_to_message_id: ctx.msg.message_id });
    }
}
;
export async function purchaseWithId(ctx) {
    const chatId = ctx.chat.id;
    const cart = ctx.session.cart;
    if (!cart || cart.items.length === 0) {
        // await bot.answerCallbackQuery(query.id, { text: '❌ Корзина пуста!' });
        return;
    }
    if (getUserBalance(chatId) < cart.total) {
        // await bot.answerCallbackQuery(query.id, { text: '❌ Недостаточно средств!' });
        await ctx.api.sendMessage(chatId, '❌ Недостаточно средств! Пополните свой баланс.', {
            reply_markup: new InlineKeyboard()
                .text('💳 Пополнить баланс', 'deposit')
        });
        return;
    }
    if (ctx.session.state) {
        ctx.session.state.type = 'awaiting_pubg_id';
    }
    ctx.editMessageCaption({
        caption: '✦ Отправьте игровой ID для зачисления товара!',
        reply_markup: new InlineKeyboard()
            .text('🔙 В меню', 'return')
    });
}
;
export async function purchaseCodes(ctx) {
    const chatId = ctx.chat.id;
    const messageId = ctx.message.message_id;
    const firstName = ctx.chat?.first_name || '';
    const lastName = ctx.chat?.last_name || '';
    const cart = ctx.session.cart;
    if (!cart || cart.items.length === 0) {
        await ctx.answerCallbackQuery({ text: '❌ Корзина пуста!' });
        return;
    }
    const balance = getUserBalance(chatId);
    // Проверка баланса
    if (balance < cart.total) {
        await ctx.api.sendMessage(chatId, '❌ Недостаточно средств! Пополните баланс.', {
            reply_markup: new InlineKeyboard()
                .text('💳 Пополнить баланс', 'deposit')
        });
        return;
    }
    // Проверка наличия кодов
    const requiredCodes = cart.items.reduce((acc, item) => {
        acc[item.label] = (acc[item.label] || 0) + 1;
        return acc;
    }, {});
    const codeCheckPromises = Object.keys(requiredCodes).map(async (label) => {
        const snapshot = await refs.codes.child(label)
            .orderByChild('used')
            .equalTo(false)
            .once('value');
        return snapshot.numChildren() >= requiredCodes[label];
    });
    const results = await Promise.all(codeCheckPromises);
    if (results.some(available => !available)) {
        await ctx.api.sendMessage(chatId, '❌ Недостаточно кодов для выполнения заказа');
        return;
    }
    // Резервирование кодов
    const codesToSend = {};
    for (const label of Object.keys(requiredCodes)) {
        const snapshot = await refs.codes.child(label)
            .orderByChild('used')
            .equalTo(false)
            .limitToFirst(requiredCodes[label])
            .once('value');
        const codes = snapshot.val();
        codesToSend[label] = Object.keys(codes).map(key => codes[key].code);
        // Пометить коды как использованные
        const updates = {};
        Object.keys(codes).forEach(key => {
            updates[`codes/${label}/${key}/used`] = true;
        });
        await database.ref().update(updates);
    }
    // Списание средств
    const newBalance = balance - cart.total;
    await setUserBalance(chatId, newBalance);
    // Сохранение заказа
    const orderNumber = Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);
    const orderData = {
        orderId: orderNumber,
        userId: chatId,
        type: 'codes',
        codes: codesToSend,
        items: cart.items,
        total: cart.total,
        status: 'confirmed',
        timestamp: Date.now(),
        userInfo: {
            username: `${firstName} ${lastName}`,
            balanceBefore: balance,
            balanceAfter: newBalance
        }
    };
    try {
        await refs.orders.child(`${chatId}`).child(orderNumber).set(orderData);
    }
    catch (error) {
        console.error('Ошибка сохранения заказа:', error);
        await ctx.api.sendMessage(chatId, '❌ Ошибка оформления заказа, попробуйте позже');
        return;
    }
    let codesMessage = '';
    for (const [label, codes] of Object.entries(codesToSend)) {
        const formattedCodes = codes.map(code => `<code>${code}</code>`).join('\n');
        codesMessage += `➥ ${label} UC:\n${formattedCodes}\n\n`;
    }
    // Отправка кодов пользователю
    let message = '✅ Ваши коды:\n\n' + codesMessage;
    // Очистка корзины
    delete ctx.session.cart;
    await ctx.api.sendMessage(chatId, message, {
        parse_mode: 'HTML'
    });
    sendMainMessage(ctx);
    await ctx.api.deleteMessage(chatId, messageId);
    // Уведомление админам
    sendOrderRequest(`✅ Новый заказ кодами #${orderNumber}\n` +
        `Пользователь: ${firstName} ${lastName} (ID: ${chatId})\n` +
        `Коды:\n\n` + codesMessage +
        `Сумма: ${cart.total}₽`);
}
;
export async function purchasePremium(ctx, label, price) {
    const chatId = ctx.chat.id;
    if (getUserBalance(chatId) < price) {
        // await bot.answerCallbackQuery(query.id, { text: '❌ Недостаточно средств!' });
        await ctx.api.sendMessage(chatId, '❌ Недостаточно средств! Пополните свой баланс.', {
            reply_markup: new InlineKeyboard()
                .text('💳 Пополнить баланс', 'deposit')
        });
        return;
    }
    ctx.session.state = {
        type: 'awaiting_premium_tag',
        data: { label, price }
    };
    await ctx.editMessageCaption({
        caption: `✦ Отправьте тег аккаунта на который хотите получить Telegram Premium (${label})`,
        reply_markup: new InlineKeyboard()
            .text('🔙 В меню', 'return')
    });
}
;
export async function handlePubgIdInput(ctx, text) {
    const chatId = ctx.chat?.id;
    if (!chatId)
        return;
    const cart = ctx.session.cart;
    if (!cart || cart.items.length === 0) {
        await ctx.reply('❌ Корзина пуста!');
        return;
    }
    const pubgId = text;
    const orderNumber = Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);
    // Format order items
    const itemsDetails = {};
    for (const item of cart.items) {
        itemsDetails[item.label] = (itemsDetails[item.label] || 0) + 1;
    }
    const itemsText = Object.entries(itemsDetails)
        .map(([label, count]) => {
        const product = currentProducts('id').find(p => p.label === label);
        return `➥ ${label} UC ×${count} = ${(product.price * count)}₽`;
    })
        .join('\n');
    // Deduct balance
    const balance = getUserBalance(chatId);
    const newBalance = balance - cart.total;
    await setUserBalance(chatId, newBalance);
    // Create order data
    const orderData = {
        orderId: orderNumber,
        userId: chatId,
        type: 'id',
        pubgId: pubgId,
        items: cart.items,
        total: cart.total,
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
        await refs.orders.child(chatId.toString()).child(orderNumber).set(orderData);
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
${itemsText} 
💵Стоимость : ${cart.total} 
🆔 : ${pubgId} 
🪪Пользователь : ${orderData.userInfo.username} (ID: ${chatId}) .
⚠️Выберите действие ниже`;
    const orderKeyboard = new InlineKeyboard()
        .text('✅ Заказ выполнен', `order-completed_${chatId}_${orderNumber}`)
        .text('❌ Отменить заказ', `order-declined_${chatId}_${orderNumber}_${cart.total}`);
    sendOrderRequest(orderText, orderKeyboard);
    // Clear cart and state
    ctx.session.cart = undefined;
    ctx.session.state = undefined;
    await ctx.reply('✅ ID успешно отправлен, ожидайте подтверждение администратора', {
        reply_markup: new InlineKeyboard().text('🔙 В меню', 'return')
    });
}
;
export async function sendUnusedCodes(ctx, productLabel) {
    try {
        const unusedCodesSnapshot = await refs.codes.child(productLabel)
            .orderByChild('used')
            .equalTo(false)
            .once('value');
        const unusedCodes = unusedCodesSnapshot.val() || {};
        // Форматируем список неиспользованных кодов
        let unusedCodesMessage = `📋 Текущие неиспользованные коды для ${productLabel} UC:\n`;
        Object.values(unusedCodes).forEach((codeData, index) => {
            unusedCodesMessage += `${index + 1}. <code>${codeData.code}</code>\n`;
        });
        if (ctx.chat) {
            await ctx.api.sendMessage(ctx.chat.id, unusedCodesMessage, {
                parse_mode: 'HTML'
            });
        }
        ;
    }
    catch (error) {
        console.error('Ошибка получения кодов:', error);
        if (ctx.chat) {
            await ctx.api.sendMessage(ctx.chat.id, '❌ Ошибка при получении неиспользованных кодов');
        }
        ;
    }
}
;
export async function sendBroadcastMessage(ctx, broadcastMessage) {
    const userBalances = getAllBalances();
    const chatId = ctx.chat?.id;
    if (!chatId)
        return;
    if (!userBalances) {
        await ctx.api.sendMessage(chatId, 'Нет пользователей для рассылки.');
        return;
    }
    ;
    const userIds = Object.keys(userBalances);
    for (const userId of userIds) {
        try {
            await bot.api.sendMessage(userId, broadcastMessage);
        }
        catch (error) {
            if (error instanceof GrammyError) {
                // Обработка ошибок Telegram API
                if (error.error_code === 429) { // Too Many Requests
                    const retryAfter = error.parameters?.retry_after || 1;
                    console.log(`Rate limit exceeded, retrying after ${retryAfter} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    continue; // Попробовать снова после задержки
                }
                ;
                console.error(`Telegram API error for user ${userId}:`, error.description);
            }
            ;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    await ctx.api.sendMessage(chatId, `Сообщение успешно отправлено ${userIds.length} пользователям.`, {
        reply_markup: toMenuKeyboard
    });
}
