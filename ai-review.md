# Code Review: ai.js

**Date:** 2025-11-21
**File:** `/workspaces/toolkit/ai.js`

## Overall Assessment

The code is clean, functional, and demonstrates good fundamental practices. It's a straightforward wrapper around the Anthropic SDK with clear documentation. However, it lacks several production-ready features and could benefit from enhanced modularity, error handling, and configurability.

**Strengths:**
- Clear, focused purpose with good JSDoc documentation
- Proper use of ES6+ modules and modern JavaScript syntax
- Simple, understandable API design
- Appropriate error handling basics

**Key Areas for Improvement:**
- Limited error handling and retry logic
- No rate limiting or cost management
- Lack of streaming support for longer responses
- Missing TypeScript definitions
- No logging/observability framework
- Single-turn conversation only (no message history)

---

## Critical Issues

### 1. Hardcoded Model Version
```javascript
model = 'claude-sonnet-4-20250514'
```

**Issue:** The default model is hardcoded to an older version. According to current information, `claude-sonnet-4-5-20250929` is the latest model.

**Why it matters:** Users won't automatically benefit from newer, better models without code changes.

**Solution:**
```javascript
// Use a constant that can be easily updated
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

async ask(prompt, options = {}) {
    const {
        model = DEFAULT_MODEL,
        maxTokens = 4000
    } = options;
    // ...
}
```

### 2. Incomplete Error Context
```javascript
catch (error) {
    console.error('❌ AI Error:', error.message);
    throw error;
}
```

**Issue:** Only logs the error message, losing valuable context (status codes, rate limit info, API response details).

**Why it matters:** Makes debugging API issues extremely difficult in production. Anthropic errors contain useful metadata about quota limits, invalid requests, etc.

**Solution:** Enhance error handling with structured logging and context preservation:
```javascript
catch (error) {
    const errorContext = {
        message: error.message,
        status: error.status,
        type: error.type,
        headers: error.headers,
        requestParams: { model, maxTokens }
    };

    console.error('❌ AI Error:', JSON.stringify(errorContext, null, 2));

    // Throw enhanced error with context
    const enhancedError = new Error(`AI request failed: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.context = errorContext;
    throw enhancedError;
}
```

### 3. Missing Package.json Dependency

**Issue:** The code imports `@anthropic-ai/sdk` but this dependency is not in `/workspaces/toolkit/package.json`.

**Why it matters:** The code will fail at runtime with a module not found error.

**Solution:** Add to package.json:
```json
"dependencies": {
    "@anthropic-ai/sdk": "^0.30.0"
}
```

---

## Important Improvements

### 1. No Rate Limiting or Cost Management

**Issue:** Uncontrolled API usage can lead to unexpected costs and rate limit errors.

**Recommendation:** Implement a request queue with rate limiting:
```javascript
import pLimit from 'p-limit';

class AIHelper {
    constructor(apiKey, options = {}) {
        this.client = new Anthropic({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY
        });

        // Rate limiting: max N concurrent requests
        this.limit = pLimit(options.concurrency || 5);

        // Cost tracking
        this.requestCount = 0;
        this.totalTokens = 0;
    }

    async ask(prompt, options = {}) {
        return this.limit(async () => {
            const message = await this.client.messages.create({...});

            // Track usage
            this.requestCount++;
            this.totalTokens += message.usage.input_tokens + message.usage.output_tokens;

            return message.content[0].text;
        });
    }

    getUsageStats() {
        return {
            requests: this.requestCount,
            totalTokens: this.totalTokens,
            estimatedCost: this.calculateCost()
        };
    }
}
```

### 2. Single-Turn Conversation Limitation

**Issue:** The `ask` method only supports single prompts. No support for multi-turn conversations or system prompts.

**Recommendation:** Add conversation management:
```javascript
class AIHelper {
    constructor(apiKey, options = {}) {
        // ... existing code
        this.systemPrompt = options.systemPrompt || null;
        this.conversationHistory = [];
    }

    async ask(prompt, options = {}) {
        const {
            model = DEFAULT_MODEL,
            maxTokens = 4000,
            system = this.systemPrompt,
            includeHistory = false
        } = options;

        const messages = includeHistory
            ? [...this.conversationHistory, { role: 'user', content: prompt }]
            : [{ role: 'user', content: prompt }];

        const params = {
            model,
            max_tokens: maxTokens,
            messages
        };

        if (system) {
            params.system = system;
        }

        const message = await this.client.messages.create(params);
        const responseText = message.content[0].text;

        // Save to history if needed
        if (includeHistory) {
            this.conversationHistory.push(
                { role: 'user', content: prompt },
                { role: 'assistant', content: responseText }
            );
        }

        return responseText;
    }

