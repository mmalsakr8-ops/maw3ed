# Maw3ed | موعد

Restaurant reservation SaaS built for Cloudflare Workers + D1.

## Included
- Super admin foundation
- Restaurant accounts
- 14-day free trial
- Restaurant public booking link `/r/<slug>`
- Tables/capacity
- Working hours
- Booking creation and status management
- Responsive Arabic RTL interface
- PBKDF2 password hashing

## First deployment
1. Create a Cloudflare D1 database named `maw3ed-db`.
2. Put its ID in `wrangler.toml`.
3. Deploy `worker.js`.
4. Run `schema.sql` against the D1 database if auto-init is not used.

The worker also initializes the required tables automatically on first request.
