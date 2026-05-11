# TownServe — Local Service Marketplace
**Product Requirements Document (PRD) & 90-Day Execution Plan**

A mobile-first marketplace connecting small-town customers with local service providers (electricians, plumbers, tutors, cleaners, carpenters, painters, AC repair, beauticians).

---

## 1. MVP Definition

The smallest version that can transact:

1. **Customer** can register, browse 8 service categories, view providers, book a service for date/time/address, pay by Cash or Razorpay, leave a review.
2. **Provider** can register, list services with prices, accept/reject bookings, start & complete jobs, see earnings.
3. **Admin** can verify providers, view all users/bookings, and see platform stats.

No chat, no GPS tracking, no advanced filters in v1. Focus on the booking transaction.

---

## 2. Feature Breakdown

### A. Customer
- Email/password signup & login
- Home with category grid + featured providers
- Search by name/skill/city, filter by category
- Provider profile: bio, photo, services, ratings, reviews
- Book: pick service → date/time slot → address → notes → pay mode → confirm
- My Bookings (pending/confirmed/in-progress/completed/cancelled)
- Cancel pending bookings
- Rate (1-5 stars) after completion
- Profile + logout

### B. Provider
- Email/password signup (role: provider)
- Provider Dashboard with stats (pending, completed, earnings)
- Edit profile (bio, city)
- Add/delete services with title, description, price, category
- Manage incoming bookings: Accept / Reject / Start / Mark Complete
- Aggregated rating updated automatically from reviews

### C. Admin
- Dashboard with platform stats (users, customers, providers, verified, bookings, completed, reviews)
- Provider list with Verify/Unverify toggle
- All bookings list
- All users list

---

## 3. User Flows

### Customer journey
1. Open app → splash redirects to Login
2. Login or Sign Up (role: Customer)
3. Home → tap category or search bar
4. Search results → tap provider card
5. Provider detail → tap **Book** on a service
6. Booking flow: pick slot → enter address → notes → COD or Online → **Confirm**
7. Success modal → My Bookings
8. After provider marks complete → tap **Rate & review** → submit stars

### Provider journey
1. Sign Up as Provider → redirected to Provider Dashboard
2. Edit profile (city, bio) → Add services
3. Wait for customer bookings → notified via Bookings tab
4. Accept booking → Start job → Mark complete
5. Customer leaves review → provider's rating updates

### Admin journey
1. Login with seeded admin → Admin Panel
2. Overview tab: see stats
3. Providers tab: Verify pros (✅ badge appears in customer app)
4. Bookings tab: monitor activity

---

## 4. Database Design (MongoDB collections)

| Collection | Key Fields |
|---|---|
| `users` | id, name, email, password_hash, phone, role (customer/provider/admin), is_verified, created_at |
| `categories` | id, name, icon (lucide), order |
| `providers` | id (= user_id), user_id, name, bio, city, phone, photo_url, primary_category_id, services[ServiceItem], rating_avg, rating_count, is_verified, created_at |
| `services` (embedded in `providers.services`) | id, title, description, price, category_id |
| `bookings` | id, customer_id, customer_name, customer_phone, provider_id, provider_name, service_id, service_title, price, scheduled_at, address, notes, status, payment_mode, payment_status, razorpay_order_id, razorpay_payment_id, created_at |
| `reviews` | id, booking_id, customer_id, customer_name, provider_id, rating (1-5), comment, created_at |

Indexes: `users.email` unique, `providers.primary_category_id`, `bookings.customer_id`, `bookings.provider_id`.

---

## 5. Tech Stack

- **Frontend**: React Native + Expo SDK 54, Expo Router (file-based), lucide-react-native icons, axios, AsyncStorage, react-native-safe-area-context. (Android-first; iOS works out of the box.)
- **Backend**: FastAPI + Motor (async MongoDB), JWT (PyJWT) auth, bcrypt password hashing.
- **Database**: MongoDB.
- **Payments**: Razorpay (optional; falls back to Cash on Service).
- **Hosting**: Emergent preview → publish to Play Store via Emergent build pipeline.

**Why this stack:** fastest path from spec → working app, single-language frontend (TS), Python backend has tiny learning curve, MongoDB lets us evolve schemas without migrations as the catalog grows.

---

## 6. UI/UX Screens

