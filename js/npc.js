/* =====================================================================
 *  REGISTRE DES PNJ (les "potes" du niveau 1, les "collegues" ensuite) ->
 *  window.NPC
 * ---------------------------------------------------------------------
 *  C'est le FICHIER CENTRAL ou tu decris chaque personne du jeu : son
 *  prenom, son nom, sa taille, son niveau d'appartenance et ses phrases.
 *
 *  UNE entree = UNE TETE = UNE PERSONNE. La cle est le nom du sprite de
 *  tete `head_npc_<sexe>_<n>` (le fichier PNG dans assets/sprites/, ex.
 *  head_npc_h_7.png -> cle 'head_npc_h_7'). Le moteur (js/game.js) tire
 *  une tete au hasard par PNJ 'N' du niveau, puis lit ICI sa taille, son
 *  niveau et ses phrases. Une tete absente du registre -> taille 'M' par
 *  defaut, rien ne casse.
 *
 *  CHAMPS (tout est optionnel sauf la cle) :
 *    sexe    'h' | 'f'   (informatif ; le sprite de corps suit deja le sexe)
 *    src     portrait source d'ou la tete a ete generee (_headgen/heads/...,
 *            cf. _headgen/manifest.tsv) -> pour retrouver "qui c'est".
 *    taille  'P' | 'M' | 'G' | 'TG'  (Petit / Moyen / Grand / Tres Grand).
 *            Seul le CORPS grandit ; la tete garde toujours la meme taille.
 *            Le facteur d'echelle de chaque lettre est dans
 *            CONFIG.theme.passant.sizeScale (js/config.js) -> tuning global.
 *    level   0..4 = niveau d'APPARTENANCE (index dans CONFIG.levels :
 *            0 = niveau1 ... 4 = niveau5). Dans un niveau, on fait d'abord
 *            apparaitre SES PNJ, puis on complete avec le pool general.
 *            Au JURY (dernier niveau), tout le monde est la. '' = pool
 *            general uniquement. cf. pickHead() dans game.js.
 *    prenom  prenom affiche.
 *    nom     nom affiche.
 *    phrases []  repliques perso : de temps en temps, une BULLE BD apparait
 *            au-dessus de la tete du PNJ avec UNE de ces phrases au hasard
 *            (rare, encore plus rare au jury -- cf. CONFIG.theme.passant
 *            .bubble et npcBubble() dans game.js). Vide = jamais de bulle.
 *
 *  Pour voir quelle tete porte quel numero : python3 tools/gen_passant_mockups.py
 *  (ou regarde assets/sprites/head_npc_<sexe>_<n>.png + la colonne `src`).
 * ===================================================================== */

