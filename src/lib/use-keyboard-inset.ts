"use client";

import { useEffect, useState } from "react";

/**
 * Hauteur, en pixels, masquée en bas de l'écran par le clavier virtuel.
 *
 * Pourquoi ce n'est pas gratuit : un panneau en `position: fixed; bottom: 0`
 * est calé sur le viewport de *mise en page*, que l'ouverture du clavier ne
 * change pas sur iOS. Le clavier se superpose donc par-dessus, et la zone de
 * saisie du chat se retrouve dessous, invisible, pendant qu'on écrit.
 *
 * `visualViewport` décrit, lui, ce qui est réellement affiché : la différence
 * entre les deux est exactement la place prise par le clavier. Bien pris en
 * charge par Safari iOS et Chrome Android.
 *
 * Complément côté Android : `interactiveWidget: "resizes-content"` dans
 * l'export `viewport` du layout racine, qui fait redimensionner la mise en
 * page elle-même. Les deux approches se cumulent sans se gêner — sur un
 * navigateur qui redimensionne déjà, l'écart mesuré ici retombe à 0.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function update() {
      if (!viewport) return;
      const hidden = window.innerHeight - viewport.height - viewport.offsetTop;
      // Un ou deux pixels d'écart existent en permanence sur certains
      // navigateurs : en dessous de 24 px, on considère qu'il n'y a pas de
      // clavier plutôt que de décaler le panneau sans raison.
      setInset(hidden > 24 ? Math.round(hidden) : 0);
    }

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
