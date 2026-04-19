/**
 * Map Utility Functions
 * Purpose: Handle all map-related functionality using Leaflet + OpenStreetMap
 * Features: Initialize map, add markers, calculate distance, draw routes, geocoding
 * 
 * Note: This uses FREE OpenStreetMap (no API key required!)
 */

// ============================================
// GLOBAL MAP VARIABLES
// ============================================

let mainMap = null;
let currentMarkers = [];
let currentPolylines = [];
let userLocationMarker = null;

// Default center (India - Delhi)
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 };
const DEFAULT_ZOOM = 13;

// ============================================
// INITIALIZE MAP
// ============================================

/**
 * Initialize a new map on the given container
 * @param {string} containerId - HTML element ID (e.g., 'map')
 * @param {number} lat - Latitude (optional)
 * @param {number} lng - Longitude (optional)
 * @param {number} zoom - Zoom level (optional, default 13)
 * @returns {object} Leaflet map object
 */
function initMap(containerId, lat = null, lng = null, zoom = DEFAULT_ZOOM) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Map container '${containerId}' not found`);
        return null;
    }
    
    const centerLat = lat || DEFAULT_CENTER.lat;
    const centerLng = lng || DEFAULT_CENTER.lng;
    
    // Remove existing map if any
    if (mainMap) {
        mainMap.remove();
    }
    
    // Create new map
    mainMap = L.map(containerId).setView([centerLat, centerLng], zoom);
    
    // Add OpenStreetMap tiles (FREE, no API key)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(mainMap);
    
    return mainMap;
}

// ============================================
// GET CURRENT MAP INSTANCE
// ============================================

function getMap() {
    return mainMap;
}

// ============================================
// ADD MARKER
// ============================================

/**
 * Add a marker to the map
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} title - Popup title/text
 * @param {string} iconType - Type of icon ('user', 'vehicle', 'pickup', 'drop', 'driver')
 * @returns {object} Leaflet marker object
 */
function addMarker(lat, lng, title = '', iconType = 'default') {
    if (!mainMap) {
        console.error('Map not initialized');
        return null;
    }
    
    // Define icon HTML based on type
    const iconHtml = getMarkerIcon(iconType);
    const iconSize = iconType === 'user' || iconType === 'driver' ? [35, 35] : [30, 30];
    
    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            html: iconHtml,
            iconSize: iconSize,
            className: `marker-${iconType}`
        })
    }).addTo(mainMap);
    
    if (title) {
        marker.bindPopup(title);
    }
    
    currentMarkers.push(marker);
    return marker;
}

// ============================================
// GET MARKER ICON HTML
// ============================================

function getMarkerIcon(type) {
    const icons = {
        'user': '📍',
        'driver': '🚗',
        'vehicle': '🚙',
        'pickup': '📍',
        'drop': '🏁',
        'default': '📍'
    };
    return icons[type] || '📍';
}

// ============================================
// ADD VEHICLE MARKER
// ============================================

/**
 * Add a vehicle marker with vehicle type icon
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {object} vehicle - Vehicle object with type, name, driver
 * @returns {object} Leaflet marker object
 */
function addVehicleMarker(lat, lng, vehicle) {
    if (!mainMap) return null;
    
    const icon = api.getVehicleIcon(vehicle.vehicle_type);
    const popupContent = `
        <b>${vehicle.vehicle_name || vehicle.vehicle_type.toUpperCase()}</b><br>
        Driver: ${vehicle.driver_name}<br>
        ${vehicle.hourly_rate ? `₹${vehicle.hourly_rate}/hr` : ''}
        ${vehicle.per_km_rate ? `₹${vehicle.per_km_rate}/km` : ''}<br>
        Distance: ${vehicle.distance_km ? vehicle.distance_km.toFixed(1) : '?'} km
    `;
    
    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            html: icon,
            iconSize: [35, 35],
            className: 'marker-vehicle'
        })
    }).addTo(mainMap);
    
    marker.bindPopup(popupContent);
    currentMarkers.push(marker);
    
    return marker;
}

// ============================================
// ADD USER LOCATION MARKER
// ============================================

function addUserLocationMarker(lat, lng, userName = 'You') {
    if (!mainMap) return null;
    
    if (userLocationMarker) {
        userLocationMarker.setLatLng([lat, lng]);
        return userLocationMarker;
    }
    
    userLocationMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            html: '📍',
            iconSize: [30, 30],
            className: 'marker-user'
        })
    }).addTo(mainMap).bindPopup(`${userName}'s Location`);
    
    currentMarkers.push(userLocationMarker);
    return userLocationMarker;
}

// ============================================
// UPDATE USER LOCATION
// ============================================

function updateUserLocation(lat, lng) {
    if (userLocationMarker) {
        userLocationMarker.setLatLng([lat, lng]);
        mainMap?.setView([lat, lng], mainMap.getZoom());
    } else {
        addUserLocationMarker(lat, lng);
    }
}

// ============================================
// DRAW ROUTE BETWEEN TWO POINTS
// ============================================

/**
 * Draw a straight line route between two points
 * @param {number} startLat - Start latitude
 * @param {number} startLng - Start longitude
 * @param {number} endLat - End latitude
 * @param {number} endLng - End longitude
 * @param {string} color - Line color (default '#2e7d32')
 */
