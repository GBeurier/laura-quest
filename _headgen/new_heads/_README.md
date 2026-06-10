# _headgen/new_heads/ — INBOX de portraits a traiter

Depose ici les **nouveaux portraits bruts** (photos) a transformer en tetes.
Une fois la tete generee + enregistree (sprite `head_npc_<sexe>_<n>` dans
assets/sprites/, ligne ajoutee a `../manifest.tsv` et a `js/npc.js`), **deplace
le portrait source dans `../heads/`** : la presence dans `heads/` = "traite / OK".

Donc : `new_heads/` = a faire, `heads/` = fait. La colonne `src` du manifest et
du registre `window.NPC` pointe vers le nom de fichier **a plat dans `heads/`**
(sans prefixe de dossier). cf. CLAUDE.md (pipeline `_headgen/`).
