import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
);
for (const filename of [
  "202610080001_phase1.sql",
  "202610080003_community.sql",
]) {
  await db.exec(
    await readFile(
      new URL(`../supabase/migrations/${filename}`, import.meta.url),
      "utf8",
    ),
  );
}
const a = "10000000-0000-4000-8000-000000000001";
const b = "10000000-0000-4000-8000-000000000002";
const c = "10000000-0000-4000-8000-000000000003";
const institution = "20000000-0000-4000-8000-000000000001";
await db.exec(
  `insert into auth.users values('${a}'),('${b}'),('${c}'); insert into public.institutions(id,name,domain) values('${institution}','Verified Test College','test.example');`,
);
async function as(user) {
  await db.exec(
    `reset role;set role authenticated;set request.jwt.claim.sub='${user}'`,
  );
}
async function scalar(sql) {
  return Object.values((await db.query(sql)).rows[0])[0];
}
await as(a);
await assert.rejects(
  db.exec(
    `select public.create_community_group('No consent','','study','Student A',false)`,
  ),
  /consent/,
);
const group = await scalar(
  `select public.create_community_group('Study Circle','A shared study room','study','Student A',true)`,
);
assert.equal(
  await scalar(
    `select role from public.community_members where group_id='${group}' and user_id='${a}'`,
  ),
  "owner",
  "owner membership created atomically",
);
await assert.rejects(
  db.exec(
    `select public.create_community_group('Broken Membership','','club','A',true)`,
  ),
  /check constraint/,
);
assert.equal(
  await scalar(`select count(*)::int from public.community_directory()`),
  1,
  "failed membership rolls back the group creation",
);
const post = await scalar(
  `insert into public.community_posts(group_id,author_id,title,body) values('${group}','${a}','Reading list','Start with chapter one') returning id`,
);
const event = await scalar(
  `insert into public.community_events(group_id,creator_id,title,starts_at,location) values('${group}','${a}','Study session',now(),'Library') returning id`,
);
await db.exec(
  `insert into public.profiles(id,full_name,college,programme,admission_year,term_system) values('${a}','Student A','Test College','B.A.',2026,'Annual')`,
);
await as(b);
const other = await scalar(
  `select public.create_community_group('Other Club','','club','Student B',true)`,
);
assert.equal(
  await scalar(`select count(*)::int from public.community_directory()`),
  2,
  "directory exposes names only",
);
assert.equal(
  await scalar(
    `select count(*)::int from public.community_groups where id='${group}'`,
  ),
  0,
  "nonmembers cannot read groups",
);
assert.equal(
  await scalar(
    `select count(*)::int from public.community_posts where group_id='${group}'`,
  ),
  0,
  "cross-group posts isolated",
);
assert.equal(
  await scalar(
    `select count(*)::int from public.community_members where group_id='${group}'`,
  ),
  0,
  "roster isolated",
);
assert.equal(
  await scalar(`select count(*)::int from public.community_events`),
  0,
  "events isolated",
);
await assert.rejects(
  db.exec(
    `insert into public.community_events(group_id,creator_id,title,starts_at,location) values('${group}','${b}','Intrusion',now(),'Library')`,
  ),
  /row-level security/,
);
await assert.rejects(
  db.exec(
    `insert into public.community_posts(group_id,author_id,title,body) values('${group}','${b}','Intrusion','No membership')`,
  ),
  /row-level security/,
);
await assert.rejects(
  db.exec(`select public.report_community_post('${post}','Outsider report')`),
  /Only members/,
);
await assert.rejects(
  db.exec(`select public.delete_community_group('${group}')`),
  /Only the group owner/,
);
await assert.rejects(
  db.exec(`select public.set_community_moderator('${group}','${b}',true)`),
  /Only the group owner/,
);
await assert.rejects(
  db.exec(`select public.join_community_group('${group}','Student B',false)`),
  /consent/,
);
await db.exec(
  `select public.join_community_group('${group}','Student B',true)`,
);
assert.equal(
  await scalar(
    `select count(*)::int from public.community_posts where group_id='${group}'`,
  ),
  1,
);
await assert.rejects(
  db.exec(
    `update public.community_members set role='owner' where group_id='${group}' and user_id='${b}'`,
  ),
  /permission denied/,
);
await assert.rejects(
  db.exec(
    `insert into public.community_members(group_id,user_id,display_name,role) values('${group}','${c}','Student C','owner')`,
  ),
  /permission denied/,
);
await assert.rejects(
  db.exec(
    `update public.community_groups set owner_id='${b}' where id='${group}'`,
  ),
  /permission denied/,
);
await assert.rejects(
  db.exec(
    `insert into public.community_posts(group_id,author_id,title,body,hidden) values('${group}','${b}','Hidden injection','Bad state',true)`,
  ),
  /row-level security/,
);
await assert.rejects(
  db.exec(
    `insert into public.community_posts(group_id,author_id,title,body,resource_url) values('${group}','${b}','Unsafe link','Link','javascript:alert(1)')`,
  ),
  /check constraint/,
);
await db.exec(
  `select public.report_community_post('${post}','Please review this post')`,
);
const report = await scalar(
  `select id from public.community_reports where post_id='${post}'`,
);
await assert.rejects(
  db.exec(`select public.resolve_community_report('${report}',true)`),
  /Only group moderators/,
);
await db.exec(
  `insert into public.community_blocks(blocker_id,blocked_id) values('${b}','${a}')`,
);
assert.equal(
  await scalar(
    `select count(*)::int from public.community_posts where group_id='${group}'`,
  ),
  0,
  "blocking hides author posts for member",
);
await as(c);
await db.exec(
  `select public.join_community_group('${group}','Student C',true)`,
);
assert.equal(
  (
    await db.query(
      `delete from public.community_events where id='${event}' returning id`,
    )
  ).rows.length,
  0,
  "ordinary members cannot remove others events",
);
assert.equal(
  await scalar(`select count(*)::int from public.community_reports`),
  0,
  "reports are private to reporter and moderators",
);
assert.equal(
  await scalar(`select count(*)::int from public.community_blocks`),
  0,
  "blocks private",
);
assert.equal(
  await scalar(`select count(*)::int from public.community_audit`),
  0,
  "audit private to moderators",
);
await as(a);
await db.exec(`select public.set_community_moderator('${group}','${b}',true)`);
await assert.rejects(
  db.exec(`select public.leave_community_group('${group}')`),
  /owners must delete/,
);
await as(b);
assert.equal(
  await scalar(
    `select count(*)::int from public.community_posts where group_id='${group}'`,
  ),
  1,
  "moderator can review blocked content",
);
await db.exec(`select public.resolve_community_report('${report}',true)`);
assert.equal(
  (
    await db.query(
      `delete from public.community_events where id='${event}' returning id`,
    )
  ).rows.length,
  1,
  "moderators may remove group events",
);
assert.equal(
  await scalar(
    `select status from public.community_reports where id='${report}'`,
  ),
  "removed",
);
assert.equal(
  await scalar(
    `select count(*)::int from public.community_audit where action='report_removed'`,
  ),
  1,
  "moderation records an audit",
);
await assert.rejects(
  db.exec(`select public.resolve_community_report('${report}',false)`),
  /already been resolved/,
);
await assert.rejects(
  db.exec(`select public.set_community_moderator('${group}','${c}',true)`),
  /Only the group owner/,
);
await assert.rejects(
  db.exec(`delete from public.community_audit`),
  /permission denied/,
);
await as(c);
assert.equal(
  await scalar(`select count(*)::int from public.community_posts`),
  0,
  "removed posts hidden from regular members",
);
await assert.rejects(
  db.exec(
    `select public.report_community_post('${post}','Hidden post report')`,
  ),
  /visible group posts/,
);
await db.exec(`select public.leave_community_group('${group}')`);
assert.equal(
  await scalar(`select count(*)::int from public.community_members`),
  0,
  "leave revokes group access",
);

