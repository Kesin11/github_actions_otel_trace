import { FastifyPluginAsync, } from 'fastify'

// Start server using fastify-cli
const app: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/ping', async (request, reply) => {
    return { pong: 'it worked!' }
  })
}
export default app
