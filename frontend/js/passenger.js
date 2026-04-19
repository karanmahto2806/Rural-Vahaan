/**
 * Passenger Dashboard Functions
 * Purpose: Handle all passenger-specific functionality
 * Includes: search vehicles, book rides, track rides, SOS
 */

// ============================================
// GLOBAL VARIABLES
// ============================================

let passengerMap = null;
let userMarker = null;
let vehicleMarkers = [];
let currentVehicles = [];
let selectedVehicle = null;
let currentLocation = null;
let locationWatchId = null;
let refreshInterval = null;

// ============================================
// INITIALIZE PASSENGER DASHBOARD
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in and is passenger
    if (!api.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    
    const user = api.getCurrentUser();
    if (user.role !== 'passenger') {
        alert('You are not registered as a passenger. Please register as passenger first.');
        window.location.href = 'register.html?role=passenger';
        return;
    }
    
    // Display user name
    const userNameSpan = document.getElementById('userName');
    if (userNameSpan) {
        userNameSpan.innerHTML = `👤 ${user.name}`;
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Load my rides
    loadMyRides();
    loadRideHistory();
    
    // Auto search location on load
    setTimeout(() => {
        getUserLocationAndSearch();
    }, 500);
});

// ============================================
// SETUP EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Vehicle filter change
    const filterSelect = document.getElementById('vehicleFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', filterVehicles);
    }
}

// ============================================
// GET USER LOCATION AND SEARCH VEHICLES
// ============================================

function getUserLocationAndSearch() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }
    
    const vehiclesContainer = document.getElementById('vehiclesContainer');
    if (vehiclesContainer) {
        vehiclesContainer.innerHTML = '<div class="loading">Getting your location...</div>';
    }
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            // Initialize map
            initPassengerMap(currentLocation.lat, currentLocation.lng);
            
            // Search for nearby vehicles
            await searchNearbyVehicles(currentLocation.lat, currentLocation.lng);
            
            // Start location tracking
            startLocationTracking();
        },
        (error) => {
            console.error('Location error:', error);
            alert('Unable to get your location. Please enable location access.');
            if (vehiclesContainer) {
                vehiclesContainer.innerHTML = '<div class="alert alert-error">Unable to get your location. Please enable location access.</div>';
            }
        }
    );
}

// ============================================
// INITIALIZE PASSENGER MAP
// ============================================

function initPassengerMap(lat, lng) {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    if (passengerMap) {
        passengerMap.setView([lat, lng], 13);
        if (userMarker) {
            userMarker.setLatLng([lat, lng]);
        }
        return;
    }
    
    passengerMap = L.map('map').setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(passengerMap);
    
    // Add user marker
    userMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            html: '📍',
            iconSize: [30, 30],
            className: 'user-marker'
        })
    }).addTo(passengerMap).bindPopup('Your Location');
}

// ============================================
// SEARCH NEARBY VEHICLES (5km radius)
// ============================================

async function searchNearbyVehicles(lat, lng) {
    const vehiclesContainer = document.getElementById('vehiclesContainer');
    if (vehiclesContainer) {
        vehiclesContainer.innerHTML = '<div class="loading">Searching for vehicles within 5km...</div>';
    }
    
    try {
        const result = await api.getNearbyVehicles(lat, lng);
        
        if (result.success) {
            currentVehicles = result.vehicles || [];
            displayVehicles(currentVehicles);
            displayVehiclesOnMap(currentVehicles);
        } else {
            vehiclesContainer.innerHTML = '<div class="alert alert-warning">No vehicles found within 5km radius</div>';
        }
    } catch (error) {
        console.error('Search error:', error);
        vehiclesContainer.innerHTML = '<div class="alert alert-error">Error searching vehicles. Please try again.</div>';
    }
}

// ============================================
// DISPLAY VEHICLES IN LIST
// ============================================

