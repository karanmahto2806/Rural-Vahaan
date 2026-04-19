/**
 * Ride Tracking Functions
 * Purpose: Handle ride tracking functionality for family members
 * Features: Track ride by code, live location updates, ride status, emergency alerts
 */

// ============================================
// GLOBAL VARIABLES
// ============================================

let trackMap = null;
let vehicleMarker = null;
let pickupMarker = null;
let dropMarker = null;
let refreshInterval = null;
let currentRide = null;
let currentRideCode = null;

// ============================================
// INITIALIZE TRACKING PAGE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Get ride code from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    
    if (codeFromUrl) {
        document.getElementById('rideCode').value = codeFromUrl;
        trackRide();
    }
    
    // Setup enter key press
    const rideCodeInput = document.getElementById('rideCode');
    if (rideCodeInput) {
        rideCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                trackRide();
            }
        });
    }
});

// ============================================
// TRACK RIDE BY CODE
// ============================================

async function trackRide() {
    const rideCodeInput = document.getElementById('rideCode');
    const rideCode = rideCodeInput?.value.trim().toUpperCase();
    
    if (!rideCode) {
        showAlert('Please enter a ride code', 'error');
        return;
    }
    
    currentRideCode = rideCode;
    
    // Show loading state
    const trackBtn = event?.target;
    const originalText = trackBtn?.innerText || 'Track Now →';
    if (trackBtn) {
        trackBtn.innerText = 'Loading...';
        trackBtn.disabled = true;
    }
    
    try {
        const result = await api.trackRideByCode(rideCode);
        
        if (result.success) {
            currentRide = result.ride;
            displayRideInfo(currentRide);
            showTrackingSection();
            startAutoRefresh();
        } else {
            showAlert(result.message || 'Ride not found. Please check the ride code.', 'error');
            hideTrackingSection();
        }
    } catch (error) {
        console.error('Track error:', error);
        showAlert('Server error. Please try again.', 'error');
        hideTrackingSection();
    } finally {
        if (trackBtn) {
            trackBtn.innerText = originalText;
            trackBtn.disabled = false;
        }
    }
}

// ============================================
// DISPLAY RIDE INFORMATION
// ============================================

function displayRideInfo(ride) {
    // Display ride code
    const displayCode = document.getElementById('displayRideCode');
    if (displayCode) {
        displayCode.innerText = ride.ride_code;
    }
    
    // Build status HTML
    const statusHTML = buildStatusHTML(ride);
    const rideStatus = document.getElementById('rideStatus');
    if (rideStatus) {
        rideStatus.innerHTML = statusHTML;
    }
    
    // Initialize map
    initTrackingMap(ride);
}

// ============================================
// BUILD STATUS HTML
// ============================================

