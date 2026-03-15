/**
 * Payment Module
 * Quản lý thanh toán và giao dịch
 */

import { showToast, formatCurrency, generateId } from './utils.js';
import { getFirestore, collection, addDoc, updateDoc, doc, getDocs, query, where, Timestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let db;

export function initializePayment(firebaseDb) {
    db = firebaseDb;
}

/**
 * Tạo giao dịch thanh toán
 * @param {Object} paymentData - Dữ liệu thanh toán
 * @returns {Promise<string>} - ID của giao dịch
 */
export async function createPayment(paymentData) {
    try {
        const payment = {
            ...paymentData,
            transactionId: 'TXN' + Date.now() + generateId(8).toUpperCase(),
            status: 'pending',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, 'payments'), payment);
        return docRef.id;
    } catch (error) {
        console.error('Create payment error:', error);
        showToast('Lỗi tạo giao dịch: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Cập nhật trạng thái thanh toán
 * @param {string} paymentId - ID giao dịch
 * @param {string} status - Trạng thái mới (pending, completed, failed)
 * @returns {Promise}
 */
export async function updatePaymentStatus(paymentId, status) {
    try {
        await updateDoc(doc(db, 'payments', paymentId), {
            status,
            updatedAt: Timestamp.now()
        });
        showToast('Cập nhật trạng thái thanh toán thành công', 'success');
    } catch (error) {
        console.error('Update payment status error:', error);
        showToast('Lỗi cập nhật trạng thái: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Lấy danh sách thanh toán của người dùng
 * @param {string} userId - ID người dùng
 * @returns {Promise<Array>} - Mảng các giao dịch
 */
export async function getUserPayments(userId) {
    try {
        const q = query(collection(db, 'payments'), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
        });
    } catch (error) {
        console.error('Get user payments error:', error);
        return [];
    }
}

/**
 * Lấy danh sách tất cả thanh toán (dành cho admin)
 * @returns {Promise<Array>} - Mảng các giao dịch
 */
export async function getAllPayments() {
    try {
        const querySnapshot = await getDocs(collection(db, 'payments'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
        });
    } catch (error) {
        console.error('Get all payments error:', error);
        return [];
    }
}

/**
 * Validate card number
 * @param {string} cardNumber - Số thẻ
 * @returns {boolean}
 */
export function validateCardNumber(cardNumber) {
    const cleaned = cardNumber.replace(/\s/g, '');
    return /^\d{13,19}$/.test(cleaned);
}

/**
 * Validate card expiry
 * @param {string} expiry - Hạn thẻ (MM/YY)
 * @returns {boolean}
 */
export function validateCardExpiry(expiry) {
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return false;

    const [month, year] = expiry.split('/');
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;

    const expiryYear = parseInt(year);
    const expiryMonth = parseInt(month);

    if (expiryYear < currentYear) return false;
    if (expiryYear === currentYear && expiryMonth < currentMonth) return false;

    return true;
}

/**
 * Validate CVV
 * @param {string} cvv - CVV
 * @returns {boolean}
 */
export function validateCVV(cvv) {
    return /^\d{3,4}$/.test(cvv);
}

/**
 * Validate thông tin thẻ
 * @param {Object} cardData - Thông tin thẻ
 * @returns {Array<string>} - Mảng các lỗi
 */
export function validateCardData(cardData) {
    const errors = [];

    if (!validateCardNumber(cardData.cardNumber)) {
        errors.push('Số thẻ không hợp lệ');
    }

    if (!validateCardExpiry(cardData.expiry)) {
        errors.push('Hạn thẻ không hợp lệ hoặc đã hết hạn');
    }

    if (!validateCVV(cardData.cvv)) {
        errors.push('CVV không hợp lệ');
    }

    if (!cardData.name || cardData.name.trim().length === 0) {
        errors.push('Tên chủ thẻ không được để trống');
    }

    return errors;
}

/**
 * Format card number để hiển thị
 * @param {string} cardNumber - Số thẻ
 * @returns {string} - Số thẻ đã format
 */
export function formatCardNumberDisplay(cardNumber) {
    const cleaned = cardNumber.replace(/\s/g, '');
    const masked = cleaned.slice(0, -4).replace(/\d/g, '*') + cleaned.slice(-4);
    return masked.replace(/(\*{4})(\*{4})/g, '$1 $2').replace(/(.{12})(.{4})/g, '$1 $2');
}

/**
 * Lấy số tiền thanh toán cho booking
 * @param {string} bookingId - ID booking
 * @returns {Promise<number>} - Số tiền
 */
export async function getPaymentAmountForBooking(bookingId) {
    try {
        const q = query(collection(db, 'bookings'), where('id', '==', bookingId));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return 0;
        return querySnapshot.docs[0].data().totalPrice || 0;
    } catch (error) {
        console.error('Get payment amount error:', error);
        return 0;
    }
}

/**
 * Lấy số tiền đã thanh toán cho booking
 * @param {string} bookingId - ID booking
 * @returns {Promise<number>} - Số tiền đã thanh toán
 */
export async function getPaidAmountForBooking(bookingId) {
    try {
        const q = query(
            collection(db, 'payments'),
            where('bookingId', '==', bookingId),
            where('status', '==', 'completed')
        );
        const querySnapshot = await getDocs(q);
        let total = 0;
        querySnapshot.docs.forEach(doc => {
            total += doc.data().amount || 0;
        });
        return total;
    } catch (error) {
        console.error('Get paid amount error:', error);
        return 0;
    }
}

/**
 * Check xem booking đã thanh toán đủ chưa
 * @param {string} bookingId - ID booking
 * @returns {Promise<boolean>}
 */
export async function isBookingFullyPaid(bookingId) {
    try {
        const requiredAmount = await getPaymentAmountForBooking(bookingId);
        const paidAmount = await getPaidAmountForBooking(bookingId);
        return paidAmount >= requiredAmount;
    } catch (error) {
        console.error('Check fully paid error:', error);
        return false;
    }
}
