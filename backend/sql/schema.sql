-- ============================================
-- RURAL VAHAN DATABASE SCHEMA (FIXED)
-- ============================================

DROP DATABASE IF EXISTS rural_vahaan;
CREATE DATABASE rural_vahaan;
USE rural_vahaan;

-- USERS TABLE
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15),
    password VARCHAR(255) NOT NULL,
    role ENUM('passenger', 'driver', 'admin') DEFAULT 'passenger',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VEHICLES TABLE
CREATE TABLE vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    driver_id INT NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    vehicle_name VARCHAR(100),
    vehicle_number VARCHAR(50) UNIQUE,
    is_verified BOOLEAN DEFAULT 1,
    is_available BOOLEAN DEFAULT 1,
    current_lat DECIMAL(10,8) NULL,
    current_lng DECIMAL(11,8) NULL,
    hourly_rate DECIMAL(10,2) NULL,
    per_km_rate DECIMAL(10,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- RIDES TABLE
CREATE TABLE rides (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ride_code VARCHAR(10) UNIQUE NOT NULL,
    passenger_id INT NOT NULL,
    driver_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    pickup_lat DECIMAL(10,8),
    pickup_lng DECIMAL(11,8),
    drop_lat DECIMAL(10,8),
    drop_lng DECIMAL(11,8),
    pickup_address TEXT,
    drop_address TEXT,
    fare DECIMAL(10,2),
    status ENUM('pending', 'accepted', 'started', 'completed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (passenger_id) REFERENCES users(id),
    FOREIGN KEY (driver_id) REFERENCES users(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

SHOW TABLES;