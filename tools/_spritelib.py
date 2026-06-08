"""Outils partages pour le pipeline de sprites Laura Quest.

Les planches sources (assets/sprites_bench/*.png) sont des grilles 4x2 (2 lignes
de 4 = 8 frames) sur fond ~blanc, perso au centre de chaque cellule avec marges,
echelle non normalisee d'une planche a l'autre.

Ce module fournit le decoupage en cellules + le detourage du fond blanc par
connexite depuis les bords (pour ne PAS trouer le chat blanc / chaussettes /
reflets, qui sont des blancs interieurs) + le calcul de bounding box.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

COLS, ROWS = 4, 2  # grille des planches sources

# --- Detection du fond clair (chemin "blanc", valide sur les sprites Laura) ---
NEAR_WHITE_BRIGHT = 232   # luminosite (max canal) mini pour etre "clair"
NEAR_WHITE_SAT = 22       # saturation (max-min canaux) maxi pour etre "neutre"

# --- Detection du fond de couleur quelconque (chemin "auto", bulk) ---
AUTO_BG_TOL = 28          # |pixel - couleur_fond| <= tol -> pixel de fond

# Reclassement des POCHES de fond enclavees (non connectees a un bord) :
# roues de velo, creux derriere la nuque, espace bras/corps... a retirer aussi.
# On les distingue des zones du PERSO de meme teinte que le fond :
#   - le fond enclave est de la COULEUR DU FOND (dist faible) et plat ;
#   - ou alors FIN/colle aux contours (ecart-type local eleve : lamelle entre
#     deux parties du perso).
# Le chat blanc est creme (dist couleur elevee vs fond neutre) et forme un gros
# blob plein (ecart-type local bas) -> conserve.
POCKET_MIN_AREA = 30      # ignore les micro-poches (reflets d'oeil...) -> gardees
POCKET_COLOR_TOL = 8      # poche ~ couleur fond : dist <= tol -> fond
POCKET_LOCSTD_MIN = 24    # poche fine/collee aux bords (loc_std >=) -> fond...
POCKET_LOCSTD_DIST = 14   # ...si en plus sa couleur reste proche du fond (<=)
LOCSTD_WIN = 7            # fenetre de l'ecart-type local

# --- Anti-aliasing du contour ---
AA_SIGMA = 0.7            # flou gaussien de l'alpha (0 = bord dur, ~1 = doux)
AA_ALPHA_FLOOR = 4        # seuil alpha pour la bounding box / le rognage


def _local_std(bright):
    b = bright.astype(np.float32)
    mean = ndimage.uniform_filter(b, LOCSTD_WIN)
    sq = ndimage.uniform_filter(b * b, LOCSTD_WIN)
    return np.sqrt(np.clip(sq - mean * mean, 0, None))


def _bleed_fg_color(cell_rgb, fg):
    """Remplit le RGB hors perso par la couleur du pixel perso le plus proche.

    Evite le liseré clair : sous l'alpha (bord adouci, zones transparentes) le
    RGB porte la couleur du sprite, pas celle du fond -> pas de halo au
    compositing ni au filtrage/mipmap GPU.
    """
    if not fg.any():
        return cell_rgb.copy()
    idx = ndimage.distance_transform_edt(~fg, return_distances=False,
                                         return_indices=True)
    return cell_rgb[tuple(idx)]


def _finish(cell_rgb, fg):
    """fg binaire -> RGBA avec contour anti-aliase + decontamination couleur."""
    bled = _bleed_fg_color(cell_rgb, fg)
    if AA_SIGMA > 0:
        alpha = ndimage.gaussian_filter(fg.astype(np.float32) * 255.0, AA_SIGMA)
    else:
        alpha = fg.astype(np.float32) * 255.0
    alpha = np.clip(alpha, 0, 255).astype(np.uint8)
    return np.dstack([bled, alpha]).astype(np.uint8)


def cutout(cell_rgb, near, bgcol, remove_pockets=True):
    """Coeur du detourage. `near` = masque 'couleur de fond', `bgcol` = RGB fond.
    Retire le fond exterieur (connecte aux bords) + les poches enclavees
    (si remove_pockets), anti-aliase + decontamine. -> (rgba, fg)."""
    a = cell_rgb.astype(np.int16)
    bright = a.max(2)

    lbl, _ = ndimage.label(near)
    border = set(lbl[0, :]) | set(lbl[-1, :]) | set(lbl[:, 0]) | set(lbl[:, -1])
    border.discard(0)
    bg = np.isin(lbl, list(border)) if border else np.zeros_like(near)

    if not remove_pockets:
        return _finish(cell_rgb, ~bg), ~bg

    std = _local_std(bright)
    plbl, pn = ndimage.label(near & ~bg)
    for i in range(1, pn + 1):
        pocket = plbl == i
        area = int(pocket.sum())
        if area < POCKET_MIN_AREA:
            continue  # micro-poche -> gardee (reflet d'oeil, etc.)
        mean_rgb = a[pocket][:, :3].mean(0)
        dist = float(np.max(np.abs(mean_rgb - bgcol)))
        locstd = float(std[pocket].mean())
        is_bg = (dist <= POCKET_COLOR_TOL) or \
                (locstd >= POCKET_LOCSTD_MIN and dist <= POCKET_LOCSTD_DIST)
        if is_bg:
            bg |= pocket

    fg = ~bg
    return _finish(cell_rgb, fg), fg


def remove_white_bg(cell_rgb):
    """Detourage pour fond CLAIR (sprites Laura). -> (rgba, fg_mask).

    Retire le clair connecte aux bords + les poches de fond enclavees (roues,
    creux nuque...) ; preserve les blancs du perso (chat creme, reflets) ;
    contour anti-aliase + decontamination couleur (pas de halo blanc).
    """
    a = cell_rgb.astype(np.int16)
    sat = a.max(2) - a.min(2)
    bright = a.max(2)
    near_white = (bright >= NEAR_WHITE_BRIGHT) & (sat <= NEAR_WHITE_SAT)

    # couleur du fond : mediane des pixels clairs connectes aux bords
    lbl, _ = ndimage.label(near_white)
    border = set(lbl[0, :]) | set(lbl[-1, :]) | set(lbl[:, 0]) | set(lbl[:, -1])
    border.discard(0)
    ext = np.isin(lbl, list(border)) if border else near_white
    bgcol = (np.median(a[ext][:, :3], axis=0) if ext.any()
             else np.array([252.0, 252.0, 252.0]))
    return cutout(cell_rgb, near_white, bgcol)


def detect_bg_color(cell_rgb, ring=2):
    """Couleur de fond = mediane de l'anneau de bordure (ring px)."""
    a = cell_rgb[:, :, :3]
    edge = np.concatenate([
        a[:ring].reshape(-1, 3), a[-ring:].reshape(-1, 3),
        a[:, :ring].reshape(-1, 3), a[:, -ring:].reshape(-1, 3)])
    return np.median(edge, axis=0)


