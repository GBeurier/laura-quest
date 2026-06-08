/* =====================================================================
 *  LEVELS — Les niveaux, dessines en ASCII.
 *  Chaque caractere = une case de CONFIG.tileSize px.
 *
 *  LEGENDE :
 *    ' ' (espace) = vide
 *    '='          = sol (terre de riziere)         -> solide
 *    '-'          = plateforme (panneau solaire)   -> solide
 *    '@'          = depart du heros (pot de riz)
 *    'o'          = rayon de soleil (recharge la jauge soleil)
 *    'c'          = cafe (rend des coeurs)
 *    '^'          = caillou      (obstacle, ne bouge pas)
 *    'T'          = camion       (va-et-vient, gros degats)
 *    'A'          = assureur     (te poursuit, se detruit)
 *    'R'          = rapport ADEME (tire de la paperasse)
 *    'B'          = boss (directeur de these, defini par .boss)
 *    '*'          = soleil = sortie du niveau (apres avoir battu le boss)
 *
 *  Les lignes n'ont pas besoin d'avoir la meme longueur (complete a droite).
 *  Astuce : pose les ennemis/objets sur la ligne JUSTE AU-DESSUS du sol.
 * ===================================================================== */
window.LEVELS = {

  niveau1: {
    boss: 'directeur1',     // quel boss pour le 'B' de ce niveau
    map: [
      '                                                                                            ',
      '                                                                                            ',
      '                     o                  o                     o                   *          ',
      '            -----                 -----                   -----                              ',
      '               o                   o                        o                               ',
      '                       -----                  -----                                         ',
      '                         o                      o                                           ',
      '                                                                                            ',
      '   @    ^      A      T        ^      A     R         ^    c      A       ^    R       B      ',
      '============================================================================================',
      '============================================================================================',
    ],
  },

  // --- Gabarit pour ajouter un 2e niveau plus tard --------------------
  // niveau2: {
  //   boss: 'directeur2',
  //   map: [ ... ],
  // },
};