function displayVehicles(vehicles) {
    const filter = document.getElementById('vehicleFilter')?.value || 'all';
    let filteredVehicles = vehicles;
    
    if (filter !== 'all') {
        filteredVehicles = vehicles.filter(v => v.vehicle_type === filter);
    }
    
    const vehiclesContainer = document.getElementById('vehiclesContainer');
    
    if (!vehiclesContainer) return;
    
    if (filteredVehicles.length === 0) {
        vehiclesContainer.innerHTML = '<div class="alert alert-warning">No vehicles found matching your filter</div>';
        return;
    }
    
    let html = '';
    for (let vehicle of filteredVehicles) {
        const icon = api.getVehicleIcon(vehicle.vehicle_type);
        const distance = vehicle.distance_km ? vehicle.distance_km.toFixed(1) : '?';
        const hourlyRate = vehicle.hourly_rate ? `₹${vehicle.hourly_rate}/hr` : '';
        const perKmRate = vehicle.per_km_rate ? `₹${vehicle.per_km_rate}/km` : '';
        const rating = vehicle.rating ? `⭐ ${parseFloat(vehicle.rating).toFixed(1)}` : '⭐ New';
        
        html += `
            <div class="vehicle-card" data-vehicle-id="${vehicle.id}">
                <div class="vehicle-header">
                    <div class="vehicle-icon ${vehicle.vehicle_type}">${icon}</div>
                    <div class="vehicle-title">
                        <h3>${vehicle.vehicle_name || vehicle.vehicle_type.toUpperCase()}</h3>
                        <div>
                            <span class="vehicle-badge badge-verified">${rating}</span>
                            <span class="vehicle-badge" style="background:#e3f2fd;">${distance} km away</span>
                        </div>
                    </div>
                </div>
                <div class="vehicle-details">
                    <span>👤 ${vehicle.driver_name || 'Driver'}</span>
                    <span>📞 ${vehicle.driver_phone || 'N/A'}</span>
                    <span>🔢 ${vehicle.vehicle_number || 'N/A'}</span>
                </div>
                <div class="vehicle-price">
                    <span>💰 ${hourlyRate || perKmRate || 'Contact for price'}</span>
                    <span class="distance">📍 ${distance} km from you</span>
                </div>
                <button class="book-btn" onclick="openBookingModal(${vehicle.id})">Book Now →</button>
            </div>
        `;
    }
    
    vehiclesContainer.innerHTML = html;
}

// ============================================
// DISPLAY VEHICLES ON MAP
// ============================================

function displayVehiclesOnMap(vehicles) {
    // Clear existing markers
    vehicleMarkers.forEach(marker => {
        if (passengerMap) passengerMap.removeLayer(marker);
    });
    vehicleMarkers = [];
    
    if (!passengerMap) return;
    
    for (let vehicle of vehicles) {
        if (vehicle.current_lat && vehicle.current_lng) {
            const icon = api.getVehicleIcon(vehicle.vehicle_type);
            const marker = L.marker([vehicle.current_lat, vehicle.current_lng], {
                icon: L.divIcon({
                    html: icon,
                    iconSize: [35, 35],
                    className: 'vehicle-marker'
                })
            }).addTo(passengerMap);
            
            marker.bindPopup(`
                <b>${vehicle.vehicle_name || vehicle.vehicle_type}</b><br>
                Driver: ${vehicle.driver_name}<br>
                ${vehicle.hourly_rate ? `₹${vehicle.hourly_rate}/hr` : ''}
                ${vehicle.per_km_rate ? `₹${vehicle.per_km_rate}/km` : ''}<br>
                <button onclick="openBookingModal(${vehicle.id})">Book Now</button>
            `);
            
            vehicleMarkers.push(marker);
        }
    }
}

// ============================================
// FILTER VEHICLES
// ============================================

function filterVehicles() {
    if (currentVehicles.length > 0) {
        displayVehicles(currentVehicles);
        displayVehiclesOnMap(currentVehicles);
    }
}

// ============================================
// OPEN BOOKING MODAL
// ============================================

