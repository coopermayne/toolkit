#!/usr/bin/env node

/**
 * AI Integration Helper
 * Simple wrapper for using Claude AI to analyze data
 */

import Anthropic from '@anthropic-ai/sdk';

class AIHelper {
    constructor(apiKey) {
        this.client = new Anthropic({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY
        });
    }

    /**
     * Send a prompt to Claude and get a response
     *
     * @param {string} prompt - The prompt to send
     * @param {object} options - Optional configuration
     * @param {string} options.model - Model to use (default: claude-sonnet-4-20250514)
     * @param {number} options.maxTokens - Max tokens in response (default: 4000)
     * @returns {Promise<string>} - The AI response text
     */
    async ask(prompt, options = {}) {
        const {
            model = 'claude-sonnet-4-20250514',
            maxTokens = 4000
        } = options;

        try {
            const message = await this.client.messages.create({
                model,
                max_tokens: maxTokens,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            return message.content[0].text;

        } catch (error) {
            console.error('❌ AI Error:', error.message);
            throw error;
        }
    }

    /**
     * Test the API connection
     */
    async test() {
        console.log('\n🔍 Testing Claude API Connection...\n');

        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('ANTHROPIC_API_KEY environment variable not set');
        }

        console.log('✓ API key found in environment');
        console.log('📡 Sending test message...\n');

        const response = await this.ask(
            'Say "Hello! API connection successful!" and nothing else.',
            { maxTokens: 100 }
        );

        console.log('📩 Response:', response);
        console.log('\n✅ SUCCESS! API is working.\n');

        return response;
    }
}

/**
 * Example usage
 */
async function example() {
    const ai = new AIHelper();

    // Test the connection
    await ai.test();

    // Example: analyze some data
    const prompt = `
Analyze the following data and provide insights:

Data: [Your data here]

Please provide:
1. Key patterns
2. Potential issues
3. Recommendations
    `.trim();

    // Uncomment to run:
    // const analysis = await ai.ask(prompt);
    // console.log(analysis);
}

// Run example if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    example().catch(error => {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    });
}

export { AIHelper };
