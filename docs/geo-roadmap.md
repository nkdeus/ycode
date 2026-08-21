# GEO — ce qui est généré, ce qui reste à faire

GEO (*generative engine optimization*) : rendre un site lisible par les moteurs
génératifs — ChatGPT, Claude, Perplexity, AI Overviews — et pas seulement par
Google. Le pivot technique tient en une phrase : **ces crawlers n'exécutent pas
de JavaScript**. Ils ne voient que ce que le serveur a envoyé.

Ce document décrit l'état du fork après le chantier GEO d'août 2026, et ce qui
reste ouvert.

---

## Généré automatiquement

| Quoi | Où | Depuis quoi |
|---|---|---|
| `/llms.txt` | `lib/geo/llms-txt.ts` | pages publiées, dossiers, collections CMS |
| `WebSite` | `lib/geo/structured-data.ts` | SEO de la page d'accueil + URL de base |
| `WebPage` | idem | titre/description SEO, locale, timestamps, image sociale |
| `BreadcrumbList` | idem | hiérarchie des dossiers |
| `Organization` / `LocalBusiness` | `lib/geo/business-identity.ts` | réglage `business_identity` |
| `Article`, `Service`, `AboutPage`, `ContactPage`, `CollectionPage` | `lib/geo/schema-types.ts` | type choisi dans les réglages SEO de la page |
| `Product`, `Event` | idem + `lib/geo/schema-bindings.ts` | type choisi + propriétés liées à un champ CMS ou saisies |
| `<html lang>` **côté serveur** | `app/(site)/layout.tsx` | locale publiée par défaut |

Trois principes ont guidé le découpage :

**Rien n'est deviné.** Tout ce qui est émis est dérivé de données que le site
possède déjà. Une donnée structurée qui contredit la page est pire que pas de
donnée du tout — Google pénalise, et un LLM cite de travers.

**L'override manuel gagne toujours.** Un `llms.txt` collé dans Réglages →
Général remplace la version générée. Le champ n'est pas devenu décoratif, il est
devenu optionnel.

**Le code vit dans ses propres fichiers.** `lib/geo/` ne touche le cœur qu'en
quatre points (la route `llms.txt`, le layout du site, deux lignes dans
`PageRenderer`, un champ dans les réglages). C'est la règle du fork : voir
`doc-update.md`.

### Le réglage `business_identity`

Les faits d'entreprise sont saisis en JSON dans Réglages → Général, et mappés
vers schema.org par `lib/geo/business-identity.ts`. Toutes les clés sont
optionnelles ; les clés inconnues sont **écartées** plutôt que recopiées — cet
objet est sérialisé dans chaque page publiée, une faute de frappe partirait en
propriété invalide sur tout le site.

Deux garde-fous : sans `name` aucun nœud n'est émis (une entité sans nom
n'identifie personne), et un `LocalBusiness` sans adresse retombe en
`Organization` — le type dit que l'entreprise est quelque part, l'affirmer sans
adresse est une déclaration que les moteurs rejettent.

La table `settings` n'a pas de séparation brouillon/publié : la sauvegarde prend
effet dès la régénération des pages. Un formulaire dédié (champs séparés, choix
du logo dans les assets) reste à faire — le champ JSON est une v1.

### Type de page

Un sélecteur dans les réglages SEO de chaque page (`seo.schema_type`), `WebPage` par
défaut. Deux familles :

- **Sous-types de `WebPage`** — `AboutPage`, `ContactPage`, `CollectionPage` : ils
  retypent le nœud de page sur place, aucun champ supplémentaire.
- **Types d'entité** — `Article`, `Service`, `Product`, `Event` : ils décrivent le *sujet*
  de la page et sortent en nœud distinct, relié par `mainEntity` / `mainEntityOfPage`.
  Séparés parce que `breadcrumb` et `isPartOf` sont des propriétés de `WebPage` et
  `headline` / `author` ne le sont pas — un nœud unique portant les deux serait invalide.

`Article` reprend le titre, la description, l'image, et les dates de publication et de
mise à jour ; `author` et `publisher` pointent sur `#organization` quand une identité
d'entreprise est renseignée. `Service` ajoute `provider` et les zones desservies.

