# Aliyun CAPTCHA Integration Guide

Complete guide for Aliyun (Alibaba Cloud) human-machine verification CAPTCHA integration in the Mikoshi platform.

## Table of Contents
- [Quick Start](#quick-start)
- [Setup & Configuration](#setup--configuration)
- [Frontend Integration](#frontend-integration)
- [Backend Integration](#backend-integration)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Deployment Checklist](#deployment-checklist)

---

## Quick Start

### 1. Install Dependencies
```bash
# Backend
cd backend
pip install -r requirements.txt

# Verify SDK installation
pip show alibabacloud_captcha20230305
```

### 2. Configure Credentials
Edit `secrets/Mikoshi.env`:
```env
ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_CAPTCHA_SCENE_ID=z6idp2sa
```

### 3. Test Configuration
```bash
cd backend
python test_captcha_config.py
```

Expected output:
```
✓ ALIBABA_CLOUD_ACCESS_KEY_ID: LTAI5t8...
✓ ALIBABA_CLOUD_ACCESS_KEY_SECRET: 8vZx2Qk...
✓ ALIYUN_CAPTCHA_SCENE_ID: z6idp2sa
✓ 验证码客户端初始化成功
```

---

## Setup & Configuration

### Backend Dependencies

Added to `requirements.txt`:
```
alibabacloud_captcha20230305==1.1.4
alibabacloud_tea_openapi>=0.3.9
alibabacloud_tea_util>=0.1.14
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | Yes | - | Aliyun Access Key ID |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | Yes | - | Aliyun Access Key Secret |
| `ALIYUN_CAPTCHA_SCENE_ID` | No | z6idp2sa | CAPTCHA Scene ID |

**For Production (Recommended):**
Use temporary credentials instead of AccessKey:
```env
ALIBABA_CLOUD_ACCESS_KEY_ID=your_temporary_access_key
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_temporary_access_key_secret
ALIBABA_CLOUD_SECURITY_TOKEN=your_security_token
```

### File Structure

```
backend/
├── utils/
│   └── captcha_utils.py         # CAPTCHA utility module
├── routes/
│   └── auth.py                  # API endpoints with CAPTCHA
├── test_captcha_config.py       # Configuration test script
└── requirements.txt             # Updated dependencies

frontend/
├── index.html                   # AliyunCaptchaConfig & SDK loading
└── src/
    └── pages/
        └── WelcomePage.jsx      # CAPTCHA initialization
```

---

## Frontend Integration

### 1. Global Configuration (index.html)

Add before closing `</body>` tag:
```html
<!-- Aliyun CAPTCHA Configuration -->
<script>
  window.AliyunCaptchaConfig = {
    region: 'cn',
    prefix: 'yywvva'
  };
</script>
<script src="https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js"></script>
```

### 2. Component Integration (WelcomePage.jsx)

```javascript
import React, { useState, useEffect, useRef } from 'react';

export default function WelcomePage() {
  // CAPTCHA states
  const captchaRef = useRef(null);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaParam, setCaptchaParam] = useState(null);
  const [captchaError, setCaptchaError] = useState('');

  // Initialize CAPTCHA on mount
  useEffect(() => {
    initCaptcha();
  }, []);

  const initCaptcha = () => {
    if (window.initAliyunCaptcha) {
      window.initAliyunCaptcha({
        SceneId: "z6idp2sa",           // Must match backend
        mode: "popup",
        element: "#captcha-element",
        button: "#captcha-button",
        success: (captchaVerifyParam) => {
          setCaptchaVerified(true);
          setCaptchaParam(captchaVerifyParam);
          setCaptchaError('');
          console.log("✓ CAPTCHA verification success");
        },
        fail: (failParams) => {
          setCaptchaVerified(false);
          setCaptchaError('CAPTCHA verification failed');
          console.error("✗ CAPTCHA verification failed", failParams);
        },
        getInstance: (instance) => {
          captchaRef.current = instance;
        },
        slideStyle: {
          width: 360,
          height: 40,
        },
        language: "cn",
      });
    } else {
      console.error("Aliyun CAPTCHA SDK not loaded");
      setCaptchaError('CAPTCHA SDK loading failed');
    }
  };

  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    
    // Check CAPTCHA verification
    if (!captchaVerified) {
      alert('Please complete CAPTCHA verification');
      return;
    }

    const formData = new FormData();
    formData.append('phone_number', phoneNumber);
    formData.append('verification_code', verificationCode);
    formData.append('captcha_verify_param', captchaParam); // Important!

    try {
      const response = await fetch('/api/verify-phone', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        // Handle login success
      }
    } catch (error) {
      console.error('Login error:', error);
      // Reset CAPTCHA on failure
      setCaptchaVerified(false);
      initCaptcha();
    }
  };

  return (
    <form onSubmit={handlePhoneLogin}>
      {/* Phone number input */}
      <input
        type="tel"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        required
      />

      {/* Verification code input */}
      <input
        type="text"
        value={verificationCode}
        onChange={(e) => setVerificationCode(e.target.value)}
        required
      />

      {/* CAPTCHA elements */}
      <div id="captcha-element"></div>
      <button
        type="button"
        id="captcha-button"
        style={{
          backgroundColor: captchaVerified ? '#28a745' : '#0d6efd',
        }}
        disabled={captchaVerified}
      >
        {captchaVerified ? '✓ Verified' : 'CAPTCHA Verification'}
      </button>

      {/* Submit button */}
      <button type="submit" disabled={!captchaVerified}>
        Login / Register
      </button>
    </form>
  );
}
```

---

## Backend Integration

### 1. CAPTCHA Utility Module (backend/utils/captcha_utils.py)

**Key Components:**
- `CaptchaVerifier` class: Manages Aliyun CAPTCHA client
- `verify_captcha_param()`: Quick verification function
- `get_captcha_verifier()`: Singleton getter

**Usage:**
```python
from utils.captcha_utils import verify_captcha_param, get_captcha_verifier

# Quick verification (returns boolean)
is_valid = verify_captcha_param(captcha_verify_param)

# Detailed verification (returns full result)
verifier = get_captcha_verifier()
result = verifier.verify_captcha(captcha_verify_param)
# result: {"success": bool, "passed": bool, "certify_result": str, "request_id": str}
```

### 2. API Routes (backend/routes/auth.py)

```python
from fastapi import APIRouter, Form, HTTPException, Depends
from utils.captcha_utils import verify_captcha_param

router = APIRouter()

@router.post("/api/verify-phone")
def verify_phone(
    phone_number: str = Form(...),
    verification_code: str = Form(...),
    captcha_verify_param: str = Form(None),
    db: Session = Depends(get_db)
):
    # Step 1: Verify CAPTCHA (if provided)
    if captcha_verify_param:
        if not verify_captcha_param(captcha_verify_param):
            raise HTTPException(
                status_code=403,
                detail="CAPTCHA verification failed"
            )
        print(f"✓ CAPTCHA verification passed")
    
    # Step 2: Verify phone verification code
    if not verify_code(phone_number, verification_code):
        raise HTTPException(
            status_code=401,
            detail="Invalid verification code"
        )
    
    # Step 3: Login/Register logic
    # ...
    return {"status": "success"}
```

---

## API Endpoints

### 1. Verify CAPTCHA Only

**Endpoint:** `POST /api/verify-captcha`

**Purpose:** Standalone CAPTCHA verification (optional)

**Request:**
```bash
curl -X POST http://localhost:8000/api/verify-captcha \
  -F "captcha_verify_param=xxx"
```

**Response (Success):**
```json
{
  "success": true,
  "passed": true,
  "message": "Verification pass",
  "certify_result": "pass",
  "request_id": "xxx-yyy-zzz"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "passed": false,
  "certify_result": "refuse",
  "message": "Verification failed"
}
```

### 2. Phone Login with CAPTCHA

**Endpoint:** `POST /api/verify-phone`

**Purpose:** Phone login with CAPTCHA verification

**Request:**
```bash
curl -X POST http://localhost:8000/api/verify-phone \
  -F "phone_number=13800138000" \
  -F "verification_code=123456" \
  -F "captcha_verify_param=xxx"
```

**Response (Existing User):**
```json
{
  "status": "existing_user",
  "message": "Login successful",
  "session_token": "token_xxx",
  "user": { /* user data */ }
}
```

**Response (New User):**
```json
{
  "status": "new_user",
  "message": "Phone verified, please complete registration",
  "verified_phone_token": "token_xxx",
  "phone_number": "13800138000"
}
```

### Verification Flow

```
Client Request
     ↓
1. Verify CAPTCHA (captcha_verify_param)
   ├─ Valid → Continue
   └─ Invalid → Return 403
     ↓
2. Verify SMS Code (phone + code)
   ├─ Valid → Continue
   └─ Invalid → Return 401
     ↓
3. Check User Exists
   ├─ Exists → Return session token
   └─ New → Return registration token
```

---

## Testing

### Configuration Test

Test environment variables and client initialization:
```bash
cd backend
python test_captcha_config.py
```

### API Testing

**Test CAPTCHA Verification:**
```bash
curl -X POST http://localhost:8000/api/verify-captcha \
  -F "captcha_verify_param=test_param"
```

**Test Full Login Flow:**
```bash
curl -X POST http://localhost:8000/api/verify-phone \
  -F "phone_number=13800138000" \
  -F "verification_code=123456" \
  -F "captcha_verify_param=<actual_param_from_frontend>"
```

### Python Testing

```python
import requests

# Test CAPTCHA verification
response = requests.post(
    'http://localhost:8000/api/verify-captcha',
    data={'captcha_verify_param': 'test_param'}
)
print(response.json())

# Test phone login
response = requests.post(
    'http://localhost:8000/api/verify-phone',
    data={
        'phone_number': '13800138000',
        'verification_code': '123456',
        'captcha_verify_param': 'actual_param'
    }
)
print(response.json())
```

### Browser Testing

1. Open browser DevTools (F12)
2. Go to Console tab
3. Complete CAPTCHA verification
4. Check logs for verification success
5. Go to Network tab
6. Find `/api/verify-phone` request
7. Verify `captcha_verify_param` is in payload

---

## Troubleshooting

### Problem: CORS Error

**Symptom:**
```
Access to fetch at 'http://localhost:8000/api/verify-phone' blocked by CORS policy
```

**Root Cause:**
Usually not a CORS issue, but an exception thrown before CORS middleware processes the request.

**Solution:**

1. **Check environment variables:**
   ```bash
   cd backend
   python test_captcha_config.py
   ```

2. **Verify configuration file:**
   ```bash
   cat ../secrets/Mikoshi.env | grep ALIBABA
   ```

3. **Check server logs:**
   ```bash
   cd backend
   python -m uvicorn server:app --reload
   ```
   Look for warnings like:
   ```
   ⚠️  警告: 阿里云验证码凭证未配置
   ```

4. **Test with correct credentials:**
   Edit `secrets/Mikoshi.env` and add proper credentials

### Problem: Environment Variables Not Loading

**Symptom:** Test shows credentials not configured even though you added them

**Causes:**
- Wrong file path
- File encoding issues (BOM)
- Variable name typos
- Extra spaces or quotes

**Solution:**
```bash
# Verify file exists
ls secrets/Mikoshi.env

# Check content
cat secrets/Mikoshi.env | grep ALIBABA

# Correct format:
ALIBABA_CLOUD_ACCESS_KEY_ID=LTAI5t8xxxxx

# Wrong formats (don't use):
ALIBABA_CLOUD_ACCESS_KEY_ID = "LTAI5t8xxxxx"
ALIBABA_CLOUD_ACCESS_KEY_ID='LTAI5t8xxxxx'
```

### Problem: Scene ID Mismatch

**Symptom:** Verification always fails, returns `certify_result: refuse`

**Check:**
```javascript
// Frontend (WelcomePage.jsx)
SceneId: "z6idp2sa"  // Must match backend
```

```env
# Backend (secrets/Mikoshi.env)
ALIYUN_CAPTCHA_SCENE_ID=z6idp2sa
```

**Solution:** Ensure both values are identical

### Problem: CAPTCHA Client Initialization Failed

**Symptom:**
```
❌ 验证码客户端初始化失败: Failed to initialize Aliyun Captcha client
```

**Possible Causes:**
1. Incorrect AccessKey or Secret
2. Account suspended or service not enabled
3. Network connectivity issues

**Solutions:**
1. Verify credentials are correct
2. Login to Aliyun console and check account status
3. Test network: `ping captcha.cn-shanghai.aliyuncs.com`

### Problem: Frontend Success but Backend Fails

**Symptom:**
- Frontend shows "Verification success"
- Backend returns "CAPTCHA verification failed"

**Cause:** CAPTCHA parameter not properly passed

**Debug:**
```javascript
// In handlePhoneLogin
console.log('captchaParam:', captchaParam);
console.log('captchaParam length:', captchaParam?.length);
```

**Check:**
- `captchaParam` state is correctly saved
- `verifyPhone` function passes parameter correctly
- Network request includes `captcha_verify_param`

### Problem: CAPTCHA Parameter Empty

**Symptom:**
```
📞 收到登录请求 - captcha_param长度: 0
```

**Cause:** `captchaParam` state not set

**Solution:**
```javascript
// Verify success callback
success: (captchaVerifyParam) => {
  setCaptchaVerified(true);
  setCaptchaParam(captchaVerifyParam);  // Make sure this executes
  console.log("✓ Verification success", captchaVerifyParam);
},
```

### Debugging Tips

**1. Enable Detailed Logging:**
Already added in `captcha_utils.py`:
```python
print(f"🔍 验证验证码参数: scene_id={scene_id}, param_length={len(captcha_verify_param)}")
print(f"✓ 验证码验证结果: passed={result.get('passed')}")
```

**2. Test with curl:**
```bash
# Test with invalid param (should fail)
curl -X POST http://localhost:8000/api/verify-phone \
  -F "phone_number=13800138000" \
  -F "verification_code=123456" \
  -F "captcha_verify_param=invalid"

# Test with real param (copy from frontend)
curl -X POST http://localhost:8000/api/verify-phone \
  -F "phone_number=13800138000" \
  -F "verification_code=123456" \
  -F "captcha_verify_param=eyJjZXJ0..."
```

**3. Check Console Logs:**
- Frontend: Browser DevTools Console
- Backend: Terminal running uvicorn

---

## Deployment Checklist

### Pre-Deployment

**Dependencies:**
- [ ] Backend dependencies installed: `pip install -r backend/requirements.txt`
- [ ] Frontend dependencies updated (if needed): `npm install`
- [ ] SDK version verified: `pip show alibabacloud_captcha20230305`

**Environment Configuration:**
- [ ] Aliyun AccessKey configured in `secrets/Mikoshi.env`
- [ ] Scene ID configured: `ALIYUN_CAPTCHA_SCENE_ID=z6idp2sa`
- [ ] Environment variables load correctly
- [ ] Test script passes: `python test_captcha_config.py`

**Frontend:**
- [ ] `index.html` loads Aliyun SDK
- [ ] `AliyunCaptchaConfig` configured correctly
- [ ] `WelcomePage.jsx` initializes CAPTCHA
- [ ] `#captcha-element` and `#captcha-button` elements present
- [ ] `captchaParam` saved on verification success
- [ ] Login handler passes `captchaParam` correctly

**Backend:**
- [ ] `captcha_utils.py` created and configured
- [ ] `auth.py` imports CAPTCHA utilities
- [ ] `/api/verify-captcha` endpoint added
- [ ] `/api/verify-phone` endpoint supports CAPTCHA parameter

### Functional Testing

**Frontend:**
- [ ] Login page loads, CAPTCHA button displays
- [ ] Click "CAPTCHA Verification", popup appears
- [ ] Complete verification, button turns green "✓ Verified"
- [ ] Console has no errors

**Backend:**
- [ ] `/api/verify-captcha` responds correctly
- [ ] `/api/verify-phone` validates CAPTCHA
- [ ] Logs show verification details
- [ ] Error handling works properly

**End-to-End:**
- [ ] Complete full login flow successfully
- [ ] Invalid CAPTCHA shows proper error
- [ ] Expired CAPTCHA handled correctly
- [ ] Network errors display friendly messages

### Performance Testing

- [ ] CAPTCHA initialization < 1 second
- [ ] CAPTCHA verification < 2 seconds
- [ ] Full login flow < 3 seconds

### Security Checklist

**Credential Security:**
- [ ] AccessKey not hardcoded in code
- [ ] `secrets/Mikoshi.env` in `.gitignore`
- [ ] Production uses temporary credentials or RAM roles
- [ ] Sub-account permissions limited to CAPTCHA service only

**Data Security:**
- [ ] CAPTCHA parameters not logged in plain text
- [ ] HTTPS enabled (production)
- [ ] CAPTCHA parameters used only once
- [ ] Detailed errors not returned to client on failure

**API Security:**
- [ ] Rate limiting configured (RateLimitMiddleware)
- [ ] CORS configured correctly
- [ ] Request size limits set
- [ ] SQL injection protection enabled

### Production Deployment

**Environment Variables (Production):**
```env
ALIBABA_CLOUD_ACCESS_KEY_ID=prod_key_id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=prod_key_secret
ALIYUN_CAPTCHA_SCENE_ID=z6idp2sa
ENVIRONMENT=production
```

**Deployment Steps:**
1. [ ] Backup existing configuration
2. [ ] Update code on production server
3. [ ] Install/update dependencies
4. [ ] Configure environment variables
5. [ ] Restart services
6. [ ] Verify services running
7. [ ] Test full login flow
8. [ ] Monitor error logs

**Rollback Plan:**
If issues occur:
1. Immediately switch back to old version
2. Check error logs
3. Fix issues
4. Verify in test environment
5. Re-deploy

---

## Additional Resources

**Internal Documentation:**
- [FEATURES.md](FEATURES.md) - All platform features
- [ADMIN.md](ADMIN.md) - Admin panel setup

**External Resources:**
- [Aliyun CAPTCHA Official Docs](https://www.alibabacloud.com/help/en/captcha)
- [Python SDK GitHub](https://github.com/aliyun/alibabacloud-python-sdk/tree/master/captcha-20230305)
- [API Reference](https://next.api.alibabacloud.com/document/captcha/2023-03-05)

---

**Last Updated:** January 2026
