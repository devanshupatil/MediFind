# MediFind — Design Spec
**Date:** 2026-06-19

## Overview

MediFind is a website for a single medical shop that lets anyone search for medicines and instantly see whether they are in stock — without calling the shop. The shop keeper manages the inventory through a protected admin dashboard.

## Scope

- Single shop (not a multi-shop marketplace)
- Public search: open to everyone, no login required
- Admin panel: one shop keeper account, simple username + password

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Row Level Security)
- **Deployment:** Handled separately by the user

## Database

### `medicines` table

| Column | Type | Constraints |
|---|---|---|
| id | uuid | primary key, auto-generated |
| name | text | not null |
| price | numeric | not null |
| quantity | integer | not null, default 0 |
| created_at | timestamptz | default now() |

### Row Level Security

- **Public (anon):** SELECT only on `medicines`
- **Authenticated (admin):** SELECT, INSERT, UPDATE, DELETE on `medicines`

## Pages & Routes

### `/` — Public Search Page

- Top navigation bar with shop name and "MediFind" branding
- Search input at top; filters results live as the user types (no page reload)
- Results displayed as a list with:
  - Medicine name
  - Price (in ₹)
  - Badge: green "In Stock" or red "Out of Stock" (quantity = 0)
- Out of stock medicines are shown, not hidden
- Empty state shown when no results match the query

### `/admin/login` — Admin Login

- Simple form: Username (email) + Password fields
- On success: redirect to `/admin/dashboard`
- On failure: show error message
- Unauthenticated visits to `/admin/*` redirect here

### `/admin/dashboard` — Inventory Management (protected)

- **Stats row:** Total medicines / In Stock count / Out of Stock count
- **Search bar:** Filter the table client-side by medicine name
- **Add Medicine button:** Opens an inline form or modal with fields: Name, Price, Quantity
- **Medicines table columns:** Name | Price | Quantity | Actions (Edit, Delete)
  - Edit: opens pre-filled form to update the medicine
  - Delete: confirmation prompt before removing
- Logout button in the navigation bar

## Key Behaviours

- Live search on the public page (React state, no API call on every keystroke — debounce 300ms or fetch all on load and filter client-side given small inventory size)
- Protected routes: any visit to `/admin/*` without an active Supabase session redirects to `/admin/login`
- Add/Edit form validates that name is non-empty, price is a positive number, and quantity is a non-negative integer before submitting
- Delete requires a confirmation dialog ("Are you sure you want to delete [name]?")

## Out of Scope

- User accounts or login
- Medicine categories, manufacturer, expiry date
- Multiple shops
- Notifications or alerts
- Deployment configuration
