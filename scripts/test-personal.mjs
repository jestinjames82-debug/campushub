import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`,
);
for (const name of [
  "202610080001_phase1.sql",
  "202610080002_personal_tools.sql",
  "202610080004_storage.sql",
])
  await db.exec(
    await readFile(
      new URL(`../supabase/migrations/${name}`, import.meta.url),
      "utf8",
    ),
  );
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002",
  term = "20000000-0000-4000-8000-000000000001",
  subject = "30000000-0000-4000-8000-000000000001";
await db.exec(
  `insert into auth.users values('${a}'),('${b}');set role authenticated;set request.jwt.claim.sub='${a}';insert into public.academic_terms(id,user_id,name,starts_on,ends_on) values('${term}','${a}','Term One','2026-01-01','2026-12-01');insert into public.subjects(id,user_id,term_id,name,code,credits) values('${subject}','${a}','${term}','Networks','CS1',3);insert into public.workspace_records(user_id,kind,data) values('${a}','note','{"title":"Private note","content":"A secret"}');insert into storage.objects(bucket_id,name) values('study-resources','${a}/resource/note.txt');`,
);
assert.equal(
  (await db.query("select * from public.workspace_records")).rows.length,
  1,
);
await db.exec(
  `update public.workspace_records set data='{"title":"Updated"}' where user_id='${a}'`,
);
await assert.rejects(
  db.exec(`update public.workspace_records set kind='goal'`),
  /cannot change/,
);
await db.exec(`set request.jwt.claim.sub='${b}'`);
assert.equal(
  (await db.query("select * from public.workspace_records")).rows.length,
  0,
);
assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
await assert.rejects(
  db.exec(
    `insert into public.workspace_records(user_id,kind,data) values('${a}','note','{}')`,
  ),
  /row-level security/,
);
await assert.rejects(
  db.exec(
    `insert into public.workspace_records(user_id,kind,data) values('${b}','task','{"subject_id":"${subject}"}')`,
  ),
  /must belong/,
);
await assert.rejects(
  db.exec(
    `insert into storage.objects(bucket_id,name) values('study-resources','${a}/forged.txt')`,
  ),
  /row-level security/,
);
assert.equal(
  (
    await db.query(
      `delete from storage.objects where name='${a}/resource/note.txt' returning id`,
    )
  ).rows.length,
  0,
);
await assert.rejects(
  db.exec(
    `insert into public.workspace_records(user_id,kind,data) values('${b}','admin','{}')`,
  ),
  /check constraint/,
);
await db.exec(`set request.jwt.claim.sub='${a}'`);
for (let i = 1; i <= 20; i++) {
  const result = await db.query(
    "select public.reserve_ai_request() as remaining",
  );
  assert.equal(result.rows[0].remaining, 20 - i);
}
await assert.rejects(
  db.query("select public.reserve_ai_request()"),
  /limit reached/,
);
await assert.rejects(
  db.exec("delete from public.ai_daily_usage"),
  /permission denied/,
);
await db.exec(
  `insert into public.workspace_records(user_id,kind,data) values('${a}','note','{"subject_id":"${subject}","title":"Keep this"}'),('${a}','attendance','{"subject_id":"${subject}","status":"present"}');delete from public.subjects where id='${subject}';`,
);
assert.equal(
  (
    await db.query(
      "select * from public.workspace_records where kind='attendance'",
    )
  ).rows.length,
  0,
);
assert.equal(
  (
    await db.query(
      "select data->>'subject_id' as subject from public.workspace_records where data->>'title'='Keep this'",
    )
  ).rows[0].subject,
  "",
);
await db.exec(
  "update public.workspace_records set data=data||'{\"body\":\"Still editable\"}' where data->>'title'='Keep this'",
);
await db.exec(`set request.jwt.claim.sub='${b}'`);
assert.equal(
  (await db.query("select * from public.ai_daily_usage")).rows.length,
  0,
);
assert.equal(
  (await db.query("select public.reserve_ai_request() as remaining")).rows[0]
    .remaining,
  19,
);
await db.exec(`reset role;set role anon`);
await assert.rejects(
  db.query("select public.reserve_ai_request()"),
  /permission denied/,
);
await assert.rejects(
  db.query("select * from public.workspace_records"),
  /permission denied/,
);
console.log(
  "PASS: personal records and file isolation, forged writes, linked-subject ownership, immutable kinds, quota 20/day, quota ownership, no reset, anonymous denial.",
);
await db.close();
