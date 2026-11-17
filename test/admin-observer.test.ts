import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import {
  observerResponse,
  verifyObserver,
} from "../vendor/admin-observer/server.mjs";
test("Spectateur : signature, audience, expiration, limite et absence d’admission", async () => {
  const key = "only-a-local-test-key",
    stamp = String(Math.floor(Date.now() / 1000));
  const command = {
    v: 1,
    game: "president",
    operation: "snapshot",
    actor: randomUUID(),
    access: randomUUID(),
    room: "ROOM",
    instance: "ROOM:1",
  };
  const raw = JSON.stringify(command);
  const sign = (body: string) =>
    `${stamp}.${createHmac("sha256", key).update(`rg-admin-observer-v1.${stamp}.${body}`).digest("hex")}`;
  assert.equal(verifyObserver(raw, sign(raw), "president", key).room, "ROOM");
  assert.throws(() => verifyObserver(raw, sign(raw), "la-meute", key));
  assert.throws(() =>
    verifyObserver(raw, sign(raw), "president", key, Date.now() + 60000),
  );
  assert.throws(() => verifyObserver(raw, sign(raw) + "x", "president", key));
  const forged = JSON.stringify({ ...command, operation: "admit" });
  assert.throws(() => verifyObserver(forged, sign(forged), "president", key));
  const request = (body: string, signature: string) =>
    new Request("https://game.test/api/platform/observer", {
      method: "POST",
      headers: { "x-rg-signature": signature },
      body,
    });
  let snapshots = 0;
  const snapshot = (room: string, instance: string) => {
    snapshots++;
    return room === "ROOM" && instance === "ROOM:1"
      ? { players: [{ name: "Joueur", cardCount: 5 }], pile: [] }
      : null;
  };
  const denied = await observerResponse(
    request(raw, "forged"),
    "president",
    snapshot,
    key,
  );
  assert.equal(denied.status, 403);
  assert.equal(snapshots, 0);
  const response = await observerResponse(
    request(raw, sign(raw)),
    "president",
    snapshot,
    key,
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.publicState.players[0].cardCount, 5);
  assert.equal(snapshots, 1);
  assert.equal(
    (
      await observerResponse(
        request("x".repeat(2049), sign(raw)),
        "president",
        snapshot,
        key,
      )
    ).status,
    403,
  );
});
