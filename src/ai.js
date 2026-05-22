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

// 2. GENERAZIONE CATEGORIA E ICONA INCREMENTALE (Per singolo prodotto)
export const categorizeSingleProduct = async (productName, existingCategories = [], availableIcons = []) => {
  if (!productName) return null;
  
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
    Sei un esperto di logistica HORECA. Devi classificare un singolo nuovo prodotto da aggiungere al magazzino.
    
    Prodotto da classificare: "${productName}"
    
    Hai a disposizione queste categorie GIA' ESISTENTI nel magazzino: ${JSON.stringify(existingCategories)}
    Hai a disposizione queste icone (per l'interfaccia grafica): ${JSON.stringify(availableIcons)}

    Il tuo compito:
    1. CATEGORIA: Seleziona la categoria più adatta tra quelle ESISTENTI. Se (e SOLO SE) nessuna di quelle esistenti è appropriata, crea un nome per una NUOVA macro-categoria (breve, max 2 parole, es. "Alcolici", "Ortofrutta", "Dispensa").
    2. ICONA: Scegli il nome dell'icona più appropriata ESCLUSIVAMENTE dalla lista fornita. Se nessuna icona è pertinente, restituisci null.

    Rispondi ESCLUSIVAMENTE con un JSON valido strutturato in questo modo:
    {
      "category": "Nome Categoria Scelta o Nuova",
      "icon": "nome_icona_scelta_o_null"
    }
    NON INCLUDERE TESTO FUORI DAL JSON.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(cleanJson);
  } catch (error) {
    console.warn('I server IA sono occupati, riprovo più tardi.', error.message);
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

// 4. SCANSIONE BOLLA DI CONSEGNA (VISION)
export const scanDeliveryNote = async (base64Image, mimeType, currentProducts, supplierName, existingCategories = [], availableIcons = []) => {
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
    Sei un esperto di logistica e analisi documenti. Leggi la bolla di consegna (o DDT/Fattura) allegata come immagine. Riguarda un ordine dal fornitore "${supplierName}".
    
    Database Prodotti: ${JSON.stringify(currentProducts.map(p => ({id: p.id, name: p.name, unit: p.unit})))}
    Categorie Esistenti: ${JSON.stringify(existingCategories)}
    Icone disponibili: ${JSON.stringify(availableIcons)}

    Il tuo compito:
    Estrai tutte le righe di prodotto consegnate e le rispettive quantità.
    1. Se il prodotto SCANSIONATO ESISTE nel database: usa il suo "id" e imposta "isNew": false.
    2. Se il prodotto SCANSIONATO NON ESISTE (è nuovo): imposta "id": null, "isNew": true. Per i nuovi deduci anche la "unit" (pz, kg, bottiglie, ecc.), scegli una "category" sensata (tra quelle esistenti o creane una nuova se serve davvero) e scegli un "icon" tra quelle disponibili.

    Rispondi ESCLUSIVAMENTE con un oggetto JSON valido in questo formato:
    {
      "items": [
        {
          "id": "1", // usa null se è nuovo
          "name": "Nome estratto dalla bolla",
          "quantity": 10,
          "unit": "pz.",
          "isNew": false,
          "category": null, // compila solo se isNew: true
          "icon": null // compila solo se isNew: true
        }
      ]
    }
    NON INCLUDERE ALTRO TESTO.
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType: mimeType } }
    ]);
    
    const responseText = result.response.text().trim();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Errore Scansione Bolla:', error);
    return null;
  }
};