#!/usr/bin/env python3
"""Emit per-boss Codex prompts (pixel-art, 2 sheets each: move + atk) into
_bossgen/prompts/<boss>.txt. Each Codex session makes TWO image_gen calls on a
flat magenta background and cp's the raw strips into _bossgen/raw/."""
import os
ROOT = '/home/delete/laura_quest'
OUT = os.path.join(ROOT, '_bossgen', 'prompts'); os.makedirs(OUT, exist_ok=True)

COMMON = """Use your built-in image_gen tool (the "imagegen" skill) to GENERATE raster artwork. Do NOT use the CLI fallback (no OPENAI_API_KEY). Do NOT draw procedurally (no PIL/canvas/SVG). The artwork MUST come from your AI image generator. You will generate TWO sprite sheets for one boss character.

PIXEL-ART STYLE (both sheets): retro 16-bit SNES / arcade run-and-gun look. Crisp visible square pixels, bold dark outline, limited vibrant palette, flat cel shading, chunky readable shapes. NO smooth gradients, NO anti-aliasing, NO airbrushed/painterly look, NO 3D.

LAYOUT for EACH sheet (critical): EXACTLY 6 frames in a SINGLE horizontal row, left to right, on a uniform grid of 6 equal cells. Same cell size for all; the character at the SAME scale, standing on the SAME ground baseline near the bottom of each cell; centered in its cell. Leave a WIDE empty magenta gap between consecutive frames (each frame a clearly separated island; frames MUST NOT touch or overlap; nothing crosses from one frame into a neighbour). Character identity, outfit and colors IDENTICAL across all 6 frames; only the POSE changes (one looping animation). The character FACES LEFT.

BACKGROUND (both sheets): fill the ENTIRE image (including the gaps) with ONE perfectly FLAT solid #ff00ff magenta. NO shadows, NO floor line, NO gradient, NO grid lines, NO frame numbers, NO text{textnote}, NO watermark. Never use magenta/pink on the character.

CHARACTER (identical in every frame of BOTH sheets):
{character}

SHEET 1 = MOVE/IDLE. 6 frames, facing LEFT: frames 1-5 a subtle looping IDLE/MENACE cycle ({idle}); frame 6 a HURT pose ({hurt}). cp the result to {root}/_bossgen/raw/{boss}_move_sheet.png

SHEET 2 = ATTACK. 6 frames, facing LEFT: an attack cycle -> {atk}. cp the result to {root}/_bossgen/raw/{boss}_atk_sheet.png

Generate SHEET 1 first (one image_gen call), cp it; then SHEET 2 (one image_gen call), cp it. Do NOT run chroma-key removal, do NOT delete files. Finally print exactly:
  MOVE: {root}/_bossgen/raw/{boss}_move_sheet.png (<W>x<H>)
  ATK:  {root}/_bossgen/raw/{boss}_atk_sheet.png (<W>x<H>)
"""

BOSSES = {
 'proprietaire': dict(
   character="FRANCOIS, a greedy comedic URBAN APARTMENT LANDLORD (slumlord). A smug middle-aged man in a slightly-too-tight cheap blazer over a shirt (or a buttoned cardigan), a thin pencil mustache, slicked-back hair, a big jangling RING OF KEYS on his belt, clutching a rolled-up EVICTION / unpaid-rent notice. Smarmy money-grubbing grin, beady eyes, a little pot belly. NOT a farmer.",
   idle="rubbing his fingers together for money, jangling his keys, smug greedy grin, glaring to the left",
   hurt="recoiling, keys and papers flying up, eyes turned to X, a couple of impact stars",
   atk="frame1 stand, frames2-3 lean back brandishing the rolled-up notice and keys, frame4 hurl it forward to the LEFT, frame5 charge-lunge LEFT shoulder-first like a pushy bully, frame6 recover"),
 'agriculteur': dict(
   character="A CRAZED, manic farmer with wild bulging eyes and a huge manic toothy grin, a straw hat askew, dirty green/khaki overalls over a plaid shirt, work gloves. Unhinged comedic energy. He wields a PITCHFORK.",
   idle="twitching, pitchfork shaking in his grip, manic grin, head jittering, facing left",
   hurt="jolting backward, eyes spinning, hat flying up, impact stars",
   atk="frame1 ready, frames2-3 rear the pitchfork back over the shoulder, frame4 thrust it forward to the LEFT like a spear, frame5 full lunge LEFT, frame6 recover"),
 'rstudio': dict(
   character="NOT a person: the R statistics software personified as a BUGGY MACHINE MONSTER -- a chunky retro computer MONITOR/CRT with little stubby arms and feet, an ANGRY GLITCHY FACE on the screen (jagged pixel eyes, gritted teeth), a cracked/glitched screen, a small blue oval R-logo badge on its front casing, a couple of small red error-popup windows floating near it, tangled cables. Teal/cyan plastic casing. Comedic tech-monster.",
   idle="standing and leaning left, screen flickering a glitchy angry face, little error popups blinking",
   hurt="screen cracking further with a static burst, sparks",
   atk="frame1 idle, frames2-3 screen charges up flashing red, frame4 spit a burst of jagged red error text / a stack-trace out to the LEFT, frame5 more errors streaming left, frame6 settle",
   textnote=" (a tiny \"R\" badge and small \"Error\" popups ARE allowed, since they are the character)"),
 'cendrine': dict(
   character="An OLD, ANGRY female university administrator/secretary. Severe grey hair in a tight bun, cat-eye glasses on a beaded chain, pursed furious red lips, a buttoned mauve cardigan over a blouse, a long grey skirt. Comedic stern-bureaucrat villain. She wields a big rubber office STAMP (tampon).",
   idle="standing rigid and disapproving, tapping a stack of forms, glaring left over her glasses",
   hurt="gasping, glasses knocked askew, recoiling, papers puffing up",
   atk="frame1 ready, frames2-3 raise the big rubber stamp high, frame4 SLAM it forward/down to the LEFT, frame5 a fan of official forms scatters left, frame6 recover"),
 'jury': dict(
   character=("THE THESIS JURY (final boss): a PANEL of THREE clearly DIFFERENT professors seated side by side behind a long wooden examination bench (a PhD thesis defense / viva), the WHOLE panel shown in EVERY frame. LEFT seat: a stern OLDER male professor, white/grey beard, glasses, dark academic gown. CENTER seat: the jury PRESIDENT, distinguished, balding with grey hair, a bow tie, holding a wooden GAVEL and a thick thesis. RIGHT seat: a younger SKEPTICAL female professor, dark hair in a bun, a sharp dark blazer. On the bench: small name plaques, paper stacks, water glasses, a small desk lamp. Deep red/burgundy academic colors, dim dramatic evening mood. Keep the THREE people and the bench IDENTICAL in every frame; only small gestures change."),
   idle="the three seated examiners shuffling papers, leaning in, exchanging skeptical looks; attention toward the left",
   hurt="all three jolting back in their chairs, papers flying up",
   atk="frame1 seated, frames2-3 the president raises the gavel high as all three lean in, frame4 the president SLAMS the gavel and all three fling papers to the LEFT, frame5 papers flying left, frame6 settle",
   facenote=" (a forward-facing panel is fine; angle their attention/gestures toward the left)"),
}

for boss, d in BOSSES.items():
    body = COMMON.format(boss=boss, root=ROOT, character=d['character'],
                         idle=d['idle'], hurt=d['hurt'], atk=d['atk'],
                         textnote=d.get('textnote', ''), facenote=d.get('facenote', ''))
    open(os.path.join(OUT, boss + '.txt'), 'w').write(body)
    print('wrote', boss + '.txt')