// Institution discovery confers no staff role and no academic visibility.
assert.equal(
  await scalar(`select count(*)::int from public.institution_directory()`),
  1,
);
assert.equal(await scalar(`select count(*)::int from public.institutions`), 0);
await assert.rejects(
  db.exec(
    `insert into public.institutions(name,domain) values('Forged College','forged.example')`,
  ),
  /permission denied/,
);
await assert.rejects(
  db.exec(`select public.join_institution('${institution}','Student C',false)`),
  /consent/,
);
await db.exec(
  `select public.join_institution('${institution}','Student C',true)`,
);
assert.equal(
  await scalar(`select role from public.institution_members`),
  "student",
);
await assert.rejects(
  db.exec(`update public.institution_members set role='staff'`),
  /permission denied/,
);
await assert.rejects(
  db.exec(
    `select public.publish_institution_announcement('${institution}','Forged announcement','Impersonation')`,
  ),
  /Only verified institution staff/,
);
await db.exec(
  `reset role;insert into public.institution_members(institution_id,user_id,display_name,role) values('${institution}','${a}','Verified Staff','staff');`,
);
await as(a);
assert.equal(
  await scalar(`select count(*)::int from public.institution_members`),
  2,
  "verified staff can see voluntarily joined names",
);
await db.exec(
  `select public.publish_institution_announcement('${institution}','Library hours','The library opens at 8 AM.')`,
);
await as(c);
assert.equal(
  await scalar(`select count(*)::int from public.institution_announcements`),
  1,
);
assert.equal(
  await scalar(`select count(*)::int from public.profiles`),
  0,
  "institution members cannot read private academic profile",
);
assert.equal(
  await scalar(`select count(*)::int from public.institution_members`),
  1,
  "only own institution membership visible",
);
await db.exec(`select public.leave_institution('${institution}')`);
assert.equal(
  await scalar(`select count(*)::int from public.institution_announcements`),
  0,
  "leaving revokes institutional access",
);
await as(b);
assert.equal(
  await scalar(`select count(*)::int from public.institution_announcements`),
  0,
  "group membership grants no institution access",
);
await as(a);
await db.exec(`select public.delete_community_group('${group}')`);
assert.equal(
  await scalar(
    `select count(*)::int from public.community_members where group_id='${group}'`,
  ),
  0,
  "group delete cascades",
);

await db.exec("reset role;set role anon;");
for (const table of [
  "community_groups",
  "community_members",
  "community_posts",
  "community_events",
  "community_reports",
  "community_blocks",
  "community_audit",
  "institutions",
  "institution_members",
  "institution_announcements",
]) {
  await assert.rejects(
    db.query(`select * from public.${table}`),
    /permission denied/,
  );
}
await assert.rejects(
  db.exec(`select public.community_directory()`),
  /permission denied/,
);
await assert.rejects(
  db.exec(
    `select public.create_community_group('Anonymous','','club','Visitor',true)`,
  ),
  /permission denied/,
);
console.log(
  "PASS: community isolation, opt-in membership, atomic owner creation, no role escalation, owner-only delegation, reporting privacy, blocking, moderation/audit, institution provisioning/staff controls, private academic isolation, access revocation and anonymous denial.",
);
await db.close();
