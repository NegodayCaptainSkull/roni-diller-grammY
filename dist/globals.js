import admin from 'firebase-admin';
export const database = admin.database();
// Environment variables
// const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
// const URL = process.env.URL || 'https://ronidbot.onrender.com';
export const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';
export const DEPOSIT_GROUP_ID = process.env.DEPOSIT_GROUP_ID || '';
export const ORDERS_GROUP_ID = process.env.ORDERS_GROUP_ID || '';
export const CRYPTOBOT_ID = process.env.CRYPTOBOT_ID || '';
export const refs = {
    admins: database.ref('admins'),
    paymentDetails: database.ref('paymentDetails'),
    productsId: database.ref('productsId'),
    productsCodes: database.ref('productsCodes'),
    productsPremium: database.ref('productsPremium'),
    productsPromo: database.ref('productsPromo'),
    starsPrice: database.ref('starsPrice'),
    userBalances: database.ref('userBalances'),
    pendingChecks: database.ref('pendingChecks'),
    cryptobotDeposits: database.ref('cryptobotDeposits'),
    orders: database.ref('orders'),
    codes: database.ref('codes')
};
let _admins = {};
let _paymentDetails = {
    ByBit: '327308525',
    CryptoBot: 'http://t.me/send?start=IVGW3jJOOu59'
};
let _productsCodes = [];
let _productsId = [];
let _starsPrice = 0;
let _productsPremium = [];
let _productsPromo = [];
let _userBalances = {};
let _pendingChecks = {};
let _cryptobotDeposits = {};
export const getAdmins = () => _admins;
export const getPaymentDetails = () => _paymentDetails;
export const getProductsCodes = () => _productsCodes;
export const getProductsId = () => _productsId;
export const getStarsPrice = () => _starsPrice;
export const getProductsPremium = () => _productsPremium;
export const getProductsPromo = () => _productsPromo;
export const getUserBalance = (userId) => _userBalances[userId];
export const getAllBalances = () => _userBalances;
export const getPendingChecks = () => _pendingChecks;
export const getCryptobotDeposits = () => _cryptobotDeposits;
export const setAdmins = async (newAdmins) => {
    _admins = newAdmins;
    await refs.admins.set(newAdmins);
};
export const setPaymentDetails = async (method, newPaymentDetails) => {
    _paymentDetails[method] = newPaymentDetails;
    await refs.paymentDetails.set(newPaymentDetails);
};
export const setProductsCodes = async (newProductsCodes) => {
    _productsCodes = newProductsCodes;
    await refs.productsCodes.set(newProductsCodes);
};
export const setProductsId = async (newProductsId) => {
    _productsId = newProductsId;
    await refs.productsId.set(newProductsId);
};
export const setStarsPrice = async (newStarsPrice) => {
    _starsPrice = newStarsPrice;
    await refs.starsPrice.set(newStarsPrice);
};
export const setProductsPremium = async (newProductsPremium) => {
    _productsPremium = newProductsPremium;
    await refs.productsPremium.set(newProductsPremium);
};
export const setProductsPromo = async (newProductsPromo) => {
    _productsPromo = newProductsPromo;
    await refs.productsPromo.set(newProductsPromo);
};
export const setUserBalance = async (userId, newBalance) => {
    _userBalances[userId] = newBalance;
    await refs.userBalances.child(userId.toString()).set(newBalance);
};
export const setPendingCheck = async (userId, newPendingCheck) => {
    _pendingChecks[userId] = newPendingCheck;
    await refs.pendingChecks.child(userId.toString()).set(newPendingCheck);
};
export const setCryptobotDeposits = async (newCryptobotDeposits) => {
    _cryptobotDeposits = newCryptobotDeposits;
    await refs.cryptobotDeposits.set(newCryptobotDeposits);
};
export const deleteUserBalance = async (userId) => {
    const newBalances = { ..._userBalances };
    delete newBalances[userId];
    _userBalances = newBalances;
    await refs.userBalances.set(newBalances);
};
export const deleteCryptobotDeposits = async (userId) => {
    const updatedDeposits = { ..._cryptobotDeposits };
    delete updatedDeposits[userId];
    await setCryptobotDeposits(updatedDeposits);
};
export const deletePendingChecks = async (userId) => {
    const updatedPendingChecks = { ..._pendingChecks };
    delete updatedPendingChecks[userId];
    _pendingChecks = updatedPendingChecks;
    await refs.pendingChecks.set(updatedPendingChecks);
};
export async function initializeFirebaseData() {
    try {
        // Load admins
        const adminsSnapshot = await refs.admins.once('value');
        _admins = adminsSnapshot.val() || {};
        if (Object.keys(_admins).length === 0) {
            _admins[ADMIN_CHAT_ID] = true;
            await refs.admins.set(_admins);
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
        const productsIdSnapshot = await refs.productsId.once('value');
        _productsId = productsIdSnapshot.val() || [];
        // Load stars price
        const starsPriceSnapshot = await refs.starsPrice.once('value');
        _starsPrice = starsPriceSnapshot.val() || 0;
        // Load premium products
        const premiumSnapshot = await refs.productsPremium.once('value');
        _productsPremium = premiumSnapshot.val() || [];
        // Load promo products
        const promoSapshot = await refs.productsPromo.once('value');
        _productsPromo = promoSapshot.val() || [];
        // Load user balances
        const userBalancesSnapshot = await refs.userBalances.once('value');
        _userBalances = userBalancesSnapshot.val() || {};
        // Load pending checks
        const pendingChecksSnapshot = await refs.pendingChecks.once('value');
        _pendingChecks = pendingChecksSnapshot.val() || {};
        // Load cryptobot deposits
        const cryptobotDepositsSnapshot = await refs.cryptobotDeposits.once('value');
        _cryptobotDeposits = cryptobotDepositsSnapshot.val() || {};
        console.log('✅ Firebase data initialized');
    }
    catch (error) {
        console.error('❌ Error initializing Firebase data:', error);
    }
}
;
