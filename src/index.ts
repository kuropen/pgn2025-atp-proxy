import { BskyAgent, type AtpAgentOptions, type AtpSessionData } from '@atproto/api'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { env } from 'hono/adapter'
import type { Env } from './@types.js'
import 'dotenv/config'

let sessionData: AtpSessionData | undefined

const atpOpts: AtpAgentOptions = {
  service: 'https://bsky.social',
  persistSession: (evt, session) => {
    if (evt === 'create') {
      sessionData = session
    } else if (evt === 'expired') {
      sessionData = undefined
    }
  }
}

const bsAgent = new BskyAgent(atpOpts)
const app = new Hono()

app.get('/', (c) => c.text('ATP Proxy is alive!'))
app.get('/feed', async (c) => {
  const {BS_APP_IDENTIFIER, BS_APP_PASSWORD} = env<Env>(c)
  if (!BS_APP_IDENTIFIER || !BS_APP_PASSWORD) {
    return c.json({error: 'Credential is missing'}, 503)
  }
  if (sessionData) {
    await bsAgent.resumeSession(sessionData)
  } else {
    await bsAgent.login({
      identifier: BS_APP_IDENTIFIER,
      password: BS_APP_PASSWORD,
    })
  }
  const authorFeed = await bsAgent.getAuthorFeed({
    actor: bsAgent.did ?? '',
    limit: parseInt(c.req.query('limit') ?? '50'),
  })
  return c.json({
    currentAccountDid: bsAgent.did,
    ...authorFeed,
  })
})

const port = 3000
console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})
