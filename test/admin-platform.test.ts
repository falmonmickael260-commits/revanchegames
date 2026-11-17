import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Administration : permissions SQL, MFA, économie, preuves et assistance", async (t) => {
  const db = new PGlite();
  const owner = randomUUID(),
    admin = randomUUID(),
    moderator = randomUUID(),
    support = randomUUID(),
    player = randomUUID(),
    other = randomUUID();
  const login = async (id: string, aal = "aal2", role = "authenticated") => {
    await db.exec("reset role");
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",
      [id, aal],
    );
    await db.exec(`set role ${role}`);
  };
  const execute = (
    action: string,
    payload: Record<string, unknown>,
    id = randomUUID(),
  ) =>
    db.query<{ admin_execute: unknown }>(action === "promo" ? "select admin_save_promo($1,$2) as admin_execute" : "select admin_execute($1,$2,$3)", action === "promo" ? [id, { reason: "Vérification administrateur", ...payload }] : [
      id,
      action,
      { reason: "Vérification administrateur", ...payload },
    ]);
  const query = (section: string, target: string | null = null, search = "") =>
    db.query<{ admin_query: Record<string, unknown> }>(
      "select admin_query($1,$2,$3,0)",
      [section, search, target],
    );
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz default now(),is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
      grant usage on schema auth,public to anon,authenticated;
      create publication supabase_realtime;
      create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;`);
    for (const file of [
      "20261025000000_platform_core.sql",
      "20261026030000_social_core.sql",
      "20261026040000_direct_messages.sql",
      "20261026130000_signature_and_reports.sql",
      "20261031030000_wallet_trigger_fix.sql",
      "20261031000000_promo_codes.sql",
      "20261031020000_role_reservations.sql",
      "20261031040000_role_selection_deferred_charge.sql",
      "20261101000000_stripe_shop.sql",
      "20261101010000_support_tickets.sql",
      "20261105000000_virtual_gifts_schema.sql",
      "20261117000000_platform_administration.sql",
      "20261117010000_admin_read_models.sql",
      "20261117020000_admin_observer_access.sql",
      "20261117030000_admin_reconciliation.sql",
      "20261117200711_promo_code_creation.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      "alter table room_registry add column refreshed_at timestamptz,add column instance_key text",
    );
    await db.exec(
      "grant select on profiles,wallet_accounts,wallet_ledger,reports,chat_messages to authenticated; grant insert on chat_messages to authenticated",
    );
    for (const [id, username] of [
      [owner, "Propriétaire"],
      [admin, "Admin"],
      [moderator, "Modérateur"],
      [support, "Assistance"],
      [player, "Joueur"],
      [other, "Autre"],
    ])
      await db.query(
        "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
        [id, { username }],
      );
    for (const [id, role] of [
      [owner, "owner"],
      [admin, "admin"],
      [moderator, "moderator"],
      [support, "support"],
    ])
      await db.query("insert into admin_members(user_id,role) values($1,$2)", [
        id,
        role,
      ]);
    await t.test(
      "refus visiteur, joueur, auto-promotion et administrateur sans MFA",
      async () => {
        await login("", "aal1", "anon");
        await assert.rejects(query("dashboard"), /permission denied/);
        await login(player);
        await assert.rejects(query("dashboard"), /non autorisée/);
        await assert.rejects(
          db.query(
            "insert into admin_members(user_id,role) values($1,'owner')",
            [player],
          ),
          /permission denied/,
        );
        await login(owner, "aal1");
        await assert.rejects(query("dashboard"), /non autorisée/);
        await assert.rejects(
          execute("wallet", { target: player, delta: 100 }),
          /non autorisée/,
        );
      },
    );
    await t.test(
      "propriétaire : crédit dans le portefeuille existant, une fois, audit atomique",
      async () => {
        await login(owner);
        const key = randomUUID(),
          payload = { target: player, delta: 100 };
        await execute("wallet", payload, key);
        await execute("wallet", payload, key);
        assert.equal(
          (
            (await query("player", player)).rows[0].admin_query.profile as {
              balance_coins: number;
            }
          ).balance_coins,
          100,
        );
        assert.equal(
          (await db.query("select * from admin_audit where id=$1", [key])).rows
            .length,
          1,
        );
        await assert.rejects(
          execute("wallet", { target: player, delta: 101 }, key),
          /déjà utilisé/,
        );
        await assert.rejects(
          execute("wallet", { target: player, delta: -101 }),
          /insuffisant/,
        );
        await assert.rejects(
          execute("wallet", { target: player, delta: 1, reason: "" }),
          /motif obligatoire/,
        );
        await login(player);
        assert.equal(
          (await db.query("select * from wallet_ledger")).rows.length,
          1,
        );
        await assert.rejects(
          db.exec("delete from admin_audit"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "droits de crédit explicites, séparation assistance/modération/économie",
      async () => {
        await login(admin);
        await assert.rejects(
          execute("wallet", { target: player, delta: 20 }),
          /non autorisée/,
        );
        await login(owner);
        await execute("member", {
          target: admin,
          role: "admin",
          canCredit: true,
          enabled: true,
        });
        await login(admin);
        await execute("wallet", { target: player, delta: 20 });
        await assert.rejects(
          execute("member", { target: player, role: "owner" }),
          /non autorisée/,
        );
        await login(moderator);
        await assert.rejects(query("payments"), /non autorisée/);
        await assert.rejects(query("tickets"), /non autorisée/);
        await login(support);
        await assert.rejects(query("reports"), /non autorisée/);
        await assert.rejects(
          execute("wallet", { target: player, delta: 1 }),
          /non autorisée/,
        );
      },
    );
    await t.test(
      "restriction tchat immédiate en RLS et levée traçable",
      async () => {
        await login(moderator);
        const id = randomUUID();
        await execute(
          "sanction",
          {
            target: player,
            kind: "mute",
            expires: new Date(Date.now() + 3600000).toISOString(),
          },
          id,
        );
        await login(player);
        await assert.rejects(
          db.query(
            "insert into chat_messages(user_id,body) values($1,'Bonjour')",
            [player],
          ),
          /restreinte|row-level security/,
        );
        assert.equal(
          (
            await db.query<{ my_platform_access: { chatRestricted: boolean } }>(
              "select my_platform_access()",
            )
          ).rows[0].my_platform_access.chatRestricted,
          true,
        );
        await login(moderator);
        await execute("revoke", { target: id });
        await login(player);
        await db.query(
          "insert into chat_messages(user_id,body) values($1,'Bonjour')",
          [player],
        );
      },
    );
    await t.test(
      "preuve serveur conservée après suppression, pièces jointes privées",
      async () => {
        await login(other);
        await db.query(
          "insert into chat_messages(user_id,body) values($1,'Message signalé')",
          [other],
        );
        await db.exec("reset role");
        const msg = (
          await db.query<{ id: string }>(
            "select id from chat_messages where user_id=$1",
            [other],
          )
        ).rows[0].id;
        const report = randomUUID();
        await login(player);
        await db.query(
          "select submit_evidenced_report($1,'message',$2,'general','Explication du signalement',$3,true)",
          [report, other, msg],
        );
        await assert.rejects(
          db.query(
            "select submit_evidenced_report($1,'message',$2,'general','Preuve inventée',$3,false)",
            [randomUUID(), other, randomUUID()],
          ),
          /introuvable/,
        );
        await db.exec("reset role");
        await db.query("delete from chat_messages where id=$1", [msg]);
        await db.query(
          "insert into storage.objects(bucket_id,name) values('report-evidence',$1)",
          [`${player}/${report}.webp`],
        );
        await login(player);
        assert.equal(
          (await db.query("select * from report_evidence")).rows.length,
          0,
        );
        assert.equal(
          (await db.query("select * from storage.objects")).rows.length,
          0,
        );
        await login(moderator);
        const evidence = (await query("report", report)).rows[0].admin_query
          .evidence as { snapshot: { message: { body: string } } };
        assert.equal(evidence.snapshot.message.body, "Message signalé");
        assert.equal(
          (await db.query("select * from storage.objects")).rows.length,
          1,
        );
        await execute("note", {
          target: report,
          type: "report",
          body: "Note privée de l’équipe",
        });
        await execute("report", { target: report, status: "resolved" });
        await login(player);
        assert.equal(
          (await db.query("select * from admin_notes")).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query<{ status: string }>(
              "select status from reports where id=$1",
              [report],
            )
          ).rows[0].status,
          "resolved",
        );
      },
    );
    await t.test(
      "réponse assistance visible par le joueur, note interne privée, idempotence",
      async () => {
        await login(player);
        const ticket = randomUUID();
        await db.query(
          "select create_support_ticket($1,'game_issue','Partie bloquée','Je rencontre un problème en rejoignant ma partie.',null,false)",
          [ticket],
        );
        await login(support);
        const key = randomUUID();
        const p = {
          target: ticket,
          body: "Nous examinons votre demande.",
          status: "in_progress",
        };
        await execute("ticket", p, key);
        await execute("ticket", p, key);
        await execute("note", {
          target: ticket,
          type: "ticket",
          body: "Diagnostic réservé à l’équipe",
        });
        await execute("assign", {
          target: ticket,
          type: "ticket",
          assignee: support,
        });
        await login(player);
        assert.equal(
          (await db.query("select * from support_messages")).rows.length,
          1,
        );
        assert.equal(
          (await db.query("select * from admin_notes")).rows.length,
          0,
        );
        await login(other);
        assert.equal(
          (await db.query("select * from support_messages")).rows.length,
          0,
        );
      },
    );
    await t.test(
      "observation auditée : pas d’accès transmis entre administrateurs et expiration",
      async () => {
        await db.exec("reset role");
        const room = randomUUID(),
          access = randomUUID();
        await db.query(
          "insert into room_registry(id,game_slug,room_code,instance_key) values($1,'president','ADMIN','ADMIN:1')",
          [room],
        );
        await login(owner);
        await execute("spectate", { target: room }, access);
        const observed = (
          await db.query<{ admin_observer_room: { instance: string } }>(
            "select admin_observer_room($1,$2)",
            [room, access],
          )
        ).rows[0].admin_observer_room;
        assert.equal(observed.instance, "ADMIN:1");
        await login(moderator);
        await assert.rejects(
          db.query("select admin_observer_room($1,$2)", [room, access]),
          /expiré/,
        );
        await login(support);
        await assert.rejects(
          execute("spectate", { target: room }),
          /non autorisée/,
        );
        await db.exec("reset role");
        await db.query(
          "update admin_audit set created_at=now()-interval '31 minutes' where id=$1",
          [access],
        );
        await login(owner);
        await assert.rejects(
          db.query("select admin_observer_room($1,$2)", [room, access]),
          /expiré/,
        );
      },
    );
    await t.test(
      "retrait : les pièces réservées par un jeu restent protégées",
      async () => {
        await db.exec("reset role");
        await db.query(
          "select reserve_role('la-meute','ADMIN-HOLD',$1,'hunter',100,$2,clock_timestamp()+interval '10 seconds')",
          [player, randomUUID()],
        );
        await login(owner);
        await assert.rejects(
          execute("wallet", { target: player, delta: -30 }),
          /insuffisant/,
        );
        await db.exec("reset role");
        await db.exec(
          "select cancel_role_reservations('la-meute','ADMIN-HOLD')",
        );
      },
    );
    await t.test(
      "maintenance, annonces, dernier propriétaire protégé et recherche liée",
      async () => {
        await login(owner);
        await execute("game", {
          slug: "president",
          maintenance: true,
          message: "Maintenance prévue",
        });
        await execute("announce", {
          body: "Une nouvelle mise à jour est disponible.",
        });
        await assert.rejects(
          execute("member", { target: owner, role: "support", enabled: true }),
          /dernier propriétaire/,
        );
        const data = (
          await query("players", null, "'; drop table profiles; --")
        ).rows[0].admin_query;
        assert.deepEqual(data.rows, []);
        assert.ok((await query("player", player)).rows[0].admin_query.profile);
        assert.equal((await query("dashboard")).rows[0].admin_query.activeLast2m, null);
      for (const s of [
          "session",
          "dashboard",
          "players",
          "reports",
          "tickets",
          "sanctions",
          "wallet",
          "payments",
          "gifts",
          "rev",
          "games",
          "results",
          "members",
          "audit",
          "announcements",
        ])
          assert.ok((await query(s)).rows[0].admin_query, s);
        await login(support, "aal1");
        await assert.rejects(query("tickets"), /non autorisée/);
      },
    );
    await t.test("codes promo : création puis crédit du seul compte qui saisit le code", async () => {
      await login(owner);
      await execute("member", { target: admin, role: "admin", canCredit: false, enabled: true });
      await login(admin);
      const operation = randomUUID();
      const payload = { code: " test-promo_37 ", coins: 37, active: true, limit: 2, expires: "" };
      const created = await execute("promo", payload, operation);
      const result = created.rows[0].admin_execute as { code: string; reward_coins: number };
      assert.equal(result.code, "TEST-PROMO_37");
      assert.equal(result.reward_coins, 37);
      await execute("promo", payload, operation);
      await login(player);
      const before = Number((await db.query("select balance_coins from wallet_accounts where user_id=$1", [player])).rows[0]?.balance_coins || 0);
      const redeemed = await db.query<{ reward_coins: number; new_balance: number }>("select * from redeem_promo_code(' test-promo_37 ')");
      assert.equal(redeemed.rows[0].reward_coins, 37);
      assert.equal(Number(redeemed.rows[0].new_balance), before + 37);
      await assert.rejects(db.query("select * from redeem_promo_code('TEST-PROMO_37')"), /déjà utilisé/);
      await login(other);
      const received = await db.query<{ reward_coins: number }>("select * from redeem_promo_code('TEST-PROMO_37')");
      assert.equal(received.rows[0].reward_coins, 37);
      await login(owner);
      await assert.rejects(db.query("select * from redeem_promo_code('TEST-PROMO_37')"), /invalide|expiré/);
      await assert.rejects(execute("promo", {code:"BAD CODE",coins:50,active:true}), /Code promo invalide/);
      await assert.rejects(execute("promo", {code:"BADAMOUNT",coins:0,active:true}), /Nombre de pièces/);
      await assert.rejects(execute("promo", {code:"PASTDATE",coins:10,active:true,expires:"2000-01-01"}), /Date d’expiration/);
      await login(support);
      await assert.rejects(execute("promo", {code:"NOTALLOWED",coins:50,active:true}), /non autorisée/);
    });
  } finally {
    await db.close();
  }
});
