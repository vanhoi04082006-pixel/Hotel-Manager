/**
 * Admin Module
 * Quản lý dashboard và các chức năng admin
 */

import { showToast, formatCurrency, formatDate } from './utils.js';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, Timestamp, query, where } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let db;

export function initializeAdmin(firebaseDb) {
    db = firebaseDb;
}

/**
 * Lấy thống kê dashboard
 * @returns {Promise<Object>} - Object chứa các thống kê
 */
export async function getDashboardStats() {
    try {
        // Lấy dữ liệu từ Firestore
        const roomsSnap = await getDocs(collection(db, 'rooms'));
        const bookingsSnap = await getDocs(collection(db, 'bookings'));
        const usersSnap = await getDocs(collection(db, 'users'));
        const paymentsSnap = await getDocs(collection(db, 'payments'));

        const rooms = roomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const bookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const payments = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Tính các chỉ số
        const totalRooms = rooms.length;
        const availableRooms = rooms.filter(r => r.status === 'available').length;
        const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
        const maintenanceRooms = rooms.filter(r => r.status === 'maintenance').length;

        const totalBookings = bookings.length;
        const pendingBookings = bookings.filter(b => b.status === 'pending').length;
        const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
        const completedBookings = bookings.filter(b => b.status === 'completed').length;
        const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;

        const totalCustomers = users.filter(u => u.role === 'user').length;
        const vipCustomers = users.filter(u => u.memberType === 'vip').length;

        const totalRevenue = bookings
            .filter(b => b.paymentStatus === 'paid')
            .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

        const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

        return {
            totalRooms,
            availableRooms,
            occupiedRooms,
            maintenanceRooms,
            totalBookings,
            pendingBookings,
            confirmedBookings,
            completedBookings,
            cancelledBookings,
            totalCustomers,
            vipCustomers,
            totalRevenue,
            occupancyRate,
            rooms,
            bookings,
            users,
            payments
        };
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        showToast('Lỗi lấy thống kê: ' + error.message, 'error');
        return null;
    }
}

/**
 * Lấy danh sách phòng
 * @returns {Promise<Array>} - Mảng các phòng
 */
export async function getRooms() {
    try {
        const querySnapshot = await getDocs(collection(db, 'rooms'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Get rooms error:', error);
        return [];
    }
}

/**
 * Lấy danh sách dịch vụ
 * @returns {Promise<Array>} - Mảng các dịch vụ
 */
export async function getServices() {
    try {
        const querySnapshot = await getDocs(collection(db, 'services'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Get services error:', error);
        return [];
    }
}

/**
 * Lấy danh sách nhân viên
 * @returns {Promise<Array>} - Mảng các nhân viên
 */
export async function getStaff() {
    try {
        const querySnapshot = await getDocs(collection(db, 'staff'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Get staff error:', error);
        return [];
    }
}

/**
 * Lấy danh sách khuyến mãi
 * @returns {Promise<Array>} - Mảng các khuyến mãi
 */
export async function getPromotions() {
    try {
        const querySnapshot = await getDocs(collection(db, 'promotions'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Get promotions error:', error);
        return [];
    }
}

/**
 * Lấy danh sách đánh giá
 * @returns {Promise<Array>} - Mảng các đánh giá
 */
export async function getReviews() {
    try {
        const querySnapshot = await getDocs(collection(db, 'reviews'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Get reviews error:', error);
        return [];
    }
}

/**
 * Cập nhật trạng thái phòng
 * @param {string} roomId - ID phòng
 * @param {string} status - Trạng thái mới
 * @returns {Promise}
 */
export async function updateRoomStatus(roomId, status) {
    try {
        await updateDoc(doc(db, 'rooms', roomId), {
            status,
            updatedAt: Timestamp.now()
        });
        showToast('Cập nhật trạng thái phòng thành công', 'success');
    } catch (error) {
        console.error('Update room status error:', error);
        showToast('Lỗi cập nhật trạng thái: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Xóa review
 * @param {string} reviewId - ID review
 * @returns {Promise}
 */
export async function deleteReview(reviewId) {
    try {
        await deleteDoc(doc(db, 'reviews', reviewId));
        showToast('Xóa đánh giá thành công', 'success');
    } catch (error) {
        console.error('Delete review error:', error);
        showToast('Lỗi xóa đánh giá: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Phê duyệt review
 * @param {string} reviewId - ID review
 * @returns {Promise}
 */
export async function approveReview(reviewId) {
    try {
        await updateDoc(doc(db, 'reviews', reviewId), {
            approved: true,
            updatedAt: Timestamp.now()
        });
        showToast('Phê duyệt đánh giá thành công', 'success');
    } catch (error) {
        console.error('Approve review error:', error);
        showToast('Lỗi phê duyệt đánh giá: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Lấy doanh thu theo tháng
 * @returns {Promise<Array>} - Mảng doanh thu theo tháng
 */
export async function getMonthlyRevenue() {
    try {
        const bookingsSnap = await getDocs(
            query(collection(db, 'bookings'), where('paymentStatus', '==', 'paid'))
        );

        const monthlyData = {};
        bookingsSnap.docs.forEach(doc => {
            const booking = doc.data();
            const date = booking.createdAt?.toDate ? booking.createdAt.toDate() : new Date(booking.createdAt || 0);
            const monthKey = date.toLocaleString('vi-VN', { month: 'long', year: 'numeric' });

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = 0;
            }
            monthlyData[monthKey] += booking.totalPrice || 0;
        });

        return Object.entries(monthlyData).map(([month, revenue]) => ({
            month,
            revenue
        }));
    } catch (error) {
        console.error('Get monthly revenue error:', error);
        return [];
    }
}

/**
 * Lấy tỷ lệ công suất phòng theo tháng
 * @returns {Promise<Array>} - Mảng tỷ lệ công suất
 */
export async function getMonthlyOccupancy() {
    try {
        const roomsSnap = await getDocs(collection(db, 'rooms'));
        const bookingsSnap = await getDocs(
            query(collection(db, 'bookings'), where('status', '==', 'completed'))
        );

        const totalRooms = roomsSnap.size;
        const monthlyData = {};

        bookingsSnap.docs.forEach(doc => {
            const booking = doc.data();
            const date = booking.checkIn?.toDate ? booking.checkIn.toDate() : new Date(booking.checkIn || 0);
            const monthKey = date.toLocaleString('vi-VN', { month: 'long', year: 'numeric' });

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = 0;
            }
            monthlyData[monthKey]++;
        });

        return Object.entries(monthlyData).map(([month, occupancy]) => ({
            month,
            occupancy: totalRooms > 0 ? Math.round((occupancy / totalRooms) * 100) : 0
        }));
    } catch (error) {
        console.error('Get monthly occupancy error:', error);
        return [];
    }
}

/**
 * Export dữ liệu sang CSV
 * @param {Array} data - Dữ liệu cần export
 * @param {string} filename - Tên file
 * @param {Array} columns - Tên cột
 */
export function exportToCSV(data, filename, columns) {
    let csv = columns.join(',') + '\n';

    data.forEach(row => {
        const values = columns.map(col => {
            const value = row[col];
            if (typeof value === 'string' && value.includes(',')) {
                return `"${value}"`;
            }
            return value;
        });
        csv += values.join(',') + '\n';
    });

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('Xuất dữ liệu thành công', 'success');
}
