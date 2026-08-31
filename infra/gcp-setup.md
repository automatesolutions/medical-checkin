# GCP setup — Medical Check-In

Region example: `us-west1`. Do not store credential files in this repo.

## 1. Project services

```bash
gcloud services enable run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com iap.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com compute.googleapis.com
```

## 2. Artifact Registry

```bash
gcloud artifacts repositories create medical-checkin --repository-format=docker --location=us-west1
```

## 3. Cloud SQL (private IP recommended)

```bash
gcloud sql instances create medical-checkin-pg --database-version=POSTGRES_16 --tier=db-custom-1-3840 --region=us-west1 --root-password=CHANGE_ME
gcloud sql databases create checkin --instance=medical-checkin-pg
```

Put the Cloud SQL Unix socket URL in Secret Manager as `DATABASE_URL`:

`postgres://USER:PASS@localhost/checkin?host=/cloudsql/PROJECT:us-central1:medical-checkin-pg`

(Use `localhost` as the hostname so Node can parse the URL; the `host=/cloudsql/...` query param is what Cloud Run uses. URL-encode special characters in PASS.)

## 4. Cloud Run

Build via [cloudbuild.yaml](cloudbuild.yaml). Admin service: `--no-allow-unauthenticated`. Check-in service: `--allow-unauthenticated`.

## 5. IAP (admin only)

1. Create an OAuth brand and IAP client.
2. Enable IAP on the admin Cloud Run service or HTTPS load-balancer backend.
3. Grant `IAP-secured Web App User` to Medical Unit Google accounts.
4. The API reads `X-Goog-Authenticated-User-Email` as the audit actor.

## 6. Load balancer + Cloud Armor

- Host `admin.example.gov` → admin Cloud Run (IAP).
- Host `checkin.example.gov` → check-in Cloud Run (public).
- Cloud Armor rate-limit `POST /api/public/**`.

Set `PUBLIC_CHECKIN_ORIGIN` on the admin service to the public check-in origin so QR codes encode only that URL.

## 7. IAM

Least privilege. No document buckets. Cloud Run SA: Cloud SQL Client + Secret Manager Secret Accessor.

## 8. First data

After deploy, run migrate (happens on process start) and seed once if you want Bearclaw Creek synthetic data (`AUTO_SEED=1` on a one-off job only — never on production after go-live).
