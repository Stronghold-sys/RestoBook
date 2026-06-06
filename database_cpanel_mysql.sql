-- ====================================================================
--  RestoBook — COMPLETE MySQL / MariaDB Migration for cPanel
--  Version  : 3.0 FINAL — Semua tabel tanpa terkecuali
--  Target   : MySQL 8.0+ / MariaDB 10.6+
--  Dibuat   : 2026-06-06
--
--  CARA PAKAI DI cPANEL:
--  1. Login cPanel → MySQL Databases
--     → Buat database baru (contoh: namauser_restobook)
--     → Buat user MySQL + password → Assign user ke db (ALL PRIVILEGES)
--  2. cPanel → phpMyAdmin → pilih database tersebut
--  3. Klik tab "Import" → upload file ini → klik GO
--  4. Atau klik tab "SQL" → paste isi file ini → klik GO
--
--  DAFTAR TABEL (50 tabel total):
--  Core       : users, profiles
--  Menu       : categories, menu_items
--  Pesanan    : tables, orders, order_items, order_chat_messages,
--               order_chats, order_estimation_settings
--  Reservasi  : reservations
--  Karyawan   : attendance, shifts, work_shifts, work_shift_assignments,
--               resign_requests, salary_periods, salary_records,
--               employee_fines, employee_kasbon
--  Keuangan   : vouchers, customer_vouchers, point_transactions,
--               rewards, reward_redemptions, wallets,
--               wallet_transactions, wallet_activations,
--               wallet_activation_logs, wallet_audit_logs
--  Support    : support_tickets, ticket_messages, support_settings,
--               appeals, suspend_logs
--  Profil     : favorites, notifications, otp_codes, reviews,
--               profile_audit_logs, audit_logs, maintenance_logs
--  Restoran   : restaurant_settings
--  Keamanan   : security_logs, security_ip_rules, security_block_rules,
--               security_login_locations, security_settings,
--               security_nonces, security_user_sessions,
--               security_incidents, security_fingerprint_ips,
--               security_subnet_blocks, security_request_signatures
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ====================================================================
-- BAGIAN 1 — AUTENTIKASI
-- (Pengganti auth.users Supabase — simpan sendiri atau tetap pakai
--  Supabase auth & simpan UUID di kolom auth_id)
-- ====================================================================

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id`             CHAR(36)     NOT NULL DEFAULT (UUID()),
  `email`          VARCHAR(255) NOT NULL,
  `password_hash`  TEXT         NOT NULL COMMENT 'bcrypt hash',
  `email_verified` TINYINT(1)   NOT NULL DEFAULT 0,
  `is_active`      TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabel autentikasi — pengganti auth.users Supabase';

-- ====================================================================
-- BAGIAN 2 — PROFILES
-- ====================================================================

DROP TABLE IF EXISTS `profiles`;
CREATE TABLE `profiles` (
  `id`                    CHAR(36)     NOT NULL DEFAULT (UUID()),
  `user_id`               CHAR(36)     NOT NULL COMMENT 'ref ke users.id atau Supabase auth UUID',
  `employee_id`           VARCHAR(50)  DEFAULT NULL,
  `full_name`             VARCHAR(255) NOT NULL,
  `email`                 VARCHAR(255) DEFAULT NULL,
  `phone`                 VARCHAR(30)  DEFAULT NULL,
  `avatar_url`            TEXT         DEFAULT NULL,
  `role`                  ENUM('customer','cashier','admin') NOT NULL DEFAULT 'customer',
  `is_active`             TINYINT(1)   NOT NULL DEFAULT 1,
  `is_blocked`            TINYINT(1)   NOT NULL DEFAULT 0,
  `temp_password`         TEXT         DEFAULT NULL,
  `email_unlocked`        TINYINT(1)   NOT NULL DEFAULT 0,
  `failed_login_attempts` INT          NOT NULL DEFAULT 0,
  `locked_until`          DATETIME     DEFAULT NULL,
  `last_login_attempt_at` DATETIME     DEFAULT NULL,
  `created_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_profiles_user_id` (`user_id`),
  UNIQUE KEY `uq_profiles_employee_id` (`employee_id`),
  KEY `idx_profiles_user_id` (`user_id`),
  KEY `idx_profiles_role` (`role`),
  KEY `idx_profiles_is_active` (`is_active`),
  CONSTRAINT `fk_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 3 — PENGATURAN RESTORAN
-- ====================================================================

