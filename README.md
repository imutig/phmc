# Secrétaire Spades

Portail de recrutement et intranet pour le Pillbox Hill Medical Center (PHMC).

## Structure

```
├── bot/        # Bot Discord (Node.js, Discord.js)
├── web/        # Application Web (Next.js, Tailwind CSS)
└── supabase/   # Scripts de migration SQL
```

## Prérequis

- Node.js 18+
- Compte Supabase
- Application Discord (avec bot)

## Installation

### Bot Discord
```bash
cd bot
npm install
cp env.example.txt .env
# Configurer les variables d'environnement
npm start
```

### Application Web
```bash
cd web
npm install
cp env.example.txt .env.local
# Configurer les variables d'environnement
npm run dev
```

## Déploiement

Ce projet est conçu pour être déployé sur **Railway** avec deux services distincts pointant vers `/bot` et `/web`.
