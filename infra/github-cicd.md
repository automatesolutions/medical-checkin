# GitHub → Cloud Build → Cloud Run (CI/CD)

Repo: `https://github.com/automatesolutions/medical-checkin`  
GCP project: `medical-check-in`  
Region: `us-west1`

## First deploy (recommended: Cloud Shell)

Local Windows `gcloud` may hit SSL errors. Use **Cloud Shell** in the GCP Console while project **Medical check-in** is selected.

1. Open [Cloud Console](https://console.cloud.google.com/welcome?project=medical-check-in)
2. Click **Activate Cloud Shell**
3. Clone and run:

```bash
git clone https://github.com/automatesolutions/medical-checkin.git
cd medical-checkin

export DB_ROOT_PASSWORD="$(openssl rand -base64 24)"
export DB_APP_PASSWORD="$(openssl rand -base64 24)"
# Save these passwords somewhere safe (password manager). You will not see them again easily.

bash infra/deploy-first.sh
```

The script enables APIs, creates Artifact Registry, Cloud SQL, `DATABASE_URL` secret, IAM, and deploys **both** Cloud Run services. It prints:

- Public form URL (`…/c/bearclaw-creek`)
- Admin URL

## Wire GitHub CI/CD (after first deploy succeeds)

1. Console → **Cloud Build** → **Triggers** → **Connect repository**
2. Provider: **GitHub** → authorize → select `automatesolutions/medical-checkin`
3. Create trigger:
   - Name: `deploy-medical-checkin`
   - Event: Push to branch
   - Branch: `^main$`
   - Config: `infra/cloudbuild.yaml`
4. Substitution variables:

| Name | Value |
|---|---|
| `_REGION` | `us-west1` |
| `_AR_REPO` | `medical-checkin` |
| `_SERVICE_ADMIN` | `medical-admin` |
| `_SERVICE_CHECKIN` | `medical-checkin` |
| `_SQL_INSTANCE` | `medical-check-in:us-west1:medical-checkin-pg` |
| `_PUBLIC_CHECKIN_ORIGIN` | *(paste check-in Cloud Run URL from first deploy, no trailing slash)* |

5. Save → **Run** once, or `git push` to `main`.

After that, every push to `main` rebuilds and redeploys admin + check-in.

## After CI/CD works

1. Open public form: `https://<checkin-url>/c/bearclaw-creek`
2. Lock admin with **IAP** (staff Google accounts only)
3. Turn on **2-step verification** for your Google account (Console banner)
4. Do not leave demo seed on for real incidents after go-live

## Manual rebuild without waiting for a push

```bash
gcloud config set project medical-check-in
gcloud builds submit --config=infra/cloudbuild.yaml \
  --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD),_SQL_INSTANCE=medical-check-in:us-west1:medical-checkin-pg,_PUBLIC_CHECKIN_ORIGIN=https://YOUR-CHECKIN-URL
```
