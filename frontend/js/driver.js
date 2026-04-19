/**
 * Driver Dashboard Functions
 * Purpose: Handle all driver-specific functionality
 * Includes: vehicle registration, online/offline toggle, accept rides, location tracking, complete rides
 */

// ============================================
// GLOBAL VARIABLES
// ============================================

let driverMap = null;
let driverMarker = null;
let currentLocation = null;
let locationWatchId = null;
let refreshInterval = null;
let myVehicles = [];
let selectedVehicleId = null;

// ============================================
// INITIALIZE DRIVER DASHBOARD
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in and is driver
    if (!api.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    
    const user = api.getCurrentUser();
    if (user.role !== 'driver') {
        alert('You are not registered as a driver. Please register as driver first.');
        window.location.href = 'register.html?role=driver';
        return;
    }
    
    // Display user name
    const userNameSpan = document.getElementById('userName');
    if (userNameSpan) {
        userNameSpan.innerHTML = `👤 ${user.name}`;
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Load data
    loadMyVehicles();
    loadRideHistory();
    
    // Check if already online from previous session
    setTimeout(async () => {
        if (myVehicles.length > 0) {
            const onlineVehicle = myVehicles.find(v => v.is_available);
            if (onlineVehicle) {
                selectedVehicleId = onlineVehicle.id;
                const toggle = document.getElementById('availabilityToggle');
                if (toggle) toggle.checked = true;
                document.getElementById('statusText').innerHTML = '🟢 You are ONLINE. Passengers can see you within 5km radius.';
                document.getElementById('statusText').className = 'status-online';
                document.getElementById('selectedVehicleText').innerHTML = `Selected vehicle: ${onlineVehicle.vehicle_name}`;
                startLocationTracking();
                startDataRefresh();
                loadRideRequests();
                loadActiveRides();
                displayMyVehicles(myVehicles);
            }
        }
    }, 1000);
});

// ============================================
// SETUP EVENT LISTENERS
// ============================================

function setupEventListeners() {
    const toggle = document.getElementById('availabilityToggle');
    if (toggle) {
        toggle.addEventListener('change', toggleAvailability);
    }
}

// ============================================
// REGISTER VEHICLE
// ============================================

async function registerVehicle() {
    const vehicleType = document.getElementById('vehicleType')?.value;
    const vehicleName = document.getElementById('vehicleName')?.value.trim();
    const vehicleNumber = document.getElementById('vehicleNumber')?.value.trim().toUpperCase();
    const hourlyRate = document.getElementById('hourlyRate')?.value;
    const perKmRate = document.getElementById('perKmRate')?.value;
    
    // Validate
    if (!vehicleType) {
        showRegisterAlert('Please select vehicle type', 'error');
        return;
    }
    if (!vehicleName) {
        showRegisterAlert('Please enter vehicle name', 'error');
        return;
    }
    if (!vehicleNumber) {
        showRegisterAlert('Please enter vehicle number', 'error');
        return;
    }
    
    const registerBtn = event.target;
    const originalText = registerBtn.innerText;
    registerBtn.innerText = 'Registering...';
    registerBtn.disabled = true;
    
    try {
        const result = await api.registerVehicle({
            vehicle_type: vehicleType,
            vehicle_name: vehicleName,
            vehicle_number: vehicleNumber,
            hourly_rate: hourlyRate || null,
            per_km_rate: perKmRate || null
        });
        
        if (result.success) {
            showRegisterAlert(result.message, 'success');
            
            // Clear form
            document.getElementById('vehicleName').value = '';
            document.getElementById('vehicleNumber').value = '';
            document.getElementById('hourlyRate').value = '';
            document.getElementById('perKmRate').value = '';
            
            // Reload vehicles list
            loadMyVehicles();
        } else {
            showRegisterAlert(result.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Register error:', error);
        showRegisterAlert('Server error. Please try again.', 'error');
    } finally {
        registerBtn.innerText = originalText;
        registerBtn.disabled = false;
    }
}

function showRegisterAlert(message, type) {
    const alertDiv = document.getElementById('registerAlert');
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.display = 'block';
        
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 3000);
    }
}

