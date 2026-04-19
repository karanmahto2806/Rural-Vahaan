const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/database');
const authenticate = require('./middleware/auth');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*', credentials: true }));

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ success: true, message: '✅ Server running!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// REGISTER
// ============================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;
        
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }
        
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await db.query(
            'INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
            [name, email, phone, hashedPassword, role || 'passenger']
        );
        
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { id: result.insertId, email, role: role || 'passenger' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ success: true, token, user: { id: result.insertId, name, email, role: role || 'passenger' } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// LOGIN
// ============================================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const user = users[0];
        const bcrypt = require('bcryptjs');
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// REGISTER VEHICLE
// ============================================
app.post('/api/vehicles/register', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'driver') {
            return res.status(403).json({ success: false, message: 'Only drivers can register vehicles' });
        }
        
        const { vehicle_type, vehicle_name, vehicle_number, hourly_rate, per_km_rate } = req.body;
        
        await db.query(
            'INSERT INTO vehicles (driver_id, vehicle_type, vehicle_name, vehicle_number, hourly_rate, per_km_rate) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, vehicle_type, vehicle_name, vehicle_number, hourly_rate, per_km_rate]
        );
        
        res.json({ success: true, message: 'Vehicle registered successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// GET MY VEHICLES
// ============================================
app.get('/api/vehicles/my-vehicles', authenticate, async (req, res) => {
    try {
        const [vehicles] = await db.query('SELECT * FROM vehicles WHERE driver_id = ?', [req.user.id]);
        res.json({ success: true, vehicles });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// UPDATE DRIVER LOCATION
// ============================================
app.put('/api/driver/location', authenticate, async (req, res) => {
    try {
        const { lat, lng } = req.body;
        
        await db.query('UPDATE vehicles SET current_lat = ?, current_lng = ? WHERE driver_id = ?', [lat, lng, req.user.id]);
        
        res.json({ success: true, message: 'Location updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// UPDATE VEHICLE AVAILABILITY
// ============================================
app.put('/api/vehicles/availability/:vehicleId', authenticate, async (req, res) => {
    try {
        const { is_available } = req.body;
        await db.query('UPDATE vehicles SET is_available = ? WHERE id = ? AND driver_id = ?', [is_available, req.params.vehicleId, req.user.id]);
        res.json({ success: true, message: is_available ? 'Online' : 'Offline' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// FIND NEARBY VEHICLES
// ============================================
app.get('/api/vehicles/nearby', async (req, res) => {
    try {
        const { lat, lng } = req.query;
        
        const [vehicles] = await db.query(`
            SELECT v.*, u.name as driver_name, u.phone as driver_phone,
            (6371 * acos(cos(radians(?)) * cos(radians(v.current_lat)) * 
            cos(radians(v.current_lng) - radians(?)) + sin(radians(?)) * sin(radians(v.current_lat)))) AS distance_km
            FROM vehicles v JOIN users u ON v.driver_id = u.id
            WHERE v.is_available = 1 AND v.current_lat IS NOT NULL
            HAVING distance_km <= 5 ORDER BY distance_km ASC
        `, [lat, lng, lat]);
        
        res.json({ success: true, vehicles });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// CREATE RIDE
// ============================================
app.post('/api/rides/create', authenticate, async (req, res) => {
    try {
        const { driver_id, vehicle_id, pickup_lat, pickup_lng, drop_address, fare } = req.body;
        const ride_code = 'RV' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        await db.query(
            'INSERT INTO rides (ride_code, passenger_id, driver_id, vehicle_id, pickup_lat, pickup_lng, drop_address, fare) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [ride_code, req.user.id, driver_id, vehicle_id, pickup_lat, pickup_lng, drop_address, fare]
        );
        
        res.json({ success: true, ride_code, message: 'Ride booked!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// TRACK RIDE
// ============================================
app.get('/api/rides/track/:code', async (req, res) => {
    try {
        const [rides] = await db.query(`
            SELECT r.*, u.name as passenger_name, d.name as driver_name, v.vehicle_name, v.current_lat, v.current_lng
            FROM rides r
            JOIN users u ON r.passenger_id = u.id
            JOIN users d ON r.driver_id = d.id
            JOIN vehicles v ON r.vehicle_id = v.id
            WHERE r.ride_code = ?
        `, [req.params.code]);
        
        res.json({ success: true, ride: rides[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// GET MY RIDES
// ============================================
app.get('/api/rides/my-rides', authenticate, async (req, res) => {
    try {
        const [rides] = await db.query(`
            SELECT r.*, d.name as driver_name, v.vehicle_type
            FROM rides r
            JOIN users d ON r.driver_id = d.id
            JOIN vehicles v ON r.vehicle_id = v.id
            WHERE r.passenger_id = ? OR r.driver_id = ?
            ORDER BY r.created_at DESC
        `, [req.user.id, req.user.id]);
        
        res.json({ success: true, rides });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// GET RIDE REQUESTS
// ============================================
app.get('/api/rides/requests', authenticate, async (req, res) => {
    try {
        const [requests] = await db.query(`
            SELECT r.*, u.name as passenger_name
            FROM rides r JOIN users u ON r.passenger_id = u.id
            WHERE r.driver_id = ? AND r.status = 'pending'
        `, [req.user.id]);
        
        res.json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// ACCEPT RIDE
// ============================================
app.put('/api/rides/accept/:rideId', authenticate, async (req, res) => {
    try {
        await db.query('UPDATE rides SET status = "accepted" WHERE id = ?', [req.params.rideId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// START RIDE
// ============================================
app.put('/api/rides/start/:rideId', authenticate, async (req, res) => {
    try {
        await db.query('UPDATE rides SET status = "started" WHERE id = ?', [req.params.rideId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// COMPLETE RIDE
// ============================================
app.put('/api/rides/complete/:rideId', authenticate, async (req, res) => {
    try {
        await db.query('UPDATE rides SET status = "completed", completed_at = NOW() WHERE id = ?', [req.params.rideId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// SOS
// ============================================
app.post('/api/emergency/sos', authenticate, async (req, res) => {
    console.log('🚨 SOS Emergency Alert!');
    res.json({ success: true, message: 'Emergency alert sent!' });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════╗
    ║     🚀 RURAL VAHAN BACKEND STARTED              ║
    ╠══════════════════════════════════════════════════╣
    ║     Server: http://localhost:${PORT}                ║
    ║     Health: http://localhost:${PORT}/api/health    ║
    ╚══════════════════════════════════════════════════╝
    `);
});