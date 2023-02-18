import { FastifyPluginAsync, } from 'fastify'
import { verify } from '@octokit/webhooks-methods'

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

    // Skip if not a workflow_run event and completed action
    if (request.headers['X-GitHub-Event'] !== "workflow_run" || (request.body as any).action !== "completed" ) return reply.code(200).send()

    return reply.code(200).send("It works")
  })
}
export default app
