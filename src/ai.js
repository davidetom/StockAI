import { GoogleGenerativeAI } from '@google/generative-ai';
import { getCustomApiKey } from './db';

const getGenAIInstance = async () => {
  const customKey = await getCustomApiKey();
  const activeKey = customKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  return new GoogleGenerativeAI(activeKey);
};

// 1. GESTIONE MULTIPLA DEGLI INTENTI
export const parseInventoryIntent = async (userMessage, currentProducts) => {
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
    Sei l'agente AI di un gestionale HORECA. L'utente ti dirà cosa ha prelevato o aggiunto al magazzino.
    Può menzionare PIÙ prodotti contemporaneamente.
    Ecco l'inventario attuale: ${JSON.stringify(currentProducts.map(p => ({id: p.id, name: p.name})))}
    
    Messaggio dell'utente: "${userMessage}"
    
    Capisci quali e quanti prodotti sono stati modificati. 
    Rispondi ESCLUSIVAMENTE con un oggetto JSON valido con questa struttura:
    {
      "operations": [
        {
          "productId": "id_del_prodotto",
          "productName": "Nome esatto del prodotto trovato",
          "quantityChange": -1 // negativo per prelievi, positivo per aggiunte
        }
      ],
      "replyText": "Risposta cortese (es. 'Ricevuto. Procedo con l'aggiornamento.')"
    }
    Se un prodotto non è in inventario, ignoralo nelle operations ma menzionalo in replyText. Se l'intento non è chiaro, operations deve essere [].
    NON INCLUDERE TESTO FUORI DAL JSON.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Errore AI Intent:', error);
    return { operations: [], replyText: 'Scusa, ho avuto un problema di connessione.' };
  }
};

// 2. GENERAZIONE DINAMICA DELLE CATEGORIE
export const categorizeInventory = async (currentProducts) => {
  if (!currentProducts || currentProducts.length === 0) return {};
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
    Sei un esperto di logistica HORECA. Analizza i seguenti prodotti: 
    ${JSON.stringify(currentProducts.map(p => ({id: p.id, name: p.name})))}
    
    Raggruppali in un massimo di 5-6 macro-categorie logiche (es. "Alcolici", "Soft Drinks", "Ortofrutta", "Dispensa", ecc.).
    Rispondi ESCLUSIVAMENTE con un JSON che mappa l'ID di ogni prodotto alla sua categoria, così:
    {
      "id_prodotto_1": "Nome Categoria",
      "id_prodotto_2": "Nome Categoria"
    }
    NON INCLUDERE TESTO FUORI DAL JSON.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Errore AI Categorie:', error);
    return null;
  }
};

// 3. TRASCRIZIONE AUDIO
export const transcribeAudio = async (base64Audio, mimeType) => {
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `Trascrivi esattamente l'audio in italiano, senza aggiungere altro.`;

    const result = await model.generateContent([ prompt, { inlineData: { data: base64Audio, mimeType: mimeType } } ]);
    return result.response.text().trim();
  } catch (error) { return null; }
};