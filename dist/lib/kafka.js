"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.producer.connect();
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.producer.disconnect();
            for (const consumer of this.consumers.values()) {
                yield consumer.disconnect();
            }
        });
    }
    send(message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.producer.send(message);
            }
            catch (error) {
                console.error("Error sending message to Kafka:", error);
                throw error;
            }
        });
    }
    createConsumer(groupId, topics, handler) {
        return __awaiter(this, void 0, void 0, function* () {
            const consumer = kafka.consumer({ groupId });
            this.consumers.set(groupId, consumer);
            yield consumer.connect();
            yield consumer.subscribe({ topics });
            yield consumer.run({
                eachMessage: (_a) => __awaiter(this, [_a], void 0, function* ({ topic, partition, message }) {
                    var _b, _c;
                    try {
                        const value = (_b = message.value) === null || _b === void 0 ? void 0 : _b.toString();
                        if (value) {
                            yield handler({
                                topic,
                                partition,
                                key: (_c = message.key) === null || _c === void 0 ? void 0 : _c.toString(),
                                value: JSON.parse(value),
                                timestamp: message.timestamp,
                            });
                        }
                    }
                    catch (error) {
                        console.error("Error processing Kafka message:", error);
                    }
                }),
            });
        });
    }
}
exports.kafkaService = new KafkaService();
// Initialize Kafka connection
exports.kafkaService.connect().catch(console.error);
// Graceful shutdown
process.on("SIGINT", () => __awaiter(void 0, void 0, void 0, function* () {
    yield exports.kafkaService.disconnect();
    process.exit(0);
}));
