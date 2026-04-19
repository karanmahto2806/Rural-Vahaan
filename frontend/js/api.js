/**
 * API Utility File
 * Purpose: Centralized API calls to backend
 * All other files will use these functions to communicate with server
 */

// API Base URL - change this when deploying
const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// ============================================
// AUTH APIs
// ============================================

// Register new user
async function registerUser(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return await response.json();
    } catch (error) {
        console.error('Register API error:', error);
        return { success: false, message: 'Network error. Please try again.' };
    }
}

// Login user
async function loginUser(credentials) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        return await response.json();
    } catch (error) {
        console.error('Login API error:', error);
        return { success: false, message: 'Network error. Please try again.' };
    }
}

// Get user profile
async function getUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Profile API error:', error);
        return { success: false, message: 'Network error' };
    }
}

// ============================================
// VEHICLE APIs
// ============================================

// Register a new vehicle (Driver only)
async function registerVehicle(vehicleData) {
    try {
        const response = await fetch(`${API_BASE_URL}/vehicles/register`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(vehicleData)
        });
        return await response.json();
    } catch (error) {
        console.error('Register vehicle error:', error);
        return { success: false, message: 'Network error' };
    }
}

// Get all vehicles of logged in driver
async function getMyVehicles() {
    try {
        const response = await fetch(`${API_BASE_URL}/vehicles/my-vehicles`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Get my vehicles error:', error);
        return { success: false, vehicles: [] };
    }
}

// Find nearby vehicles within 5km radius
async function getNearbyVehicles(lat, lng) {
    try {
        const response = await fetch(`${API_BASE_URL}/vehicles/nearby?lat=${lat}&lng=${lng}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        return await response.json();
    } catch (error) {
        console.error('Nearby vehicles error:', error);
        return { success: false, vehicles: [] };
    }
}

// Update vehicle availability (Online/Offline)
async function updateVehicleAvailability(vehicleId, isAvailable) {
    try {
        const response = await fetch(`${API_BASE_URL}/vehicles/availability/${vehicleId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ is_available: isAvailable })
        });
        return await response.json();
    } catch (error) {
        console.error('Update availability error:', error);
        return { success: false, message: 'Network error' };
    }
}

// ============================================
// DRIVER APIs
// ============================================

// Update driver's current location (for live tracking)
async function updateDriverLocation(lat, lng, vehicleId = null) {
    try {
        const response = await fetch(`${API_BASE_URL}/driver/location`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ lat, lng, vehicle_id: vehicleId })
        });
        return await response.json();
    } catch (error) {
        console.error('Update location error:', error);
        return { success: false };
    }
}

// ============================================
// RIDE APIs
// ============================================

// Create a new ride booking (Passenger)
async function createRide(rideData) {
    try {
        const response = await fetch(`${API_BASE_URL}/rides/create`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(rideData)
        });
        return await response.json();
    } catch (error) {
        console.error('Create ride error:', error);
        return { success: false, message: 'Network error' };
    }
}

// Track a ride by code (Anyone with code can access)
async function trackRideByCode(rideCode) {
    try {
        const response = await fetch(`${API_BASE_URL}/rides/track/${rideCode}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        return await response.json();
    } catch (error) {
        console.error('Track ride error:', error);
        return { success: false, message: 'Network error' };
    }
}

// Get all rides of logged in user (passenger or driver)
async function getMyRides() {
    try {
        const response = await fetch(`${API_BASE_URL}/rides/my-rides`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Get my rides error:', error);
        return { success: false, rides: [] };
    }
}

// Get ride requests for driver (pending rides)
async function getRideRequests() {
    try {
        const response = await fetch(`${API_BASE_URL}/rides/requests`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Get ride requests error:', error);
        return { success: false, requests: [] };
    }
}

// Accept a ride request (Driver)
async function acceptRide(rideId) {
    try {
        const response = await fetch(`${API_BASE_URL}/rides/accept/${rideId}`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Accept ride error:', error);
        return { success: false, message: 'Network error' };
    }
}

// Start a ride (Driver)
async function startRide(rideId) {
    try {
        const response = await fetch(`${API_BASE_URL}/rides/start/${rideId}`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Start ride error:', error);
        return { success: false, message: 'Network error' };
    }
}

// Complete a ride and add rating (Passenger or Driver)
async function completeRide(rideId, rating, review) {
    try {
        const response = await fetch(`${API_BASE_URL}/rides/complete/${rideId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ rating, review })
        });
        return await response.json();
    } catch (error) {
        console.error('Complete ride error:', error);
        return { success: false, message: 'Network error' };
    }
}

