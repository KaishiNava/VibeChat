-- VibeChat complete database
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  verified boolean not null default false,
  last_seen timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  nickname text,
  created_at timestamptz not null default now(),
  primary key(owner_id,contact_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'direct' check(type in ('direct','group','channel')),
  title text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  message_type text not null default 'text',
  media_url text,
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text,
  media_url text,
  media_type text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table if not exists public.status_views (
  status_id uuid not null references public.statuses(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(status_id,viewer_id)
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text unique not null,
  description text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(channel_id,user_id)
);

create table if not exists public.channel_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  media_url text,
  created_at timestamptz not null default now(),
  reactions integer not null default 0
);

create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);
create index if not exists statuses_expires_idx on public.statuses(expires_at);
create index if not exists profiles_username_idx on public.profiles(username);

-- New auth user => profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'name','Vibe User'))
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Direct chat creator. The client never gets to choose arbitrary members.
create or replace function public.get_or_create_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare cid uuid;
begin
  if other_user_id = auth.uid() then raise exception 'Cannot chat with yourself'; end if;
  select c.id into cid
  from conversations c
  where c.type='direct'
    and exists(select 1 from conversation_members m where m.conversation_id=c.id and m.user_id=auth.uid())
    and exists(select 1 from conversation_members m where m.conversation_id=c.id and m.user_id=other_user_id)
  limit 1;
  if cid is not null then return cid; end if;

  insert into conversations(type) values('direct') returning id into cid;
  insert into conversation_members(conversation_id,user_id) values(cid,auth.uid()),(cid,other_user_id);
  return cid;
end;
$$;

grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.blocks enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.statuses enable row level security;
alter table public.status_views enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.channel_posts enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using(true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check(auth.uid()=id);
-- IMPORTANT: verified is not included in client-update grants below.
revoke update on public.profiles from authenticated;
grant update(display_name,username,avatar_url,bio,last_seen,updated_at) on public.profiles to authenticated;

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using(auth.uid()=id) with check(auth.uid()=id);

create policy contacts_select on public.contacts for select to authenticated using(owner_id=auth.uid());
create policy contacts_insert on public.contacts for insert to authenticated with check(owner_id=auth.uid());
create policy contacts_delete on public.contacts for delete to authenticated using(owner_id=auth.uid());

create policy blocks_select on public.blocks for select to authenticated using(blocker_id=auth.uid());
create policy blocks_insert on public.blocks for insert to authenticated with check(blocker_id=auth.uid());
create policy blocks_delete on public.blocks for delete to authenticated using(blocker_id=auth.uid());

create policy conversations_select on public.conversations for select to authenticated using(
  exists(select 1 from conversation_members m where m.conversation_id=id and m.user_id=auth.uid())
);

create policy members_select on public.conversation_members for select to authenticated using(
  user_id=auth.uid() or exists(select 1 from conversation_members x where x.conversation_id=conversation_id and x.user_id=auth.uid())
);

create policy messages_select on public.messages for select to authenticated using(
  exists(select 1 from conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid())
);

create policy messages_insert on public.messages for insert to authenticated with check(
  sender_id=auth.uid() and exists(select 1 from conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid())
);

create policy messages_update_read on public.messages for update to authenticated using(
  exists(select 1 from conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid())
) with check(
  exists(select 1 from conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid())
);

create policy statuses_select on public.statuses for select to authenticated using(expires_at>now());
create policy statuses_insert on public.statuses for insert to authenticated with check(user_id=auth.uid());
create policy statuses_update on public.statuses for update to authenticated using(user_id=auth.uid());
create policy statuses_delete on public.statuses for delete to authenticated using(user_id=auth.uid());

create policy status_views_select on public.status_views for select to authenticated using(viewer_id=auth.uid());
create policy status_views_insert on public.status_views for insert to authenticated with check(viewer_id=auth.uid());

create policy channels_select on public.channels for select to authenticated using(true);
create policy channels_insert on public.channels for insert to authenticated with check(owner_id=auth.uid());
create policy channels_update on public.channels for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());

create policy channel_members_select on public.channel_members for select to authenticated using(user_id=auth.uid() or exists(select 1 from channel_members x where x.channel_id=channel_id and x.user_id=auth.uid()));
create policy channel_members_insert on public.channel_members for insert to authenticated with check(user_id=auth.uid());

create policy channel_posts_select on public.channel_posts for select to authenticated using(true);
create policy channel_posts_insert on public.channel_posts for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from channels c where c.id=channel_id and (c.owner_id=auth.uid() or exists(select 1 from channel_members cm where cm.channel_id=c.id and cm.user_id=auth.uid()))));

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.statuses;
exception when duplicate_object then null;
end $$;

-- Storage bucket for avatars/status/media.
insert into storage.buckets(id,name,public) values('media','media',true)
on conflict(id) do nothing;

drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects for select to public using(bucket_id='media');

drop policy if exists media_auth_upload on storage.objects;
create policy media_auth_upload on storage.objects for insert to authenticated with check(bucket_id='media');

drop policy if exists media_owner_update on storage.objects;
create policy media_owner_update on storage.objects for update to authenticated using(bucket_id='media' and owner_id=auth.uid()) with check(bucket_id='media' and owner_id=auth.uid());

-- Admin/dev verification:
-- UPDATE public.profiles SET verified=true WHERE id='USER_UUID';
