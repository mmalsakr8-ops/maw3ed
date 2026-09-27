# Maw3ed | موعد

Cloudflare Worker + D1 restaurant booking SaaS.

## Files
- worker.js — complete application
- schema.sql — D1 schema
- wrangler.json — Worker/D1 binding

## Deploy
npx wrangler deploy

## D1
Database: maw3ed-db
ID: 74a8e883-df12-40e7-98b1-a1f6246fb4fa

The Worker also initializes missing tables automatically. The first registered account becomes `super_admin`; later accounts are restaurant admins.

Features: 14-day trial, restaurant profiles, custom public booking slug, tables/capacity, public bookings, booking statuses, admin renewal monthly/yearly, stop/reactivate, payment records and dashboard totals.

For production, replace SHA-256 passwords with a password KDF, add rate limiting/CSRF protection, and integrate a real payment/WhatsApp/SMS provider before charging customers.
