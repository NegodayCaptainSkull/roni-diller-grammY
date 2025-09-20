import { Context, SessionFlavor } from "grammy";

export interface User {
  balance: number;
  language: string
};

export interface Product {
  label: string;
  price: number;
};

export interface Order {
  orderId: string;
  userId: number;
  type: string;
  items: Product[];
  total: number;
  status: string;
  timestamp: number;
  userInfo: {
    username: string;
    balanceBefore: number;
    balanceAfter: number;
  };
  pubgId?: string;
  tag?: string;
  codes?: Record<string, string[]>;
};

export interface Cart {
  items: Product[];
  total: number;
};

export interface UserState {
  type: string;
  data?: any;
  messageId?: number;
};

export interface SessionData {
  cart?: Cart;
  state?: UserState;
};

export interface PaymentDetails {
  ByBit: string;
  CryptoBot: string;
};

export interface PendingCheck {
  amount: number;
  userTag: string;
  userId: number;
};

export interface CryptobotDeposit {
  userId: number;
  messageId: number;
  username: string;
};

export interface Code {
  code: string;
  addedAt: number;
};

export type CodesForProduct = Record<string, Code>;

export type MyContext = Context & SessionFlavor<SessionData> & {
  t: (
    key: keyof ITranslations,
    params?: Record<string, string | number>
  ) => string;
};

export interface ILocales {
  ru: ITranslations;
  en: ITranslations
};

export interface ITranslations {
  welcome: string;
  choose_language: string;
  language_changed: string;
  cart_empty: string;
  cart_header: string;
  cart: string;
  cart_item: string;
  cart_total: string;
  premium_select: string;
  item_added: string;
  cart_cleared: string;
  insufficient_funds: string;
  product_not_found: string;
  cart_error: string;
  order_error: string;
  code_error: string;
  firebase_error: string;
  parse_error: string;
  payment_not_found: string;
  code_not_exist: string;
  invalid_amount: string;
  invalid_stars_amount: string;
  invalid_price: string;
  invalid_tag: string;
  user_not_found: string;
  empty_message: string;
  enter_pubg_id: string;
  enter_telegram_stars_tag: string;
  enter_telegram_tag: string;
  enter_stars_amount: string;
  enter_deposit_amount: string;
  enter_new_credentials: string;
  enter_user_id: string;
  enter_new_product_name: string;
  enter_new_product_price: string;
  enter_new_stars_price: string;
  enter_broadcast_message: string;
  enter_admin_id_add: string;
  enter_admin_id_remove: string;
  enter_codes_list: string;
  enter_code_to_delete: string;
  no_orders: string;
  stars_purchased: string;
  purchase_failed: string;
  order_confirmed: string;
  order_pending: string;
  new_order: string;
  order_details: string;
  order_completed: string;
  order_cancelled: string;
  order_rejected: string;
  premium_order_created: string;
  payment_confirmed: string;
  balance_updated: string;
  deposit_instructions: string;
  cryptobot_instructions: string;
  deposit_request_sent: string;
  new_deposit_request: string;
  deposit_confirmed: string;
  deposit_rejected: string;
  admin_welcome: string;
  products_updated: string;
  no_users: string;
  broadcast_sent: string;
  codes_list: string;
  codes_added: string;
  code_deleted: string;
  credentials_updated: string;
  balance_changed: string;
  admin_added: string;
  admin_exists: string;
  admin_removed: string;
  main_admin_protected: string;
  select_category: string;
  manage_products: string;
  select_product: string;
  select_action: string;
  select_payment_method: string;
  edit_payment_method: string;
  select_stars_action: string;
  select_codes_action: string;
  select_product_for_codes: string;
  profile_info: string;
  orders_history: string;
  order_history_item: string;
  order_codes: string;
  order_id: string;
  blocked_user: string;
  new_admin_notification: string;
  removed_admin_notification: string;
  catalog_btn: string;
  my_orders_btn: string;
  my_profile_btn: string;
  channel_btn: string;
  tech_support_btn: string;
  admin_panel_btn: string;
  buy_codes_btn: string;
  buy_id_btn: string;
  buy_btn: string;
  clear_cart_btn: string;
  add_product_btn: string;
  remove_product_btn: string;
  promos_btn: string;
  manage_products_btn: string;
  edit_payment_details_btn: string;
  manage_balances_btn: string;
  send_broadcast_btn: string;
  manage_codes_btn: string;
  manage_admins_btn: string;
  deposit_btn: string;
  change_language_btn: string;
  add_btn: string;
  remove_btn: string;
  invoice_btn: string;
  return_btn: string;
  cancel_btn: string;
  to_menu_btn: string;
  premium_order: string;
  items: string;
  total: string;
  user: string;
  codes: string;
  codes_lacking: string;
  no_codes: string;
  manage_admins: string;
};
