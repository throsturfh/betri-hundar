/* Betri Hundar 6.08. Rate and consistency guard on players + cloud_saves.
   Keeps 6.07 seal/key behaviour. Does not rewrite existing balances on apply.
   Rejected progress writes are soft-clamped to the previous server values (or starter
   values on INSERT) so older clients keep working and honest local saves are not wiped. */
create or replace function public.bh_progress_implausible(o public.players, n public.players, is_insert boolean)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  dt double precision;
  coins_delta bigint;
  boards_delta int;
  dogs_delta int;
  reached_delta int;
  -- base allows one legitimate cheat-code grant (+100000) plus a cushion
  coins_base constant bigint := 150000;
  coins_per_min constant double precision := 2500;
  boards_base constant int := 3;
  boards_per_min constant double precision := 2;
  dogs_base constant int := 5;
  dogs_per_min constant double precision := 3;
  reached_base constant int := 3;
  reached_per_min constant double precision := 2;
  insert_coins constant bigint := 150000;
  insert_boards constant int := 5;
  insert_dogs constant int := 15;
  insert_reached constant int := 8;
begin
  if n.coins is null or n.boards_won is null or n.board_reached is null or n.dogs is null then
    return true;
  end if;
  if n.coins < 0 or n.boards_won < 0 or n.board_reached < 1 or n.dogs < 0 or n.stars < 0 or n.wins < 0 or n.losses < 0 then
    return true;
  end if;
  if is_insert then
    if n.coins > insert_coins or n.boards_won > insert_boards or n.dogs > insert_dogs or n.board_reached > insert_reached then
      return true;
    end if;
    if n.boards_won > 3 and coalesce(n.wins, 0) = 0 then
      return true;
    end if;
    if n.boards_won > greatest(coalesce(n.wins, 0) * 5, coalesce(n.wins, 0) + 5) then
      return true;
    end if;
    return false;
  end if;
  dt := greatest(extract(epoch from (now() - coalesce(o.last_played, o.first_seen, now()))) / 60.0, 0.25);
  coins_delta := greatest(n.coins - coalesce(o.coins, 0), 0);
  boards_delta := greatest(n.boards_won - coalesce(o.boards_won, 0), 0);
  dogs_delta := greatest(n.dogs - coalesce(o.dogs, 0), 0);
  reached_delta := greatest(n.board_reached - coalesce(o.board_reached, 1), 0);
  if coins_delta > coins_base + coins_per_min * dt then return true; end if;
  if boards_delta > boards_base + boards_per_min * dt then return true; end if;
  if dogs_delta > dogs_base + dogs_per_min * dt then return true; end if;
  if reached_delta > reached_base + reached_per_min * dt then return true; end if;
  if boards_delta > 0 and n.boards_won > 3 and coalesce(n.wins, 0) = 0 then return true; end if;
  if boards_delta > 0 and n.boards_won > greatest(coalesce(n.wins, 0) * 5, coalesce(n.wins, 0) + 5) then return true; end if;
  return false;
end $$;

create or replace function public.bh_players_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  presented text := nullif(current_setting('bh.key', true), '');
  stored text;
  starter public.players%rowtype;
begin
  if current_setting('bh.admin', true) = '1' then return new; end if;
  if new.player_id is null or char_length(new.player_id) < 1 or char_length(new.player_id) > 64 then
    raise exception 'bh player_id' using errcode = '22023';
  end if;
  new.name := left(regexp_replace(coalesce(new.name, ''), '[[:cntrl:]]', '', 'g'), 30);
  if tg_op = 'INSERT' and exists (select 1 from public.players p where p.player_id = new.player_id) then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    select k.player_key into stored from public.player_keys k where k.player_id = new.player_id;
    if stored is not null and presented is distinct from stored then
      raise exception 'bh key' using errcode = '42501';
    end if;
    new.sync_rev := old.sync_rev;
    new.sealed := old.sealed;
    new.reset_at := old.reset_at;
    new.first_seen := old.first_seen;
    new.last_played := now();
    if old.sealed or public.bh_progress_implausible(old, new, false) then
      new.name := old.name;
      new.version := old.version;
      new.board_reached := old.board_reached;
      new.boards_won := old.boards_won;
      new.stars := old.stars;
      new.wins := old.wins;
      new.losses := old.losses;
      new.daily_played := old.daily_played;
      new.daily_won := old.daily_won;
      new.dogs := old.dogs;
      new.coins := old.coins;
      new.yard := old.yard;
    end if;
    return new;
  end if;
  -- INSERT
  new.sync_rev := 0;
  new.sealed := false;
  new.reset_at := null;
  new.first_seen := coalesce(new.first_seen, now());
  new.last_played := now();
  if public.bh_progress_implausible(new, new, true) then
    new.board_reached := 1;
    new.boards_won := 0;
    new.stars := 0;
    new.wins := 0;
    new.losses := 0;
    new.daily_played := 0;
    new.daily_won := 0;
    new.dogs := 0;
    new.coins := 0;
    new.yard := null;
  end if;
  return new;
end $$;

