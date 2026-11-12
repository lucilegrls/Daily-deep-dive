# Daily Deep Dive

Version de travail indépendante de Lovable. Le frontend est une application
React/TanStack Start et le backend reste PostgreSQL/Supabase afin de conserver
l'authentification, les rôles, les politiques RLS et toutes les données.

## Développement local

1. Copier `.env.example` vers `.env.local` et renseigner un projet Supabase de
   test ou de migration. Ne jamais committer ce fichier.
2. Installer les dépendances avec `pnpm install`.
3. Lancer `pnpm dev`.

Vérifications :

```sh
pnpm typecheck
pnpm test
pnpm build
```

Le build produit un serveur Nitro dans `.output/`. Il peut être lancé avec
`pnpm start`. Le déploiement public et le basculement DNS ne doivent être faits
qu'après la sauvegarde complète et la validation décrites dans
[`docs/MIGRATION_HORS_LOVABLE.md`](docs/MIGRATION_HORS_LOVABLE.md).

La cible Cloudflare Workers se vérifie sans publication avec :

```sh
pnpm build:cloudflare
wrangler deploy --dry-run
```

La commande `pnpm deploy:cloudflare` publie réellement : ne l'utiliser qu'après
la sauvegarde complète, la configuration des secrets et l'accord de basculement.

## Sécurité et coûts

- Les clés `VITE_*` sont publiques par conception ; la clé service-role et la
  chaîne PostgreSQL sont exclusivement côté serveur.
- `AI_DRAFTING_ENABLED=false` empêche tout appel IA et toute dépense par défaut.
- Ne jamais supprimer Lovable Cloud avant le contrôle de parité et la période de
  rollback.

## Assistant et MCP

Le serveur MCP en lecture seule est publié à `/mcp`. Il utilise les jetons
utilisateur Supabase et les politiques RLS existantes; aucune clé service-role
n'est utilisée par les outils. La découverte OAuth est publiée à
`/.well-known/oauth-protected-resource` et le consentement à `/oauth/consent`.

Dans Supabase → Authentication → OAuth Server, activer OAuth 2.1, définir
`/oauth/consent` comme Authorization Path et activer l'enregistrement dynamique
des clients si des assistants non préenregistrés doivent se connecter. Utiliser
une clé de signature JWT asymétrique avant d'activer OpenID Connect en
production. Le flux doit être testé avec un compte lecteur, puis révoqué depuis
la gestion des autorisations Supabase.

Les navigateurs compatibles disposent aussi de trois outils WebMCP locaux via
`document.modelContext`: lister les sujets visibles, filtrer le fil et ouvrir
un sujet. Les autres navigateurs ignorent cette intégration.

## Livraison et surveillance

- `.github/workflows/ci.yml` vérifie types, tests, lint et build Cloudflare.
- `.github/workflows/deploy.yml` ne publie qu'après avoir répété ces contrôles;
  il requiert `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` dans
  l'environnement GitHub `production`.
- `.github/workflows/production-monitor.yml` contrôle le site et ses en-têtes
  toutes les 30 minutes, ouvre une issue GitHub en cas d'échec et la ferme après
  récupération.
