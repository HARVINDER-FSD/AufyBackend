import { Kafka, type Producer, type Consumer } from "kafkajs"

const kafka = new Kafka({
  clientId: "social-media-app",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
})

class KafkaService {
  private producer: Producer
  private consumers: Map<string, Consumer> = new Map()

  constructor() {
    this.producer = kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    })
  }

  async connect(): Promise<void> {
    await this.producer.connect()
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect()
    for (const consumer of this.consumers.values()) {
      await consumer.disconnect()
    }
  }

  async send(message: { topic: string; messages: Array<{ key?: string; value: string }> }): Promise<void> {
    try {
      await this.producer.send(message)
    } catch (error) {
      console.error("Error sending message to Kafka:", error)
      throw error
    }
  }

  async createConsumer(groupId: string, topics: string[], handler: (message: any) => Promise<void>): Promise<void> {
    const consumer = kafka.consumer({ groupId })
    this.consumers.set(groupId, consumer)

    await consumer.connect()
    await consumer.subscribe({ topics })

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value?.toString()
          if (value) {
            await handler({
              topic,
              partition,
              key: message.key?.toString(),
              value: JSON.parse(value),
              timestamp: message.timestamp,
            })
          }
        } catch (error) {
          console.error("Error processing Kafka message:", error)
        }
      },
    })
  }
}

export const kafkaService = new KafkaService()

// Initialize Kafka connection
kafkaService.connect().catch(console.error)

// Graceful shutdown
process.on("SIGINT", async () => {
  await kafkaService.disconnect()
  process.exit(0)
})

export { kafka }
