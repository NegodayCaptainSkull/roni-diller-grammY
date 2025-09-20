import admin from 'firebase-admin'
import axios from 'axios';
import { Code, CodesForProduct, CryptobotDeposit, PaymentDetails, PendingCheck, Product, User } from './types.js';
import serviceAccount from '../secrets/serviceAccountKey.json' with { type: 'json' };
import dotenv from 'dotenv';
dotenv.config();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  databaseURL: "https://ronidbot-default-rtdb.firebaseio.com"
});

export const database = admin.database();

export const token = process.env.token || '';

// Environment variables
// const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
// const URL = process.env.URL || 'https://ronidbot.onrender.com';
export const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';
export const DEPOSIT_GROUP_ID = process.env.DEPOSIT_GROUP_ID || '';
export const ORDERS_GROUP_ID = process.env.ORDERS_GROUP_ID || '';
export const CRYPTOBOT_ID = process.env.CRYPTOBOT_ID || '';
const ACTIVATOR_USERNAME = process.env.ACTIVATOR_USERNAME || '';
const ACTIVATOR_TOKEN = process.env.ACTIVATOR_TOKEN || '';
const KOKOS_API_URL = process.env.KOKOS_API_URL || '';
export const BYBIT_API_URL = process.env.BYBIT_API_URL || '';
export const BYBIT_API_KEY = process.env.BYBIT_API_KEY || '';
export const BYBIT_SECRET = process.env.BYBIT_SECRET || '';
const FRAGMENT_API_KEY = process.env.FRAGMENT_API_KEY || '';
const FRAGMENT_API_URL = process.env.FRAGMENT_API_URL || '';
const FRAGMENT_TOKEN = process.env.FRAGMENT_TOKEN || '';

export const activatorApi = axios.create({
  baseURL: KOKOS_API_URL,
  headers: {
    'Authorization': `${ACTIVATOR_USERNAME} ${ACTIVATOR_TOKEN}`,
    "Content-Type": 'application/json'
  }
});

export const fragmentApi = axios.create({
  baseURL: FRAGMENT_API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `JWT ${FRAGMENT_TOKEN}`
  }
});

export const refs = {
  admins: database.ref('admins'),
  paymentDetails: database.ref('paymentDetails'),
  productsCodes: database.ref('productsCodes'),
  productsPremium: database.ref('productsPremium'),
  productsPromo: database.ref('productsPromo'),
  starsPrice: database.ref('starsPrice'),
  users: database.ref('users'),
  pendingChecks: database.ref('pendingChecks'),
  cryptobotDeposits: database.ref('cryptobotDeposits'),
  orders: database.ref('orders'),
  codes: database.ref('codes')
}

let _admins: Record<string, boolean> = {};
let _paymentDetails: PaymentDetails = {
  ByBit: '327308525',
  CryptoBot: 'http://t.me/send?start=IVGW3jJOOu59'
};
let _productsCodes: Product[] = [];
let _starsPrice: number = 0;
let _productsPremium: Product[] = [];
let _productsPromo: Product[] = [];
let _users: Record<string, User> = {};
let _pendingChecks: Record<string, PendingCheck> = {};
let _cryptobotDeposits: Record<string, CryptobotDeposit> = {};
let _codes: Record<string, CodesForProduct> = {};

let _isInitializing: boolean = true;

export const getAdmins = () => _admins;
export const getPaymentDetails = () => _paymentDetails;
export const getProductsCodes = () => _productsCodes;
export const getStarsPrice = () => _starsPrice;
export const getProductsPremium = () => _productsPremium;
export const getProductsPromo = () => _productsPromo;
export const getUser = (userId: string | number) => _users[userId];
export const getUserBalance = (userId: string | number) => _users[userId].balance;
export const getUserLanguage = (userId: string | number) => _users[userId].language;
export const getAllUsers = () => _users;
export const getPendingChecks = () => _pendingChecks;
export const getCryptobotDeposits = () => _cryptobotDeposits;
export const getCodes = (productLabel: string) => _codes[productLabel] || {};

export const isInitializing = () => _isInitializing;

export const setAdmins = async (newAdmins: Record<string, boolean>) => {
  _admins = newAdmins;
  await refs.admins.set(newAdmins);
};

export const setPaymentDetails = async (method: 'ByBit' | 'CryptoBot', newPaymentDetails: string) => {
  _paymentDetails[method] = newPaymentDetails;
  await refs.paymentDetails.set(newPaymentDetails);
};

export const setProductsCodes = async (newProductsCodes: Product[]) => {
  _productsCodes = newProductsCodes;
  await refs.productsCodes.set(newProductsCodes);
};

export const setStarsPrice = async (newStarsPrice: number) => {
  _starsPrice = newStarsPrice;
  await refs.starsPrice.set(newStarsPrice);
};

