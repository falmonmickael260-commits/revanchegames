import { test } from "node:test";
import assert from "node:assert/strict";
import { canJoinVoice, voiceMetadata, readVoiceChat, voiceAvatar } from "../src/lib/voice-shared";

const host = "11111111-1111-4111-8111-111111111111";
test("Les espaces vocaux des jeux ne sont jamais exposés dans les salles sociales", () => {
  const metadata = JSON.stringify({ kind: "rg-social-voice-v1", hostId: host, hostName: "Alice", title: "Amis" });
  assert.equal(voiceMetadata("game-ABC", metadata), null);
  assert.equal(voiceMetadata(`rg-social-${host}`, "{}"), null);
  assert.equal(voiceMetadata(`rg-social-${host}`, "malformed"), null);
  assert.equal(voiceMetadata(`rg-social-${host}`, JSON.stringify({ kind: "rg-social-voice-v1", hostId: "someone-else", hostName: "Alice", title: "Amis" })), null);
  assert.equal(voiceMetadata(`rg-social-${host}`, metadata)?.hostId, host);
  assert.equal(voiceMetadata(`rg-social-${host}`, metadata)?.visibility, "friends");
  assert.equal(voiceMetadata(`rg-social-${host}`, JSON.stringify({ ...JSON.parse(metadata), visibility: "public" }))?.visibility, "public");
});

test("Seuls l’hôte et ses amis actuels accèdent au vocal", () => {
  const room = { hostId: host };
  assert.equal(canJoinVoice(room, host, new Set()), true);
  assert.equal(canJoinVoice(room, "friend", new Set([host])), true);
  assert.equal(canJoinVoice(room, "stranger", new Set()), false);
  assert.equal(canJoinVoice(room, "blocked-or-removed", new Set(["another-host"])), false);
  assert.equal(canJoinVoice({ ...room, visibility: "public" }, "member", new Set()), true);
  assert.equal(canJoinVoice({ ...room, visibility: "public" }, "blocked", new Set(), new Set([host])), false);
});

test("Chat vocal : taille, texte et identité du participant transportés séparément", () => {
  const encode = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
  const id = "22222222-2222-4222-8222-222222222222";
  assert.deepEqual(readVoiceChat(encode({ id, body: " Bonjour ", username: "Faux hôte", userId: host })), { id, body: "Bonjour" });
  for (const value of [{ id, body: " " }, { id, body: "x".repeat(501) }, { id: "bad", body: "Bonjour" }, null]) assert.equal(readVoiceChat(encode(value)), null);
  assert.equal(readVoiceChat(new Uint8Array(4097)), null);
  assert.equal(voiceAvatar('{"avatarUrl":"https://example.com/photo.png"}'), "https://example.com/photo.png");
  assert.equal(voiceAvatar("bad"), null);
});
