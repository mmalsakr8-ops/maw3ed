# Maw3ed | موعد

Cloudflare Workers + D1 restaurant booking SaaS.

## Included
- 14-day free trial.
- Restaurant registration/login by email or phone.
- Restaurant dashboard and custom booking URL `/r/<slug>`.
- Restaurant profile: phone, WhatsApp, address, working hours, logo, cover and description.
- Tables with capacity and active status.
- Public bookings with date/time/party size/customer phone/name, table selection and conflict checks.
- Booking statuses: pending, confirmed, completed, cancelled, rejected.
- Super Admin dashboard.
- Subscription renewal: 500 EGP monthly / 5000 EGP yearly.
- Manual payment records and financial report totals.
- Activate/stop restaurant service.

## Cloudflare
Worker: `maw3ed`
D1: `maw3ed-db`
Database ID: `74a8e883-df12-40e7-98b1-a1f6246fb4fa`
Deploy: `npx wrangler deploy`

The first account created becomes `super_admin`; later accounts are restaurant admins.