export const setProductsPremium = async (newProductsPremium: Product[]) => {
  _productsPremium = newProductsPremium;
  await refs.productsPremium.set(newProductsPremium);
};

export const setProductsPromo = async (newProductsPromo: Product[]) => {
  _productsPromo = newProductsPromo;
  await refs.productsPromo.set(newProductsPromo);
};

export const setUserBalance = async (userId: string | number, newBalance: number) => {
  _users[userId].balance = newBalance;
  await refs.users.child(userId.toString()).child("balance").set(newBalance);
};

export const setUserLanguage = async (userId: string | number, lang: string) => {
  _users[userId].language = lang;
  await refs.users.child(userId.toString()).update({language: lang});
};

export const createUser = async (userId: string | number) => {
  const newUser = {
    balance: 0,
    language: "ru"
  };

  _users[userId] = newUser

  await refs.users.child(userId.toString()).set(newUser);
};

export const setPendingCheck = async (userId: string | number, newPendingCheck: PendingCheck) => {
  _pendingChecks[userId] = newPendingCheck;
  await refs.pendingChecks.child(userId.toString()).set(newPendingCheck);
};

export const setCryptobotDeposits = async (newCryptobotDeposits: Record<string, CryptobotDeposit>) => {
  _cryptobotDeposits = newCryptobotDeposits;
  await refs.cryptobotDeposits.set(newCryptobotDeposits);
};

export const addCodes = async (productLabel: string, codes: string[]) => {
  const updates: Record<string, Code> = {};

  codes.forEach(code => {
    const newCodeRef = refs.codes.child(productLabel).push();
    updates[newCodeRef.key] = {
      code: code,
      addedAt: Date.now()
    };
  });

  await refs.codes.child(productLabel).update(updates);

  _codes[productLabel] = {..._codes[productLabel], ...updates};
};

export const deleteCodes = async (productLabel: string, codeIds: string[]) => {
  const leftCodes = _codes[productLabel];
  codeIds.forEach(codeId => {
    delete leftCodes[codeId]
  });
  _codes[productLabel] = leftCodes;
  await refs.codes.child(productLabel).set(leftCodes);
};

export const deleteUser = async (userId: string) => {
  const newUsers = { ..._users };
  delete newUsers[userId];
  _users = newUsers;
  await refs.users.set(newUsers);
};

export const deleteCryptobotDeposits = async (userId: string) => {
  const updatedDeposits = { ..._cryptobotDeposits };
  delete updatedDeposits[userId];
  await setCryptobotDeposits(updatedDeposits);
}

export const deletePendingChecks = async (userId: string) => {
  const updatedPendingChecks = { ..._pendingChecks };
  delete updatedPendingChecks[userId];
  _pendingChecks = updatedPendingChecks;
  await refs.pendingChecks.set(updatedPendingChecks);
}

export async function initializeFirebaseData(): Promise<void> {
  try {
    // Load admins
    const adminsSnapshot = await refs.admins.once('value');
    _admins = adminsSnapshot.val() || {};
    if (Object.keys(_admins).length === 0) {
      const newAdmins = {
        [ADMIN_CHAT_ID]: true
      };
      await setAdmins(newAdmins);
    }
    
    // Load payment details
    const paymentDetailsSnapshot = await refs.paymentDetails.once('value');
    const paymentDetailsData = paymentDetailsSnapshot.val();
    if (paymentDetailsData) {
      _paymentDetails = paymentDetailsData;
    }
    
    // Load products
    const productsCodesSnapshot = await refs.productsCodes.once('value');
    _productsCodes = productsCodesSnapshot.val() || [];
    
    // Load stars price
    const starsPriceSnapshot = await refs.starsPrice.once('value');
    _starsPrice = starsPriceSnapshot.val() || 0;
    
    // Load premium products
    const premiumSnapshot = await refs.productsPremium.once('value');
    _productsPremium = premiumSnapshot.val() || [];
    
    // Load promo products
    const promoSapshot = await refs.productsPromo.once('value');
    _productsPromo = promoSapshot.val() || [];
    
    // Load users
    const users = await refs.users.once('value');
    _users = users.val() || {};
    
    // Load pending checks
    const pendingChecksSnapshot = await refs.pendingChecks.once('value');
    _pendingChecks = pendingChecksSnapshot.val() || {};
    
    // Load cryptobot deposits
    const cryptobotDepositsSnapshot = await refs.cryptobotDeposits.once('value');
    _cryptobotDeposits = cryptobotDepositsSnapshot.val() || {};

    const codesSnapshot = await refs.codes.once('value');
    _codes = codesSnapshot.val() || {};
    
    console.log('✅ Firebase data initialized');
    _isInitializing = false;
  } catch (error) {
    _isInitializing = false;
    console.error('❌ Error initializing Firebase data:', error);
  }
};