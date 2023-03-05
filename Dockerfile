FROM node:18 as node-builder
WORKDIR /builder

COPY --link package.json package-lock.json ./
COPY --link packages/ packages/
RUN npm ci && rm -rf ~/.npm
COPY --link . ./
RUN npm run build

FROM node:18 as otel-builder
WORKDIR /builder

RUN curl -LO https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v0.70.0/otelcol-contrib_0.70.0_linux_amd64.tar.gz
RUN tar -xvf otelcol-contrib_0.70.0_linux_amd64.tar.gz

FROM node:18-slim as prod
WORKDIR /app

COPY --link package.json package-lock.json ./
COPY --link --from=node-builder /builder/packages/ ./packages
RUN npm ci --omit=dev && rm -rf ~/.npm
COPY --link --from=otel-builder /builder/otelcol-contrib ./
COPY --link . ./

ENTRYPOINT [ "./entrypoint.sh" ]
