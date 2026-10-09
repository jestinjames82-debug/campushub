-- Public portfolios are explicitly published snapshots. Private workspace records
-- and contact fields are never readable through the public portfolio endpoint.
create table public.public_portfolios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slug uuid not null unique default gen_random_uuid(),
  published boolean not null default false,
  name text not null check (char_length(name) between 1 and 100),
  headline text not null check (char_length(headline) between 1 and 180),
  summary text not null default '' check (char_length(summary) <= 1500),
  skills text not null default '' check (char_length(skills) <= 1500),
  education text not null default '' check (char_length(education) <= 2000),
  projects text not null default '' check (char_length(projects) <= 6000),
  links text not null default '' check (char_length(links) <= 2000)
);

alter table public.public_portfolios enable row level security;
revoke all on public.public_portfolios from anon, authenticated;
grant select, insert, update, delete on public.public_portfolios to authenticated;

create policy portfolio_owner on public.public_portfolios
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Exact UUID lookup only; no endpoint to enumerate all public snapshots. This
-- function deliberately returns only the seven fields shown in the preview.
create function public.get_public_portfolio(portfolio_slug uuid)
returns table (name text, headline text, summary text, skills text, education text, projects text, links text)
language sql stable security definer set search_path = ''
as $$
  select p.name, p.headline, p.summary, p.skills, p.education, p.projects, p.links
  from public.public_portfolios p
  where p.slug = portfolio_slug and p.published = true;
$$;

revoke all on function public.get_public_portfolio(uuid) from public;
grant execute on function public.get_public_portfolio(uuid) to anon, authenticated;