create or replace function public.player_put(p_row jsonb, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.players%rowtype;
  before public.players%rowtype;
  id text := left(coalesce(p_row->>'player_id', ''), 80);
  existed boolean;
  clamped boolean := false;
begin
  if id is null or char_length(id) < 1 or char_length(id) > 64 then
    return jsonb_build_object('ok', false, 'error', 'player_id');
  end if;
  select * into before from public.players where player_id = id;
  existed := found;
  perform set_config('bh.key', coalesce(p_key, ''), true);
  insert into public.players (
    player_id, name, version, board_reached, boards_won, stars, wins, losses,
    daily_played, daily_won, dogs, coins, last_played, yard
  ) values (
    id,
    left(coalesce(p_row->>'name', ''), 30),
    left(coalesce(p_row->>'version', ''), 40),
    coalesce((p_row->>'board_reached')::int, 1),
    coalesce((p_row->>'boards_won')::int, 0),
    coalesce((p_row->>'stars')::int, 0),
    coalesce((p_row->>'wins')::int, 0),
    coalesce((p_row->>'losses')::int, 0),
    coalesce((p_row->>'daily_played')::int, 0),
    coalesce((p_row->>'daily_won')::int, 0),
    coalesce((p_row->>'dogs')::int, 0),
    coalesce((p_row->>'coins')::bigint, 0),
    now(),
    case when jsonb_typeof(p_row->'yard') = 'object' then p_row->'yard' else null end
  )
  on conflict (player_id) do update set
    name = excluded.name,
    version = excluded.version,
    board_reached = excluded.board_reached,
    boards_won = excluded.boards_won,
    stars = excluded.stars,
    wins = excluded.wins,
    losses = excluded.losses,
    daily_played = excluded.daily_played,
    daily_won = excluded.daily_won,
    dogs = excluded.dogs,
    coins = excluded.coins,
    last_played = excluded.last_played,
    yard = excluded.yard;
  select * into r from public.players where player_id = id;
  clamped := (coalesce((p_row->>'coins')::bigint, 0) is distinct from r.coins)
          or (coalesce((p_row->>'boards_won')::int, 0) is distinct from r.boards_won)
          or (coalesce((p_row->>'dogs')::int, 0) is distinct from r.dogs)
          or (coalesce((p_row->>'board_reached')::int, 1) is distinct from r.board_reached);
  return jsonb_build_object(
    'ok', true,
    'sealed', r.sealed,
    'clamped', clamped,
    'sync_rev', r.sync_rev,
    'coins', r.coins,
    'boards_won', r.boards_won,
    'stars', r.stars,
    'dogs', r.dogs,
    'wins', r.wins,
    'losses', r.losses,
    'board_reached', r.board_reached,
    'daily_played', r.daily_played,
    'daily_won', r.daily_won,
    'yard', r.yard
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'error', 'bad_number');
  when sqlstate '42501' then
    return jsonb_build_object('ok', false, 'error', 'key');
  when sqlstate '22023' then
    return jsonb_build_object('ok', false, 'error', 'player_id');
end $$;

create or replace function public.cloud_put(p_code text, p_key text, p_data jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Z0-9]', '', 'g'));
  existing public.cloud_saves%rowtype;
  dt double precision;
  old_coins bigint;
  new_coins bigint;
  old_dogs int;
  new_dogs int;
begin
  if char_length(c) < 8 or char_length(c) > 12 or p_key is null or char_length(p_key) < 16 then
    return false;
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 400000 then
    return false;
  end if;
  new_coins := coalesce((p_data->>'coins')::bigint, 0);
  new_dogs := case when jsonb_typeof(p_data->'album') = 'array' then jsonb_array_length(p_data->'album') else 0 end;
  if new_coins < 0 or new_dogs < 0 then return false; end if;
  select * into existing from public.cloud_saves where code = c;
  if not found then
    if new_coins > 150000 or new_dogs > 15 then return false; end if;
    insert into public.cloud_saves(code, wkey, data) values (c, p_key, p_data);
    return true;
  end if;
  if existing.wkey <> p_key then return false; end if;
  if existing.reset_gen > 0 then return false; end if;
  dt := greatest(extract(epoch from (now() - existing.updated_at)) / 60.0, 0.25);
  old_coins := coalesce((existing.data->>'coins')::bigint, 0);
  old_dogs := case when jsonb_typeof(existing.data->'album') = 'array' then jsonb_array_length(existing.data->'album') else 0 end;
  if greatest(new_coins - old_coins, 0) > 150000 + 2500 * dt then return false; end if;
  if greatest(new_dogs - old_dogs, 0) > 5 + 3 * dt then return false; end if;
  update public.cloud_saves set data = p_data, updated_at = now() where code = c and wkey = p_key;
  return true;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end $$;

revoke all on function public.bh_progress_implausible(public.players, public.players, boolean) from public, anon, authenticated;
revoke all on function public.bh_players_guard() from public, anon, authenticated;
revoke all on function public.player_put(jsonb, text) from public, anon, authenticated;
revoke all on function public.cloud_put(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.player_put(jsonb, text) to anon;
grant execute on function public.cloud_put(text, text, jsonb) to anon;
