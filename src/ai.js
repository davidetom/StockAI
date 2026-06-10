import { GoogleGenerativeAI } from '@google/generative-ai';
import { getCustomApiKey, getCustomModel } from './db';

const getGenAIInstance = async () => {
  const customKey = await getCustomApiKey();
  const activeKey = customKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  return new GoogleGenerativeAI(activeKey);
};

const getActiveModel = async () => {
  const model = await getCustomModel();
  return model || 'gemini-2.5-flash-lite';
};

// 1. GESTIONE MULTIPLA DEGLI INTENTI
export const parseInventoryIntent = async (userMessage, currentProducts) => {
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: await getActiveModel() });

    const prompt = `
    Sei l'agente AI di un gestionale di magazzino. Sei esperto sia nel settore HORECA (Hotel/Ristorazione) che nel retail commerciale generale (negozi, calzature, abbigliamento, ferramenta). L'utente ti dirà cosa ha prelevato o aggiunto al magazzino.
    Può menzionare PIÙ prodotti contemporaneamente.
    SE l'utente menziona la preparazione di un piatto (es. "ho preparato 2 carbonare"), STIMA le quantità degli ingredienti utilizzati. Allo stesso modo, se menziona un assemblaggio generico o una vendita (es. "ho venduto 2 kit"), stima i componenti. Calcola sempre in proporzione. Le quantità DEVONO poter essere NUMERI DECIMALI (es. -0.25 per 250g se l'unità è in kg, o intere se in pezzi). -0.25 per 250g se l'unità è in kg, o intere se in pezzi).
    SE l'utente afferma di aver terminato o finito un prodotto (es. "ho finito la farina"), imposta "quantityChange" pari all'esatto negativo della sua quantità attuale per azzerarlo.
    SE l'utente afferma la giacenza residua (es. "sono rimasti 3 litri di latte"), imposta "quantityChange" calcolando la differenza (Giacenza Dichiarata - Quantità Attuale).
    Ecco l'inventario attuale (inclusa la quantità corrente in magazzino): ${JSON.stringify(currentProducts.map(p => ({ id: p.id, name: p.name, unit: p.unit, quantity: p.quantity })))}
    
    Messaggio dell'utente: "${userMessage}"
    
    Capisci quali e quanti prodotti sono stati modificati. Usa i decimali (con il punto, es. -0.5) se ha senso per l'unità di misura (es. kg, litri).
    Rispondi ESCLUSIVAMENTE con un oggetto JSON valido con questa struttura:
    {
      "operations": [
        {
          "productId": "id_del_prodotto",
          "productName": "Nome esatto del prodotto trovato",
          "quantityChange": -0.25 // numero (anche decimale), negativo per prelievi, positivo per aggiunte
        }
      ],
      "replyText": "Risposta cortese (es. 'Ho scalato gli ingredienti per 2 carbonare: 0.25 kg di guanciale e 0.2 kg di pecorino.')"
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
    const model = genAI.getGenerativeModel({ model: await getActiveModel() });

    const prompt = `
    Sei un esperto di logistica sia per il settore HORECA che per attività commerciali generali (negozi, retail). Devi classificare un singolo nuovo prodotto da aggiungere al magazzino.
    
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
    const model = genAI.getGenerativeModel({ model: await getActiveModel() });

    const prompt = `Trascrivi esattamente il contenuto di questo audio ESCLUSIVAMENTE in lingua italiana. Se non c'è parlato, se senti solo numeri senza senso, o se l'audio è incomprensibile, rispondi ESATTAMENTE con questa stringa: ERRORE_VOCALE_VUOTO. Non aggiungere altri commenti o traduzioni.`;

    const result = await model.generateContent([prompt, { inlineData: { data: base64Audio, mimeType: mimeType } }]);
    return result.response.text().trim();
  } catch (error) { return null; }
};

