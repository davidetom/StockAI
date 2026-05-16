import { GoogleGenerativeAI } from '@google/generative-ai';

// INSERISCI QUI LA TUA CHIAVE API DI GOOGLE
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(API_KEY);

export const parseInventoryIntent = async (userMessage, currentProducts) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
  Sei l'agente AI di un gestionale HORECA. Il cameriere ti dirà cosa ha prelevato o aggiunto al magazzino.
  Ecco l'inventario attuale: ${JSON.stringify(currentProducts)}
  
  Messaggio dell'utente: "${userMessage}"
  
  Il tuo compito è capire quale prodotto è stato modificato e di quanto. 
  Rispondi ESCLUSIVAMENTE con un oggetto JSON valido con questa struttura:
  {
    "productId": "id_del_prodotto",
    "quantityChange": -1, // numero negativo per prelievi, positivo per aggiunte
    "replyText": "Risposta breve e cortese da mostrare al cameriere (es. 'Ho scalato 1 Gin Mare.')"
  }
  Se non trovi il prodotto o l'intento non è chiaro, restituisci productId come null e chiedi chiarimenti in replyText.
  NON INCLUDERE MARKDOWN O TESTO FUORI DAL JSON.
  `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    // Pulisci eventuali backtick markdown se Gemini li inserisce
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Errore AI:', error);
    return { productId: null, quantityChange: 0, replyText: 'Scusa, ho avuto un problema di connessione.' };
  }
};