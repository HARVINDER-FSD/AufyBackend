import { errors } from "../lib/utils";

export class ModerationService {
  // Comprehensive list of toxic keywords/patterns
  // In a real production app, this should be replaced/augmented by an AI service (OpenAI, Perspective API, etc.)
  private static TOXIC_KEYWORDS = [
    // Violence / Harm
    "kill", "murder", "suicide", "die", "death", "bomb", "terror", "attack", "shoot", "stab",
    "rape", "assault", "hurt", "harm", "abuse", "blood", "cut",
    
    // Hate Speech / Slurs (Generic placeholders - keeping it safe but effective)
    "hate", "nazi", "racist", "sexist", "bigot", "slave", "terrorist",
    
    // Profanity / Vulgarity (Common English filters)
    "fuck", "shit", "bitch", "asshole", "cunt", "dick", "pussy", "cock", "whore", "slut", "bastard",
    "damn", "crap", "piss", "suck",
    
    // Harassment / Bullying
    "stupid", "idiot", "ugly", "fat", "loser", "dumb", "retard", "creep", "freak",
    
    // Sexual / Explicit
    "porn", "nude", "naked", "sex", "horny", "xxx"
  ];

  static async checkContent(content: string): Promise<void> {
    if (!content) return;

    const lowerContent = content.toLowerCase();
    
    // Check for toxic keywords
    // Using simple inclusion check. For better accuracy, use regex or word boundary checks.
    for (const keyword of this.TOXIC_KEYWORDS) {
      // Simple word boundary check to avoid false positives (e.g., "class" containing "ass")
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(lowerContent)) {
        throw errors.forbidden("Your message contains restricted content. Please keep the conversation respectful.");
      }
    }

    // Future: Integrate external AI moderation API here
    // const score = await ExternalAIService.analyze(content);
    // if (score.toxicity > 0.8) throw ...
  }
}
