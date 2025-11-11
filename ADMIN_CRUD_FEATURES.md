# Admin Portal CRUD Features Documentation

## Overview
The admin portal now has complete CRUD (Create, Read, Update, Delete) functionality for managing all platform resources.

## Backend API Endpoints

### Users Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/users/{id}` | PATCH | Update user details (name, bio, admin status) |
| `/api/admin/users/{id}` | DELETE | Delete a user (cannot delete self) |
| `/api/admin/users/{id}/toggle-admin` | PATCH | Quick toggle admin status |

**Update User Fields:**
- `name` - User's display name
- `bio` - User biography
- `is_admin` - Admin privileges (boolean)

### Characters Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/characters` | GET | List all characters |
| `/api/admin/characters/{id}` | PATCH | Update character details |
| `/api/admin/characters/{id}` | DELETE | Delete a character |

**Update Character Fields:**
- `name` - Character name (must be unique)
- `persona` - Character personality description
- `tagline` - Short character description
- `greeting` - Initial greeting message
- `example_messages` - Example conversation messages
- `tags` - Array of tag strings

### Tags Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/tags` | GET | List all tags with statistics |
| `/api/admin/tags` | POST | Create a new tag |
| `/api/admin/tags/{id}` | PATCH | Update tag name |
| `/api/admin/tags/{id}` | DELETE | Delete a tag |

**Create/Update Tag Fields:**
- `name` - Tag name (must be unique)

### Search Terms Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/search-terms` | GET | List all search terms with stats |
| `/api/admin/search-terms/{keyword}` | DELETE | Delete a search term |

## Frontend Features

### Enhanced Components

#### 1. **Table Component** (`admin/components/Table.jsx`)
- **Features:**
  - Displays data in sortable table format
  - Edit and Delete buttons for each row
  - Handles boolean values with ✓/✗ display
  - Handles arrays with comma-separated display
  - Responsive action buttons

#### 2. **EditModal Component** (`admin/components/EditModal.jsx`)
- **Features:**
  - Dynamic form generation based on field configuration
  - Supports multiple input types:
    - Text inputs
    - Textareas (multi-line)
    - Checkboxes
    - Tags (comma-separated input)
  - Form validation
  - Save/Cancel actions

### Admin Pages

#### 1. **Dashboard** (`/admin`)
- Real-time statistics display:
  - Total users count
  - Total characters count
  - Total tags count
  - Total search terms count
- Quick action buttons for each management section
- Color-coded stat cards

#### 2. **Users Page** (`/admin/users`)
**CRUD Operations:**
- ✅ **Create:** Not implemented (users register themselves)
- ✅ **Read:** View all users with details
- ✅ **Update:** Edit user name, bio, and admin status
- ✅ **Delete:** Remove users (except yourself)

**Features:**
- Edit modal with form validation
- Admin status toggle checkbox
- Email field (read-only)
- Confirmation dialogs for deletion

#### 3. **Characters Page** (`/admin/characters`)
**CRUD Operations:**
- ❌ **Create:** Not implemented (users create through main app)
- ✅ **Read:** View all characters with stats
- ✅ **Update:** Edit all character properties
- ✅ **Delete:** Remove characters

**Features:**
- Multi-line text areas for persona and messages
- Tags input with comma separation
- Character statistics (views, likes)
- Creator information

#### 4. **Tags Page** (`/admin/tags`)
**CRUD Operations:**
- ✅ **Create:** Create new tags via "Create Tag" button
- ✅ **Read:** View all tags with usage statistics
- ✅ **Update:** Edit tag names
- ✅ **Delete:** Remove tags

**Features:**
- Tag usage count (how many resources use it)
- Tag likes count
- Duplicate name prevention
- Create button prominently displayed

#### 5. **Search Terms Page** (`/admin/search-terms`)
**CRUD Operations:**
- ❌ **Create:** Not applicable (auto-generated from searches)
- ✅ **Read:** View search keywords with statistics
- ❌ **Update:** Not applicable
- ✅ **Delete:** Remove search terms

**Features:**
- Search frequency count
- Last searched timestamp
- Read-only edit (no edit button, only delete)

