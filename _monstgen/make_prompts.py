#!/usr/bin/env python3
"""Emet un prompt Codex par MONSTRE -> _monstgen/prompts/<name>.txt.

Chaque session Codex fait UN appel image_gen : une feuille pixel-art de 6 frames
sur fond magenta plat (#ff00ff), perso d'un seul tenant, puis cp le brut dans
_monstgen/raw/<name>_sheet.png. Le decoupage/chroma-key se fait ensuite avec
_monstgen/regrid.py (-> assets/sprites/enemy_<name>.png).

  6 frames = walk(1-3) / hurt(4) / attack(5-6)  (cf. CONFIG.anims enemy_<name>)

FACING par archetype (doit matcher la logique flipX de game.js, NON modifiee) :
  patrol / chase  -> LEFT      (flipX = dir>0 : source gauche)
  fly / shooter / jump / static -> RIGHT  (flipX = facing<0/dir<0 : source droite)
"""
import os
ROOT = '/home/delete/laura_quest'
OUT = os.path.join(ROOT, '_monstgen', 'prompts')
os.makedirs(OUT, exist_ok=True)

COMMON = """Use your built-in image_gen tool (the "imagegen" skill) to GENERATE raster pixel art. Do NOT use the CLI fallback (no OPENAI_API_KEY). Do NOT draw procedurally (no PIL/canvas/SVG). The artwork MUST come from your AI image generator. You will generate ONE sprite sheet (6 frames) for one small ENEMY character of a lighthearted cartoon platformer.

PIXEL-ART STYLE: retro 16-bit SNES / arcade run-and-gun look. Crisp visible square pixels, bold dark outline, limited vibrant palette, flat cel shading, chunky READABLE shapes. NO smooth gradients, NO anti-aliasing, NO airbrushed/painterly look, NO 3D. Caricatured, expressive, a bit comedic (this is a birthday-gift game).

LAYOUT (critical): EXACTLY 6 frames in a SINGLE horizontal row, on a uniform grid of 6 equal cells. Same cell size for all; the character at the SAME scale, standing on the SAME ground baseline near the bottom of each cell, centered in its cell. Leave a WIDE empty magenta gap between consecutive frames (each frame a clearly separated island; frames MUST NOT touch or overlap; nothing crosses into a neighbour). Character identity, outfit and colors IDENTICAL across all 6 frames; only the POSE changes. The character FACES {facing}.

BACKGROUND: fill the ENTIRE image (including the gaps) with ONE perfectly FLAT solid #ff00ff magenta. NO shadow, NO contact shadow, NO floor line, NO gradient, NO grid lines, NO frame numbers, NO text, NO watermark. NEVER use magenta or pink anywhere on the character.

CHARACTER (identical in every frame): {character}

THE 6 FRAMES (all facing {facing}): frames 1-3 = a subtle looping MOVE/IDLE cycle ({idle}); frame 4 = a HURT pose ({hurt}); frames 5-6 = an ATTACK ({attack}). Keep the silhouette readable at small size (this sprite is shown tiny in-game): bold shape, strong contrast.

cp the generated PNG to {root}/_monstgen/raw/{name}_sheet.png

Generate the sheet (ONE image_gen call), then cp it. Do NOT run chroma-key removal, do NOT delete any files. Finally print exactly:
  SHEET: {root}/_monstgen/raw/{name}_sheet.png (<W>x<H>)
"""

