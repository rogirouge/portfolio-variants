// Chargé dans <head> : active les styles qui dépendent de JavaScript
// et remet la lumière choisie lors de la dernière visite, avant le premier affichage.
document.documentElement.classList.add('js');
try {
  if (localStorage.getItem('lumiere') === 'blanche') document.documentElement.dataset.light = 'blanche';
} catch (e) { /* stockage indisponible : lumière rouge par défaut */ }
