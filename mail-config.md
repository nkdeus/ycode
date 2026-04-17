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

- **Resend** — simple, API key directe
- **Postmark** — excellent pour transactionnel
- **SendGrid** — historique, généreux en free tier
- **MailerSend** — alternative moderne

Tous ces providers ont un preset dans Ycode (**Settings → Email**).