# name -> (facing, character, idle, hurt, attack)
MONSTERS = {
 # ---- REGENERES (ex-mockups) ----
 'caillou': ('RIGHT',
   "a grumpy round boulder / ROCK with a cartoon angry face, cracks and moss patches, tiny stubby arms crossed, earthy grey-brown stone. A comedic immovable obstacle-creature.",
   "sitting still, brow furrowed, a small angry breath, barely wobbling",
   "cracking, a chip flying off, eyes squeezed shut, impact stars",
   "leaning/bonking forward with a headbutt, mouth open angry"),
 'camion': ('LEFT',
   "a beat-up muddy FARM TRACTOR / little farm truck with a grumpy face on the grille, big rear wheels, a smoking exhaust pipe, dented hood. Comedic farm vehicle.",
   "idling, wheels rocking, exhaust puffs, grille-face scowling",
   "hood popping open with a smoke burst, bouncing back, bolts flying",
   "lunging forward engine-first, wheels spinning, ramming"),
 'criquet': ('RIGHT',
   "a cartoon LOCUST / grasshopper crop-pest, bright green, big coiled jumping hind legs, round bug eyes, twitchy antennae, tiny front arms. Comedic.",
   "crouched low, hind legs flexing, antennae waving, ready to spring",
   "flipped onto its back, legs kicking the air, dizzy spirals",
   "mid-leap lunge, hind legs fully extended, body stretched forward"),
 'ademe': ('RIGHT',
   "a walking stack of OFFICIAL REPORTS / a bureaucratic dossier-monster: a thick bound report with an angry rubber-stamp face, little arms holding more paperwork, a beret. Comedic French-agency pest.",
   "shuffling its papers, glaring, tapping a stamp",
   "papers scattering everywhere, recoiling, glasses askew",
   "hurling a rolled report / a fan of forms forward"),
 'assureur': ('LEFT',
   "a pushy INSURANCE AGENT / bailiff (huissier) man in a cheap ill-fitting suit and tie, slicked hair, smug aggressive grin, clutching a clipboard and briefcase, jabbing a finger. Comedic.",
   "striding in place, waving a contract, smug grin",
   "papers flying out of the briefcase, stumbling backward",
   "lunging forward thrusting the clipboard / pointing finger"),
 # ---- NOUVEAUX : VOLANT (fly) ----
 'moustique': ('RIGHT',
   "a big cartoon MOSQUITO, skinny dark body, an oversized sharp needle proboscis, translucent buzzing wings, long dangling legs, huge angry eyes. Comedic pest.",
   "hovering, wings a blur, body bobbing, proboscis twitching",
   "reeling back, wings crumpled, legs splayed, dizzy",
   "diving forward proboscis-first to stab, body straightened like a dart"),
 'abeille': ('RIGHT',
   "a chunky cartoon BEE, fuzzy round yellow-and-black striped body, small round wings, a pointed stinger, big eyes, tiny legs. Cute-but-angry.",
   "hovering, wings buzzing fast, bobbing gently",
   "tumbling sideways, wings bent, stars spinning",
   "diving forward stinger-first, body angled like a missile"),
 # ---- SOL (chase) ----
 'cafard': ('LEFT',
   "a cartoon COCKROACH, glossy dark-brown carapace, six skittering legs, long twitchy antennae, low to the ground, big shifty eyes. Gross-but-comedic.",
   "skittering low in place, legs blurring, antennae twitching",
   "flipped onto its back, six legs flailing in the air",
   "lunging forward low, mandibles open to bite, antennae back"),
 # ---- VEHICULE (patrol) ----
 'transpalette': ('LEFT',
   "a beat-up warehouse PALLET-JACK (hand pallet truck) carrying a wobbly stack of crates, a grumpy face on the front, small steel wheels, raised forks. Comedic machine.",
   "trundling in place, wheels rocking, crates wobbling",
   "crates toppling off, the jack recoiling, bolts flying",
   "ramming forward, forks lowered like a charge"),
 'livreur': ('LEFT',
   "a grumpy WATER-DELIVERY GUY in a cap and uniform, pushing a hand-truck/dolly loaded with a big blue WATER-COOLER jug, sleeves rolled up. Comedic. (cap pulled low, generic face)",
   "trundling the dolly in place, the jug sloshing, scowling",
   "the jug spilling water, the guy stumbling backward",
   "shoving the loaded dolly forward as a battering ram"),
 'coursier': ('LEFT',
   "a frantic BIKE COURIER hunched over a fast bike, a huge overflowing stack of FILES and folders strapped to their back and messenger bag, helmet, paperwork fluttering. Comedic. (helmet low, generic face)",
   "pedalling hard in place, papers fluttering behind",
   "papers exploding everywhere, the bike wobbling, off balance",
   "charging forward fast, files flying off in a trail"),
 # ---- TIR (shooter) ----
 'imprimante': ('RIGHT',
   "an old OFFICE PRINTER monster with stubby legs and arms, an angry face on its front panel, a jammed paper tray, a blinking red error light, crumpled pages sticking out. Comedic machine.",
   "whirring in place, the error light blinking, paper jiggling",
   "the lid popping open with a smoke puff, recoiling",
   "violently spitting a sheet of paper forward, panel flashing"),
 'chips': ('RIGHT',
   "a big crinkly BAG OF POTATO CHIPS/crisps with a grumpy face, little stick arms, puffed up and greasy, ready to burst. Comedic junk-food monster.",
   "puffing and breathing, crinkling, arms on hips",
   "deflating with a gasp, chips spilling out, crumpling",
   "bursting open and firing a spray of chips/crisps forward"),
 'tuyau': ('RIGHT',
   "a coiled GARDEN WATERING HOSE monster, green rubber coils for a body, a spray-nozzle head shaped like a snarling face, dripping, a small water valve. Comedic.",
   "coiling in place, dripping, the nozzle twitching",
   "kinking up and spraying wildly, recoiling",
   "blasting a hard jet of water forward from the nozzle"),
 # ---- IMMOBILE (static) ----
 'sac': ('RIGHT',
   "a stuffed student BACKPACK monster sitting on the ground, a zipper-mouth full of sharp teeth, two angry eyes on the front flap, straps like little arms, books and pens poking out. Comedic.",
   "sitting, breathing, the zipper-teeth gnashing slightly",
   "books and pens spilling out, the bag recoiling, eyes crossed",
   "lunging the zipper-mouth wide open to chomp forward"),
 'fontaine': ('RIGHT',
   "an office WATER-COOLER monster: a big upturned blue WATER JUG on a white dispenser base, an angry face on the jug, bubbles rising inside. Comedic immovable monster.",
   "bubbling and glugging, the jug jiggling",
   "the jug cracking, water leaking out, recoiling",
   "spurting a gush of water forward from the spout"),
 'dossiers': ('RIGHT',
   "a teetering PILE OF FILES, folders and loose paperwork bound with elastic and sticky-notes, an angry face peeking out between the folders. Comedic immovable bureaucracy monster.",
   "swaying gently, papers rustling, glaring",
   "toppling over, papers flying off the top, sticky-notes scattering",
   "the whole pile lunging forward, shooting papers ahead"),
}

for name, (facing, char, idle, hurt, atk) in MONSTERS.items():
    body = COMMON.format(name=name, root=ROOT, facing=facing,
                         character=char, idle=idle, hurt=hurt, attack=atk)
    open(os.path.join(OUT, name + '.txt'), 'w').write(body)
    print('wrote', name + '.txt', '(' + facing + ')')
print('%d prompts -> %s' % (len(MONSTERS), OUT))
