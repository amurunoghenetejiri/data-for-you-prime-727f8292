## Data4Me Premium Upgrade Plan

This is a large, multi-area upgrade. I'll deliver it in **4 grouped phases** so each phase is testable. All work stays on the existing Lovable Cloud backend (already has `profiles`, `wallets`, `transactions`, `notifications`, `funding_requests`, `user_roles`).

---

### Phase 1 — Backend foundations (DB + Paystack)

New / updated tables (via migration, with GRANTs + RLS):
- `funding_requests` — extend with `bank`, `receipt_url`, `note`, `reviewed_at`
- `bank_details` — user_id, bank_name, account_number, account_name
- `chat_messages` — user_id, username, avatar_id, body, reply_to, created_at; admin can delete; muted users blocked via `chat_mutes`
- `chat_mutes` / `user_blocks` — admin moderation
- `login_activity` — user_id, ip, user_agent, event (login/logout), created_at
- `app_settings` (admin-only) — paystack_public_key, paystack_mode (test/live), opay account fields
- `withdrawals` — user_id, amount, bank snapshot, status
- Storage bucket `receipts` (private) + RLS so users upload own, admin reads all

Edge functions:
- `paystack-initialize` — creates transaction, returns auth URL (uses `PAYSTACK_SECRET_KEY` already in secrets)
- `paystack-verify` — verifies reference, credits wallet via existing `credit_wallet` RPC, dedupes by reference
- `admin-approve-funding` — admin-only, credits wallet on approval

Paystack mode toggle stored in `app_settings`, editable only by admin.

---

### Phase 2 — Auth, guest mode, persistence

- Rework `AppContext` to fully read from Supabase (profiles, wallets, transactions, notifications) instead of localStorage. Per-user data persists across logout/login automatically.
- **Guest mode**: when no session, wallet/cashback/funded/notifications all show ₦0.00 / empty / hidden. Profile sections hidden.
- Login errors show inline "Incorrect password. Please try again." without page reload.
- Logout confirmation dialog → redirect to Home and clear all in-memory state.
- Login welcome notification inserted into `notifications` table.
- Login activity logged to `login_activity`.

---

### Phase 3 — User-facing UI upgrades

- **Wallet / Funding page**: two large cards — "Fund via Bank Transfer" (Opay 8165906606, Jaskitinana, copy button, receipt upload to storage, status badges) and "Fund via Paystack" (amount input → initialize → redirect → verify → instant credit + toast).
- **Mobile registration**: convert AuthModal to scrollable sheet on mobile (`max-h-[90vh] overflow-y-auto`), ensures all fields reachable on 360px viewport.
- **Premium avatars**: swap DiceBear set to high-quality 3D-style avatar pack (DiceBear `personas` / `adventurer` with animated CSS — blink, idle bounce, wave on mount). Add male/female categorization and per-avatar greeting animation played 5–8s after login.
- **Dashboard welcome**: animated avatar top-left, randomized greeting card (5 variants), time-of-day greeting, sparkle/glow effects.
- **Bank Details page** (`/bank`): collect bank name, account number, account name; used by Withdrawals page.
- **Withdrawals page**: pulls saved bank, amount input, creates `withdrawals` row.
- **Promotions**: discount badges, bonus labels, countdown timer component on data plans.
- **Notification Center page** (`/notifications`): full list, mark-as-seen, auto-hide from navbar badge after 10 min (stored `seen_at`).
- **Community Chat page** (`/chat`): realtime via Supabase realtime on `chat_messages`, emoji picker, reply, @mentions, timestamps.
- **Footer**: replace copyright with `© Jaskiti D.O. — Computer Engineer, Delta State. All Rights Reserved.`

---

### Phase 4 — Admin console

Expand `/admin` (role-gated by `has_role(admin)`):
- **Receipts**: view all uploaded receipts (signed URLs), approve/reject, history preserved
- **Users panel**: click user → tabs for Transactions / Logins / Receipts / Profile / Bank / Referrals / Wallet / Cashback; Block/Unblock; Send private message
- **Announcements**: single user / multi-select / broadcast (writes to `notifications` with proper `user_id` or NULL for global)
- **Product management**: edit data plans / discounts / promo labels (stored in `app_settings.products` JSON, replacing hard-coded `src/lib/data.ts` reads with a fetch + fallback)
- **Paystack settings**: public key + mode toggle (secret key stays server-side)
- **Alert center**: feed of admin-targeted notifications (registrations, logins, fundings, purchases, contact messages)
- **Chat moderation**: delete message, mute/unmute, block user
- **Contact messages**: `contact_messages` table; admin reply writes to user notification

Hard route guard: non-admins navigating to `/admin*` get redirected to `/`.

---

### Technical notes

- All new tables follow the GRANT → RLS → POLICY pattern; admin access via `has_role(auth.uid(),'admin')`.
- Paystack secret already exists (`PAYSTACK_SECRET_KEY`). Public key entered by admin in settings.
- Avatars: use animated SVG/Lottie pack from DiceBear + CSS keyframes (blink, wave). No paid asset needed.
- Realtime chat via `supabase.channel().on('postgres_changes')`.
- Storage: private `receipts` bucket, signed URLs for admin viewing.

---

### Deliverables per phase

1. Migration + edge functions + storage bucket
2. Refactored `AppContext` + AuthModal scroll fix + logout dialog
3. New Wallet/Funding UI, Dashboard welcome, Bank, Withdrawals, Notifications, Chat, Promotions, Footer
4. Admin console expansion + route guard

I'll start with Phase 1 immediately after approval.