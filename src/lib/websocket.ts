import { Server as SocketIOServer, type Socket } from "socket.io"
import type { Server as HTTPServer } from "http"
import { token } from "./utils"
import { redisPub, redisSub } from "./database"
import { config } from "./config"
import type { JWTPayload } from "./types"

interface AuthenticatedSocket extends Socket {
  userId?: string
  username?: string
}

export class WebSocketService {
  private io: SocketIOServer
  private connectedUsers = new Map<string, Set<string>>() // userId -> Set of socketIds

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      pingInterval: config.websocket.pingInterval,
      pingTimeout: config.websocket.pingTimeout,
    })

    this.setupMiddleware()
    this.setupEventHandlers()
    this.setupRedisSubscription()
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use((socket: AuthenticatedSocket, next) => {
      try {
        const authToken = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1]

        if (!authToken) {
          return next(new Error("Authentication token required"))
        }

        const payload = token.verify(authToken) as JWTPayload
        socket.userId = payload.userId
        socket.username = payload.username

        next()
      } catch (error) {
        next(new Error("Invalid authentication token"))
      }
    })
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.username} connected with socket ${socket.id}`)

      // Track connected user
      if (socket.userId) {
        if (!this.connectedUsers.has(socket.userId)) {
          this.connectedUsers.set(socket.userId, new Set())
        }
        this.connectedUsers.get(socket.userId)!.add(socket.id)

        // Join user's personal room
        socket.join(`user:${socket.userId}`)

        // Broadcast user online status
        this.broadcastUserStatus(socket.userId, "online")
      }

      // Handle joining conversation rooms
      socket.on("join_conversation", (conversationId: string) => {
        socket.join(`conversation:${conversationId}`)
        console.log(`User ${socket.username} joined conversation ${conversationId}`)
      })

      // Handle leaving conversation rooms
      socket.on("leave_conversation", (conversationId: string) => {
        socket.leave(`conversation:${conversationId}`)
        console.log(`User ${socket.username} left conversation ${conversationId}`)
      })

      // Handle typing indicators
      socket.on("typing_start", (data: { conversationId: string }) => {
        socket.to(`conversation:${data.conversationId}`).emit("user_typing", {
          userId: socket.userId,
          username: socket.username,
          conversationId: data.conversationId,
        })
      })

      socket.on("typing_stop", (data: { conversationId: string }) => {
        socket.to(`conversation:${data.conversationId}`).emit("user_stopped_typing", {
          userId: socket.userId,
          username: socket.username,
          conversationId: data.conversationId,
        })
      })

      // Handle message read receipts
      socket.on("mark_messages_read", (data: { conversationId: string; messageIds: string[] }) => {
        // Broadcast read receipt to other participants
        socket.to(`conversation:${data.conversationId}`).emit("messages_read", {
          userId: socket.userId,
          username: socket.username,
          conversationId: data.conversationId,
          messageIds: data.messageIds,
          readAt: new Date(),
        })
      })

      // Handle user status updates
      socket.on("update_status", (status: "online" | "away" | "busy") => {
        if (socket.userId) {
          this.broadcastUserStatus(socket.userId, status)
        }
      })

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`User ${socket.username} disconnected`)

        if (socket.userId) {
          const userSockets = this.connectedUsers.get(socket.userId)
          if (userSockets) {
            userSockets.delete(socket.id)
            if (userSockets.size === 0) {
              this.connectedUsers.delete(socket.userId)
              // Broadcast user offline status after a delay
              setTimeout(() => {
                if (!this.connectedUsers.has(socket.userId!)) {
                  this.broadcastUserStatus(socket.userId!, "offline")
                }
              }, 5000) // 5 second delay to handle quick reconnections
            }
          }
        }
      })
    })
  }

  private setupRedisSubscription() {
    // Subscribe to Redis channels for cross-server communication
    redisSub.subscribe("chat_message", "notification", "user_status")

    redisSub.on("message", (channel: string, message: string) => {
      try {
        const data = JSON.parse(message)

        switch (channel) {
          case "chat_message":
            this.handleChatMessage(data)
            break
          case "notification":
            this.handleNotification(data)
            break
          case "user_status":
            this.handleUserStatusUpdate(data)
            break
        }
      } catch (error) {
        console.error("Error processing Redis message:", error)
      }
    })
  }

  private handleChatMessage(data: any) {
    // Emit message to conversation participants
    this.io.to(`conversation:${data.conversationId}`).emit("new_message", data)
  }

  private handleNotification(data: any) {
    // Send notification to specific user
    this.io.to(`user:${data.userId}`).emit("notification", data)
  }

  private handleUserStatusUpdate(data: any) {
    // Broadcast user status to all connected clients
    this.io.emit("user_status_update", data)
  }

  // Public methods for sending messages
  public sendMessageToConversation(conversationId: string, message: any) {
    // Publish to Redis for cross-server support
    redisPub.publish("chat_message", JSON.stringify({ ...message, conversationId }))
  }

  public sendNotificationToUser(userId: string, notification: any) {
    // Publish to Redis for cross-server support
    redisPub.publish("notification", JSON.stringify({ ...notification, userId }))
  }

  private broadcastUserStatus(userId: string, status: string) {
    const statusData = {
      userId,
      status,
      timestamp: new Date(),
    }

    // Publish to Redis for cross-server support
    redisPub.publish("user_status", JSON.stringify(statusData))
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId)
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys())
  }

  public getUserSocketCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0
  }
}

// Export singleton instance
let wsService: WebSocketService

export function initializeWebSocket(server: HTTPServer): WebSocketService {
  if (!wsService) {
    wsService = new WebSocketService(server)
  }
  return wsService
}

export function getWebSocketService(): WebSocketService {
  if (!wsService) {
    throw new Error("WebSocket service not initialized")
  }
  return wsService
}
