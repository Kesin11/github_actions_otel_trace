import { parseArgs } from 'node:util';
import { GithubClient } from './github';
import { GithubActionsTracer } from './tracer';

const main = async () => {
  const args = process.argv.slice(2)
  const options = {
    'owner': { type: "string" as const },
    'repo': { type: "string" as const },
    'run_id': { type: "string" as const },
    'token': { type: "string" as const },
    'otlpEndoint': { type: "string" as const },
    'debug': {type: "boolean" as const },
  }
  const { values } = parseArgs({ args, options, strict: true })
  if (!(values.owner && values.repo && values.run_id)) throw new Error("--owner, --repo, or --run_id is undefined!")

  const GITHUB_TOKEN = values.token ?? process.env.GITHUB_TOKEN
  if (!GITHUB_TOKEN) throw new Error("--token or GITHUB_TOKEN is undefined!")
  const githubClient = new GithubClient({ token: GITHUB_TOKEN })
  const githubActionsTracer = new GithubActionsTracer({
    serviceName: 'github_actions',
    otlpEndpoint: values.otlpEndoint ?? "http://localhost:4318/v1/traces",
    debug: values.debug,
  })

  const owner = values.owner
  const repo = values.repo
  const runId = Number(values.run_id)
  const workflowRun = await githubClient.fetchWorkflowRun(owner, repo, runId)
  const jobs = await githubClient.fetchWorkflowJobs(owner, repo, runId)

  githubActionsTracer.startWorkflowSpan(workflowRun)
  githubActionsTracer.addJobSpans(jobs)
  githubActionsTracer.endWorkflowSpan(workflowRun)
  githubActionsTracer.shutdown()
}
main()
