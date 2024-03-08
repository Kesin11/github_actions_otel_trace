FROM node:20 as node-builder
WORKDIR /builder

COPY --link package.json package-lock.json ./
COPY --link packages/ packages/
RUN npm ci && rm -rf ~/.npm
COPY --link . ./
RUN npm run build

FROM node:20 as otel-builder
WORKDIR /builder
# renovate: datasource=github-releases depName=open-telemetry/opentelemetry-collector-releases
ARG OTELCOL_CONTRIB_VERSION=0.96.0

RUN curl -LO https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${OTELCOL_CONTRIB_VERSION}/otelcol-contrib_${OTELCOL_CONTRIB_VERSION}_linux_amd64.tar.gz
RUN tar -xvf otelcol-contrib_${OTELCOL_CONTRIB_VERSION}_linux_amd64.tar.gz

FROM node:20-slim as prod
WORKDIR /app

RUN apt-get update \
    && apt-get install -y ca-certificates \
    && apt-get clean

COPY --link package.json package-lock.json ./
COPY --link --from=node-builder /builder/packages/ ./packages
RUN npm ci --omit=dev && rm -rf ~/.npm
COPY --link --from=otel-builder /builder/otelcol-contrib ./
COPY --link . ./

ENTRYPOINT [ "./entrypoint.sh" ]
