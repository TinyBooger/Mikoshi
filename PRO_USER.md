# Pro User System

The Pro User system enables paid subscriptions for premium features in Mikoshi.

## Database Schema

The following fields have been added to the `users` table:

- **`is_pro`** (Boolean, default: `false`): Indicates whether the user has an active Pro subscription
- **`pro_start_date`** (DateTime, nullable): When the user's Pro subscription started
- **`pro_expire_date`** (DateTime, nullable): When the Pro subscription expires

## Usage

### Helper Functions

The `user_utils.py` module provides several helper functions for managing Pro subscriptions:

#### `is_pro_active(user: User) -> bool`
Checks if a user's Pro subscription is currently active.

```python
from utils.user_utils import is_pro_active

if is_pro_active(user):
    # Grant Pro features
    pass
```

#### `upgrade_to_pro(user: User, db: Session, duration_days: int = 30) -> User`
Upgrades a user to Pro status.

```python
from utils.user_utils import upgrade_to_pro

# Upgrade user to Pro for 30 days
user = upgrade_to_pro(user, db, duration_days=30)

# Upgrade user to Pro for 1 year
user = upgrade_to_pro(user, db, duration_days=365)
```

If the user already has an active Pro subscription, it will be extended by the specified duration.

#### `downgrade_from_pro(user: User, db: Session) -> User`
Downgrades a user from Pro status.

```python
from utils.user_utils import downgrade_from_pro

user = downgrade_from_pro(user, db)
```

#### `check_and_expire_pro(user: User, db: Session) -> User`
Checks if a Pro subscription has expired and updates the status automatically.

```python
from utils.user_utils import check_and_expire_pro

# Check on login or before granting Pro features
user = check_and_expire_pro(user, db)
```

#### `get_pro_days_remaining(user: User) -> int`
Gets the number of days remaining in a Pro subscription.

```python
from utils.user_utils import get_pro_days_remaining

days_left = get_pro_days_remaining(user)
print(f"Your Pro subscription expires in {days_left} days")
```

## Migration

To add the Pro user fields to your existing database:

```bash
cd backend
python migrations/add_pro_user_fields.py
```

This will:
1. Add the `is_pro`, `pro_start_date`, and `pro_expire_date` columns to the `users` table
2. Set default values for existing users (`is_pro=false`, dates=null)
3. Verify the migration was successful

## API Integration

The Pro user fields are automatically included in the `UserOut` schema, so they will be returned in API responses:

```json
{
  "id": "user123",
  "name": "John Doe",
  "email": "john@example.com",
  "is_pro": true,
  "pro_start_date": "2026-01-15T10:30:00Z",
  "pro_expire_date": "2026-02-15T10:30:00Z",
  ...
}
```

## Implementation Checklist

- [x] Update User model with Pro fields
- [x] Update UserOut schema
- [x] Create migration script
- [x] Add helper functions for Pro management
- [ ] Add payment integration (Alipay)
- [ ] Create Pro upgrade endpoint
- [ ] Add Pro-only features
- [ ] Implement automatic expiration check middleware
- [ ] Add frontend UI for Pro status and upgrade
- [ ] Create admin tools for manually granting/revoking Pro status

## Pro Feature Examples

Here are some examples of how to implement Pro-only features:

### Restrict Feature to Pro Users

```python
from fastapi import HTTPException, status
from utils.user_utils import is_pro_active

@router.post("/premium-feature")
async def premium_feature(current_user: User = Depends(get_current_user)):
    if not is_pro_active(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature is only available to Pro users"
        )
    
    # Implement premium feature
    return {"message": "Premium feature accessed"}
```

### Grant Pro Benefits

```python
# Example: Pro users get higher limits
def get_daily_chat_limit(user: User) -> int:
    return 100 if is_pro_active(user) else 20

# Example: Pro users can create private characters
def can_create_private_character(user: User) -> bool:
    return is_pro_active(user)
```

## Testing

To test the Pro user system:

```python
# Test upgrading to Pro
user = upgrade_to_pro(user, db, duration_days=7)
assert user.is_pro == True
assert is_pro_active(user) == True

# Test days remaining
days = get_pro_days_remaining(user)
assert 6 <= days <= 7

# Test expiration check
user.pro_expire_date = datetime.now(UTC) - timedelta(days=1)
user = check_and_expire_pro(user, db)
assert user.is_pro == False
```

## Payment Integration

See [ALIPAY_INTEGRATION.md](ALIPAY_INTEGRATION.md) for details on integrating payment processing for Pro subscriptions.
