-- PostgreSQL Migration: Add payment_orders table for payment idempotency and status tracking
-- Created: 2026-02-24

BEGIN;

CREATE TABLE IF NOT EXISTS payment_orders (
    out_trade_no VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
    order_type VARCHAR(50) NOT NULL DEFAULT 'unknown',
    trade_no VARCHAR(128),
    total_amount VARCHAR(32),
    source VARCHAR(32),
    status VARCHAR(20) NOT NULL DEFAULT 'processing',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_trade_no ON payment_orders(trade_no);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at DESC);

COMMENT ON TABLE payment_orders IS 'Payment orders used for idempotency and lifecycle tracking';
COMMENT ON COLUMN payment_orders.out_trade_no IS 'Merchant order number (unique key)';
COMMENT ON COLUMN payment_orders.order_type IS 'Business order type, e.g. pro_upgrade';
COMMENT ON COLUMN payment_orders.status IS 'processing | success | failure | error';

COMMIT;
