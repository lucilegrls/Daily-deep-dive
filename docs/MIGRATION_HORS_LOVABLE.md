# Migration de Daily Deep Dive hors de Lovable

État au 5 novembre 2026. Ce document est le garde-fou opérationnel : aucune
résiliation, suppression de projet ou écriture de production n'est autorisée
avant la fin de la validation.

## Ce que l'audit a établi

- Le dépôt GitHub `lucilegrls/Daily-deep-dive` sur `main` contient une ancienne
  PWA statique : 64 sujets locaux, favoris dans `localStorage`, aucun compte et
  aucune synchronisation cloud. Il ne doit pas remplacer la version publiée.
- Le dernier export complet de code Lovable disponible contient React 19,
  TanStack Start, Supabase JS, 37 tables publiques typées, les migrations SQL,
  les tests RLS, tous les thèmes et les composants de lecture.
- La base active est à l'hôte
  `c--2a049fca-1458-49dc-a4a8-202285b17bdd-prod.lovable.cloud`. Ce n'est donc pas
  un projet Supabase indépendant contrôlé depuis un compte Supabase classique.
- L'export de catalogue vérifié du 22 octobre contient 331 sujets. Le code
  embarque aussi une base historique de 64 sujets, une banque de 220 idées et un
  backlog de 188 idées ; ces nombres se recouvrent et ne doivent pas être
  additionnés.
- Aucun appel `storage.from(...)` ni bucket applicatif n'est présent dans le
  code. Il faut néanmoins vérifier `storage.buckets` et `storage.objects` dans
  la base avant de conclure qu'il n'existe aucun fichier hors dépôt.
- Les données personnelles sont réparties notamment dans `profiles`,
  `saved_topics`, `topic_notes`, `topic_reads`, `resource_progress`,
  `user_interests`, `topic_suggestions` et `user_roles`, avec références à
  `auth.users` et politiques RLS.
- Neuf images de thèmes étaient encore servies par le chemin privé Lovable
  `/__l5e/assets-v1/...`. Elles sont désormais conservées dans
  `public/theme-assets`; taille et signature PNG ont été vérifiées pour chacune.

## Point de restauration déjà créé

- Archive source locale :
  `backups/daily-deep-dive-lovable-source-2026-10-22.zip`
- SHA-256 :
  `F265702721C7C78C7B5BC2EE591D772EC4DCD5F5FF20F4AD3B2E9692A4D32765`
- Dépôt Git local de migration : commit `4533e85`, tag
  `lovable-export-2026-10-22`, branche `migration/independent-hosting`.
- Export partiel disponible : les 331 lignes `content_topics` du 22 octobre.
  Il ne remplace pas une sauvegarde complète de la base.

Rollback du code local : créer une nouvelle branche depuis le tag
`lovable-export-2026-10-22`. Ne pas réécrire l'historique publié de Lovable.

## Sauvegarde complète obligatoire avant basculement

Obtenir depuis Lovable Cloud une URL PostgreSQL de migration temporaire ou un
fichier de sauvegarde complet. Ne jamais coller cette URL dans Git ou dans un
ticket. Avec l'URL placée uniquement dans `SOURCE_DATABASE_URL`, exécuter le
script `scripts/backup-production.ps1`.

La sauvegarde est acceptée seulement si elle contient et permet de compter :

1. `auth.users`, identités et mots de passe hachés ;
2. toutes les tables, vues, fonctions, triggers, séquences et données `public` ;
3. rôles, grants, politiques RLS et historique des migrations ;
4. extensions et tâches `pg_cron` ;
5. inventaire et objets Storage, même si le code n'en utilise pas actuellement ;
6. empreintes SHA-256 et date UTC de chaque fichier.

Les clés API et réglages OAuth ne sont pas inclus dans un dump PostgreSQL. Ils
doivent être recréés dans le nouveau projet. Les anciens jetons peuvent devenir
invalides si la clé JWT change ; prévoir au minimum une reconnexion des
utilisateurs.

