# Admin Portal Guide

Complete documentation for the Mikoshi admin portal, including setup, features, and CRUD operations.

## Table of Contents
- [Setup & Access](#setup--access)
- [Dashboard Overview](#dashboard-overview)
- [CRUD Features](#crud-features)
- [Security](#security)
- [API Reference](#api-reference)

---

## Setup & Access

### 1. Add Admin Column to Database

Run the migration script:
```bash
cd backend
python migrations/add_is_admin_column.py
```

This adds the `is_admin` column to the `users` table.

### 2. Grant Admin Access

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

Then run the migration again.

### 3. Access Admin Portal

Once admin privileges are granted:

1. Log in to your account
2. Click on your profile dropdown in the sidebar
3. Click "Admin Panel" (only visible to admin users)
4. You'll be redirected to `/admin`

### Backend Security

**Admin Authentication:**
- All admin endpoints require valid session token + admin privileges
- Middleware protection via `get_current_admin_user` dependency
- Admins cannot delete themselves
- Admins cannot revoke their own admin status

---

## Dashboard Overview

The admin dashboard (`/admin`) provides real-time statistics and quick access to management pages.

### Statistics Display

**Real-time Counts:**
- **Users** - Total registered users
- **Characters** - Total characters created
- **Tags** - Total tags in system
- **Search Terms** - Total search keywords tracked
- **Invitation Codes** - Total active invitation codes

### Quick Actions

Each stat card includes a button to navigate to the management page:
- "Manage Users" → `/admin/users`
- "Manage Characters" → `/admin/characters`
- "Manage Tags" → `/admin/tags`
- "View Search Terms" → `/admin/search-terms`
- "Manage Invitations" → `/admin/invitations`
- "Manage Notifications" → `/admin/notifications`

---

## CRUD Features

### Users Management (`/admin/users`)

**Operations:**
- ✅ **Read** - View all users with details
- ✅ **Update** - Edit user name, bio, and admin status
- ✅ **Delete** - Remove users (except yourself)
- ❌ **Create** - Not implemented (users self-register)

**Editable Fields:**
- `name` - User's display name
- `bio` - User biography (multi-line)
- `is_admin` - Admin privileges (checkbox)

**Read-Only Fields:**
- Email
- Phone number
- User ID
- Registration date

**Features:**
- Edit modal with form validation
- Admin status toggle checkbox
- Confirmation dialogs for deletion
- Cannot delete self
- Cannot revoke own admin status

**API Endpoints:**
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/{id}` - Update user
- `DELETE /api/admin/users/{id}` - Delete user
- `PATCH /api/admin/users/{id}/toggle-admin` - Toggle admin status

---

### Characters Management (`/admin/characters`)

**Operations:**
- ✅ **Read** - View all characters with stats
- ✅ **Update** - Edit all character properties
- ✅ **Delete** - Remove characters
- ❌ **Create** - Not implemented (users create via main app)

**Editable Fields:**
- `name` - Character name (must be unique)
- `persona` - Personality description (multi-line)
- `tagline` - Short description
- `greeting` - Initial greeting message (multi-line)
- `example_messages` - Example conversation (multi-line)
- `tags` - Comma-separated tag list

**Read-Only Fields:**
- Character ID
- Creator
- Views count
- Likes count
- Creation date

**Features:**
- Multi-line text areas for long content
- Tags input with comma separation
- Character statistics display
- Creator information
- Confirmation before deletion

**API Endpoints:**
- `GET /api/admin/characters` - List all characters
- `PATCH /api/admin/characters/{id}` - Update character
- `DELETE /api/admin/characters/{id}` - Delete character

---

### Tags Management (`/admin/tags`)

**Operations:**
- ✅ **Create** - Create new tags
- ✅ **Read** - View all tags with usage statistics
- ✅ **Update** - Edit tag names
- ✅ **Delete** - Remove tags

**Editable Fields:**
- `name` - Tag name (must be unique)

**Statistics Display:**
- Usage count - Number of resources using this tag
- Likes count - Total likes on tagged resources
- Tag ID

**Features:**
- "Create Tag" button prominently displayed
- Tag usage statistics
- Duplicate name prevention
- Confirmation before deletion
- Create modal for new tags

**API Endpoints:**
- `GET /api/admin/tags` - List all tags with stats
- `POST /api/admin/tags` - Create new tag
- `PATCH /api/admin/tags/{id}` - Update tag
- `DELETE /api/admin/tags/{id}` - Delete tag

---

### Search Terms Management (`/admin/search-terms`)

**Operations:**
- ✅ **Read** - View search keywords with statistics
- ✅ **Delete** - Remove search terms
- ❌ **Create** - Auto-generated from user searches
- ❌ **Update** - Not applicable (read-only data)

**Display Fields:**
- Keyword - Search term text
- Count - Number of times searched
- Last Searched - Most recent search timestamp

**Features:**
- Search frequency tracking
- Date/time display
- Delete option for cleanup
- No edit functionality (auto-generated data)

**API Endpoints:**
- `GET /api/admin/search-terms` - List all search terms
- `DELETE /api/admin/search-terms/{keyword}` - Delete term

---

### Invitation Codes Management (`/admin/invitations`)

See [FEATURES.md](FEATURES.md#invitation-code-system) for detailed documentation.

**Key Features:**
- Generate codes with custom settings
- Track usage and statistics
- Revoke/reactivate codes
- View code status (Active, Expired, Exhausted, Revoked)

---

### System Notifications Management (`/admin/notifications`)

See [FEATURES.md](FEATURES.md#system-notifications) for detailed documentation.

**Key Features:**
- Create announcements for users
- Activate/deactivate notifications
- Edit notification content
- Only one active notification at a time

---

### Badge Management

**Manual Badge Awards:**
- Award "Pioneer" badge and other special badges to users
- Remove badges from users
- API endpoints for badge management

**API Endpoints:**
- `POST /api/admin/badges/{user_id}/award` - Award badge
  ```json
  Request: { "badge_key": "pioneer" }
  ```
- `POST /api/admin/badges/{user_id}/remove` - Remove badge
  ```json
  Request: { "badge_key": "pioneer" }
  ```

---

## Security

### Backend Protection

**Authentication & Authorization:**
- ✅ All admin endpoints require valid session token
- ✅ All requests verify admin privileges via `get_current_admin_user`
- ✅ Non-admin users receive 403 Forbidden
- ✅ Invalid tokens receive 401 Unauthorized

**Self-Protection:**
- ✅ Admins cannot delete themselves
- ✅ Admins cannot revoke their own admin status
- ✅ Other admins can modify any user

**Data Validation:**
- ✅ Unique constraint enforcement (character names, tag names)
- ✅ Required field validation
- ✅ Input sanitization
- ✅ Proper HTTP status codes (200, 201, 400, 403, 404, 500)

### Frontend Protection

**Route Protection:**
- ✅ Admin routes wrapped with `AdminRoute` component
- ✅ Automatic redirect to login if not authenticated
- ✅ Automatic redirect to home if not admin
- ✅ Session token sent with all requests

**User Experience:**
- ✅ Confirmation dialogs for destructive actions
- ✅ Error handling and user feedback
- ✅ Form validation before submission
- ✅ Clear success/failure messages

---

## API Reference

### Authentication

All admin endpoints require authentication:
```javascript
Headers: {
  'Authorization': sessionToken  // From localStorage
}
```

### Users API

**List Users:**
```http
GET /api/admin/users
Authorization: {session_token}

Response: [
  {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "bio": "User bio",
    "is_admin": false,
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

**Update User:**
```http
PATCH /api/admin/users/{user_id}
Authorization: {session_token}
Content-Type: application/json

Request: {
  "name": "Updated Name",
  "bio": "Updated bio",
  "is_admin": true
}

Response: {
  "message": "User updated successfully",
  "user": { /* updated user object */ }
}
```

**Delete User:**
```http
DELETE /api/admin/users/{user_id}
Authorization: {session_token}

Response: {
  "message": "User deleted successfully"
}
```

**Toggle Admin Status:**
```http
PATCH /api/admin/users/{user_id}/toggle-admin
Authorization: {session_token}

Response: {
  "message": "Admin status toggled successfully",
  "is_admin": true
}
```

### Characters API

**List Characters:**
```http
GET /api/admin/characters
Authorization: {session_token}

Response: [
  {
    "id": 1,
    "name": "Character Name",
    "persona": "Character personality",
    "tagline": "Short description",
    "tags": ["tag1", "tag2"],
    "views": 100,
    "likes": 50,
    "creator_name": "John Doe"
  }
]
```

**Update Character:**
```http
PATCH /api/admin/characters/{character_id}
Authorization: {session_token}
Content-Type: application/json

Request: {
  "name": "Updated Name",
  "persona": "Updated personality",
  "tagline": "Updated tagline",
  "greeting": "Updated greeting",
  "example_messages": "Updated examples",
  "tags": ["tag1", "tag2", "tag3"]
}

Response: {
  "message": "Character updated successfully"
}
```

**Delete Character:**
```http
DELETE /api/admin/characters/{character_id}
Authorization: {session_token}

Response: {
  "message": "Character deleted successfully"
}
```

### Tags API

**List Tags:**
```http
GET /api/admin/tags
Authorization: {session_token}

Response: [
  {
    "id": 1,
    "name": "fantasy",
    "usage_count": 25,
    "likes_count": 100
  }
]
```

**Create Tag:**
```http
POST /api/admin/tags
Authorization: {session_token}
Content-Type: application/json

Request: {
  "name": "new-tag"
}

Response: {
  "message": "Tag created successfully",
  "tag": { "id": 10, "name": "new-tag" }
}
```

**Update Tag:**
```http
PATCH /api/admin/tags/{tag_id}
Authorization: {session_token}
Content-Type: application/json

Request: {
  "name": "updated-tag-name"
}

Response: {
  "message": "Tag updated successfully"
}
```

**Delete Tag:**
```http
DELETE /api/admin/tags/{tag_id}
Authorization: {session_token}

Response: {
  "message": "Tag deleted successfully"
}
```

### Search Terms API

**List Search Terms:**
```http
GET /api/admin/search-terms
Authorization: {session_token}

Response: [
  {
    "keyword": "fantasy",
    "count": 42,
    "last_searched": "2025-01-15T10:30:00Z"
  }
]
```

**Delete Search Term:**
```http
DELETE /api/admin/search-terms/{keyword}
Authorization: {session_token}

Response: {
  "message": "Search term deleted successfully"
}
```

---

## UI Components

### Table Component (`admin/components/Table.jsx`)

**Features:**
- Displays data in sortable table format
- Edit and Delete buttons for each row
- Boolean values displayed as ✓/✗
- Arrays displayed as comma-separated values
- Responsive action buttons

**Usage:**
```jsx
<Table
  data={items}
  fields={fieldConfig}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

### EditModal Component (`admin/components/EditModal.jsx`)

**Features:**
- Dynamic form generation based on field configuration
- Multiple input types:
  - Text inputs
  - Textareas (multi-line)
  - Checkboxes
  - Tags (comma-separated)
- Form validation
- Save/Cancel actions

**Usage:**
```jsx
<EditModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onSave={handleSave}
  item={selectedItem}
  fields={fieldConfig}
  title="Edit User"
/>
```

---

## Troubleshooting

### "Failed to update/delete"

**Causes:**
- Session token invalid or expired
- User doesn't have admin privileges
- Network connectivity issues

**Solutions:**
1. Check browser console for detailed errors
2. Verify session token in localStorage
3. Verify user has `is_admin = true` in database
4. Ensure backend server is running
5. Check backend logs for errors

### Changes Not Appearing

**Causes:**
- Page not refreshed after edit
- Edit request failed silently
- Browser cache

**Solutions:**
1. Refresh the page after edits
2. Check for success/error alert messages
3. Verify data in database directly
4. Clear browser cache

### Cannot Edit Certain Fields

**This is intentional:**
- Some fields are read-only (email, ID, creation date)
- Admin status can only be changed by other admins
- User cannot edit their own admin status

### Access Denied

**Causes:**
- User is not logged in
- User doesn't have admin privileges
- Session token expired

**Solutions:**
1. Log in again
2. Verify admin status: `SELECT is_admin FROM users WHERE email = 'your@email.com';`
3. Ask another admin to grant admin privileges

---

## Best Practices

### For Administrators

**User Management:**
- Only grant admin privileges to trusted users
- Regularly audit admin user list
- Remove admin access when no longer needed
- Don't delete users unnecessarily (affects data integrity)

**Content Management:**
- Review characters/tags periodically
- Remove inappropriate content promptly
- Keep tags organized and consistent
- Monitor search terms for trends

**Data Cleanup:**
- Archive old search terms periodically
- Remove duplicate or unused tags
- Keep invitation codes organized with notes

### For Developers

**Adding New Admin Features:**
1. Create backend endpoint in `backend/routes/admin.py`
2. Add `get_current_admin_user` dependency
3. Implement proper validation and error handling
4. Create frontend page in `frontend/src/admin/`
5. Add route to admin navigation
6. Test thoroughly before deployment

**Security Considerations:**
- Always use `get_current_admin_user` for admin endpoints
- Validate all input data
- Use parameterized queries (prevent SQL injection)
- Log admin actions for audit trail
- Implement rate limiting for admin endpoints

---

## Future Enhancements

### High Priority
- [ ] Bulk operations (delete multiple items)
- [ ] Search/filter in tables
- [ ] Pagination for large datasets
- [ ] Column sorting (ascending/descending)
- [ ] Export data to CSV/JSON
- [ ] Admin action audit log

### Medium Priority
- [ ] User activity logs
- [ ] Character creation from admin panel
- [ ] Image upload/management
- [ ] Advanced filtering (date ranges, status)
- [ ] Undo delete functionality
- [ ] Email notifications for admin actions

### Low Priority
- [ ] Drag-and-drop table reordering
- [ ] Real-time updates (WebSocket)
- [ ] Dark mode for admin panel
- [ ] Keyboard shortcuts
- [ ] Batch import from CSV
- [ ] Dashboard analytics charts

---

## Summary

The admin portal provides:
- ✅ Complete CRUD operations for all resources
- ✅ 15+ API endpoints for management
- ✅ Interactive tables with edit/delete actions
- ✅ Reusable modal components
- ✅ Full security and validation
- ✅ Professional UI with Bootstrap styling
- ✅ Comprehensive error handling
- ✅ Statistics dashboard

All administrative tasks can be performed through the web interface without direct database access!

---

**Last Updated:** January 2026
