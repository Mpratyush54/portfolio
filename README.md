# pratyushes.dev

Personal portfolio for **Pratyush Mishra** — backend engineer, tech lead, full stack.

**Live:** [https://pratyushes.dev](https://pratyushes.dev)

## Stack

| Layer | Tech |
|---|---|
| Frontend | TypeScript / React (Ask Bud chat UI, work gallery) |
| Backend | Node.js + Express |
| Data | MongoDB (`projects` seed + sync metadata from GitHub/GitLab) |
| Deploy | Docker + Kubernetes manifests in-repo |

## Monorepo layout

```
portfolio/
├── frontend/          # Site UI
├── backend/           # API, seed, screenshot helpers
│   └── data/projects.js   # Curated project catalog (source of truth for Work)
├── kubernetes/       # Deploy manifests
└── .github/workflows/ # Docker build
```

## Local development

```bash
# Backend
cd backend
cp .env.example .env   # set MONGO_URI, mail, etc.
npm install
npm run seed           # loads backend/data/projects.js
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Updating the Work page

1. Edit `backend/data/projects.js` — keep the list **tight** (featured = strongest signal).
2. Run `npm run seed` against the production Mongo (or your deploy pipeline).
3. Prefer production links, honest status (`Development` vs `Production`), and real repos.

Curated featured set:

- Platform (PaaS / SDKs)
- ClassStream
- DayFlow
- CAPS Automation portal
- Phone Proctor
- Ambue
- Vision-You

## Contact

- Site: [pratyushes.dev](https://pratyushes.dev)
- GitHub: [Mpratyush54](https://github.com/Mpratyush54)
- Email: mpratyush54@gmail.com
