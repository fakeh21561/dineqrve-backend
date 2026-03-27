require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

console.log('🧪 Testing Gemini API...');
console.log('API Key exists:', !!process.env.GEMINI_API_KEY);

if (!process.env.GEMINI_API_KEY) {
    console.error('❌ No API key found in .env');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Updated model names for Gemini 3 series
const modelsToTry = [
    "gemini-3-pro-preview",      // Latest Pro model
    "gemini-3-flash-preview",    // Fast, efficient model
    "gemini-2.5-pro-preview",    // Previous gen
    "gemini-2.0-flash",          // Older but stable
];

async function test() {
    for (const modelName of modelsToTry) {
        try {
            console.log(`\n🔄 Trying model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Say hello in Malay in one short sentence");
            const response = await result.response;
            console.log(`✅ SUCCESS with ${modelName}:`, response.text());
            return modelName; // Return working model
        } catch (error) {
            console.log(`❌ Failed with ${modelName}:`, error.message);
        }
    }
    
    console.log('\n❌ All models failed. Your API key might be invalid or not activated for Gemini 3.');
    console.log('Check: https://makersuite.google.com/app/apikey');
}

// Run and save the working model
test().then(workingModel => {
    if (workingModel) {
        console.log(`\n✅ Use this model in your code: "${workingModel}"`);
    }
});