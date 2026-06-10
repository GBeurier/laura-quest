#!/usr/bin/env python3
"""Emit per-boss image-generation prompts (pixel-art, 2 sheets each: move + atk)
into _bossgen/prompts/<boss>.txt.

Each prompt is intended for sequential built-in image_gen calls. Save raw strips
to _bossgen/raw/, then run regrid.py to normalize them into 6x 248x280 sheets.
"""
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
   character="FRANCOIS, a grumpy rural LANDOWNER / property boss, not a farmer. Short stocky middle-aged man with a big round pot belly, red scowling face, small slick hair, thin moustache, expensive BORDEAUX / burgundy suit straining over the belly, white shirt, dark shoes, gold watch, bunch of keys at the belt, holding a rolled property deed or land contract. Renfrogne, greedy, territorial, comedic villain.",
   idle="squaring his shoulders, belly jutting forward, jangling keys, glaring to the left",
   hurt="recoiling backward, belly bouncing, keys and deed flying up, eyes squeezed shut, impact stars",
   atk="frame1 stand, frames2-3 wind up with the rolled land contract and keys, frame4 thrust / shove the contract hard to the LEFT, frame5 shoulder-charge LEFT with belly first, frame6 recover"),
 'agriculteur': dict(
   character="An ANGRY farmer riding a rusty red TRACTOR, clearly the boss vehicle. Farmer: furious face, straw hat, plaid shirt, dirty overalls, work gloves. Tractor: rust-red body, black exhaust chimney / smokestack, two very large dark wheels with pale hubs, chunky fenders, small steering wheel, grime. The farmer sits high on the tractor, leaning left, shouting. Keep the tractor visible and dominant in every frame.",
   idle="tractor chugging in place, big wheels rocking slightly, smokestack puffing, farmer shaking a fist while facing left",
   hurt="tractor jolts backward, farmer almost falls from seat, hat flying up, sparks and impact stars",
   atk="frame1 engine idles, frames2-3 tractor revs with smoke from the chimney, frame4 tractor lunges / rams to the LEFT, frame5 wheel spin and front grill thrust left, frame6 recover"),
 'michael': dict(
   character="MICHAEL based on the provided reference photo: an older bald man with a long oval bald skull, high forehead, no hair on top, short neat grey beard / stubble around jaw and chin, pale skin, narrow nose, serious eyes, wearing a plain RED t-shirt. No lab coat, no full white beard, no black hair. Comedic stern researcher villain, but the head silhouette must resemble the reference.",
   idle="standing tall in the red t-shirt, stern glare to the left, small breathing motion, one hand holding statistical notes",
   hurt="recoiling, bald head tilted back, grey beard visible, red shirt wrinkling, notes flying, impact stars",
   atk="frame1 stern stance, frames2-3 wind up with a statistical chart / graph sheet, frame4 fling the chart hard to the LEFT, frame5 point menacingly while data sheets fly left, frame6 recover"),
 'rstudio': dict(
   character="NOT a person: the RStudio software personified as a buggy computer-machine monster. A chunky retro monitor / CRT body with stubby arms and feet, angry glitchy face, teal/cyan casing, tangled cables. On the screen or chest is a VERY LARGE, CLEAR, READABLE RStudio logo: a bold WHITE capital letter R inside a vivid bright BLUE sphere / halo / roundel. The logo is the main identity and must stay legible in every frame. Tiny red Error popups may float near it.",
   idle="standing and leaning left, the big blue RStudio logo glowing clearly, screen flickering an angry face, small error popups blinking",
   hurt="screen cracking further with a static burst, sparks",
   atk="frame1 idle with big readable blue-and-white RStudio logo, frames2-3 screen charges up flashing red, frame4 spit jagged red Error popups / stack-trace blocks to the LEFT, frame5 more errors streaming left, frame6 settle with logo still readable",
   textnote=" (the exact white letter \"R\" inside the blue RStudio logo and tiny \"Error\" popups ARE allowed, since they are the character)"),
 'cendrine': dict(
   character="CENDRINE, a severe female administrative manager. Strict tight bun, sharp glasses, stern pursed mouth, beige tailored suit / tailleur beige with skirt and jacket, sensible shoes, several folders / dossiers tucked under one arm. Comedic bureaucratic boss, rigid posture, no purple outfit.",
   idle="standing rigid and disapproving, clutching folders under her arm, glaring left over her glasses",
   hurt="recoiling, glasses knocked askew, folders and papers puffing up, impact stars",
   atk="frame1 ready with folders under arm, frames2-3 pull a dossier / form from the stack, frame4 fling official folders and papers to the LEFT, frame5 point angrily left while papers scatter, frame6 recover"),
 'jury': dict(
   character=("THE THESIS JURY (final boss): a wide sprite showing THREE clearly DIFFERENT professors seated behind one long wooden defense table, the WHOLE panel shown in EVERY frame. LEFT: an older male professor with white hair and/or white beard, glasses, dark academic suit. MIDDLE: a severe woman professor with a tight bun, formal jacket, holding papers. RIGHT: a younger male professor with glasses, neat hair, skeptical expression, laptop or notebook. They sit shoulder-to-shoulder behind the long desk with paper stacks, water glasses, and a small lamp. Burgundy academic accents but no magenta/pink. Keep the three people and the bench identical in every frame; only gestures change."),
   idle="the three seated professors shuffling papers, leaning in, exchanging skeptical looks; attention toward the left",
   hurt="all three jolting back in their chairs, papers flying up",
   atk="frame1 seated, frames2-3 all three lean forward with documents raised, frame4 they fling papers / criticism sheets to the LEFT together, frame5 papers flying left across the desk, frame6 settle",
   facenote=" (a forward-facing panel is fine; angle their attention/gestures toward the left)"),
}

for boss, d in BOSSES.items():
    body = COMMON.format(boss=boss, root=ROOT, character=d['character'],
                         idle=d['idle'], hurt=d['hurt'], atk=d['atk'],
                         textnote=d.get('textnote', ''), facenote=d.get('facenote', ''))
    open(os.path.join(OUT, boss + '.txt'), 'w').write(body)
    print('wrote', boss + '.txt')
