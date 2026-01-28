"""
Error logging utility for capturing, storing, and tracking application errors.
"""
import logging
import json
import traceback
from datetime import datetime, UTC
from typing import Optional, Dict, Any
from pathlib import Path
import os

# Configure logging
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

# Create file logger
error_file_handler = logging.FileHandler(
    LOG_DIR / "error.log",
    encoding='utf-8'
)
error_file_handler.setLevel(logging.ERROR)

# Create console logger
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.WARNING)

# Create formatter
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
error_file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

# Get logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
logger.addHandler(error_file_handler)
logger.addHandler(console_handler)


class ErrorLog:
    """Represents a single error log entry"""
    
    def __init__(
        self,
        message: str,
        error_type: str = "Unknown",
        severity: str = "error",  # "info", "warning", "error", "critical"
        source: str = "backend",  # "backend" or "frontend"
        user_id: Optional[int] = None,
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
        status_code: Optional[int] = None,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_body: Optional[Dict[str, Any]] = None,
        stack_trace: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        self.timestamp = datetime.now(UTC)
        self.message = message
        self.error_type = error_type
        self.severity = severity
        self.source = source
        self.user_id = user_id
        self.endpoint = endpoint
        self.method = method
        self.status_code = status_code
        self.client_ip = client_ip
        self.user_agent = user_agent
        self.request_body = request_body
        self.stack_trace = stack_trace
        self.context = context or {}
        self.resolved = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert error log to dictionary"""
        return {
            "timestamp": self.timestamp.isoformat(),
            "message": self.message,
            "error_type": self.error_type,
            "severity": self.severity,
            "source": self.source,
            "user_id": self.user_id,
            "endpoint": self.endpoint,
            "method": self.method,
            "status_code": self.status_code,
            "client_ip": self.client_ip,
            "user_agent": self.user_agent,
            "request_body": self.request_body,
            "stack_trace": self.stack_trace,
            "context": self.context,
            "resolved": self.resolved,
        }

    def to_json(self) -> str:
        """Convert error log to JSON string"""
        return json.dumps(self.to_dict(), indent=2, default=str)


class ErrorLogger:
    """Centralized error logging service"""
    
    # Size limits for database columns (in characters)
    MAX_STACK_TRACE = 50000
    MAX_CONTEXT = 10000
    MAX_MESSAGE = 5000
    MAX_ENDPOINT = 255
    MAX_USER_AGENT = 1000
    
    def __init__(self, db_session_factory=None):
        """
        Initialize error logger
        
        Args:
            db_session_factory: SQLAlchemy session factory for database storage
        """
        self.db_session_factory = db_session_factory
        self.logger = logger

    def _truncate_string(self, value: Optional[str], max_length: int) -> Optional[str]:
        """Truncate string to max length if needed"""
        if value and len(value) > max_length:
            return value[:max_length] + f"\n... (truncated, original length: {len(value)})"
        return value

    def capture_error(
        self,
        message: str,
        error_type: str = "Unknown",
        severity: str = "error",
        source: str = "backend",
        user_id: Optional[int] = None,
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
        status_code: Optional[int] = None,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_body: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
        exception: Optional[Exception] = None,
    ) -> ErrorLog:
        """
        Capture an error with all relevant context
        
        Args:
            message: Error message
            error_type: Type of error (e.g., "ValueError", "HTTPException")
            severity: Severity level
            source: Source of error ("backend" or "frontend")
            user_id: ID of user affected
            endpoint: API endpoint that triggered error
            method: HTTP method
            status_code: HTTP status code
            client_ip: Client IP address
            user_agent: User agent string
            request_body: Request payload
            context: Additional context information
            exception: The exception object (will extract stack trace)
            
        Returns:
            ErrorLog: The captured error log
        """
        stack_trace = None
        if exception:
            stack_trace = traceback.format_exc()
            error_type = type(exception).__name__

        error_log = ErrorLog(
            message=message,
            error_type=error_type,
            severity=severity,
            source=source,
            user_id=user_id,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            client_ip=client_ip,
            user_agent=user_agent,
            request_body=request_body,
            stack_trace=stack_trace,
            context=context,
        )

        # Log to file
        log_message = f"[{error_log.error_type}] {message}"
        if endpoint:
            log_message += f" | Endpoint: {method} {endpoint}"
        if user_id:
            log_message += f" | User: {user_id}"
        if stack_trace:
            log_message += f"\n{stack_trace}"

        if severity == "critical":
            self.logger.critical(log_message)
        elif severity == "error":
            self.logger.error(log_message)
        elif severity == "warning":
            self.logger.warning(log_message)
        else:
            self.logger.info(log_message)

        # Store in database
        self._store_in_db(error_log)

        return error_log

    def _store_in_db(self, error_log: ErrorLog) -> None:
        """Store error log in database"""
        if not self.db_session_factory:
            return

        try:
            from models import ErrorLogModel
            
            db = self.db_session_factory()
            try:
                # Truncate fields to prevent database growth issues
                truncated_message = self._truncate_string(error_log.message, self.MAX_MESSAGE)
                truncated_endpoint = self._truncate_string(error_log.endpoint, self.MAX_ENDPOINT)
                truncated_user_agent = self._truncate_string(error_log.user_agent, self.MAX_USER_AGENT)
                truncated_stack_trace = self._truncate_string(error_log.stack_trace, self.MAX_STACK_TRACE)
                
                # Truncate context JSON
                context_json = json.dumps(error_log.context) if error_log.context else None
                if context_json and len(context_json) > self.MAX_CONTEXT:
                    context_json = context_json[:self.MAX_CONTEXT] + f"\n... (truncated, original length: {len(context_json)})"
                
                db_error = ErrorLogModel(
                    timestamp=error_log.timestamp,
                    message=truncated_message,
                    error_type=error_log.error_type,
                    severity=error_log.severity,
                    source=error_log.source,
                    user_id=error_log.user_id,
                    endpoint=truncated_endpoint,
                    method=error_log.method,
                    status_code=error_log.status_code,
                    client_ip=error_log.client_ip,
                    user_agent=truncated_user_agent,
                    request_body=json.dumps(error_log.request_body) if error_log.request_body else None,
                    stack_trace=truncated_stack_trace,
                    context=context_json,
                    resolved=error_log.resolved,
                )
                db.add(db_error)
                db.commit()
            except Exception as e:
                db.rollback()
                self.logger.warning(f"Failed to store error log in database: {str(e)}")
            finally:
                db.close()
        except ImportError:
            # Models not yet available
            pass

    def log_http_error(
        self,
        request,
        exception: Optional[Exception] = None,
        status_code: int = 500,
        message: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> ErrorLog:
        """
        Log an HTTP error with request context
        
        Args:
            request: FastAPI Request object
            exception: The exception that occurred
            status_code: HTTP status code
            message: Custom error message
            user_id: ID of affected user
            
        Returns:
            ErrorLog: The captured error log
        """
        # Extract client IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        return self.capture_error(
            message=message or str(exception) or "HTTP Error",
            error_type=type(exception).__name__ if exception else "HTTPError",
            severity="error" if status_code < 500 else "critical",
            source="backend",
            endpoint=request.url.path,
            method=request.method,
            status_code=status_code,
            client_ip=client_ip,
            user_agent=request.headers.get("user-agent"),
            request_body=None,  # Don't log request body; it's already consumed
            context={
                "query_params": dict(request.query_params) if request.query_params else {},
            },
            exception=exception,
            user_id=user_id,
        )

    def log_frontend_error(
        self,
        message: str,
        error_type: str = "Unknown",
        severity: str = "error",
        url: Optional[str] = None,
        user_agent: Optional[str] = None,
        user_id: Optional[int] = None,
        stack_trace: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> ErrorLog:
        """
        Log an error from the frontend
        
        Args:
            message: Error message
            error_type: Type of error
            severity: Severity level
            url: Page URL where error occurred
            user_agent: Browser user agent
            user_id: ID of affected user
            stack_trace: JavaScript stack trace
            context: Additional context
            
        Returns:
            ErrorLog: The captured error log
        """
        # Store stack_trace in context since capture_error doesn't accept it as a direct parameter
        error_context = context or {}
        if stack_trace:
            error_context["stack_trace"] = stack_trace
        
        return self.capture_error(
            message=message,
            error_type=error_type,
            severity=severity,
            source="frontend",
            user_id=user_id,
            endpoint=url,
            user_agent=user_agent,
            context=error_context,
        )


# Global error logger instance
_error_logger: Optional[ErrorLogger] = None


def get_error_logger() -> ErrorLogger:
    """Get the global error logger instance"""
    global _error_logger
    if _error_logger is None:
        _error_logger = ErrorLogger()
    return _error_logger


def set_db_factory(db_session_factory) -> None:
    """Set the database session factory for the global error logger"""
    global _error_logger
    if _error_logger is None:
        _error_logger = ErrorLogger(db_session_factory)
    else:
        _error_logger.db_session_factory = db_session_factory