def remove_bg_auto(cell_rgb, tol=AUTO_BG_TOL, bgcol=None, remove_pockets=True):
    """Detourage pour fond PLAT de couleur QUELCONQUE (bulk). -> (rgba, fg_mask).

    La couleur de fond est detectee sur la bordure (ou imposee via bgcol).
    Un pixel est 'fond' si sa distance (max canal) a cette couleur <= tol.
    Memes regles de poches enclavees + anti-aliasing que le chemin clair.
    """
    a = cell_rgb.astype(np.int16)
    if bgcol is None:
        bgcol = detect_bg_color(cell_rgb)
    bgcol = np.asarray(bgcol, dtype=np.float32)
    near = np.max(np.abs(a[:, :, :3] - bgcol), axis=2) <= tol
    return cutout(cell_rgb, near, bgcol, remove_pockets=remove_pockets)


# --- Detourage par RESEAU DE NEURONES (BiRefNet) -----------------------------
# Segmente le SUJET (pas la couleur) -> un blanc du perso (chat) sur fond blanc
# est conserve nativement. Necessite torch + transformers + timm + kornia
# (dispo dans l'env /home/delete/venv_311). Import paresseux : ce module reste
# importable sous un python sans torch tant qu'on n'appelle pas ces fonctions.
NN_MODEL_ID = "ZhengPeng7/BiRefNet"   # segmentation haute-def SOTA
NN_INPUT = 1024
_NN_CACHE = {}


