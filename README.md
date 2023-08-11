# Github Actions OpenTelemetly trace
Export GitHub Actions workflow data to OpenTelemetry.

- [npm(GitHub Packages)](https://github.com/Kesin11/github_actions_otel_trace/pkgs/npm/github_actions_otel_trace)

# all-in-one image for Google Cloud Trace (production sample)
all-in-one image includes OpenTelemetry(OTEL) collector binary and our nodejs server that receives GitHub webhook and exports trace data to OTEL collector in a one container image.

This image is an example of production use. You can deploy it to a managed container service like Cloud Run or run it directly on the machine with `docker compose`.

If you want to run the all-in-one image on your local machine for debugging, you need to do some setup for authorized Google Cloud before running `docker compose`.

```bash
# Create application default credentials
gcloud auth application-default login
# Add "project_id" keyvalue to json
vim ~/.config/gcloud/application_default_credentials.json

export GITHUB_PAT=xxxx
export COLLECTOR_CONFIG_YAML="./otel-collector-config-gcloud.yaml"

docker compose -f compose-all-in-one.yml up --build
```

If you want to deploy all-in-one image to your container registry, build from Dockerfile and set the tag.

```bash
docker buildx build -t YOUR_CONTAINER_REGISTRY_TAG:latest .
```

# `docker compose` for developing packages (github_actions_otel_trace and server)
Both packages github_actions_otel_trace and server can only send trace data to OpenTelemetry collector, so these need some collector that can receive OpenTelemetry protocol and web server that provides display the trace data for development.

We provide [compose.yml](./compose.yml) which includes OpenTelemetry collector and [jaeger](https://www.jaegertracing.io/). You should run containers before developing js packages.

```bash
docker compose up -d
```

# Required scope for GitHub Token
Fine-grained token:

- Actions: Read-only

Classic Token:

- repo