window.NPC = {

  // --- FEMMES (head_npc_f_<n>) ---------------------------------------
  "head_npc_f_1":   { sexe: "f", src: "Collegues (1).png",         taille: "M",  level: 3,   prenom: "Angélique", nom: "",
    phrases: ["Talle air en forme pour une fin de thèse"] },
  "head_npc_f_2":   { sexe: "f", src: "female (9).png",            taille: "P",  level: 0,   prenom: "Myriam", nom: "Adam",
    phrases: ["សួស្តី ឡរ តើសុខសប្បាយជាទេ ?"] },
  "head_npc_f_3":   { sexe: "f", src: "Collegues (2).png",         taille: "M",  level: 4,   prenom: "Hélène", nom: "Marou",
    phrases: ["Hélène, je m'appelle Hélène..."] },
  "head_npc_f_4":   { sexe: "f", src: "Collegues (9).jpeg",        taille: "M",  level: 0,   prenom: "Lauriane", nom: "Rouan",
    phrases: ["Attention mon doigt !"] },
  "head_npc_f_5":   { sexe: "f", src: "Plateau (3).png",           taille: "P",  level: 0,   prenom: "Florence", nom: "",
    phrases: ["Tu as fais le plein du Traffic ?"] },
  "head_npc_f_6":   { sexe: "f", src: "Plateau (6).png",           taille: "P",  level: "",  prenom: "", nom: "",
    phrases: [] },
  "head_npc_f_7":   { sexe: "f", src: "Plateau (7).png",           taille: "M",  level: 3,   prenom: "Mathilde", nom: "Singer",
    phrases: ["Vous avez pas vu Alain ?"] },
  "head_npc_f_8":   { sexe: "f", src: "Responsables (1).jpeg",     taille: "M",  level: 4,   prenom: "Christine", nom: "Granier",
    phrases: ["J'ai vu ta sortie sur strava...tu n'avais pas tes protections..."] },
  "head_npc_f_9":   { sexe: "f", src: "Stagiaire (12).jpg",        taille: "P",  level: 2,   prenom: "Mahiné", nom: "",
    phrases: ["Observe le soleil : tout commence par la lumière."] },
  "head_npc_f_10":  { sexe: "f", src: "Stagiaire (5).jpg",         taille: "M",  level: 1,   prenom: "Célestine", nom: "",
    phrases: ["J'ai des rollers taille 40 si tu veux."] },
  "head_npc_f_11":  { sexe: "f", src: "Stagiaire (6).jpg",         taille: "P",  level: 1,   prenom: "Gargee", nom: "",
    phrases: ["On retourne en Italie ?"] },
  "head_npc_f_12":  { sexe: "f", src: "Plateau (10).png",          taille: "P",  level: 4,   prenom: "Valérie", nom: "",
    phrases: ["You are the dancing queen, young and sweet, only seventeen"] },
  "head_npc_f_13":  { sexe: "f", src: "Plateau (4).png",           taille: "P",  level: 2,   prenom: "Sandrine", nom: "",
    phrases: ["Faudra penser a refaire le plein du traffic !"] },
  "head_npc_f_14":  { sexe: "f", src: "Plateau (8).png",           taille: "P",  level: 3,   prenom: "Armelle", nom: "",
    phrases: ["T'as regarder l'amidon ?"] },
  "head_npc_f_15":  { sexe: "f", src: "female.png",                taille: "P",  level: 3,   prenom: "Roselyne", nom: "",
    phrases: ["Elle est pas là ton assistante ?"] },
  "head_npc_f_16":  { sexe: "f", src: "Stagiaire (8).jpg",         taille: "M",  level: 2,   prenom: "Charlotte", nom: "",
    phrases: ["Une maille serrée, une bride ; une maille serrée, une bride…"] },
  "head_npc_f_17":  { sexe: "f", src: "Collegues (5).jpeg",        taille: "M",  level: 2,   prenom: "Camila", nom: "",
    phrases: ["Ca sent le méthane par ici"] },
  "head_npc_f_18":  { sexe: "f", src: "female (1).png",            taille: "P",  level: 4,   prenom: "Mégane", nom: "",
    phrases: ["Une olive ?"] },
  "head_npc_f_19":  { sexe: "f", src: "female (4).png",            taille: "P",  level: 2,   prenom: "Sylvie", nom: "",
    phrases: ["Un pt'it jus de gingembre ?"] },
  "head_npc_f_20":  { sexe: "f", src: "female (6).png",            taille: "P",  level: 0,   prenom: "Amélia", nom: "",
    phrases: ["Aux Philippines on fertilise differently..."] },
  "head_npc_f_21":  { sexe: "f", src: "female (7).png",            taille: "P",  level: 1,   prenom: "Oriane", nom: "",
    phrases: ["J'en peux plus de ce procès"] },
  "head_npc_f_22":  { sexe: "f", src: "female (8).png",            taille: "P",  level: 2,   prenom: "Catherine", nom: "",
    phrases: ["Ben le maïs c'est quand même autre chose !"] },
  "head_npc_f_23":  { sexe: "f", src: "female_cyndi_suire.png",    taille: "P",  level: "",  prenom: "Cyndi", nom: "Suire",
    phrases: [] },

  // --- HOMMES (head_npc_h_<n>) ---------------------------------------
  "head_npc_h_1":   { sexe: "h", src: "Stagiaire (1).png",         taille: "M",  level: 1,   prenom: "Nicolas", nom: "",
    phrases: ["Ta thèse c'est de la bombe et je m'y connait !"] },
  "head_npc_h_2":   { sexe: "h", src: "Collegues (11).jpeg",       taille: "M",  level: 2,   prenom: "Alain", nom: "",
    phrases: ["RDV en S17... au sous-sol !"] },
  "head_npc_h_3":   { sexe: "h", src: "Collegues (3).png",         taille: "M",  level: 0,   prenom: "Christophe", nom: "",
    phrases: ["Je reviens de Floride et j'ai rencontré un doctorant chinois avec qui je vais publier un article sur la philosophie platonicienne appliquée à l'espace latent des vecteurs de transcrit du formalisme des modèles FSPM les jours de pluies"] },
  "head_npc_h_4":   { sexe: "h", src: "Collegues (4).jpeg",        taille: "P",  level: 0,   prenom: "Bertrand", nom: "",
    phrases: ["Pssst... t'en veux ? C'est du malgache"] },
  "head_npc_h_5":   { sexe: "h", src: "Collegues (5).png",         taille: "M",  level: 4,   prenom: "Michel", nom: "",
    phrases: ["Je suis comme mes plantes... oublié"] },
  "head_npc_h_6":   { sexe: "h", src: "Collegues (6).jpeg",        taille: "P",  level: 4,   prenom: "Romain", nom: "",
    phrases: ["T'as pas vu mes aérenchymes ?"] },
  "head_npc_h_7":   { sexe: "h", src: "Collegues (7).jpeg",        taille: "TG", level: 0,   prenom: "Denis", nom: "",
    phrases: ["Ca manque d'igname ici"] },
  "head_npc_h_8":   { sexe: "h", src: "Collegues (8).jpeg",        taille: "G",  level: 3,   prenom: "Greg", nom: "",
    phrases: ["Selon mes agents... on va tous mourrir !"] },
  "head_npc_h_9":   { sexe: "h", src: "Plateau (1).png",           taille: "G",  level: 0,   prenom: "Raoul", nom: "",
    phrases: ["Y'a de la bière dans la glacière"] },
  "head_npc_h_10":  { sexe: "h", src: "Plateau (2).png",           taille: "P",  level: 2,   prenom: "Thomas", nom: "",
    phrases: ["C'est quand que tu fais le plein du traffic ?"] },
  "head_npc_h_11":  { sexe: "h", src: "Plateau (5).png",           taille: "M",  level: 3,   prenom: "Denis F.", nom: "",
    phrases: ["Non le Licor n'est pas dispo"] },
  "head_npc_h_12":  { sexe: "h", src: "Plateau (9).png",           taille: "P",  level: 3,   prenom: "petit Greg", nom: "",
    phrases: ["Sept dosettes arrasées le café !"] },
  "head_npc_h_13":  { sexe: "h", src: "Responsables (2).jpeg",     taille: "M",  level: 2,   prenom: "Raphael", nom: "",
    phrases: ["Observe le soleil : tout commence par la lumière."] },
  "head_npc_h_14":  { sexe: "h", src: "Responsables (3).jpeg",     taille: "TG", level: 4,   prenom: "Fred", nom: "",
    phrases: ["Et si on modélisait les simulations ?"] },
  "head_npc_h_15":  { sexe: "h", src: "Stagiaire (10).jpg",        taille: "M",  level: 1,   prenom: "Titouan", nom: "",
    phrases: ["Pas très sérieux ce jeu"] },
  "head_npc_h_16":  { sexe: "h", src: "Stagiaire (11).jpg",        taille: "G",  level: 1,   prenom: "Nathan", nom: "",
    phrases: ["d=c*Δt​/2"] },
  "head_npc_h_17":  { sexe: "h", src: "Stagiaire (2).jpg",         taille: "M",  level: 1,   prenom: "Loaï", nom: "",
    phrases: ["je peux te poser une question?"] },
  "head_npc_h_18":  { sexe: "h", src: "Stagiaire (3).jpg",         taille: "G",  level: 1,   prenom: "Tim", nom: "",
    phrases: ["Ola du Costa Rica !"] },
  "head_npc_h_19":  { sexe: "h", src: "Stagiaire (7).jpg",         taille: "P",  level: 4,   prenom: "Robin", nom: "",
    phrases: ["J'arrête la course à pied"] },
  "head_npc_h_20":  { sexe: "h", src: "Stagiaire (9).jpg",         taille: "M",  level: 3,   prenom: "Sylvain", nom: "",
    phrases: ["Elle est ou la 3ème dimension ?"] },
  "head_npc_h_21":  { sexe: "h", src: "male.jpg",                  taille: "M",  level: 4,   prenom: "Marcel", nom: "",
    phrases: ["Viens chez moi, j'habite chez une copine"] },
  "head_npc_h_22":  { sexe: "h", src: "male (1).png",              taille: "M",  level: 4,   prenom: "Fabrice", nom: "",
    phrases: ["¡ hasta la victoria siempre !"] },
  "head_npc_h_23":  { sexe: "h", src: "male (2).png",              taille: "M",  level: 3,   prenom: "Benoît", nom: "",
    phrases: ["De mon temps !"] },
  "head_npc_h_24":  { sexe: "h", src: "male (1).jpg",              taille: "M",  level: 2,   prenom: "Boubacar", nom: "",
    phrases: ["Je peux pas, demain je suis en congés"] },
  "head_npc_h_25":  { sexe: "h", src: "male (2).jpg",              taille: "M",  level: 0,   prenom: "Marcos", nom: "",
    phrases: ["Font ch** ces ravageurs"] },
  "head_npc_h_26":  { sexe: "h", src: "male_florian_dubois.png",   taille: "M",  level: "",  prenom: "Florian", nom: "Dubois",
    phrases: [] },

};