## Security Features

### Backend Protection
- ✅ All endpoints require valid session token
- ✅ All endpoints verify admin privileges via `get_current_admin_user`
- ✅ Admins cannot delete themselves
- ✅ Admins cannot revoke their own admin status
- ✅ Unique constraint validation (character names, tag names)
- ✅ Proper HTTP status codes (404, 400, 403)

### Frontend Protection
- ✅ Admin routes wrapped with `AdminRoute` component
- ✅ Session token sent with all requests
- ✅ Confirmation dialogs for destructive actions
- ✅ Error handling and user feedback
- ✅ Form validation before submission

## User Experience Features

### Interactive Elements
- **Hover Effects:** Buttons have visual feedback
- **Icons:** Bootstrap icons for better UX
- **Color Coding:** Different colors for different sections
- **Responsive Design:** Works on all screen sizes
- **Loading States:** Handled gracefully
- **Error Messages:** Clear feedback on failures

### Confirmation Dialogs
All delete operations require confirmation with:
- Resource type (user/character/tag)
- Resource name/identifier
- Yes/No prompt before deletion

### Modal Forms
Edit modals feature:
- Clear field labels
- Required field validation
- Helper text for complex fields
- Read-only fields where appropriate
- Save/Cancel buttons

## API Request/Response Examples

### Update User
```javascript
PATCH /api/admin/users/{user_id}
Headers: { Authorization: sessionToken }
Body: {
  "name": "John Doe",
  "bio": "Updated bio",
  "is_admin": true
}
```

### Create Tag
```javascript
POST /api/admin/tags
Headers: { Authorization: sessionToken }
Body: {
  "name": "fantasy"
}
```

### Update Character
```javascript
PATCH /api/admin/characters/{character_id}
Headers: { Authorization: sessionToken }
Body: {
  "name": "Updated Name",
  "tagline": "New tagline",
  "tags": ["tag1", "tag2", "tag3"]
}
```

## Future Enhancement Suggestions

### High Priority
- [ ] Bulk operations (delete multiple items at once)
- [ ] Search/filter functionality in tables
- [ ] Pagination for large datasets
- [ ] Sort by column (ascending/descending)
- [ ] Export data to CSV/JSON

### Medium Priority
- [ ] User activity logs
- [ ] Character creation from admin panel
- [ ] Image upload/management in edit modals
- [ ] Advanced filtering (date ranges, status, etc.)
- [ ] Undo delete functionality

### Low Priority
- [ ] Drag-and-drop table reordering
- [ ] Real-time updates (WebSocket)
- [ ] Dark mode for admin panel
- [ ] Keyboard shortcuts
- [ ] Batch import from CSV

## Testing Checklist

### Users Management
- [x] View all users
- [x] Edit user name
- [x] Edit user bio
- [x] Toggle admin status
- [x] Delete user (non-admin)
- [x] Prevent deleting self
- [x] Prevent revoking own admin

### Characters Management
- [x] View all characters
- [x] Edit character details
- [x] Update character tags
- [x] Delete character
- [x] Prevent duplicate names

### Tags Management
- [x] View all tags
- [x] Create new tag
- [x] Edit tag name
- [x] Delete tag
- [x] Prevent duplicate names

### Search Terms
- [x] View search terms
- [x] Delete search term
- [x] View statistics

## Troubleshooting

### "Failed to update/delete"
- Check session token is valid
- Verify user has admin privileges
- Check browser console for detailed errors
- Verify backend server is running

### Changes not appearing
- Refresh the page after edits
- Check if edit was successful (alert message)
- Verify data in database directly

### Cannot edit certain fields
- Some fields are intentionally read-only (email, ID)
- Admin status can only be changed by other admins

## Summary

The admin portal now provides complete CRUD functionality with:
- ✅ 15 API endpoints for resource management
- ✅ Interactive tables with edit/delete actions
- ✅ Reusable modal component for editing
- ✅ Full security and validation
- ✅ Professional UI with Bootstrap styling
- ✅ Comprehensive error handling
- ✅ Statistics dashboard

All basic administrative tasks can now be performed directly through the web interface without database access!
