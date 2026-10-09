import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
);
await db.exec(
  await readFile(
    new URL("../supabase/migrations/202610080001_phase1.sql", import.meta.url),
    "utf8",
  ),
);
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002",
  term = "20000000-0000-4000-8000-000000000001";
await db.exec(
  `insert into auth.users values ('${a}'),('${b}');set role authenticated;set request.jwt.claim.sub='${a}';`,
);
await db.exec(
  `insert into public.profiles(id,full_name,college,programme,admission_year,term_system) values('${a}','Student A','Any College','B.A.',2026,'Annual');insert into public.academic_terms(id,user_id,name,starts_on,ends_on) values('${term}','${a}','Year One','2026-07-01','2027-06-01');insert into public.subjects(user_id,term_id,name,code,credits) values('${a}','${term}','History','HI101',3);`,
);
assert.equal((await db.query("select * from public.subjects")).rows.length, 1);
await db.exec(`set request.jwt.claim.sub='${b}'`);
for (const table of ["profiles", "academic_terms", "subjects"])
  assert.equal(
    (await db.query(`select * from public.${table}`)).rows.length,
    0,
    `${table}: no cross-user reads`,
  );
await assert.rejects(
  db.exec(
    `insert into public.academic_terms(user_id,name,starts_on,ends_on) values('${a}','Forged','2026-01-01','2026-12-01')`,
  ),
  /row-level security/,
);
await assert.rejects(
  db.exec(
    `insert into public.subjects(user_id,term_id,name,code,credits) values('${b}','${term}','Cross owner','XX1',2)`,
  ),
  /foreign key/,
);
assert.equal(
  (
    await db.query(
      `update public.academic_terms set name='Hacked' where id='${term}' returning id`,
    )
  ).rows.length,
  0,
);
assert.equal(
  (
    await db.query(
      `delete from public.academic_terms where id='${term}' returning id`,
    )
  ).rows.length,
  0,
);
await assert.rejects(
  db.exec(
    `insert into public.profiles(id,full_name,college,programme,admission_year,term_system) values('${a}','Forged Student','Bad College','B.A.',2026,'Annual')`,
  ),
);
await db.exec(`set request.jwt.claim.sub='${a}'`);
await assert.rejects(
  db.exec(`update public.academic_terms set user_id='${b}' where id='${term}'`),
  /row-level security/,
);
await assert.rejects(
  db.exec(
    `update public.academic_terms set ends_on='2025-01-01' where id='${term}'`,
  ),
  /check constraint/,
);
await assert.rejects(
  db.exec(`update public.subjects set credits=-1`),
  /check constraint/,
);
await db.exec(`delete from public.academic_terms where id='${term}'`);
assert.equal(
  (await db.query("select * from public.subjects")).rows.length,
  0,
  "Term deletion cascades",
);
await db.exec("reset role;set role anon");
for (const table of ["profiles", "academic_terms", "subjects"])
  await assert.rejects(
    db.query(`select * from public.${table}`),
    /permission denied/,
  );
console.log(
  "PASS: owner CRUD, isolation for 3 tables, forged owner, cross-owner term reference, unauthorized update/delete, ownership transfer, invalid dates/credits, cascade and anonymous access.",
);
await db.close();