    clearHistory() {
        this.conversationHistory = [];
    }
}
```

### 3. No Streaming Support

**Issue:** Large responses force users to wait for the entire response before seeing any output.

**Recommendation:** Add streaming capability:
```javascript
async askStream(prompt, options = {}, onChunk) {
    const {
        model = DEFAULT_MODEL,
        maxTokens = 4000
    } = options;

    const stream = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
        stream: true
    });

    let fullText = '';

    for await (const event of stream) {
        if (event.type === 'content_block_delta' &&
            event.delta?.type === 'text_delta') {
            const chunk = event.delta.text;
            fullText += chunk;
            if (onChunk) onChunk(chunk);
        }
    }

    return fullText;
}
```

### 4. Lack of Retry Logic

**Issue:** Transient network errors or rate limits will cause immediate failures.

**Recommendation:** Implement exponential backoff retry:
```javascript
async askWithRetry(prompt, options = {}, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await this.ask(prompt, options);
        } catch (error) {
            lastError = error;

            // Don't retry on client errors (4xx except 429)
            if (error.status >= 400 && error.status < 500 && error.status !== 429) {
                throw error;
            }

            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}
```

### 5. Missing TypeScript Support

**Issue:** No type definitions, making it harder to use in TypeScript projects.

**Recommendation:** Add JSDoc types or create a `.d.ts` file:
```javascript
/**
 * @typedef {Object} AskOptions
 * @property {string} [model] - Model to use
 * @property {number} [maxTokens] - Max tokens in response
 * @property {string} [system] - System prompt
 * @property {boolean} [includeHistory] - Include conversation history
 */

/**
 * @param {string} prompt - The prompt to send
 * @param {AskOptions} [options] - Optional configuration
 * @returns {Promise<string>} - The AI response text
 */
async ask(prompt, options = {}) {
    // ...
}
```

---

## Additional Recommendations

### 1. Add Configuration Validation

**Current issue:** No validation of configuration parameters.

**Recommendation:**
```javascript
constructor(apiKey, options = {}) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;

    if (!key) {
        throw new Error(
            'API key required. Provide via constructor or ANTHROPIC_API_KEY env var.'
        );
    }

    if (key.length < 20 || !key.startsWith('sk-ant-')) {
        throw new Error('Invalid API key format');
    }

    this.client = new Anthropic({ apiKey: key });

    // Validate options
    if (options.maxTokens && (options.maxTokens < 1 || options.maxTokens > 200000)) {
        throw new Error('maxTokens must be between 1 and 200000');
    }
}
```

### 2. Implement Structured Logging

**Current issue:** Console.log statements mixed with emojis aren't production-friendly.

**Recommendation:** Add a proper logging abstraction:
```javascript
class AIHelper {
    constructor(apiKey, options = {}) {
        // ... existing code
        this.logger = options.logger || console;
        this.debug = options.debug || false;
    }

    log(level, message, meta = {}) {
        if (!this.debug && level === 'debug') return;

        const timestamp = new Date().toISOString();
        this.logger[level]({
            timestamp,
            level,
            message,
            ...meta
        });
    }

    async ask(prompt, options = {}) {
        this.log('debug', 'Sending request to Claude', {
            model: options.model,
            promptLength: prompt.length
        });

        try {
            const message = await this.client.messages.create({...});

            this.log('info', 'Request successful', {
                inputTokens: message.usage.input_tokens,
                outputTokens: message.usage.output_tokens
            });

            return message.content[0].text;
        } catch (error) {
            this.log('error', 'Request failed', { error });
            throw error;
        }
    }
}
```

### 3. Add Response Caching for Repeated Queries

**Opportunity:** Save costs by caching identical requests.

**Recommendation:**
```javascript
import crypto from 'crypto';

class AIHelper {
    constructor(apiKey, options = {}) {
        // ... existing code
        this.cache = new Map();
        this.enableCache = options.enableCache || false;
        this.cacheTTL = options.cacheTTL || 3600000; // 1 hour default
    }

    getCacheKey(prompt, options) {
        return crypto
            .createHash('sha256')
            .update(JSON.stringify({ prompt, ...options }))
            .digest('hex');
    }

    async ask(prompt, options = {}) {
        if (this.enableCache) {
            const key = this.getCacheKey(prompt, options);
            const cached = this.cache.get(key);

            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                this.log('debug', 'Cache hit');
                return cached.response;
            }
        }

        const response = await this.client.messages.create({...});
        const text = response.content[0].text;

        if (this.enableCache) {
            const key = this.getCacheKey(prompt, options);
            this.cache.set(key, { response: text, timestamp: Date.now() });
        }

