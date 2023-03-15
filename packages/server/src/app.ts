import { FastifyPluginAsync, } from 'fastify'
import { verify } from '@octokit/webhooks-methods'
import { WorkflowRunEvent } from '@octokit/webhooks-types'
import { GithubActionsTracer, GithubClient } from '@kesin11/github_actions_otel_trace'

// Start server using fastify-cli
const app: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/', async (request, reply) => {
    fastify.log.debug(request)
    const signature = request.headers['x-hub-signature-256']

    // Verify webhook secret
    if (process.env.WEBHOOK_SECRET && signature !== undefined) {
      if (await verify(process.env.WEBHOOK_SECRET, JSON.stringify(request.body), signature as string) === false) {
        return reply.code(400).send("Invalid webhook secret")
      }
    }

    const payload = request.body as WorkflowRunEvent
    // Skip if not a workflow_run event and completed action
    if (request.headers['X-GitHub-Event'] !== "workflow_run" && payload.action !== "completed" ) return reply.code(200).send("Not a workflow_run event or not completed action")

    const GITHUB_TOKEN = process.env.GITHUB_PAT ?? process.env.GITHUB_TOKEN
    if (!GITHUB_TOKEN) throw new Error("GITHUB_PAT or GITHUB_TOKEN is undefined!")
    const githubClient = new GithubClient({ token: GITHUB_TOKEN })
    const githubActionsTracer = new GithubActionsTracer({
      serviceName: 'github_actions',
      otlpEndpoint: "http://localhost:4318/v1/traces",
    })

    // Send jobs trace data
    const owner =  payload.repository.full_name.split('/')[0]
    const repo = payload.repository.name
    fastify.log.debug(`Fetch workflow jobs data: ${owner}/${repo}, run_id: ${payload.workflow_run.id}`)

    const workflowRun = await githubClient.fetchWorkflowRun( owner, repo, payload.workflow_run.id )
    const jobs = await githubClient.fetchWorkflowJobs(owner, repo, payload.workflow_run.id)

    githubActionsTracer.startWorkflowSpan(workflowRun)
    githubActionsTracer.addJobSpans(jobs)
    githubActionsTracer.endWorkflowSpan(workflowRun)
    githubActionsTracer.shutdown()

    fastify.log.debug(`Done to send trace data`)
    return reply.code(200).send(`Success to send trace data. { owner: ${owner}, repo: ${repo}, workflow_run_id: ${payload.workflow_run.id} }`)
  })
}
export default app
