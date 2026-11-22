create extension if not exists vector;
create table if not exists ai_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text,
  content text,
  embedding vector(1536),
  language text default 'fr',
  created_at timestamptz default now()
);
alter table ai_knowledge enable row level security;
create policy "ai_knowledge read" on ai_knowledge for select using (true);
create policy "ai_knowledge admin write" on ai_knowledge for all using (is_admin());