Ce qui n'est pas dérivable reste au code personnalisé, sur **le même `@id`** : JSON-LD
fusionne les nœuds qui partagent un identifiant. C'est ainsi que /tarifs porte son
`hasOfferCatalog` — les prix ne vivent nulle part dans Ycode — tout en héritant du reste
du nœud depuis le générateur.

### Propriétés que la page ne possède pas

`Article` et `Service` se remplissent entièrement depuis la page. `Product` et `Event`
non : un prix et une date de début n'existent nulle part dans les réglages d'une page, et
schema.org rejette ces types quand leurs propriétés obligatoires manquent.

D'où `seo.schema_fields` : une liaison par propriété, avec deux sources — un **champ CMS**
sur une page dynamique (une liaison couvre toute la collection), ou une **valeur littérale**
saisie une fois pour une page isolée. C'est le mécanisme de l'image SEO, généralisé.

L'éditeur n'affiche que les propriétés du type sélectionné : prix, devise et disponibilité
pour `Product` ; début, fin et lieu pour `Event`. Les obligatoires sont marquées, et un
avertissement explique ce qui se passe si elles restent vides.

**Une propriété obligatoire non résolue supprime le nœud entier**, pas seulement la
propriété. La granularité est l'item, pas la page : dans un catalogue, un produit sans prix
ne publie rien pendant que ses voisins publient normalement. Un nœud incomplet coûterait à
la page le reste de son balisage.

Reste ouvert si le besoin apparaît : `aggregateRating` et `review` (il faudrait un endroit
où stocker des avis), `eventAttendanceMode` (présentiel / en ligne), et une adresse
structurée pour `location` plutôt qu'une ligne de texte.

---

## Non généré, et pourquoi

### `FAQPage`

Le balisage FAQ est celui qui se transforme le plus directement en réponse
citée. Il exige que les questions et réponses balisées soient **visibles sur la
page** — sinon c'est une violation des règles de Google.

Deux approches, et la première est un piège :

- ❌ **Détection heuristique** d'un accordéon dans l'arbre de layers. Fragile,
  silencieuse quand elle se trompe, et elle se trompera : tous les accordéons ne
  sont pas des FAQ.
- ✅ **Déclaration explicite** : un réglage sur le layer section, « cette section
  est une FAQ », plus la désignation du layer question et du layer réponse dans
  l'élément répété. Le générateur lit l'arbre publié et extrait les paires.

**Effort** : ~1,5 jour, l'essentiel en UI d'édition de layer.

### `lastmod` du sitemap

Rien à faire : `lib/sitemap-utils.ts` le remplit déjà depuis `page.updated_at` et
`item.updated_at`, sur toutes les URL.

---

## Ce qui restera toujours manuel

Aucune génération ne remplace ces points — ils relèvent du contenu :

- **Dates visibles** en tête d'article. Le JSON-LD porte la date, mais un lecteur
  humain et un modèle qui résume la page la cherchent aussi dans le texte.
- **Sources externes.** Les modèles récents privilégient nettement ce qui
  s'appuie sur des références traçables.
- **Tableaux comparatifs.** Un `<table>` est l'une des structures les mieux
  extraites et recitées ; la même comparaison en paragraphes se perd.
- **Image sociale par page.** Ycode a le champ, il faut le remplir.
- **Contenu répondant à une question.** Un titre en forme de question suivi
  d'une réponse directe en deux phrases est ce qu'un moteur génératif découpe le
  plus proprement.

---

## Vérifier

```bash
# ce que voit un crawler de LLM — pas de JS, user-agent explicite
curl -s -A "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)" https://SITE/ \
  | grep -o '<script type="application/ld+json">[^<]*'

curl -s https://SITE/llms.txt
curl -s https://SITE/ | grep -o '<html[^>]*>'
```

Puis le [test des résultats enrichis](https://search.google.com/test/rich-results)
et le [validateur schema.org](https://validator.schema.org/) sur une URL de
chaque type.

**Piège de cache.** Le JSON-LD et le `lang` sont figés dans le HTML au rendu.
Après un changement de locale ou de réglage d'entreprise, les pages en cache
gardent l'ancienne valeur jusqu'à invalidation — voir le correctif
`fix: invalidate all pages when the default locale changes`, qui traitait
exactement ce cas.
