#!/usr/bin/env bash
# Deploy admin.novalyte.io (dashboard) to Cloud Run on project novalyte-web.
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-novalyte-web}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-novalyte-admin}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/novalyte/${SERVICE}:$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"

gcloud config set project "${PROJECT_ID}"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --project="${PROJECT_ID}"

if ! gcloud artifacts repositories describe novalyte --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create novalyte \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Novalyte container images" \
    --project="${PROJECT_ID}"
fi

gcloud builds submit --tag "${IMAGE}" --project="${PROJECT_ID}"

gcloud run deploy "${SERVICE}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --project="${PROJECT_ID}"

echo "Deployed. Map domain: gcloud run domain-mappings create --service=${SERVICE} --domain=admin.novalyte.io --region=${REGION} --project=${PROJECT_ID}"
