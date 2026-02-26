import { errors } from "../lib/utils";
import { generateWithHuggingFace } from "./ai/customAI";

export class ModerationService {
  // Comprehensive list of toxic keywords/patterns
  private static TOXIC_KEYWORDS = [
    "kill", "murder", "suicide", "die", "death", "bomb", "terror", "attack", "shoot", "stab",
    "rape", "assault", "hurt", "harm", "abuse", "blood", "cut",
    "hate", "nazi", "racist", "sexist", "bigot", "slave", "terrorist",
    "fuck", "shit", "bitch", "asshole", "cunt", "dick", "pussy", "cock", "whore", "slut", "bastard",
    "damn", "crap", "piss", "suck",
    "stupid", "idiot", "ugly", "fat", "loser", "dumb", "retard", "creep", "freak",
    "porn", "nude", "naked", "sex", "horny", "xxx"
  ];

  static async checkContent(content: string, userId?: string): Promise<void> {
    if (!content) return;

    // Toggle between Keyword and AI moderation
    const mode = process.env.MODERATION_MODE || 'KEYWORD';

    if (mode === 'AI') {
      try {
        await this.checkAIContent(content);
      } catch (err: any) {
        if (err.status === 403) {
          // If content was explicitly flagged by AI, deduct reputation if userId provided
          if (userId) {
            const { AnonymousChatService } = require('./anonymous-chat');
            await AnonymousChatService.updateReputation(userId, -10);
          }
          throw err;
        }
        // If AI fails technically (timeout/quota), fallback to keyword safety
        await this.checkKeywordContent(content);
      }
    } else {
      await this.checkKeywordContent(content);
    }
  }

  private static async checkKeywordContent(content: string): Promise<void> {
    const lowerContent = content.toLowerCase();

    for (const keyword of this.TOXIC_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(lowerContent)) {
        throw errors.forbidden("Your message contains restricted content. Please keep it respectful.");
      }
    }
  }

  private static async checkAIContent(content: string): Promise<void> {
    const prompt = `
      You are a content moderation AI. Analyze the following text for:
      1. Toxicity (Hate speech, Harassment, Sexual content, Violence).
      2. Identity Leaks (Sharing phone numbers, real names, or emails in anonymous mode).
      
      Text: "${content}"
      
      Respond ONLY in JSON format: {"flagged": boolean, "reason": "string or null"}
    `;

    try {
      const result = await generateWithHuggingFace(prompt);

      // Attempt to parse JSON from the AI response
      const jsonMatch = result.match(/\{.*\}/s);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);

      if (parsed.flagged) {
        throw errors.forbidden(`Moderation Block: ${parsed.reason || "Content violates safety standards."}`);
      }
    } catch (error: any) {
      if (error.status === 403) throw error;
      console.error("AI Moderation Error:", error.message);
      throw error; // Trigger fallback
    }
  }
}
