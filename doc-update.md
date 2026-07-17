# Mettre à jour le fork depuis upstream

Procédure pour merger `upstream/main` sans perdre Eva CSS, et pour résoudre vite
les conflits récurrents.

Dernier merge : **v1.17.0 → v1.27.8** (334 commits, 270 fichiers, 4 conflits).

---

## Le principe à retenir

**Eva CSS ne conflicte jamais. Les optims perf conflictent toujours.**

Sur le merge v1.27.8, Eva CSS a produit **0 conflit** sur 270 fichiers, et les
optims perf **4 sur 4**. Ce n'est pas de la chance, c'est architectural :

| | Eva CSS | Optims perf |
|---|---|---|
| Forme | app isolée, additive | chirurgie inline |
| Vit dans | ses propres fichiers | les fichiers chauds du core |
| Touche le core en | 2 points | 5 fichiers |
| Conflits | 0 | 4/4 |

Eva CSS vit dans `lib/apps/eva-css/`, `app/(builder)/ycode/api/eva-css/`,
`app/(builder)/ycode/integrations/eva-css/`, `app/(site)/eva-bridge.css/` et
`extensions/eva-css/`. Elle ne touche le core qu'en deux endroits, tous deux
auto-mergeables :

- `lib/apps/registry.ts` — enregistrement de l'app
- `app/(builder)/ycode/integrations/apps/page.tsx` — entrée dans la liste

**Conséquence : toute nouvelle fonctionnalité du fork doit être écrite comme une
app**, dans ses propres fichiers. C'est ce qui rend Eva CSS gratuite à maintenir.
Dès qu'on modifie une ligne dans `LayerRenderer.tsx`, on signe pour un conflit à
chaque update.

---

## Procédure

```bash
git fetch upstream                          # long (~2-5 min), lancer en tâche de fond
git rev-list --left-right --count main...upstream/main   # <locaux> <retard>

# Prévisualiser les conflits SANS toucher au working tree
git merge-tree --write-tree --name-only main upstream/main

git switch -c chore/merge-upstream-vX.Y.Z
git merge upstream/main
# → résoudre (voir recettes ci-dessous)
git add <fichiers résolus>

npm install                                 # le lock file bouge à chaque fois
npm run type-check                          # doit être clean
npm run lint                                # voir « Lint » plus bas
git commit
```

Puis les migrations (voir « Migrations Windows »), puis un tour dans l'éditeur
avant de merger dans `main`.

---

## Recettes de conflits

Les 4 conflits sont **toujours les mêmes fichiers**, et **toujours des imports**
(sauf le n°4). La règle générale : **union des deux côtés, moins ce qui n'est plus
utilisé**. Vérifier systématiquement avec un grep des usages réels avant de trancher.

### 1. `lib/page-fetcher.ts` — imports `asset-utils`

Garder `DEFAULT_IMAGE_QUALITY` (fork), prendre `getSvgAspectRatioStyle` (upstream),
**laisser tomber `getImageSizes`** (plus utilisé dans ce fichier → erreur de lint).

```ts
import { buildImageSizes, generateImageSrcset, getOptimizedImageUrl, getAssetProxyUrl,
  DEFAULT_ASSETS, DEFAULT_IMAGE_QUALITY, collectLayerAssetIds, buildSvgDataUrl,
  parseImageDimension, getSvgAspectRatioStyle } from '@/lib/asset-utils';
```

### 2. `components/LayerRenderer.tsx` — imports

Garder `computeImageSizes` (fork), prendre tout le reste d'upstream. `buildImageSizes`
n'est **pas** nécessaire ici : `computeImageSizes` l'appelle en interne depuis
`asset-utils`.

```ts
import { MULTI_ASSET_COLLECTION_ID, buildGlobalsMetaMap, buildGlobalsValueMap,
  mergeGlobalsIntoFieldData } from '@/lib/collection-field-utils';
import { computeImageSizes, generateImageSrcset, getOptimizedImageUrl,
  getSvgAspectRatioStyle, parseImageDimension } from '@/lib/asset-utils';
```

### 3. `components/LayerRendererPublic.tsx` — imports

Même logique, plus `DEFAULT_IMAGE_QUALITY` (fork) et `isLinkToCurrentPage` (upstream).

```ts
import { isValidLinkSettings, generateLinkHref, resolveLinkAttrs,
  isLinkAtCollectionBoundary, isLinkToCurrentPage, type LinkResolutionContext } from '@/lib/link-utils';
import { DEFAULT_ASSETS, DEFAULT_IMAGE_QUALITY, computeImageSizes, generateImageSrcset,
  getOptimizedImageUrl, getSvgAspectRatioStyle, parseImageDimension } from '@/lib/asset-utils';
```

