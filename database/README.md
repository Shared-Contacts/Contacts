# Database files

The SQL files that built the app's Supabase database, plus the reminders edge function.
They hold instructions only: no keys, and no one's contacts, log entries or money.

- `contacts-schema.sql`, `contacts-security.sql`: the first tables and their rules.
- `contacts-step3.sql` to `contacts-step37.sql`: each change since, in order. Already run.
- `contacts-step38.sql`: away-from-home colours on the calendar. Already run.
- `cc-01-schema.sql`, `cc-03-tighten-lookups.sql`: Calendar Club tables.
- The others are one-off tidy-ups and checks.
- `send-reminders.ts`: the edge function that sends reminders. Its keys live in
  Supabase's settings, never in this file.

Where a file says `YOUR-EMAIL-HERE`, put the owner's email in before running it.

Kept off GitHub on purpose because they contain personal data: the contact and
Daily Log imports, the Calendar Club data, step 19 and `rebuild-groups.sql`.
