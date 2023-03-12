# Github Actions OpenTelemetly tracce
Export Github Actions job data as tracing with OpenTelemetly

# all-in-one
```bash
# Create application default credentials
gcloud auth application-default login
# Add "project_id" keyvalue to json
vim ~/.config/gcloud/application_default_credentials.json

export GITHUB_PAT=xxxx
cp otel-collector-config.yaml otel-collector-config-gcloud.yaml
docker compose -f compose-all-in-one.yml up --build
```