# Github Actions OpenTelemetly tracce
Export Github Actions job data as tracing with OpenTelemetly

# all-in-one
```bash
export GITHUB_PAT=xxxx
cp otel-collector-config.yaml otel-collector-config-gcloud.yaml
docker compose -f compose-all-in-one.yml up --build
```