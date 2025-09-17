import express from 'express';
import axios from 'axios';
import { Bot, InlineKeyboard, session, } from 'grammy';
import { Order, SessionData, MyContext, Code } from './types.js';
import { adminKeyboard, catalogKeyboard, categoryKeyboard, changeCredentialsKeyboard, cancelKeyboard, paymentMethodsKeyboard, productsManagementKeyboard, profileKeyboard, pubgKeyboard, returnKeyboard, starsKeyboard, telegramKeyboard, cryptobotKeyboard, manageAdminsKeyboard, adminReturnKeyboard, deleteProductListKeyboard, manageCodesKeyboard, manageCodesListKeyboard, toMenuKeyboard, depositKeyboard, orderRequestKeyboard, depositRequestKeyboard, languageKeyboard } from './keyboards.js';
import { addCodes, ADMIN_CHAT_ID, createUser, deleteCodes, deletePendingChecks, DEPOSIT_GROUP_ID, getAdmins, getAllUsers, getCodes, getPaymentDetails, getPendingChecks, getStarsPrice, getUser, getUserBalance, getUserLanguage, initializeFirebaseData, refs, setAdmins, setPaymentDetails, setPendingCheck, setStarsPrice, setUserBalance, setUserLanguage, token } from './globals.js';
import { createBybitPayment, currentProducts, getUserTag, handlePubgIdInput, isAdmin, processCryptoBotMessage, purchaseCodes, purchasePremium, purchaseStars, purchaseWithId, sendBroadcastMessage, sendDepositRequest, sendMainMessage, sendOrderRequest, sendUnusedCodes, setDefaultUserState, updateCartMessage, updateProducts } from './botUtils.js';
import { useI18n } from './i18n.js';
import en from './locales/en.js';
import ru from './locales/ru.js';

const app = express();
app.use(express.json());

export const bot = new Bot<MyContext>(token);

// Firebase configuration
initializeFirebaseData()

// Initialize session middleware
bot.use(session({
  initial: (): SessionData => ({})
}));
bot.use(useI18n());

const IMAGES = {
  welcome: 'https://ibb.co/8LVZ1Qcd',
  pack: 'https://ibb.co/wF0vRw5J',
  payment: 'https://ibb.co/W4VVcZWz',
  amount: 'https://ibb.co/W4VVcZWz'
}

// Command handlers
bot.command('start', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  
  if (getUser(chatId) === undefined) {
    await createUser(chatId);
  }
  
  await sendMainMessage(ctx);
});

