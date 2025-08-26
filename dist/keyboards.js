import { InlineKeyboard } from "grammy";
import { currentProducts, isAdmin } from "./botUtils.js";
import { getPaymentDetails, getProductsCodes, refs } from "./globals.js";
export function mainKeyboard(chatId) {
    const keyboard = new InlineKeyboard()
        .text('🛒Каталог', 'catalog').row()
        .text('📦Мои заказы', 'my-orders')
        .text('👤Мой профиль', 'my-profile').row()
        .url('🔗Наш канал', 'https://t.me/diller_roni')
        .url('⚙️Тех.поддержка', 'https://t.me/roniferi');
    if (isAdmin(chatId)) {
        keyboard.row().text('👑 Админ-панель', 'admin-panel');
    }
    ;
    return keyboard;
}
export async function generateShopKeyboard(cart, type) {
    const prods = currentProducts(type);
    const keyboard = new InlineKeyboard();
    for (const p of prods) {
        let text = '';
        if (type === 'premium') {
            text = `${p.label} - ${p.price}₽`;
            keyboard.text(text, `buy-premium_${p.label}_${p.price}`).row();
        }
        else {
            const count = cart?.items.filter(item => item.label === p.label).length || 0;
            if (type === 'codes') {
                try {
                    const codesSnapshot = await refs.codes.child(p.label).orderByChild('used').equalTo(false).once('value');
                    const available = codesSnapshot.numChildren();
                    text = `${p.label} - ${p.price}₽ (${count}/${available})`;
                }
                catch (error) {
                    text = `${p.label} - ${p.price}₽`;
                }
            }
            else {
                text = `${p.label} - ${p.price}₽`;
            }
            keyboard.text(text, `add-to-cart_${p.label}_${p.price}_${type}`).row();
        }
    }
    if (type === 'codes')
        keyboard.text('🛒 Купить кодами', 'cart_buy-codes').row();
    if (type === 'id')
        keyboard.text('🛒 Купить по ID', 'cart_buy-with-id').row();
    if (type === 'promo')
        keyboard.text('🛒 Купить', 'cart_buy-promo').row();
    if (type === 'id' || type === 'codes') {
        keyboard.text('🗑 Очистить корзину', `cart_clear_${type}`).row();
    }
    keyboard.text('🔙 В главное меню', 'return');
    return keyboard;
}
export function productsManagementKeyboard(category) {
    const products = currentProducts(category);
    const keyboard = new InlineKeyboard();
    products.forEach(product => {
        keyboard.text(`${product.label} - ${product.price}₽`, `edit-product_${category}_${product.label}`).row();
    });
    keyboard
        .text('➕ Добавить товар', `add-product_${category}`)
        .text('➖ Удалить товар', `delete-product-list_${category}`).row()
        .text('🔙 Назад', 'manage-products');
    return keyboard;
}
;
export function deleteProductListKeyboard(category) {
    const products = currentProducts(category);
    const keyboard = new InlineKeyboard();
    products.forEach(product => {
        keyboard.text(`${product.label} - ${product.price}`, `delete-product_${category}_${product.label}`);
    });
    keyboard
        .text('❌ Отмена', 'admin-panel');
    return keyboard;
}
;
export function manageCodesListKeyboard(type) {
    const keyboard = new InlineKeyboard();
    const products = getProductsCodes();
    products.forEach(product => {
        keyboard.text(`${product.label}`, `${type}-codes_${product.label}`);
    });
    keyboard.text('🔙 Назад', 'admin-panel');
    return keyboard;
}
;
export function orderRequestKeyboard(userId, orderNumber, price) {
    const keyboard = new InlineKeyboard()
        .text('✅ Заказ выполнен', `order-completed_${userId}_${orderNumber}`).row()
        .text('❌ Отменить заказ', `order-declined_${userId}_${orderNumber}_${price}`);
    return keyboard;
}
;
export function depositRequestKeyboard(userId) {
    const keyboard = new InlineKeyboard()
        .text('✅ Подтвердить', `confirm_${userId}`)
        .text('❌ Отклонить', `reject_${userId}`);
    return keyboard;
}
export const catalogKeyboard = new InlineKeyboard()
    .text('🪂 PUBG', 'pubg').row()
    .text('⭐️ Telegram', 'telegram').row()
    .text('🔙 Назад', 'return');
