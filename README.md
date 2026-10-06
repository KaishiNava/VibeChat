# VibeChat — Full Realtime Starter

VibeChat is a real Next.js + TypeScript + Supabase chat application.

## Included

- Phone OTP authentication
- Profiles / usernames / bios
- Blue verified badge using `public/verified-badge.png`
- Real 1-to-1 conversations stored in Supabase
- Realtime messages with Supabase Realtime
- Read receipts
- Presence typing indicator
- Contacts/search
- 24-hour text statuses
- Channels: create, follow/join, post
- Groups/channel-ready database
- Blocks/contacts database
- Storage bucket for media/avatar/status expansion
- RLS policies
- Vercel-ready

## Setup

1. Create a Supabase project.
2. Enable Phone provider in Authentication.
3. Run `supabase/schema.sql` in SQL Editor.
4. Copy `.env.example` to `.env.local`.
5. Fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
6. Run:
   ```bash
   npm install
   npm run dev
   ```
7. Push to GitHub and import into Vercel.
8. Add the same environment variables to Vercel.
9. Add the Vercel domain to Supabase Auth URL / redirect settings.

## Verification

`profiles.verified` is deliberately NOT writable by normal browser clients.
For testing/admin:
```sql
UPDATE public.profiles SET verified=true WHERE id='USER_UUID';
```

The supplied `public/verified-badge.png` is used next to verified profiles.

## Notes

The application is production-oriented but still a v1. Media messages, calls, push notifications, E2EE, moderation and a dedicated admin dashboard are intentionally left as the next phase.
