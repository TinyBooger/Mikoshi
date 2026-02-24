-- PostgreSQL Migration: Add character purchase entitlements
-- Created: 2026-02-24

BEGIN;

CREATE TABLE IF NOT EXISTS character_purchases (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    price_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
    out_trade_no VARCHAR(128),
    trade_no VARCHAR(128),
    purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uix_user_character_purchase UNIQUE (user_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_character_purchases_user_id ON character_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_character_purchases_character_id ON character_purchases(character_id);
CREATE INDEX IF NOT EXISTS idx_character_purchases_purchased_at ON character_purchases(purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_character_purchases_out_trade_no ON character_purchases(out_trade_no);

ALTER TABLE payment_orders
    ADD COLUMN IF NOT EXISTS target_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS target_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_payment_orders_target_id ON payment_orders(target_id);

COMMENT ON TABLE character_purchases IS 'User purchase entitlements for paid characters';
COMMENT ON COLUMN character_purchases.price_paid IS 'Final paid amount in CNY';
COMMENT ON COLUMN payment_orders.target_type IS 'Business target type, e.g. character';
COMMENT ON COLUMN payment_orders.target_id IS 'Business target identifier, e.g. character id';

COMMIT;