DROP TABLE IF EXISTS `restaurant_settings`;
CREATE TABLE `restaurant_settings` (
  `id`                           CHAR(36)      NOT NULL DEFAULT (UUID()),
  `name`                         VARCHAR(255)  NOT NULL DEFAULT 'RestoBook',
  `address`                      TEXT          DEFAULT NULL,
  `phone`                        VARCHAR(30)   DEFAULT NULL,
  `email`                        VARCHAR(255)  DEFAULT NULL,
  `logo_url`                     TEXT          DEFAULT NULL,
  `opening_time`                 TIME          NOT NULL DEFAULT '08:00:00',
  `closing_time`                 TIME          NOT NULL DEFAULT '22:00:00',
  `tax_percent`                  DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  `payment_expiry_minutes`       INT           NOT NULL DEFAULT 30,
  `resto_latitude`               DOUBLE        NOT NULL DEFAULT -7.7829,
  `resto_longitude`              DOUBLE        NOT NULL DEFAULT 110.3323,
  `shipping_rate_per_km`         DECIMAL(12,2) NOT NULL DEFAULT 2500.00,
  `min_shipping_distance`        DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  `max_shipping_distance`        DECIMAL(10,2) NOT NULL DEFAULT 15.00,
  `additional_zone_charge`       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `min_order_for_free_shipping`  DECIMAL(12,2) NOT NULL DEFAULT 100000.00,
  `is_shipping_enabled`          TINYINT(1)    NOT NULL DEFAULT 1,
  `is_maintenance_active`        TINYINT(1)    NOT NULL DEFAULT 0,
  `maintenance_message`          TEXT          DEFAULT NULL,
  `maintenance_estimated_hours`  VARCHAR(50)   DEFAULT '2 Jam',
  `reservation_settings`         JSON          DEFAULT NULL COMMENT 'konfigurasi reservasi dalam format JSON',
  `created_at`                   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `restaurant_settings`
  (`name`,`address`,`phone`,`email`,`opening_time`,`closing_time`,`tax_percent`,`payment_expiry_minutes`)
VALUES
  ('RestoBook','Jl. Contoh No. 123, Jakarta','021-12345678','info@restobook.com','08:00:00','22:00:00',0,30);

-- ====================================================================
-- BAGIAN 4 — MAINTENANCE LOGS
-- ====================================================================

DROP TABLE IF EXISTS `maintenance_logs`;
CREATE TABLE `maintenance_logs` (
  `id`         CHAR(36)    NOT NULL DEFAULT (UUID()),
  `started_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at`   DATETIME    DEFAULT NULL,
  `reason`     TEXT        DEFAULT NULL,
  `started_by` CHAR(36)    DEFAULT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ml_started` (`started_at`),
  CONSTRAINT `fk_ml_started_by` FOREIGN KEY (`started_by`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 5 — KATEGORI MENU
-- ====================================================================

DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id`          CHAR(36)     NOT NULL DEFAULT (UUID()),
  `name`        VARCHAR(255) NOT NULL,
  `description` TEXT         DEFAULT NULL,
  `image_url`   TEXT         DEFAULT NULL,
  `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
  `sort_order`  INT          NOT NULL DEFAULT 0,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_categories_active` (`is_active`),
  KEY `idx_categories_sort`   (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 6 — MENU ITEMS
-- ====================================================================

DROP TABLE IF EXISTS `menu_items`;
CREATE TABLE `menu_items` (
  `id`          CHAR(36)      NOT NULL DEFAULT (UUID()),
  `category_id` CHAR(36)      DEFAULT NULL,
  `name`        VARCHAR(255)  NOT NULL,
  `description` TEXT          DEFAULT NULL,
  `price`       DECIMAL(12,2) NOT NULL,
  `image_url`   TEXT          DEFAULT NULL,
  `is_active`   TINYINT(1)    NOT NULL DEFAULT 1,
  `stock`       INT           NOT NULL DEFAULT 0,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_menu_items_category` (`category_id`),
  KEY `idx_menu_items_active`   (`is_active`),
  KEY `idx_menu_items_name`     (`name`),
  CONSTRAINT `fk_menu_items_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 7 — MEJA RESTORAN
-- ====================================================================

DROP TABLE IF EXISTS `tables`;
CREATE TABLE `tables` (
  `id`           CHAR(36) NOT NULL DEFAULT (UUID()),
  `table_number` INT      NOT NULL,
  `capacity`     INT      NOT NULL,
  `status`       ENUM('available','occupied','reserved') NOT NULL DEFAULT 'available',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tables_number` (`table_number`),
  KEY `idx_tables_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 8 — VOUCHERS
-- ====================================================================

DROP TABLE IF EXISTS `vouchers`;
CREATE TABLE `vouchers` (
  `id`               CHAR(36)      NOT NULL DEFAULT (UUID()),
  `code`             VARCHAR(50)   NOT NULL,
  `name`             VARCHAR(255)  DEFAULT NULL,
  `description`      TEXT          DEFAULT NULL,
  `voucher_type`     VARCHAR(30)   NOT NULL DEFAULT 'general' COMMENT 'general|shipping',
  `discount_type`    VARCHAR(20)   NOT NULL DEFAULT 'percent' COMMENT 'percent|nominal',
  `discount_value`   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `min_transaction`  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `max_discount`     DECIMAL(12,2) DEFAULT NULL,
  `usage_limit`      INT           DEFAULT NULL,
  `used_count`       INT           NOT NULL DEFAULT 0,
  `is_active`        TINYINT(1)    NOT NULL DEFAULT 1,
  `valid_from`       DATETIME      DEFAULT NULL,
  `valid_until`      DATETIME      DEFAULT NULL,
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vouchers_code` (`code`),
  KEY `idx_vouchers_active` (`is_active`),
  KEY `idx_vouchers_valid`  (`valid_from`,`valid_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 9 — CUSTOMER VOUCHERS (pemakaian voucher per pelanggan)
-- ====================================================================

DROP TABLE IF EXISTS `customer_vouchers`;
CREATE TABLE `customer_vouchers` (
  `id`          CHAR(36) NOT NULL DEFAULT (UUID()),
  `customer_id` CHAR(36) NOT NULL,
  `voucher_id`  CHAR(36) NOT NULL,
  `used_count`  INT      NOT NULL DEFAULT 0,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customer_voucher` (`customer_id`,`voucher_id`),
  KEY `idx_cv_customer` (`customer_id`),
  KEY `idx_cv_voucher`  (`voucher_id`),
  CONSTRAINT `fk_cv_customer` FOREIGN KEY (`customer_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cv_voucher`  FOREIGN KEY (`voucher_id`)  REFERENCES `vouchers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 10 — ORDERS (Pesanan)
-- ====================================================================

DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id`                CHAR(36)      NOT NULL DEFAULT (UUID()),
  `customer_id`       CHAR(36)      DEFAULT NULL,
  `cashier_id`        CHAR(36)      DEFAULT NULL,
  `table_id`          CHAR(36)      DEFAULT NULL,
  `voucher_id`        CHAR(36)      DEFAULT NULL,
  `order_type`        ENUM('dine_in','takeaway','delivery') NOT NULL,
  `status`            ENUM('pending','confirmed','processing','ready','completed','cancelled') NOT NULL DEFAULT 'pending',
  `total_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount`   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `final_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_method`    ENUM('cash','non_cash') DEFAULT NULL,
  `payment_status`    ENUM('unpaid','paid','expired') NOT NULL DEFAULT 'unpaid',
  `distance_km`       DECIMAL(10,2) DEFAULT NULL,
  `shipping_fee`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `shipping_discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `customer_lat`      DOUBLE        DEFAULT NULL,
  `customer_lng`      DOUBLE        DEFAULT NULL,
  `delivery_address`  TEXT          DEFAULT NULL,
  `notes`             TEXT          DEFAULT NULL,
  `cancel_reason`     TEXT          DEFAULT NULL,
  `expires_at`        DATETIME      DEFAULT NULL,
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_orders_customer`        (`customer_id`),
  KEY `idx_orders_cashier`         (`cashier_id`),
  KEY `idx_orders_table`           (`table_id`),
  KEY `idx_orders_status`          (`status`),
  KEY `idx_orders_payment_status`  (`payment_status`),
  KEY `idx_orders_created`         (`created_at`),
  KEY `idx_orders_created_status`  (`created_at`,`status`),
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_orders_cashier`  FOREIGN KEY (`cashier_id`)  REFERENCES `profiles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_orders_table`    FOREIGN KEY (`table_id`)    REFERENCES `tables`   (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_orders_voucher`  FOREIGN KEY (`voucher_id`)  REFERENCES `vouchers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 11 — ORDER ITEMS
-- ====================================================================

DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id`           CHAR(36)      NOT NULL DEFAULT (UUID()),
  `order_id`     CHAR(36)      NOT NULL,
  `menu_item_id` CHAR(36)      DEFAULT NULL,
  `quantity`     INT           NOT NULL,
  `price`        DECIMAL(12,2) NOT NULL,
  `subtotal`     DECIMAL(12,2) NOT NULL,
  `notes`        TEXT          DEFAULT NULL,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_menu`  (`menu_item_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`)     REFERENCES `orders`     (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_menu`  FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 12 — ORDER ESTIMATION SETTINGS
-- ====================================================================

DROP TABLE IF EXISTS `order_estimation_settings`;
CREATE TABLE `order_estimation_settings` (
  `id`                  CHAR(36) NOT NULL DEFAULT (UUID()),
  `order_type`          ENUM('dine_in','takeaway','delivery') NOT NULL,
  `min_minutes`         INT      NOT NULL DEFAULT 10,
  `max_minutes`         INT      NOT NULL DEFAULT 30,
  `auto_confirm`        TINYINT(1) NOT NULL DEFAULT 0,
  `auto_confirm_delay`  INT      NOT NULL DEFAULT 0 COMMENT 'detik delay sebelum auto confirm',
  `is_active`           TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_oes_type` (`order_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `order_estimation_settings` (`order_type`,`min_minutes`,`max_minutes`) VALUES
  ('dine_in', 10, 20),
  ('takeaway', 15, 30),
  ('delivery', 30, 60);

-- ====================================================================
-- BAGIAN 13 — ORDER CHATS & MESSAGES
-- ====================================================================

DROP TABLE IF EXISTS `order_chats`;
CREATE TABLE `order_chats` (
  `id`         CHAR(36) NOT NULL DEFAULT (UUID()),
  `order_id`   CHAR(36) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_order_chat` (`order_id`),
  CONSTRAINT `fk_order_chats_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `order_chat_messages`;
CREATE TABLE `order_chat_messages` (
  `id`          CHAR(36)     NOT NULL DEFAULT (UUID()),
  `chat_id`     CHAR(36)     DEFAULT NULL,
  `order_id`    CHAR(36)     DEFAULT NULL,
  `sender_id`   CHAR(36)     DEFAULT NULL,
  `sender_role` ENUM('customer','cashier','admin','system') NOT NULL DEFAULT 'customer',
  `message`     TEXT         NOT NULL,
  `is_read`     TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ocm_chat`   (`chat_id`),
  KEY `idx_ocm_order`  (`order_id`),
  KEY `idx_ocm_sender` (`sender_id`),
  CONSTRAINT `fk_ocm_chat`   FOREIGN KEY (`chat_id`)   REFERENCES `order_chats` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ocm_order`  FOREIGN KEY (`order_id`)  REFERENCES `orders`      (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ocm_sender` FOREIGN KEY (`sender_id`) REFERENCES `profiles`    (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 14 — RESERVATIONS
-- ====================================================================

DROP TABLE IF EXISTS `reservations`;
CREATE TABLE `reservations` (
  `id`               CHAR(36) NOT NULL DEFAULT (UUID()),
  `customer_id`      CHAR(36) DEFAULT NULL,
  `table_id`         CHAR(36) DEFAULT NULL,
  `reservation_date` DATE     NOT NULL,
  `reservation_time` TIME     NOT NULL,
  `guest_count`      INT      NOT NULL,
  `status`           ENUM('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
  `notes`            TEXT     DEFAULT NULL,
  `admin_notes`      TEXT     DEFAULT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reservations_customer` (`customer_id`),
  KEY `idx_reservations_table`    (`table_id`),
  KEY `idx_reservations_date`     (`reservation_date`),
  CONSTRAINT `fk_reservations_customer` FOREIGN KEY (`customer_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reservations_table`    FOREIGN KEY (`table_id`)    REFERENCES `tables`   (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 15 — REVIEWS (Ulasan)
-- ====================================================================

DROP TABLE IF EXISTS `reviews`;
CREATE TABLE `reviews` (
  `id`           CHAR(36)   NOT NULL DEFAULT (UUID()),
  `customer_id`  CHAR(36)   DEFAULT NULL,
  `order_id`     CHAR(36)   DEFAULT NULL,
  `rating`       TINYINT    NOT NULL,
  `comment`      TEXT       DEFAULT NULL,
  `is_published` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`   DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reviews_order` (`order_id`),
  KEY `idx_reviews_customer`  (`customer_id`),
  KEY `idx_reviews_published` (`is_published`),
  CONSTRAINT `fk_reviews_customer` FOREIGN KEY (`customer_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reviews_order`    FOREIGN KEY (`order_id`)    REFERENCES `orders`   (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_reviews_rating`  CHECK (`rating` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 16 — FAVORITES
-- ====================================================================

DROP TABLE IF EXISTS `favorites`;
CREATE TABLE `favorites` (
  `id`           CHAR(36) NOT NULL DEFAULT (UUID()),
  `customer_id`  CHAR(36) NOT NULL,
  `menu_item_id` CHAR(36) NOT NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_favorites` (`customer_id`,`menu_item_id`),
  KEY `idx_favorites_customer` (`customer_id`),
  CONSTRAINT `fk_favorites_customer`  FOREIGN KEY (`customer_id`)  REFERENCES `profiles`   (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_favorites_menu_item` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 17 — NOTIFICATIONS
-- ====================================================================

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id`           CHAR(36)     NOT NULL DEFAULT (UUID()),
  `user_id`      CHAR(36)     NOT NULL,
  `title`        VARCHAR(255) NOT NULL,
  `message`      TEXT         NOT NULL,
  `is_read`      TINYINT(1)   NOT NULL DEFAULT 0,
  `type`         VARCHAR(50)  DEFAULT NULL,
  `reference_id` CHAR(36)     DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`),
  KEY `idx_notifications_read` (`is_read`),
  KEY `idx_notifications_type` (`type`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 18 — OTP CODES
-- ====================================================================

DROP TABLE IF EXISTS `otp_codes`;
CREATE TABLE `otp_codes` (
  `id`         CHAR(36)     NOT NULL DEFAULT (UUID()),
  `email`      VARCHAR(255) NOT NULL,
  `code`       VARCHAR(20)  NOT NULL,
  `type`       ENUM('registration','forgot_password') NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `is_used`    TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_email`      (`email`),
  KEY `idx_otp_expires`    (`expires_at`),
  KEY `idx_otp_email_code` (`email`,`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 19 — POINT TRANSACTIONS
-- ====================================================================

DROP TABLE IF EXISTS `point_transactions`;
CREATE TABLE `point_transactions` (
  `id`          CHAR(36) NOT NULL DEFAULT (UUID()),
  `customer_id` CHAR(36) NOT NULL,
  `order_id`    CHAR(36) DEFAULT NULL,
  `type`        ENUM('earn','redeem','bonus','expire') NOT NULL,
  `points`      INT      NOT NULL,
  `balance`     INT      NOT NULL DEFAULT 0,
  `description` TEXT     DEFAULT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_point_transactions_customer` (`customer_id`,`created_at`),
  CONSTRAINT `fk_pt_customer` FOREIGN KEY (`customer_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pt_order`    FOREIGN KEY (`order_id`)    REFERENCES `orders`   (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 20 — REWARDS & REDEMPTIONS
-- ====================================================================

DROP TABLE IF EXISTS `rewards`;
CREATE TABLE `rewards` (
  `id`              CHAR(36)      NOT NULL DEFAULT (UUID()),
  `name`            VARCHAR(255)  NOT NULL,
  `description`     TEXT          DEFAULT NULL,
  `image_url`       TEXT          DEFAULT NULL,
  `points_required` INT           NOT NULL DEFAULT 0,
  `reward_type`     ENUM('voucher','merchandise','cashback','other') NOT NULL DEFAULT 'voucher',
  `reward_value`    DECIMAL(12,2) DEFAULT NULL,
  `stock`           INT           DEFAULT NULL COMMENT 'NULL = unlimited',
  `is_active`       TINYINT(1)    NOT NULL DEFAULT 1,
  `valid_until`     DATETIME      DEFAULT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rewards_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `reward_redemptions`;
CREATE TABLE `reward_redemptions` (
  `id`          CHAR(36) NOT NULL DEFAULT (UUID()),
  `customer_id` CHAR(36) NOT NULL,
  `reward_id`   CHAR(36) NOT NULL,
  `points_used` INT      NOT NULL,
  `status`      ENUM('pending','approved','rejected','claimed') NOT NULL DEFAULT 'pending',
  `notes`       TEXT     DEFAULT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rr_customer` (`customer_id`),
  KEY `idx_rr_reward`   (`reward_id`),
  CONSTRAINT `fk_rr_customer` FOREIGN KEY (`customer_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rr_reward`   FOREIGN KEY (`reward_id`)   REFERENCES `rewards`  (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 21 — WALLETS (Dompet Digital)
-- ====================================================================

DROP TABLE IF EXISTS `wallets`;
CREATE TABLE `wallets` (
  `id`          CHAR(36)      NOT NULL DEFAULT (UUID()),
  `customer_id` CHAR(36)      NOT NULL,
  `balance`     DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `is_active`   TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wallets_customer` (`customer_id`),
  CONSTRAINT `fk_wallets_customer` FOREIGN KEY (`customer_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `wallet_transactions`;
CREATE TABLE `wallet_transactions` (
  `id`            CHAR(36)      NOT NULL DEFAULT (UUID()),
  `wallet_id`     CHAR(36)      NOT NULL,
  `order_id`      CHAR(36)      DEFAULT NULL,
  `type`          ENUM('topup','payment','refund','bonus','withdraw') NOT NULL,
  `amount`        DECIMAL(14,2) NOT NULL,
  `balance_after` DECIMAL(14,2) NOT NULL,
  `description`   TEXT          DEFAULT NULL,
  `status`        ENUM('pending','success','failed','cancelled') NOT NULL DEFAULT 'success',
  `reference_id`  VARCHAR(100)  DEFAULT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wt_wallet` (`wallet_id`),
  KEY `idx_wt_order`  (`order_id`),
  KEY `idx_wt_type`   (`type`),
  CONSTRAINT `fk_wt_wallet` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wt_order`  FOREIGN KEY (`order_id`)  REFERENCES `orders`  (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Aktivasi Dompet (persetujuan admin)
DROP TABLE IF EXISTS `wallet_activations`;
CREATE TABLE `wallet_activations` (
  `id`           CHAR(36)     NOT NULL DEFAULT (UUID()),
  `customer_id`  CHAR(36)     NOT NULL,
  `wallet_id`    CHAR(36)     DEFAULT NULL,
  `full_name`    VARCHAR(255) DEFAULT NULL,
  `phone`        VARCHAR(30)  DEFAULT NULL,
  `id_number`    VARCHAR(30)  DEFAULT NULL COMMENT 'NIK KTP',
  `id_photo_url` TEXT         DEFAULT NULL,
  `status`       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by`  CHAR(36)     DEFAULT NULL,
  `review_notes` TEXT         DEFAULT NULL,
  `reviewed_at`  DATETIME     DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wa_customer` (`customer_id`),
  KEY `idx_wa_status`   (`status`),
  CONSTRAINT `fk_wa_customer`   FOREIGN KEY (`customer_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wa_wallet`     FOREIGN KEY (`wallet_id`)   REFERENCES `wallets`  (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wa_reviewed`   FOREIGN KEY (`reviewed_by`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log Aktivasi Dompet
DROP TABLE IF EXISTS `wallet_activation_logs`;
CREATE TABLE `wallet_activation_logs` (
  `id`             CHAR(36) NOT NULL DEFAULT (UUID()),
  `activation_id`  CHAR(36) NOT NULL,
  `action`         VARCHAR(50) NOT NULL,
  `performed_by`   CHAR(36) DEFAULT NULL,
  `notes`          TEXT     DEFAULT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wal_activation` (`activation_id`),
  CONSTRAINT `fk_wal_activation`   FOREIGN KEY (`activation_id`) REFERENCES `wallet_activations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wal_performed_by` FOREIGN KEY (`performed_by`)  REFERENCES `profiles`           (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Log Dompet
DROP TABLE IF EXISTS `wallet_audit_logs`;
CREATE TABLE `wallet_audit_logs` (
  `id`            CHAR(36)      NOT NULL DEFAULT (UUID()),
  `wallet_id`     CHAR(36)      NOT NULL,
  `action`        VARCHAR(100)  NOT NULL,
  `amount`        DECIMAL(14,2) DEFAULT NULL,
  `balance_before` DECIMAL(14,2) DEFAULT NULL,
  `balance_after` DECIMAL(14,2) DEFAULT NULL,
  `performed_by`  CHAR(36)      DEFAULT NULL,
  `ip_address`    VARCHAR(45)   DEFAULT NULL,
  `notes`         TEXT          DEFAULT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wal_audit_wallet` (`wallet_id`),
  KEY `idx_wal_audit_created` (`created_at`),
  CONSTRAINT `fk_wal_audit_wallet` FOREIGN KEY (`wallet_id`)    REFERENCES `wallets`  (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wal_audit_by`     FOREIGN KEY (`performed_by`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 22 — KARYAWAN: ATTENDANCE, SHIFTS, WORK SHIFTS
-- ====================================================================

DROP TABLE IF EXISTS `attendance`;
CREATE TABLE `attendance` (
  `id`             CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id`        CHAR(36) DEFAULT NULL,
  `profile_id`     CHAR(36) DEFAULT NULL,
  `type`           ENUM('check_in','check_out','sakit','izin','alpha') NOT NULL,
  `status`         ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
  `notes`          TEXT     DEFAULT NULL,
  `photo_url`      TEXT     DEFAULT NULL,
  `attachment_url` TEXT     DEFAULT NULL,
  `location`       TEXT     DEFAULT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_attendance_user_id`    (`user_id`),
  KEY `idx_attendance_profile_id` (`profile_id`),
  KEY `idx_attendance_type`       (`type`),
  KEY `idx_attendance_status`     (`status`),
  KEY `idx_attendance_created`    (`created_at`),
  CONSTRAINT `fk_attendance_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_attendance_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `shifts`;
CREATE TABLE `shifts` (
  `id`                CHAR(36)      NOT NULL DEFAULT (UUID()),
  `user_id`           CHAR(36)      DEFAULT NULL,
  `profile_id`        CHAR(36)      DEFAULT NULL,
  `start_time`        DATETIME      NOT NULL,
  `end_time`          DATETIME      DEFAULT NULL,
  `initial_cash`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `final_cash_system` DECIMAL(12,2) DEFAULT NULL,
  `final_cash_actual` DECIMAL(12,2) DEFAULT NULL,
  `difference`        DECIMAL(12,2) DEFAULT NULL,
  `status`            ENUM('open','closed') NOT NULL DEFAULT 'open',
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_shifts_user_id`    (`user_id`),
  KEY `idx_shifts_profile_id` (`profile_id`),
  KEY `idx_shifts_status`     (`status`),
  CONSTRAINT `fk_shifts_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_shifts_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Template Shift Kerja
DROP TABLE IF EXISTS `work_shifts`;
CREATE TABLE `work_shifts` (
  `id`         CHAR(36)     NOT NULL DEFAULT (UUID()),
  `name`       VARCHAR(100) NOT NULL COMMENT 'Pagi, Sore, Malam, dll',
  `start_time` TIME         NOT NULL,
  `end_time`   TIME         NOT NULL,
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_work_shifts_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Penugasan Shift ke Karyawan
DROP TABLE IF EXISTS `work_shift_assignments`;
CREATE TABLE `work_shift_assignments` (
  `id`             CHAR(36) NOT NULL DEFAULT (UUID()),
  `profile_id`     CHAR(36) NOT NULL,
  `work_shift_id`  CHAR(36) NOT NULL,
  `work_date`      DATE     NOT NULL,
  `status`         ENUM('scheduled','present','absent','swap') NOT NULL DEFAULT 'scheduled',
  `swap_with`      CHAR(36) DEFAULT NULL COMMENT 'profile_id yang menggantikan',
  `notes`          TEXT     DEFAULT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wsa_profile`    (`profile_id`),
  KEY `idx_wsa_shift`      (`work_shift_id`),
  KEY `idx_wsa_date`       (`work_date`),
  CONSTRAINT `fk_wsa_profile`    FOREIGN KEY (`profile_id`)    REFERENCES `profiles`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wsa_work_shift` FOREIGN KEY (`work_shift_id`) REFERENCES `work_shifts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wsa_swap_with`  FOREIGN KEY (`swap_with`)     REFERENCES `profiles`    (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 23 — PENGGAJIAN (SALARY)
-- ====================================================================

DROP TABLE IF EXISTS `salary_periods`;
CREATE TABLE `salary_periods` (
  `id`           CHAR(36)     NOT NULL DEFAULT (UUID()),
  `name`         VARCHAR(100) NOT NULL COMMENT 'contoh: Juni 2026',
  `period_start` DATE         NOT NULL,
  `period_end`   DATE         NOT NULL,
  `status`       ENUM('draft','finalized','paid') NOT NULL DEFAULT 'draft',
  `created_by`   CHAR(36)     DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sp_period` (`period_start`,`period_end`),
  CONSTRAINT `fk_sp_created_by` FOREIGN KEY (`created_by`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `salary_records`;
CREATE TABLE `salary_records` (
  `id`             CHAR(36)      NOT NULL DEFAULT (UUID()),
  `period_id`      CHAR(36)      NOT NULL,
  `profile_id`     CHAR(36)      NOT NULL,
  `base_salary`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_days`     INT           NOT NULL DEFAULT 0,
  `present_days`   INT           NOT NULL DEFAULT 0,
  `sick_days`      INT           NOT NULL DEFAULT 0,
  `leave_days`     INT           NOT NULL DEFAULT 0,
  `alpha_days`     INT           NOT NULL DEFAULT 0,
  `overtime_hours` DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  `overtime_pay`   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `allowances`     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `deductions`     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `fine_amount`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `kasbon_amount`  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `net_salary`     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status`         ENUM('draft','approved','paid') NOT NULL DEFAULT 'draft',
  `notes`          TEXT          DEFAULT NULL,
  `paid_at`        DATETIME      DEFAULT NULL,
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_salary_records_period`  (`period_id`),
  KEY `idx_salary_records_profile` (`profile_id`),
  CONSTRAINT `fk_salary_records_period`  FOREIGN KEY (`period_id`)  REFERENCES `salary_periods` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_salary_records_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles`       (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 24 — EMPLOYEE FINES & KASBON (Denda & Pinjaman)
-- ====================================================================

DROP TABLE IF EXISTS `employee_fines`;
CREATE TABLE `employee_fines` (
  `id`          CHAR(36)      NOT NULL DEFAULT (UUID()),
  `profile_id`  CHAR(36)      NOT NULL,
  `amount`      DECIMAL(12,2) NOT NULL,
  `reason`      TEXT          NOT NULL,
  `fine_date`   DATE          NOT NULL,
  `status`      ENUM('pending','deducted','cancelled') NOT NULL DEFAULT 'pending',
  `salary_record_id` CHAR(36) DEFAULT NULL,
  `created_by`  CHAR(36)      DEFAULT NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ef_profile` (`profile_id`),
  KEY `idx_ef_date`    (`fine_date`),
  CONSTRAINT `fk_ef_profile`       FOREIGN KEY (`profile_id`)       REFERENCES `profiles`       (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ef_salary_record` FOREIGN KEY (`salary_record_id`) REFERENCES `salary_records` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ef_created_by`    FOREIGN KEY (`created_by`)       REFERENCES `profiles`       (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `employee_kasbon`;
CREATE TABLE `employee_kasbon` (
  `id`           CHAR(36)      NOT NULL DEFAULT (UUID()),
  `profile_id`   CHAR(36)      NOT NULL,
  `amount`       DECIMAL(12,2) NOT NULL,
  `reason`       TEXT          DEFAULT NULL,
  `request_date` DATE          NOT NULL,
  `repayment_date` DATE        DEFAULT NULL,
  `paid_amount`  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `remaining`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status`       ENUM('pending','approved','rejected','partially_paid','fully_paid') NOT NULL DEFAULT 'pending',
  `approved_by`  CHAR(36)      DEFAULT NULL,
  `notes`        TEXT          DEFAULT NULL,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ek_profile` (`profile_id`),
  KEY `idx_ek_status`  (`status`),
  CONSTRAINT `fk_ek_profile`     FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ek_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 25 — RESIGN REQUESTS
-- ====================================================================

DROP TABLE IF EXISTS `resign_requests`;
CREATE TABLE `resign_requests` (
  `id`              CHAR(36)     NOT NULL DEFAULT (UUID()),
  `profile_id`      CHAR(36)     NOT NULL,
  `resignation_date` DATE        DEFAULT NULL,
  `last_work_date`  DATE         DEFAULT NULL,
  `reason`          TEXT         NOT NULL,
  `status`          ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `admin_notes`     TEXT         DEFAULT NULL,
  `reviewed_by`     CHAR(36)     DEFAULT NULL,
  `reviewed_at`     DATETIME     DEFAULT NULL,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rr_profile` (`profile_id`),
  KEY `idx_rr_status`  (`status`),
  CONSTRAINT `fk_rr_profile`     FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rr_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 26 — SUPPORT TICKETS & MESSAGES
-- ====================================================================

DROP TABLE IF EXISTS `support_settings`;
CREATE TABLE `support_settings` (
  `id`                       CHAR(36)  NOT NULL DEFAULT (UUID()),
  `auto_close_days`          INT       NOT NULL DEFAULT 7,
  `max_tickets_per_customer` INT       NOT NULL DEFAULT 5,
  `allow_customer_chat`      TINYINT(1) NOT NULL DEFAULT 1,
  `notification_email`       VARCHAR(255) DEFAULT NULL,
  `created_at`               DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`               DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `support_settings` (`auto_close_days`,`max_tickets_per_customer`,`allow_customer_chat`) VALUES (7,5,1);

DROP TABLE IF EXISTS `support_tickets`;
CREATE TABLE `support_tickets` (
  `id`            CHAR(36)     NOT NULL DEFAULT (UUID()),
  `ticket_number` VARCHAR(30)  NOT NULL,
  `customer_id`   CHAR(36)     DEFAULT NULL,
  `category`      VARCHAR(100) DEFAULT NULL,
  `subject`       VARCHAR(255) NOT NULL,
  `description`   TEXT         NOT NULL,
  `status`        ENUM('pending','processing','waiting_info','approved','rejected','completed','closed','expired') NOT NULL DEFAULT 'pending',
  `priority`      ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  `resolved_at`   DATETIME     DEFAULT NULL,
  `expires_at`    DATETIME     DEFAULT NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ticket_number` (`ticket_number`),
  KEY `idx_tickets_customer` (`customer_id`),
  KEY `idx_tickets_status`   (`status`),
  KEY `idx_tickets_created`  (`created_at`),
  CONSTRAINT `fk_tickets_customer` FOREIGN KEY (`customer_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `ticket_messages`;
CREATE TABLE `ticket_messages` (
  `id`         CHAR(36)   NOT NULL DEFAULT (UUID()),
  `ticket_id`  CHAR(36)   NOT NULL,
  `sender_id`  CHAR(36)   DEFAULT NULL,
  `message`    TEXT       NOT NULL,
  `is_admin`   TINYINT(1) NOT NULL DEFAULT 0,
  `attachments` JSON      DEFAULT NULL,
  `created_at` DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ticket_messages_ticket` (`ticket_id`),
  CONSTRAINT `fk_ticket_messages_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ticket_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `profiles`        (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 27 — APPEALS (Banding / Keberatan)
-- ====================================================================

DROP TABLE IF EXISTS `appeals`;
CREATE TABLE `appeals` (
  `id`          CHAR(36)     NOT NULL DEFAULT (UUID()),
  `ticket_id`   CHAR(36)     DEFAULT NULL,
  `customer_id` CHAR(36)     DEFAULT NULL,
  `reason`      TEXT         NOT NULL,
  `status`      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `admin_reply` TEXT         DEFAULT NULL,
  `reviewed_by` CHAR(36)     DEFAULT NULL,
  `reviewed_at` DATETIME     DEFAULT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_appeals_ticket`   (`ticket_id`),
  KEY `idx_appeals_customer` (`customer_id`),
  KEY `idx_appeals_status`   (`status`),
  CONSTRAINT `fk_appeals_ticket`      FOREIGN KEY (`ticket_id`)   REFERENCES `support_tickets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_appeals_customer`    FOREIGN KEY (`customer_id`) REFERENCES `profiles`        (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_appeals_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `profiles`        (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 28 — SUSPEND LOGS (Log Pemblokiran Akun)
-- ====================================================================

DROP TABLE IF EXISTS `suspend_logs`;
CREATE TABLE `suspend_logs` (
  `id`           CHAR(36)     NOT NULL DEFAULT (UUID()),
  `profile_id`   CHAR(36)     NOT NULL,
  `action`       ENUM('suspend','unsuspend','block','unblock') NOT NULL,
  `reason`       TEXT         DEFAULT NULL,
  `performed_by` CHAR(36)     DEFAULT NULL,
  `ip_address`   VARCHAR(45)  DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sl_profile` (`profile_id`),
  KEY `idx_sl_action`  (`action`),
  CONSTRAINT `fk_sl_profile`      FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sl_performed_by` FOREIGN KEY (`performed_by`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 29 — AUDIT LOGS & PROFILE AUDIT LOGS
-- ====================================================================

DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id`          CHAR(36)     NOT NULL DEFAULT (UUID()),
  `table_name`  VARCHAR(100) NOT NULL,
  `record_id`   CHAR(36)     DEFAULT NULL,
  `action`      ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  `old_data`    JSON         DEFAULT NULL,
  `new_data`    JSON         DEFAULT NULL,
  `performed_by` CHAR(36)   DEFAULT NULL,
  `ip_address`  VARCHAR(45)  DEFAULT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_al_table`   (`table_name`),
  KEY `idx_al_record`  (`record_id`),
  KEY `idx_al_created` (`created_at`),
  CONSTRAINT `fk_al_performed_by` FOREIGN KEY (`performed_by`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `profile_audit_logs`;
CREATE TABLE `profile_audit_logs` (
  `id`            CHAR(36)     NOT NULL DEFAULT (UUID()),
  `ticket_id`     CHAR(36)     DEFAULT NULL,
  `ticket_number` VARCHAR(30)  DEFAULT NULL,
  `category`      VARCHAR(100) DEFAULT NULL,
  `customer_id`   CHAR(36)     DEFAULT NULL,
  `approved_by`   CHAR(36)     DEFAULT NULL,
  `changed_by`    CHAR(36)     DEFAULT NULL,
  `approved_at`   DATETIME     DEFAULT NULL,
  `changed_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `old_email`     VARCHAR(255) DEFAULT NULL,
  `new_email`     VARCHAR(255) DEFAULT NULL,
  `status_before` VARCHAR(50)  DEFAULT NULL,
  `status_after`  VARCHAR(50)  DEFAULT NULL,
  `reason`        TEXT         DEFAULT NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pal_customer` (`customer_id`),
  KEY `idx_pal_ticket`   (`ticket_id`),
  CONSTRAINT `fk_pal_ticket`      FOREIGN KEY (`ticket_id`)   REFERENCES `support_tickets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pal_customer`    FOREIGN KEY (`customer_id`) REFERENCES `profiles`        (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pal_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `profiles`        (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pal_changed_by`  FOREIGN KEY (`changed_by`)  REFERENCES `profiles`        (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 30 — SISTEM KEAMANAN (Security System)
-- ====================================================================

DROP TABLE IF EXISTS `security_logs`;
CREATE TABLE `security_logs` (
  `id`         CHAR(36)     NOT NULL DEFAULT (UUID()),
  `user_id`    CHAR(36)     DEFAULT NULL,
  `full_name`  VARCHAR(255) DEFAULT NULL,
  `ip_address` VARCHAR(45)  NOT NULL,
  `browser`    TEXT         DEFAULT NULL,
  `device`     TEXT         DEFAULT NULL,
  `user_agent` TEXT         DEFAULT NULL,
  `activity`   VARCHAR(100) NOT NULL,
  `endpoint`   TEXT         DEFAULT NULL,
  `status`     ENUM('success','failed','blocked') NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_security_logs_created_at`  (`created_at`),
  KEY `idx_security_logs_activity`    (`activity`),
  KEY `idx_security_logs_ip`          (`ip_address`),
  KEY `idx_security_logs_ip_created`  (`ip_address`,`created_at`),
  CONSTRAINT `fk_sec_logs_user` FOREIGN KEY (`user_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `security_ip_rules`;
CREATE TABLE `security_ip_rules` (
  `id`         CHAR(36)    NOT NULL DEFAULT (UUID()),
  `ip_address` VARCHAR(45) NOT NULL,
  `rule_type`  ENUM('blacklist','whitelist') NOT NULL,
  `reason`     TEXT        DEFAULT NULL,
  `expires_at` DATETIME    DEFAULT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ip_rules` (`ip_address`),
  KEY `idx_security_ip_rules_ip` (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `security_block_rules`;
CREATE TABLE `security_block_rules` (
  `id`         CHAR(36)    NOT NULL DEFAULT (UUID()),
  `field_type` ENUM('email','browser','device') NOT NULL,
  `value`      VARCHAR(500) NOT NULL,
  `reason`     TEXT        DEFAULT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_security_block_field` (`field_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `security_login_locations`;
CREATE TABLE `security_login_locations` (
  `id`                CHAR(36)    NOT NULL DEFAULT (UUID()),
  `profile_id`        CHAR(36)    NOT NULL,
  `country`           VARCHAR(100) NOT NULL,
  `city`              VARCHAR(100) NOT NULL,
  `first_detected_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_detected_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_login_location` (`profile_id`,`country`(50),`city`(50)),
  CONSTRAINT `fk_sll_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `security_settings`;
CREATE TABLE `security_settings` (
  `id`                        CHAR(36)   NOT NULL DEFAULT (UUID()),
  `emergency_mode`            TINYINT(1) NOT NULL DEFAULT 0,
  `global_captcha_required`   TINYINT(1) NOT NULL DEFAULT 0,
  `block_new_registrations`   TINYINT(1) NOT NULL DEFAULT 0,
  `block_sensitive_endpoints` TINYINT(1) NOT NULL DEFAULT 0,
  `tightened_rate_limits`     TINYINT(1) NOT NULL DEFAULT 0,
  `updated_at`                DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `security_settings`
  (`emergency_mode`,`global_captcha_required`,`block_new_registrations`,`block_sensitive_endpoints`,`tightened_rate_limits`)
VALUES (0,0,0,0,0);

DROP TABLE IF EXISTS `security_nonces`;
CREATE TABLE `security_nonces` (
  `nonce`      VARCHAR(128) NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`nonce`),
  KEY `idx_security_nonces_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `security_user_sessions`;
CREATE TABLE `security_user_sessions` (
  `id`                  CHAR(36)     NOT NULL DEFAULT (UUID()),
  `profile_id`          CHAR(36)     DEFAULT NULL,
  `session_id`          VARCHAR(255) NOT NULL,
  `ip_address`          VARCHAR(45)  NOT NULL,
  `user_agent`          TEXT         NOT NULL,
  `browser_fingerprint` TEXT         DEFAULT NULL,
  `country`             VARCHAR(100) DEFAULT NULL,
  `city`                VARCHAR(100) DEFAULT NULL,
  `asn`                 VARCHAR(100) DEFAULT NULL,
  `timezone`            VARCHAR(100) DEFAULT NULL,
  `last_active_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_session_id` (`session_id`(191)),
  KEY `idx_sus_profile` (`profile_id`),
  CONSTRAINT `fk_sus_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `security_incidents`;
CREATE TABLE `security_incidents` (
  `id`          CHAR(36)    NOT NULL DEFAULT (UUID()),
  `ip_address`  VARCHAR(45) NOT NULL,
  `fingerprint` TEXT        DEFAULT NULL,
  `asn`         VARCHAR(100) DEFAULT NULL,
  `country`     VARCHAR(100) DEFAULT NULL,
  `city`        VARCHAR(100) DEFAULT NULL,
  `endpoint`    TEXT        DEFAULT NULL,
  `payload`     TEXT        DEFAULT NULL,
  `attack_type` VARCHAR(100) NOT NULL,
  `severity`    ENUM('low','medium','high','critical') NOT NULL,
  `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_security_incidents_created` (`created_at`),
  KEY `idx_security_incidents_ip`      (`ip_address`),
  KEY `idx_security_incidents_type`    (`attack_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `security_fingerprint_ips`;
CREATE TABLE `security_fingerprint_ips` (
  `id`          CHAR(36)     NOT NULL DEFAULT (UUID()),
  `fingerprint` VARCHAR(255) NOT NULL,
  `ip_address`  VARCHAR(45)  NOT NULL,
  `country`     VARCHAR(100) DEFAULT NULL,
  `city`        VARCHAR(100) DEFAULT NULL,
  `asn`         VARCHAR(100) DEFAULT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sec_fp_ips_fp`      (`fingerprint`),
  KEY `idx_sec_fp_ips_ip`      (`ip_address`),
  KEY `idx_sec_fp_ips_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `security_subnet_blocks`;
CREATE TABLE `security_subnet_blocks` (
  `id`            CHAR(36)    NOT NULL DEFAULT (UUID()),
  `subnet`        VARCHAR(50) NOT NULL,
  `reason`        TEXT        DEFAULT NULL,
  `blocked_until` DATETIME    NOT NULL,
  `created_at`    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subnet` (`subnet`),
  KEY `idx_sec_subnet_expiry` (`blocked_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `security_request_signatures`;
CREATE TABLE `security_request_signatures` (
  `id`           CHAR(36)     NOT NULL DEFAULT (UUID()),
  `fingerprint`  VARCHAR(255) NOT NULL,
  `ip_address`   VARCHAR(45)  NOT NULL,
  `subnet`       VARCHAR(50)  NOT NULL,
  `asn`          VARCHAR(100) DEFAULT NULL,
  `endpoint`     TEXT         NOT NULL,
  `payload_hash` VARCHAR(255) DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sec_req_sig_fp`      (`fingerprint`),
  KEY `idx_sec_req_sig_ip`      (`ip_address`),
  KEY `idx_sec_req_sig_subnet`  (`subnet`),
  KEY `idx_sec_req_sig_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- BAGIAN 31 — TRIGGERS
-- ====================================================================

DELIMITER $$

-- Trigger: auto-increment voucher.used_count saat order paid (UPDATE)
DROP TRIGGER IF EXISTS `trg_voucher_used_on_update` $$
CREATE TRIGGER `trg_voucher_used_on_update`
AFTER UPDATE ON `orders`
FOR EACH ROW
BEGIN
  IF NEW.payment_status = 'paid'
     AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid')
     AND NEW.voucher_id IS NOT NULL THEN
    UPDATE `vouchers` SET used_count = used_count + 1 WHERE id = NEW.voucher_id;
    INSERT INTO `customer_vouchers` (`customer_id`,`voucher_id`,`used_count`)
      VALUES (NEW.customer_id, NEW.voucher_id, 1)
      ON DUPLICATE KEY UPDATE used_count = used_count + 1;
  END IF;
END $$

-- Trigger: auto-increment voucher.used_count saat order baru langsung paid (INSERT)
DROP TRIGGER IF EXISTS `trg_voucher_used_on_insert` $$
CREATE TRIGGER `trg_voucher_used_on_insert`
AFTER INSERT ON `orders`
FOR EACH ROW
BEGIN
  IF NEW.payment_status = 'paid' AND NEW.voucher_id IS NOT NULL THEN
    UPDATE `vouchers` SET used_count = used_count + 1 WHERE id = NEW.voucher_id;
    INSERT INTO `customer_vouchers` (`customer_id`,`voucher_id`,`used_count`)
      VALUES (NEW.customer_id, NEW.voucher_id, 1)
      ON DUPLICATE KEY UPDATE used_count = used_count + 1;
  END IF;
END $$

-- Trigger: otomatis buat wallet saat profile baru dibuat dengan role customer
DROP TRIGGER IF EXISTS `trg_create_wallet_for_customer` $$
CREATE TRIGGER `trg_create_wallet_for_customer`
AFTER INSERT ON `profiles`
FOR EACH ROW
BEGIN
  IF NEW.role = 'customer' THEN
    INSERT INTO `wallets` (`customer_id`, `balance`, `is_active`)
    VALUES (NEW.id, 0.00, 0);
  END IF;
END $$

-- Trigger: otomatis buat order_chat saat order baru dibuat
DROP TRIGGER IF EXISTS `trg_create_order_chat` $$
CREATE TRIGGER `trg_create_order_chat`
AFTER INSERT ON `orders`
FOR EACH ROW
BEGIN
  INSERT INTO `order_chats` (`order_id`) VALUES (NEW.id);
END $$

DELIMITER ;

-- ====================================================================
-- BAGIAN 32 — VIEWS BERGUNA
-- ====================================================================

-- Ringkasan pesanan harian
CREATE OR REPLACE VIEW `v_daily_order_summary` AS
SELECT
  DATE(`created_at`)                                                         AS order_date,
  COUNT(*)                                                                   AS total_orders,
  SUM(CASE WHEN `status`         = 'completed' THEN 1 ELSE 0 END)           AS completed_orders,
  SUM(CASE WHEN `status`         = 'cancelled' THEN 1 ELSE 0 END)           AS cancelled_orders,
  SUM(CASE WHEN `payment_status` = 'paid'      THEN `final_amount` ELSE 0 END) AS total_revenue
FROM `orders`
GROUP BY DATE(`created_at`);

-- Menu paling banyak dipesan
CREATE OR REPLACE VIEW `v_popular_menu` AS
SELECT
  mi.`id`,
  mi.`name`,
  mi.`price`,
  mi.`image_url`,
  c.`name`                        AS category_name,
  COALESCE(SUM(oi.`quantity`), 0) AS total_sold
FROM `menu_items` mi
LEFT JOIN `categories`  c  ON c.`id`  = mi.`category_id`
LEFT JOIN `order_items` oi ON oi.`menu_item_id` = mi.`id`
LEFT JOIN `orders`      o  ON o.`id`  = oi.`order_id` AND o.`status` = 'completed'
WHERE mi.`is_active` = 1
GROUP BY mi.`id`, mi.`name`, mi.`price`, mi.`image_url`, c.`name`
ORDER BY total_sold DESC;

-- Ringkasan saldo dompet pelanggan
CREATE OR REPLACE VIEW `v_wallet_summary` AS
SELECT
  p.`id`          AS profile_id,
  p.`full_name`,
  p.`email`,
  w.`id`          AS wallet_id,
  w.`balance`,
  w.`is_active`   AS wallet_active,
  COALESCE(pt.`total_points`, 0) AS loyalty_points
FROM `profiles` p
LEFT JOIN `wallets` w ON w.`customer_id` = p.`id`
LEFT JOIN (
  SELECT `customer_id`, SUM(`points`) AS total_points
  FROM `point_transactions`
  GROUP BY `customer_id`
) pt ON pt.`customer_id` = p.`id`
WHERE p.`role` = 'customer';

-- Laporan absensi karyawan bulan ini
CREATE OR REPLACE VIEW `v_attendance_this_month` AS
SELECT
  p.`id`         AS profile_id,
  p.`full_name`,
  p.`employee_id`,
  SUM(CASE WHEN a.`type` = 'check_in'  AND a.`status` = 'completed' THEN 1 ELSE 0 END) AS hadir,
  SUM(CASE WHEN a.`type` = 'sakit'                                  THEN 1 ELSE 0 END) AS sakit,
  SUM(CASE WHEN a.`type` = 'izin'                                   THEN 1 ELSE 0 END) AS izin,
  SUM(CASE WHEN a.`type` = 'alpha'                                  THEN 1 ELSE 0 END) AS alpha
FROM `profiles` p
LEFT JOIN `attendance` a ON a.`profile_id` = p.`id`
  AND MONTH(a.`created_at`) = MONTH(CURRENT_DATE())
  AND YEAR(a.`created_at`)  = YEAR(CURRENT_DATE())
WHERE p.`role` IN ('cashier','admin')
GROUP BY p.`id`, p.`full_name`, p.`employee_id`;

-- ====================================================================
-- BAGIAN 33 — STORED PROCEDURE UTILITAS (Opsional)
-- ====================================================================

DELIMITER $$

-- Hapus OTP yang sudah expired (jalankan berkala via cron)
DROP PROCEDURE IF EXISTS `sp_cleanup_expired_otps` $$
CREATE PROCEDURE `sp_cleanup_expired_otps`()
BEGIN
  DELETE FROM `otp_codes` WHERE `expires_at` < NOW();
  DELETE FROM `security_nonces` WHERE `expires_at` < NOW();
  DELETE FROM `security_subnet_blocks` WHERE `blocked_until` < NOW();
END $$

-- Hapus security_request_signatures lama (lebih dari 24 jam)
DROP PROCEDURE IF EXISTS `sp_cleanup_old_signatures` $$
CREATE PROCEDURE `sp_cleanup_old_signatures`()
BEGIN
  DELETE FROM `security_request_signatures`
  WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 24 HOUR);
  DELETE FROM `security_fingerprint_ips`
  WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 7 DAY);
END $$

DELIMITER ;

-- ====================================================================
-- SELESAI — Re-enable FK checks
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 1;

-- ====================================================================
-- PANDUAN MIGRASI DATA DARI SUPABASE:
--
-- Langkah 1: Export data dari Supabase (jalankan di terminal lokal)
--   pg_dump \
--     -h db.XXXX.supabase.co \
--     -U postgres \
--     -d postgres \
--     --data-only \
--     --column-inserts \
--     --no-privileges \
--     --no-owner \
--     -t public.profiles \
--     -t public.categories \
--     -t public.menu_items \
--     -t public.tables \
--     -t public.orders \
--     -t public.order_items \
--     -t public.reservations \
--     -t public.reviews \
--     -t public.notifications \
--     -t public.otp_codes \
--     -t public.favorites \
--     -t public.vouchers \
--     -t public.restaurant_settings \
--     > supabase_data_export.sql
--
-- Langkah 2: Konversi format PostgreSQL ke MySQL
--   a. Ganti  true  → 1         (tanpa kutip)
--   b. Ganti  false → 0         (tanpa kutip)
--   c. Ganti  't'   → 1
--   d. Ganti  'f'   → 0
--   e. Hapus baris yang dimulai dengan --  SET  SELECT  (Postgres header)
--   f. Timestamp: '2026-01-01 12:00:00+07' → '2026-01-01 12:00:00'
--   g. UUID di INSERT sudah berbentuk string, langsung compatible
--
-- Langkah 3: Import file hasil konversi ke phpMyAdmin
--   Import → pilih file → GO
--
-- CATATAN: Tabel users perlu diisi manual atau dibuat sistem
--   registrasi ulang karena password dari Supabase auth tidak bisa
--   diekspor (sudah di-hash secara internal oleh Supabase).
--   Solusi: buat endpoint reset password untuk semua user lama.
-- ====================================================================
