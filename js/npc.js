/* =====================================================================
 *  REGISTRE DES PNJ (anciennement "passants") -> window.NPC
 * ---------------------------------------------------------------------
 *  C'est le FICHIER CENTRAL ou tu decris chaque personne du jeu : son
 *  prenom, son nom, sa taille, et (pour plus tard) ses phrases perso.
 *
 *  UNE entree = UNE TETE = UNE PERSONNE. La cle est le nom du sprite de
 *  tete `head_npc_<sexe>_<n>` (le fichier PNG dans assets/sprites/, ex.
 *  head_npc_h_7.png -> cle 'head_npc_h_7'). Le moteur (js/game.js) tire
 *  une tete au hasard par PNJ 'N' du niveau, puis lit ICI sa taille (et
 *  demain ses phrases). Une tete absente du registre -> taille 'M' par
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
 *    prenom  prenom affiche (a remplir).
 *    nom     nom affiche (a remplir).
 *    phrases []  repliques perso (FEATURE A VENIR ; vide pour l'instant).
 *
 *  Pour voir quelle tete porte quel numero : python3 tools/gen_passant_mockups.py
 *  (ou regarde assets/sprites/head_npc_<sexe>_<n>.png + la colonne `src`).
 * ===================================================================== */

window.NPC = {

  // --- FEMMES (head_npc_f_<n>) ---------------------------------------
  'head_npc_f_1':  { sexe: 'f', src: 'Collegues (1).png',        taille: 'M', prenom: 'Angélique', nom: '', phrases: [] },
  'head_npc_f_2':  { sexe: 'f', src: 'female (9).png', taille: 'P', prenom: 'Myriam', nom: 'Adam', phrases: [] },
  'head_npc_f_3':  { sexe: 'f', src: 'Collegues (2).png',        taille: 'M', prenom: 'Hélène', nom: 'Marou', phrases: [] },
  'head_npc_f_4':  { sexe: 'f', src: 'Collegues (9).jpeg',       taille: 'M', prenom: 'Lauriane', nom: 'Rouan', phrases: [] },
  'head_npc_f_5':  { sexe: 'f', src: 'Plateau (3).png',          taille: 'P', prenom: 'Dominique', nom: '', phrases: [] },
  'head_npc_f_6':  { sexe: 'f', src: 'Plateau (6).png',          taille: 'P', prenom: '', nom: '', phrases: [] },
  'head_npc_f_7':  { sexe: 'f', src: 'Plateau (7).png',          taille: 'M', prenom: 'Mathilde', nom: 'Singer', phrases: [] },
  'head_npc_f_8':  { sexe: 'f', src: 'Responsables (1).jpeg',    taille: 'M', prenom: 'Christine', nom: 'Granier', phrases: [] },
  'head_npc_f_9':  { sexe: 'f', src: 'Stagiaire (12).jpg',       taille: 'P', prenom: '', nom: '', phrases: [] },
  'head_npc_f_10': { sexe: 'f', src: 'Stagiaire (5).jpg',        taille: 'M', prenom: 'Celestine', nom: '', phrases: [] },
  'head_npc_f_11': { sexe: 'f', src: 'Stagiaire (6).jpg',        taille: 'P', prenom: 'Gargi', nom: '', phrases: [] },
  'head_npc_f_12': { sexe: 'f', src: 'Plateau (10).png',         taille: 'P', prenom: 'Valérie', nom: '', phrases: [] },
  'head_npc_f_13': { sexe: 'f', src: 'Plateau (4).png',          taille: 'P', prenom: 'Sandrine', nom: '', phrases: [] },
  'head_npc_f_14': { sexe: 'f', src: 'Plateau (8).png',          taille: 'P', prenom: 'Armelle', nom: '', phrases: [] },
  'head_npc_f_15': { sexe: 'f', src: 'female.png',     taille: 'P', prenom: 'Evelyne', nom: '', phrases: [] },
  'head_npc_f_16': { sexe: 'f', src: 'Stagiaire (8).jpg',        taille: 'M', prenom: '', nom: '', phrases: [] },
  'head_npc_f_17': { sexe: 'f', src: 'Collegues (5).jpeg',       taille: 'M', prenom: 'Camila', nom: '', phrases: [] },
  'head_npc_f_18': { sexe: 'f', src: 'female (1).png', taille: 'P', prenom: 'Mégane', nom: '', phrases: [] },
  'head_npc_f_19': { sexe: 'f', src: 'female (4).png', taille: 'P', prenom: 'Sylvie', nom: '', phrases: [] },
  'head_npc_f_20': { sexe: 'f', src: 'female (6).png', taille: 'P', prenom: 'Amelia', nom: '', phrases: [] },
  'head_npc_f_21': { sexe: 'f', src: 'female (7).png', taille: 'P', prenom: 'Oriane', nom: '', phrases: [] },
  'head_npc_f_22': { sexe: 'f', src: 'female (8).png', taille: 'P', prenom: 'Catherine', nom: '', phrases: [] },

  // --- HOMMES (head_npc_h_<n>) ---------------------------------------
  'head_npc_h_1':  { sexe: 'h', src: 'Stagiaire (1).png',        taille: 'M',  prenom: 'Nicolas', nom: '', phrases: [] },
  'head_npc_h_2':  { sexe: 'h', src: 'Collegues (11).jpeg',      taille: 'M',  prenom: 'Alain', nom: '', phrases: [] },
  'head_npc_h_3':  { sexe: 'h', src: 'Collegues (3).png',        taille: 'M',  prenom: 'Christophe', nom: '', phrases: [] },
  'head_npc_h_4':  { sexe: 'h', src: 'Collegues (4).jpeg',       taille: 'P',  prenom: 'Bertrand', nom: '', phrases: [] },
  'head_npc_h_5':  { sexe: 'h', src: 'Collegues (5).png',        taille: 'M',  prenom: 'Michel', nom: '', phrases: [] },
  'head_npc_h_6':  { sexe: 'h', src: 'Collegues (6).jpeg',       taille: 'P',  prenom: 'Romain', nom: '', phrases: [] },
  'head_npc_h_7':  { sexe: 'h', src: 'Collegues (7).jpeg',       taille: 'TG', prenom: 'Denis', nom: '', phrases: [] },
  'head_npc_h_8':  { sexe: 'h', src: 'Collegues (8).jpeg',       taille: 'G',  prenom: 'Grégory', nom: '', phrases: [] },
  'head_npc_h_9':  { sexe: 'h', src: 'Plateau (1).png',          taille: 'G',  prenom: 'Raoul', nom: '', phrases: [] },
  'head_npc_h_10': { sexe: 'h', src: 'Plateau (2).png',          taille: 'P',  prenom: 'Thomas', nom: '', phrases: [] },
  'head_npc_h_11': { sexe: 'h', src: 'Plateau (5).png',          taille: 'M',  prenom: 'Denis', nom: '', phrases: [] },
  'head_npc_h_12': { sexe: 'h', src: 'Plateau (9).png',          taille: 'P',  prenom: 'Grégory', nom: '', phrases: [] },
  'head_npc_h_13': { sexe: 'h', src: 'Responsables (2).jpeg',    taille: 'M',  prenom: 'Raphaël', nom: '', phrases: [] },
  'head_npc_h_14': { sexe: 'h', src: 'Responsables (3).jpeg',    taille: 'TG', prenom: 'Frédéric', nom: '', phrases: [] },
  'head_npc_h_15': { sexe: 'h', src: 'Stagiaire (10).jpg',       taille: 'M',  prenom: '', nom: '', phrases: [] },
  'head_npc_h_16': { sexe: 'h', src: 'Stagiaire (11).jpg',       taille: 'G',  prenom: '', nom: '', phrases: [] },
  'head_npc_h_17': { sexe: 'h', src: 'Stagiaire (2).jpg',        taille: 'M',  prenom: 'Loaï', nom: '', phrases: [] },
  'head_npc_h_18': { sexe: 'h', src: 'Stagiaire (3).jpg',        taille: 'G',  prenom: '', nom: '', phrases: [] },
  'head_npc_h_19': { sexe: 'h', src: 'Stagiaire (7).jpg',        taille: 'P',  prenom: 'Robin', nom: '', phrases: [] },
  'head_npc_h_20': { sexe: 'h', src: 'Stagiaire (9).jpg',        taille: 'M',  prenom: '', nom: '', phrases: [] },
  'head_npc_h_21': { sexe: 'h', src: 'male.jpg',       taille: 'M',  prenom: 'Marcel', nom: '', phrases: [] },
  'head_npc_h_22': { sexe: 'h', src: 'male (1).png',   taille: 'M',  prenom: 'Fabrice', nom: '', phrases: [] },
  'head_npc_h_23': { sexe: 'h', src: 'male (2).png',   taille: 'M',  prenom: 'Benoît', nom: '', phrases: [] },
  'head_npc_h_24': { sexe: 'h', src: 'male (1).jpg',   taille: 'M',  prenom: 'Boubacar', nom: '', phrases: [] },
  'head_npc_h_25': { sexe: 'h', src: 'male (2).jpg',   taille: 'M',  prenom: 'Marcos', nom: '', phrases: [] },

};
