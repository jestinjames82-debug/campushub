begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (char_length(trim(full_name)) between 2 and 80),
 college text not null check (char_length(trim(college)) between 2 and 160),
 programme text not null check (char_length(trim(programme)) between 2 and 100),
 branch text not null default '' check (char_length(branch)<=100),
 admission_year integer not null check (admission_year between 1980 and 2100),
 term_system text not null check (term_system in ('Semester','Trimester','Annual')),
 created_at timestamptz not null default now()
);
create table public.academic_terms (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 2 and 80),
 starts_on date not null,
 ends_on date not null check (ends_on>=starts_on),
 created_at timestamptz not null default now(),
 unique(id,user_id)
);
create table public.subjects (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 term_id uuid not null,
 name text not null check (char_length(trim(name)) between 2 and 100),
 code text not null check (char_length(trim(code)) between 1 and 20),
 credits numeric(4,1) not null check (credits between 0 and 30),
 instructor text not null default '' check (char_length(instructor)<=100),
 color text not null default 'violet' check (color in ('violet','blue','orange','green')),
 created_at timestamptz not null default now(),
 foreign key (term_id,user_id) references public.academic_terms(id,user_id) on delete cascade,
 unique(term_id,code)
);
create index terms_owner_idx on public.academic_terms(user_id);
create index subjects_owner_idx on public.subjects(user_id);
create index subjects_term_idx on public.subjects(term_id,user_id);
alter table public.profiles enable row level security;
alter table public.academic_terms enable row level security;
alter table public.subjects enable row level security;
create policy "Students manage only their own profile" on public.profiles for all to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy "Students manage only their own terms" on public.academic_terms for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Students manage only their own subjects" on public.subjects for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.profiles,public.academic_terms,public.subjects from anon;
grant select,insert,update,delete on public.profiles,public.academic_terms,public.subjects to authenticated;
commit;
