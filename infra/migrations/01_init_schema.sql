-- ==============================================================================
-- OCEAN VISION ESP32-CAM — Khởi tạo Cấu trúc Cơ sở Dữ liệu MySQL (Migration 01)
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS ocean_vision CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ocean_vision;

-- 1. Bảng Users (Hỗ trợ cả đăng nhập nội bộ & Google OAuth2 Sign-In)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(150) NULL,
    password_hash VARCHAR(255) NOT NULL,
    google_id VARCHAR(128) NULL UNIQUE,
    auth_provider ENUM('LOCAL', 'GOOGLE') NOT NULL DEFAULT 'LOCAL',
    avatar_url VARCHAR(512) NULL,
    status ENUM('ACTIVE', 'SUSPENDED', 'PENDING_MFA') NOT NULL DEFAULT 'ACTIVE',
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_google_id (google_id),
    INDEX idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng Roles & Permissions
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL,
    role_id INT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Bảng Devices
CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    device_key_id VARCHAR(64) NOT NULL UNIQUE,
    status ENUM('ONLINE', 'OFFLINE', 'STALE', 'MAINTENANCE') NOT NULL DEFAULT 'OFFLINE',
    connection_mode ENUM('STA', 'AP', 'AP_STA') NOT NULL DEFAULT 'STA',
    ip_address VARCHAR(45) NULL,
    rssi INT NULL,
    firmware_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    last_seen_at DATETIME NULL,
    config_version INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_devices_status (status),
    INDEX idx_devices_last_seen (last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Bảng Device Credentials
CREATE TABLE IF NOT EXISTS device_credentials (
    device_id VARCHAR(64) PRIMARY KEY,
    secret_hash VARCHAR(255) NOT NULL,
    algorithm VARCHAR(32) NOT NULL DEFAULT 'HMAC-SHA256',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rotated_at DATETIME NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Bảng Capture Schedules
CREATE TABLE IF NOT EXISTS capture_schedules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    interval_seconds INT NOT NULL DEFAULT 60,
    start_time TIME NOT NULL DEFAULT '00:00:00',
    end_time TIME NOT NULL DEFAULT '23:59:59',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    days_of_week VARCHAR(30) NOT NULL DEFAULT '1,2,3,4,5,6,7',
    capture_policy JSON NOT NULL,
    version INT NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    INDEX idx_schedules_device (device_id, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Bảng Device Commands
CREATE TABLE IF NOT EXISTS device_commands (
    id VARCHAR(64) PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL,
    command_type ENUM('CAPTURE_NOW', 'SET_SCHEDULE', 'FLASH_LED', 'REBOOT', 'OTA_UPDATE') NOT NULL,
    payload JSON NULL,
    requested_by BIGINT NULL,
    status ENUM('QUEUED', 'SENT', 'ACKNOWLEDGED', 'COMPLETED', 'FAILED', 'TIMED_OUT') NOT NULL DEFAULT 'QUEUED',
    retry_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    executed_at DATETIME NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_commands_queue (device_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Bảng Retention Policies
CREATE TABLE IF NOT EXISTS retention_policies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    mode ENUM('AFTER_CAPTURE', 'DAILY_CUTOFF') NOT NULL DEFAULT 'AFTER_CAPTURE',
    retention_hours INT NOT NULL DEFAULT 15,
    daily_cutoff_time TIME NOT NULL DEFAULT '15:00:00',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    dedup_exact_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    dedup_perceptual_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    dedup_phash_threshold INT NOT NULL DEFAULT 8,
    dedup_window_seconds INT NOT NULL DEFAULT 900,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Bảng Audit Events
CREATE TABLE IF NOT EXISTS audit_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_type ENUM('USER', 'DEVICE', 'SYSTEM_CRON') NOT NULL,
    actor_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    result ENUM('SUCCESS', 'FAILED', 'REJECTED') NOT NULL,
    ip_address VARCHAR(45) NULL,
    request_id VARCHAR(64) NULL,
    metadata_safe JSON NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_time (timestamp),
    INDEX idx_audit_actor (actor_type, actor_id),
    INDEX idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==============================================================================
-- Dữ liệu Mặc định (Seed Data)
-- ==============================================================================

-- Chèn các Vai trò hệ thống
INSERT IGNORE INTO roles (id, name, description) VALUES
(1, 'SUPER_ADMIN', 'Quản trị viên tối cao: Toàn quyền quản trị hệ thống, bảo mật và audit'),
(2, 'ADMIN', 'Quản trị viên: Quản lý thiết bị, người dùng và chính sách'),
(3, 'OPERATOR', 'Điều hành viên: Xem trực tiếp, điều khiển chụp ảnh, xem thư viện'),
(4, 'VIEWER', 'Người xem: Chỉ xem ảnh và thiết bị được cấp quyền');

-- Chèn các Quyền hạn cơ bản
INSERT IGNORE INTO permissions (id, code, description) VALUES
(1, 'device:view', 'Xem danh sách và trạng thái thiết bị'),
(2, 'device:command', 'Gửi lệnh điều khiển tới thiết bị (chụp ảnh, flash)'),
(3, 'device:manage', 'Thêm, sửa, xóa cấu hình thiết bị'),
(4, 'image:view', 'Xem ảnh và metadata hình ảnh'),
(5, 'image:delete', 'Xóa ảnh thủ công khỏi GridFS'),
(6, 'retention:manage', 'Thay đổi chính sách retention và dedup'),
(7, 'audit:view', 'Xem nhật ký kiểm toán hệ thống');

-- Gán quyền cho Roles
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7),
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5),
(3, 1), (3, 2), (3, 4),
(4, 1), (4, 4);

-- Khởi tạo Chính sách Retention Mặc định (15 Giờ)
INSERT IGNORE INTO retention_policies (id, mode, retention_hours, daily_cutoff_time, timezone, dedup_exact_enabled, dedup_perceptual_enabled, dedup_phash_threshold, dedup_window_seconds)
VALUES (1, 'AFTER_CAPTURE', 15, '15:00:00', 'Asia/Ho_Chi_Minh', TRUE, TRUE, 8, 900);

-- Thiết bị ESP32-CAM mẫu
INSERT IGNORE INTO devices (id, name, device_key_id, status, connection_mode, ip_address, rssi, firmware_version, last_seen_at)
VALUES ('esp32-cam-01', 'ESP32-CAM Cổng Chính (Demo)', 'key-esp32-01', 'ONLINE', 'STA', '192.168.1.105', -54, '1.0.0-turboquant', NOW());

