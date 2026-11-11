# Our Little Garden

A private, responsive memory-garden website for two invited people.

## Included
- Dreamy garden landing page with floating frames, hanging polaroids, flowers and firefly ambience.
- Email + password sign-in (Supabase Auth).
- Invite-only membership allowlist.
- Private photo storage and memory metadata with Row Level Security.
- Upload memories with title, date and story.

## Deploy path
This project lives at `/memory-garden/` in the existing GitHub Pages repository.

## Required private setup
1. Create a Supabase project.
2. Run `schema.sql` in Supabase SQL Editor.
3. Create a Storage bucket named `memories` and ensure it is PRIVATE.
4. In Authentication settings, turn OFF public sign-ups. Invite the two intended email addresses from Authentication > Users > Invite user.
5. After each invite is accepted, copy each user's UUID from Authentication > Users and insert the two exact UUID/email pairs into `public.garden_members` using the SQL comments at the end of `schema.sql`.
6. Copy the Project URL and anon/public key into the two constants near the top of `index.html`. Never use the service_role key.
7. In Supabase Auth URL settings, add the GitHub Pages URL to the allowed redirect URLs.

## Privacy notes
- GitHub Pages serves the public frontend only. It contains no personal photos or secrets.
- Actual photos are uploaded to the private Supabase Storage bucket; the app requests short-lived signed URLs after authentication.
- Database and Storage policies restrict access to the allowlisted members.
- The site is not fully private until Supabase is configured and both members are allowlisted.

## Local preview
Open `index.html` in a modern browser. Without Supabase configuration, the visual garden preview is shown and sign-in/upload actions explain that backend setup is pending.
