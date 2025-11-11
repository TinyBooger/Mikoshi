# Invitation Code System - Alpha Testing

## Overview
Your Mikoshi platform now has a complete invitation code system for managing alpha testing. New users cannot sign up without a valid invitation code.

## Features

### Admin Features
- **Generate Codes**: Create invitation codes with customizable settings
- **Track Usage**: Monitor which codes have been used and by whom
- **Manage Codes**: Revoke or reactivate codes as needed
- **Flexible Configuration**: Set expiration dates and usage limits

### Code Properties
- **Unique Codes**: 12-character alphanumeric codes (no confusing characters)
- **Max Uses**: Control how many users can use each code (1-100)
- **Expiration**: Set expiration in days (or never expire)
- **Notes**: Add internal notes for organization
- **Status Tracking**: Active, Expired, Exhausted, or Revoked

## Database Schema

### `invitation_codes` Table
| Column | Type | Description |
|--------|------|-------------|
| `code` | VARCHAR(20) | Unique invitation code (PRIMARY KEY) |
| `created_by` | VARCHAR | Admin user who created the code |
| `created_at` | TIMESTAMP | When the code was created |
| `expires_at` | TIMESTAMP | When the code expires (nullable) |
| `used_by` | VARCHAR | First user who used the code |
| `used_at` | TIMESTAMP | When first used |
| `is_active` | BOOLEAN | Whether code can be used |
| `max_uses` | INTEGER | Maximum number of uses allowed |
| `use_count` | INTEGER | Current number of uses |
| `notes` | TEXT | Admin notes about this code |

## API Endpoints

### Admin Endpoints (Require Admin Auth)

#### Generate Invitation Code
```http
POST /api/invitations/generate
Authorization: {session_token}
Content-Type: application/json

{
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

#### List All Codes
```http
GET /api/invitations
Authorization: {session_token}

Response: [
  {
    "code": "ABCD1234EFGH",
    "created_by": "admin@example.com",
    "created_at": "2025-11-11T00:00:00Z",
    "expires_at": "2025-12-11T00:00:00Z",
    "used_by": "user@example.com",
    "used_at": "2025-11-12T00:00:00Z",
    "is_active": true,
    "max_uses": 1,
    "use_count": 1,
    "notes": "For beta testers",
    "status": "exhausted"
  }
]
```

#### Revoke Code
```http
DELETE /api/invitations/{code}
Authorization: {session_token}

Response: {
  "message": "Invitation code revoked successfully"
}
```

#### Reactivate Code
```http
PATCH /api/invitations/{code}/reactivate
Authorization: {session_token}

Response: {
  "message": "Invitation code reactivated successfully"
}
```

### Public Endpoints

#### Validate Code (Used by signup form)
```http
POST /api/invitations/validate
Content-Type: application/json

{
  "code": "ABCD1234EFGH"
}

