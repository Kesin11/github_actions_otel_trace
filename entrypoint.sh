#!/usr/bin/env bash
set -euo pipefail

COLLECTOR_CONFIG_YAML=${COLLECTOR_CONFIG_YAML:-./otel-collector-config.yaml}
echo "COLLECTOR_CONFIG_YAML=${COLLECTOR_CONFIG_YAML}"

./otelcol-contrib --config "${COLLECTOR_CONFIG_YAML}" & npm run start