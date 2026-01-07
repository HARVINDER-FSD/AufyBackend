"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kafka = exports.kafkaService = void 0;
const kafkajs_1 = require("kafkajs");
const kafka = new kafkajs_1.Kafka({
    clientId: "social-media-app",
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    retry: {
        initialRetryTime: 100,
        retries: 8,
    },
});
exports.kafka = kafka;
class KafkaService {
    constructor() {
        this.consumers = new Map();
        this.producer = kafka.producer({
            maxInFlightRequests: 1,
            idempotent: true,
            transactionTimeout: 30000,
        });
    }
    async connect() {
        await this.producer.connect();
    }
    async disconnect() {
        await this.producer.disconnect();
        for (const consumer of this.consumers.values()) {
            await consumer.disconnect();
        }
    }
    async send(message) {
        try {
            await this.producer.send(message);
        }
        catch (error) {
            console.error("Error sending message to Kafka:", error);
            throw error;
        }
    }
    async createConsumer(groupId, topics, handler) {
        const consumer = kafka.consumer({ groupId });
        this.consumers.set(groupId, consumer);
        await consumer.connect();
        await consumer.subscribe({ topics });
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const value = message.value?.toString();
                    if (value) {
                        await handler({
                            topic,
                            partition,
                            key: message.key?.toString(),
                            value: JSON.parse(value),
                            timestamp: message.timestamp,
                        });
                    }
                }
                catch (error) {
                    console.error("Error processing Kafka message:", error);
                }
            },
        });
    }
}
exports.kafkaService = new KafkaService();
// Initialize Kafka connection
exports.kafkaService.connect().catch(console.error);
// Graceful shutdown
process.on("SIGINT", async () => {
    await exports.kafkaService.disconnect();
    process.exit(0);
});
