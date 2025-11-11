# Admin Portal Setup Guide

## Overview
The admin portal provides a secure interface for managing users, characters, tags, and search terms in your Mikoshi application.

## Setup Steps

### 1. Add `is_admin` Column to Database

Run the migration script to add the admin field to your users table:

```bash
cd backend
python migrations/add_is_admin_column.py
```

### 2. Grant Admin Access to Users

After running the migration, you need to manually set admin privileges for specific users.

**Option A: Direct SQL Query**
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'your-email@example.com';
```

**Option B: Edit Migration Script**
Uncomment and modify lines in `backend/migrations/add_is_admin_column.py`:
```python
admin_email = "your-admin-email@example.com"  # CHANGE THIS
conn.execute(text("""
    UPDATE users 
    SET is_admin = TRUE 
    WHERE email = :email;
"""), {"email": admin_email})
```

### 3. Access Admin Portal

Once you've granted admin privileges to your account:

1. Log in to your account
2. Click on your profile dropdown in the sidebar
3. Click "Admin Panel" (only visible to admin users)
4. You'll be redirected to `/admin`

## Features

### Backend Security
- **Admin Authentication**: All admin endpoints require valid session token + admin privileges
- **Middleware Protection**: `get_current_admin_user` dependency checks user status
- **403 Forbidden**: Non-admin users receive proper error responses

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/characters` | GET | List all characters |
| `/api/admin/tags` | GET | List all tags with stats |
| `/api/admin/search-terms` | GET | List search keywords with counts |
| `/api/admin/users/{id}` | DELETE | Delete a user |
| `/api/admin/characters/{id}` | DELETE | Delete a character |
| `/api/admin/tags/{id}` | DELETE | Delete a tag |
| `/api/admin/users/{id}/toggle-admin` | PATCH | Grant/revoke admin privileges |

### Frontend Protection
- **Route Guard**: `AdminRoute` component prevents unauthorized access
- **Conditional Rendering**: Admin panel link only shows for admin users
- **Auto Redirect**: Non-admin users redirected to home page

## Admin Pages

1. **Dashboard** - Overview and statistics
2. **Users** - View all users, manage admin privileges
3. **Characters** - View all characters
4. **Tags** - View tag usage statistics
5. **Search Terms** - View popular search keywords

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never expose admin endpoints without authentication**
2. **Admin users can delete other users** (except themselves)
3. **Admin users can grant/revoke admin privileges** (except for themselves)
4. **Session tokens are required for all admin actions**
5. **Always use HTTPS in production**

## Troubleshooting

### "Access forbidden: Admin privileges required"
- Verify your user has `is_admin = TRUE` in the database
- Check that you're logged in with the correct account
- Ensure session token is being sent with requests

### Admin panel link not showing
- Refresh user data or log out and back in
- Verify `is_admin` field is included in `UserOut` schema
- Check browser console for errors

### Can't access admin routes
- Ensure backend admin router is imported in `server.py`
- Verify CORS settings allow your frontend domain
- Check that `AdminRoute` component is wrapping admin routes in `App.jsx`

## Future Enhancements

Consider adding:
- [ ] Bulk user operations
- [ ] User activity logs
- [ ] Content moderation tools
- [ ] Analytics dashboard
- [ ] Role-based permissions (beyond just admin/user)
- [ ] Email notifications for admin actions
