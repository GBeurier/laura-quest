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
    marcos_port: {
      id: 'marcos_port', title: 'Escale au port',
      levels: ['marcos_bateau'], finalLevel: null,
      world: { background: 'bg_marcos_port', nodes: [
        { key: 'marcos_bateau', x: 480, y: 328, label: 'LE PONT DU BATEAU', boss: 'LE GARDIEN' },
      ] },
      screens: { chapter: 'bg_marcos_port', win: 'bg_marcos_port', popup: 'bg_marcos_port' },
      startVehicle: { enabled: false },
      story: {
        title: 'MARCOS', subtitle: 'Escale au port',
        intro: 'Premiere escale pour Marcos !\nTraverse le pont, recupere les provisions et bats le gardien.\nUn petit parcours pour prendre le large.',
        overworld: 'Choisis une escale (ESPACE pour embarquer)',
        chapterDone: 'ESCALE REUSSIE !', bossWarn: 'Bats le gardien pour liberer le passage !',
        win: 'PRET A PRENDRE LE LARGE !  Bravo Marcos, le bateau est pret !',
        dead: 'MARCOS EST K.O. !', deadSub: 'ON REPREND L ESCALE...',
        publi: 'PROVISIONS TROUVEES ! +100%',
        mention: 'EXPEDITION EXEMPLAIRE', feliJury: 'SANS UNE EGRATIGNURE',
        progressLabel: 'Voyage', levelLabel: 'Escales', finishLabel: 'Voyage', collectibleLabel: 'Provisions',
        medals: ['TEMPS', 'BUTIN', 'SAUVES'],
        chapters: { marcos_bateau: 'LE PONT DU BATEAU\nLe gardien laisse passer Marcos. Les provisions sont chargees : cap sur la prochaine aventure !' },
      },
      music: C.music,
    },
  };
})();