// ============================================
// EMERGENCY APIs
// ============================================

// Send SOS emergency alert
async function sendSOSAlert(rideCode, lat, lng, message) {
    try {
        const response = await fetch(`${API_BASE_URL}/emergency/sos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ ride_code: rideCode, lat, lng, message })
        });
        return await response.json();
    } catch (error) {
        console.error('SOS error:', error);
        return { success: false, message: 'Network error' };
    }
}

// ============================================
// HEALTH CHECK API
// ============================================

// Check if backend server is running
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        return await response.json();
    } catch (error) {
        console.error('Health check error:', error);
        return { success: false, message: 'Server not reachable' };
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Check if user is logged in
function isLoggedIn() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
}

// Get logged in user data
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
        return {};
    }
}

// Logout user
function logoutUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Format distance in km
function formatDistance(distanceKm) {
    if (!distanceKm) return 'N/A';
    if (distanceKm < 1) {
        return `${(distanceKm * 1000).toFixed(0)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
}

// Format currency in Indian Rupees
function formatCurrency(amount) {
    if (!amount) return 'Contact for price';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

// Get vehicle icon emoji based on type
function getVehicleIcon(vehicleType) {
    const icons = {
        'tractor': '🚜',
        'bike': '🏍️',
        'car': '🚗',
        'mini_truck': '🚛',
        'tempo': '🚐',
        'jcb': '🏗️',
        'auto_rickshaw': '🛺',
        'e_rickshaw': '🔋🛺',
        'jeep': '🚙',
        'harvester': '🌾',
        'water_tanker': '💧',
        'ambulance': '🚑',
        'pickup_truck': '🛻'
    };
    return icons[vehicleType] || '🚗';
}

// Get status badge class
function getStatusBadgeClass(status) {
    const classes = {
        'pending': 'status-pending',
        'accepted': 'status-accepted',
        'started': 'status-started',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return classes[status] || 'status-pending';
}

// Get status text
function getStatusText(status) {
    const texts = {
        'pending': '⏳ Pending',
        'accepted': '✅ Accepted',
        'started': '🚗 Started',
        'completed': '✓ Completed',
        'cancelled': '✗ Cancelled'
    };
    return texts[status] || status;
}

// Show alert message
function showAlert(message, type = 'success') {
    const alertDiv = document.getElementById('globalAlert');
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.display = 'block';
        
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 3000);
    } else {
        // Fallback to alert if no global alert div
        if (type === 'error') {
            alert('❌ ' + message);
        } else {
            alert('✅ ' + message);
        }
    }
}

// Export functions for use in other files
window.api = {
    registerUser,
    loginUser,
    getUserProfile,
    registerVehicle,
    getMyVehicles,
    getNearbyVehicles,
    updateVehicleAvailability,
    updateDriverLocation,
    createRide,
    trackRideByCode,
    getMyRides,
    getRideRequests,
    acceptRide,
    startRide,
    completeRide,
    sendSOSAlert,
    checkHealth,
    isLoggedIn,
    getCurrentUser,
    logoutUser,
    formatDistance,
    formatCurrency,
    getVehicleIcon,
    getStatusBadgeClass,
    getStatusText,
    showAlert
};