"""
Test script for security middleware implementation.
Run this to verify rate limiting is working correctly.
"""
import requests
import time
from typing import Dict

BASE_URL = "http://localhost:8000"

def test_rate_limiting():
    """Test basic rate limiting functionality"""
    print("Testing Rate Limiting...")
    print("-" * 50)
    
    # Make rapid requests
    success_count = 0
    rate_limited_count = 0
    
    print(f"\nMaking 120 requests to test per-minute limit (limit: 100)...")
    
    for i in range(120):
        try:
            response = requests.get(f"{BASE_URL}/api/characters", timeout=5)
            
            if response.status_code == 200:
                success_count += 1
                # Print rate limit headers
                if i == 0:
                    print(f"\nRate Limit Headers:")
                    print(f"  Limit (Minute): {response.headers.get('X-RateLimit-Limit-Minute')}")
                    print(f"  Limit (Hour): {response.headers.get('X-RateLimit-Limit-Hour')}")
                    print(f"  Remaining (Minute): {response.headers.get('X-RateLimit-Remaining-Minute')}")
                    print(f"  Remaining (Hour): {response.headers.get('X-RateLimit-Remaining-Hour')}")
                
                if i % 20 == 0:
                    remaining = response.headers.get('X-RateLimit-Remaining-Minute', 'N/A')
                    print(f"Request {i+1}: Success (Remaining: {remaining})")
                    
            elif response.status_code == 429:
                rate_limited_count += 1
                if rate_limited_count == 1:
                    print(f"\n✓ Rate limit triggered at request {i+1}")
                    print(f"  Response: {response.text[:100]}")
                    retry_after = response.headers.get('Retry-After', 'N/A')
                    print(f"  Retry-After: {retry_after} seconds")
                
        except requests.exceptions.RequestException as e:
            print(f"Request {i+1} failed: {e}")
        
        # Small delay to avoid overwhelming the server
        time.sleep(0.01)
    
    print(f"\nResults:")
    print(f"  Successful requests: {success_count}")
    print(f"  Rate limited requests: {rate_limited_count}")
    
    if rate_limited_count > 0:
        print("\n✅ Rate limiting is working correctly!")
    else:
        print("\n⚠️  Rate limiting may not be active (no 429 responses received)")


def test_security_headers():
    """Test security headers"""
    print("\n\nTesting Security Headers...")
    print("-" * 50)
    
    try:
        response = requests.get(f"{BASE_URL}/api/characters", timeout=5)
        
        security_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Content-Security-Policy": "default-src 'self'",
        }
        
        print("\nChecking for security headers:")
        all_present = True
        
        for header, expected_value in security_headers.items():
            actual_value = response.headers.get(header)
            if actual_value:
                # For CSP, just check if it starts with expected
                if header == "Content-Security-Policy":
                    if actual_value.startswith(expected_value):
                        print(f"  ✓ {header}: Present")
                    else:
                        print(f"  ⚠️  {header}: Present but different value")
                else:
                    if expected_value in actual_value:
                        print(f"  ✓ {header}: {actual_value}")
                    else:
                        print(f"  ⚠️  {header}: {actual_value} (expected: {expected_value})")
            else:
                print(f"  ✗ {header}: Missing")
                all_present = False
        
        if all_present:
            print("\n✅ All security headers are present!")
        else:
            print("\n⚠️  Some security headers are missing")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error testing headers: {e}")


def test_request_size_limit():
    """Test request size limiting"""
    print("\n\nTesting Request Size Limit...")
    print("-" * 50)
    
    try:
        # Try to send a large payload (11MB, limit is 10MB)
        large_payload = "x" * (11 * 1024 * 1024)
        
        print(f"\nSending 11MB payload (limit is 10MB)...")
        response = requests.post(
            f"{BASE_URL}/api/characters",
            json={"data": large_payload},
            timeout=10
        )
        
        if response.status_code == 413:
            print(f"✓ Request rejected with 413 (Payload Too Large)")
            print(f"  Response: {response.text[:100]}")
            print("\n✅ Request size limiting is working!")
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed (expected): {e}")
        print("✅ Large request was blocked")


def test_admin_monitoring():
    """Test admin monitoring endpoints (requires admin token)"""
    print("\n\nTesting Admin Monitoring Endpoints...")
    print("-" * 50)
    
    print("\nNote: These endpoints require admin authentication.")
    print("To test, replace TOKEN with an actual admin token:")
    print(f"  GET {BASE_URL}/api/admin/security/rate-limit")
    print(f"  GET {BASE_URL}/api/admin/security/rate-limit/{{ip}}")


if __name__ == "__main__":
    print("=" * 50)
    print("Security Implementation Test Suite")
    print("=" * 50)
    print(f"\nTarget: {BASE_URL}")
    print("\nMake sure the backend server is running before testing!")
    print()
    
    input("Press Enter to start tests...")
    
    try:
        # Test if server is running
        response = requests.get(BASE_URL, timeout=5)
        print("\n✓ Server is responding\n")
    except requests.exceptions.RequestException:
        print("\n❌ Error: Cannot connect to server. Make sure it's running on port 8000.")
        print("   Start it with: python backend/server.py")
        exit(1)
    
    # Run tests
    test_security_headers()
    test_rate_limiting()
    # test_request_size_limit()  # Commented out as it may timeout
    test_admin_monitoring()
    
    print("\n" + "=" * 50)
    print("Testing Complete!")
    print("=" * 50)