// Callback query handlers
bot.on('callback_query:data', async (ctx) => {
  const chatId = ctx.from.id;
  if (!chatId) return;
  
  const data = ctx.callbackQuery.data;
  const messageId = ctx.msg!.message_id;
  
  try {
    if (data === 'return') {
      setDefaultUserState(ctx);
      await sendMainMessage(ctx, messageId);
    }
    else if (data === 'main-message') {
      setDefaultUserState(ctx);
      await sendMainMessage(ctx);
    }
    else if (data === 'catalog') {
      await ctx.editMessageCaption({
        caption: ctx.t('select_category'),
        reply_markup: catalogKeyboard(chatId)
      });
      return;
    }
    else if (data === 'pubg') {
      await ctx.editMessageCaption({
        caption: ctx.t('select_category'),
        reply_markup: pubgKeyboard(chatId)
      });
      return;
    }
    else if (data === 'telegram') {
      await ctx.editMessageCaption({
        caption: ctx.t('select_category'),
        reply_markup: telegramKeyboard(chatId)
      });
      return;
    }
    else if (data.startsWith('open-shop_')) {
      const type = data.split('_')[1] || '';
      
      if (type === 'stars') {
        ctx.session.state = { type: 'awaiting_stars_amount' };
        await ctx.editMessageCaption({
          caption: ctx.t('enter_stars_amount', { price: getStarsPrice() }),
          reply_markup: new InlineKeyboard().text(ctx.t('cancel_btn'), 'return')
        });
        return;
      }
      
      if (!ctx.session.cart) {
        ctx.session.cart = { items: [], total: 0 };
      }
      
      await updateCartMessage(ctx, type);
      return;
    }
    else if (data === 'admin-panel') {
      if (!isAdmin(chatId)) {
        return;
      }
      setDefaultUserState(ctx);

      await ctx.editMessageMedia({
        type: 'photo',
        media: IMAGES.welcome,
        caption: ctx.t('admin_welcome')
      }, {
        reply_markup: adminKeyboard(chatId)
      })
    }
    else if (data === 'my-profile') {
      setDefaultUserState(ctx);

      await ctx.editMessageCaption({
        caption: ctx.t('profile_info', { 
          userId: chatId,
          balance: getUserBalance(chatId)
        }),
        parse_mode: 'HTML',
        reply_markup: profileKeyboard(chatId)
      })
    }
    else if (data === 'my-orders') {
      try {
        const snapshot = await refs.orders.child(`${chatId}`).once('value');
        const orders = snapshot.val();

        if (!orders) {
          return ctx.api.sendMessage(chatId, ctx.t('no_orders'))
        }
        const ordersList = (Object.entries(orders) as [string, Order][])
            .map(([orderId, order]) => {
                let details = '';
                if (order.type === 'codes') {
                    const codesText = order.codes
                      ? (Object.entries(order.codes) as [string, string[]][])
                        .map(([label, codes]) => `➥ ${label} UC:\n${codes.join('\n')}`)
                        .join('\n\n')
                      : ctx.t('no_codes')
                    details = ctx.t('order_codes', { codes: codesText });
                } else {
                    details = ctx.t('order_id', { id: order.pubgId || 0 });
                }
                
                return ctx.t('order_history_item', {
                  orderId,
                  date: new Date(order.timestamp).toLocaleDateString(),
                  count: order.items.length,
                  total: order.total,
                  statusEmoji: getStatusEmoji(order.status),
                  status: order.status,
                  details
                });
            })
            .join('\n\n────────────────\n');

        ctx.api.sendMessage(chatId, ctx.t('orders_history', { orders: ordersList }), {
          parse_mode: 'HTML',
          reply_markup: returnKeyboard(chatId)
        })

        ctx.api.deleteMessage(chatId, messageId)
      } catch (error) {
        console.error(ctx.t('order_error'), error);
      }

      function getStatusEmoji(status: string) {
        switch(status) {
            case 'confirmed': return '✅';
            default: return '⏳';
        }
      }
    }
    else if (data === 'language') {
      await ctx.editMessageCaption({
        caption: ctx.t('choose_language'),
        reply_markup: languageKeyboard(chatId, getUserLanguage(chatId))
      });
      return;
    }
    else if (data.startsWith('set-lang_')) {
      const lang = data.split('_')[1] as 'ru' | 'en';
      await setUserLanguage(chatId, lang);
      await ctx.editMessageCaption({
        caption: ctx.t('choose_language'),
        reply_markup: languageKeyboard(chatId, lang)
      })
    }
    else if (data === 'deposit') {
      await ctx.api.editMessageMedia(chatId, messageId, {
        type: 'photo',
        media: IMAGES.payment,
        caption: ctx.t('select_payment_method')
      }, {
        reply_markup: paymentMethodsKeyboard(chatId)
      });
      return;
    }
    else if (data === 'deposit-with-bybit') {
      await ctx.api.editMessageMedia(chatId, messageId, {
        type: 'photo',
        media: IMAGES.amount,
        caption: ctx.t('enter_deposit_amount')
      }, {
        reply_markup: cancelKeyboard(chatId)
      });

      ctx.session.state!.type = 'awaiting_deposit';
      return;
    }
    else if (data === 'deposit-with-cryptobot') {
      await ctx.api.editMessageMedia(chatId, messageId, {
        type: 'photo',
        media: IMAGES.amount,
        caption: ctx.t('deposit_instructions', { uid: getPaymentDetails().ByBit, amount: '' }),
        parse_mode: 'HTML'
      }, {
        reply_markup: cryptobotKeyboard(chatId)
      });
    }
    else if (data.startsWith('add-to-cart_')) {
      const [, label, price, type] = data.split('_');
      const products = currentProducts(type);
      const product = products.find((p: { label: string; }) => p.label === label);
      
      if (!product) {
        await ctx.answerCallbackQuery({ text: ctx.t('product_not_found') });
        return;
      }
      
      if (!ctx.session.cart) {
        ctx.session.cart = { items: [], total: 0 };
      }
      
      ctx.session.cart.items.push(product);
      ctx.session.cart.total = Math.round((ctx.session.cart.total + parseFloat(price)) * 100) / 100;
      
      await updateCartMessage(ctx, type);
      await ctx.answerCallbackQuery({ text: ctx.t('item_added', { label }) });
    }
    else if (data.startsWith('cart_')) {
      const [, action, type] = data.split('_');

      switch (action) {
        case 'clear':
          setDefaultUserState(ctx);
          await updateCartMessage(ctx, type);
          await ctx.answerCallbackQuery({ text: ctx.t('cart_cleared') });
          break;
        case 'buy-with-id':
          await purchaseWithId(ctx);
          break;
        case 'buy-codes':
          await purchaseCodes(ctx);
          break;
      }
    }
    else if (data.startsWith('buy-premium_')) {
      const [, label, price] = data.split('_');
      await purchasePremium(ctx, label, parseInt(price));
    }
    else if (data === 'edit-payment-details') {
      await ctx.editMessageCaption({
        caption: ctx.t('select_payment_method'),
        reply_markup: changeCredentialsKeyboard(chatId)
      });
      return;
    }
    else if (data.startsWith('select-payment-method_')) {
      const method = data.split('_')[1];

      ctx.session.state = {
        type: 'awaiting_to_change_credentials',
        data: {method}
      };

      await ctx.editMessageCaption({
        caption: ctx.t('enter_new_credentials', { method }),
        reply_markup: cancelKeyboard(chatId)
      });
      return;
    }
    else if (data === 'manage-balances') {
      if (ctx.session.state) {
        ctx.session.state.type = 'awaiting_user_to_change_balance'
      };

      await ctx.editMessageCaption({
        caption: ctx.t('enter_user_id'),
        reply_markup: cancelKeyboard(chatId)
      });
      return;
    }
    else if (data === 'manage-products') {
      await ctx.editMessageCaption({
        caption: ctx.t('select_category'),
        reply_markup: categoryKeyboard(chatId)
      });
      return;
    }
    else if (data.startsWith('manage-category_')) {
      const category = data.split('_')[1] as 'codes' | 'id' | 'promo' | 'premium' | 'stars';

      if (category === 'stars') {
        ctx.editMessageCaption({
          caption: ctx.t('select_stars_action'),
          reply_markup: starsKeyboard(chatId)
        })
        return;
      }

      await ctx.editMessageCaption({
        caption: ctx.t('manage_products'),
        reply_markup: productsManagementKeyboard(chatId, category)
      })
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
          ctx.api.sendMessage(chatId, ctx.t('product_not_found'), {
            reply_markup: returnKeyboard(chatId)
          });
          return;
      }

      ctx.api.sendMessage(chatId, ctx.t('enter_new_product_price', { label }), {
        reply_markup: cancelKeyboard(chatId)
      });

      ctx.session.state = {
        type: 'awaiting_to_change_product',
        data: {category}
      };
      return;
    }
    else if (data.startsWith('delete-product-list_')) {
      const category = data.split('_')[1];

      ctx.editMessageCaption({
        caption: ctx.t('select_product'),
        reply_markup: deleteProductListKeyboard(chatId, category)
      });
      return;
    }
    else if (data.startsWith('delete-product_')) {
      const [, category, labelToDelete] = data.split('_');

      if (!isAdmin(chatId)) {
        return
      }

      const products = currentProducts(category)
      const product = products.find(p => p.label === labelToDelete);
      if (!product) {
          ctx.api.sendMessage(chatId, ctx.t('product_not_found'), {
            reply_markup: returnKeyboard(chatId)
          });
          return;
      }
  
      const index = products.findIndex(product => product.label === labelToDelete);
      if (index !== -1) {
        products.splice(index, 1);
        updateProducts(chatId, category, products)
      } else {
        ctx.api.sendMessage(chatId, ctx.t('product_not_found'), {
          reply_markup: returnKeyboard(chatId)
        });
      }
      return;
    }
    else if (data.startsWith('add-product_')) {
      const category = data.split('_')[1];

      ctx.session.state = {
        type: 'awaiting_new_product_label',
        data: {category}
      };

      await ctx.editMessageCaption({
        caption: ctx.t('enter_new_product_name'),
        reply_markup: cancelKeyboard(chatId)
      })
    }
    else if (data === 'manage-admins') {
      await ctx.editMessageCaption({
        caption: ctx.t('manage_admins'),
        reply_markup: manageAdminsKeyboard(chatId)
      })
      return;
    }
    else if (data === 'add-admin') {
      await ctx.editMessageCaption({
        caption: ctx.t('enter_admin_id_add'),
        reply_markup: cancelKeyboard(chatId)
      });

      ctx.session.state!.type = 'awaiting_to_add_admin';
      return;
    }
    else if (data === 'remove-admin') {
      await ctx.editMessageCaption({
        caption: ctx.t('enter_admin_id_remove'),
        reply_markup: cancelKeyboard(chatId)
      });

      ctx.session.state!.type = 'awaiting_to_remove_admin';
      return;
    }
    else if (data === 'send-broadcast') {
      if (!isAdmin(chatId)) {
        return;
      };

      await ctx.editMessageCaption({
        caption: ctx.t('enter_broadcast_message'),
        reply_markup: adminReturnKeyboard(chatId)
      });

      ctx.session.state!.type = 'awaiting_to_create_mailing'
    }
    else if (data === 'manage-codes') {
      setDefaultUserState(ctx);

      await ctx.editMessageCaption({
        caption: ctx.t('select_codes_action'),
        reply_markup: manageCodesKeyboard(chatId)
      });
      return;
    }
    else if (data === 'add-codes-list') {
      await ctx.editMessageCaption({
        caption: ctx.t('select_product_for_codes', { action: 'добавления' }),
        reply_markup: manageCodesListKeyboard(chatId, 'add')
      });
      return;
    }
    else if (data === 'remove-codes-list') {
      await ctx.editMessageCaption({
        caption: ctx.t('select_product_for_codes', { action: 'удаления' }),
        reply_markup: manageCodesListKeyboard(chatId, 'remove')
      });
      return;
    }
    else if (data.startsWith('add-codes_')) {
      const productLabel = data.split('_')[1];
      
      sendUnusedCodes(ctx, productLabel);

      ctx.session.state = {
        type: 'awaiting_codes_for_product',
        data: {productLabel}
      };

      ctx.editMessageCaption({
        caption: ctx.t('enter_codes_list', { productLabel }),
        reply_markup: returnKeyboard(chatId)
      });
      return;
    }
    else if (data.startsWith('remove-codes_')) {
      const productLabel = data.split('_')[1];

      sendUnusedCodes(ctx, productLabel);

      ctx.session.state = {
        type: 'awaiting_code_to_delete',
        data: {productLabel}
      };

      ctx.editMessageCaption({
        caption: ctx.t('enter_code_to_delete'),
        reply_markup: returnKeyboard(chatId)
      });
      return;
    }
    else if (data.startsWith('confirm_')) {
      if (!isAdmin(chatId)) {
        return;
      };

      const userId = data.split('_')[1];
      const userInfo = getPendingChecks()[userId];

      if (userInfo) {
        const depositAmount = userInfo.amount;
        const balance = getUserBalance(userId);
        const newBalance = balance + depositAmount;

        await setUserBalance(userId, newBalance);

        await sendDepositRequest(ctx.t('deposit_confirmed', {
          amount: depositAmount,
          userTag: userInfo.userTag,
          userId
        }));

        await bot.api.sendMessage(userId, ctx.t('balance_updated', {
          amount: depositAmount,
          balance: newBalance
        }), {
          reply_markup: toMenuKeyboard(chatId)
        });

        await deletePendingChecks(userId);
      };
      return;
    }
    else if (data.startsWith('reject_')) {
      if (!isAdmin(chatId)) {
        return;
      };

      const userId = data.split('_')[1];
      const userInfo = getPendingChecks()[userId];

      if (userInfo) {
        await sendDepositRequest(ctx.t('deposit_rejected', {
          amount: userInfo.amount,
          userTag: userInfo.userTag,
          userId
        }));

        await bot.api.sendMessage(userId, ctx.t('order_rejected'), {
          reply_markup: toMenuKeyboard(chatId)
        });

        await deletePendingChecks(userId);
      };
      return;
    }
    else if (data.startsWith('order-completed_')) {
      if (!isAdmin(chatId)) {
        return;
      };

      const [, userId, orderId] = data.split('_');

      try {
        await refs.orders.child(userId).child(orderId).update({
          status: 'confirmed',
          confirmedAt: Date.now(),
          adminId: chatId
        });

        sendOrderRequest(ctx.t('order_completed', { userId }));

        bot.api.sendMessage(userId, ctx.t('order_completed'), {
          reply_markup: toMenuKeyboard(chatId)
        });

        ctx.editMessageReplyMarkup({
          reply_markup: new InlineKeyboard()
        });
      } catch (error) {
        console.error(ctx.t('order_error'), error);
      }
      return;
    }
    else if (data.startsWith('order-declined_')) {
      if (!isAdmin(chatId)) {
        return;
      };

      const [, userId, orderId, amount] = data.split('_');

      try {
        await refs.orders.child(userId).child(orderId).update({
          status: 'declined',
          confirmedAt: Date.now(),
          adminId: chatId
        });

        const newBalance = getUserBalance(userId) + Math.round(parseFloat(amount) * 100) / 100;
        await setUserBalance(userId, newBalance);

        await sendOrderRequest(ctx.t('order_cancelled', { userId }));

        bot.api.sendMessage(userId, ctx.t('order_rejected'), {
          reply_markup: toMenuKeyboard(chatId)
        });

        ctx.editMessageReplyMarkup({
          reply_markup: new InlineKeyboard()
        });
      } catch (error) {
        console.error(ctx.t('order_error'), error);
      }
      return;
    }
    
    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('Callback query error:', error);
  }
});

