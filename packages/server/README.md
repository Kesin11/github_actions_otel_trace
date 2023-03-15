# github_actions_otel_trace webhook sample server
This server receives GitHub `workflow_run` webhook and exports job tracing data to OpenTelemetry Collector.

## Available scripts

In the project directory, you can run:

### `npm run start`

To start the server in dev mode. It listen 0.0.0.0:3000 to receive webhook.

### `npm dev`

Start server and watch `*.ts` then reload automatically.

## Learn More

To learn Fastify, check out the [Fastify documentation](https://www.fastify.io/docs/latest/).
