import { GrammyError, InlineKeyboard } from "grammy";
import { DEPOSIT_GROUP_ID, getAdmins, getProductsPremium, getProductsCodes, ORDERS_GROUP_ID, getProductsPromo, setProductsCodes, setProductsPremium, setProductsPromo, getUserBalance, deleteUser, database, CRYPTOBOT_ID, getCryptobotDeposits, setUserBalance, deleteCryptobotDeposits, refs, getAllUsers,  getCodes, deleteCodes, activatorApi, fragmentApi, BYBIT_SECRET, BYBIT_API_KEY, getPaymentDetails, BYBIT_API_URL } from "./globals.js";
import { Cart, MyContext, Order, Product, Code } from "./types.js";
import { cancelKeyboard, generateShopKeyboard, mainKeyboard, returnKeyboard, toMenuKeyboard } from "./keyboards.js";
import { bot } from "./index.js";
import { getCurrentTranslations } from "./locales/manager.js";
import * as crypto from "crypto"
import axios from "axios";

export function isAdmin(chatId: number): boolean {
  return getAdmins()[chatId.toString()] === true;
};

export function safeRound(num: number): number {
  const stringNum = num.toFixed(10);
  const match = stringNum.match(/\.(\d{2})(9{4,})/);
  return match ? Number(stringNum.slice(0, match.index! + 3)) : num;
};

export function getUserTag(ctx: MyContext): string {
  const username = ctx.chat?.username ? `@${ctx.chat.username}` : `${ctx.chat?.first_name || ctx.t('user')}`;
  return username;
};

export function setDefaultUserState (ctx: MyContext) {
  ctx.session.cart = {items: [], total: 0};
  ctx.session.state = {type: 'default'}
};

export async function sendToGroup(groupId: string, message: string, inlineKeyboard?: InlineKeyboard): Promise<void> {
  try {
    await bot.api.sendMessage(groupId, message, {
      parse_mode: 'HTML',
      reply_markup: inlineKeyboard
    });
  } catch (error) {
    console.error('Error sending to group:', error);
  }
};

export async function sendDepositRequest(message: string, inlineKeyboard?: InlineKeyboard): Promise<void> {
  await sendToGroup(DEPOSIT_GROUP_ID, message, inlineKeyboard);
};

export async function sendOrderRequest(message: string, inlineKeyboard?: InlineKeyboard): Promise<void> {
  await sendToGroup(ORDERS_GROUP_ID, message, inlineKeyboard);
};

export function currentProducts(category: string): Product[] {
  switch(category) {
    case 'codes': return getProductsCodes();
    case 'id': return getProductsCodes();
    case 'premium': return getProductsPremium();
    case 'promo': return getProductsPromo();
    default: return [];
  }
};

export async function updateProducts(chatId: number, category: string, products?: Product[]): Promise<void> {
  const t = getCurrentTranslations(chatId);
  try {
    const prods = products || currentProducts(category);
    
    switch(category) {
      case 'codes': 
        await setProductsCodes(prods);
        break;
      case 'premium':
        await setProductsPremium(prods);
        break;
      case 'promo':
        await setProductsPromo(prods);
        break;
    }
    
    await bot.api.sendMessage(chatId, t.products_updated, {
      reply_markup: returnKeyboard(chatId)
    });
  } catch (error) {
    console.error('Firebase error:', error);
    await bot.api.sendMessage(chatId, t.firebase_error);
  }
}

function generateCartText(userId: string | number, cart: Cart | undefined, type: string): string {
  const t = getCurrentTranslations(userId);
  if (type === 'premium') {
    return t.premium_select;
  }
  
  if (!cart || cart.items.length === 0) {
    return t.cart_header + '\n' + t.cart_empty;
  }
  
  const itemsCount: Record<string, number> = {};
  for (const item of cart.items) {
    itemsCount[item.label] = (itemsCount[item.label] || 0) + 1;
  }
  
  const itemsText = Object.entries(itemsCount)
    .map(([label, count]) => {
      const product = currentProducts(type).find(p => p.label === label);
      return t.cart_item
        .replace('{label}', label)
        .replace('{count}', count.toString())
        .replace('{price}', (Math.round(count * product!.price * 100) / 100).toString());
    })
    .join('\n');
  
  return t.cart_header + '\n' + t.cart + '\n\n' + itemsText + '\n\n' + t.cart_total.replace('{total}', cart.total.toString());
};

