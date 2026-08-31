# Local development

```bash
npm install
npm test
```

In three terminals:

```bash
npm run dev --workspace=@medical/api
npm run dev --workspace=@medical/admin
npm run dev --workspace=@medical/checkin
```

- API: http://127.0.0.1:8787 (PGlite file under `apps/api/.data`, auto-seeds Bearclaw Creek)
- Admin: http://localhost:5173
- Public form: http://localhost:5174/c/bearclaw-creek

Set `DEV_ACTOR_EMAIL` to stamp admin edits. Production auth is Cloud IAP; see [../infra/gcp-setup.md](../infra/gcp-setup.md).
