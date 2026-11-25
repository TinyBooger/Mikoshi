# Mikoshi Platform Features

A concise overview of all major features implemented in the Mikoshi platform.

## EXP & Level System
- Users earn EXP for actions and level up to unlock features.
- Daily EXP caps by level range.
- API endpoints for awarding EXP and checking limits.

## Badge System
- Earn badges for achievements and milestones.

## Invitation Code System
- Invite new users with codes; both inviter and invitee receive bonus credits.

## Sign-up Bonus
- Every new account receives a one-time 200-credit sign-up bonus (`SIGNUP_BONUS_CREDITS`), granted through `credit_wallet`.
- Granted on account creation in `POST /api/verify-phone` (短信登录/注册), the only sign-up path — the legacy `POST /api/users` and `POST /api/register-with-phone` endpoints have been removed.

## System Notifications
- In-app notifications for important events.

## Security Implementation
- Security features and best practices are enforced throughout the platform.
