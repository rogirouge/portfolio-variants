// Chargé dans <head> : active les styles qui dépendent de JavaScript avant le premier affichage.
document.documentElement.classList.add('js');
// le couloir (salles qui s'emboîtent en zoomant) seulement si le visiteur accepte les animations
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('corridor');
