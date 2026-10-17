-- Vell Chat schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text not null default 'User',
  last_seen timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Chat',
  is_group boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(chat_id,user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  media_url text,
  media_type text,
  created_at timestamptz not null default now(),
  constraint message_has_content_or_media check (length(trim(content))>0 or media_url is not null)
);
create index if not exists messages_chat_created_idx on public.messages(chat_id,created_at);
create index if not exists chat_members_user_idx on public.chat_members(user_id,chat_id);
alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
-- SECURITY DEFINER helper avoids recursive RLS policies on chat membership.
create or replace function public.is_chat_member(target_chat uuid, target_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public
as $ select exists(select 1 from public.chat_members where chat_id=target_chat and user_id=target_user); $;
grant execute on function public.is_chat_member(uuid,uuid) to authenticated;
drop policy if exists "profiles visible to authenticated users" on public.profiles;
create policy "profiles visible to authenticated users" on public.profiles for select to authenticated using (true);
drop policy if exists "users edit own profile" on public.profiles;
create policy "users edit own profile" on public.profiles for all to authenticated using (auth.uid()=id) with check (auth.uid()=id);
drop policy if exists "members read chats" on public.chats;
create policy "members read chats" on public.chats for select to authenticated using (created_by=auth.uid() or public.is_chat_member(id,auth.uid()));
drop policy if exists "signed in users create chats" on public.chats;
create policy "signed in users create chats" on public.chats for insert to authenticated with check (created_by=auth.uid());
drop policy if exists "members read membership" on public.chat_members;
create policy "members read membership" on public.chat_members for select to authenticated using (public.is_chat_member(chat_id,auth.uid()));
drop policy if exists "chat creator adds members" on public.chat_members;
create policy "chat creator adds members" on public.chat_members for insert to authenticated with check (exists(select 1 from public.chats c where c.id=chat_id and c.created_by=auth.uid()));
drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages for select to authenticated using (public.is_chat_member(chat_id,auth.uid()));
drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages for insert to authenticated with check (sender_id=auth.uid() and public.is_chat_member(chat_id,auth.uid()));
-- Enable realtime for messages (ignore duplicate publication membership if already enabled).
do $$ begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; when undefined_object then null; end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-media','chat-media',true,15728640,array['image/*','video/*','audio/*','application/pdf','text/plain'])
on conflict(id) do update set public=true,file_size_limit=15728640;
drop policy if exists "chat members upload media" on storage.objects;
create policy "chat members upload media" on storage.objects for insert to authenticated with check (bucket_id='chat-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "chat media public read" on storage.objects;
create policy "chat media public read" on storage.objects for select to public using (bucket_id='chat-media');
