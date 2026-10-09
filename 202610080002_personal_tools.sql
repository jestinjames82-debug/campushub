begin;
create table public.workspace_records(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('task','class','attendance','assessment','grade_scale','goal','note','resource','revision','application','portfolio','career_task','preferences')),
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=100000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index workspace_records_owner_kind_idx on public.workspace_records(user_id,kind);
alter table public.workspace_records enable row level security;
create policy "Personal records belong to the student" on public.workspace_records for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.workspace_records from anon;
grant select,insert,update,delete on public.workspace_records to authenticated;
create function public.validate_workspace_record() returns trigger language plpgsql set search_path='' as $$
declare linked_subject uuid;
begin
 new.updated_at=now();
 if tg_op='UPDATE' and (new.user_id<>old.user_id or new.kind<>old.kind) then raise exception 'Record ownership and type cannot change'; end if;
 if nullif(new.data->>'subject_id','') is not null then
  linked_subject=(new.data->>'subject_id')::uuid;
  if not exists(select 1 from public.subjects where id=linked_subject and user_id=new.user_id) then raise exception 'Subject must belong to the record owner'; end if;
 end if;
 if nullif(new.data->>'term_id','') is not null and not exists(select 1 from public.academic_terms where id=(new.data->>'term_id')::uuid and user_id=new.user_id) then raise exception 'Term must belong to the record owner'; end if;
 return new;
end $$;
create trigger validate_personal_record before insert or update on public.workspace_records for each row execute function public.validate_workspace_record();

-- Preserve reusable study material and tasks; remove measurements tied to a
-- deleted subject. BEFORE DELETE also runs for subjects cascaded from a term.
create function public.detach_subject_records() returns trigger language plpgsql set search_path='' as $$
begin
 delete from public.workspace_records where user_id=old.user_id and data->>'subject_id'=old.id::text and kind in ('class','attendance','assessment');
 update public.workspace_records set data=jsonb_set(data,'{subject_id}','""'::jsonb) where user_id=old.user_id and data->>'subject_id'=old.id::text;
 return old;
end $$;
create trigger detach_subject_records before delete on public.subjects for each row execute function public.detach_subject_records();

create function public.detach_term_records() returns trigger language plpgsql set search_path='' as $$
begin
 update public.workspace_records set data=jsonb_set(data,'{term_id}','""'::jsonb) where user_id=old.user_id and data->>'term_id'=old.id::text;
 return old;
end $$;
create trigger detach_term_records before delete on public.academic_terms for each row execute function public.detach_term_records();

create table public.ai_daily_usage(user_id uuid not null references auth.users(id) on delete cascade,day date not null,requests integer not null check(requests between 0 and 20),primary key(user_id,day));
alter table public.ai_daily_usage enable row level security;
create policy "Students see their own AI usage" on public.ai_daily_usage for select to authenticated using((select auth.uid())=user_id);
revoke all on public.ai_daily_usage from anon,authenticated;
grant select on public.ai_daily_usage to authenticated;
create function public.reserve_ai_request() returns integer language plpgsql security definer set search_path='' as $$
declare caller uuid=auth.uid();used integer;
begin
 if caller is null then raise exception 'Authentication required'; end if;
 insert into public.ai_daily_usage(user_id,day,requests) values(caller,(now() at time zone 'Asia/Kolkata')::date,1)
 on conflict(user_id,day) do update set requests=public.ai_daily_usage.requests+1 where public.ai_daily_usage.requests<20 returning requests into used;
 if used is null then raise exception 'Daily study assistant limit reached'; end if;
 return 20-used;
end $$;
revoke all on function public.reserve_ai_request() from public;
grant execute on function public.reserve_ai_request() to authenticated;
commit;
