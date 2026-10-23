-- Betri Hundar 4.3: player statistics table for Supabase (run once in Supabase -> SQL Editor -> New query -> Run)
create table if not exists public.players (
  player_id     text primary key,              -- random id created on the player's phone (no account)
  name          text not null default '',
  version       text,
  board_reached int  default 1,
  boards_won    int  default 0,
  stars         int  default 0,
  wins          int  default 0,
  losses        int  default 0,
  daily_played  int  default 0,
  daily_won     int  default 0,
  dogs          int  default 0,
  coins         int  default 0,
  last_played   timestamptz default now(),
  first_seen    timestamptz default now()
);
alter table public.players enable row level security;
-- the game (anon key) may add and update rows and the stats page may read them; nobody can delete with the anon key
create policy "bh insert" on public.players for insert to anon with check (char_length(player_id) <= 64 and char_length(name) <= 30);
create policy "bh update" on public.players for update to anon using (true) with check (char_length(name) <= 30);
create policy "bh read"   on public.players for select to anon using (true);
