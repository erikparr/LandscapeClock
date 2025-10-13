import 'dotenv/config';

console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('Key length:', process.env.OPENAI_API_KEY?.length);
console.log('Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 7));

// Test with OpenAI directly
import { ChatOpenAI } from '@langchain/openai';

const llm = new ChatOpenAI({
    temperature: 0.7,
    modelName: 'gpt-3.5-turbo',
    openAIApiKey: process.env.OPENAI_API_KEY
});

try {
    console.log('\nTesting OpenAI connection...');
    const result = await llm.invoke('Say hello in one word');
    console.log('✅ OpenAI API works!');
    console.log('Response:', result.content);
} catch (error) {
    console.error('❌ OpenAI API error:');
    console.error('Status:', error.status);
    console.error('Message:', error.message);
    console.error('\nFull error:', error);
}
