export class IcebreakerService {
    private static ICEBREAKERS: Record<string, string[]> = {
        general: [
            "If you could have any superpower, what would it be?",
            "What's the best piece of advice you've ever received?",
            "What’s one thing you’ve always wanted to learn but haven’t yet?",
            "If you could travel anywhere right now, where would you go?",
            "What's your favorite way to spend a lazy Sunday?",
            "What's the most interesting thing you've read or watched recently?"
        ],
        gaming: [
            "What's the first game you ever fell in love with?",
            "PC, Console, or Mobile? What's your weapon of choice?",
            "What's the most challenging boss fight you've ever cleared?",
            "If you could live in any game world for a week, which one would it be?",
            "What's a game you think is highly underrated?",
            "What are you currently playing?"
        ],
        music: [
            "What’s your 'guilty pleasure' song?",
            "Who is the one artist you'd love to see live?",
            "Do you play any instruments, or do you just enjoy the listener's life?",
            "What's your go-to playlist for when you're feeling down?",
            "If you had to pick one album to listen to for the rest of your life, what would it be?",
            "What's the last concert you attended?"
        ],
        tech: [
            "What’s the most useful gadget you own?",
            "Do you think AI is going to save us or end us?",
            "What's a tech trend you find absolutely ridiculous?",
            "If you could automate one task in your daily life, what would it be?",
            "What's your favorite programming language (if any)?",
            "What's the coolest tech project you've ever worked on or seen?"
        ],
        coding: [
            "Tabs or Spaces? Let's settle this now.",
            "What’s your favorite IDE? (And why is it VS Code?)",
            "What’s the most satisfying bug you’ve ever fixed?",
            "Dark mode or Light mode? (Hint: There is only one right answer)",
            "What's a library or framework you can't live without?",
            "What's the hardest project you've ever built?"
        ]
    };

    static getIcebreaker(topic: string = 'general'): string {
        const normalizedTopic = topic.toLowerCase().trim();
        const questions = this.ICEBREAKERS[normalizedTopic] || this.ICEBREAKERS['general'];
        const randomIndex = Math.floor(Math.random() * questions.length);
        return questions[randomIndex];
    }
}
