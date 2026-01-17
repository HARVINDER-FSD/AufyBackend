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
exports.safetyService = void 0;
const customAI_1 = require("./customAI");
exports.safetyService = {
    /**
     * Estimates if the user is likely under 18 based on their writing style and topics
     * Uses Groq AI (Llama 3) for high-accuracy behavioral analysis.
     */
    estimateAgeFromBehavior(content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const text = content.toLowerCase();
                // 1. Initial Quick Check (Local Patterns)
                const childPatterns = ['homework', 'school', 'math class', 'teacher', 'mom said', 'dad said', 'middle school', 'high school', 'exams', 'roblox', 'fortnite', 'minecraft', 'parents', 'bus', 'grade', 'classmate', 'lunch break', 'playground', 'toy', 'kindergarten'];
                const adultPatterns = ['office', 'work', 'colleague', 'salary', 'taxes', 'mortgage', 'bills', 'business', 'meeting', 'wine', 'beer', 'driving to work', 'university', 'career', 'pension', 'mortgage', 'landlord'];
                let childScore = childPatterns.reduce((acc, p) => acc + (text.includes(p) ? 1 : 0), 0);
                let adultScore = adultPatterns.reduce((acc, p) => acc + (text.includes(p) ? 1 : 0), 0);
                // 2. AI Check (Using Groq) - Only if content is substantial
                if (content.length > 20) {
                    const prompt = `
                    Analyze the following social media content. 
                    User claims to be an adult, but we suspect it might be a child (minor) lying about their age.
                    
                    Content: "${content}"
                    
                    Rules:
                    1. Identify if the vocabulary, interests, or topics are typical of a minor (school, kids games, parents rules, elementary topics).
                    2. If highly likely a minor, reply ONLY with 'MINOR'.
                    3. If likely an adult or neutral, reply ONLY with 'ADULT'.
                    
                    RESPONSE MUST BE ONLY ONE WORD: 'MINOR' OR 'ADULT'.
                `;
                    const aiResponse = yield (0, customAI_1.generateWithHuggingFace)(prompt);
                    const verdict = aiResponse.toUpperCase().trim();
                    console.log(`[AI Safety] Behavior analysis verdict: ${verdict}`);
                    if (verdict === 'MINOR')
                        return { estimatedAgeGroup: 'minor', score: 10 + childScore };
                    if (verdict === 'ADULT')
                        return { estimatedAgeGroup: 'adult', score: adultScore };
                }
                // Fallback to local scoring if AI fails or content is short
                if (childScore > adultScore && childScore >= 2)
                    return { estimatedAgeGroup: 'minor', score: childScore };
                if (adultScore > childScore && adultScore >= 2)
                    return { estimatedAgeGroup: 'adult', score: adultScore };
                return { estimatedAgeGroup: 'uncertain', score: 0 };
            }
            catch (error) {
                console.error('Safety AI error:', error);
                return { estimatedAgeGroup: 'uncertain', score: 0 };
            }
        });
    },
    /**
     * Detects if the user is lying about their identity
     */
    detectInconsistency(userDob, behavioralAgeGroup) {
        return __awaiter(this, void 0, void 0, function* () {
            if (behavioralAgeGroup === 'uncertain')
                return false;
            const birthDate = new Date(userDob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            if (new Date(today.getFullYear(), today.getMonth(), today.getDate()) < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()))
                age--;
            const declaredGroup = age < 18 ? 'minor' : 'adult';
            // FLAG: If they say they are adult but behave like a minor
            return declaredGroup === 'adult' && behavioralAgeGroup === 'minor';
        });
    }
};
