# @kesin11/github_actions_otel_trace
Export GitHub Actions workflow data to OpenTelemetry.

# USAGE

```typescript
  const githubClient = new GithubClient({ token: GITHUB_TOKEN })
  const githubActionsTracer = new GithubActionsTracer({
    serviceName: 'github_actions',
    otlpEndpoint: "http://localhost:4318/v1/traces",
    debug: true,
  })

  const owner = "Kesin11"
  const repo = "github_actions_otel_trace"
  const runId = Number("11223344") // GitHub Actions run_id
  const workflowRun = await githubClient.fetchWorkflowRun(owner, repo, runId)
  const jobs = await githubClient.fetchWorkflowJobs(owner, repo, runId)

  githubActionsTracer.startWorkflowSpan(workflowRun)
  githubActionsTracer.addJobSpans(jobs)
  githubActionsTracer.endWorkflowSpan(workflowRun)
  githubActionsTracer.shutdown()
```

# CLI
It provides CLI for debugging or just trying using one shot workflow data.

```bash
ts-node src/cli.ts \
  --owner Kesin11 \
  --repo github_actions_otel_trace \
  --run_id 11223344 \
  --token $GITHUB_TOKEN \
  --otlpEndpoint http://localhost:4318/v1/trace \
  --debug
```

or use npx

```bash
npx @kesin11/github_actions_otel_trace
```