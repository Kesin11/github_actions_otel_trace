# Github Actions OpenTelemetly tracce
Export Github Actions job data as tracing with OpenTelemetly

# all-in-one for GoogleCloud trace
```bash
# Create application default credentials
gcloud auth application-default login
# Add "project_id" keyvalue to json
vim ~/.config/gcloud/application_default_credentials.json

export GITHUB_PAT=xxxx
export COLLECTOR_CONFIG_YAML="./otel-collector-config-gcloud.yaml"

docker compose -f compose-all-in-one.yml up --build
```