## Cible gratuite recommandée

- GitHub : dépôt privé ou public pour le code, sans `.env` ni export de données.
- Développement : Codex ou VS Code, Node 24 et pnpm.
- Base/Auth : nouveau projet Supabase Free, car le backend actuel appartient au
  domaine Lovable Cloud. Conserver PostgreSQL, les UUID, les fonctions et RLS ;
  ne pas convertir vers Firebase ou une autre base documentaire.
- Hébergement : préparer Cloudflare Workers Free pour TanStack Start, puis
  vérifier les limites réelles du compte avant activation. Aucun déploiement ne
  doit être créé automatiquement sans confirmation.
- IA : désactivée par défaut. L'ancien gateway Lovable est remplacé par une
  interface OpenAI-compatible optionnelle, seulement si un fournisseur et un
  budget sont explicitement choisis plus tard.

Le build Node/Nitro et le build Cloudflare sont distincts. Au 6 novembre 2026,
les deux compilent, le paquet Cloudflare passe `wrangler deploy --dry-run`, et
aucune publication n'a été effectuée. Les variables de production devront être
créées comme secrets Cloudflare ; aucune clé réelle ne doit entrer dans
`wrangler.jsonc`.

## Ordre de migration et critères d'arrêt

1. Export complet et test de restauration dans une cible isolée.
2. Recréer Auth (Google et e-mail), URL de site et URL de redirection.
3. Restaurer schéma et données, puis migrations manquantes.
4. Vérifier les comptes de lignes par table, les utilisateurs Auth, les rôles,
   les RLS, les fonctions et les tâches planifiées avec
   `scripts/inventory.sql` sur la source et la cible.
5. Tester avec quatre profils : anonyme, utilisateur, éditeur, propriétaire.
6. Tester thèmes, 331+ sujets, ressources, favoris, notes, lectures, progression,
   suggestions, export/suppression de compte et leaderboard.
7. Déployer sur une URL de préproduction et tester mobile/desktop, OAuth,
   rafraîchissement de session et routes serveur.
8. Geler les écritures pendant la courte fenêtre de copie finale, refaire le
   delta, puis basculer l'URL publique.
9. Garder Lovable intact au moins sept jours après le basculement, ou plus si le
   trafic est faible. Revenir à l'ancienne URL si une différence de données, une
   erreur RLS ou un échec Auth est détecté.
10. Résilier Lovable seulement après validation écrite des totaux et d'une
    restauration testée. La suppression du projet est une décision distincte et
    ultérieure.

## Éléments encore bloquants

- sauvegarde complète de production et preuve de restauration ;
- accès à un projet Supabase cible créé avec l'accord de la propriétaire ;
- configuration OAuth Google pour la nouvelle URL ;
- choix et création de l'hébergement gratuit ;
- synchronisation du dépôt GitHub, dont `main` est actuellement l'ancienne PWA.

Ces étapes impliquent des comptes externes ou des changements de production et
nécessitent donc une confirmation au moment de leur exécution.

## Vérifications locales déjà réussies

- TypeScript strict : réussi.
- Tests unitaires : 205/205 réussis dans 16 fichiers.
- Build Node/Nitro : réussi.
- Build Cloudflare Workers : réussi.
- Packaging Wrangler en mode `--dry-run` : réussi, sans déploiement.
- Smoke test HTTP : `/` et `/auth` répondent 200 ; CSS et neuf images de thèmes
  répondent 200 avec leur taille exacte.
- Contrôle visuel : sélecteur de langue et écran d'authentification rendus sans
  dépendance d'interface Lovable.

Limite : le backend Lovable Cloud n'était pas joignable de façon fiable depuis
le serveur local pendant le smoke test. La parité des 331 sujets, utilisateurs,
notes et progressions doit donc être prouvée sur la base restaurée, pas déduite
du seul build du frontend.