Theme: **Organic & Earthy** (off-white #F8FAFC bg, deep navy #0F172A primary, warm amber #D97706 accent, success green #059669). Outfit + DM Sans fonts. 48px min touch targets. Bottom tabs with always-visible labels.

Screens implemented:
1. Splash / Index (redirects by role)
2. Login
3. Register (with Customer / Provider role picker)
4. Home (tabs/index): hero, category grid, featured providers
5. Search (tabs/search): search bar + category chips
6. Provider Detail: photo, bio, services, reviews
7. Booking flow (book/[providerId]): slot picker, address, payment
8. My Bookings (tabs/bookings): status timeline, actions
9. Profile (tabs/profile)
10. Provider Dashboard: stats, profile edit, services CRUD
11. Admin Panel: overview, providers, bookings (tabbed)

---

## 7. Monetization

For a small town, keep barriers ultra-low; charge providers only when they earn.

| Stream | Pricing | Notes |
|---|---|---|
| Commission per booking | 10% of service price | Auto-deducted from online payments. For COD, weekly settlement. |
| Lead fee (alt model) | ₹10–₹30 per accepted booking | Useful when commission unenforceable. |
| Featured listing | ₹199 / 7 days | Boost provider to top of category. |
| Verified Pro subscription | ₹99 / month | Unlimited bookings + verified badge + priority support. |
| Customer service fee | ₹15 flat | Optional, helps recover payment gateway cost. |

Target unit economics: avg ticket ₹500 × 10% = ₹50 take-rate per booking. Need ~200 bookings/month to cover ₹10k operating cost.

---

## 8. Trust & Safety

- **Provider verification** (Admin): manual ID + address proof check, then toggle `is_verified` → ✅ badge shown.
- **Reviews**: only customers with `completed` booking can review. Aggregate updated server-side. No edits, only one review per booking.
- **Cancellation rules**: customer can cancel only `pending`; provider can `reject` only `pending`. No-show policy: provider can mark `completed` only after `in_progress`.
- **Dispute handling (Phase 2)**: Admin can change any booking's status; refund processed manually via Razorpay dashboard.
- **PII**: phone number visible to the other party only after booking is `confirmed`.

---

## 9. Launch Strategy

### First 50 providers (offline-first)
1. Walk the local market in week 1 — pitch barbers, electricians, RO repair shops. Offer free onboarding + ₹500 sign-up bonus for first 5 completed jobs.
2. Partner with one local "kirana" association — give them ₹50 per provider they refer.
3. Print 200 flyers in local language with WhatsApp number + app QR. Stick them at electric-pole repair points & hardware shops.
4. Hold one Sunday workshop at a community hall — "Get more jobs from your phone." Onboard providers on the spot.

### First 100 customers
1. Run a hyperlocal Facebook / Instagram ad: ₹2,000 budget, radius 5km, "Find verified plumbers in <Town> in 60 seconds."
2. WhatsApp broadcast to residents' apartment groups with a ₹100-off first-booking coupon (`TOWN100`).
3. Tie up with 2 RWAs — offer "free 30-min electrician visit" on app for one weekend.
4. Drop 1,000 leaflets in mailboxes near high-rise apartments — clearer ROI than newspaper inserts in small towns.

### Online tactics
- SEO landing page per town (`townserve.in/<town>/plumber`).
- Google Business Profile + Google Maps presence per category.
- Referral: customer refers customer → both get ₹50 wallet credit.

---

## 10. 90-Day Execution Plan

| Week | Goal | Deliverables |
|---|---|---|
| 1 | Foundation | MVP app live (current build), 8 seeded categories, admin account |
| 2 | Provider onboarding offline | Onboard 15 providers, 5 services each |
| 3 | Customer-facing launch | First 20 customers, first 10 bookings |
| 4 | Iterate on UX | Fix top 5 issues from real users, add WhatsApp share for bookings |
| 5 | Payments live | Add Razorpay keys, enable online checkout, settle first commission |
| 6 | Verification at scale | Verify 40 providers; introduce featured-listing pilot (5 providers) |
| 7 | Marketing push | Run FB ads, hand out coupons; cross 100 customers |
| 8 | Trust loop | Force review prompt; resolve any disputes manually |
| 9 | Retention | Push notifications (provider: new booking; customer: reminder + review) |
| 10 | Provider self-service | Provider can edit price, pause/resume listings |
| 11 | Second-town test | Add `city` filter; do a 3-day blitz in a neighbouring town |
| 12 | Subscription pilot | Launch Verified Pro ₹99/mo with 10 providers |
| 13 | Report card | Measure: bookings/week, repeat-rate, take-rate; plan v2 |

---

## 11. Code Generation Structure (what's in this repo)

```
/app
├── backend/
│   ├── server.py            # FastAPI app: auth, providers, bookings, reviews, payments, admin
│   └── .env                 # MONGO_URL, JWT_SECRET, RAZORPAY_KEY_ID/SECRET, ADMIN_EMAIL/PASSWORD
├── frontend/
│   ├── app/
│   │   ├── _layout.tsx                 # Root layout w/ AuthProvider
│   │   ├── index.tsx                   # Splash + role-based redirect
│   │   ├── login.tsx
│   │   ├── register.tsx                # Role selector
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx             # Bottom tabs
│   │   │   ├── index.tsx               # Home
│   │   │   ├── search.tsx
│   │   │   ├── bookings.tsx
│   │   │   └── profile.tsx
│   │   ├── provider/[id].tsx           # Provider detail
│   │   ├── book/[providerId].tsx       # Booking flow
│   │   ├── provider-dashboard/index.tsx
│   │   └── admin/index.tsx
│   ├── src/
│   │   ├── api.ts             # axios + colors
│   │   └── auth.tsx           # AuthContext + JWT in AsyncStorage
│   └── .env                   # EXPO_PUBLIC_BACKEND_URL
└── /app/memory/test_credentials.md
```

### Backend API surface
- `POST /api/auth/register` `{name,email,phone,password,role}` → `{token,user}`
- `POST /api/auth/login` → `{token,user}`
- `GET /api/auth/me`
- `GET /api/categories`
- `GET /api/providers?category_id&q`
- `GET /api/providers/{id}`
- `GET|PUT /api/providers/me/profile`
- `POST|DELETE /api/providers/me/services[/{id}]`
- `POST|GET /api/bookings`, `GET /api/bookings/mine`, `GET /api/bookings/{id}`, `PATCH /api/bookings/{id}/status`
- `POST /api/reviews`, `GET /api/reviews/provider/{id}`
- `POST /api/payments/create-order?booking_id`, `POST /api/payments/verify` (Razorpay)
- `GET /api/admin/stats|providers|bookings|users`, `PATCH /api/admin/providers/{id}/verify`

### Test accounts
See `/app/memory/test_credentials.md`.

---

## Constraints honoured
- No overengineering: a single FastAPI process, file-based routing, no React state libraries.
- Speed > fancy: forms have one screen, slots are pre-generated buttons (no native picker hassles).
- Limited budget: zero paid SDKs in v1; Razorpay is optional and Cash-on-Service ships by default.
