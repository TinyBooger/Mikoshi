-- PostgreSQL Migration: Add phone_number field for SMS authentication
-- Created: 2026-01-12

BEGIN;

-- Add phone_number column to users table
ALTER TABLE users 
ADD COLUMN phone_number VARCHAR(20);

-- Create unique constraint on phone_number
ALTER TABLE users 
ADD CONSTRAINT uq_users_phone_number UNIQUE (phone_number);

-- Create index on phone_number for faster lookups
CREATE INDEX idx_users_phone_number ON users(phone_number);

-- Make email nullable (allow phone-only accounts)
ALTER TABLE users 
ALTER COLUMN email DROP NOT NULL;

COMMIT;
