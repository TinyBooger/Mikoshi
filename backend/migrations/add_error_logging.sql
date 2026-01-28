-- Migration: Add Error Logging System
-- Description: Creates the error_logs table for storing application error logs
-- Created: 2026-01-27

-- Create error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    message TEXT NOT NULL,
    error_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'error' NOT NULL,
    source VARCHAR(20) DEFAULT 'backend' NOT NULL,
    user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    client_ip VARCHAR(45),
    user_agent TEXT,
    request_body TEXT,
    stack_trace TEXT,
    context TEXT,
    resolved BOOLEAN DEFAULT FALSE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for faster queries
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_source ON error_logs(source);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX idx_error_logs_status_code ON error_logs(status_code);
CREATE INDEX idx_error_logs_client_ip ON error_logs(client_ip);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX idx_error_logs_endpoint ON error_logs(endpoint);

-- Comment on table and columns
COMMENT ON TABLE error_logs IS 'Stores application error logs from backend and frontend';
COMMENT ON COLUMN error_logs.error_type IS 'Type of error (ValueError, HTTPException, etc.)';
COMMENT ON COLUMN error_logs.severity IS 'Severity level: info, warning, error, critical';
COMMENT ON COLUMN error_logs.source IS 'Source of error: backend or frontend';
COMMENT ON COLUMN error_logs.client_ip IS 'Client IP address (IPv4 or IPv6)';
COMMENT ON COLUMN error_logs.resolved IS 'Whether the error has been resolved by an admin';
