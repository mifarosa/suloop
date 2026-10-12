-- The daily puzzle leaderboard, for a Supabase project (Postgres).
-- Run this once in the SQL editor, then build the game with
--   VITE_SUPABASE_URL=https://<project>.supabase.co
--   VITE_SUPABASE_ANON_KEY=<the project's anon public key>

create table if not exists public.daily_scores (
  day date not null,
  -- A random id made on the player's device; it tells players with the same name apart and
  -- keeps one score per player and day. It is never shown to others.
  player_id uuid not null,
  name text not null check (char_length(name) between 1 and 20),
  moves integer not null check (moves between 1 and 999),
  seconds integer not null check (seconds between 1 and 86400),
  stars smallint not null check (stars between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (day, player_id)
);

create index if not exists daily_scores_ranking on public.daily_scores (day, moves, seconds);

alter table public.daily_scores enable row level security;

-- Anyone can read the scores, but not the player ids.
create policy "Scores are public" on public.daily_scores for select using (true);
revoke select on public.daily_scores from anon;
grant select (day, name, moves, seconds, stars) on public.daily_scores to anon;

-- Anyone can add a score for a day close to today (time zones differ by up to a day), and
-- nobody can change or delete one.
create policy "Scores for today can be added" on public.daily_scores for insert
  with check (day between current_date - 1 and current_date + 1);
grant insert on public.daily_scores to anon;
