/* Betri Hundar 6.07 leaderboard and cloud guard.
   Apply once in the Supabase SQL editor as the database owner, before publishing 6.07.
   It does not update or delete any existing player row. A targeted reset is a separate call
   to bh_admin_reset, which the anon key cannot execute.
   Constants match tools/bh_guard.js. Published clients keep using the players table;
   the trigger is what rejects implausible and stale writes. */
create table if not exists public.player_keys (
  player_id text primary key references public.players(player_id) on delete cascade,
  player_key text not null check (char_length(player_key) between 16 and 80)
);
create table if not exists public.player_reset_backup (
  id bigint generated always as identity primary key,
  player_id text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.bh_rl (
  ip text not null,
  bucket timestamptz not null,
  n int not null default 0,
  primary key (ip, bucket)
);
alter table public.players add column if not exists sync_rev integer not null default 0;
alter table public.players add column if not exists reset_at timestamptz;
alter table public.cloud_saves add column if not exists reset_gen integer not null default 0;
alter table public.player_keys enable row level security;
alter table public.player_reset_backup enable row level security;
alter table public.bh_rl enable row level security;
revoke all on table public.player_keys from public, anon, authenticated;
revoke all on table public.player_reset_backup from public, anon, authenticated;
revoke all on table public.bh_rl from public, anon, authenticated;

create or replace function public.bh_mono(oldv integer, req integer, ceil integer) returns integer
language sql immutable as $$
  select least(greatest(greatest(0, coalesce(oldv, 0)), ceil), greatest(greatest(0, coalesce(oldv, 0)), greatest(0, coalesce(req, 0))));
$$;

create or replace function public.bh_cap_up(oldv integer, req integer, cap integer) returns integer
language sql immutable as $$
  select public.bh_mono(oldv, req, cap);
$$;

create or replace function public.bh_coin_normal(old_coins bigint, elapsed_sec numeric) returns bigint
language plpgsql immutable as $$
declare addc bigint;
begin
  if old_coins >= 200000000 then return old_coins; end if;
  addc := floor(24000000::numeric * greatest(0, coalesce(elapsed_sec, 0)) / 86400)::bigint;
  return least(200000000::bigint, greatest(0, old_coins) + addc);
end $$;

create or replace function public.bh_coin_reset(reset_at timestamptz, now_at timestamptz) returns bigint
language plpgsql immutable as $$
declare days numeric; burst bigint := 1000000;
begin
  days := greatest(0, extract(epoch from (coalesce(now_at, now()) - coalesce(reset_at, now_at, now())))) / 86400;
  return least(200000000::bigint, burst + floor(24000000::numeric * days)::bigint);
end $$;

create or replace function public.bh_phase_ceil(reset_at timestamptz, now_at timestamptz) returns integer
language plpgsql immutable as $$
declare days numeric;
begin
  days := greatest(0, extract(epoch from (coalesce(now_at, now()) - coalesce(reset_at, now_at, now())))) / 86400;
  return least(1000, 8 + floor(24::numeric * days)::int);
end $$;

create or replace function public.bh_clamp_yard(old_y jsonb, new_y jsonb, max_won integer) returns jsonb
language plpgsql immutable as $$
declare
  y jsonb; op jsonb; np jsonb; won int[] := array[]::int[]; oldw int[] := array[]::int[];
  dogs int[] := array[]::int[]; oldd int[] := array[]::int[]; i int; sm int; cap int; v int; dropn int;
  st int; oldst int; stcap int; dsum int; dcap int; s jsonb; so jsonb; med jsonb; medo jsonb;
  it int; yl int; cab int; ci int; mg int; sh int; shw int; wkw int; tight int; base int;
begin
  if new_y is null then return old_y; end if;
  if jsonb_typeof(new_y) <> 'object' then return old_y; end if;
  if octet_length(new_y::text) > 400000 then return old_y; end if;
  y := new_y; op := coalesce(old_y->'p53', '{}'::jsonb); np := y->'p53'; tight := max_won;
  if np is not null and jsonb_typeof(np) = 'object' then
    sm := 0;
    for i in 0..9 loop
      v := least(100, greatest(0, coalesce((op->'won'->>i)::int, 0)));
      oldw := oldw || v;
      v := greatest(v, least(100, greatest(0, coalesce((np->'won'->>i)::int, 0))));
      won := won || v; sm := sm + v;
    end loop;
    base := 0; for i in 1..10 loop base := base + oldw[i]; end loop;
    sm := 0; for i in 1..10 loop sm := sm + won[i]; end loop;
    cap := case when tight is null then 1000 else greatest(base, tight) end;
    for i in reverse 10..1 loop
      if sm > cap then
        dropn := least(won[i] - oldw[i], sm - cap);
        if dropn > 0 then won[i] := won[i] - dropn; sm := sm - dropn; end if;
      end if;
    end loop;
    dsum := 0;
    for i in 0..9 loop
      v := least(400, greatest(0, coalesce((op->'dogs'->>i)::int, 0)));
      oldd := oldd || v;
      v := greatest(v, least(400, greatest(0, coalesce((np->'dogs'->>i)::int, 0))));
      dogs := dogs || v; dsum := dsum + v;
    end loop;
    base := 0; for i in 1..10 loop base := base + oldd[i]; end loop;
    dcap := case when tight is null then 4000 else greatest(base, least(400, tight + 40)) end;
    for i in reverse 10..1 loop
      if dsum > dcap then
        dropn := least(dogs[i] - oldd[i], dsum - dcap);
        if dropn > 0 then dogs[i] := dogs[i] - dropn; dsum := dsum - dropn; end if;
      end if;
    end loop;
    oldst := greatest(0, coalesce((op->>'st')::int, 0));
    st := least(4000, greatest(0, coalesce((np->>'st')::int, 0)));
    stcap := case when tight is null then greatest(4000, oldst) else greatest(oldst, least(4000, sm * 3 + 30)) end;
    st := least(stcap, greatest(oldst, st));
    y := jsonb_set(y, '{p53}', coalesce(np, '{}'::jsonb) || jsonb_build_object(
      'won', to_jsonb(won), 'dogs', to_jsonb(dogs), 'st', st, 'tot', dsum,
      'cp', least(8, greatest(-1, coalesce((np->>'cp')::int, -1))),
      'b', least(100, greatest(1, coalesce((np->>'b')::int, 1)))
    ), true);
  end if;
  if y ? 's531' and jsonb_typeof(y->'s531') = 'object' then
    s := y->'s531'; so := coalesce(old_y->'s531', '{}'::jsonb); med := coalesce(s->'med', '{}'::jsonb); medo := coalesce(so->'med', '{}'::jsonb);
    if tight is null then
      it := public.bh_cap_up(coalesce((so->>'it')::int, 0), coalesce((s->>'it')::int, 0), 400);
      yl := public.bh_cap_up(coalesce((so->>'yl')::int, 0), coalesce((s->>'yl')::int, 0), 21);
      cab := public.bh_cap_up(coalesce((so->>'cab')::int, 0), coalesce((s->>'cab')::int, 0), 50);
      ci := public.bh_cap_up(coalesce((so->>'ci')::int, 0), coalesce((s->>'ci')::int, 0), 500);
      mg := public.bh_cap_up(coalesce((so->>'mg')::int, 0), coalesce((s->>'mg')::int, 0), 100000);
      sh := public.bh_cap_up(coalesce((so->>'sh')::int, 0), coalesce((s->>'sh')::int, 0), 10000);
      wkw := public.bh_cap_up(coalesce((so->>'wkw')::int, 0), coalesce((s->>'wkw')::int, 0), 520);
      y := jsonb_set(y, '{s531}', jsonb_build_object(
        'v', 1, 'it', it, 'yl', yl, 'cab', cab, 'ci', ci, 'mg', mg, 'sh', sh,
        'shw', least(sh, public.bh_cap_up(coalesce((so->>'shw')::int, 0), coalesce((s->>'shw')::int, 0), 10000)),
        'wkw', wkw,
        'med', jsonb_build_object(
          'g', public.bh_cap_up(coalesce((medo->>'g')::int, 0), coalesce((med->>'g')::int, 0), 10000),
          's', public.bh_cap_up(coalesce((medo->>'s')::int, 0), coalesce((med->>'s')::int, 0), 10000),
          'b', public.bh_cap_up(coalesce((medo->>'b')::int, 0), coalesce((med->>'b')::int, 0), 10000)
        )
      ), true);
    else
      it := public.bh_cap_up(coalesce((so->>'it')::int, 0), coalesce((s->>'it')::int, 0), 20 + tight);
      yl := public.bh_cap_up(coalesce((so->>'yl')::int, 0), coalesce((s->>'yl')::int, 0), 1 + least(3, tight));
      cab := public.bh_cap_up(coalesce((so->>'cab')::int, 0), coalesce((s->>'cab')::int, 0), 4 + tight);
      ci := public.bh_cap_up(coalesce((so->>'ci')::int, 0), coalesce((s->>'ci')::int, 0), 20 + tight);
      mg := public.bh_cap_up(coalesce((so->>'mg')::int, 0), coalesce((s->>'mg')::int, 0), 10 + tight * 2);
      sh := public.bh_cap_up(coalesce((so->>'sh')::int, 0), coalesce((s->>'sh')::int, 0), 4 + tight);
      wkw := public.bh_cap_up(coalesce((so->>'wkw')::int, 0), coalesce((s->>'wkw')::int, 0), 1 + floor(tight / 8.0)::int);
      y := jsonb_set(y, '{s531}', jsonb_build_object(
        'v', 1, 'it', it, 'yl', yl, 'cab', cab, 'ci', ci, 'mg', mg, 'sh', sh,
        'shw', least(sh, public.bh_cap_up(coalesce((so->>'shw')::int, 0), coalesce((s->>'shw')::int, 0), 4 + tight)),
        'wkw', wkw,
        'med', jsonb_build_object(
          'g', public.bh_cap_up(coalesce((medo->>'g')::int, 0), coalesce((med->>'g')::int, 0), 2 + tight),
          's', public.bh_cap_up(coalesce((medo->>'s')::int, 0), coalesce((med->>'s')::int, 0), 2 + tight),
          'b', public.bh_cap_up(coalesce((medo->>'b')::int, 0), coalesce((med->>'b')::int, 0), 2 + tight)
        )
      ), true);
    end if;
  end if;
  if y ? 'wk' then
    if jsonb_typeof(y->'wk') = 'object' and coalesce(y->'wk'->>'w', '') ~ '^\d{4}-V\d\d$' then
      y := jsonb_set(y, '{wk}', jsonb_build_object(
        'w', y->'wk'->>'w',
        'won', least(1, greatest(0, coalesce((y->'wk'->>'won')::int, 0))),
        'st', least(3, greatest(0, coalesce((y->'wk'->>'st')::int, 0))),
        'mv', least(5000, greatest(0, coalesce((y->'wk'->>'mv')::int, 0))),
        't', least(7200, greatest(0, coalesce((y->'wk'->>'t')::int, 0))),
        'n', least(1000, greatest(0, coalesce((y->'wk'->>'n')::int, 0)))
      ), true);
    else y := y - 'wk'; end if;
  end if;
  return y;
end $$;

create or replace function public.bh_clamp_stars(old_m jsonb, new_m jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; o int; r int; out jsonb := '{}'::jsonb;
begin
  if new_m is null or jsonb_typeof(new_m) <> 'object' then return coalesce(old_m, '{}'::jsonb); end if;
  for k in select jsonb_object_keys(new_m) loop
    o := greatest(0, coalesce((old_m->>k)::int, 0));
    r := greatest(0, coalesce((new_m->>k)::int, 0));
    out := out || jsonb_build_object(k, least(greatest(3, o), greatest(o, r)));
  end loop;
  return out;
end $$;

create or replace function public.bh_players_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ack int := coalesce(nullif(current_setting('bh.ack', true), ''), '0')::int;
  presented text := nullif(current_setting('bh.key', true), '');
  stored text; elapsed numeric := 0; reset_mode boolean; days numeric; board_ceil int; phase_ceil int;
  coin_ceil bigint; star_ceil int; dog_ceil int; daily_ceil int; win_ceil int; req_coins bigint; old_coins bigint;
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
    new.reset_at := old.reset_at;
    new.first_seen := old.first_seen;
    new.last_played := now();
    if old.sync_rev > ack then
      new.board_reached := old.board_reached; new.boards_won := old.boards_won; new.stars := old.stars;
      new.wins := old.wins; new.losses := old.losses; new.daily_played := old.daily_played; new.daily_won := old.daily_won;
      new.dogs := old.dogs; new.coins := old.coins; new.yard := old.yard;
      return new;
    end if;
    reset_mode := old.sync_rev > 0;
    days := case when reset_mode then greatest(0, extract(epoch from (now() - coalesce(old.reset_at, now())))) / 86400 else 0 end;
    elapsed := greatest(0, extract(epoch from (now() - coalesce(old.last_played, now()))));
    phase_ceil := case when reset_mode then public.bh_phase_ceil(old.reset_at, now()) else 1000 end;
    board_ceil := case when reset_mode then least(100, phase_ceil) else greatest(100, old.boards_won) end;
    coin_ceil := case when reset_mode then public.bh_coin_reset(old.reset_at, now()) else public.bh_coin_normal(old.coins::bigint, elapsed) end;
    star_ceil := case when reset_mode then least(400, board_ceil * 3) else greatest(400, old.stars) end;
    dog_ceil := case when reset_mode then least(400, board_ceil + 40) else greatest(400, old.dogs) end;
    daily_ceil := case when reset_mode then least(5000, greatest(2, floor(days)::int + 2)) else greatest(5000, old.daily_played) end;
    win_ceil := case when reset_mode then least(100000, board_ceil * 5 + 20) else greatest(100000, old.wins, old.losses) end;
    new.boards_won := public.bh_mono(old.boards_won, new.boards_won, board_ceil);
    new.stars := public.bh_mono(old.stars, new.stars, greatest(star_ceil, old.stars));
    new.dogs := public.bh_mono(old.dogs, new.dogs, greatest(dog_ceil, old.dogs));
    new.daily_played := public.bh_mono(old.daily_played, new.daily_played, greatest(daily_ceil, old.daily_played));
    new.daily_won := public.bh_mono(old.daily_won, new.daily_won, new.daily_played);
    new.wins := public.bh_mono(old.wins, new.wins, greatest(win_ceil, old.wins));
    new.losses := public.bh_mono(old.losses, new.losses, greatest(win_ceil, old.losses));
    new.board_reached := least(100, greatest(1, coalesce(new.board_reached, old.board_reached)));
    req_coins := least(2147483647::bigint, greatest(0::bigint, coalesce(new.coins, 0)::bigint));
    old_coins := greatest(0, coalesce(old.coins, 0))::bigint;
    new.coins := case when req_coins <= old_coins then req_coins else least(req_coins, coin_ceil) end;
    new.yard := public.bh_clamp_yard(old.yard, coalesce(new.yard, old.yard), case when reset_mode then phase_ceil else null end);
    return new;
  end if;
  new.sync_rev := 0; new.reset_at := null; new.first_seen := coalesce(new.first_seen, now()); new.last_played := now();
  new.version := left(coalesce(new.version, ''), 40);
  new.board_reached := least(100, greatest(1, coalesce(new.board_reached, 1)));
  new.boards_won := least(100, greatest(0, coalesce(new.boards_won, 0)));
  new.stars := least(400, greatest(0, coalesce(new.stars, 0)));
  new.wins := least(100000, greatest(0, coalesce(new.wins, 0)));
  new.losses := least(100000, greatest(0, coalesce(new.losses, 0)));
  new.daily_played := least(5000, greatest(0, coalesce(new.daily_played, 0)));
  new.daily_won := least(new.daily_played, greatest(0, coalesce(new.daily_won, 0)));
  new.dogs := least(400, greatest(0, coalesce(new.dogs, 0)));
  new.coins := least(20000000, greatest(0, coalesce(new.coins, 0)));
  new.yard := public.bh_clamp_yard(null, new.yard, null);
  return new;
end $$;

create or replace function public.bh_players_bind() returns trigger
language plpgsql security definer set search_path = public as $$
declare presented text := nullif(current_setting('bh.key', true), '');
begin
  if presented is not null and char_length(presented) between 16 and 80 then
    insert into public.player_keys(player_id, player_key) values (new.player_id, presented)
    on conflict (player_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists bh_players_guard on public.players;
create trigger bh_players_guard before insert or update on public.players
for each row execute function public.bh_players_guard();
drop trigger if exists bh_players_bind on public.players;
create trigger bh_players_bind after insert on public.players
for each row execute function public.bh_players_bind();

create or replace function public.player_put(p_row jsonb, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.players%rowtype; id text := left(coalesce(p_row->>'player_id', ''), 80);
begin
  if id is null or char_length(id) < 1 or char_length(id) > 64 then
    return jsonb_build_object('ok', false, 'error', 'player_id');
  end if;
  perform set_config('bh.key', coalesce(p_key, ''), true);
  perform set_config('bh.ack', coalesce(p_row->>'ack_rev', '0'), true);
  insert into public.players (player_id, name, version, board_reached, boards_won, stars, wins, losses, daily_played, daily_won, dogs, coins, last_played, yard)
  values (
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
    least(greatest(coalesce((p_row->>'coins')::numeric, 0), 0), 2147483647)::int,
    now(),
    case when jsonb_typeof(p_row->'yard') = 'object' then p_row->'yard' else null end
  )
  on conflict (player_id) do update set
    name = excluded.name, version = excluded.version, board_reached = excluded.board_reached,
    boards_won = excluded.boards_won, stars = excluded.stars, wins = excluded.wins, losses = excluded.losses,
    daily_played = excluded.daily_played, daily_won = excluded.daily_won, dogs = excluded.dogs,
    coins = excluded.coins, last_played = excluded.last_played, yard = excluded.yard;
  select * into r from public.players where player_id = id;
  return jsonb_build_object('ok', true, 'sync_rev', r.sync_rev, 'coins', r.coins, 'boards_won', r.boards_won, 'stars', r.stars, 'dogs', r.dogs, 'wins', r.wins, 'losses', r.losses, 'board_reached', r.board_reached, 'daily_played', r.daily_played, 'daily_won', r.daily_won, 'reset_at', r.reset_at, 'yard', r.yard);
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
  existing public.cloud_saves%rowtype; gen int; client_gen int; old_coins bigint; req bigint; elapsed numeric; coins bigint;
begin
  if c is null or char_length(c) < 8 or char_length(c) > 12 or p_key is null or char_length(p_key) < 16 then return false; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 400000 then return false; end if;
  select * into existing from public.cloud_saves where code = c;
  if not found then
    coins := least(20000000, greatest(0, coalesce((p_data->>'coins')::numeric, 0)))::bigint;
    p_data := jsonb_set(p_data, '{coins}', to_jsonb(coins), true);
    p_data := jsonb_set(p_data, '{stars}', public.bh_clamp_stars('{}'::jsonb, coalesce(p_data->'stars', '{}'::jsonb)), true);
    insert into public.cloud_saves(code, wkey, data) values (c, p_key, p_data);
    return true;
  end if;
  if existing.wkey <> p_key then return false; end if;
  gen := existing.reset_gen; client_gen := coalesce((p_data->>'guardRev')::int, 0);
  if gen > 0 and client_gen < gen then return false; end if;
  elapsed := greatest(0, extract(epoch from (now() - existing.updated_at)));
  old_coins := greatest(0, coalesce((existing.data->>'coins')::numeric, 0))::bigint;
  req := least(2147483647::bigint, greatest(0::bigint, coalesce((p_data->>'coins')::numeric, 0)::bigint));
  coins := case when req <= old_coins then req else least(req, public.bh_coin_normal(old_coins, elapsed)) end;
  p_data := jsonb_set(p_data, '{coins}', to_jsonb(coins), true);
  p_data := jsonb_set(p_data, '{stars}', public.bh_clamp_stars(coalesce(existing.data->'stars', '{}'::jsonb), coalesce(p_data->'stars', '{}'::jsonb)), true);
  update public.cloud_saves set data = p_data, updated_at = now() where code = c and wkey = p_key;
  return true;
exception when others then
  return false;
end $$;

create or replace function public.cloud_get(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Z0-9]', '', 'g'));
  headers jsonb; ip text; bucket timestamptz; hits int;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
    ip := left(split_part(coalesce(headers->>'x-forwarded-for', headers->>'cf-connecting-ip', ''), ',', 1), 80);
    if ip is not null and ip <> '' then
      bucket := date_trunc('minute', now());
      insert into public.bh_rl(ip, bucket, n) values (ip, bucket, 1)
      on conflict (ip, bucket) do update set n = public.bh_rl.n + 1 returning n into hits;
      delete from public.bh_rl where bucket < now() - interval '2 hours';
      if hits > 120 then return null; end if;
    end if;
  exception when others then
    null;
  end;
  return (select jsonb_build_object('d', data, 'k', wkey, 'rev', reset_gen) from public.cloud_saves where code = c);
end $$;

create or replace function public.bh_admin_reset(p_player_id text, p_cloud_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.players%rowtype; c text; cloud jsonb; rev int; backup_id bigint;
begin
  select * into r from public.players where player_id = p_player_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  cloud := null;
  if p_cloud_code is not null and length(trim(p_cloud_code)) > 0 then
    c := upper(regexp_replace(p_cloud_code, '[^A-Za-z0-9]', '', 'g'));
    select to_jsonb(s) into cloud from public.cloud_saves s where s.code = c;
  end if;
  insert into public.player_reset_backup(player_id, snapshot)
  values (r.player_id, jsonb_build_object('player', to_jsonb(r), 'cloud', cloud))
  returning id into backup_id;
  perform set_config('bh.admin', '1', true);
  update public.players set
    board_reached = 1, boards_won = 0, stars = 0, wins = 0, losses = 0,
    daily_played = 0, daily_won = 0, dogs = 0, coins = 0, yard = null,
    sync_rev = r.sync_rev + 1, reset_at = now(), last_played = now()
  where player_id = r.player_id
  returning sync_rev into rev;
  if c is not null then
    update public.cloud_saves set
      reset_gen = reset_gen + 1,
      data = jsonb_build_object('coins', 0, 'stars', '{}'::jsonb, 'album', '[]'::jsonb, 'v', 2, 'guardRev', reset_gen + 1),
      updated_at = now()
    where code = c;
  end if;
  return jsonb_build_object('ok', true, 'sync_rev', rev, 'backup_id', backup_id);
end $$;

create or replace function public.bh_admin_restore_backup(p_backup_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.player_reset_backup%rowtype; p jsonb; rev int;
begin
  select * into b from public.player_reset_backup where id = p_backup_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  p := b.snapshot->'player';
  if p is null then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  perform set_config('bh.admin', '1', true);
  update public.players set
    name = coalesce(p->>'name', name),
    version = p->>'version',
    board_reached = coalesce((p->>'board_reached')::int, 1),
    boards_won = coalesce((p->>'boards_won')::int, 0),
    stars = coalesce((p->>'stars')::int, 0),
    wins = coalesce((p->>'wins')::int, 0),
    losses = coalesce((p->>'losses')::int, 0),
    daily_played = coalesce((p->>'daily_played')::int, 0),
    daily_won = coalesce((p->>'daily_won')::int, 0),
    dogs = coalesce((p->>'dogs')::int, 0),
    coins = coalesce((p->>'coins')::int, 0),
    yard = p->'yard',
    sync_rev = greatest(sync_rev, coalesce((p->>'sync_rev')::int, 0)) + 1,
    reset_at = nullif(p->>'reset_at', '')::timestamptz
  where player_id = b.player_id
  returning sync_rev into rev;
  if b.snapshot ? 'cloud' and b.snapshot->'cloud' is not null and jsonb_typeof(b.snapshot->'cloud') = 'object' then
    update public.cloud_saves set
      wkey = coalesce(b.snapshot->'cloud'->>'wkey', wkey),
      data = coalesce(b.snapshot->'cloud'->'data', data),
      reset_gen = greatest(reset_gen, coalesce((b.snapshot->'cloud'->>'reset_gen')::int, 0)) + 1,
      updated_at = now()
    where code = b.snapshot->'cloud'->>'code';
  end if;
  return jsonb_build_object('ok', true, 'player_id', b.player_id, 'sync_rev', rev);
end $$;

revoke all on function public.bh_mono(integer, integer, integer) from public, anon, authenticated;
revoke all on function public.bh_cap_up(integer, integer, integer) from public, anon, authenticated;
revoke all on function public.bh_coin_normal(bigint, numeric) from public, anon, authenticated;
revoke all on function public.bh_coin_reset(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.bh_phase_ceil(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.bh_clamp_yard(jsonb, jsonb, integer) from public, anon, authenticated;
revoke all on function public.bh_clamp_stars(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.bh_players_guard() from public, anon, authenticated;
revoke all on function public.bh_players_bind() from public, anon, authenticated;
revoke all on function public.bh_admin_reset(text, text) from public, anon, authenticated;
revoke all on function public.bh_admin_restore_backup(bigint) from public, anon, authenticated;
revoke all on function public.player_put(jsonb, text) from public, anon, authenticated;
revoke all on function public.cloud_put(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.cloud_get(text) from public, anon, authenticated;
grant execute on function public.player_put(jsonb, text) to anon;
grant execute on function public.cloud_put(text, text, jsonb) to anon;
grant execute on function public.cloud_get(text) to anon;
revoke all on table public.cloud_saves from anon, authenticated;
