/**
 * Booking Module
 * Quản lý các đặt phòng của khách hàng
 */

import { showToast, calculateNights, generateId, formatDate } from './utils.js';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, Timestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let db;

export function initializeBooking(firebaseDb) {
    db = firebaseDb;
}

/**
 * Tạo đặt phòng mới
 * @param {Object} bookingData - Dữ liệu đặt phòng
 * @returns {Promise<string>} - ID của đặt phòng
 */
export async function createBooking(bookingData) {
    try {
        const booking = {
            ...bookingData,
            bookingCode: 'BK' + Date.now(),
            status: 'pending',
            paymentStatus: 'unpaid',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, 'bookings'), booking);
        showToast('Đặt phòng thành công', 'success');
        return docRef.id;
    } catch (error) {
        console.error('Create booking error:', error);
        showToast('Lỗi tạo đặt phòng: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Cập nhật đặt phòng
 * @param {string} bookingId - ID đặt phòng
 * @param {Object} updates - Dữ liệu cần cập nhật
 * @returns {Promise}
 */
export async function updateBooking(bookingId, updates) {
    try {
        await updateDoc(doc(db, 'bookings', bookingId), {
            ...updates,
            updatedAt: Timestamp.now()
        });
        showToast('Cập nhật đặt phòng thành công', 'success');
    } catch (error) {
        console.error('Update booking error:', error);
        showToast('Lỗi cập nhật đặt phòng: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Xóa đặt phòng
 * @param {string} bookingId - ID đặt phòng
 * @returns {Promise}
 */
export async function deleteBooking(bookingId) {
    try {
        await deleteDoc(doc(db, 'bookings', bookingId));
        showToast('Xóa đặt phòng thành công', 'success');
    } catch (error) {
        console.error('Delete booking error:', error);
        showToast('Lỗi xóa đặt phòng: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Lấy danh sách đặt phòng của người dùng
 * @param {string} userId - ID người dùng
 * @returns {Promise<Array>} - Mảng các đặt phòng
 */
export async function getUserBookings(userId) {
    try {
        const q = query(collection(db, 'bookings'), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Get user bookings error:', error);
        showToast('Lỗi lấy danh sách đặt phòng: ' + error.message, 'error');
        return [];
    }
}

/**
 * Lấy danh sách tất cả đặt phòng (dành cho admin)
 * @returns {Promise<Array>} - Mảng các đặt phòng
 */
export async function getAllBookings() {
    try {
        const querySnapshot = await getDocs(collection(db, 'bookings'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
        });
    } catch (error) {
        console.error('Get all bookings error:', error);
        showToast('Lỗi lấy danh sách đặt phòng: ' + error.message, 'error');
        return [];
    }
}

/**
 * Cập nhật trạng thái đặt phòng
 * @param {string} bookingId - ID đặt phòng
 * @param {string} status - Trạng thái mới (pending, confirmed, completed, cancelled)
 * @returns {Promise}
 */
export async function updateBookingStatus(bookingId, status) {
    try {
        await updateBooking(bookingId, { status });
    } catch (error) {
        console.error('Update booking status error:', error);
        throw error;
    }
}

/**
 * Cập nhật trạng thái thanh toán
 * @param {string} bookingId - ID đặt phòng
 * @param {string} paymentStatus - Trạng thái thanh toán (unpaid, paid, refunded)
 * @returns {Promise}
 */
export async function updatePaymentStatus(bookingId, paymentStatus) {
    try {
        await updateBooking(bookingId, { paymentStatus });
    } catch (error) {
        console.error('Update payment status error:', error);
        throw error;
    }
}

/**
 * Check xem phòng còn trống vào những ngày nhất định không
 * @param {string} roomId - ID phòng
 * @param {Date} checkIn - Ngày nhận phòng
 * @param {Date} checkOut - Ngày trả phòng
 * @returns {Promise<boolean>} - true nếu còn trống
 */
export async function isRoomAvailable(roomId, checkIn, checkOut) {
    try {
        const bookings = await getDocs(
            query(
                collection(db, 'bookings'),
                where('roomId', '==', roomId),
                where('status', 'in', ['pending', 'confirmed'])
            )
        );

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        for (let doc of bookings.docs) {
            const booking = doc.data();
            const bookingCheckIn = booking.checkIn?.toDate ? booking.checkIn.toDate() : new Date(booking.checkIn);
            const bookingCheckOut = booking.checkOut?.toDate ? booking.checkOut.toDate() : new Date(booking.checkOut);

            // Check xem có overlap không
            if (!(checkOutDate <= bookingCheckIn || checkInDate >= bookingCheckOut)) {
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('Check room availability error:', error);
        return false;
    }
}

/**
 * Lấy số đặt phòng của một phòng
 * @param {string} roomId - ID phòng
 * @returns {Promise<number>} - Số đặt phòng
 */
export async function getBookingCountForRoom(roomId) {
    try {
        const q = query(collection(db, 'bookings'), where('roomId', '==', roomId), where('status', '==', 'completed'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.size;
    } catch (error) {
        console.error('Get booking count error:', error);
        return 0;
    }
}

/**
 * Tính doanh thu trong khoảng thời gian
 * @param {Date} startDate - Ngày bắt đầu
 * @param {Date} endDate - Ngày kết thúc
 * @returns {Promise<number>} - Tổng doanh thu
 */
export async function calculateRevenue(startDate, endDate) {
    try {
        const bookings = await getDocs(
            query(
                collection(db, 'bookings'),
                where('paymentStatus', '==', 'paid')
            )
        );

        let revenue = 0;
        bookings.docs.forEach(doc => {
            const booking = doc.data();
            const createdAt = booking.createdAt?.toDate ? booking.createdAt.toDate() : new Date(booking.createdAt || 0);
            if (createdAt >= startDate && createdAt <= endDate) {
                revenue += booking.totalPrice || 0;
            }
        });

        return revenue;
    } catch (error) {
        console.error('Calculate revenue error:', error);
        return 0;
    }
}

/**
 * Lấy danh sách đặt phòng cần xác nhận (pending)
 * @returns {Promise<Array>} - Mảng các đặt phòng pending
 */
export async function getPendingBookings() {
    try {
        const q = query(collection(db, 'bookings'), where('status', '==', 'pending'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Get pending bookings error:', error);
        return [];
    }
}

/**
 * Validate dữ liệu đặt phòng
 * @param {Object} bookingData - Dữ liệu đặt phòng
 * @returns {Array<string>} - Mảng các lỗi (empty nếu không có lỗi)
 */
export function validateBookingData(bookingData) {
    const errors = [];

    if (!bookingData.roomId) errors.push('Vui lòng chọn phòng');
    if (!bookingData.checkIn) errors.push('Vui lòng chọn ngày nhận phòng');
    if (!bookingData.checkOut) errors.push('Vui lòng chọn ngày trả phòng');

    if (bookingData.checkIn && bookingData.checkOut) {
        const checkIn = new Date(bookingData.checkIn);
        const checkOut = new Date(bookingData.checkOut);
        if (checkOut <= checkIn) {
            errors.push('Ngày trả phòng phải sau ngày nhận phòng');
        }
    }

    if (!bookingData.userName) errors.push('Vui lòng nhập tên khách hàng');
    if (!bookingData.userEmail) errors.push('Vui lòng nhập email');
    if (!bookingData.userPhone) errors.push('Vui lòng nhập số điện thoại');

    return errors;
}