function buildStatusHTML(ride) {
    const statusClass = api.getStatusBadgeClass(ride.status);
    const statusText = api.getStatusText(ride.status);
    const createdDate = new Date(ride.created_at).toLocaleString();
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div style="text-align: right;">
                <small>Booked on: ${createdDate}</small>
            </div>
        </div>
        <hr style="margin: 1rem 0; border-color: #eee;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div>
                <strong>👤 Passenger</strong><br>
                ${ride.passenger_name || 'N/A'}<br>
                <small>📞 ${ride.passenger_phone || 'N/A'}</small>
            </div>
            <div>
                <strong>🚗 Driver</strong><br>
                ${ride.driver_name || 'N/A'}<br>
                <small>📞 ${ride.driver_phone || 'N/A'}</small>
            </div>
            <div>
                <strong>🚙 Vehicle</strong><br>
                ${ride.vehicle_name || ride.vehicle_type || 'N/A'}<br>
                <small>🔢 ${ride.vehicle_number || 'N/A'}</small>
            </div>
            <div>
                <strong>💰 Fare</strong><br>
                ₹${ride.fare || '0'}
            </div>
        </div>
    `;
    
    // Add pickup location if available
    if (ride.pickup_address || (ride.pickup_lat && ride.pickup_lng)) {
        html += `
            <hr style="margin: 1rem 0; border-color: #eee;">
            <div>
                <strong>📍 Pickup Location:</strong><br>
                ${ride.pickup_address || `Lat: ${ride.pickup_lat?.toFixed(6)}, Lng: ${ride.pickup_lng?.toFixed(6)}`}
            </div>
        `;
    }
    
    // Add drop location if available
    if (ride.drop_address || (ride.drop_lat && ride.drop_lng)) {
        html += `
            <div style="margin-top: 0.5rem;">
                <strong>📍 Drop Location:</strong><br>
                ${ride.drop_address || `Lat: ${ride.drop_lat?.toFixed(6)}, Lng: ${ride.drop_lng?.toFixed(6)}`}
            </div>
        `;
    }
    
    return html;
}

// ============================================
// INITIALIZE TRACKING MAP
// ============================================

function initTrackingMap(ride) {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    // Determine center for map
    let centerLat = DEFAULT_CENTER.lat;
    let centerLng = DEFAULT_CENTER.lng;
    
    if (ride.current_lat && ride.current_lng) {
        centerLat = ride.current_lat;
        centerLng = ride.current_lng;
    } else if (ride.pickup_lat && ride.pickup_lng) {
        centerLat = ride.pickup_lat;
        centerLng = ride.pickup_lng;
    }
    
    // Initialize map using mapUtils
    if (trackMap) {
        trackMap.remove();
    }
    
    trackMap = L.map('map').setView([centerLat, centerLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(trackMap);
    
    // Update markers on map
    updateMapMarkers(ride);
}

// ============================================
// UPDATE MAP MARKERS
// ============================================

function updateMapMarkers(ride) {
    if (!trackMap) return;
    
    // Clear existing markers
    if (vehicleMarker) trackMap.removeLayer(vehicleMarker);
    if (pickupMarker) trackMap.removeLayer(pickupMarker);
    if (dropMarker) trackMap.removeLayer(dropMarker);
    
    // Add vehicle marker (if location available)
    if (ride.current_lat && ride.current_lng) {
        const vehicleIcon = api.getVehicleIcon(ride.vehicle_type);
        vehicleMarker = L.marker([ride.current_lat, ride.current_lng], {
            icon: L.divIcon({
                html: vehicleIcon,
                iconSize: [35, 35],
                className: 'vehicle-marker'
            })
        }).addTo(trackMap).bindPopup(`
            <b>Vehicle Location</b><br>
            Driver: ${ride.driver_name}<br>
            Status: ${ride.status}<br>
            Vehicle: ${ride.vehicle_name || ride.vehicle_type}
        `);
        
        // Center map on vehicle
        trackMap.setView([ride.current_lat, ride.current_lng], 13);
    }
    
    // Add pickup marker
    if (ride.pickup_lat && ride.pickup_lng) {
        pickupMarker = L.marker([ride.pickup_lat, ride.pickup_lng], {
            icon: L.divIcon({
                html: '📍',
                iconSize: [30, 30],
                className: 'pickup-marker'
            })
        }).addTo(trackMap).bindPopup(`
            <b>Pickup Location</b><br>
            ${ride.pickup_address || 'Pickup point'}
        `);
    }
    
    // Add drop marker
    if (ride.drop_lat && ride.drop_lng) {
        dropMarker = L.marker([ride.drop_lat, ride.drop_lng], {
            icon: L.divIcon({
                html: '🏁',
                iconSize: [30, 30],
                className: 'drop-marker'
            })
        }).addTo(trackMap).bindPopup(`
            <b>Drop Location</b><br>
            ${ride.drop_address || 'Destination'}
        `);
    }
}

// ============================================
// START AUTO REFRESH (Live updates)
// ============================================

function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(async () => {
        if (currentRideCode) {
            try {
                const result = await api.trackRideByCode(currentRideCode);
                
                if (result.success) {
                    const oldStatus = currentRide?.status;
                    const oldLat = currentRide?.current_lat;
                    const oldLng = currentRide?.current_lng;
                    
                    currentRide = result.ride;
                    
                    // Update UI if status changed
                    if (oldStatus !== currentRide.status) {
                        const rideStatus = document.getElementById('rideStatus');
                        if (rideStatus) {
                            rideStatus.innerHTML = buildStatusHTML(currentRide);
                        }
                    }
                    
                    // Update map if location changed
                    if (oldLat !== currentRide.current_lat || oldLng !== currentRide.current_lng) {
                        updateMapMarkers(currentRide);
                    }
                }
            } catch (error) {
                console.error('Refresh error:', error);
            }
        }
    }, 5000); // Refresh every 5 seconds
}

// ============================================
// STOP AUTO REFRESH
// ============================================

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// ============================================
// SHOW/HIDE TRACKING SECTION
// ============================================

function showTrackingSection() {
    const codeInputSection = document.getElementById('codeInputSection');
    const trackingSection = document.getElementById('trackingSection');
    
    if (codeInputSection) codeInputSection.style.display = 'none';
    if (trackingSection) trackingSection.style.display = 'block';
}

function hideTrackingSection() {
    const codeInputSection = document.getElementById('codeInputSection');
    const trackingSection = document.getElementById('trackingSection');
    
    if (codeInputSection) codeInputSection.style.display = 'block';
    if (trackingSection) trackingSection.style.display = 'none';
    
    stopAutoRefresh();
    
    // Clear map
    if (trackMap) {
        trackMap.remove();
        trackMap = null;
    }
}

// ============================================
// SHARE FUNCTIONS
// ============================================

function shareOnWhatsApp() {
    if (!currentRideCode) return;
    
    const trackingUrl = `${window.location.origin}${window.location.pathname}?code=${currentRideCode}`;
    const text = `🚜 Rural Vahaan - Ride Tracking\n\nRide Code: ${currentRideCode}\nTrack live here: ${trackingUrl}\n\nStay safe!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareOnSMS() {
    if (!currentRideCode) return;
    
    const trackingUrl = `${window.location.origin}${window.location.pathname}?code=${currentRideCode}`;
    const text = `Rural Vahaan Ride Code: ${currentRideCode}. Track here: ${trackingUrl}`;
    window.location.href = `sms:?body=${encodeURIComponent(text)}`;
}

function copyRideCode() {
    if (!currentRideCode) return;
    
    navigator.clipboard.writeText(currentRideCode);
    showAlert(`Ride code ${currentRideCode} copied to clipboard!`, 'success');
}

// ============================================
// SEND EMERGENCY ALERT
// ============================================

async function sendEmergencyAlert() {
    if (!currentRideCode) {
        showAlert('No ride code found. Please track a ride first.', 'error');
        return;
    }
    
    if (!confirm('⚠️ EMERGENCY ALERT! ⚠️\n\nThis will notify the admin and emergency services. Only use in real emergencies.\n\nDo you want to proceed?')) {
        return;
    }
    
    try {
        const result = await api.sendSOSAlert(
            currentRideCode,
            currentRide?.current_lat || null,
            currentRide?.current_lng || null,
            'Emergency alert from family member tracking the ride!'
        );
        
        if (result.success) {
            alert('🚨 SOS Alert Sent! 🚨\n\nHelp has been notified.\n\nEmergency Contacts:\n🚓 Police: 100\n🚑 Ambulance: 102\n👩 Women Helpline: 1091');
        } else {
            alert('Failed to send SOS alert. Please call emergency services directly.\n\n🚓 Police: 100\n🚑 Ambulance: 102\n👩 Women Helpline: 1091');
        }
    } catch (error) {
        console.error('SOS error:', error);
        alert('Error sending SOS. Please call emergency services directly:\n\n🚓 Police: 100\n🚑 Ambulance: 102\n👩 Women Helpline: 1091');
    }
}

// ============================================
// SHOW ALERT
// ============================================

function showAlert(message, type) {
    const alertDiv = document.getElementById('alert');
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.display = 'block';
        
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 5000);
    } else {
        // Fallback
        if (type === 'error') {
            alert('❌ ' + message);
        } else {
            alert('✅ ' + message);
        }
    }
}

// ============================================
// CLEANUP ON PAGE UNLOAD
// ============================================

window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});

// Default center for India
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 };