const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
model.generateContent("hello").then(r => console.log("Success with lite!")).catch(console.error);

const model2 = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
model2.generateContent("hello").then(r => console.log("Success with latest!")).catch(console.error);

