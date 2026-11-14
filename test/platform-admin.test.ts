import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("Administration : droits, comptes protégés, suspension et audit atomique", async () => {
  const db = new PGlite();
  const first = randomUUID(), second = randomUUID(), player = randomUUID(), report = randomUUID();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key,banned_until timestamptz,updated_at timestamptz,email text,email_confirmed_at timestamptz default now(),is_anonymous boolean default false);
      create table public.profiles(id uuid primary key);
      create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id));
      create table public.support_admins(user_id uuid primary key);
      create table public.reports(id uuid primary key,status text,resolved_at timestamptz);
      grant usage on schema public to anon,authenticated,service_role;`);
    await db.exec(await readFile(new URL("../supabase/migrations/20261114100000_platform_admin.sql", import.meta.url), "utf8"));
    for (const id of [first, second, player]) await db.query("insert into auth.users(id) values($1)", [id]);
    for (const id of [first, second]) await db.query("insert into support_admins(user_id) values($1)", [id]);
    await db.query("update auth.users set email='VOUS@example.com' where id=$1", [first]);
    await db.query("update auth.users set email='ASSOCIE@example.com' where id=$1", [second]);
    for (const id of [first, second]) await db.query("insert into public.profiles values($1)", [id]);
    const provisioning = await readFile(new URL("../scripts/admin/provision-two-admins.sql", import.meta.url), "utf8");
    await db.exec(provisioning);
    await db.exec(provisioning); // Repeatable, still exactly two trusted accounts.
    assert.equal((await db.query("select * from support_admins")).rows.length, 2);
    await db.query("insert into support_admins values($1)", [player]);
    await assert.rejects(db.exec(provisioning), /autre administrateur/);
    await db.exec("rollback");
    await db.query("delete from support_admins where user_id=$1", [player]);
    await assert.rejects(db.exec(provisioning.replace("ASSOCIE@example.com", "absent@example.com")), /Deux comptes distincts/);
    await db.exec("rollback");
    await db.query("insert into auth.sessions(user_id) values($1)", [player]);
    await db.query("insert into reports(id,status) values($1,'open')", [report]);
    const act = (actor: string, target: string, action: string, reason = "Motif administrateur") => db.query("select platform_admin_action($1,$2,$3,$4)", [actor, target, action, reason]);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(act(first, player, "suspend"), /permission denied/);
      await assert.rejects(db.query("select * from platform_admin_audit"), /permission denied/);
      await assert.rejects(db.query("insert into platform_admin_audit(actor_id,target_id,action,reason) values($1,$2,'suspend','faux motif')", [first, player]), /permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    await assert.rejects(act(player, first, "suspend"), /administrateur requis/);
    await assert.rejects(act(first, first, "suspend"), /protégé/);
    await assert.rejects(act(first, second, "suspend"), /protégé/);
    await assert.rejects(act(first, player, "suspend", "x"), /motif invalide/);
    await assert.rejects(act(first, player, "delete"), /action invalide/);
    await act(first, player, "suspend");
    await db.exec("reset role");
    assert.ok((await db.query<{ banned: boolean }>("select banned_until>now() as banned from auth.users where id=$1", [player])).rows[0].banned);
    assert.equal((await db.query("select * from auth.sessions")).rows.length, 0);
    assert.equal((await db.query("select * from platform_admin_audit")).rows.length, 1);
    await db.exec("set role service_role");
    await act(second, player, "restore");
    await act(first, report, "reviewing");
    await act(second, report, "resolved");
    await assert.rejects(act(first, randomUUID(), "resolved"), /introuvable/);
    await db.exec("reset role");
    assert.equal((await db.query<{ banned_until: string | null }>("select banned_until from auth.users where id=$1", [player])).rows[0].banned_until, null);
    const resolved = (await db.query<{ status: string; resolved_at: unknown }>("select * from reports")).rows[0];
    assert.equal(resolved.status, "resolved"); assert.ok(resolved.resolved_at);
    assert.equal((await db.query("select * from platform_admin_audit")).rows.length, 4);
    // A failed audit insert must roll back the ban and session deletion.
    await db.exec("alter table platform_admin_audit add constraint reject_suspension check(action<>'suspend') not valid");
    await assert.rejects(act(first, player, "suspend"), /reject_suspension/);
    assert.equal((await db.query<{ banned_until: string | null }>("select banned_until from auth.users where id=$1", [player])).rows[0].banned_until, null);
  } finally { await db.close(); }
});
