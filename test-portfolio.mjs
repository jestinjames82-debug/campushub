import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610080005_portfolios.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const alice = "10000000-0000-4000-8000-000000000001";
  const bob = "10000000-0000-4000-8000-000000000002";
  const slug = "20000000-0000-4000-8000-000000000001";
  const missingSlug = "20000000-0000-4000-8000-000000000002";
  await db.exec(
    `insert into auth.users values ('${alice}'), ('${bob}'); set role authenticated; set request.jwt.claim.sub='${alice}';`,
  );
  await db.exec(`insert into public.public_portfolios(user_id,slug,name,headline,summary,skills,education,projects,links)
    values ('${alice}','${slug}','Alice Student','Frontend developer','Public profile','TypeScript','B.Tech','Built a study app','https://example.edu/work');`);
  assert.equal(
    (await db.query("select * from public.public_portfolios")).rows.length,
    1,
    "owner can read draft",
  );
  await assert.rejects(
    db.exec(
      `update public.public_portfolios set user_id='${bob}' where user_id='${alice}'`,
    ),
    /row-level security/,
  );
  await assert.rejects(
    db.exec(`update public.public_portfolios set headline=repeat('x',181)`),
    /check constraint/,
  );

  await db.exec(`set request.jwt.claim.sub='${bob}'`);
  assert.equal(
    (await db.query("select * from public.public_portfolios")).rows.length,
    0,
    "other users cannot inspect draft or owner table",
  );
  assert.equal(
    (
      await db.query(
        `update public.public_portfolios set published=true where user_id='${alice}' returning slug`,
      )
    ).rows.length,
    0,
    "other users cannot publish a draft",
  );
  assert.equal(
    (
      await db.query(
        `delete from public.public_portfolios where user_id='${alice}' returning slug`,
      )
    ).rows.length,
    0,
    "other users cannot remove a portfolio",
  );
  await assert.rejects(
    db.exec(
      `insert into public.public_portfolios(user_id,name,headline) values('${alice}','Forged','Forged')`,
    ),
    /row-level security/,
  );

  await db.exec("reset role; set role anon; set request.jwt.claim.sub='';");
  await assert.rejects(
    db.query("select * from public.public_portfolios"),
    /permission denied/,
  );
  assert.equal(
    (await db.query(`select * from public.get_public_portfolio('${slug}')`))
      .rows.length,
    0,
    "draft is not public even with exact link",
  );

  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${alice}'; update public.public_portfolios set published=true where user_id='${alice}';`,
  );
  await db.exec("reset role; set role anon; set request.jwt.claim.sub='';");
  const visible = (
    await db.query(`select * from public.get_public_portfolio('${slug}')`)
  ).rows;
  assert.equal(
    visible.length,
    1,
    "published snapshot accessible anonymously by exact slug",
  );
  assert.deepEqual(
    Object.keys(visible[0]).sort(),
    ["education", "headline", "links", "name", "projects", "skills", "summary"],
    "RPC exposes exact approved fields, no contact, user id or other private records",
  );
  assert.equal(visible[0].name, "Alice Student");
  assert.equal(
    (
      await db.query(
        `select * from public.get_public_portfolio('${missingSlug}')`,
      )
    ).rows.length,
    0,
    "different UUID does not enumerate snapshots",
  );
  assert.equal(
    (await db.query("select * from public.get_public_portfolio(null)")).rows
      .length,
    0,
  );
  await assert.rejects(
    db.query(
      `update public.public_portfolios set name='Defaced' where slug='${slug}'`,
    ),
    /permission denied/,
  );

  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${bob}';`,
  );
  assert.equal(
    (await db.query("select * from public.public_portfolios")).rows.length,
    0,
    "owner metadata remains private after publishing",
  );
  assert.equal(
    (await db.query(`select * from public.get_public_portfolio('${slug}')`))
      .rows.length,
    1,
    "authenticated viewers have the same public lookup",
  );
  await db.exec(
    `set request.jwt.claim.sub='${alice}'; update public.public_portfolios set summary='Revised snapshot' where user_id='${alice}';`,
  );
  assert.equal(
    (await db.query(`select * from public.get_public_portfolio('${slug}')`))
      .rows[0].summary,
    "Revised snapshot",
    "owner can republish an edited snapshot",
  );
  await db.exec(
    `update public.public_portfolios set published=false where user_id='${alice}'; reset role; set role anon; set request.jwt.claim.sub='';`,
  );
  assert.equal(
    (await db.query(`select * from public.get_public_portfolio('${slug}')`))
      .rows.length,
    0,
    "unpublishing immediately revokes new reads",
  );
  await db.exec(`reset role; delete from auth.users where id='${alice}';`);
  assert.equal(
    (await db.query("select * from public.public_portfolios")).rows.length,
    0,
    "account deletion removes its publication",
  );
  console.log(
    "PASS: public portfolios opt in, exact-slug lookup, seven-field allowlist, owner isolation, forged ownership, read/write denial, publishing, snapshot updates, immediate revocation and account cascade.",
  );
} finally {
  await db.close();
}
