const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

async function run() {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await response.json();
  data.models.forEach(m => console.log(m.name, m.supportedGenerationMethods));
}
run();
