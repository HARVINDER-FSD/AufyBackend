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
exports.elasticsearch = exports.ElasticsearchService = void 0;
const elasticsearch_1 = require("@elastic/elasticsearch");
const client = new elasticsearch_1.Client({
    node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
    auth: {
        username: process.env.ELASTICSEARCH_USERNAME || "elastic",
        password: process.env.ELASTICSEARCH_PASSWORD || "password",
    },
});
class ElasticsearchService {
    static getInstance() {
        if (!ElasticsearchService.instance) {
            ElasticsearchService.instance = new ElasticsearchService();
        }
        return ElasticsearchService.instance;
    }
    indexDocument(index, document) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield client.index({
                    index,
                    id: document.id,
                    body: document,
                });
            }
            catch (error) {
                console.error("Error indexing document:", error);
                throw error;
            }
        });
    }
    search(index_1, query_1, filters_1) {
        return __awaiter(this, arguments, void 0, function* (index, query, filters, limit = 20, offset = 0) {
            try {
                const searchQuery = {
                    bool: {
                        must: [
                            {
                                multi_match: {
                                    query,
                                    fields: ["content^2", "metadata.username", "metadata.hashtags"],
                                    fuzziness: "AUTO",
                                },
                            },
                        ],
                    },
                };
                if (filters) {
                    searchQuery.bool.filter = Object.entries(filters).map(([key, value]) => ({
                        term: { [`metadata.${key}`]: value },
                    }));
                }
                const response = yield client.search({
                    index,
                    body: {
                        query: searchQuery,
                        sort: [{ _score: { order: "desc" } }, { created_at: { order: "desc" } }],
                        from: offset,
                        size: limit,
                        highlight: {
                            fields: {
                                content: {},
                            },
                        },
                    },
                });
                return {
                    hits: response.body.hits.hits.map((hit) => (Object.assign(Object.assign({}, hit._source), { score: hit._score, highlight: hit.highlight }))),
                    total: response.body.hits.total.value,
                };
            }
            catch (error) {
                console.error("Error searching:", error);
                throw error;
            }
        });
    }
    deleteDocument(index, id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield client.delete({
                    index,
                    id,
                });
            }
            catch (error) {
                console.error("Error deleting document:", error);
                throw error;
            }
        });
    }
    createIndex(index, mapping) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const exists = yield client.indices.exists({ index });
                if (!exists) {
                    yield client.indices.create({
                        index,
                        body: {
                            mappings: {
                                properties: mapping,
                            },
                        },
                    });
                }
            }
            catch (error) {
                console.error("Error creating index:", error);
                throw error;
            }
        });
    }
}
exports.ElasticsearchService = ElasticsearchService;
exports.elasticsearch = ElasticsearchService.getInstance();