Response: {
  "valid": true,
  "message": "Invitation code is valid",
  "uses_remaining": 0
}
```

## Setup Instructions

### 1. Run Database Migration

```bash
cd backend
python migrations/create_invitation_codes_table.py
```

This creates the `invitation_codes` table and necessary indexes.

### 2. Generate Your First Invitation Code

1. Log in as an admin user
2. Navigate to `/admin/invitations`
3. Click **"Generate Code"**
4. Configure settings:
   - **Max Uses**: How many people can use this code
   - **Expires In**: How many days until expiration (0 = never)
   - **Notes**: Internal note (e.g., "For influencers")
5. Click **"Generate"**
6. Copy the code and share it with your tester

### 3. Test Registration

1. Navigate to the sign-up page
2. Enter the invitation code (first field)
3. Complete registration form
4. Code will be validated before account creation

## User Registration Flow

### With Invitation Code
1. User visits sign-up page
2. **New:** Invitation code field is required (first field)
3. User enters code (auto-converted to uppercase)
4. Upon submission:
   - Code is validated (exists, active, not expired, has uses remaining)
   - If valid, account is created
   - Code's `use_count` is incremented
   - If first use, `used_by` and `used_at` are set
5. User is logged in automatically

### Validation Errors
- "Invalid invitation code" - Code doesn't exist
- "This invitation code has been revoked" - Admin revoked it
- "This invitation code has reached its usage limit" - All uses consumed
- "This invitation code has expired" - Past expiration date

## Admin Dashboard

### Invitation Codes Page (`/admin/invitations`)

**Features:**
- View all codes with status badges
- See usage stats (e.g., "1 / 1" uses)
- Copy codes to clipboard
- Revoke active codes
- Reactivate revoked codes
- Generate new codes

**Status Indicators:**
- 🟢 **Active**: Code is valid and has uses remaining
- 🟡 **Expired**: Past expiration date
- ⚪ **Exhausted**: All uses consumed
- 🔴 **Revoked**: Manually deactivated by admin

### Dashboard Stats
The main dashboard now shows:
- Total invitation codes
- **Active** invitation codes (ready to use)
- Quick action button to generate codes

## Code Generation

### Secure Random Generation
- 12 characters long
- Uses cryptographically secure random generation
- Excludes confusing characters: O, 0, I, 1
- Only uppercase letters and numbers
- Format: `ABCD1234EFGH`

### Settings

**Max Uses (1-100)**
- `1`: Single-use code (default)
- `5`: Can be shared with small group
- `100`: Large batch invite

**Expiration (days)**
- `30`: Expires in 30 days (default)
- `7`: Short-term testing
- `365`: Long-term code
- `0`: Never expires

**Notes**
- Internal reference
- Examples: "For beta testers", "Marketing campaign", "VIP access"

## Use Cases

### Scenario 1: Controlled Launch
```javascript
// Generate 10 single-use codes for first 10 users
Max Uses: 1
Expires In: 30 days
Notes: "Initial alpha testers - Round 1"
```

### Scenario 2: Influencer Campaign
```javascript
// Code for influencer to share with audience
Max Uses: 50
Expires In: 7 days
Notes: "Influencer @username campaign"
```

### Scenario 3: Long-term Beta
```javascript
// Permanent code for ongoing recruitment
Max Uses: 100
Expires In: 0 (never)
Notes: "Open beta program"
```

### Scenario 4: Emergency Revocation
If a code is being abused:
1. Find code in `/admin/invitations`
2. Click revoke button (red X icon)
3. Code immediately becomes invalid
4. Can reactivate later if needed

## Security Features

### Backend Protection
- ✅ Codes validated before account creation
- ✅ Atomic operations prevent race conditions
- ✅ Case-insensitive matching (stored uppercase)
- ✅ Expiration checked server-side
- ✅ Use count incremented atomically
- ✅ Foreign key constraints for referential integrity

### Frontend UX
- ✅ Code input auto-converts to uppercase
- ✅ Clear error messages
- ✅ Helper text explains alpha test requirement
- ✅ One-click copy to clipboard
- ✅ Visual status indicators

## Management Tips

### Best Practices
1. **Track Usage**: Add descriptive notes to codes
2. **Set Expiration**: Use time-limited codes for control
3. **Monitor Dashboard**: Check active invitations regularly
4. **Revoke Unused**: Clean up expired/unused codes
5. **Generate on Demand**: Create codes as needed rather than in bulk

### Monitoring
Check `/admin/invitations` regularly for:
- Which codes are being used
- When codes were used
- Who used each code (first user)
- Remaining capacity on multi-use codes

## Migration Path

### From Open Registration to Invitation-Only

**Phase 1: Add System (Current)**
- Database table created
- Admin interface available
- Registration updated to require codes

**Phase 2: Grandfather Existing Users**
- Existing users unaffected
- Only new registrations need codes

**Phase 3: Generate Initial Codes**
- Create codes for known testers
- Share codes via email/social

**Phase 4: Launch Alpha**
- Direct new users to sign-up page
- Monitor registration metrics
- Adjust code generation as needed

## Troubleshooting

### "Registration failed. Please check your invitation code."
**Causes:**
- Invalid code (typo)
- Expired code
- Exhausted code (all uses consumed)
- Revoked code

**Solution:**
- Verify code spelling
- Check code status in admin panel
- Generate new code if needed

### Code not working after generation
**Check:**
1. Code is marked as `is_active = true`
2. `use_count < max_uses`
3. `expires_at` is in the future (or null)
4. Database migration completed

### Cannot generate codes
**Verify:**
1. Logged in as admin user
2. `is_admin = true` in database
3. Session token is valid
4. Backend server is running

## Future Enhancements

### Potential Features
- [ ] Batch code generation (create multiple at once)
- [ ] CSV export of codes
- [ ] Email invitation sending
- [ ] Usage analytics (conversion rates)
- [ ] Code categories/groups
- [ ] Referral tracking (who invited whom)
- [ ] Automatic code generation rules
- [ ] Integration with marketing tools

## Summary

Your invitation code system is now fully operational! 

**Key Points:**
- ✅ All new users must have an invitation code
- ✅ Admins can generate, track, and manage codes
- ✅ Flexible configuration (uses, expiration, notes)
- ✅ Secure validation and tracking
- ✅ Professional admin interface

**Next Steps:**
1. Run the migration script
2. Generate your first invitation codes
3. Share codes with alpha testers
4. Monitor usage in admin dashboard

Your alpha test is ready to launch! 🚀
