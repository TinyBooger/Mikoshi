# Mikoshi

## Migrations: Visibility, Forkable, and Pricing Flags

A migration script has been added to introduce the following fields:

- characters: `is_public` (bool), `is_forkable` (bool), `is_free` (bool)
- scenes: `is_public` (bool), `is_forkable` (bool)
- personas: `is_public` (bool), `is_forkable` (bool)

Defaults are private (false), non-forkable (false), and characters are free (true).

Run the migration (PostgreSQL):

```
python migrations/add_visibility_and_fork_flags.py
```

This script is idempotent and safe to run multiple times.