export async function updateCartMessage(ctx: MyContext, type: string): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  
  const messageId = ctx.msg?.message_id;
  const cart = ctx.session.cart;
  const caption = generateCartText(chatId, cart, type);
  const keyboard = await generateShopKeyboard(chatId, cart, type);
  
  try {
    if (messageId) {
      await ctx.api.editMessageCaption(chatId, messageId, {
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } else {
      await ctx.api.sendPhoto(chatId, 'https://ibb.co/wF0vRw5J', {
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    }
  } catch (error) {
    console.error(ctx.t('cart_error'), error);
    await ctx.api.sendMessage(chatId, caption, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }
};

export async function sendMainMessage(ctx: MyContext, messageId?: number): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  
  const firstName = ctx.chat.first_name || '';
  const lastName = ctx.chat.last_name || '';
  const greetingName = lastName ? `${firstName} ${lastName}` : firstName;
  const keyboard = mainKeyboard(ctx, chatId);
  
  const caption = ctx.t("welcome", {name: greetingName, balance: getUserBalance(chatId) || 0})
  
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
    } else {
      await ctx.api.sendPhoto(chatId, 'https://ibb.co/8LVZ1Qcd', {
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    }
  } catch (error: any) {
    if (error.description.includes('403')) {
      console.log(ctx.t('blocked_user', { userId: chatId }));
      await deleteUser(chatId.toString());
    } else {
      console.error(ctx.t('order_error'), error);
    }
  }
};

export async function processCryptoBotMessage(ctx: MyContext): Promise<void> {
  if (!ctx.msg?.text || !ctx.chat || ctx.chat.id.toString() !== DEPOSIT_GROUP_ID || ctx.msg.from?.id.toString() !== CRYPTOBOT_ID) {
    return;
  }
  
  const messageText = ctx.msg.text;
  const lines = messageText.split(' ');
  const senderIndex = lines.findIndex(line => line === 'отправил(а)');

  if (senderIndex === -1 || senderIndex + 2 >= lines.length || lines[senderIndex + 1] !== '🪙') {
    await ctx.api.sendMessage(DEPOSIT_GROUP_ID, ctx.t('parse_error'));
    return;
  }
  
  const paymentData = {
    username: lines.slice(0, senderIndex).join(' ').trim(),
    amount: parseFloat(lines[senderIndex + 2].replace(',', '.')),
    currency: 'USDT'
  };
  
  const [userId, deposit] = Object.entries(getCryptobotDeposits()).find(([_, d]) => 
    d.username === paymentData.username
  ) || [];
  
  if (userId && deposit) {
    const cleanedAmount = safeRound(paymentData.amount);
    const newBalance = (getUserBalance(userId) || 0) + cleanedAmount;
    await setUserBalance(userId, newBalance);
    await deleteCryptobotDeposits(userId);
    
    await ctx.api.sendMessage(
      DEPOSIT_GROUP_ID,
      ctx.t('payment_confirmed', {
        amount: cleanedAmount,
        currency: paymentData.currency,
        userId,
        balance: newBalance
      }),
      { reply_to_message_id: ctx.msg.message_id }
    );
    
    await ctx.api.sendMessage(parseInt(userId), ctx.t('balance_updated', {
      amount: cleanedAmount,
      balance: newBalance
    }), {
      reply_markup: new InlineKeyboard().text(ctx.t('catalog_btn'), 'catalog')
    });
    
    if (deposit.messageId) {
      try {
        await ctx.api.deleteMessage(parseInt(userId), deposit.messageId);
      } catch (deleteError) {
        console.error(ctx.t('order_error'), deleteError);
      }
    }
  } else {
    await ctx.api.sendMessage(
      DEPOSIT_GROUP_ID,
      ctx.t('payment_not_found', {
        paymentId: paymentData.username,
        amount: paymentData.amount,
        currency: paymentData.currency
      }),
      { reply_to_message_id: ctx.msg.message_id }
    );
  }
};

export async function purchaseWithId(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const cart = ctx.session.cart;
  
  if (!cart || cart.items.length === 0) {
    return;
  }
  
  if (getUserBalance(chatId) < cart.total) {
    await ctx.api.sendMessage(chatId, ctx.t('insufficient_funds'), {
      reply_markup: new InlineKeyboard()
        .text(ctx.t('deposit_btn'), 'deposit')
    })
    return;
  }

  if (ctx.session.state) {
    ctx.session.state.type = 'awaiting_pubg_id'
  }

  ctx.editMessageCaption({
    caption: ctx.t('enter_pubg_id'),
    reply_markup: new InlineKeyboard()
      .text(ctx.t('return_btn'), 'return')
  });
};

export async function purchaseCodes(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const messageId = ctx.msg!.message_id;
  const firstName = ctx.chat?.first_name || '';
  const lastName = ctx.chat?.last_name || '';
  console.log("here1")
  const cart = ctx.session.cart;
  console.log(cart)
  if (!cart || cart.items.length === 0) {
    await ctx.answerCallbackQuery({text: ctx.t('cart_empty')});
    return;
  }

  const balance = getUserBalance(chatId)

  if (balance < cart.total) {
    await ctx.api.sendMessage(chatId, ctx.t('insufficient_funds'), {
      reply_markup: new InlineKeyboard()
        .text(ctx.t('deposit_btn'), 'deposit')
    });
    return;
  }

  const codesToSend = await getCodesToActivate(ctx);

  if (codesToSend === undefined) {
    return;
  };

  const newBalance = balance - cart.total;
  await setUserBalance(chatId, newBalance);

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
  } catch (error) {
    console.error(ctx.t('order_error'), error);
    await ctx.api.sendMessage(chatId, ctx.t('order_error'));
    return;
  }

  let codesMessage = '';
  for (const [label, codes] of Object.entries(codesToSend)) {
    const formattedCodes = codes.map(code => `<code>${code}</code>`).join('\n');
    codesMessage += `➥ ${label} UC:\n${formattedCodes}\n\n`;
  }

  let message = ctx.t('order_confirmed') + '\n\n' + codesMessage;

  delete ctx.session.cart
  
  await ctx.api.sendMessage(chatId, message, {
    parse_mode: 'HTML',
    reply_markup: toMenuKeyboard(chatId)
  });

  await ctx.api.deleteMessage(chatId, messageId)

  const orderText = ctx.t('new_order', { orderNumber }) + '\n' +
    ctx.t('user') + ': ' + `${firstName} ${lastName} (ID: ${chatId})\n` +
    ctx.t('codes') + ':\n\n' + codesMessage + 
    ctx.t('total') + ': ' + `${cart.total}$`;

  sendOrderRequest(orderText);
};

export async function purchasePremium(ctx: MyContext, label: string, price: number): Promise<void> {
  const chatId = ctx.chat!.id;
  if (getUserBalance(chatId) < price) {
    await ctx.api.sendMessage(chatId, ctx.t('insufficient_funds'), {
      reply_markup: new InlineKeyboard()
        .text(ctx.t('deposit_btn'), 'deposit')
    });
    return;
  }

  ctx.session.state = {
    type: 'awaiting_premium_tag',
    data: {label, price}
  }

  await ctx.editMessageCaption({
    caption: ctx.t('enter_telegram_tag', { label }),
    reply_markup: new InlineKeyboard()
      .text(ctx.t('return_btn'), 'return')
  });
};

export async function handlePubgIdInput(ctx: MyContext, text: string): Promise<void> {
  const chatId = ctx.chat?.id;
  const firstName = ctx.chat?.first_name || '';
  const lastName = ctx.chat?.last_name || '';
  if (!chatId) return;
  
  const cart = ctx.session.cart;
  if (!cart || cart.items.length === 0) {
    await ctx.reply(ctx.t('cart_empty'));
    return;
  }
  
  const pubgId = text;
  const balance = getUserBalance(chatId)

  if (balance < cart.total) {
    await ctx.api.sendMessage(chatId, ctx.t('insufficient_funds'), {
      reply_markup: new InlineKeyboard()
        .text(ctx.t('deposit_btn'), 'deposit')
    });
    return;
  }

  const codesToUse = await getCodesToActivate(ctx);

  if (codesToUse === undefined) {
    return;
  };
  
  for (const [productLabel, codesArray] of Object.entries(codesToUse)) {
    for (const code of codesArray) {
      console.log(1)
      try {
        const response = await activatorApi.post('/redeem', {
          requireReceipt: true,
          playerId: pubgId,
          codeOverride: code
        });
        console.log("something")
  
        console.log(response.data);
      } catch (error) {
        const axiosError = error as any;
        if (axiosError.response?.data?.errorCode === 'CHARACTER_NOT_FOUND') {
          ctx.api.sendMessage(chatId, ctx.t("user_not_found"), {
            reply_markup: cancelKeyboard(chatId)
          });

          return;
        }
        else {
          ctx.api.sendMessage(chatId, ctx.t("order_error"), {
            reply_markup: returnKeyboard(chatId)
          });
          console.log(error);

          return;
        }
      }
    };
  };

  const newBalance = balance - cart.total;
  await setUserBalance(chatId, newBalance);

  const orderNumber = Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);
  const orderData = {
    orderId: orderNumber,
    userId: chatId,
    type: 'Id',
    pubgId: pubgId,
    codes: codesToUse,
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
  } catch (error) {
    console.error(ctx.t('order_error'), error);
    await ctx.api.sendMessage(chatId, ctx.t('order_error'));
    return;
  }

  let codesMessage = '';
  for (const [label, codes] of Object.entries(codesToUse)) {
    const formattedCodes = codes.map(code => `<code>${code}</code>`).join('\n');
    codesMessage += `➥ ${label} UC:\n${formattedCodes}\n\n`;
  }

  let message = ctx.t('order_confirmed') + '\n\n' + codesMessage;

  delete ctx.session.cart
  
  await ctx.api.sendMessage(chatId, message, {
    parse_mode: 'HTML',
    reply_markup: toMenuKeyboard(chatId)
  });

  const orderText = ctx.t('new_order', { orderNumber }) + '\n' +
    ctx.t('codes') + ':\n' + codesMessage + '\n' +
    ctx.t('total') + ': ' + cart.total + '\n' +
    ctx.t('order_id', { id: pubgId }) + '\n' +
    ctx.t('user') + ': ' + `${orderData.userInfo.username} (ID: ${chatId})`;
  
  sendOrderRequest(orderText);

  setDefaultUserState(ctx);
};

async function getCodesToActivate (ctx: MyContext): Promise<Record<string, string[]> | undefined> {
  const chatId = ctx.chat!.id;
  const cart = ctx.session.cart;
  if (!cart) {
    return;
  };

  const requiredCodes = cart.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  for (const label of Object.keys(requiredCodes)) {
    const availableCount = Object.keys(getCodes(label)).length;
    if (availableCount < requiredCodes[label]) {
        await ctx.api.sendMessage(chatId, ctx.t('codes_lacking'));
        return;
    }
  };

  const codesToSend: Record<string, string[]> = {};
  for (const label of Object.keys(requiredCodes)) {
    const codes = getCodes(label);
    const codeIds = Object.keys(codes).slice(0, requiredCodes[label]);
    codesToSend[label] = codeIds.map(key => codes[key].code);

    await deleteCodes(label, codeIds);
  }

  return codesToSend;
}

export async function sendUnusedCodes(ctx: MyContext, productLabel: string) {
    try {
    const unusedCodesSnapshot = await refs.codes.child(productLabel)
      .orderByChild('used')
      .equalTo(false)
      .once('value');

    const unusedCodes = unusedCodesSnapshot.val() || {};

    let unusedCodesMessage = ctx.t('codes_list', { 
      productLabel,
      codes: Object.values(unusedCodes as Record<string, Code>)
        .map((codeData, index) => `${index + 1}. <code>${codeData.code}</code>`)
        .join('\n')
    });
    
    if (ctx.chat) {
      await ctx.api.sendMessage(ctx.chat.id, unusedCodesMessage, {
        parse_mode: 'HTML'
      });
    };
  } catch (error) {
    console.error(ctx.t('code_error'), error);
    if (ctx.chat) {
      await ctx.api.sendMessage(ctx.chat.id, ctx.t('code_error'));
    };
  }
};

export async function sendBroadcastMessage(ctx: MyContext, broadcastMessage: string) {
  const users = getAllUsers();
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  if (!users) {
    await ctx.api.sendMessage(chatId, ctx.t('no_users'));
    return;
  };

  const userIds = Object.keys(users);
  let successCount = 0;
  
  for (const userId of userIds) {
    try {
      await bot.api.sendMessage(userId, broadcastMessage);
      successCount++;
    } catch (error) {
      if (error instanceof GrammyError) {
        if (error.error_code === 429) {
          const retryAfter = error.parameters?.retry_after || 1;
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        };
        console.error(ctx.t('firebase_error'), error.description);
      };
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  await ctx.api.sendMessage(chatId, ctx.t('broadcast_sent', { count: successCount }), {
    reply_markup: toMenuKeyboard(chatId)
  });
};

export async function purchaseStars(userTag: string, starsAmount: number, userId: number): Promise<boolean> {
  try {
    const response = await fragmentApi.post('/order/stars', {
      username: userTag,
      quantity: starsAmount, 
    });

    if (response.data.status === 'success') {
      console.log(`✅ Stars purchased for @${userTag}: ${starsAmount}`);
      return true;
    } else {
      console.error('Fragment API error:', response.data);
      return false;
    }
  } catch (error: any) {
    console.error('Fragment purchase error:', error.response?.data || error.message);
    return false;
  }
};

function generateSignature (timestamp: string, recvWindow: number, parameters: string): string {
  return crypto.createHmac('sha256', BYBIT_SECRET).update(timestamp + BYBIT_API_KEY + recvWindow + parameters).digest('hex');
};

export async function createBybitPayment (userId: number | string, orderAmount: number) {
  const timestamp = Date.now()
  const bybitOrder = `bybit-order_${userId}_${timestamp.toString(36).toUpperCase}`;

  const envParams = {
    terminalType: "WEB", 
    device: `tg_device_${userId}`,
    browserVersion: "Mozilla/5.0 (compatible; TelegramBot/1.0)",
    ip: "109.252.189.23"
  };

  const parameters = {
    merchantId: getPaymentDetails().ByBit,
    merchantName: "Roni",
    paymentType: "E_COMMERCE",
    merchantTradeNo: bybitOrder,
    goods: [
      {
        "shoppingName": "Roni",
        "goodsName": "Пополнение баланса"
      }
    ],
    orderAmount: orderAmount.toString(),
    currency: "USDT",
    currencyType: "crypto",
    env: envParams
  };

  const rawRequestBody = JSON.stringify(parameters);

  const signature = generateSignature(timestamp.toString(), 5000, rawRequestBody);

  const headers = {
    'X-BAPI-SIGN': signature,
    'X-BAPI-API-KEY': BYBIT_API_KEY,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': 5000,
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.post(
      `${BYBIT_API_URL}/v5/bybitpay/create_pay`,
      parameters,
      { headers }
    )

    console.log(response);
    return response
  } catch (error) {
       if (axios.isAxiosError(error)) {
        console.error('Bybit API Error:', error.response?.data);
    } else {
        console.error('Unexpected error:', error);
    }
    throw error;
  }
};
