/* Registre des personnages jouables. Une entree suffit pour exposer une
 * nouvelle aventure dans le selecteur (pagination automatique).
 * rig reutilise un corps / une tete de PNJ ; sinon sprites peut mapper les
 * poses hero_* vers des feuilles dediees (CONFIG.anims). Sans mapping, partage.
 * L'identite du PNJ reste dans npc.js. */
window.LQ_CHARACTERS = {
  laura: {
    id: 'laura', name: 'Laura', campaign: 'laura_phd',
    tagline: 'Des rizieres a la soutenance', description: '5 chapitres + le jury final',
    accent: [226, 74, 60], preview: 'bg_title',
    abilities: { cat: true },
  },
  marcos: {
    id: 'marcos', name: window.NPC.head_npc_h_25.prenom, campaign: 'marcos_port',
    tagline: 'Une escale avant le grand depart', description: '1 niveau pour prendre le large',
    accent: [43, 131, 154], preview: 'bg_marcos_port',
    npcHead: 'head_npc_h_25', abilities: { cat: false },
    player: { areaScale: [0.46, 0.88], corpseSink: 2 },
    sprites: {
      hero_idle: 'marcos_idle', hero_run: 'marcos_run', hero_jump: 'marcos_jump',
      hero_hurt: 'marcos_hurt', hero_throw: 'marcos_throw', hero_duck: 'marcos_duck',
      hero_dash: 'marcos_dash', hero_dead: 'marcos_dead',
      hero_bike: 'marcos_run', hero_roll: 'marcos_run', hero_cat_out: null,
      hero_run_throw: null, hero_bike_throw: null, hero_roll_throw: null, hero_duck_throw: null,
    },
  },
};

// Validation au demarrage : une erreur de contenu ne doit pas ecraser une save.
window.LQ_CONTENT = (() => {
  'use strict';
  const characters = window.LQ_CHARACTERS;
  const campaigns = window.LQ_CAMPAIGNS;
  function campaignFor(id) {
    if (!characters[id]) throw new Error('Personnage inconnu : ' + id);
    return campaigns[characters[id].campaign];
  }
  Object.values(characters).forEach((ch) => {
    const a = campaignFor(ch.id);
    if (!a || !a.levels.length || new Set(a.levels).size !== a.levels.length) {
      throw new Error('Aventure invalide : ' + ch.campaign);
    }
    if (a.finalLevel && a.finalLevel !== a.levels[a.levels.length - 1]) {
      throw new Error('Le final doit etre le dernier niveau : ' + a.id);
    }
    if (a.world.nodes.length !== a.levels.length) throw new Error('Carte incomplete : ' + a.id);
    a.levels.forEach((key, i) => {
      const level = window.LEVELS[key];
      if (!level || !Array.isArray(level.map) || a.world.nodes[i].key !== key) {
        throw new Error('Niveau / noeud absent : ' + key);
      }
    });
  });
  return { campaignFor, chapters: (a) => a.levels.filter((key) => key !== a.finalLevel) };
})();