// ============================================
// LOAD MY VEHICLES
// ============================================

async function loadMyVehicles() {
    try {
        const result = await api.getMyVehicles();
        
        if (result.success) {
            myVehicles = result.vehicles || [];
            displayMyVehicles(myVehicles);
        }
    } catch (error) {
        console.error('Load vehicles error:', error);
    }
}

function displayMyVehicles(vehicles) {
    const container = document.getElementById('myVehiclesList');
    if (!container) return;
    
    if (vehicles.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">No vehicles registered yet. Use the form above to register your first vehicle.</div>';
        return;
    }
    
    let html = '';
    for (let vehicle of vehicles) {
        const icon = api.getVehicleIcon(vehicle.vehicle_type);
        const verifiedBadge = vehicle.is_verified ? 
            '<span class="vehicle-badge badge-verified">✅ Verified</span>' : 
            '<span class="vehicle-badge badge-pending">⏳ Pending Verification</span>';
        const statusBadge = vehicle.is_available ?
            '<span style="color: #2e7d32;">🟢 Online</span>' :
            '<span style="color: #f44336;">🔴 Offline</span>';
        
        html += `
            <div class="vehicle-card" data-vehicle-id="${vehicle.id}">
                <div class="vehicle-header">
                    <div class="vehicle-icon ${vehicle.vehicle_type}">${icon}</div>
                    <div class="vehicle-title">
                        <h3>${vehicle.vehicle_name}</h3>
                        <div>
                            ${verifiedBadge}
                            ${statusBadge}
                        </div>
                    </div>
                </div>
                <div class="vehicle-details">
                    <span>🔢 ${vehicle.vehicle_number}</span>
                    <span>⭐ ${vehicle.rating || 'New'}</span>
                    <span>🚀 ${vehicle.total_rides || 0} rides</span>
                </div>
                <div class="vehicle-price">
                    ${vehicle.hourly_rate ? `<span>💰 ₹${vehicle.hourly_rate}/hr</span>` : ''}
                    ${vehicle.per_km_rate ? `<span>💰 ₹${vehicle.per_km_rate}/km</span>` : ''}
                </div>
                <button class="book-btn" style="background: var(--primary);" onclick="selectVehicle(${vehicle.id})">
                    ${selectedVehicleId === vehicle.id ? '✓ Selected' : 'Select for Online'}
                </button>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ============================================
// SELECT VEHICLE
// ============================================

function selectVehicle(vehicleId) {
    selectedVehicleId = vehicleId;
    const selectedVehicle = myVehicles.find(v => v.id === vehicleId);
    if (selectedVehicle) {
        document.getElementById('selectedVehicleText').innerHTML = `Selected vehicle: ${selectedVehicle.vehicle_name}`;
    }
    displayMyVehicles(myVehicles);
    
    // If toggle is ON, update availability
    const toggle = document.getElementById('availabilityToggle');
    if (toggle && toggle.checked) {
        updateAvailability(true);
    }
}

// ============================================
// TOGGLE AVAILABILITY (Online/Offline)
// ============================================

async function toggleAvailability() {
    const toggle = document.getElementById('availabilityToggle');
    const isOnline = toggle.checked;
    
    if (isOnline && !selectedVehicleId) {
        alert('Please select a vehicle first from "My Vehicles" section');
        toggle.checked = false;
        return;
    }
    
    if (isOnline && !currentLocation) {
        alert('Please enable location access to go online');
        toggle.checked = false;
        return;
    }
    
    await updateAvailability(isOnline);
}

async function updateAvailability(isOnline) {
    if (!selectedVehicleId) return;
    
    try {
        const result = await api.updateVehicleAvailability(selectedVehicleId, isOnline);
        
        if (result.success) {
            const statusText = document.getElementById('statusText');
            if (isOnline) {
                statusText.innerHTML = '🟢 You are ONLINE. Passengers can see you within 5km radius.';
                statusText.className = 'status-online';
                startLocationTracking();
                startDataRefresh();
                loadRideRequests();
                loadActiveRides();
            } else {
                statusText.innerHTML = '🔴 You are OFFLINE. Passengers cannot see you.';
                statusText.className = 'status-offline';
                if (locationWatchId) {
                    navigator.geolocation.clearWatch(locationWatchId);
                }
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                }
            }
            loadMyVehicles();
        } else {
            alert(result.message || 'Failed to update status');
            document.getElementById('availabilityToggle').checked = false;
        }
    } catch (error) {
        console.error('Availability error:', error);
        alert('Error updating status');
        document.getElementById('availabilityToggle').checked = false;
    }
}

// ============================================
// START LOCATION TRACKING
// ============================================

function startLocationTracking() {
    if (!navigator.geolocation) {
        alert('Geolocation not supported');
        return;
    }
    
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
    }
    
    // Get initial location
    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            initDriverMap(currentLocation.lat, currentLocation.lng);
            updateLocationOnServer(currentLocation.lat, currentLocation.lng);
        },
        (error) => {
            console.error('Location error:', error);
            alert('Unable to get your location. Please enable location access.');
        }
    );
    
    // Watch for location changes
    locationWatchId = navigator.geolocation.watchPosition(
        async (position) => {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            if (driverMarker && driverMap) {
                driverMarker.setLatLng([currentLocation.lat, currentLocation.lng]);
            } else if (driverMap) {
                initDriverMap(currentLocation.lat, currentLocation.lng);
            }
            
            await updateLocationOnServer(currentLocation.lat, currentLocation.lng);
        },
        (error) => {
            console.error('Watch error:', error);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
        }
    );
}

function initDriverMap(lat, lng) {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    if (driverMap) {
        driverMap.setView([lat, lng], 15);
        if (driverMarker) {
            driverMarker.setLatLng([lat, lng]);
        }
        return;
    }
    
    driverMap = L.map('map').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(driverMap);
    
    driverMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            html: '🚗',
            iconSize: [35, 35],
            className: 'driver-marker'
        })
    }).addTo(driverMap).bindPopup('Your Location (Driver)');
}

async function updateLocationOnServer(lat, lng) {
    if (!selectedVehicleId) return;
    
    try {
        await api.updateDriverLocation(lat, lng, selectedVehicleId);
    } catch (error) {
        console.error('Update location error:', error);
    }
}

// ============================================
// START DATA REFRESH
// ============================================

function startDataRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(() => {
        if (selectedVehicleId && document.getElementById('availabilityToggle')?.checked) {
            loadRideRequests();
            loadActiveRides();
        }
    }, 10000);
}

// ============================================
// LOAD RIDE REQUESTS
// ============================================

async function loadRideRequests() {
    try {
        const result = await api.getRideRequests();
        
        const container = document.getElementById('rideRequests');
        if (!container) return;
        
        if (result.success && result.requests && result.requests.length > 0) {
            let html = '';
            for (let ride of result.requests) {
                html += `
                    <div class="vehicle-card">
                        <div class="vehicle-header">
                            <div class="vehicle-icon">👤</div>
                            <div>
                                <h3>New Ride Request</h3>
                                <p>Passenger: ${ride.passenger_name}</p>
                                <p>Phone: ${ride.passenger_phone || 'N/A'}</p>
                                <p>Fare: ₹${ride.fare}</p>
                                <p>Status: ⏳ ${ride.status}</p>
                                <button onclick="acceptRide(${ride.id})" style="background: #2e7d32;">Accept Ride →</button>
                            </div>
                        </div>
                    </div>
                `;
            }
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="loading">No pending ride requests</div>';
        }
    } catch (error) {
        console.error('Load requests error:', error);
    }
}

// ============================================
// ACCEPT RIDE
// ============================================

async function acceptRide(rideId) {
    try {
        const result = await api.acceptRide(rideId);
        
        if (result.success) {
            alert('Ride accepted! Contact the passenger to confirm pickup.');
            loadRideRequests();
            loadActiveRides();
        } else {
            alert(result.message || 'Failed to accept ride');
        }
    } catch (error) {
        console.error('Accept ride error:', error);
        alert('Error accepting ride');
    }
}

// ============================================
// START RIDE
// ============================================

async function startRide(rideId) {
    if (!confirm('Start the ride? Passenger will be notified and live tracking will begin.')) return;
    
    try {
        const result = await api.startRide(rideId);
        
        if (result.success) {
            alert('Ride started! Live tracking is now active.');
            loadActiveRides();
        } else {
            alert(result.message || 'Failed to start ride');
        }
    } catch (error) {
        console.error('Start ride error:', error);
        alert('Error starting ride');
    }
}

// ============================================
// COMPLETE RIDE
// ============================================

async function completeRide(rideId) {
    const rating = prompt('Ride completed! Rate the passenger (1-5 stars):', '5');
    if (rating && (rating < 1 || rating > 5)) {
        alert('Please enter rating between 1 and 5');
        return;
    }
    
    try {
        const result = await api.completeRide(rideId, rating ? parseInt(rating) : null, null);
        
        if (result.success) {
            alert('Ride completed successfully!');
            loadActiveRides();
            loadRideHistory();
            loadMyVehicles();
        } else {
            alert(result.message || 'Failed to complete ride');
        }
    } catch (error) {
        console.error('Complete ride error:', error);
        alert('Error completing ride');
    }
}

// ============================================
// LOAD ACTIVE RIDES
// ============================================

async function loadActiveRides() {
    try {
        const result = await api.getMyRides();
        
        const container = document.getElementById('activeRides');
        if (!container) return;
        
        if (result.success) {
            const activeRides = result.rides.filter(r => r.status !== 'completed');
            
            if (activeRides.length === 0) {
                container.innerHTML = '<div class="loading">No active rides</div>';
            } else {
                let html = '';
                for (let ride of activeRides) {
                    let actionButtons = '';
                    if (ride.status === 'accepted') {
                        actionButtons = `<button onclick="startRide(${ride.id})" style="background: #ff9800;">Start Ride →</button>`;
                    } else if (ride.status === 'started') {
                        actionButtons = `
                            <button onclick="completeRide(${ride.id})" style="background: #2e7d32;">Complete Ride →</button>
                            <button onclick="window.location.href='track.html?code=${ride.ride_code}'" style="background: #2196f3;">Track Passenger →</button>
                        `;
                    } else {
                        actionButtons = `<span>Status: ${ride.status}</span>`;
                    }
                    
                    html += `
                        <div class="vehicle-card">
                            <div class="vehicle-header">
                                <div>
                                    <h3>Ride Code: ${ride.ride_code}</h3>
                                    <p>Passenger: ${ride.passenger_name}</p>
                                    <p>Fare: ₹${ride.fare}</p>
                                    <p>Status: ${ride.status.toUpperCase()}</p>
                                    ${actionButtons}
                                </div>
                            </div>
                        </div>
                    `;
                }
                container.innerHTML = html;
            }
        }
    } catch (error) {
        console.error('Load active rides error:', error);
    }
}

// ============================================
// LOAD RIDE HISTORY
// ============================================

async function loadRideHistory() {
    try {
        const result = await api.getMyRides();
        
        const container = document.getElementById('rideHistory');
        if (!container) return;
        
        if (result.success) {
            const completedRides = result.rides.filter(r => r.status === 'completed');
            
            if (completedRides.length === 0) {
                container.innerHTML = '<div class="loading">No ride history</div>';
            } else {
                let html = '';
                for (let ride of completedRides) {
                    html += `
                        <div class="vehicle-card">
                            <div>
                                <strong>${ride.ride_code}</strong> - ₹${ride.fare}
                                <br><small>Completed on: ${new Date(ride.created_at).toLocaleDateString()}</small>
                            </div>
                        </div>
                    `;
                }
                container.innerHTML = html;
            }
        }
    } catch (error) {
        console.error('Load history error:', error);
    }
}

// ============================================
// CLEANUP ON PAGE UNLOAD
// ============================================

window.addEventListener('beforeunload', () => {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
    }
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});