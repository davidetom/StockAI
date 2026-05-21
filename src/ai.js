import { GoogleGenerativeAI } from '@google/generative-ai';
import { getCustomApiKey } from './db';

// Funzione helper per ottenere l'istanza corretta di Gemini
const getGenAIInstance = async () => {
  const customKey = await getCustomApiKey();
  // Se c'è una chiave personalizzata usa quella, altrimenti usa quella di sistema nel .env
  const activeKey = customKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  return new GoogleGenerativeAI(activeKey);
};

export const parseInventoryIntent = async (userMessage, currentProducts) => {
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
    Sei l'agente AI di un gestionale HORECA. Il cameriere ti dirà cosa ha prelevato o aggiunto al magazzino.
    Ecco l'inventario attuale: ${JSON.stringify(currentProducts)}
    
    Messaggio dell'utente: "${userMessage}"
    
    Il tuo compito è capire quale prodotto è stato modificato e di quanto. 
    Rispondi ESCLUSIVAMENTE con un oggetto JSON valido con questa struttura:
    {
      "productId": "id_del_prodotto",
      "productName": "Nome esatto del prodotto trovato",
      "quantityChange": -1, // numero negativo per prelievi (es. rotture, consumazioni), positivo per aggiunte
      "replyText": "Risposta cortese (es. 'Ricevuto. Sto aggiornando l'inventario.')"
    }
    Se non trovi il prodotto o l'intento non è chiaro, restituisci productId come null e chiedi chiarimenti in replyText.
    NON INCLUDERE MARKDOWN O TESTO FUORI DAL JSON.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Errore AI:', error);
    return { productId: null, productName: null, quantityChange: 0, replyText: 'Scusa, ho avuto un problema di connessione.' };
  }
};

export const transcribeAudio = async (base64Audio, mimeType) => {
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `
    Sei un assistente alla trascrizione per un'app di magazzino HORECA.
    Ascolta questo audio e trascrivi ESATTAMENTE quello che dice l'utente in italiano.
    Non aggiungere punteggiatura inventata, non rispondere alla domanda, limitati SOLO a scrivere il testo di ciò che è stato detto.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Audio,
          mimeType: mimeType
        }
      }
    ]);
    return result.response.text().trim();
  } catch (error) {
    console.error('Errore Trascrizione Audio:', error);
    return null;
  }
};