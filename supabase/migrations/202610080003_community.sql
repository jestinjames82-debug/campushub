begin;

-- Sharing is opt-in and physically separate from every private academic table.
create table public.community_groups (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 2 and 100),
 description text not null default '' check (char_length(description)<=1000),
 kind text not null check (kind in ('club','study')),
 created_at timestamptz not null default now()
);
create table public.community_members (
 group_id uuid not null references public.community_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check (char_length(trim(display_name)) between 2 and 80),
 role text not null default 'member' check (role in ('owner','moderator','member')),
 consent_at timestamptz not null default now(),
 primary key(group_id,user_id)
);
create table public.community_posts (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.community_groups(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(trim(title)) between 2 and 160),
 body text not null check (char_length(trim(body)) between 1 and 6000),
 resource_url text not null default '' check (resource_url='' or (resource_url ~ '^https://[^[:space:]]+$' and char_length(resource_url)<=2000)),
 hidden boolean not null default false,
 created_at timestamptz not null default now(),
 unique(id,group_id)
);
create table public.community_events (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.community_groups(id) on delete cascade,
 creator_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(trim(title)) between 2 and 160),
 starts_at timestamptz not null,
 location text not null check (char_length(trim(location)) between 2 and 200),
 details text not null default '' check (char_length(details)<=2000),
 created_at timestamptz not null default now()
);
create table public.community_reports (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.community_groups(id) on delete cascade,
 post_id uuid not null,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check (char_length(trim(reason)) between 5 and 1000),
 status text not null default 'open' check (status in ('open','dismissed','removed')),
 created_at timestamptz not null default now(),
 resolved_by uuid references auth.users(id) on delete set null,
 resolved_at timestamptz,
 foreign key(post_id,group_id) references public.community_posts(id,group_id) on delete cascade,
 unique(post_id,reporter_id)
);
create table public.community_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 check(blocker_id<>blocked_id),
 primary key(blocker_id,blocked_id)
);
create table public.community_audit (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.community_groups(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null,
 target_id uuid,
 details text not null default '',
 created_at timestamptz not null default now()
);

-- Operators provision verified institutions and staff with privileged SQL after
-- independently checking the institution. Client users cannot mint either.
create table public.institutions (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(trim(name)) between 2 and 160),
 domain text not null unique check(domain ~ '^[a-z0-9][a-z0-9.-]+[a-z0-9]$'),
 verified_at timestamptz not null default now()
);
create table public.institution_members (
 institution_id uuid not null references public.institutions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check(char_length(trim(display_name)) between 2 and 80),
 role text not null default 'student' check(role in ('student','staff')),
 consent_at timestamptz not null default now(),
 primary key(institution_id,user_id)
);
create table public.institution_announcements (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 2 and 160),
 body text not null check(char_length(trim(body)) between 1 and 6000),
 created_at timestamptz not null default now()
);

create index community_members_user_idx on public.community_members(user_id);
create index community_posts_group_idx on public.community_posts(group_id,created_at);
create index community_events_group_idx on public.community_events(group_id,starts_at);
create index community_reports_group_idx on public.community_reports(group_id,status);
create index community_audit_group_idx on public.community_audit(group_id,created_at);
create index institution_members_user_idx on public.institution_members(user_id);
create index institution_announcements_idx on public.institution_announcements(institution_id,created_at);

create function public.community_is_member(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.community_members where group_id=p_group and user_id=auth.uid());
$$;
create function public.community_is_moderator(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.community_members where group_id=p_group and user_id=auth.uid() and role in ('owner','moderator'));
$$;
create function public.institution_is_member(p_institution uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.institution_members where institution_id=p_institution and user_id=auth.uid());
$$;
create function public.institution_is_staff(p_institution uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.institution_members where institution_id=p_institution and user_id=auth.uid() and role='staff');
$$;

alter table public.community_groups enable row level security;
alter table public.community_members enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_events enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_blocks enable row level security;
alter table public.community_audit enable row level security;
alter table public.institutions enable row level security;
alter table public.institution_members enable row level security;
alter table public.institution_announcements enable row level security;

