# Daily Limits Quick Reference

## Run Migrations (Required)

```bash
cd backend

# Run all migrations in order:
python migrations/add_level_exp_system.py
python migrations/add_last_chat_date.py
python migrations/add_daily_exp_limits.py
```

## EXP Rewards & Limits

| Action | EXP | Daily Limit |
|--------|-----|-------------|
| 💬 Daily chat | +20 | 1/day |
| 🎭 Create character | +30 | 2/day |
| 🌄 Create scene | +15 | 2/day |
| 👤 Create persona | +15 | 2/day |
| ❤️ Character liked | +5 | 20/day |
| 🔄 Forked | +10 | No cap |
| 💰 Paid char sold | +50 | No cap |

## Daily EXP Caps

| Level | Cap/Day | Max Actions Example |
|-------|---------|---------------------|
| L1-L2 | 150 | 7-8 actions |
| L3-L4 | 300 | 15-16 actions |
| L5-L6 | 500 | 25-26 actions |

## API Endpoints

### Award EXP
```
POST /api/exp/gain
Body: { "action": "create_character" }
Returns: { "success": bool, "exp_added": int, "daily_exp_gained": int, ... }
```

### Check Limits
```
GET /api/exp/limits
Returns: { "daily_exp_gained": int, "daily_exp_cap": int, "daily_action_counts": {...}, ... }
```

## Response Codes

- **200**: EXP awarded successfully
- **429**: Daily limit reached (action limit or EXP cap)
- **400**: Invalid action
- **401**: Not authenticated

## Limit Error Messages

- `"Daily limit reached for create_character (2/day)"`
- `"Daily EXP cap reached (150 EXP/day for level 1)"`

## Testing Commands

```bash
# Test character creation limit (should fail on 3rd)
curl -X POST /api/create-character ... (repeat 3 times)

# Check current limits
curl -X GET /api/exp/limits -H "Authorization: $TOKEN"

# Manual reset (admin only)
psql -c "UPDATE users SET daily_exp_gained=0, daily_action_counts='{}' WHERE id='user_id';"
```

## Key Files

### Backend
- `backend/utils/level_system.py` - Central EXP logic
- `backend/routes/exp.py` - EXP API endpoints
- `backend/models.py` - User model with limit fields

### Frontend
- `frontend/src/utils/expUtils.js` - Client utilities
- `frontend/src/components/LevelProgress.jsx` - Display component

## Configuration

All limits are in `backend/utils/level_system.py`:

```python
# Daily EXP caps by level
DAILY_EXP_CAPS = {
    1: 150, 2: 150,
    3: 300, 4: 300,
    5: 500, 6: 500
}

# Daily action limits
DAILY_ACTION_LIMITS = {
    "daily_chat": 1,
    "create_character": 2,
    "create_scene": 2,
    "create_persona": 2,
    "character_liked": 20,
    "forked": None,
    "paid_char_sold": None
}
```

## Common Scenarios

### Scenario: User creates 2 characters
- ✅ 1st character: +30 EXP
- ✅ 2nd character: +30 EXP
- ❌ 3rd character: Error (limit: 2/day)

### Scenario: User at 140/150 daily EXP
- Action: Create character (+30 EXP)
- ✅ Result: +10 EXP (partial), total 150/150
- ❌ Next action: Error (cap reached)

### Scenario: Next day (after midnight UTC)
- ✅ All limits reset automatically
- ✅ daily_exp_gained = 0
- ✅ daily_action_counts = {}

## Monitoring Queries

```sql
-- Users hitting cap today
SELECT id, name, level, daily_exp_gained, daily_exp_cap
FROM users
WHERE daily_exp_gained >= daily_exp_cap;

-- Most active users today
SELECT id, name, daily_exp_gained, daily_action_counts
FROM users
ORDER BY daily_exp_gained DESC
LIMIT 10;

-- Users by level distribution
SELECT level, COUNT(*) as count
FROM users
GROUP BY level
ORDER BY level;
```

## Adjustment Guidelines

### If users complain limits are too strict:
1. Increase `DAILY_EXP_CAPS` by 50-100
2. Increase action limits by 1
3. Monitor for 1 week
4. Adjust again if needed

### If users are gaming the system:
1. Lower action limits
2. Lower EXP rewards for abused actions
3. Add cooldowns (requires code change)

### If engagement drops:
1. Add weekend bonus (2x cap)
2. Add streak rewards
3. Increase EXP for core actions

## Emergency Actions

### Manually reset user's limits:
```sql
UPDATE users 
SET daily_exp_gained = 0, 
    daily_action_counts = '{}'::jsonb 
WHERE id = 'user_id';
```

### Disable limits temporarily:
```python
# In level_system.py, set very high caps:
DAILY_EXP_CAPS = {1: 999999, 2: 999999, ...}
DAILY_ACTION_LIMITS = {"create_character": 999, ...}
```

### Check system health:
```sql
-- Users with unusual action counts
SELECT id, name, daily_action_counts
FROM users
WHERE jsonb_array_length(daily_action_counts::jsonb) > 5;

-- Users who might be blocked
SELECT COUNT(*) 
FROM users 
WHERE daily_exp_gained >= (
  CASE 
    WHEN level <= 2 THEN 150
    WHEN level <= 4 THEN 300
    ELSE 500
  END
);
```

---
**Quick Start**: Run migrations → Deploy → Monitor `/api/exp/limits`
