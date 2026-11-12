import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { visibleAvatar } from "../src/lib/profile-media";

test("la pause masque les anciennes photos et conserve les avatars emoji", () => {
  assert.equal(visibleAvatar("https://example.com/avatar.webp"), null);
  assert.equal(visibleAvatar("HTTP://example.com/avatar.webp"), null);
  assert.equal(visibleAvatar("🦊"), "🦊");
  assert.equal(visibleAvatar(null), null);
});

test("la migration retire les images actuelles et bloque les écritures directes", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table profiles(id integer primary key, username text, avatar_url text, banner_url text);
      insert into profiles values (1,'Alice','https://example.com/photo.webp','https://example.com/banner.webp'),(2,'Bob','🦊',null);`);
    await db.exec(await readFile(new URL("../supabase/migrations/20261112090000_pause_profile_media.sql", import.meta.url), "utf8"));
    assert.deepEqual((await db.query("select avatar_url,banner_url from profiles order by id")).rows,
      [{ avatar_url: null, banner_url: null }, { avatar_url: "🦊", banner_url: null }]);
    await assert.rejects(db.exec("update profiles set avatar_url='https://example.com/new.webp' where id=1"), /temporairement désactivées/);
    await assert.rejects(db.exec("update profiles set banner_url='https://example.com/banner.webp' where id=1"), /temporairement désactivées/);
    await assert.rejects(db.exec("insert into profiles values(3,'Charlie','https://example.com/new.webp',null)"), /temporairement désactivées/);
    await db.exec("update profiles set username='Alice2',avatar_url='🎮' where id=1");
    assert.equal((await db.query<{avatar_url:string}>("select avatar_url from profiles where id=1")).rows[0].avatar_url, "🎮");
  } finally { await db.close(); }
});
