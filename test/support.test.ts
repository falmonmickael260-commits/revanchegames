import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import sharp from "sharp";
import { normalizeScreenshot } from "../src/lib/support-server";
import { readLimitedBody, requireSameOrigin } from "../src/lib/request-security";

test("Assistance : image réelle, format, taille et métadonnées", async () => {
  const jpeg = await sharp({ create: { width: 64, height: 32, channels: 3, background: "red" } }).withMetadata().jpeg().toBuffer();
  const output = await normalizeScreenshot(new File([new Uint8Array(jpeg)], "capture.jpg", { type: "image/jpeg" }));
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 64); assert.equal(metadata.exif, undefined);
  await assert.rejects(normalizeScreenshot(new File(["<script>alert(1)</script>"], "fake.png", { type: "image/png" })), /image valide/);
  await assert.rejects(normalizeScreenshot(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>'], "fake.png", { type: "image/png" })), /image valide/);
  await assert.rejects(normalizeScreenshot(new File([jpeg], "capture.svg", { type: "image/svg+xml" })), /Formats acceptés/);
  await assert.rejects(normalizeScreenshot(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "huge.png", { type: "image/png" })), /5 Mo/);
});

test("Routes privées : corps borné même sans Content-Length et CSRF", async () => {
  const bytes = await readLimitedBody(new Request("https://shop.test/api", { method: "POST", body: "abc" }), 3);
  assert.equal(Buffer.from(bytes).toString(), "abc");
  await assert.rejects(readLimitedBody(new Request("https://shop.test/api", { method: "POST", body: "abcd" }), 3), /volumineux/);
  await assert.rejects(readLimitedBody(new Request("https://shop.test/api", { method: "POST", headers: { "Content-Length": "100" }, body: "a" }), 3), /volumineux/);
  const old = process.env.STRIPE_SITE_URL;
  try {
    process.env.STRIPE_SITE_URL = "https://shop.test";
    requireSameOrigin(new Request("https://internal.test/api", { headers: { Origin: "https://shop.test" } }));
    assert.throws(() => requireSameOrigin(new Request("https://internal.test/api", { headers: { Origin: "https://evil.test", Host: "evil.test" } })), /Origine refusée/);
    assert.throws(() => requireSameOrigin(new Request("https://internal.test/api")), /Origine refusée/);
  } finally { if (old === undefined) delete process.env.STRIPE_SITE_URL; else process.env.STRIPE_SITE_URL = old; }
});

