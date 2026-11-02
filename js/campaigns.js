/* Aventures : ordre, carte, narration et habillage, independants du moteur.
 * Les identifiants sont persistants : ne pas les renommer apres publication.
 * Les definitions de niveaux / boss / assets restent partageables. */
window.LQ_CAMPAIGNS = (() => {
  'use strict';
  const C = window.CONFIG;
  return {
    laura_phd: {
      id: 'laura_phd', title: 'La quete du riz',
      levels: C.levels.slice(), finalLevel: 'jury',
      world: Object.assign({ background: 'bg_map' }, C.world),
      screens: { chapter: 'bg_chapter', win: 'bg_win' },
      story: Object.assign({ progressLabel: 'Manuscrit', levelLabel: 'Chapitres',
        finishLabel: 'PhD', collectibleLabel: 'Publis' }, C.story, {
        chapters: Object.fromEntries(C.levels.map((key, i) => [key, C.story.chapters[i] || ''])),
      }),
      music: C.music,
    },
    // Marcos : thesard a Java (cf. docs/superpowers/specs/2026-11-02-marcos-campaign-design.md).
    marcos_these: {
      id: 'marcos_these', title: 'La these de Marcos',
      levels: ['marcos_rizieres', 'marcos_village', 'marcos_parcelle'], finalLevel: null,
      world: { background: 'bg_marcos_map', fallbackBackground: 'bg_marcos_port', nodes: [
        { key: 'marcos_rizieres', x: 190, y: 380, label: 'LES RIZIERES', boss: 'RAJA TIKUS' },
        { key: 'marcos_village',  x: 470, y: 300, label: 'LE VILLAGE',   boss: 'PAK DURIAN' },
        { key: 'marcos_parcelle', x: 760, y: 230, label: 'LA PARCELLE',  boss: 'GARUDA' },
      ] },
      screens: { chapter: 'bg_marcos_chapter', win: 'bg_marcos_win', popup: 'bg_marcos_chapter',
                 fallback: 'bg_marcos_port' },
      startVehicle: { enabled: false },
      story: {
        title: 'MARCOS', subtitle: 'La these de Marcos',
        intro: 'Marcos fait sa these sur le riz sous ombrieres, a Java.\n' +
               'Boue, rats, durians et oiseaux : rien ne lui sera epargne.\n' +
               'Sors la guitare, appelle les etudiants et decroche ton PhD !',
        hint: 'Gauche/Droite ou Q/D bouger   HAUT sauter (relache tot = petit saut)\n' +
              'ESPACE notes   X (tiens) power chord   MAJ dash   C etudiants   BAS+SAUT descend   ESC quitter',
        overworld: 'Choisis un terrain (ESPACE pour entrer)',
        chapterDone: 'CHAPITRE ECRIT !', bossWarn: 'Bats le boss pour ecrire le chapitre !',
        catEmpty: 'Les etudiants sont epuises ! (ils reviennent bientot)',
        win: 'SOUTENANCE REUSSIE !  Felicitations Docteur Marcos !',
        dead: 'MARCOS EST K.O. !', deadSub: 'ON REPREND LE CHAPITRE...',
        publi: 'PUBLICATION TROUVEE ! +100%',
        mention: 'MENTION TRES HONORABLE', feliJury: 'FELICITATIONS DU JURY',
        progressLabel: 'Manuscrit', levelLabel: 'Chapitres', finishLabel: 'PhD', collectibleLabel: 'Publis',
        medals: ['TEMPS', 'DATA', 'SAUVES'],
        chapters: {
          marcos_rizieres: 'CHAPITRE 1 : Le dispositif.\nRaja Tikus retourne dans sa boue : les ombrieres en bambou sont montees, la manip demarre !',
          marcos_village: 'CHAPITRE 2 : Le terrain.\nPak Durian est en panne seche : enquetes au village bouclees, les donnees rentrent !',
          marcos_parcelle: 'CHAPITRE 3 : Les resultats.\nGaruda s envole bredouille : le riz pousse sous les filets, la these est ecrite. Place a la soutenance !',
        },
      },
      music: C.music,
    },
  };
})();