function drawRoute(startLat, startLng, endLat, endLng, color = '#2e7d32') {
    if (!mainMap) return;
    
    const latlngs = [
        [startLat, startLng],
        [endLat, endLng]
    ];
    
    const polyline = L.polyline(latlngs, {
        color: color,
        weight: 4,
        opacity: 0.7,
        dashArray: '5, 10'
    }).addTo(mainMap);
    
    currentPolylines.push(polyline);
    
    // Fit bounds to show the entire route
    const bounds = L.latLngBounds(latlngs);
    mainMap.fitBounds(bounds, { padding: [50, 50] });
}

// ============================================
// CLEAR ALL MARKERS
// ============================================

function clearMarkers() {
    currentMarkers.forEach(marker => {
        if (mainMap) mainMap.removeLayer(marker);
    });
    currentMarkers = [];
    userLocationMarker = null;
}

// ============================================
// CLEAR ALL ROUTES
// ============================================

function clearRoutes() {
    currentPolylines.forEach(polyline => {
        if (mainMap) mainMap.removeLayer(polyline);
    });
    currentPolylines = [];
}

// ============================================
// CLEAR EVERYTHING
// ============================================

function clearMap() {
    clearMarkers();
    clearRoutes();
}

// ============================================
// CALCULATE DISTANCE (Haversine Formula)
// ============================================

/**
 * Calculate distance between two coordinates in kilometers
 * @param {number} lat1 - First latitude
 * @param {number} lng1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lng2 - Second longitude
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = degToRad(lat2 - lat1);
    const dLng = degToRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
}

function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

// ============================================
// FORMAT DISTANCE FOR DISPLAY
// ============================================

function formatDistanceForDisplay(distanceKm) {
    if (distanceKm < 1) {
        return `${(distanceKm * 1000).toFixed(0)} meters`;
    }
    return `${distanceKm.toFixed(1)} km`;
}

// ============================================
// CHECK IF POINT IS WITHIN RADIUS
// ============================================

/**
 * Check if a point is within a radius of center point
 * @param {number} centerLat - Center latitude
 * @param {number} centerLng - Center longitude
 * @param {number} pointLat - Point latitude
 * @param {number} pointLng - Point longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {boolean} True if within radius
 */
function isWithinRadius(centerLat, centerLng, pointLat, pointLng, radiusKm) {
    const distance = calculateDistance(centerLat, centerLng, pointLat, pointLng);
    return distance <= radiusKm;
}

// ============================================
// GET CURRENT LOCATION
// ============================================

/**
 * Get user's current location using browser geolocation
 * @returns {Promise} Promise with position object
 */
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                reject(new Error(getLocationErrorMessage(error)));
            }
        );
    });
}

function getLocationErrorMessage(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            return 'Location access denied. Please enable location permissions.';
        case error.POSITION_UNAVAILABLE:
            return 'Location information unavailable.';
        case error.TIMEOUT:
            return 'Location request timed out.';
        default:
            return 'An unknown error occurred.';
    }
}

// ============================================
// WATCH USER LOCATION (Continuous tracking)
// ============================================

let watchId = null;

function startWatchingLocation(callback, onError) {
    if (!navigator.geolocation) {
        if (onError) onError(new Error('Geolocation not supported'));
        return null;
    }
    
    watchId = navigator.geolocation.watchPosition(
        (position) => {
            if (callback) {
                callback({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            }
        },
        (error) => {
            if (onError) onError(new Error(getLocationErrorMessage(error)));
        },
        {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
        }
    );
    
    return watchId;
}

function stopWatchingLocation() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

// ============================================
// FIT MAP TO SHOW ALL MARKERS
// ============================================

function fitMapToMarkers() {
    if (!mainMap || currentMarkers.length === 0) return;
    
    const bounds = L.latLngBounds([]);
    currentMarkers.forEach(marker => {
        bounds.extend(marker.getLatLng());
    });
    
    mainMap.fitBounds(bounds, { padding: [50, 50] });
}

// ============================================
// CENTER MAP ON LOCATION
// ============================================

function centerMapOnLocation(lat, lng, zoom = DEFAULT_ZOOM) {
    if (mainMap) {
        mainMap.setView([lat, lng], zoom);
    }
}

// ============================================
// REVERSE GEOCODING (Get address from coordinates)
// ============================================

/**
 * Get address from coordinates using OpenStreetMap Nominatim (FREE)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise} Promise with address string
 */
async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
        );
        const data = await response.json();
        
        if (data.display_name) {
            return data.display_name;
        }
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
}

// ============================================
// FORWARD GEOCODING (Get coordinates from address)
// ============================================

/**
 * Get coordinates from address using OpenStreetMap Nominatim (FREE)
 * @param {string} address - Address string
 * @returns {Promise} Promise with {lat, lng} object
 */
async function forwardGeocode(address) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                display_name: data[0].display_name
            };
        }
        return null;
    } catch (error) {
        console.error('Forward geocoding error:', error);
        return null;
    }
}

// ============================================
// EXPORT FUNCTIONS FOR GLOBAL USE
// ============================================

window.mapUtils = {
    initMap,
    getMap,
    addMarker,
    addVehicleMarker,
    addUserLocationMarker,
    updateUserLocation,
    drawRoute,
    clearMarkers,
    clearRoutes,
    clearMap,
    calculateDistance,
    formatDistanceForDisplay,
    isWithinRadius,
    getCurrentLocation,
    startWatchingLocation,
    stopWatchingLocation,
    fitMapToMarkers,
    centerMapOnLocation,
    reverseGeocode,
    forwardGeocode
};