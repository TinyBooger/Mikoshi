# System Notifications Feature

## Overview
The System Notifications feature allows admins to create and manage update notifications that appear to users in the application. This is perfect for announcing new features, alpha test updates, or important announcements.

## Features
- ✅ Create, edit, and delete notifications from admin panel
- ✅ Activate/deactivate notifications (only one can be active at a time)
- ✅ Add custom title, message, and feature bullet points
- ✅ Notifications appear once per session to avoid annoying users
- ✅ Users can manually re-open notifications via the megaphone icon
- ✅ Bilingual support (English and Chinese)
- ✅ Beautiful UI with portal rendering (appears on top of everything)

## How to Use

### For Admins

1. **Access Admin Panel**
   - Navigate to `/admin/notifications`
   - You'll see all created notifications

2. **Create a New Notification**
   - Click "Create New Notification" button
   - Fill in:
     - **Title**: e.g., "Alpha Test Updates"
     - **Message**: Main message to users
     - **Features**: Add bullet points for new features (optional)
   - Click "Create"
   - The notification will be created but NOT active yet

3. **Activate a Notification**
   - Click the "Activate" button next to a notification
   - This will automatically deactivate any other active notification
   - Users will now see this notification once per session

4. **Edit a Notification**
   - Click the pencil icon next to a notification
   - Update the content
   - Click "Update"

5. **Deactivate a Notification**
   - Click the "Deactivate" button on an active notification
   - Users will no longer see any notification

6. **Delete a Notification**
   - Click the trash icon next to a notification
   - Confirm the deletion

### For Users

- **Automatic Display**: When a notification is active, it will appear automatically once per browser session
- **Manual Access**: Click the megaphone icon (🔊) in the top-right corner to view the current notification anytime
- **Close**: Click the X button or "Got it!" to dismiss the notification

## Technical Details

### Backend

**New Database Table**: `system_notifications`
- `id`: Primary key
- `title`: Notification title
- `message`: Main message content
- `features`: Array of feature bullet points
- `is_active`: Boolean flag (only one can be true at a time)
- `created_by`: Admin user ID
- `created_at`: Timestamp
- `updated_at`: Timestamp

**API Endpoints**:
- `GET /api/notification/active` - Get the currently active notification (public)
- `GET /api/admin/notifications` - Get all notifications (admin only)
- `POST /api/admin/notifications` - Create a new notification (admin only)
- `PUT /api/admin/notifications/{id}` - Update a notification (admin only)
- `DELETE /api/admin/notifications/{id}` - Delete a notification (admin only)

### Frontend

**Components**:
- `UpdateNotificationModal.jsx` - The notification popup component
- `NotificationsPage.jsx` - Admin page for managing notifications

**State Management**:
- Uses `sessionStorage` to track if user has seen the notification this session
- Key: `hasSeenUpdateNotification`

**Locations**:
- Megaphone button in top-right of Topbar (next to problem report flag)
- Admin page at `/admin/notifications`

## Database Migration

The new `system_notifications` table will be automatically created when you restart the backend server (FastAPI auto-creates tables).

Alternatively, you can run the migration script manually:
```bash
cd backend
python migrations/add_system_notifications.py
```

## Translation Keys

### English (`en.json`)
```json
"update_notification": {
  "title": "Alpha Test Updates",
  "features_title": "What's New:",
  "feedback_message": "Found a bug or have suggestions? Click the flag icon to report issues!",
  "got_it": "Got it!"
}
```

### Chinese (`zh.json`)
```json
"update_notification": {
  "title": "Alpha 测试更新",
  "features_title": "最新功能：",
  "feedback_message": "发现 bug 或有建议？点击旗帜图标报告问题！",
  "got_it": "知道了！"
}
```

## Example Use Cases

1. **Alpha Test Welcome**
   - Title: "Welcome to Alpha Testing! 🎉"
   - Message: "Thank you for participating in our alpha test phase!"
   - Features: List of available features

2. **New Features Announcement**
   - Title: "New Features Released"
   - Message: "We've added some exciting new features!"
   - Features: Bullet points of new features

3. **Maintenance Notice**
   - Title: "Scheduled Maintenance"
   - Message: "We'll be performing maintenance on..."
   - Features: Downtime schedule, what to expect

## Best Practices

1. **Keep it concise** - Users should be able to read the notification in under 30 seconds
2. **Update regularly** - Change the notification when you have new updates
3. **One active at a time** - Only have one notification active to avoid confusion
4. **Test before activating** - Create and preview notifications before activating them
5. **Deactivate when outdated** - Remove old notifications that are no longer relevant

## Styling

The notification uses your app's theme colors:
- Primary color: `#736B92` (purple)
- Smooth animations and transitions
- Responsive design (works on mobile and desktop)
- High z-index (1300) to appear above everything
