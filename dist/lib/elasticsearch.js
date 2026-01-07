"use strict";
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
    async indexDocument(index, document) {
        try {
            await client.index({
                index,
                id: document.id,
                body: document,
            });
        }
        catch (error) {
            console.error("Error indexing document:", error);
            throw error;
        }
    }
    async search(index, query, filters, limit = 20, offset = 0) {
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
            const response = await client.search({
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
                hits: response.body.hits.hits.map((hit) => ({
                    ...hit._source,
                    score: hit._score,
                    highlight: hit.highlight,
                })),
                total: response.body.hits.total.value,
            };
        }
        catch (error) {
            console.error("Error searching:", error);
            throw error;
        }
    }
    async deleteDocument(index, id) {
        try {
            await client.delete({
                index,
                id,
            });
        }
        catch (error) {
            console.error("Error deleting document:", error);
            throw error;
        }
    }
    async createIndex(index, mapping) {
        try {
            const exists = await client.indices.exists({ index });
            if (!exists.body) {
                await client.indices.create({
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
    }
}
exports.ElasticsearchService = ElasticsearchService;
exports.elasticsearch = ElasticsearchService.getInstance();