// Message handler
bot.on('message', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId || !ctx.msg.text) return;
  const userTag = getUserTag(ctx);
  
  const text = ctx.msg.text;
  const state = ctx.session.state;
  
  try {
    await processCryptoBotMessage(ctx);

    if (ctx.msg.reply_to_message && isAdmin(chatId)) {
      console.log(ctx.msg)
    }

    if (state) {
      if (state.type === 'awaiting_pubg_id') {
        console.log(2)
        handlePubgIdInput(ctx, text);
      } else if (state.type === 'awaiting_stars_amount') {
        const starsAmount = parseInt(text);

        if (isNaN(starsAmount)) {
          await ctx.api.sendMessage(chatId, ctx.t('invalid_amount'), {
            reply_markup: cancelKeyboard(chatId)
          });

          return;
        };

        await ctx.api.sendMessage(chatId, ctx.t("enter_telegram_stars_tag", {amount: starsAmount}), {
          reply_markup: cancelKeyboard(chatId)
        });

        ctx.session.state = {
          type: 'awaiting_user_tag',
          data: {starsAmount}
        };

        return;
      } else if (state.type === 'awaiting_user_tag') {
        const starsAmount = state.data.starsAmount;
        const tag = text.trim();
        let userTag = '';

        if (!tag.startsWith('@')) {
            await ctx.api.sendMessage(chatId, ctx.t('invalid_tag'), {
              reply_markup: cancelKeyboard(chatId)
            });

            userTag = tag.slice(1);
            return;
        };

        const balance = getUserBalance(chatId);
        const starsPrice = getStarsPrice();
        const totalPrice = starsAmount * starsPrice;

        if (balance < totalPrice) {
            await ctx.api.sendMessage(chatId, ctx.t('insufficient_funds'), {
                reply_markup: depositKeyboard(chatId)
            });
            setDefaultUserState(ctx);
            return;
        };

        const success = await purchaseStars(userTag, starsAmount, chatId);

        if (success) {
            // Списание средств
            const newBalance = balance - totalPrice;
            await setUserBalance(chatId, newBalance);

            // Создаем заказ
            const orderNumber = Date.now().toString(36).toUpperCase();
            const orderData = {
                orderId: orderNumber,
                userId: chatId,
                type: 'stars',
                userTag: userTag,
                starsAmount: starsAmount,
                total: totalPrice,
                status: 'confirmed',
                timestamp: Date.now()
            };

            await refs.orders.child(chatId.toString()).child(orderNumber).set(orderData);

            await ctx.api.sendMessage(chatId, 
                ctx.t('stars_purchased', {
                    amount: starsAmount,
                    userTag: userTag,
                }), {
                reply_markup: toMenuKeyboard(chatId)
            });

        } else {
            await ctx.api.sendMessage(chatId, 
                ctx.t('purchase_failed'), {
                reply_markup: toMenuKeyboard(chatId)
            });
            setDefaultUserState(ctx);

            return;
        };

        setDefaultUserState(ctx);

        return;
      } else if (state.type === 'awaiting_premium_tag') {
        try {
          const tag = text;
  
          if (!tag.startsWith('@')) {
            ctx.api.sendMessage(chatId, ctx.t('invalid_tag'), {
              reply_markup: cancelKeyboard(chatId)
            });
            return;
          };
  
          const label = state.data.label;
          const price = state.data.price;
          const balance = getUserBalance(chatId);
  
          if (price > balance) {
            ctx.api.sendMessage(chatId, ctx.t('insufficient_funds'), {
              reply_markup: depositKeyboard(chatId)
            });
            setDefaultUserState(ctx);
            return;
          };
  
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
            ctx.t('new_order'),
            `🧾#${orderNumber}`,
            ctx.t('premium_order'),
            `${ctx.t('items')}: ${label}`,
            `💵${ctx.t('total')}: ${price}`,
            `🆔: ${tag}`,
            `🪪${ctx.t('user')}: ${userTag} (ID: ${chatId}).`,
            '⚠️Выберите действие ниж'
          ].join('\n');

          sendOrderRequest(orderText, orderRequestKeyboard(chatId, orderNumber, price));

          ctx.api.sendMessage(chatId, ctx.t('premium_order_created', {
            label,
            price,
            tag
          }), {
            reply_markup: toMenuKeyboard(chatId)
          });
        } catch (error) {
          console.error(ctx.t('order_error'), error);
          await ctx.api.sendMessage(chatId, ctx.t('order_error'))
        }
        return;
      } else if (state.type === 'awaiting_deposit') {
        const amount = parseFloat(text);

        if (isNaN(amount)) {
          await ctx.api.sendMessage(chatId, ctx.t('invalid_amount'), {
            reply_markup: cancelKeyboard(chatId)
          });

          return;
        };

        await ctx.api.sendMessage(chatId, ctx.t('deposit_instructions', {
          uid: getPaymentDetails().ByBit,
          amount
        }), {
          reply_markup: cancelKeyboard(chatId),
          parse_mode: 'HTML'
        });

        const result = await createBybitPayment(chatId, amount)

        ctx.session.state = {
          type: 'awaiting_receipt',
          data: {
            amount,
            userTag,
            userId: chatId
          }
        };
        return;
      } else if (state.type === 'awaiting_receipt') {
        const userInfo = {
          amount: state.data.amount,
          userTag: state.data.userTag,
          userId: state.data.userId
        }
        
        await setPendingCheck(chatId, userInfo);
        await bot.api.forwardMessage(DEPOSIT_GROUP_ID, chatId, ctx.message.message_id);
        
        await sendDepositRequest(ctx.t('new_deposit_request', {
          userTag,
          userId: chatId,
          amount: userInfo.amount,
          time: new Date().toLocaleString()
        }), depositRequestKeyboard(chatId));

        await ctx.api.sendMessage(chatId, ctx.t('deposit_request_sent'), {
          reply_markup: toMenuKeyboard(chatId)
        });

        setDefaultUserState(ctx);
        return;
      } else if (state.type === 'awaiting_to_change_product') {
        const category = state.data.category;
        const newPrice = parseFloat(text);

        if (isNaN(newPrice)) {
          await ctx.api.sendMessage(chatId, ctx.t('invalid_price'), {
            reply_markup: adminReturnKeyboard(chatId)
          });
          return;
        };

        await updateProducts(chatId, category);
        setDefaultUserState(ctx);
        return;
      } else if (state.type === 'awaiting_new_product_label') {
        const newLabel = text;

        await ctx.api.sendMessage(chatId, ctx.t('enter_new_product_price', { label: newLabel }), {
          reply_markup: adminReturnKeyboard(chatId)
        });

        ctx.session.state = {
          type: 'awaiting_new_product_price',
          data: {
            newLabel,
            category: state.data.category
          }
        };
        return;
      } else if (state.type === 'awaiting_new_product_price') {
        const newPrice = parseFloat(text);

        if (isNaN(newPrice)) {
          await ctx.api.sendMessage(chatId, ctx.t('invalid_price'), {
            reply_markup: adminReturnKeyboard(chatId)
          });
          return;
        };

        const newLabel = state.data.newLabel;
        const category = state.data.category;
        const products = currentProducts(category);

        products.push({label: newLabel, price: newPrice});
        products.sort((a, b) => parseInt(a.label, 10) - parseInt(b.label, 10));

        await updateProducts(chatId, category, products);
        setDefaultUserState(ctx);
        return;
      } else if (state.type === 'awaiting_stars_price') {
        const newPrice = parseFloat(text);

        if (isNaN(newPrice)) {
          await ctx.api.sendMessage(chatId, ctx.t('invalid_price'), {
            reply_markup: adminReturnKeyboard(chatId)
          });
          return;
        };

        await setStarsPrice(newPrice);
        await ctx.api.sendMessage(chatId, ctx.t('products_updated'), {
          reply_markup: toMenuKeyboard(chatId)
        });

        setDefaultUserState(ctx);
        return;
      } else if (state.type === 'awaiting_to_change_credentials') {
        const method = state.data.method;
        const newValue = text;

        await setPaymentDetails(method, newValue);
        await ctx.api.sendMessage(chatId, ctx.t('credentials_updated', { method }), {
          reply_markup: toMenuKeyboard(chatId)
        });

        setDefaultUserState(ctx);
        return;
      } else if (state.type === 'awaiting_user_to_change_balance') {
        const userId = text;

        await ctx.api.sendMessage(chatId, ctx.t('balance_changed', {
          userId,
          balance: getUserBalance(userId)
        }), {
          reply_markup: adminReturnKeyboard(chatId)
        });

        ctx.session.state = {
          type: 'awaiting_to_change_balance',
          data: {userId}
        };
        return;
      } else if (state.type === 'awaiting_to_change_balance') {
        const newBalance = parseFloat(text);
        const userId = state.data.userId;

        if (isNaN(newBalance)) {
          await ctx.api.sendMessage(chatId, ctx.t('invalid_amount'), {
            reply_markup: adminReturnKeyboard(chatId)
          });
          return;
        };

        const userBalance = getUserBalance(chatId)
        if (userBalance || userBalance === 0) {
          await setUserBalance(chatId, newBalance);
          await ctx.api.sendMessage(chatId, ctx.t('balance_changed', {
            userId,
            balance: newBalance
          }), {
            reply_markup: toMenuKeyboard(chatId)
          });
        } else {
          await ctx.api.sendMessage(chatId, ctx.t('user_not_found'), {
            reply_markup: toMenuKeyboard(chatId)
          });
        };

        setDefaultUserState(ctx);
        return;
      } else if (state.type === 'awaiting_to_create_mailing') {
        const broadcastMessage = text;

        if (!broadcastMessage) {
          await ctx.api.sendMessage(chatId, ctx.t('empty_message'), {
            reply_markup: adminReturnKeyboard(chatId)
          });
          return;
        };

        sendBroadcastMessage(ctx, broadcastMessage);
        setDefaultUserState(ctx);
        return;
      } else if (state.type === 'awaiting_to_add_admin') {
        const newAdminId = text;
        const users = getAllUsers();

        if (!Object.prototype.hasOwnProperty.call(users, newAdminId)) {
          await ctx.api.sendMessage(chatId, ctx.t('user_not_found'), {
            reply_markup: toMenuKeyboard(chatId)
          });
        };

        const admins = getAdmins()
        if (!admins[chatId]) {
          const newAdmins = {...admins, [newAdminId]: true};
          await setAdmins(newAdmins);

          await ctx.api.sendMessage(chatId, ctx.t('admin_added', { adminId: newAdminId }), {
            reply_markup: toMenuKeyboard(chatId)
          });

          await bot.api.sendMessage(newAdminId, ctx.t('new_admin_notification'), {
            reply_markup: toMenuKeyboard(chatId)
          });
        } else {
          await ctx.api.sendMessage(chatId, ctx.t('admin_exists', { adminId: newAdminId }), {
            reply_markup: toMenuKeyboard(chatId)
          })
        };

        setDefaultUserState(ctx);
        return;
      } else if (state.type === 'awaiting_to_remove_admin') {
        const adminIdToRemove = text;
        const admins = getAdmins();

        if (admins[adminIdToRemove]) {
          if (adminIdToRemove === ADMIN_CHAT_ID) {
            await ctx.api.sendMessage(chatId, ctx.t('main_admin_protected'), {
              reply_markup: toMenuKeyboard(chatId)
            });
          } else {
            delete admins[adminIdToRemove];
            await setAdmins(admins)

            await ctx.api.sendMessage(chatId, ctx.t('admin_removed', { adminId: adminIdToRemove }), {
              reply_markup: toMenuKeyboard(chatId)
            });

            await bot.api.sendMessage(adminIdToRemove, ctx.t('removed_admin_notification'), {
              reply_markup: toMenuKeyboard(chatId)
            });
          };
        };

        setDefaultUserState(ctx);
        return;
      } else if (state.type === 'awaiting_codes_for_product') {
        const codes = text.split('\n')
          .map(code => code.trim())
          .filter(code => code.length > 0);
        const productLabel = state.data.productLabel;

        await addCodes(productLabel, codes);

        await ctx.api.sendMessage(chatId, ctx.t('codes_added', {
          count: codes.length,
          productLabel
        }), {
          reply_markup: toMenuKeyboard(chatId)
        });
        
        setDefaultUserState(ctx);
        return;
      } else if (state.type === 'awaiting_code_to_delete') {
        const productLabel = state.data.productLabel;
        const codeToDelete = text;
        const codes = getCodes(productLabel);

        const foundEntry = Object.entries(codes).find(([_, codeData]) => codeData.code === codeToDelete);

        if (!foundEntry) {
          await ctx.api.sendMessage(chatId, ctx.t('code_not_exist'), {
            reply_markup: adminReturnKeyboard(chatId)
          });
          return;
        };

        const [codeId, _] = foundEntry;

        await deleteCodes(productLabel, [codeId]);
        await ctx.api.sendMessage(chatId, ctx.t('code_deleted', {codeToDelete: codeToDelete}), {
          reply_markup: toMenuKeyboard(chatId)
        });
      }
    }
  } catch (error) {
    console.error('Message handling error:', error);
  }
});

const startBot = async () => {
  await bot.start({
    onStart: (botInfo) => {
      console.log(`Bot @${botInfo.username} is running on polling!`);
    },
    drop_pending_updates: true,
    allowed_updates: ['message', 'callback_query']
  });
};

startBot().catch(console.error);