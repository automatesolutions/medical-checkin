#!/usr/bin/env bash
# First-time GCP setup + deploy for Medical Check-In
# Run in Google Cloud Shell (project: medical-check-in)
# Usage:
#   bash infra/deploy-first.sh
# Optional env:
#   DB_ROOT_PASSWORD=... DB_APP_PASSWORD=... REGION=us-west1

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-medical-check-in}"
REGION="${REGION:-us-west1}"
AR_REPO="${AR_REPO:-medical-checkin}"
SQL_INSTANCE="${SQL_INSTANCE:-medical-checkin-pg}"
DB_NAME="${DB_NAME:-checkin}"
DB_USER="${DB_USER:-checkin_app}"
SERVICE_ADMIN="${SERVICE_ADMIN:-medical-admin}"
SERVICE_CHECKIN="${SERVICE_CHECKIN:-medical-checkin}"
GITHUB_OWNER="${GITHUB_OWNER:-automatesolutions}"
GITHUB_REPO="${GITHUB_REPO:-medical-checkin}"

DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-}"
DB_APP_PASSWORD="${DB_APP_PASSWORD:-}"

if [[ -z "$DB_ROOT_PASSWORD" || -z "$DB_APP_PASSWORD" ]]; then
  echo "Set DB_ROOT_PASSWORD and DB_APP_PASSWORD before running."
  echo "Example:"
  echo "  export DB_ROOT_PASSWORD='$(openssl rand -base64 24)'"
  echo "  export DB_APP_PASSWORD='$(openssl rand -base64 24)'"
  echo "  bash infra/deploy-first.sh"
  exit 1
fi

echo "==> Project: $PROJECT_ID  Region: $REGION"
gcloud config set project "$PROJECT_ID"
gcloud config set run/region "$REGION"

echo "==> Enable APIs"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  iap.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  compute.googleapis.com

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
# Default Compute SA often used by Cloud Run
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "==> Artifact Registry"
if ! gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Medical Check-In images"
else
  echo "    repo $AR_REPO already exists"
fi

echo "==> Cloud SQL"
if ! gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1; then
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 \
    --tier=db-custom-1-3840 \
    --region="$REGION" \
    --root-password="$DB_ROOT_PASSWORD" \
    --storage-auto-increase
else
  echo "    instance $SQL_INSTANCE already exists"
fi

if ! gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" >/dev/null 2>&1; then
  gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE"
fi

if ! gcloud sql users list --instance="$SQL_INSTANCE" --format='value(name)' | grep -qx "$DB_USER"; then
  gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_APP_PASSWORD"
else
  gcloud sql users set-password "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_APP_PASSWORD"
fi

CONNECTION_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
# Use @localhost/ so Node/postgres.js can parse the URL; ?host=/cloudsql/... selects the socket.
DB_PASS_ENC=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$DB_APP_PASSWORD")
DATABASE_URL="postgres://${DB_USER}:${DB_PASS_ENC}@localhost/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"

echo "==> Secret DATABASE_URL"
if gcloud secrets describe DATABASE_URL >/dev/null 2>&1; then
  echo -n "$DATABASE_URL" | gcloud secrets versions add DATABASE_URL --data-file=-
else
  echo -n "$DATABASE_URL" | gcloud secrets create DATABASE_URL --data-file=-
fi

echo "==> IAM for Cloud Build + Cloud Run"
for ROLE in \
  roles/run.admin \
  roles/iam.serviceAccountUser \
  roles/artifactregistry.writer \
  roles/secretmanager.secretAccessor \
  roles/cloudsql.client
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${CB_SA}" \
    --role="$ROLE" \
    --quiet >/dev/null
done

for ROLE in roles/cloudsql.client roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="$ROLE" \
    --quiet >/dev/null
done

# Allow Cloud Build SA to use Compute SA when deploying Cloud Run
gcloud iam service-accounts add-iam-policy-binding "$COMPUTE_SA" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet >/dev/null || true

echo "==> First Cloud Build deploy (admin + checkin)"
# Placeholder origin; update after we know the check-in URL
PUBLIC_ORIGIN="${PUBLIC_CHECKIN_ORIGIN:-https://placeholder.example}"

gcloud builds submit --config=infra/cloudbuild.yaml \
  --substitutions="COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo manual),_REGION=${REGION},_AR_REPO=${AR_REPO},_SERVICE_ADMIN=${SERVICE_ADMIN},_SERVICE_CHECKIN=${SERVICE_CHECKIN},_SQL_INSTANCE=${CONNECTION_NAME},_PUBLIC_CHECKIN_ORIGIN=${PUBLIC_ORIGIN}"

CHECKIN_URL="$(gcloud run services describe "$SERVICE_CHECKIN" --region="$REGION" --format='value(status.url)')"
ADMIN_URL="$(gcloud run services describe "$SERVICE_ADMIN" --region="$REGION" --format='value(status.url)')"

echo "==> Update PUBLIC_CHECKIN_ORIGIN on admin"
gcloud run services update "$SERVICE_ADMIN" --region="$REGION" \
  --update-env-vars="PUBLIC_CHECKIN_ORIGIN=${CHECKIN_URL}"

echo ""
echo "============================================"
echo "Deployed."
echo "Public form:  ${CHECKIN_URL}/c/bearclaw-creek"
echo "Admin:        ${ADMIN_URL}"
echo "SQL instance: ${CONNECTION_NAME}"
echo ""
echo "Next: Cloud Build → Triggers → Connect GitHub"
echo "  Repo: ${GITHUB_OWNER}/${GITHUB_REPO}"
echo "  Config: infra/cloudbuild.yaml"
echo "  Branch: ^main$"
echo "  Substitutions:"
echo "    _SQL_INSTANCE=${CONNECTION_NAME}"
echo "    _PUBLIC_CHECKIN_ORIGIN=${CHECKIN_URL}"
echo "Then enable IAP on medical-admin for staff Google accounts."
echo "============================================"
