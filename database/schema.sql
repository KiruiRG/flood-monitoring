CREATE DATABASE IF NOT EXISTS flood_alerting CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE flood_alerting;

CREATE TABLE IF NOT EXISTS users (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 full_name VARCHAR(120) NOT NULL,
 email VARCHAR(190) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('citizen','county_officer','admin') NOT NULL DEFAULT 'citizen',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS predictions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 location_name VARCHAR(160) NOT NULL,
 latitude DECIMAL(9,6), longitude DECIMAL(9,6),
 predicted_discharge_m3s DECIMAL(12,3), flood_probability DECIMAL(5,4),
 risk_level ENUM('LOW','MODERATE','HIGH','SEVERE') NOT NULL,
 forecast_for DATETIME NOT NULL, source VARCHAR(80) NOT NULL DEFAULT 'demo',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS alerts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(180) NOT NULL, message TEXT NOT NULL,
 risk_level ENUM('LOW','MODERATE','HIGH','SEVERE') NOT NULL,
 location_name VARCHAR(160) NOT NULL,
 status ENUM('ACTIVE','RESOLVED') NOT NULL DEFAULT 'ACTIVE',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS incident_reports (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 reporter_id BIGINT UNSIGNED NULL,
 incident_type ENUM('flooding','rescue_request','evacuation_help','property_damage','other') NOT NULL DEFAULT 'flooding',
 description TEXT NOT NULL, location_name VARCHAR(200) NOT NULL,
 latitude DECIMAL(9,6), longitude DECIMAL(9,6), contact_phone VARCHAR(40),
 status ENUM('SUBMITTED','UNDER_REVIEW','RESPONDER_CONTACTED','RESOLVED','REJECTED') NOT NULL DEFAULT 'SUBMITTED',
 reviewed_by BIGINT UNSIGNED NULL, reviewed_at DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
 FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS coordination_records (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 incident_id BIGINT UNSIGNED NULL, created_by BIGINT UNSIGNED NULL,
 agency_name VARCHAR(160) NOT NULL, action_note TEXT NOT NULL,
 status ENUM('PLANNED','CONTACTED','STANDBY','COMPLETED') NOT NULL DEFAULT 'PLANNED',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (incident_id) REFERENCES incident_reports(id) ON DELETE SET NULL,
 FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
-- Demo-only example. Replace with verified model output before presenting predictions.
INSERT INTO predictions (location_name,latitude,longitude,predicted_discharge_m3s,flood_probability,risk_level,forecast_for,source)
SELECT 'Garissa demo location',-0.4530,39.6460,520,0.72,'HIGH',DATE_ADD(NOW(),INTERVAL 1 DAY),'demo'
WHERE NOT EXISTS (SELECT 1 FROM predictions);
INSERT INTO alerts (title,message,risk_level,location_name,status)
SELECT 'Demonstration high-flow alert','Sample interface data only; not a real warning.','HIGH','Garissa demo location','ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM alerts);
