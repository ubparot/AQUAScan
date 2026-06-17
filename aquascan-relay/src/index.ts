export interface Env {
  AQUASCAN_RELAY: DurableObjectNamespace<AquaScanRelay>
  AQUASCAN_DEVICE_TOKEN?: string
  FIREBASE_PROJECT_ID: string
}

type ClientRole = 'operator' | 'boat'

type ClientSession = {
  socket: WebSocket
  role: ClientRole
  authenticated: boolean
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'aquascan-relay' })
    }

    if (url.pathname !== '/operator' && url.pathname !== '/boat') {
      return new Response('Not found', { status: 404 })
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 })
    }

    const id = env.AQUASCAN_RELAY.idFromName('default')
    const relay = env.AQUASCAN_RELAY.get(id)
    return relay.fetch(request)
  },
}

export class AquaScanRelay {
  private sessions = new Set<ClientSession>()

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const role = url.pathname === '/boat' ? 'boat' : 'operator'
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    server.accept()
    this.attachSession(server, role)

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  private attachSession(socket: WebSocket, role: ClientRole) {
    const session: ClientSession = {
      socket,
      role,
      authenticated: false,
    }

    this.sessions.add(session)

    socket.addEventListener('message', (event) => {
      this.handleMessage(session, event.data)
    })

    socket.addEventListener('close', () => this.closeSession(session))
    socket.addEventListener('error', () => this.closeSession(session))

    socket.send(JSON.stringify({
      type: 'hello',
      role,
      authenticated: false,
      message: role === 'boat' ? 'Send boat_auth with device token.' : 'Send auth with Firebase ID token.',
    }))
  }

  private handleMessage(session: ClientSession, data: string | ArrayBuffer) {
    const message = this.parseMessage(data)
    if (!message) {
      this.send(session, { type: 'error', message: 'Invalid JSON message.' })
      return
    }

    if (!session.authenticated) {
      this.handleAuth(session, message)
      return
    }

    if (session.role === 'operator') {
      this.forwardToRole('boat', message)
      return
    }

    this.forwardToRole('operator', message)
  }

  private handleAuth(session: ClientSession, message: Record<string, unknown>) {
    if (session.role === 'boat') {
      if (message.type !== 'boat_auth' || message.token !== this.env.AQUASCAN_DEVICE_TOKEN) {
        this.send(session, { type: 'error', message: 'Boat authentication failed.' })
        session.socket.close(1008, 'auth failed')
        return
      }

      this.replaceExistingRole('boat', session)
      session.authenticated = true
      this.send(session, { type: 'auth_ok', role: 'boat' })
      this.forwardToRole('operator', { type: 'boat_connected' })
      return
    }

    if (message.type !== 'auth' || typeof message.token !== 'string') {
      this.send(session, { type: 'error', message: 'Operator authentication token required.' })
      session.socket.close(1008, 'auth required')
      return
    }

    // TODO: Verify Firebase ID token against FIREBASE_PROJECT_ID before enabling public control.
    // This placeholder keeps the WebSocket plumbing deployable while frontend/ESP integration is built.
    session.authenticated = true
    this.send(session, { type: 'auth_ok', role: 'operator' })
  }

  private replaceExistingRole(role: ClientRole, keeper: ClientSession) {
    for (const session of this.sessions) {
      if (session !== keeper && session.role === role) {
        session.socket.close(1000, 'replaced')
        this.sessions.delete(session)
      }
    }
  }

  private forwardToRole(role: ClientRole, message: unknown) {
    for (const session of this.sessions) {
      if (session.role === role && session.authenticated) {
        this.send(session, message)
      }
    }
  }

  private closeSession(session: ClientSession) {
    this.sessions.delete(session)

    if (session.role === 'operator') {
      this.forwardToRole('boat', { type: 'neutralize', reason: 'operator disconnected' })
    }

    if (session.role === 'boat') {
      this.forwardToRole('operator', { type: 'boat_disconnected' })
    }
  }

  private send(session: ClientSession, message: unknown) {
    session.socket.send(JSON.stringify(message))
  }

  private parseMessage(data: string | ArrayBuffer) {
    if (typeof data !== 'string') return null

    try {
      const parsed = JSON.parse(data)
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
    } catch {
      return null
    }
  }
}