        return text;
    }
}
```

### 4. Add Support for Multiple Response Formats

**Opportunity:** Allow users to get structured responses (JSON, markdown, etc.).

**Recommendation:**
```javascript
async ask(prompt, options = {}) {
    const {
        model = DEFAULT_MODEL,
        maxTokens = 4000,
        responseFormat = 'text' // 'text' | 'json' | 'raw'
    } = options;

    const message = await this.client.messages.create({...});

    switch (responseFormat) {
        case 'json':
            try {
                return JSON.parse(message.content[0].text);
            } catch (e) {
                throw new Error('Response is not valid JSON');
            }
        case 'raw':
            return message; // Return full API response
        case 'text':
        default:
            return message.content[0].text;
    }
}
```

---

## Enhanced Functionality Suggestions

### 1. Batch Processing Utility

Add a method to process multiple prompts efficiently:
```javascript
async batchAsk(prompts, options = {}) {
    const results = await Promise.allSettled(
        prompts.map(prompt => this.ask(prompt, options))
    );

    return results.map((result, index) => ({
        prompt: prompts[index],
        success: result.status === 'fulfilled',
        response: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
    }));
}
```

### 2. Template System

Add support for prompt templates:
```javascript
class AIHelper {
    constructor(apiKey, options = {}) {
        // ... existing code
        this.templates = new Map();
    }

    registerTemplate(name, template) {
        this.templates.set(name, template);
    }

    async askFromTemplate(templateName, variables, options = {}) {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template '${templateName}' not found`);
        }

        const prompt = this.interpolateTemplate(template, variables);
        return this.ask(prompt, options);
    }

    interpolateTemplate(template, variables) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return variables[key] ?? match;
        });
    }
}

// Usage example:
ai.registerTemplate('analyze', `
Analyze the following {{dataType}}:

{{data}}

Please provide:
1. {{aspect1}}
2. {{aspect2}}
`);

await ai.askFromTemplate('analyze', {
    dataType: 'sales data',
    data: salesData,
    aspect1: 'Key trends',
    aspect2: 'Recommendations'
});
```

### 3. Add Progress Callbacks for Long Operations

```javascript
async ask(prompt, options = {}) {
    const { onProgress } = options;

    if (onProgress) onProgress('starting');

    try {
        if (onProgress) onProgress('sending');
        const message = await this.client.messages.create({...});

        if (onProgress) onProgress('processing');
        const text = message.content[0].text;

        if (onProgress) onProgress('complete');
        return text;
    } catch (error) {
        if (onProgress) onProgress('error');
        throw error;
    }
}
```

### 4. Better Example Usage

Create a more comprehensive example:
```javascript
/**
 * Example usage scenarios
 */
async function examples() {
    const ai = new AIHelper(null, {
        debug: true,
        enableCache: true,
        concurrency: 3
    });

    // Example 1: Simple question
    const response1 = await ai.ask('What is 2+2?');

    // Example 2: Structured analysis
    const analysis = await ai.ask(`
        Analyze this data and respond in JSON format:
        { "summary": "...", "recommendations": [...] }

        Data: ${JSON.stringify(yourData)}
    `, { responseFormat: 'json' });

    // Example 3: Multi-turn conversation
    await ai.ask('My name is John', { includeHistory: true });
    const greeting = await ai.ask('What is my name?', { includeHistory: true });

    // Example 4: Streaming response
    await ai.askStream('Write a long story', {}, (chunk) => {
        process.stdout.write(chunk);
    });

    // Check usage
    console.log(ai.getUsageStats());
}
```

### 5. Add Input Sanitization and Validation

**Security consideration:** Validate and sanitize inputs.

```javascript
async ask(prompt, options = {}) {
    // Validate prompt
    if (typeof prompt !== 'string') {
        throw new TypeError('Prompt must be a string');
    }

    if (prompt.trim().length === 0) {
        throw new Error('Prompt cannot be empty');
    }

    if (prompt.length > 100000) {
        throw new Error('Prompt too long (max 100k characters)');
    }

    // ... rest of implementation
}
```

---

## Implementation Priority

### High Priority (Do First)
1. Update default model to latest version (`claude-sonnet-4-5-20250929`)
2. Add `@anthropic-ai/sdk` to package.json
3. Enhance error handling with full context
4. Add retry logic with exponential backoff
5. Implement conversation history support

### Medium Priority (Improve Robustness)
6. Add rate limiting and cost tracking
7. Implement structured logging
8. Add input validation and sanitization
9. Support streaming responses
10. Add TypeScript definitions

### Low Priority (Nice to Have)
11. Implement response caching
12. Add batch processing
13. Create template system
14. Add comprehensive examples
15. Create usage documentation

---

## Conclusion

The code is a solid foundation but needs production hardening, better error handling, and enhanced features to be truly reusable across different projects in your toolkit. Focus on the high-priority items first to make it more robust, then add the enhanced functionality as needed.