### 4. `components/AnimationInitializer.tsx` — cleanup du `useEffect` ⚠️

**Le piège du fork.** Prendre la logique d'upstream **mais garder le `?.`** :

```ts
detachAnimations();
ScrollTrigger?.getAll().forEach((st) => st.kill());
```

Pourquoi : upstream importe `ScrollTrigger` statiquement (`import { ScrollTrigger }`)
donc il n'est jamais `null` et écrit `ScrollTrigger.getAll()`. **Le fork l'importe en
lazy** (`let ScrollTrigger: ... | null = null`, commit `82dda05`) pour ne pas embarquer
~75 KiB de plugins GSAP sur chaque page → il **peut** être `null`.

Reprendre la ligne d'upstream telle quelle = crash au runtime / erreur TS.

Ne **pas** garder le `timelines.forEach((tl) => tl.kill())` du fork : upstream a
refactoré vers `timelinesRef` + `detachAnimations()`, la variable `timelines` n'existe
plus. `detachAnimations()` fait mieux (préserve les one-shots déjà joués).

---

## Lint

`npm run lint` remonte ~41 erreurs qui **n'ont rien à voir avec le merge** : elles
viennent de scripts temporaires **non trackés** à la racine (`update-eva-temp.ts`,
`_run-migrate.js`…). Vérifier que les fichiers résolus sont clean :

```bash
npm run lint 2>&1 | grep -iE 'AnimationInitializer|LayerRenderer|page-fetcher'
# aucune sortie = OK
```

## `package-lock.json`

En cas de conflit : prendre upstream puis régénérer.

```bash
git checkout --theirs package-lock.json && git add package-lock.json && npm install
```

## Migrations Windows

`npm run migrate:latest` échoue sous Windows (3 causes cumulées : `NODE_NO_WARNINGS=1`
en syntaxe Unix, `server-only` importé par `lib/credentials.ts`, `.env` non chargé hors
Next). Workaround : script temporaire `_run-migrate.js` à la racine — voir la mémoire
Claude `feedback_update_windows.md` pour le contenu complet.

Migrations arrivées en v1.27.8 :
`add_is_publishable_to_pages`, `drop_layer_styles_name_unique`,
`create_global_variables_table`, `widen_versions_entity_id`,
`widen_collection_fields_default`.

> **CSS** : si des layers sont modifiés hors éditeur (script DB), le CSS Tailwind ne
> se régénère pas — il est généré côté client **à la sauvegarde**. Il faut re-sauver
> dans l'éditeur.

---

## Inventaire des optims du fork

Objectif : **garder Eva CSS, réduire progressivement les optims** qui pèsent trop
cher face au core upstream.

| Optim | Poids | Gain | Statut |
|---|---|---|---|
| Lazy GSAP (`AnimationInitializer`) | ~35 l., 1 fichier | ~75 KiB unused JS | **Garder** — ratio excellent, conflit mécanique |
| `DEFAULT_IMAGE_QUALITY` (75 vs 85 upstream) | 1 argument | images + légères | **Garder** — coût nul |
| `computeImageSizes` (`asset-utils`) | 69 l. + 2 call sites core | 26 KiB sur le hero EasyStay | **Dette n°1** — à supprimer |

### Dette n°1 : `computeImageSizes`

**Upstream a convergé.** Sa règle 4 (`(max-width: 768px) 100vw, ${width}px`) est
exactement ce que fait désormais `buildImageSizes` d'upstream. Ce qui reste en propre,
ce sont les règles 2 et 3 : du tuning PSI taillé pour EasyStay (mockups portrait
`object-contain` en grille 2 colonnes). 69 lignes dans un fichier chaud pour un gain
sur un seul projet.

Décision (merge v1.27.8) : **conservée pour l'instant**, à réévaluer au prochain merge.

Procédure de suppression, si on tranche :

1. `lib/asset-utils.ts` — supprimer `computeImageSizes` (~69 l.) et ses regex dédiées
   (`OBJECT_CONTAIN_RE`, `FULL_BLEED_CLASS_RE`) si elles ne servent plus ailleurs.
2. `components/LayerRenderer.tsx` (~l. 2534) et `components/LayerRendererPublic.tsx`
   (~l. 1265) — remplacer :
   ```ts
   const sizes = computeImageSizes(layer.attributes, classesString, imgWidth, imgHeight);
   // par
   const sizes = buildImageSizes(parseImageDimension(imgWidth));
   ```
   puis corriger les imports (`computeImageSizes` → `buildImageSizes`).
3. `npm run type-check` + Lighthouse sur le hero EasyStay pour mesurer l'écart réel.

Bénéfice : les 2 call sites redeviennent identiques à upstream → **plus jamais de
conflit sur ces lignes**.
