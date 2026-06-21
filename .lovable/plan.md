# Major Platform Upgrade Plan

This is a large, multi-area change. Calling it out so we agree on scope before I touch ~20+ files. I'll ship it in **one deployment** after you approve.

## 1. Authentication (real Supabase Auth)

Today `AuthModal` / `AppContext` store users in `localStorage` — that's a demo shell. I'll replace it with real Supabase Auth while keeping the same UI and the existing `profiles`, `wallets`, `user_roles`, `transactions`, `notifications`, `bank_details`, `withdrawals`, `login_activity` tables.

- Email/password signup + login through `supabase.auth`.
- Forgot-password + `/reset-password` page (Supabase recovery flow).
- Session restored via `onAuthStateChange`; `AppContext` reads `profiles` + `wallets` + `transactions` from DB instead of localStorage.
- Login & logout events written to `login_activity` (already exists).
- Admin account: `admin@gmail.com` / `admin@12345`. Note: the existing trigger auto-grants admin to `amurundestiny@gmail.com`. I'll **extend** it to also grant admin to `admin@gmail.com` (keeping the original admin intact). Username `admin` is stored on the profile; login itself uses the email (Supabase requirement). I'll add a small "username or email" helper so typing `admin` resolves to `admin@gmail.com`.

## 2. Multi-step registration with bank verify + OTP

New `RegisterWizard` modal flow:
1. Full name, email, phone, password
2. Bank name + account number
3. Verify bank (Paystack `resolve` via a new `paystack-resolve` edge function using the existing `PAYSTACK_SECRET_KEY`)
4. Show verified account name + bank + number
5. User confirms
6. **Then** call `supabase.auth.signUp` with `emailRedirectTo` — Supabase emails the 6-digit OTP / confirmation
7. OTP input screen with **60s countdown**, disabled resend, auto-dismissing toast after 30s; on success → `verifyOtp` → account active, bank row written to `bank_details`

OTP cannot be triggered before bank confirmation (enforced in wizard state machine).

## 3. Wallet + Withdrawals (admin-approved)

- Wallet page already exists; I'll wire it to real `wallets` table + `credit_wallet` RPC after Paystack verify (already implemented in `paystack-verify`).
- `Withdraw.tsx`: auto-load saved bank from `bank_details` (no re-entry), create row in `withdrawals` with status `processing`, insert admin notification.
- Admin `Withdrawals.tsx`: Approve → status `successful` + debit wallet; Reject → status `rejected` + refund. Both write `audit_logs` and notify the user.
- Receipts (already have `ReceiptDialog`) extended to include Txn ID, user, amount, date, status, bank, type — and reused for funding/withdraw/transfer.

## 4. Transactions page

Already exists; I'll make it read from `transactions` table with statuses Processing / Successful / Rejected and live-update via Realtime.

## 5. Admin real-time notifications

Insert into `notifications` (user_id = NULL = admin broadcast) on: register, login, logout, fund, withdraw request, transaction complete, profile update. Admin layout shows unread badge via Realtime subscription.

## 6. Admin dashboard

Wire existing admin pages to real data: totals, active users, new users (24h), total funding, pending/successful withdrawals, total txns. Users page → search + drill-down already scaffolded; I'll connect them to live queries.

## 7. Dashboard menu reorganization (item 15)

Reorder `ACTIONS` in `Dashboard.tsx` + `Navbar` mobile menu to: Home, Wallet, Fund Wallet, Transactions, History, Airtime, Data, Cable, Electricity, Education (new stub page kept minimal), Referrals (new stub), Notifications, Profile, Settings, Logout. Improved spacing/icons, fully responsive grid.

## 8. Remove ETH (item 16)

Delete `src/pages/EthConvert.tsx`, route, nav links, dashboard action, and the `eth` transaction-type branches (kept as historical read-only in transactions list so old records still render).

## 9. Admin password + settings (items 17–18)

Extend `src/pages/admin/Settings.tsx`:
- Change password (current → new → confirm; uses `supabase.auth.updateUser`, forces re-login, writes `audit_logs`).
- Update email (`updateUser({ email })` with re-verification).
- Notification preferences (stored in `app_settings`).
- Security log / login history / device activity tabs reading `login_activity` + `audit_logs`.

## 10. Responsive dropdowns

Audit dropdown/select components to add `max-h-[60vh] overflow-y-auto` and proper `side`/`align` so they never overflow on mobile.

---

## Technical notes

- New edge function: `paystack-resolve` (account verify). Uses existing `PAYSTACK_SECRET_KEY`.
- New migration:
  - Update `handle_new_user` trigger to also grant admin to `admin@gmail.com`.
  - Realtime publication for `notifications`, `withdrawals`, `transactions`.
  - `withdrawals` approve/reject RPCs (security definer, admin-only).
  - Tighten RLS where needed.
- New page: `/reset-password`.
- Removed: `EthConvert.tsx` + route + nav entry.
- The admin user (`admin@gmail.com` / `admin@12345`) will be created by you signing up once with those credentials after deploy — the trigger auto-promotes that email to admin. I cannot create auth users via migration safely.

## Out of scope / honest caveats

- "Education Payments" and "Referrals" don't exist today — I'll add **placeholder pages** wired into the nav so the menu order is complete, but the business logic for those is a separate build.
- Supabase Auth sends a confirmation **link or 6-digit code** depending on template; the OTP UI will use `verifyOtp({ type: 'signup' })` which works with the code template. If your project currently uses the magic-link template I'll switch to OTP.
- I will not weaken existing RLS or remove any current page besides ETH.

Approve and I'll execute the whole thing in one pass.