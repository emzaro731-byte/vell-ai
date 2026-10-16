-- Vell AI Studio Supabase schema
-- Run this in Supabase Dashboard > SQL Editor.
-- Keep the service-role/secret key ONLY in Render Environment. Never expose it in the browser.

create extension if not exists pgcrypto;

create table if not exists public.vell_projects (
  id text primary key,
  title text not null default 'Untitled project',
  prompt text not null,
  html text not null default '',
  kind text not null default 'generate',
  updated_at timestamptz not null default now(),
  repository text
);

alter table public.vell_projects enable row level security;

-- Access is intentionally server-side through the Supabase service-role key.
-- Do not add public/anon policies for this table unless you implement user-scoped auth.