// 4. SCANSIONE BOLLA DI CONSEGNA (VISION)
export const scanDeliveryNote = async (base64Image, mimeType, currentProducts, supplierName, existingCategories = [], availableIcons = []) => {
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: await getActiveModel() });

    const prompt = `
    Sei un esperto di logistica e analisi documenti. Leggi la bolla di consegna (o DDT/Fattura) allegata come immagine. Riguarda un ordine dal fornitore "${supplierName}".
    
    Database Prodotti: ${JSON.stringify(currentProducts.map(p => ({ id: p.id, name: p.name, unit: p.unit })))}
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

// 5. GENERAZIONE TEMPLATE INIZIALE (ONBOARDING)
export const generateInventoryTemplate = async (industryType, availableIcons = []) => {
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: await getActiveModel() });

    const prompt = `
    Sei un consulente logistico esperto sia per il settore HORECA che per attività commerciali retail/generali. Un utente ha appena aperto una nuova attività di tipo "${industryType}".
    Il suo magazzino è attualmente vuoto.
    
    Genera un inventario iniziale intelligente con i 15/20 prodotti più indispensabili per questa specifica attività.
    
    Icone disponibili (scegli SOLO da questa lista, o null): ${JSON.stringify(availableIcons)}

    Rispondi ESCLUSIVAMENTE con un oggetto JSON valido in questo formato:
    {
      "products": [
        {
          "name": "Nome Prodotto (es. Farina 00)",
          "quantity": 0, // imposta sempre 0 per l'onboarding
          "unit": "kg", // unità di misura stimata in base al tipo di prodotto (es. kg per farine, litri per bevande, pz. per prodotti confezionati)
          "min_threshold": 5, // o stimato in base al tipo di prodotto, se non sei sicuro usa 5 come default
          "max_threshold": 20, // o stimato in base al tipo di prodotto, se non sei sicuro usa 20 come default
          "category": "Nome Categoria (es. Dispensa)",
          "icon": "nome_icona_scelta"
        }
      ]
    }
    NON INCLUDERE ALTRO TESTO.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(cleanJson).products;
  } catch (error) {
    console.error('Errore Generazione Template:', error);
    return null;
  }
};

