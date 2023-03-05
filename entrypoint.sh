#!/usr/bin/env bash
set -euo pipefail

./otelcol-contrib --config ./otel-collector-config.yaml & npm run start