def load_birefnet(model_id=NN_MODEL_ID, device=None):
    """Charge (et met en cache) le modele BiRefNet. Rend (model, device, transform)."""
    key = (model_id, device)
    if key in _NN_CACHE:
        return _NN_CACHE[key]
    import torch
    from torchvision import transforms
    from transformers import AutoModelForImageSegmentation
    dev = device or ("cuda" if torch.cuda.is_available() else "cpu")
    model = AutoModelForImageSegmentation.from_pretrained(model_id, trust_remote_code=True)
    model.to(dev).float().eval()
    tf = transforms.Compose([
        transforms.Resize((NN_INPUT, NN_INPUT)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    _NN_CACHE[key] = (model, dev, tf)
    return _NN_CACHE[key]


def matte_birefnet(cell_rgb, handle=None):
    """Matte alpha (HxW uint8, 0..255) du sujet dans cell_rgb via BiRefNet."""
    import torch
    model, dev, tf = handle or load_birefnet()
    im = Image.fromarray(np.ascontiguousarray(cell_rgb[:, :, :3]))
    with torch.no_grad():
        x = tf(im).unsqueeze(0).to(dev)
        out = model(x)
        pred = out[-1] if isinstance(out, (list, tuple)) else out
        pred = pred.sigmoid().float().cpu()[0, 0].numpy()
    alpha = Image.fromarray((pred * 255).astype(np.uint8)).resize(
        (cell_rgb.shape[1], cell_rgb.shape[0]), Image.BILINEAR)
    return np.asarray(alpha)


def remove_bg_nn(cell_rgb, handle=None):
    """Detourage par segmentation NN (BiRefNet) + decontamination couleur.
    Rend (rgba, fg_mask). Le matte fait deja l'anti-aliasing du contour."""
    alpha = matte_birefnet(cell_rgb, handle)
    fg = alpha >= 128
    rgb = _bleed_fg_color(cell_rgb, fg)
    rgba = np.dstack([rgb, alpha]).astype(np.uint8)
    return rgba, fg


def bbox_of(mask):
    """Bounding box (x0, y0, x1, y1) demi-ouverte d'un masque booleen, ou None."""
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def split_cells(sheet_rgb):
    """Decoupe une planche en 8 cellules dans l'ordre de lecture (1..8).

    Rend une liste de 8 (n, cell_rgb) avec n = 1..8 :
    ligne du haut gauche->droite = 1..4, ligne du bas = 5..8.
    """
    H, W, _ = sheet_rgb.shape
    cw, ch = W // COLS, H // ROWS
    out = []
    for r in range(ROWS):
        for c in range(COLS):
            n = r * COLS + c + 1
            cell = sheet_rgb[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
            out.append((n, cell))
    return out, (cw, ch)


def series_id(stem):
    """'Laura_throw_rice' / 'Laure_throw_cake' -> 'throw_rice' / 'throw_cake'."""
    s = stem
    for pref in ("Laura_", "Laure_", "laura_", "laure_"):
        if s.startswith(pref):
            return s[len(pref):]
    return s


def load_rgb(path):
    return np.asarray(Image.open(path).convert("RGB"))