// 6. SCANSIONE FATTURE PER ONBOARDING (VISION)
export const scanOnboardingReceipt = async (base64Image, mimeType, existingCategories = [], availableIcons = []) => {
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: await getActiveModel() });

    const prompt = `
    Sei un esperto di logistica. Leggi la fattura o il DDT allegato come immagine.
    Questa è un'operazione di INIZIALIZZAZIONE MAGAZZINO (Cold Start), quindi tutti i prodotti sono nuovi.
    
    Categorie Esistenti: ${JSON.stringify(existingCategories)}
    Icone disponibili: ${JSON.stringify(availableIcons)}

    Il tuo compito:
    1. Estrai il NOME DEL FORNITORE (chi ha emesso la fattura, di solito in alto a sinistra o al centro).
    2. Estrai tutti i prodotti (nome e quantità).
    3. Per ogni prodotto, deduci l'unità di misura (unit) e in base al tipo di prodotto e all'unità di misura deduci anche i campi min_threshold e max_threshold, assegna una categoria logica (category) e scegli l'icona più appropriata ESCLUSIVAMENTE dalla lista fornita (icon).

    Rispondi ESCLUSIVAMENTE con un oggetto JSON valido in questo formato:
    {
      "supplierName": "Nome Fornitore Estratto",
      "items": [
        {
          "name": "Nome prodotto",
          "quantity": 0, // o il valore rilevato
          "min_threshold": 5,
          "max_threshold": 20,
          "unit": "pz.", // o il valore rilevato
          "category": "Nome Categoria",
          "icon": "nome_icona"
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
    console.error('Errore Scansione Fattura Onboarding:', error);
    return null;
  }
};

// 7. ANALISI FILE MULTIMODALE (CSV/TXT/PDF) PER ONBOARDING
export const analyzeInventoryFile = async (base64Data, mimeType, industryType, availableIcons = []) => {
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: await getActiveModel() });

    const prompt = `
    Sei un estrattore di dati precisissimo per un sistema logistico valido sia in ambito HORECA che in negozi retail generici.
    Analizza il documento allegato (PDF, CSV o TXT) che contiene un inventario di magazzino di un locale: "${industryType}".
    Icone disponibili: ${JSON.stringify(availableIcons)}

    REGOLE FONDAMENTALI (PENA IL FALLIMENTO):
    1. ESTRAI SOLO ED ESCLUSIVAMENTE I PRODOTTI SCRITTI NEL DOCUMENTO. NON inventare NESSUN prodotto aggiuntivo.
    2. Se il documento contiene quantità, unità di misura (kg, pz, litri), fornitore o soglie, RISPETTALE e usale ESATTAMENTE come sono scritte.
    3. SE (e solo se) mancano dei dati per un prodotto estratto (unità di musura, soglie), usa il buon senso basato sul tipo di prodotto e sull'industria per dedurre valori plausibili:
      - deduci l'unità di misura logica (pz., litri, kg) e in base al tipo di prodotto e all'unità di misura deduci anche i campi min_threshold e max_threshold.
      - compila i vuoti con questi default: current_stock = 0, supplier_id = "Fornitore Estratto Generico".
    4. Assegna a ciascun prodotto una "category" logica (es. "Bevande", "Dispensa") e un'icona appropriata scegliendola SOLO dalla lista fornita.
    
    Rispondi SOLO con questo JSON:
    {
      "products": [
        {
          "name": "Nome estratto",
          "unit": "Unità estratta o default",
          "current_stock": 10,
          "min_threshold": 5,
          "max_threshold": 20,
          "supplier_id": "Nome fornitore estratto o default",
          "category": "Nome categoria",
          "icon": "nome_icona"
        }
      ]
    }
    NON INCLUDERE ALTRO TESTO.
    `;

    // Passiamo il file come InlineData (come fatto per le foto)
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: mimeType } }
    ]);

    const cleanJson = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson).products;
  } catch (e) {
    console.error('Errore analisi file:', e);
    return null;
  }
};

// 8. SCANSIONE VISIVA DEGLI SCAFFALI REALI
export const scanShelfInventory = async (base64Image, mimeType, existingCategories = [], availableIcons = []) => {
  try {
    const genAI = await getGenAIInstance();
    const model = genAI.getGenerativeModel({ model: await getActiveModel() });

    const prompt = `
    Sei un'IA di visione artificiale per un gestionale di magazzino valido sia in ambito HORECA che per negozi/attività commerciali in generale.
    L'utente ha scattato una foto agli scaffali, ai frigoriferi o alla dispensa del suo locale.
    
    Categorie Esistenti: ${JSON.stringify(existingCategories)}
    Icone disponibili: ${JSON.stringify(availableIcons)}

    Il tuo compito:
    1. Identifica tutti i prodotti visibili chiaramente (es. bottiglie di liquore, scatole di pasta, verdura).
    2. Per ogni prodotto, estrai un nome generico o il brand se leggibile.
    3. Stima la quantità visibile (es. se vedi 3 bottiglie di Campari, quantity = 3).
    4. Deduci l'unità di misura logica (pz., litri, kg); in base al tipo di prodotto e all'unità di misura deduci anche i campi min_threshold e max_threshold.
    5. Se non riesci a identificare un prodotto con certezza, IGNORALO (non inserire prodotti inventati); Unità di misura = "pz.", min_threshold = 5, max_threshold = 20 e categoria = "Varie" sono valori di default da usare SOLO se sei ragionevolmente sicuro del prodotto ma mancano dati specifici.
    6. Assegna una categoria logica (es. "Alcolici", "Dispensa") e scegli l'icona più appropriata ESCLUSIVAMENTE dalla lista fornita.

    Rispondi SOLO con un oggetto JSON valido in questo formato:
    {
      "items": [
        {
          "name": "Nome Prodotto",
          "quantity": 3,
          "min_threshold": 5,
          "max_threshold": 20,
          "unit": "pz.",
          "category": "Nome Categoria",
          "icon": "nome_icona"
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
    console.error('Errore Scansione Scaffale:', error);
    return null;
  }
};