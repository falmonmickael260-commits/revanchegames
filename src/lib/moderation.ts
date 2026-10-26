/**
 * Modération d'image — détection de nudité sur les photos de profil.
 *
 * Serveur uniquement : ce module lit des secrets et ne doit jamais être
 * importé depuis un composant client.
 *
 * ## Pourquoi un prestataire externe
 *
 * Reconnaître une image dénudée demande un modèle de vision entraîné. Il n'y
 * a pas de raccourci honnête : ni l'extension du fichier, ni son nom, ni ses
 * dimensions ne disent quoi que ce soit de son contenu. On délègue donc à un
 * service spécialisé, derrière une interface volontairement étroite pour
 * pouvoir en changer.
 *
 * ## Quand aucun prestataire n'est configuré
 *
 * `moderateImage()` renvoie `{ checked: false }` et la photo est **acceptée**.
 * C'est un choix assumé et explicite : mieux vaut un système qui annonce
 * clairement qu'il ne vérifie rien, qu'un système qui laisse croire à une
 * protection inexistante. Le filet de sécurité est alors humain — le bouton
 * « Signaler » et la table `reports`.
 *
 * Pour activer la détection, définir côté serveur :
 *   SIGHTENGINE_USER=...
 *   SIGHTENGINE_SECRET=...
 * (offre gratuite suffisante pour des photos de profil ; voir .env.example)
 */

export type ModerationVerdict = {
  /** Faux si aucun prestataire n'est configuré : rien n'a été vérifié. */
  checked: boolean;
  /** Vrai si l'image doit être refusée. */
  rejected: boolean;
  /** Motif affichable, en français, quand `rejected`. */
  reason?: string;
};

/**
 * Seuil de refus. Sightengine renvoie des probabilités entre 0 et 1 ; au-delà
 * de cette valeur sur une classe explicite, on refuse.
 *
 * Volontairement bas sur la nudité franche et plus permissif sur le reste :
 * une photo de plage ou un torse nu ne doivent pas bloquer un joueur, une
 * image sexuellement explicite si.
 */
const EXPLICIT_THRESHOLD = 0.5;
const SUGGESTIVE_THRESHOLD = 0.8;

export function isModerationConfigured(): boolean {
  // Lu à l'appel, jamais au chargement du module — voir le piège n°1 de
  // docs/PLATFORM.md sur les variables d'environnement.
  return Boolean(process.env.SIGHTENGINE_USER && process.env.SIGHTENGINE_SECRET);
}

export async function moderateImage(image: Buffer, contentType: string): Promise<ModerationVerdict> {
  if (!isModerationConfigured()) {
    return { checked: false, rejected: false };
  }

  try {
    const form = new FormData();
    form.append("media", new Blob([new Uint8Array(image)], { type: contentType }), "avatar");
    form.append("models", "nudity-2.1");
    form.append("api_user", process.env.SIGHTENGINE_USER!);
    form.append("api_secret", process.env.SIGHTENGINE_SECRET!);

    const response = await fetch("https://api.sightengine.com/1.0/check.json", {
      method: "POST",
      body: form,
      // Une photo de profil ne vaut pas de bloquer la requête indéfiniment.
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      // Panne du prestataire : on ne bloque pas l'envoi d'une photo
      // légitime pour autant. Le signalement reste disponible.
      return { checked: false, rejected: false };
    }

    const data = (await response.json()) as {
      status?: string;
      nudity?: Record<string, unknown>;
    };

    if (data.status !== "success" || !data.nudity) {
      return { checked: false, rejected: false };
    }

    const nudity = data.nudity;
    const score = (key: string): number => {
      const value = nudity[key];
      return typeof value === "number" ? value : 0;
    };

    // Classes de nudity-2.1 : `sexual_activity`, `sexual_display` et
    // `erotica` couvrent l'explicite ; `very_suggestive` et `suggestive` sont
    // plus larges et tolérés plus haut.
    const explicit = Math.max(
      score("sexual_activity"),
      score("sexual_display"),
      score("erotica"),
    );
    const suggestive = score("very_suggestive");

    if (explicit >= EXPLICIT_THRESHOLD) {
      return {
        checked: true,
        rejected: true,
        reason:
          "Cette photo a été refusée : les images à caractère sexuel ne sont pas acceptées comme photo de profil.",
      };
    }

    if (suggestive >= SUGGESTIVE_THRESHOLD) {
      return {
        checked: true,
        rejected: true,
        reason:
          "Cette photo a été refusée : choisis une image convenable pour une plateforme ouverte à tous.",
      };
    }

    return { checked: true, rejected: false };
  } catch {
    // Délai dépassé, réseau coupé : même raisonnement que plus haut.
    return { checked: false, rejected: false };
  }
}
