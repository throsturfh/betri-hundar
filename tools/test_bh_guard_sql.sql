/* Local-only proof that the 6.07 migration enforces the guard. Never run this against production. */
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public to anon, authenticated;
create table if not exists public.players (
  player_id text primary key,
  name text not null default '',
  version text,
  board_reached int default 1,
  boards_won int default 0,
  stars int default 0,
  wins int default 0,
  losses int default 0,
  daily_played int default 0,
  daily_won int default 0,
  dogs int default 0,
  coins int default 0,
  last_played timestamptz default now(),
  first_seen timestamptz default now(),
  yard jsonb
);
create table if not exists public.cloud_saves (
  code text primary key,
  wkey text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.players enable row level security;
alter table public.cloud_saves enable row level security;
drop policy if exists "bh insert" on public.players;
drop policy if exists "bh update" on public.players;
drop policy if exists "bh read" on public.players;
create policy "bh insert" on public.players for insert to anon with check (char_length(player_id) <= 64 and char_length(name) <= 30);
create policy "bh update" on public.players for update to anon using (true) with check (char_length(name) <= 30);
create policy "bh read" on public.players for select to anon using (true);
grant select, insert, update on public.players to anon;

\ir ../sql/6.07_anticheat.sql

insert into public.players (player_id, name, version, board_reached, boards_won, stars, wins, losses, daily_played, daily_won, dogs, coins, yard, last_played, first_seen)
values
  ('player-existing', 'Leikmaður', '6.06', 40, 39, 70, 36, 18, 4, 3, 39, 80000, '{"p53":{"won":[39],"st":70}}'::jsonb, now(), now() - interval '7 days'),
  ('someone-else', 'Annar', '6.06', 13, 12, 20, 12, 4, 1, 1, 12, 2222, null, now(), now());

/* legacy sync of the same balance is stored whole */
select public.player_put('{"player_id":"player-existing","name":"Leikmaður","version":"6.06","board_reached":40,"boards_won":39,"stars":70,"wins":36,"losses":18,"daily_played":4,"daily_won":3,"dogs":39,"coins":80000,"ack_rev":0}'::jsonb, null) as same_shape \gset
select (:'same_shape'::jsonb->>'coins')::int = 80000 and (:'same_shape'::jsonb->>'boards_won')::int = 39 as ok_board39 \gset
\if :ok_board39
  \echo OK board-39 shape
\else
  \echo FAIL board-39 shape
  \quit 1
\endif

/* instant multi-billion update is not stored */
update public.players set last_played = now() where player_id = 'player-existing';
select public.player_put('{"player_id":"player-existing","name":"Leikmaður","coins":2000000000,"boards_won":39,"stars":70,"dogs":39,"ack_rev":0}'::jsonb, null) as jumped \gset
select (:'jumped'::jsonb->>'coins')::int < 100000 as ok_jump \gset
\if :ok_jump
  \echo OK coin jump clamped
\else
  \echo FAIL coin jump
  \echo :jumped
  \quit 1
\endif

/* new identity cannot be born at multi-billion coins or 500 boards */
select public.player_put('{"player_id":"brand-new","name":"Nyr","coins":2000000000,"boards_won":500,"stars":99999,"dogs":9000,"yard":{"p53":{"won":[10000000,10000000],"st":999999}}}'::jsonb, 'device-key-0123456789abcd') as born \gset
select (:'born'::jsonb->>'coins')::int = 20000000 and (:'born'::jsonb->>'boards_won')::int = 100 and (:'born'::jsonb->>'stars')::int = 400 and (:'born'::jsonb->>'dogs')::int = 400 as ok_born \gset
\if :ok_born
  \echo OK new row clamped
\else
  \echo FAIL new row
  \echo :born
  \quit 1
\endif

/* wrong device key is rejected; matching key is accepted */
select public.player_put('{"player_id":"brand-new","name":"Nyr","coins":10,"boards_won":1,"ack_rev":0}'::jsonb, 'other-key-0123456789abcd') as badkey \gset
select :'badkey'::jsonb->>'error' = 'key' as ok_badkey \gset
\if :ok_badkey
  \echo OK key rejected
\else
  \echo FAIL key
  \echo :badkey
  \quit 1
\endif

/* targeted reset leaves the other player untouched */
select coins as other_before from public.players where player_id = 'someone-else' \gset
select public.bh_admin_reset('player-existing', null) as did_reset \gset
select coins as other_after from public.players where player_id = 'someone-else' \gset
select coins = 0 and boards_won = 0 and stars = 0 and dogs = 0 and yard is null and sync_rev = 1 as reset_ok from public.players where player_id = 'player-existing' \gset
\if :reset_ok
  \echo OK reset row
\else
  \echo FAIL reset row
  \quit 1
\endif
select :other_before = :other_after as other_ok \gset
\if :other_ok
  \echo OK other player preserved
\else
  \echo FAIL other player
  \quit 1
\endif

/* stale reupload without ack cannot restore the snapshot */
select public.player_put('{"player_id":"player-existing","name":"Leikmaður","coins":2000000000,"boards_won":100,"stars":300,"dogs":100,"wins":37,"losses":61,"ack_rev":0,"yard":{"p53":{"won":[100],"st":300,"dogs":[100]}}}'::jsonb, null) as stale \gset
select (:'stale'::jsonb->>'coins')::int = 0 and (:'stale'::jsonb->>'boards_won')::int = 0 and (:'stale'::jsonb->>'stars')::int = 0 and (:'stale'::jsonb->>'dogs')::int = 0 as ok_stale \gset
\if :ok_stale
  \echo OK stale upload frozen
\else
  \echo FAIL stale upload
  \echo :stale
  \quit 1
\endif

/* acked upload is limited to the post-reset burst, and a second call does not stack it */
select public.player_put('{"player_id":"player-existing","name":"Leikmaður","coins":2000000000,"boards_won":100,"stars":300,"dogs":100,"ack_rev":1}'::jsonb, null) as acked \gset
select (:'acked'::jsonb->>'boards_won')::int = 8 and (:'acked'::jsonb->>'coins')::int between 1000000 and 1005000 as ok_ack \gset
\if :ok_ack
  \echo OK acked burst
\else
  \echo FAIL acked burst
  \echo :acked
  \quit 1
\endif
select public.player_put('{"player_id":"player-existing","name":"Leikmaður","coins":2000000000,"boards_won":100,"ack_rev":1}'::jsonb, null) as again \gset
select (:'again'::jsonb->>'boards_won')::int = (:'acked'::jsonb->>'boards_won')::int and (:'again'::jsonb->>'coins')::int = (:'acked'::jsonb->>'coins')::int as ok_again \gset
\if :ok_again
  \echo OK burst does not stack
\else
  \echo FAIL stack
  \echo :again
  \quit 1
\endif

/* direct table write from the anon role is frozen the same way */
set role anon;
update public.players set coins = 2000000000, boards_won = 100, stars = 300, dogs = 100 where player_id = 'player-existing';
reset role;
select coins < 2000000 and boards_won <= 8 as ok_direct from public.players where player_id = 'player-existing' \gset
\if :ok_direct
  \echo OK direct anon update cannot restore the snapshot
\else
  \echo FAIL direct anon update
  \quit 1
\endif

select has_function_privilege('anon', 'public.bh_admin_reset(text,text)', 'execute') as anon_can_reset \gset
select has_function_privilege('anon', 'public.bh_admin_restore_backup(bigint)', 'execute') as anon_can_restore \gset
select has_function_privilege('anon', 'public.player_put(jsonb,text)', 'execute') as anon_can_put \gset
\if :anon_can_reset
  \echo FAIL anon can reset
  \quit 1
\endif
\if :anon_can_restore
  \echo FAIL anon can restore
  \quit 1
\endif
\if :anon_can_put
  \echo OK anon may sync but cannot administer
\else
  \echo FAIL anon lost player_put
  \quit 1
\endif

/* cloud write key and reset generation */
select public.cloud_put('ABCD2345', 'write-key-24-characters', '{"coins":1000,"stars":{"1":2}}'::jsonb) as made \gset
select public.cloud_put('ABCD2345', 'not-the-key-012345678', '{"coins":5,"stars":{}}'::jsonb) as denied \gset
\if :denied
  \echo FAIL wrong cloud key was accepted
  \quit 1
\else
  \echo OK wrong cloud key rejected
\endif
select public.bh_admin_reset('player-existing', 'ABCD2345') as reset_cloud \gset
select public.cloud_put('ABCD2345', 'write-key-24-characters', '{"coins":2000000000,"stars":{"1":9},"guardRev":0}'::jsonb) as stale_cloud \gset
\if :stale_cloud
  \echo FAIL stale cloud write accepted
  \quit 1
\else
  \echo OK stale cloud write rejected
\endif
select (data->>'coins')::int = 0 and reset_gen >= 1 as cloud_cleared from public.cloud_saves where code = 'ABCD2345' \gset
\if :cloud_cleared
  \echo OK cloud copy reset
\else
  \echo FAIL cloud copy reset
  \quit 1
\endif
