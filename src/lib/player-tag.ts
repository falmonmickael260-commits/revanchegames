/**
 * Mise en forme de l'identifiant fixe du joueur.
 *
 * La valeur elle-même (`profiles.player_tag`) est choisie une seule fois par
 * le joueur et ne peut plus être changée ensuite (voir `set_player_tag` et
 * ProfileEditor.tsx) — contrairement au pseudonyme, modifiable à volonté.
 * Le préfixe "RG-" n'est que de la présentation : il n'est jamais stocké, et
 * n'a pas besoin d'être tapé pour retrouver quelqu'un (voir `search_players`).
 */
export function formatPlayerTag(tag: string): string {
  return `RG-${tag}`;
}