create policy group_read on public.community_groups for select to authenticated using(public.community_is_member(id));
create policy member_read on public.community_members for select to authenticated using(public.community_is_member(group_id));
create policy post_read on public.community_posts for select to authenticated using(
 public.community_is_member(group_id) and (not hidden or public.community_is_moderator(group_id)) and
 (public.community_is_moderator(group_id) or not exists(select 1 from public.community_blocks b where b.blocker_id=(select auth.uid()) and b.blocked_id=author_id))
);
create policy post_create on public.community_posts for insert to authenticated with check(author_id=(select auth.uid()) and public.community_is_member(group_id) and not hidden);
create policy event_read on public.community_events for select to authenticated using(public.community_is_member(group_id));
create policy event_create on public.community_events for insert to authenticated with check(creator_id=(select auth.uid()) and public.community_is_member(group_id));
create policy event_delete on public.community_events for delete to authenticated using(public.community_is_member(group_id) and (creator_id=(select auth.uid()) or public.community_is_moderator(group_id)));
create policy report_read on public.community_reports for select to authenticated using(reporter_id=(select auth.uid()) or public.community_is_moderator(group_id));
create policy block_own on public.community_blocks for all to authenticated using(blocker_id=(select auth.uid())) with check(blocker_id=(select auth.uid()));
create policy audit_read on public.community_audit for select to authenticated using(public.community_is_moderator(group_id));
create policy institution_read on public.institutions for select to authenticated using(public.institution_is_member(id));
create policy institution_members_read on public.institution_members for select to authenticated using(user_id=(select auth.uid()) or public.institution_is_staff(institution_id));
create policy announcement_read on public.institution_announcements for select to authenticated using(public.institution_is_member(institution_id));

create function public.community_directory() returns table(id uuid,name text,description text,kind text) language sql stable security definer set search_path='' as $$
 select g.id,g.name,g.description,g.kind from public.community_groups g where auth.uid() is not null order by g.created_at desc limit 200;
$$;
create function public.create_community_group(p_name text,p_description text,p_kind text,p_display_name text,p_consent boolean) returns uuid language plpgsql security definer set search_path='' as $$
 declare new_id uuid;
 begin
 if auth.uid() is null or p_consent is distinct from true then raise exception 'Sign in and explicitly consent to sharing your display name.'; end if;
 insert into public.community_groups(owner_id,name,description,kind) values(auth.uid(),p_name,p_description,p_kind) returning id into new_id;
 insert into public.community_members(group_id,user_id,display_name,role) values(new_id,auth.uid(),p_display_name,'owner');
 insert into public.community_audit(group_id,actor_id,action) values(new_id,auth.uid(),'group_created');
 return new_id;
 end;
$$;
create function public.join_community_group(p_group uuid,p_display_name text,p_consent boolean) returns void language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is null or p_consent is distinct from true then raise exception 'Sign in and explicitly consent to sharing your display name.'; end if;
 insert into public.community_members(group_id,user_id,display_name,role) values(p_group,auth.uid(),p_display_name,'member') on conflict(group_id,user_id) do nothing;
 end;
$$;
create function public.leave_community_group(p_group uuid) returns void language plpgsql security definer set search_path='' as $$
 begin
 if exists(select 1 from public.community_groups where id=p_group and owner_id=auth.uid()) then raise exception 'Group owners must delete their group instead of leaving it.'; end if;
 delete from public.community_members where group_id=p_group and user_id=auth.uid();
 end;
$$;
create function public.delete_community_group(p_group uuid) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not exists(select 1 from public.community_groups where id=p_group and owner_id=auth.uid()) then raise exception 'Only the group owner may delete it.'; end if;
 delete from public.community_groups where id=p_group and owner_id=auth.uid();
 end;
