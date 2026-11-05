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

## Développer avec Cursor

Ouvrir `Daily-deep-dive.code-workspace` dans Cursor. Les règles permanentes du
projet se trouvent dans `.cursor/rules/` et rappellent notamment de ne jamais
écrire dans la production ou versionner un secret.

Au premier démarrage :

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Renseigner uniquement les variables publiques de la cible Supabase dans
`.env.local`. Les clés serveur ne doivent être ajoutées qu'au moment de la
restauration contrôlée du backend.

## Sécurité et coûts

- Les clés `VITE_*` sont publiques par conception ; la clé service-role et la
  chaîne PostgreSQL sont exclusivement côté serveur.
- `AI_DRAFTING_ENABLED=false` empêche tout appel IA et toute dépense par défaut.
- Ne jamais supprimer Lovable Cloud avant le contrôle de parité et la période de
  rollback.