export const pubgKeyboard = new InlineKeyboard()
    .text('UC CODE', 'open-shop_codes').row()
    .text('UC ID', 'open-shop_id').row()
    .text('Акции', 'open-shop_promo').row()
    .text('🔙 Назад', 'catalog');
export const telegramKeyboard = new InlineKeyboard()
    .text('Stars', 'open-shop_stars').row()
    .text('Premium', 'open-shop_premium').row()
    .text('🔙 Назад', 'catalog');
export const adminKeyboard = new InlineKeyboard()
    .text('🛠 Товары', 'manage-products')
    .text('💳 Реквизиты', 'edit-payment-details').row()
    .text('📊 Балансы', 'manage-balances')
    .text('📢 Рассылка', 'send-broadcast').row()
    .text('➕ Коды UC', 'manage-codes')
    .text('👥 Админы', 'manage-admins').row()
    .text('🔙 На главную', 'return');
export const profileKeyboard = new InlineKeyboard()
    .text('💳 Пополнить баланс', 'deposit').row()
    .text('🛍️ Каталог', 'open-shop').row()
    .text('🔙 Назад', 'return');
export const changeCredentialsKeyboard = new InlineKeyboard()
    .text('ByBit', 'select-payment-method_ByBit')
    .text('CryptoBot', 'select-payment-method_CryptoBot').row()
    .text('❌ Отмена', 'admin-panel');
export const categoryKeyboard = new InlineKeyboard()
    .text('UC по кодам', 'manage-category_codes')
    .text('UC по ID', 'manage-category_id').row()
    .text('Stars', 'manage-category_stars')
    .text('Premium', 'manage-category_premium').row()
    .text('Акции', 'manage-category_promo').row()
    .text('🔙 Назад', 'admin-panel').row();
export const starsKeyboard = new InlineKeyboard()
    .text('Пополнить баланс звезд', 'topup-stars').row()
    .text('Изменить цену', 'change-stars-price').row()
    .text('🔙 Назад', 'manage-products');
export const paymentMethodsKeyboard = new InlineKeyboard()
    .text('🔸ByBit', 'deposit-with-bybit').row()
    .text('🔹CryptoBot', 'deposit-with-cryptobot').row()
    .text('❌ Отмена', 'my-profile');
export const cryptobotKeyboard = new InlineKeyboard()
    .url('➡️ Счет для оплаты', getPaymentDetails().CryptoBot).row()
    .text('❌ Отмена', 'my-profile');
export const manageAdminsKeyboard = new InlineKeyboard()
    .text('➕ Добавить', 'add-admin')
    .text('➖ Удалить', 'remove-admin').row()
    .text('🔙 Назад', 'admin-panel');
export const manageCodesKeyboard = new InlineKeyboard()
    .text('➕ Добавить', 'add-codes-list')
    .text('➖ Удалить', 'remove-codes-list').row()
    .text('🔙 Назад', 'admin-panel');
export const depositKeyboard = new InlineKeyboard()
    .text('💳 Пополнить баланс', 'deposit');
export const returnKeyboard = new InlineKeyboard()
    .text('🔙 Назад', 'return');
export const cancelKeyboard = new InlineKeyboard()
    .text('❌ Отмена', 'admin-panel');
export const adminReturnKeyboard = new InlineKeyboard()
    .text('🔙 Назад', 'admin-panel');
export const toMenuKeyboard = new InlineKeyboard()
    .text('🏚 Главное меню', 'main-message');
