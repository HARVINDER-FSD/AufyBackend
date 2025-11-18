import { Client } from "@elastic/elasticsearch"

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || "elastic",
    password: process.env.ELASTICSEARCH_PASSWORD || "password",
  },
})

export interface SearchDocument {
  id: string
  type: "user" | "post" | "hashtag"
  content: string
  metadata: Record<string, any>
  created_at: Date
  updated_at: Date
}

export class ElasticsearchService {
  private static instance: ElasticsearchService

  static getInstance(): ElasticsearchService {
    if (!ElasticsearchService.instance) {
      ElasticsearchService.instance = new ElasticsearchService()
    }
    return ElasticsearchService.instance
  }

  async indexDocument(index: string, document: SearchDocument): Promise<void> {
    try {
      await client.index({
        index,
        id: document.id,
        body: document,
      })
    } catch (error) {
      console.error("Error indexing document:", error)
      throw error
    }
  }

  async search(index: string, query: string, filters?: Record<string, any>, limit = 20, offset = 0) {
    try {
      const searchQuery: any = {
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
      }

      if (filters) {
        searchQuery.bool.filter = Object.entries(filters).map(([key, value]) => ({
          term: { [`metadata.${key}`]: value },
        }))
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
      })

      return {
        hits: response.body.hits.hits.map((hit: any) => ({
          ...hit._source,
          score: hit._score,
          highlight: hit.highlight,
        })),
        total: response.body.hits.total.value,
      }
    } catch (error) {
      console.error("Error searching:", error)
      throw error
    }
  }

  async deleteDocument(index: string, id: string): Promise<void> {
    try {
      await client.delete({
        index,
        id,
      })
    } catch (error) {
      console.error("Error deleting document:", error)
      throw error
    }
  }

  async createIndex(index: string, mapping: Record<string, any>): Promise<void> {
    try {
      const exists = await client.indices.exists({ index })
      if (!exists.body) {
        await client.indices.create({
          index,
          body: {
            mappings: {
              properties: mapping,
            },
          },
        })
      }
    } catch (error) {
      console.error("Error creating index:", error)
      throw error
    }
  }
}

export const elasticsearch = ElasticsearchService.getInstance()
