/**
 * LangChain-based prompt generator for continuous landscape generation
 */

import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';

/**
 * Generate 24 chained prompts for a full day landscape sequence (6 AM - 5 AM next day)
 * @param {string} initialDescription - Starting landscape description
 * @param {Date|string} targetDate - Date to generate prompts for (for seasonal context)
 * @returns {Promise<string[]>} Array of 24 prompts
 */
export async function generateDailyPrompts(
    initialDescription = "a natural landscape with mountains, turquoise lake and pine forests at dawn",
    targetDate = new Date()
) {
    // Initialize OpenAI model
    const llm = new ChatOpenAI({
        temperature: 0.7,
        modelName: 'gpt-3.5-turbo',
        openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Create prompt template for generating landscape descriptions
    const promptTemplate = PromptTemplate.fromTemplate(
        `Generate a single sentence describing a distant natural landscape at {current_time}, {current_date} that could seamlessly extend the following landscape: {previous_description}.

The new description should:
- Be different but complementary to the previous landscape
- Reflect the time of day and lighting conditions
- Reflect the season and date (spring, summer, autumn, winter characteristics)
- Start with "Seamlessly extend" to ensure continuity
- Match the existing style and composition
- additional inspirational Light and environmental descriptors: luminous, diffused, hazy, radiant, overcast, mist-laden, sun-drenched, twilight, glimmering, veiled, iridescent, vaporous, dawn-lit, dusky, vivid, refracted, translucent, atmospheric haze, etc
Description:`

    );

    // Create chain
    const chain = new LLMChain({
        llm: llm,
        prompt: promptTemplate
    });

    const prompts = [];
    let previousDescription = initialDescription;

    // Generate 24 prompts for each hour (6 AM through 5 AM next day)
    const hours = [
        '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM',
        '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM',
        '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM',
        '12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM'
    ];

    // Convert targetDate to Date object if string
    const dateObj = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;

    // Get target date in readable format
    const currentDate = dateObj.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    console.log(`\nGenerating 24 chained prompts with LangChain...`);
    console.log(`Initial description: "${initialDescription}"`);
    console.log(`Date: ${currentDate}\n`);

    for (let i = 0; i < hours.length; i++) {
        const currentTime = hours[i];
        console.log(`[${i + 1}/24] Generating prompt for ${currentTime}...`);

        try {
            // Generate new description
            const result = await chain.call({
                previous_description: previousDescription,
                current_time: currentTime,
                current_date: currentDate
            });

            // Extract first sentence
            let description = result.text.trim();
            const firstSentenceMatch = description.match(/^[^.!?]+[.!?]/);
            if (firstSentenceMatch) {
                description = firstSentenceMatch[0].trim();
            }

            prompts.push(description);
            console.log(`  → "${description}"\n`);

            // Update for next iteration
            previousDescription = description;

            // Add delay to avoid rate limiting (300ms between calls)
            if (i < hours.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }

        } catch (error) {
            console.error(`Error generating prompt for ${currentTime}:`, error.message);
            // Fallback to simple prompt if generation fails
            const fallback = `Seamlessly extend mountain landscape at ${currentTime}, matching existing style and lighting`;
            prompts.push(fallback);
            console.log(`  → (fallback) "${fallback}"\n`);
        }
    }

    console.log(`✅ Generated ${prompts.length} prompts\n`);
    return prompts;
}

/**
 * Save prompts to a text file
 */
export async function savePromptsToFile(prompts, filePath) {
    const fs = await import('fs/promises');
    const content = prompts.map((prompt, i) => `${i + 1}. ${prompt}`).join('\n\n');
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`Saved prompts to: ${filePath}`);
}
