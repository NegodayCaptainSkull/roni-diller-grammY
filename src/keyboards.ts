import { InlineKeyboard } from "grammy";
import { Cart, MyContext } from "./types.js";
import { currentProducts, isAdmin } from "./botUtils.js";
import { getCodes, getPaymentDetails, getProductsCodes, refs } from "./globals.js";
import { getCurrentTranslations } from "./locales/manager.js";


export function mainKeyboard (ctx: MyContext, chatId: number): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text(ctx.t("catalog_btn"), 'catalog').row()
    .text(ctx.t("my_orders_btn"), 'my-orders')
    .text(ctx.t("my_profile_btn"), 'my-profile').row()
    .url(ctx.t("channel_btn"), 'https://t.me/diller_roni')
    .url(ctx.t("tech_support_btn"), 'https://t.me/roniferi');
  
  if (isAdmin(chatId)) {
    keyboard.row().text(ctx.t("admin_panel_btn"), 'admin-panel');
  };

  return keyboard;
}

export async function generateShopKeyboard(userId: string | number, cart: Cart | undefined, type: string): Promise<InlineKeyboard> {
  const t = getCurrentTranslations(userId);
  const prods = currentProducts(type);
  const keyboard = new InlineKeyboard();
  
  for (const p of prods) {
    let text = '';
    if (type === 'premium') {
      text = `${p.label} - ${p.price}$`;
      keyboard.text(text, `buy-premium_${p.label}_${p.price}`).row();
    } else {
      const count = cart?.items.filter(item => item.label === p.label).length || 0;
      if (type === 'codes' || type === 'id') {
        try {
          let available = 0
          if (getCodes(p.label)) {
            available = Object.keys(getCodes(p.label)).length;
          }
          text = `${p.label} - ${p.price}$ (${count}/${available})`;
        } catch (error) {
          console.log(error)
          text = `${p.label} - ${p.price}$`;
        }
      } else {
        text = `${p.label} - ${p.price}$`;
      }
      keyboard.text(text, `add-to-cart_${p.label}_${p.price}_${type}`).row();
    }
  }
  
  if (type === 'codes') keyboard.text(t.buy_codes_btn, 'cart_buy-codes').row();
  if (type === 'id') keyboard.text(t.buy_id_btn, 'cart_buy-with-id').row();
  if (type === 'promo') keyboard.text(t.buy_btn, 'cart_buy-promo').row();
  
  if (type === 'id' || type === 'codes') {
    keyboard.text(t.clear_cart_btn, `cart_clear_${type}`).row();
  }
  
  keyboard.text(t.return_btn, 'pubg');
  return keyboard;
}

export function productsManagementKeyboard (userId: string | number, category: string): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const products = currentProducts(category);

  const keyboard = new InlineKeyboard();

  products.forEach(product => {
    keyboard.text(`${product.label} - ${product.price}$`, `edit-product_${category}_${product.label}`).row();
  });

  keyboard
    .text(t.add_product_btn, `add-product_${category}`)
    .text(t.remove_product_btn, `delete-product-list_${category}`).row()
    .text(t.return_btn, 'manage-products')

  return keyboard;
};

export function deleteProductListKeyboard (userId: string | number, category: string): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const products = currentProducts(category);

  const keyboard = new InlineKeyboard();

  products.forEach(product => {
    keyboard.text(`${product.label} - ${product.price}`, `delete-product_${category}_${product.label}`)
  });

  keyboard
    .text(t.cancel_btn, 'admin-panel')

  return keyboard
};

export function manageCodesListKeyboard (userId: string | number, type: string): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard();

  const products = getProductsCodes();

  products.forEach(product => {
    keyboard.text(`${product.label}`, `${type}-codes_${product.label}`).row()
  });

  keyboard.text(t.return_btn, 'admin-panel');

  return keyboard;
};

export function orderRequestKeyboard (userId: string | number, orderNumber: string, price: number): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('✅ Заказ выполнен', `order-completed_${userId}_${orderNumber}`).row()
    .text('❌ Отменить заказ', `order-declined_${userId}_${orderNumber}_${price}`)
  
  return keyboard;
};

