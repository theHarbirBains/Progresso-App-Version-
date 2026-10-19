# Database backups

Supabase's free plan keeps no backups, so a GitHub Actions workflow
([`.github/workflows/backup.yml`](../.github/workflows/backup.yml)) takes one every night.
It dumps the production database, encrypts the dump with a passphrase only you hold, and keeps
it for 30 days as a workflow artifact.

This repository is public. Artifacts can be downloaded by anyone who can see the repository's
Actions, which is why the dump is encrypted before upload. Without the passphrase it is
unreadable. Keep the passphrase long and random, and store it somewhere other than this
repository.

## What's in a backup

- `roles.sql`, `schema.sql` and `data.sql`, as made by `supabase db dump`: every account
  (`auth`), every table in `public`, and Storage's records of which files exist.
- **Not the photos themselves.** Profile, machine and food photos live in Supabase Storage,
  outside the database. A restored database still points at them, but if they're deleted from
  Storage, the backup can't bring them back.

## Setting it up (once)

Add two repository secrets in GitHub under Settings > Secrets and variables > Actions >
New repository secret:

| Secret              | What to put in it                                                                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_DB_URL`   | The **Session pooler** connection string from the Supabase dashboard (Connect > Session pooler), with your database password filled in. Use the pooler: GitHub's runners can't reach Supabase's direct connection, which is IPv6 only. |
| `BACKUP_PASSPHRASE` | A long random passphrase, saved in your password manager. You need it to restore.                                                                                                                                                      |

Then run the workflow once by hand, from Actions > Nightly database backup > Run workflow, and
check it finishes. Until both secrets are set, every nightly run fails with a message saying
so, and GitHub emails you about it.

## Getting a backup back

1. In GitHub, open Actions > Nightly database backup, pick a run, and download its artifact.
   GitHub hands it over as a `.zip` containing `progresso-<date>.tar.gz.gpg`.
2. Decrypt and unpack it (it asks for the passphrase):

   ```sh
   gpg --output backup.tar.gz --decrypt progresso-<date>.tar.gz.gpg
   mkdir backup && tar -xzf backup.tar.gz -C backup
   ```

3. Restore into a **new, empty** Supabase project (never on top of production), following
   Supabase's guide to restoring a `db dump`. With the new project's session pooler URL in
   `NEW_DB_URL`:

   ```sh
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file backup/roles.sql \
     --file backup/schema.sql \
     --command 'SET session_replication_role = replica' \
     --file backup/data.sql \
     --dbname "$NEW_DB_URL"
   ```

4. Point the API (Render) and the app at the new project only once you've checked the restored
   data.

Test a restore once, so you know it works before you need it.

## Before public release

Move to Supabase Pro for its daily backups and point-in-time recovery, and keep this workflow
as a second, independent copy.
