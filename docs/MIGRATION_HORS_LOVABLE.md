# Migration de Daily Deep Dive hors de Lovable

État au 8 novembre 2026. Ce document est le garde-fou opérationnel : aucune
résiliation, suppression de projet ou écriture de production n'est autorisée
avant la fin de la validation.

## Ce que l'audit a établi

- Le dépôt GitHub `lucilegrls/Daily-deep-dive` sur `main` contient une ancienne
  PWA statique : 64 sujets locaux, favoris dans `localStorage`, aucun compte et
  aucune synchronisation cloud. Il ne doit pas remplacer la version publiée.
- L'export complet de code Lovable du 8 novembre contient React 19,
  TanStack Start, Supabase JS, 37 tables publiques typées, les migrations SQL,
  les tests RLS, tous les thèmes et les composants de lecture.
- La base active est à l'hôte
  `c--2a049fca-1458-49dc-a4a8-202285b17bdd-prod.lovable.cloud`. Ce n'est donc pas
  un projet Supabase indépendant contrôlé depuis un compte Supabase classique.
- L'export de catalogue vérifié du 22 octobre contient 331 sujets. Le code
  embarque aussi une base historique de 64 sujets, une banque de 220 idées et un
  backlog de 188 idées ; ces nombres se recouvrent et ne doivent pas être
  additionnés.
- Aucun objet applicatif Storage n'est à copier : l'export contient un bucket de
  service Lovable et zéro ligne dans `storage.objects`.
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
- Export PostgreSQL complet du 8 novembre :
  `backups/lovable-full-2026-11-08/curiosity-sourced_261108.backup`.
- Archive d'origine et SHA-256 :
  `curiosity-sourced_261108.backup.zip`,
  `B5F0C7C6CC0EE7005B33FB6513C3F8989603E88833000DD93094FC302F6ACFAB`.
- Export du code Lovable du 8 novembre et SHA-256 :
  `backups/lovable-code-2026-11-08/curiosity-sourced.zip`,
  `8CE371ED973450A08014BC682F7449D627F9C4937191A68AE10BE5BDBC3E0487`.

Rollback du code local : créer une nouvelle branche depuis le tag
`lovable-export-2026-10-22`. Ne pas réécrire l'historique publié de Lovable.

## Sauvegarde et restauration effectuées

Le fichier de sauvegarde complet a été exporté depuis Lovable Cloud et restauré
dans le projet Supabase Free indépendant `klsxbfzxlrdglcsimtgm`, en région
Singapour. Lovable et ses sauvegardes quotidiennes sont restés intacts.

La sauvegarde contient et permet de compter :

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

## Éléments encore à terminer

- configuration OAuth Google pour la nouvelle URL ;
- ajout de la clé serveur Supabase comme secret Cloudflare ;
- publication de la préproduction Cloudflare Free ;
- publication de la branche de migration sur GitHub, sans remplacer `main` ;
- tests connectés d'écriture avec l'utilisateur migré et test OAuth Google.

Ces étapes impliquent des comptes externes ou des changements de production et
nécessitent donc une confirmation au moment de leur exécution.

## Vérifications déjà réussies

- TypeScript strict : réussi.
- Tests unitaires : 246/246 réussis dans 20 fichiers.
- Build Node/Nitro : réussi.
- Build Cloudflare Workers : réussi.
- Packaging Wrangler en mode `--dry-run` : réussi, sans déploiement.
- Comparaison source/cible : 82 tables Auth/Public/Storage contrôlées, 82
  identiques, aucune différence de nombre de lignes.
- Schéma public : 45 tables RLS, 83 politiques, 26 triggers et toutes les
  fonctions source présents dans la cible.
- Données fonctionnelles : 331 sujets publiés, 1 324 ressources, 1 303
  contrôles techniques, profils, favoris, notes, lectures, progression et rôles
  préservés.
- Auth : utilisateurs, identités, sessions, jetons de rafraîchissement et MFA
  restaurés avec leurs mots de passe hachés.
- API publique de la cible : 331 sujets lisibles sous RLS avec la clé publique.
- Smoke test visuel local connecté à la cible : bibliothèque chargée, 331 sujets
  et 24 matières affichés, sans dépendance Lovable.