function openBookingModal(vehicleId) {
    selectedVehicle = currentVehicles.find(v => v.id === vehicleId);
    
    if (!selectedVehicle) {
        alert('Vehicle not found');
        return;
    }
    
    const modal = document.getElementById('bookingModal');
    const selectedVehicleInfo = document.getElementById('selectedVehicleInfo');
    const pickupAddress = document.getElementById('pickupAddress');
    
    if (!modal || !selectedVehicleInfo) return;
    
    const icon = api.getVehicleIcon(selectedVehicle.vehicle_type);
    const hourlyRate = selectedVehicle.hourly_rate ? `₹${selectedVehicle.hourly_rate}/hr` : '';
    const perKmRate = selectedVehicle.per_km_rate ? `₹${selectedVehicle.per_km_rate}/km` : '';
    
    selectedVehicleInfo.innerHTML = `
        <div class="selected-vehicle">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span style="font-size: 2rem;">${icon}</span>
                <div>
                    <strong>${selectedVehicle.vehicle_name || selectedVehicle.vehicle_type.toUpperCase()}</strong><br>
                    Driver: ${selectedVehicle.driver_name}<br>
                    ${hourlyRate || perKmRate || 'Contact for price'}
                </div>
            </div>
        </div>
    `;
    
    // Set pickup location as current location
    if (pickupAddress && currentLocation) {
        pickupAddress.value = `Lat: ${currentLocation.lat.toFixed(6)}, Lng: ${currentLocation.lng.toFixed(6)}`;
    }
    
    // Calculate estimated fare
    const estimatedFare = calculateEstimatedFare();
    const fareInput = document.getElementById('estimatedFare');
    if (fareInput) {
        fareInput.value = `₹${estimatedFare}`;
    }
    
    modal.style.display = 'flex';
}

// ============================================
// CALCULATE ESTIMATED FARE
// ============================================

function calculateEstimatedFare() {
    if (!selectedVehicle) return 200;
    
    // Assume 5km average distance
    const avgDistance = 5;
    
    if (selectedVehicle.per_km_rate) {
        return selectedVehicle.per_km_rate * avgDistance;
    }
    
    if (selectedVehicle.hourly_rate) {
        return selectedVehicle.hourly_rate;
    }
    
    return 200; // Default fare
}

// ============================================
// CLOSE BOOKING MODAL
// ============================================

function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) {
        modal.style.display = 'none';
        selectedVehicle = null;
    }
}

// ============================================
// BOOK RIDE
// ============================================

async function bookRide() {
    if (!selectedVehicle) {
        alert('Please select a vehicle');
        return;
    }
    
    const dropAddress = document.getElementById('dropAddress')?.value;
    if (!dropAddress) {
        alert('Please enter drop location');
        return;
    }
    
    const estimatedFare = calculateEstimatedFare();
    
    const bookingData = {
        driver_id: selectedVehicle.driver_id,
        vehicle_id: selectedVehicle.id,
        pickup_lat: currentLocation.lat,
        pickup_lng: currentLocation.lng,
        drop_lat: currentLocation.lat + 0.01, // Simplified - in real app, geocode address
        drop_lng: currentLocation.lng + 0.01,
        pickup_address: document.getElementById('pickupAddress')?.value || '',
        drop_address: dropAddress,
        fare: estimatedFare
    };
    
    const bookBtn = event.target;
    const originalText = bookBtn.innerText;
    bookBtn.innerText = 'Booking...';
    bookBtn.disabled = true;
    
    try {
        const result = await api.createRide(bookingData);
        
        if (result.success) {
            alert(`✅ Ride booked successfully!\n\nRide Code: ${result.ride_code}\n\nShare this code with your family to track your ride.\n\nShareable link: ${result.shareable_link}`);
            closeBookingModal();
            loadMyRides();
        } else {
            alert(result.message || 'Booking failed. Please try again.');
        }
    } catch (error) {
        console.error('Booking error:', error);
        alert('Error booking ride. Please try again.');
    } finally {
        bookBtn.innerText = originalText;
        bookBtn.disabled = false;
    }
}

// ============================================
// LOAD MY ACTIVE RIDES
// ============================================

