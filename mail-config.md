# Configuration SMTP Ycode (Gmail)

Guide pour configurer l'envoi d'emails depuis Ycode (notifications de formulaire, etc.) via un compte Gmail.

## Pourquoi un App Password ?

Depuis 2022, Google **n'accepte plus** les mots de passe Gmail classiques pour le SMTP.
Erreur typique :

```
535-5.7.8 Username and Password not accepted.
```

Il faut générer un **App Password** (mot de passe d'application) dédié. C'est un code à 16 caractères spécifique à l'application, révocable à tout moment sans changer le mot de passe principal.

## Étape 1 — Activer la 2FA Google

Prérequis obligatoire : la double authentification doit être activée sur le compte Google du client.

1. Se connecter au compte Google du client
2. Aller sur https://myaccount.google.com/security
3. Section **"How you sign in to Google"** → activer **"2-Step Verification"**
4. Suivre la procédure (téléphone, SMS ou Google Authenticator)

## Étape 2 — Générer un App Password

1. Aller sur https://myaccount.google.com/apppasswords
   - Si la page est introuvable, c'est que la 2FA n'est pas activée (retour étape 1)
2. **App name** : `Ycode` (ou tout autre nom reconnaissable)
3. Cliquer **Create**
4. **Copier le mot de passe à 16 caractères** (format `xxxx xxxx xxxx xxxx`)
   - Ce code ne sera **plus jamais affiché** — le sauvegarder dans un gestionnaire de mots de passe
   - Les espaces peuvent être retirés lors de la saisie

## Étape 3 — Configurer dans Ycode

1. Dans l'éditeur Ycode → **Settings → Email**
2. Sélectionner le preset **Google**
3. Remplir :

| Champ     | Valeur                                 |
| --------- | -------------------------------------- |
| Host      | `smtp.gmail.com`                       |
| Port      | `587`                                  |
| Username  | Email Gmail complet du client          |
| Password  | **App Password** à 16 caractères       |
| From name | Nom affiché à l'expéditeur (ex : `EasyStay`) |
| From email| Même email que Username                |

4. Cliquer **Save**
5. Cliquer **Send test email** → vérifier la réception
6. Si succès : **"Connection successful!"** ✅

## Étape 4 — Lier le SMTP aux formulaires

Pour que les soumissions de formulaire soient envoyées par email :

1. Dans l'éditeur, sélectionner le **form**
2. Dans les settings → renseigner **"Email to"** (email destinataire des notifications)
3. Publier la page
4. Tester une soumission réelle

## Troubleshooting

| Erreur                                      | Cause                                  | Solution                          |
| ------------------------------------------- | -------------------------------------- | --------------------------------- |
| `535-5.7.8 Username and Password not accepted` | Mot de passe normal utilisé            | Générer un App Password           |
| Page `apppasswords` introuvable              | 2FA non activée                        | Activer la 2FA d'abord            |
| `Invalid login`                              | Typo dans l'email ou l'App Password    | Regénérer un App Password         |
| Mail envoyé mais jamais reçu                 | Filtré en spam                         | Vérifier le dossier spam          |

## Alternatives à Gmail

Si le client n'a pas de compte Google ou veut un SMTP dédié aux transactionnels (meilleure délivrabilité) :

- **Resend** — simple, API key directe (voir section dédiée ci-dessous)
- **Postmark** — excellent pour transactionnel
- **SendGrid** — historique, généreux en free tier
- **MailerSend** — alternative moderne

La plupart de ces providers ont un preset dans Ycode (**Settings → Email**). Resend n'a pas de preset → utiliser **Other**.

---

# Configuration SMTP Ycode (Resend)

Resend est une alternative moderne à Gmail, pensée pour le transactionnel (meilleure délivrabilité, dashboard d'analytics, pas besoin de 2FA / App Password).

## Étape 1 — Créer un compte Resend

1. S'inscrire sur https://resend.com
2. Le free tier permet 3 000 emails/mois et 100/jour — largement suffisant pour la plupart des sites Ycode

## Étape 2 — Vérifier un domaine

Resend **ne permet pas** d'envoyer depuis une adresse Gmail/Outlook personnelle. Il faut un domaine que tu possèdes.

1. Dashboard Resend → **Domains** → **Add Domain**
2. Saisir le domaine (ex : `easystay.com`)
3. Resend affiche des enregistrements DNS à ajouter chez le registrar (SPF, DKIM, MX optionnel pour DMARC)
4. Attendre la propagation DNS (quelques minutes à quelques heures)
5. Cliquer **Verify** → statut `Verified` ✅

Tant que le domaine n'est pas vérifié, seul `onboarding@resend.dev` est autorisé pour les tests.

## Étape 3 — Récupérer / créer l'API Key

1. Dashboard Resend → **API Keys** → **Create API Key**
2. Permissions : **Sending access** (suffisant pour SMTP)
3. Copier la clé (format `re_xxxxxxxx`) — affichée une seule fois

**API Key actuelle (EasyStay)** :

```
re_NtMyjXap_8UF7ht6oF3YmRGt7fBcuBELH
```

> ⚠️ Ce fichier est dans `.gitignore` — ne pas le commit. Si la clé fuite, la révoquer dans le dashboard Resend et en générer une nouvelle.

## Étape 4 — Configurer dans Ycode

1. Dans l'éditeur Ycode → **Settings → Email**
2. Sélectionner le preset **Other** (Resend n'a pas de preset dédié)
3. Remplir :

| Champ      | Valeur                                                   |
| ---------- | -------------------------------------------------------- |
| Host       | `smtp.resend.com`                                        |
| Port       | `587`                                                    |
| Username   | `resend` (littéralement le mot "resend", **pas l'email**) |
| Password   | API Key Resend (`re_...`)                                |
| From name  | Nom affiché à l'expéditeur (ex : `EasyStay`)             |
| From email | Adresse sur le **domaine vérifié** (ex : `noreply@easystay.com`) |

4. Cliquer **Save**
5. Cliquer **Send test email** → vérifier la réception
6. Si succès : **"Connection successful!"** ✅

## Étape 5 — Lier le SMTP aux formulaires

Identique à Gmail :

1. Dans l'éditeur, sélectionner le **form**
2. Settings → **"Email to"** (destinataire)
3. Publier la page
4. Tester une soumission réelle

## Troubleshooting Resend

| Erreur                              | Cause                                            | Solution                                            |
| ----------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| `Invalid login` / auth refusé       | Username ≠ `resend` ou clé API mal copiée        | Username = `resend`, recoller la clé sans espaces   |
| `From address not verified`         | `From email` n'est pas sur un domaine vérifié    | Vérifier le domaine ou utiliser `onboarding@resend.dev` |
| Test OK mais aucun mail reçu        | Domaine vérifié mais SPF/DKIM pas encore propagés | Attendre + vérifier dans Resend → **Logs**         |
| `403 Forbidden`                     | Clé API révoquée ou permissions insuffisantes    | Régénérer une clé avec `Sending access`             |

## Avantages Resend vs Gmail

- Pas de 2FA ni App Password à gérer
- Logs détaillés (ouvertures, bounces, etc.) dans le dashboard
- Délivrabilité supérieure (IP dédiées au transactionnel)
- Quota plus large (3k/mois free vs limites Gmail anti-spam)
- Limite Gmail : ~500 envois/jour, risque de blocage si formulaire spammé
