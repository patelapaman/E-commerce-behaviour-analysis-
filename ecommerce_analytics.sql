-- =====================================================================
-- E-Commerce Customer Behaviour Analysis Platform
-- Production Database Schema & Analytical Indexing Suite (MySQL Edition)
-- Suitable for Data Engineering, Database Administrator, and BI Portfolios
-- =====================================================================

-- 1. DATABASE CREATION
CREATE DATABASE IF NOT EXISTS ecommerce_analytics;
USE ecommerce_analytics;

-- 2. RESET EXISTING SCHEMAS
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS customer_segments;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- 3. USERS (APPLICATION MANAGERS & ANALYSTS)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'data_scientist', 'business_analyst', 'viewer') DEFAULT 'business_analyst',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. CUSTOMERS DIMENSION TABLE
CREATE TABLE customers (
    id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(30) NULL,
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100) NULL,
    signup_date DATE NOT NULL,
    loyalty_tier ENUM('standard', 'bronze', 'silver', 'gold', 'platinum') DEFAULT 'standard',
    status ENUM('active', 'inactive', 'dormant') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customers_signup (signup_date),
    INDEX idx_customers_country (country),
    INDEX idx_customers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. PRODUCTS CATEGORY TABLE
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. PRODUCTS DIMENSION TABLE
CREATE TABLE products (
    id VARCHAR(50) PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    category_id INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    rating DECIMAL(3, 2) NOT NULL DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    INDEX idx_products_category (category_id),
    INDEX idx_products_price (price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. ORDERS TRANSACTION TABLE
CREATE TABLE orders (
    id VARCHAR(100) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    order_date DATE NOT NULL,
    status ENUM('completed', 'processing', 'shipped', 'cancelled', 'refunded') DEFAULT 'completed',
    total_amount DECIMAL(15, 2) NOT NULL,
    shipping_cost DECIMAL(10, 2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    INDEX idx_orders_customer (customer_id),
    INDEX idx_orders_date (order_date),
    INDEX idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. ORDER ITEMS (MANY-TO-MANY RESOLVER TABLE)
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    discount_applied DECIMAL(10, 2) DEFAULT 0.00,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_order_items_order (order_id),
    INDEX idx_order_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. PAYMENTS SETTLEMENTS
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(15, 2) NOT NULL,
    payment_gateway ENUM('Stripe', 'PayPal', 'ApplePay', 'GooglePay', 'DirectTransfer') NOT NULL,
    transaction_status ENUM('authorized', 'captured', 'reversed', 'failed') DEFAULT 'captured',
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_payments_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. CUSTOMER BEHAVIOURAL SEGMENTS TABLE (RFM & ML RESULTS CACHE)
CREATE TABLE customer_segments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL UNIQUE,
    recency_days INT NOT NULL COMMENT 'Days since last purchase date',
    frequency_count INT NOT NULL COMMENT 'Distinct number of orders placed',
    monetary_spend DECIMAL(15, 2) NOT NULL COMMENT 'Cumulative monetary spending',
    recency_score INT NOT NULL COMMENT 'RFM Recency score quintile 1 to 5',
    frequency_score INT NOT NULL COMMENT 'RFM Frequency score quintile 1 to 5',
    monetary_score INT NOT NULL COMMENT 'RFM Monetary score quintile 1 to 5',
    segment_name VARCHAR(50) NOT NULL COMMENT 'Identified cluster e.g. Champions',
    clv_estimated DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    churn_risk_probability DECIMAL(5, 2) NOT NULL DEFAULT 0.00 COMMENT '0.00% to 100.00%',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    INDEX idx_segments_name (segment_name),
    INDEX idx_segments_churn (churn_risk_probability),
    INDEX idx_segments_clv (clv_estimated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- COMPREHENSIVE BUSINESS ANALYTICS & BI REPORT QUERIES
-- =====================================================================

-- QUERY A: MONTHLY COHORT RE-ENGAGEMENT HEATMAP DEFINITION
-- Tracks monthly customer cohorts and calculated loyalty index over 6 months
WITH cohort_signups AS (
    SELECT 
        id AS customer_id,
        DATE_FORMAT(signup_date, '%Y-%m') AS cohort_month
    FROM customers
),
customer_orders AS (
    SELECT 
        o.customer_id,
        PERIOD_DIFF(DATE_FORMAT(o.order_date, '%Y%m'), DATE_FORMAT(cs.cohort_month, '%Y%m')) AS month_index
    FROM orders o
    JOIN cohort_signups cs ON o.customer_id = cs.customer_id
    WHERE o.status = 'completed'
),
cohort_sizes AS (
    SELECT 
        cohort_month,
        COUNT(DISTINCT customer_id) AS cohort_size
    FROM cohort_signups
    GROUP BY cohort_month
)
SELECT 
    cs.cohort_month,
    cz.cohort_size,
    co.month_index,
    COUNT(DISTINCT co.customer_id) AS retained_customers,
    COUNT(DISTINCT co.customer_id) / cz.cohort_size * 100.00 AS retention_rate
FROM cohort_signups cs
JOIN cohort_sizes cz ON cs.cohort_month = cz.cohort_month
LEFT JOIN customer_orders co ON cs.customer_id = co.customer_id
WHERE co.month_index >= 0 AND co.month_index <= 12
GROUP BY cs.cohort_month, cz.cohort_size, co.month_index
ORDER BY cs.cohort_month, co.month_index;

-- QUERY B: FULL RECENT-FREQUENCY-MONETARY QUINTILE GENERATION
-- Employs NTILE percentages to score customer RFM dynamics automatically
WITH rfm_base AS (
    SELECT 
        customer_id,
        DATEDIFF('2026-05-31', MAX(order_date)) AS recency,
        COUNT(id) AS frequency,
        SUM(total_amount) AS monetary
    FROM orders
    WHERE status = 'completed'
    GROUP BY customer_id
),
rfm_ranked AS (
    SELECT
        customer_id,
        recency,
        frequency,
        monetary,
        NTILE(5) OVER (ORDER BY recency ASC) AS r_rank, -- Lower recency is better
        NTILE(5) OVER (ORDER BY frequency DESC) AS f_rank, -- Higher frequency is better
        NTILE(5) OVER (ORDER BY monetary DESC) AS m_rank -- Higher monetary is better
    FROM rfm_base
)
SELECT
    customer_id,
    recency,
    frequency,
    monetary,
    -- Map NTILE output back to scores (1 is best, 5 is low)
    (6 - r_rank) AS recency_score,
    (6 - f_rank) AS frequency_score,
    (6 - m_rank) AS monetary_score,
    CONCAT((6 - r_rank), (6 - f_rank), (6 - m_rank)) AS rfm_code
FROM rfm_ranked;

-- QUERY C: PARETO PRINCIPLE - ANALYSIS OF THE TOP 25% CUSTOMER ACCOUNTS
-- Tracks contributions of elite purchase records against macro pipelines
WITH sorted_customers AS (
    SELECT
        customer_id,
        SUM(total_amount) AS total_spend,
        ROW_NUMBER() OVER (ORDER BY SUM(total_amount) DESC) as customer_rank,
        COUNT(*) OVER () as total_customer_count
    FROM orders
    WHERE status = 'completed'
    GROUP BY customer_id
),
pareto_metrics AS (
    SELECT
        customer_id,
        total_spend,
        customer_rank,
        customer_rank / total_customer_count * 100.0 as percentile,
        SUM(total_spend) OVER (ORDER BY total_spend DESC) as running_spend,
        SUM(total_spend) OVER () as cumulative_revenue
    FROM sorted_customers
)
SELECT 
    CASE 
        WHEN percentile <= 25.0 THEN 'Core 25% (High Value)' 
        ELSE 'Remaining 75% (General)' 
    END AS customer_cohort,
    COUNT(DISTINCT customer_id) AS distinct_accounts,
    SUM(total_spend) AS bracket_revenue,
    SUM(total_spend) / MAX(cumulative_revenue) * 100.0 AS contribution_percentage
FROM pareto_metrics
GROUP BY 
    CASE 
        WHEN percentile <= 25.0 THEN 'Core 25% (High Value)' 
        ELSE 'Remaining 75% (General)' 
    END;

-- QUERY D: RETENTION ACTIONS - CHURN FOREWARNING DETECTOR
-- Targets dormant buyers with low satisfaction scores and triggers campaigns
SELECT 
    c.id AS customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
    c.email,
    c.status,
    cs.recency_days,
    cs.frequency_count,
    cs.monetary_spend,
    cs.clv_estimated,
    cs.churn_risk_probability,
    CASE 
        WHEN cs.churn_risk_probability >= 85.0 THEN 'CRITICAL TRIGGER: Immediate Reactivation Discount'
        WHEN cs.churn_risk_probability >= 60.0 THEN 'WARNING: Active Email Feed Trigger'
        ELSE 'STABLE: Onboard to Premium newsletter'
    END AS retention_action
FROM customers c
JOIN customer_segments cs ON c.id = cs.customer_id
WHERE cs.recency_days > 45 AND c.status = 'active'
ORDER BY cs.churn_risk_probability DESC
LIMIT 50;
