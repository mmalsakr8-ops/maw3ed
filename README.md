# MAW3ED | موعد

Smart restaurant booking SaaS on Cloudflare Workers + D1.

## Production
- Worker: `maw3ed`
- D1: `maw3ed-db`

## Included
- 14-day free trial
- Restaurant accounts
- First registered account becomes `super_admin`
- Restaurant admin dashboard
- Custom restaurant booking URL `/r/<slug>`
- Restaurant profile, logo/cover links, phone, WhatsApp, address, working hours
- Table management and capacity
- Public bookings with table-capacity and duplicate-table checks
- Booking status management
- Monthly plan: 500 EGP
- Yearly plan: 5000 EGP
- Manual renewal and payment records in super admin dashboard
- Stop/renew restaurant bookings
- Session login/logout compatible with the production D1 `sessions(token, user_id, expires_at)` schema

## Important
The production D1 database already has a `sessions` table whose primary key is `token`. Do not drop or recreate that table just to deploy this version. The worker intentionally uses `token`.