$$;
create function public.set_community_moderator(p_group uuid,p_member uuid,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not exists(select 1 from public.community_groups where id=p_group and owner_id=auth.uid()) then raise exception 'Only the group owner may change moderators.'; end if;
 if p_member=auth.uid() then raise exception 'The owner role cannot be changed.'; end if;
 update public.community_members set role=case when p_enabled then 'moderator' else 'member' end where group_id=p_group and user_id=p_member and role<>'owner';
 if not found then raise exception 'Member not found.'; end if;
 insert into public.community_audit(group_id,actor_id,action,target_id) values(p_group,auth.uid(),case when p_enabled then 'moderator_added' else 'moderator_removed' end,p_member);
 end;
$$;
create function public.remove_community_post(p_post uuid) returns void language plpgsql security definer set search_path='' as $$
 declare target public.community_posts;
 begin
 select * into target from public.community_posts where id=p_post;
 if not found or not public.community_is_member(target.group_id) or (target.author_id<>auth.uid() and not public.community_is_moderator(target.group_id)) then raise exception 'You cannot remove this post.'; end if;
 update public.community_posts set hidden=true where id=p_post;
 insert into public.community_audit(group_id,actor_id,action,target_id) values(target.group_id,auth.uid(),'post_removed',p_post);
 end;
$$;
create function public.report_community_post(p_post uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
 declare target public.community_posts;
 begin
 select * into target from public.community_posts where id=p_post;
 if not found or not public.community_is_member(target.group_id) or target.hidden then raise exception 'Only members may report visible group posts.'; end if;
 insert into public.community_reports(group_id,post_id,reporter_id,reason) values(target.group_id,p_post,auth.uid(),p_reason);
 end;
$$;
create function public.resolve_community_report(p_report uuid,p_remove boolean) returns void language plpgsql security definer set search_path='' as $$
 declare target public.community_reports;
 begin
 select * into target from public.community_reports where id=p_report for update;
 if not found or not public.community_is_moderator(target.group_id) then raise exception 'Only group moderators may resolve reports.'; end if;
 if target.status<>'open' then raise exception 'This report has already been resolved.'; end if;
 if p_remove then update public.community_posts set hidden=true where id=target.post_id; end if;
 update public.community_reports set status=case when p_remove then 'removed' else 'dismissed' end,resolved_by=auth.uid(),resolved_at=now() where id=p_report;
 insert into public.community_audit(group_id,actor_id,action,target_id,details) values(target.group_id,auth.uid(),case when p_remove then 'report_removed' else 'report_dismissed' end,target.post_id,'Report '||p_report::text);
 end;
$$;
create function public.institution_directory() returns table(id uuid,name text,domain text,verified_at timestamptz) language sql stable security definer set search_path='' as $$
 select i.id,i.name,i.domain,i.verified_at from public.institutions i where auth.uid() is not null order by i.name limit 200;
$$;
create function public.join_institution(p_institution uuid,p_display_name text,p_consent boolean) returns void language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is null or p_consent is distinct from true then raise exception 'Sign in and explicitly consent to institution membership.'; end if;
 insert into public.institution_members(institution_id,user_id,display_name,role) values(p_institution,auth.uid(),p_display_name,'student') on conflict(institution_id,user_id) do nothing;
 end;
$$;
create function public.leave_institution(p_institution uuid) returns void language plpgsql security definer set search_path='' as $$
 begin delete from public.institution_members where institution_id=p_institution and user_id=auth.uid(); end;
$$;
create function public.publish_institution_announcement(p_institution uuid,p_title text,p_body text) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not public.institution_is_staff(p_institution) then raise exception 'Only verified institution staff may publish announcements.'; end if;
 insert into public.institution_announcements(institution_id,author_id,title,body) values(p_institution,auth.uid(),p_title,p_body);
 end;
$$;

revoke all on public.community_groups,public.community_members,public.community_posts,public.community_events,public.community_reports,public.community_blocks,public.community_audit,public.institutions,public.institution_members,public.institution_announcements from anon,authenticated;
grant select on public.community_groups,public.community_members,public.community_posts,public.community_events,public.community_reports,public.community_blocks,public.community_audit,public.institutions,public.institution_members,public.institution_announcements to authenticated;
grant insert on public.community_posts,public.community_events,public.community_blocks to authenticated;
grant delete on public.community_events,public.community_blocks to authenticated;

-- PostgreSQL grants function EXECUTE to PUBLIC by default: explicitly close it.
revoke all on function public.community_is_member(uuid),public.community_is_moderator(uuid),public.institution_is_member(uuid),public.institution_is_staff(uuid),public.community_directory(),public.create_community_group(text,text,text,text,boolean),public.join_community_group(uuid,text,boolean),public.leave_community_group(uuid),public.delete_community_group(uuid),public.set_community_moderator(uuid,uuid,boolean),public.remove_community_post(uuid),public.report_community_post(uuid,text),public.resolve_community_report(uuid,boolean),public.institution_directory(),public.join_institution(uuid,text,boolean),public.leave_institution(uuid),public.publish_institution_announcement(uuid,text,text) from public,anon;
grant execute on function public.community_is_member(uuid),public.community_is_moderator(uuid),public.institution_is_member(uuid),public.institution_is_staff(uuid),public.community_directory(),public.create_community_group(text,text,text,text,boolean),public.join_community_group(uuid,text,boolean),public.leave_community_group(uuid),public.delete_community_group(uuid),public.set_community_moderator(uuid,uuid,boolean),public.remove_community_post(uuid),public.report_community_post(uuid,text),public.resolve_community_report(uuid,boolean),public.institution_directory(),public.join_institution(uuid,text,boolean),public.leave_institution(uuid),public.publish_institution_announcement(uuid,text,text) to authenticated;
commit;
