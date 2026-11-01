import { test } from "node:test";
import assert from "node:assert/strict";
import { canJoinVoice, voiceMetadata } from "../src/lib/voice-shared";

const host = "11111111-1111-4111-8111-111111111111";
test("Les espaces vocaux des jeux ne sont jamais exposés dans les salles sociales", () => {
  const metadata = JSON.stringify({ kind: "rg-social-voice-v1", hostId: host, hostName: "Alice", title: "Amis" });
  assert.equal(voiceMetadata("game-ABC", metadata), null);
  assert.equal(voiceMetadata(`rg-social-${host}`, "{}"), null);
  assert.equal(voiceMetadata(`rg-social-${host}`, "malformed"), null);
  assert.equal(voiceMetadata(`rg-social-${host}`, JSON.stringify({ kind: "rg-social-voice-v1", hostId: "someone-else", hostName: "Alice", title: "Amis" })), null);
  assert.equal(voiceMetadata(`rg-social-${host}`, metadata)?.hostId, host);
});

test("Seuls l’hôte et ses amis actuels accèdent au vocal", () => {
  const room = { hostId: host };
  assert.equal(canJoinVoice(room, host, new Set()), true);
  assert.equal(canJoinVoice(room, "friend", new Set([host])), true);
  assert.equal(canJoinVoice(room, "stranger", new Set()), false);
  assert.equal(canJoinVoice(room, "blocked-or-removed", new Set(["another-host"])), false);
});
