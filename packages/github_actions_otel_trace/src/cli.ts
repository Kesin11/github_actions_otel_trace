import { parseArgs } from 'node:util';
import { GithubClient } from './github';
import { GithubActionsTracer } from './tracer';

const main = async () => {
  const args = process.argv.slice(2)
  const options = {
    'owner': { type: "string" as const },
    'repo': { type: "string" as const },
    'run_id': { type: "string" as const },
  }
  const { values } = parseArgs({ args, options, strict: true })
  const owner = values.owner!
  const repo = values.repo!
  const runId = Number(values.run_id)

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is undefined!")
  const githubClient = new GithubClient({ token: GITHUB_TOKEN })
  const githubActionsTracer = new GithubActionsTracer({
    serviceName: 'github_actions',
    otlpEndpoint: "http://localhost:4318/v1/traces",
  })

  const workflowRun = await githubClient.fetchWorkflowRun(owner, repo, runId)
  const jobs = await githubClient.fetchWorkflowJobs(owner, repo, runId)

  githubActionsTracer.startWorkflowSpan(workflowRun)
  githubActionsTracer.addJobSpans(jobs)
  githubActionsTracer.endWorkflowSpan(workflowRun)
  githubActionsTracer.shutdown()
}
main()
