# Eva CSS for Ycode — Chrome Extension

Extension Chrome (Manifest V3) qui ajoute le support Eva CSS directement dans l'editeur Ycode. Fonctionne avec le package npm `eva-css-for-tailwind` et les API routes Eva CSS du projet.

## Installation

1. Ouvrir `chrome://extensions/` dans Chrome
2. Activer le **Mode developpeur** (toggle en haut a droite)
3. Cliquer **Charger l'extension non empaquetee**
4. Selectionner le dossier `extensions/eva-css/` du projet

L'extension se charge automatiquement sur `localhost/ycode/*`.

## Fonctionnalites

### 1. Injection du bridge CSS dans le canvas

Le CSS fluide (genere par l'app Eva CSS dans Ycode) est injecte dans l'iframe de l'editeur canvas via un element `<style id="eva-bridge-ext">`. Cela permet de voir les valeurs `clamp()` en temps reel pendant l'edition.

### 2. Contrainte des inputs de sizing

Les champs de saisie numeriques dans les panneaux de design (padding, margin, gap, width, height, font-size) sont contraints aux valeurs configurees dans Eva CSS :

- **Datalist** : suggestions des valeurs Eva dans les champs
- **Snap on blur** : quand l'utilisateur saisit une valeur libre, elle est arrondie a la valeur Eva la plus proche en quittant le champ

Les inputs sur les pages `/ycode/integrations/` et `/ycode/settings/` ne sont pas affectes.

### 3. Picker d'intensite

Un panneau flottant apparait en bas de l'ecran quand un layer avec des classes arbitraires pixel (ex: `pb-[200px]`, `text-[32px]`) est selectionne dans le canvas :

```
Eva — Intensity
pb-[200px]    [++] [+] [=] [-]
text-[32px]   [++] [+] [=]
```

- `++` Extreme — scaling maximal (grande reduction sur mobile)
- `+` Strong — scaling prononce
- `=` Normal — scaling par defaut
- `-` Light — scaling subtil (spacing uniquement, pas sur font-size)

Chaque clic :
- Applique immediatement le CSS dans le canvas (feedback visuel instantane)
- Sauvegarde l'override en base via `POST /ycode/api/eva-css/intensity`
- Met a jour le bridge CSS dans `custom_code_head` (pages publiees)

Les overrides sont **par classe** (globaux), pas par layer — un changement sur `pb-[200px]` affecte tous les elements avec cette classe.

## Architecture

```
extensions/eva-css/
  manifest.json    # Manifest V3, content script sur localhost/ycode/*
  content.js       # Script unique — config, injection, datalists, picker
  icons/
    icon48.png     # Icone de l'extension
  README.md
```

### API utilisees

| Endpoint | Methode | Role |
|----------|---------|------|
| `/ycode/api/eva-css/settings` | GET | Charger config + etat enabled |
| `/ycode/api/settings/eva_bridge_css` | GET | Charger le bridge CSS genere |
| `/ycode/api/eva-css/intensity` | GET | Charger les overrides d'intensite sauvegardes |
| `/ycode/api/eva-css/intensity` | POST | Sauvegarder un override + patcher le bridge CSS |

### Flux de donnees

```
Extension charge
  -> GET /eva-css/settings (config, enabled)
  -> GET /settings/eva_bridge_css (CSS fluide)
  -> GET /eva-css/intensity (overrides sauvegardes)
  -> Injection bridge CSS dans iframe canvas
  -> Attach datalists sur les inputs
  -> Ecoute mouseup dans le canvas pour detecter la selection de layers

Clic intensite dans le picker
  -> CSS injecte dans le canvas (instantane)
  -> POST /eva-css/intensity (sauvegarde + patch bridge CSS + custom_code_head)
```

## Configuration

La configuration Eva CSS se fait dans l'app Ycode : `/ycode/integrations/eva-css`

- Sizes et font-sizes autorises
- Screen width de design
- Parametres avances (min ratio, extreme floor, ease zone, etc.)
- Bouton **Save & Generate** pour regenerer le bridge CSS complet

## Developpement

Apres modification de `content.js` :
1. Aller sur `chrome://extensions/`
2. Cliquer l'icone de rechargement sur l'extension "Eva CSS for Ycode"
3. Recharger la page Ycode

Pas de build step — le JS est execute tel quel par Chrome.