test("Assistance : vrais RLS, RPC, notifications et administration PostgreSQL", async (t) => {
  const db = new PGlite();
  const owner = randomUUID(), other = randomUUID(), admin = randomUUID(), unconfirmed = randomUUID(), anonymous = randomUUID();
  const ticket = randomUUID();
  const login = async (id: string, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec(`set role ${role}`);
  };
  const create = (id = randomUUID(), category = "missing_coins") => db.query("select create_support_ticket($1,$2,'Paiement sans pièces','Ma demande concerne un paiement sans réception de pièces.','pi_test',true)", [id, category]);
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz default now(),is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated;
      grant execute on function auth.uid() to authenticated;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    for (const file of ["20261025000000_platform_core.sql", "20261101010000_support_tickets.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    for (const id of [owner, other, admin, unconfirmed, anonymous]) await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query("update auth.users set email_confirmed_at=null where id=$1", [unconfirmed]);
    await db.query("update auth.users set is_anonymous=true where id=$1", [anonymous]);
    await db.query("insert into support_admins(user_id) values($1)", [admin]);
    await t.test("visiteurs, comptes anonymes et e-mails non confirmés refusés", async () => {
      await login("", "anon"); await assert.rejects(create(), /permission denied/);
      await login(unconfirmed); await assert.rejects(create(), /confirmée requise/);
      await login(anonymous); await assert.rejects(create(), /confirmée requise/);
    });
    await t.test("création, identifiant unique et capture rattachée au propriétaire", async () => {
      await login(owner); await create(ticket); await create(ticket);
      const rows = (await db.query<{ attachment_path: string }>("select * from support_tickets")).rows;
      assert.equal(rows.length, 1); assert.equal(rows[0].attachment_path, `${owner}/${ticket}.webp`);
      assert.equal((await db.query("select * from support_ticket_events")).rows.length, 1);
      assert.equal((await db.query("select * from support_notifications")).rows.length, 1);
    });
    await t.test("un autre joueur ne voit ni ticket, ni messages, ni statuts, ni notifications privées", async () => {
      await login(other);
      for (const table of ["support_tickets", "support_messages", "support_ticket_events", "support_notifications", "support_admins"]) {
        assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
      }
      await assert.rejects(create(ticket), /indisponible/);
      await assert.rejects(db.query("select reply_support_ticket($1,'Accès interdit',null)", [ticket]), /introuvable/);
    });
    await t.test("aucune auto-promotion, écriture directe ou suppression silencieuse", async () => {
      await login(owner);
      await assert.rejects(db.query("insert into support_admins(user_id) values($1)", [owner]), /permission denied/);
      await assert.rejects(db.query("update support_tickets set status='resolved'"), /permission denied/);
      await assert.rejects(db.query("delete from support_tickets"), /permission denied/);
      await assert.rejects(db.query("select reply_support_ticket($1,'Je me résous','resolved')", [ticket]), /administrateur requis/);
    });
    await t.test("réponse admin, notifications privées et suivi de statut", async () => {
      await login(admin);
      assert.equal((await db.query("select * from support_tickets")).rows.length, 1);
      await db.query("select reply_support_ticket($1,'Nous vérifions le paiement.','in_progress')", [ticket]);
      await login(owner);
      assert.equal((await db.query<{ status: string }>("select status from support_tickets")).rows[0].status, "in_progress");
      assert.equal((await db.query<{ from_admin: boolean }>("select from_admin from support_messages")).rows[0].from_admin, true);
      assert.equal((await db.query("select * from support_notifications where read_at is null")).rows.length, 3);
      await db.exec("select read_support_notifications()");
      assert.equal((await db.query("select * from support_notifications where read_at is null")).rows.length, 0);
      await login(admin); assert.equal((await db.query("select * from support_notifications where read_at is null")).rows.length, 1);
    });
    await t.test("résolution puis réponse joueur : réouverture et historique conservé", async () => {
      await db.query("select reply_support_ticket($1,'Le problème est résolu.','resolved')", [ticket]);
      await login(owner);
      await db.query("select reply_support_ticket($1,'Je rencontre toujours le problème.',null)", [ticket]);
      assert.equal((await db.query<{ status: string }>("select status from support_tickets")).rows[0].status, "received");
      assert.equal((await db.query("select * from support_ticket_events")).rows.length, 4);
      assert.equal((await db.query("select * from support_messages")).rows.length, 3);
    });
    await t.test("texte SQL et HTML traité comme des données, catégories et longueurs vérifiées", async () => {
      const id = randomUUID();
      await db.query("select create_support_ticket($1,'other',$2,$3,null,false)", [id, "<script>alert(1)</script>", "'); drop table public.profiles; -- ceci est une description"]);
      assert.equal((await db.query<{ subject: string }>("select subject from support_tickets where id=$1", [id])).rows[0].subject, "<script>alert(1)</script>");
      await assert.rejects(create(randomUUID(), "forged"), /check constraint/);
      await assert.rejects(db.query("select create_support_ticket($1,'other','ok','court',null,false)", [randomUUID()]), /check constraint/);
    });
    await t.test("limites persistantes, y compris via l’API Supabase directe", async () => {
      for (let i = 0; i < 3; i++) await create();
      await assert.rejects(create(), /trop de demandes/);
      for (let i = 0; i < 29; i++) await db.query("select reply_support_ticket($1,'Complément',null)", [ticket]);
      await assert.rejects(db.query("select reply_support_ticket($1,'Spam',null)", [ticket]), /trop de réponses/);
    });
    await db.exec("reset role");
    assert.equal((await db.query<{ public: boolean }>("select public from storage.buckets where id='support-attachments'")).rows[0].public, false);
  } finally { await db.close(); }
});