async function loadMyRides() {
    try {
        const result = await api.getMyRides();
        
        if (result.success) {
            const activeRides = result.rides.filter(r => r.status !== 'completed');
            const activeContainer = document.getElementById('activeRidesContainer');
            
            if (activeContainer) {
                if (activeRides.length === 0) {
                    activeContainer.innerHTML = '<div class="loading">No active rides</div>';
                } else {
                    let html = '';
                    for (let ride of activeRides) {
                        const statusIcon = ride.status === 'pending' ? '⏳' : (ride.status === 'accepted' ? '✅' : '🚗');
                        html += `
                            <div class="vehicle-card">
                                <div class="vehicle-header">
                                    <div class="vehicle-icon">${statusIcon}</div>
                                    <div>
                                        <h3>Ride Code: ${ride.ride_code}</h3>
                                        <p>Status: ${api.getStatusText(ride.status)}</p>
                                        <p>Driver: ${ride.driver_name}</p>
                                        <p>Fare: ₹${ride.fare}</p>
                                        <button onclick="window.location.href='track.html?code=${ride.ride_code}'">Track Ride →</button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                    activeContainer.innerHTML = html;
                }
            }
        }
    } catch (error) {
        console.error('Load rides error:', error);
    }
}

// ============================================
// LOAD RIDE HISTORY
// ============================================

async function loadRideHistory() {
    try {
        const result = await api.getMyRides();
        
        if (result.success) {
            const completedRides = result.rides.filter(r => r.status === 'completed');
            const historyContainer = document.getElementById('rideHistoryContainer');
            
            if (historyContainer) {
                if (completedRides.length === 0) {
                    historyContainer.innerHTML = '<div class="loading">No ride history</div>';
                } else {
                    let html = '';
                    for (let ride of completedRides) {
                        html += `
                            <div class="vehicle-card">
                                <div>
                                    <strong>${ride.ride_code}</strong> - ${ride.vehicle_type || 'Vehicle'} - ₹${ride.fare}
                                    <br><small>Completed on: ${new Date(ride.created_at).toLocaleDateString()}</small>
                                </div>
                            </div>
                        `;
                    }
                    historyContainer.innerHTML = html;
                }
            }
        }
    } catch (error) {
        console.error('Load history error:', error);
    }
}

// ============================================
// START LOCATION TRACKING
// ============================================

function startLocationTracking() {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
    }
    
    locationWatchId = navigator.geolocation.watchPosition(
        (position) => {
            if (userMarker && passengerMap) {
                userMarker.setLatLng([position.coords.latitude, position.coords.longitude]);
                currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
            }
        },
        (error) => {
            console.error('Tracking error:', error);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
        }
    );
}

// ============================================
// TRIGGER SOS EMERGENCY
// ============================================

async function triggerSOS() {
    if (!confirm('⚠️ EMERGENCY ALERT! ⚠️\n\nThis will notify your family and admin. Only use in real emergencies.\n\nDo you want to proceed?')) {
        return;
    }
    
    try {
        const result = await api.sendSOSAlert(
            null, // ride_code - can be specific ride code
            currentLocation?.lat,
            currentLocation?.lng,
            'Emergency! Need immediate assistance.'
        );
        
        if (result.success) {
            alert('🚨 SOS Alert Sent! 🚨\n\nHelp is on the way.\n\nEmergency Contacts:\n🚓 Police: 100\n🚑 Ambulance: 102\n👩 Women Helpline: 1091');
        } else {
            alert('Failed to send SOS alert. Please call emergency services directly.\n\n🚓 Police: 100\n🚑 Ambulance: 102\n👩 Women Helpline: 1091');
        }
    } catch (error) {
        console.error('SOS error:', error);
        alert('Error sending SOS. Please call emergency services directly:\n🚓 Police: 100\n🚑 Ambulance: 102');
    }
}

// ============================================
// CLEANUP ON PAGE UNLOAD
// ============================================

window.addEventListener('beforeunload', () => {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
    }
});