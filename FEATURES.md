# Mikoshi Platform Features

This document provides a comprehensive overview of all major features implemented in the Mikoshi platform.

## Table of Contents
- [EXP & Level System](#exp--level-system)
- [Badge System](#badge-system)
- [Invitation Code System](#invitation-code-system)
- [System Notifications](#system-notifications)
- [Security Implementation](#security-implementation)

---

## EXP & Level System

### Overview
The level system rewards user actions with experience points (EXP). As users gain EXP, they level up and unlock new features.

### Levels (1-6)
- **Level 1 (Newbie)**: 0 EXP - Create chars, scenes, personas
- **Level 2 (Creator)**: 100 EXP - Fork, private chars
- **Level 3 (Advanced)**: 300 EXP - 1 paid char, basic analytics
- **Level 4 (Pro)**: 600 EXP - 2 paid chars, prompt controls
- **Level 5 (Elite)**: 1000 EXP - Featured chance, beta tools
- **Level 6 (Master)**: 1500 EXP - Creator badge, early revenue tools

### EXP Rewards & Limits

| Action | EXP | Daily Limit |
|--------|-----|-------------|
| Daily chat (any character) | 20 | 1/day |
| Create character | 30 | 2/day |
| Create scene | 15 | 2/day |
| Create persona | 15 | 2/day |
| Character liked | 5 (awarded to creator) | 20/day |
| Entity forked | 10 (awarded to creator) | No hard cap |
| Paid character sold | 50 (awarded to creator) | No cap |

### Daily EXP Caps

| Level Range | Daily EXP Cap |
|-------------|---------------|
| L1-L2 | 150 EXP/day |
| L3-L4 | 300 EXP/day |
| L5-L6 | 500 EXP/day |

### API Endpoints

#### Award EXP: `POST /api/exp/gain`
```json
Request: {
  "action": "create_character",
  "target_type": "character",  // Optional
  "target_id": 123             // Optional
}

Response: {
  "success": true,
  "exp_added": 30,
  "total_exp": 130,
  "level": 2,
  "leveled_up": true,
  "daily_exp_gained": 30,
  "daily_exp_cap": 150
}
```

#### Get Limits: `GET /api/exp/limits`
```json
Response: {
  "level": 1,
  "daily_exp_gained": 30,
  "daily_exp_cap": 150,
  "remaining_exp": 120,
  "daily_action_counts": { "create_character": 1 }
}
```

#### Get All Levels: `GET /api/levels`

### Implementation Status
- ✅ **daily_chat** (+20 EXP, 1/day)
- ✅ **create_character** (+30 EXP, 2/day)
- ✅ **create_scene** (+15 EXP, 2/day)
- ✅ **create_persona** (+15 EXP, 2/day)
- ✅ **character_liked** (+5 EXP, 20/day)
- ✅ **forked** (+10 EXP) - Backend ready, requires fork feature
- ⏳ **paid_char_sold** (+50 EXP) - Requires payment system

### Database Migrations
```bash
python backend/migrations/add_level_exp_system.py
python backend/migrations/add_last_chat_date.py
python backend/migrations/add_daily_exp_limits.py
```

### Frontend Integration
```javascript
import { silentExpGain } from '../utils/expUtils';

// Award EXP after user action
await silentExpGain('create_character', null, sessionToken);
```

---

## Badge System

### Overview
The badge system allows users to earn achievements based on their activities and milestones. Each badge has an associated avatar frame with metal textures.

### Available Badges

| Badge | Emoji | Description | Condition | Frame | Color |
|-------|-------|-------------|-----------|-------|-------|
| Pioneer | ⭐ | Early adopter | Manual award by admin | pioneer_frame | Red (#FF6B6B) |
| Bronze Creator | 🥉 | 1,000 chats milestone | Automatic | bronze_frame | Bronze (#CD7F32) |
| Silver Creator | 🥈 | 10,000 chats milestone | Automatic | silver_frame | Silver (#C0C0C0) |
| Gold Creator | 🥇 | 100,000 chats milestone | Automatic | gold_frame | Gold (#FFD700) |

### Features
- **Avatar Frames**: Metal-textured circular frames around profile pictures
- **Text Badges**: Colored labels next to username
- **Badge Selection**: Users can choose which badge to display via "Manage Badges"
- **Toggle Display**: Option to hide badge completely
- **Automatic Award**: Chat-based badges awarded automatically

### API Endpoints

#### Get Badge Definitions: `GET /api/badges`
#### Get User Badges: `GET /api/user/{user_id}/badges`
#### Check and Award: `POST /api/user/badges/check-and-award`
#### Set Active Badge: `POST /api/user/active-badge`
```json
Request: { "badge_key": "gold_creator" }  // or null to hide
```

#### Admin Award Badge: `POST /api/admin/badges/{user_id}/award`
```json
Request: { "badge_key": "pioneer" }
```

#### Admin Remove Badge: `POST /api/admin/badges/{user_id}/remove`

### Technical Implementation

**Backend:**
- `backend/models.py` - User.badges (JSONB), User.active_badge
- `backend/utils/badge_system.py` - Core badge logic
- `backend/routes/user.py` - Badge API endpoints
- `backend/routes/chat.py` - Automatic badge checking after chats

**Frontend:**
- `frontend/src/components/AvatarFrame.jsx` - Metal frame rendering
- `frontend/src/components/UserCard.jsx` - Badge display on cards
- `frontend/src/pages/ProfilePage.jsx` - Badge management UI

### Database Migration
```bash
python backend/migrations/add_badge_system.py
```

### Adding New Badges
1. Update `BADGES` dict in `backend/utils/badge_system.py`
2. Add condition logic in `check_and_award_chat_badges()` or create new check function
3. Update `getBadgeColor()` and `getBadgeEmoji()` in frontend components
4. Add translations for badge names

---

## Invitation Code System

### Overview
Complete invitation code system for managing alpha testing. New users cannot sign up without a valid invitation code.

### Features

**Admin Features:**
- Generate codes with customizable settings
- Track usage and monitor who used codes
- Revoke or reactivate codes as needed
- Set expiration dates and usage limits

**Code Properties:**
- 12-character alphanumeric codes (no confusing characters: O, 0, I, 1)
- Configurable max uses (1-100)
- Optional expiration (in days, or never)
- Internal notes for organization
- Status: Active, Expired, Exhausted, or Revoked

### Database Schema: `invitation_codes`

| Column | Type | Description |
|--------|------|-------------|
| code | VARCHAR(20) | Unique invitation code (PRIMARY KEY) |
| created_by | VARCHAR | Admin user who created the code |
| created_at | TIMESTAMP | Creation timestamp |
| expires_at | TIMESTAMP | Expiration timestamp (nullable) |
| used_by | VARCHAR | First user who used the code |
| used_at | TIMESTAMP | First usage timestamp |
| is_active | BOOLEAN | Whether code can be used |
| max_uses | INTEGER | Maximum number of uses allowed |
| use_count | INTEGER | Current number of uses |
| notes | TEXT | Admin notes |

### API Endpoints

#### Generate Code (Admin): `POST /api/invitations/generate`
```json
Request: {
  "max_uses": 1,
  "expires_in_days": 30,
  "notes": "For beta testers"
}

Response: {
  "message": "Invitation code generated successfully",
  "code": "ABCD1234EFGH",
  "expires_at": "2025-12-11T00:00:00Z",
  "max_uses": 1
}
```

#### List Codes (Admin): `GET /api/invitations`
#### Revoke Code (Admin): `DELETE /api/invitations/{code}`
#### Reactivate Code (Admin): `PATCH /api/invitations/{code}/reactivate`

#### Validate Code (Public): `POST /api/invitations/validate`
```json
Request: { "code": "ABCD1234EFGH" }

Response: {
  "valid": true,
  "message": "Invitation code is valid",
  "uses_remaining": 0
}
```

### Setup Instructions

1. **Run Migration:**
   ```bash
   cd backend
   python migrations/create_invitation_codes_table.py
   ```

2. **Generate Codes:**
   - Log in as admin
   - Navigate to `/admin/invitations`
   - Click "Generate Code"
   - Configure settings and generate

3. **Test Registration:**
   - Use generated code in sign-up form
   - Code is validated before account creation

### Status Indicators
- 🟢 **Active**: Valid and has uses remaining
- 🟡 **Expired**: Past expiration date
- ⚪ **Exhausted**: All uses consumed
- 🔴 **Revoked**: Manually deactivated by admin

### Use Cases

**Controlled Launch:**
```
Max Uses: 1, Expires: 30 days
Notes: "Initial alpha testers - Round 1"
```

**Influencer Campaign:**
```
Max Uses: 50, Expires: 7 days
Notes: "Influencer @username campaign"
```

**Long-term Beta:**
```
Max Uses: 100, Expires: Never
Notes: "Open beta program"
```

---

## System Notifications

### Overview
Allows admins to create and manage update notifications that appear to users. Perfect for announcing new features, alpha test updates, or important announcements.

### Features
- ✅ Create, edit, and delete notifications from admin panel
- ✅ Activate/deactivate notifications (only one active at a time)
- ✅ Custom title, message, and feature bullet points
- ✅ Notifications appear once per session
- ✅ Manual re-open via megaphone icon
- ✅ Bilingual support (English and Chinese)
- ✅ Portal rendering (appears on top of everything)

### For Admins

**Access Admin Panel:**
- Navigate to `/admin/notifications`

**Create Notification:**
1. Click "Create New Notification"
2. Fill in title, message, and optional features
3. Click "Create" (notification starts inactive)

**Activate Notification:**
- Click "Activate" button
- Only one notification can be active at a time
- Users will see it once per session

**Edit/Delete:**
- Click pencil icon to edit
- Click trash icon to delete

### For Users
- **Automatic Display**: Active notification appears once per session
- **Manual Access**: Click megaphone icon (🔊) in top-right corner
- **Close**: Click X or "Got it!" to dismiss

### Database Schema: `system_notifications`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| title | TEXT | Notification title |
| message | TEXT | Main message content |
| features | JSON | Array of feature bullet points |
| is_active | BOOLEAN | Active status (only one can be true) |
| created_by | VARCHAR | Admin user ID |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### API Endpoints

#### Get Active Notification (Public): `GET /api/notification/active`
#### Get All Notifications (Admin): `GET /api/admin/notifications`
#### Create Notification (Admin): `POST /api/admin/notifications`
#### Update Notification (Admin): `PUT /api/admin/notifications/{id}`
#### Delete Notification (Admin): `DELETE /api/admin/notifications/{id}`

### Database Migration
```bash
cd backend
python migrations/add_system_notifications.py
```

### Technical Details

**Frontend Components:**
- `UpdateNotificationModal.jsx` - Notification popup
- `NotificationsPage.jsx` - Admin management page

**State Management:**
- Uses `sessionStorage` to track if user has seen notification
- Key: `hasSeenUpdateNotification`

---

## Security Implementation

### Overview
Comprehensive security measures to protect against common web attacks and abuse.

### 1. IP-Based Rate Limiting

**Features:**
- Per-minute limit: 100 requests/minute/IP (configurable)
- Per-hour limit: 1000 requests/hour/IP (configurable)
- Automatic IP blocking: IPs exceeding 2x limit are blocked for 1 hour
- Memory cleanup: Old records automatically cleaned

**Response Headers:**
- `X-RateLimit-Limit-Minute`
- `X-RateLimit-Limit-Hour`
- `X-RateLimit-Remaining-Minute`
- `X-RateLimit-Remaining-Hour`

**When Limit Exceeded:**
- Status: `429 Too Many Requests`
- Header: `Retry-After` (seconds until reset)

**Configuration:**
```python
# backend/server.py
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=100,  # Adjust as needed
    requests_per_hour=1000
)
```

### 2. Security Headers

Automatically added to all responses:

- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - Enables XSS filtering
- `Strict-Transport-Security: max-age=31536000` - Forces HTTPS
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer info
- `Content-Security-Policy` - Controls resource loading

### 3. Request Size Limiting

- **Maximum request size**: 10 MB (configurable)
- **Response**: `413 Request Entity Too Large`

**Configuration:**
```python
# backend/server.py
app.add_middleware(
    RequestSizeLimitMiddleware, 
    max_size=10 * 1024 * 1024  # 10 MB
)
```

### 4. Admin Monitoring Endpoints

#### Check Current IP: `GET /api/admin/security/rate-limit`
```json
Response: {
  "ip": "192.168.1.1",
  "blocked": false,
  "requests_last_minute": 5,
  "requests_last_hour": 42
}
```

#### Check Specific IP: `GET /api/admin/security/rate-limit/{ip}`
```json
Response: {
  "ip": "192.168.1.1",
  "blocked": true,
  "block_expires_at": 1705432800.0,
  "remaining_time": 3420
}
```

### IP Detection Priority
1. `X-Forwarded-For` (first IP in chain)
2. `X-Real-IP`
3. Direct client IP (fallback)

### Testing Rate Limiting
```bash
# Make rapid requests to test
for i in {1..150}; do
  curl http://localhost:8000/api/characters
  echo "Request $i"
done
```

### Production Considerations

**For High-Traffic Apps:**
1. Use Redis for distributed rate limiting
2. Configure reverse proxy rate limiting (nginx, Cloudflare)
3. Implement IP whitelisting for trusted services

**Monitoring:**
1. Log rate limit violations (already implemented)
2. Set up alerts for unusual patterns
3. Monitor blocked IPs via admin endpoints
4. Review rate limits based on traffic patterns

### Customization

**Adjust Block Duration:**
```python
# backend/utils/security_middleware.py
def block_ip(self, ip: str, duration: int = 3600):  # Change duration
```

**IP Whitelist:**
```python
WHITELISTED_IPS = ["127.0.0.1", "10.0.0.1"]
# Add check in dispatch method
```

**Per-Endpoint Rate Limits:**
```python
if request.url.path.startswith("/api/chat"):
    requests_per_minute = 20  # Stricter for chat
```

### Installation
```bash
pip install -r backend/requirements.txt  # Includes slowapi
python server.py  # Restart server
```

### Files
- `backend/utils/security_middleware.py` - Middleware implementation
- `backend/server.py` - Middleware registration
- `backend/routes/admin.py` - Admin monitoring endpoints

---

## Related Documentation

For implementation-specific details and migrations, see:
- [ADMIN.md](ADMIN.md) - Admin portal setup and features
- [CAPTCHA.md](CAPTCHA.md) - CAPTCHA integration
- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - Database migrations and implementation history
- [README.md](README.md) - General project information

---

**Last Updated**: January 2026