export function depositRequestKeyboard (userId: string | number): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('✅ Подтвердить', `confirm_${userId}`)
    .text('❌ Отклонить', `reject_${userId}` )

  return keyboard
}

export function languageKeyboard (userId: string | number, lang: string): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text(lang === 'ru' ? '🇷🇺 Русский ✅' : '🇷🇺 Русский', 'set-lang_ru').row()
    .text(lang === 'en' ? '🇬🇧 English ✅' : '🇬🇧 English', 'set-lang_en').row()
    .text(t.return_btn, 'my-profile')

  return keyboard;
}

export function catalogKeyboard(userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);

  const keyboard = new InlineKeyboard()
    .text('🪂 PUBG', 'pubg').row()
    .text('⭐️ Telegram', 'telegram').row()
    .text(t.return_btn, 'return')
  return keyboard;
};

export function pubgKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text('UC CODE', 'open-shop_codes').row()
    .text('UC ID', 'open-shop_id').row()
    .text(t.promos_btn, 'open-shop_promo').row()
    .text(t.return_btn, 'catalog')

  return keyboard;
};

export function telegramKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text('Stars', 'open-shop_stars').row()
    .text('Premium', 'open-shop_premium').row()
    .text(t.return_btn, 'catalog')
  
  return keyboard;
};

export function adminKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text(t.manage_products_btn, 'manage-products')
    .text(t.edit_payment_details_btn, 'edit-payment-details').row()
    .text(t.manage_balances_btn, 'manage-balances')
    .text(t.send_broadcast_btn, 'send-broadcast').row()
    .text(t.manage_codes_btn, 'manage-codes')
    .text(t.manage_admins_btn, 'manage-admins').row()
    .text(t.return_btn, 'return')

  return keyboard;
};

export function profileKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text(t.deposit_btn, 'deposit').row()
    .text(t.change_language_btn, 'language').row()
    .text(t.catalog_btn, 'catalog').row()
    .text(t.return_btn, 'return')

  return keyboard;
};

export function changeCredentialsKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text('ByBit', 'select-payment-method_ByBit')
    .text('CryptoBot', 'select-payment-method_CryptoBot').row()
    .text(t.cancel_btn, 'admin-panel')

  return keyboard;
};

export function categoryKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text('UC CODES', 'manage-category_codes')
    .text('Stars', 'manage-category_stars')
    .text('Premium', 'manage-category_premium').row()
    .text(t.promos_btn, 'manage-category_promo').row()
    .text(t.return_btn, 'admin-panel').row()
  
  return keyboard;
};

export function starsKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text('Пополнить баланс звезд', 'topup-stars').row()
    .text('Изменить цену', 'change-stars-price').row()
    .text(t.return_btn, 'manage-products')

  return keyboard;
};

export function paymentMethodsKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text('🔸ByBit', 'deposit-with-bybit').row()
    .text('🔹CryptoBot', 'deposit-with-cryptobot').row()
    .text(t.return_btn, 'my-profile')

  return keyboard
};

export function cryptobotKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .url(t.invoice_btn, `${getPaymentDetails().CryptoBot}`).row()
    .text(t.cancel_btn, 'my-profile')

  return keyboard;
};

export function manageAdminsKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text(t.add_btn, 'add-admin')
    .text(t.remove_btn, 'remove-admin').row()
    .text(t.return_btn, 'admin-panel')

  return keyboard;
};

export function manageCodesKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text(t.add_btn, 'add-codes-list')
    .text(t.remove_btn, 'remove-codes-list').row()
    .text(t.return_btn, 'admin-panel')

  return keyboard;
};

export function depositKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text(t.deposit_btn, 'deposit')

  return keyboard;
};

export function returnKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text(t.return_btn, 'return')

  return keyboard;
};

export function cancelKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text(t.cancel_btn, 'return')

  return keyboard;
};

export function adminReturnKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text(t.return_btn, 'admin-panel')

  return keyboard;
};

export function toMenuKeyboard (userId: string | number): InlineKeyboard {
  const t = getCurrentTranslations(userId);
  const keyboard = new InlineKeyboard()
    .text(t.to_menu_btn, 'main-message')

  return keyboard;
};