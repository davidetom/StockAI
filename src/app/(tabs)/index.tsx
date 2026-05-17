import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, Text, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { parseInventoryIntent, transcribeAudio } from '../../ai'; // <-- Aggiunto transcribeAudio
import { getProducts, updateProductStock } from '../../db';
import { useFocusEffect } from '@react-navigation/native';

export default function ChatScreen() {
  const [messages, setMessages] = useState([{ id: '0', text: 'Ciao! Cosa hai prelevato o aggiunto al magazzino?', sender: 'ai' }]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  
  // Stati per la registrazione vocale
  const [recording, setRecording] = useState<Audio.Recording | undefined>();
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [pendingAction, setPendingAction] = useState<any>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({ productId: '', productName: '', quantityChange: 0 });

  useFocusEffect(
    React.useCallback(() => { loadProducts(); }, [])
  );

  const loadProducts = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  // --- LOGICA CENTRALE: Processa l'intento (Testo o Audio trascritto) ---
  const processUserIntent = async (text: string, isAudioMsg: boolean = false) => {
    const userMsg = { id: Date.now().toString(), text: text, sender: 'user', isAudio: isAudioMsg };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    const currentProducts = await getProducts();
    const aiResponse = await parseInventoryIntent(text, currentProducts);
    
    if (aiResponse.productId) {
      // 1. Cerchiamo il prodotto corrispondente per prendere la sua unità di misura
      const matchedProduct = currentProducts.find((p : any) => p.id === aiResponse.productId);
      const productUnit = matchedProduct ? matchedProduct.unit : 'pz.'; 

      setPendingAction({
        id: (Date.now() + 1).toString(),
        text: aiResponse.replyText,
        productId: aiResponse.productId,
        productName: aiResponse.productName,
        quantityChange: aiResponse.quantityChange,
        unit: productUnit // <-- 2. Aggiungiamo l'unità di misura allo stato!
      });
    } else {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: aiResponse.replyText, sender: 'ai' }]);
    }
    
    setIsLoading(false);
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;
    processUserIntent(inputText, false);
  };

  // --- LOGICA AUDIO ---
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    
    // 1. Diamo SÙBITO il feedback visivo all'utente (mostriamo la rotellina)
    setIsTranscribing(true); 
    setRecording(undefined);

    // 2. TRUCCO: Aspettiamo mezzo secondo (500ms) prima di staccare il microfono
    // Questo permette di registrare la coda dell'ultima parola pronunciata
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Ora fermiamo fisicamente la registrazione
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const uri = recording.getURI();

    if (uri) {
      try {
        const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const mimeType = Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4';
        
        const transcribedText = await transcribeAudio(base64Audio, mimeType);

        if (transcribedText) {
          await processUserIntent(transcribedText, true);
        } else {
          setMessages(prev => [...prev, { id: Date.now().toString(), text: "Scusa, non ho compreso bene l'audio. Puoi ripetere?", sender: 'ai' }]);
        }
      } catch (e) {
        console.error("Errore durante l'invio dell'audio:", e);
      }
    }
    setIsTranscribing(false);
  };

  // ... (Tieni qui le tue funzioni handleConfirm, openEditModal, saveCorrections inalterate)
  const handleConfirm = async () => {
    if (!pendingAction) return;
    await updateProductStock(pendingAction.productId, pendingAction.quantityChange);
    setMessages(prev => [...prev, { id: Date.now().toString(), text: `✅ Aggiornato: ${pendingAction.quantityChange > 0 ? '+' : ''}${pendingAction.quantityChange} ${pendingAction.productName}`, sender: 'ai' }]);
    setPendingAction(null);
  };

  const openEditModal = () => {
    setEditData({ productId: pendingAction.productId, productName: pendingAction.productName, quantityChange: pendingAction.quantityChange });
    setIsEditModalVisible(true);
  };

  const saveCorrections = () => {
    setPendingAction({ ...pendingAction, ...editData });
    setIsEditModalVisible(false);
  };

  const renderMessage = ({ item }: { item: any }) => (
    <View style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
      {/* Se è un audio, mostriamo un'icona prima del testo */}
      {item.isAudio && <Ionicons name="mic-outline" size={16} color="#FFF" style={{marginBottom: 4}} />}
      <Text style={item.sender === 'user' ? styles.userText : styles.aiText}>{item.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assistente StockAI</Text>
      </View>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContainer}
        />

        {/* ... (CARTA DI CONFERMA: inalterata) ... */}
        {pendingAction && (
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmText}>{pendingAction.text}</Text>
            <View style={styles.confirmHighlightBox}>
              <Ionicons name="cube-outline" size={18} color="#0B132B" style={{marginRight: 6}} />
              <Text style={styles.confirmHighlightText}>{pendingAction.productName}</Text>
              <Text style={[styles.confirmHighlightQty, { color: pendingAction.quantityChange > 0 ? '#1E8E3E' : '#D93025'}]}>
                {pendingAction.quantityChange > 0 ? '+' : ''}{pendingAction.quantityChange} {pendingAction.unit}
              </Text>
            </View>
            <Text style={styles.confirmQuestion}>Confermi l'operazione?</Text>
            
            <View style={styles.confirmButtonsRow}>
              <TouchableOpacity style={styles.btnSecondary} onPress={openEditModal}>
                <Ionicons name="close-outline" size={18} color="#0B132B" />
                <Text style={styles.btnSecondaryText}>Correggi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleConfirm}>
                <Ionicons name="checkmark-outline" size={18} color="#FFF" />
                <Text style={styles.btnPrimaryText}>Conferma</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* INPUT CHAT DINAMICO */}
        {!pendingAction && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Es. ho preso 2 Gin Mare..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              editable={!recording && !isTranscribing} // Blocca scrittura se registra
            />
            
            {/* Logica per mostrare Invia o Microfono */}
            {inputText.trim().length > 0 ? (
              <TouchableOpacity style={[styles.sendButton, isLoading && styles.sendButtonDisabled]} onPress={handleSendText} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="send" size={18} color="#FFF" />}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.sendButton, recording ? styles.recordingBtn : null]} 
                onPress={recording ? stopRecording : startRecording}
                disabled={isTranscribing}
              >
                {isTranscribing ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Ionicons name={recording ? "stop" : "mic"} size={22} color="#FFF" />
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

      </KeyboardAvoidingView>

      {/* MODALE DI CORREZIONE */}
      <Modal visible={isEditModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Correggi Dati</Text>
            
            <Text style={styles.modalLabel}>Prodotto Selezionato:</Text>
            <FlatList 
              data={products}
              keyExtractor={item => item.id}
              style={{maxHeight: 150, marginBottom: 20, borderWidth: 1, borderColor: '#eee', borderRadius: 8}}
              renderItem={({item}) => (
                <TouchableOpacity 
                  style={[styles.modalProductItem, editData.productId === item.id && styles.modalProductItemActive]}
                  onPress={() => setEditData({...editData, productId: item.id, productName: item.name})}
                >
                  <Text style={editData.productId === item.id ? {fontWeight: 'bold', color: '#0B132B'} : {color: '#333'}}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />

            <Text style={styles.modalLabel}>Quantità (negativa per prelievo):</Text>
            <View style={styles.stepperContainer}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setEditData({...editData, quantityChange: editData.quantityChange - 1})}>
                <Text style={styles.stepperBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{editData.quantityChange}</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setEditData({...editData, quantityChange: editData.quantityChange + 1})}>
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.btnPrimary, { flex: 0, width: '100%', marginTop: 24, paddingVertical: 16 }]} onPress={saveCorrections}>
              <Text style={[styles.btnPrimaryText, { marginLeft: 0, fontSize: 16 }]}>Salva Modifiche</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 20, backgroundColor: '#0B132B', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  container: { flex: 1 },
  chatContainer: { padding: 16, flexGrow: 1, justifyContent: 'flex-end' },
  
  bubble: { padding: 14, borderRadius: 20, marginBottom: 12, maxWidth: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  userBubble: { backgroundColor: '#1C2541', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#FFFFFF', alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#EAEAEA' },
  userText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22 },
  aiText: { color: '#333333', fontSize: 15, lineHeight: 22 },
  
  inputContainer: { flexDirection: 'row', padding: 12, paddingBottom: Platform.OS === 'ios' ? 12 : 24, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#EAEAEA', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F0F2F5', borderRadius: 24, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, marginRight: 12, fontSize: 15, color: '#333' },
  sendButton: { backgroundColor: '#0B132B', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: '#6C757D' },
  sendButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  recordingBtn: { backgroundColor: '#D93025' },

  /* Stili per la Scheda di Conferma (Dal Template) */
  confirmationCard: { backgroundColor: '#FFFFFF', margin: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#EAEAEA', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 4 },
  confirmText: { fontSize: 15, color: '#333', marginBottom: 12 },
  confirmHighlightBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F2F5', padding: 10, borderRadius: 8, marginBottom: 16 },
  confirmHighlightText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0B132B' },
  confirmHighlightQty: { fontSize: 16, fontWeight: 'bold' },
  confirmQuestion: { fontSize: 14, color: '#6C757D', marginBottom: 16, textAlign: 'center' },
  confirmButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  btnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#0B132B' },
  btnSecondaryText: { color: '#0B132B', fontWeight: '600', marginLeft: 6 },
  btnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B132B', padding: 12, borderRadius: 8 },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '600', marginLeft: 6 },

  /* Stili per il Modale di Correzione */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#0B132B' },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#6C757D', marginBottom: 8, marginTop: 12 },
  modalProductItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalProductItemActive: { backgroundColor: '#E8F0FE' },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#F0F2F5', borderRadius: 8 },
  stepperBtn: { paddingHorizontal: 20, paddingVertical: 12 },
  stepperBtnText: { fontSize: 20, fontWeight: 'bold', color: '#0B132B' },
  stepperValue: { fontSize: 18, fontWeight: 'bold', width: 40, textAlign: 'center' }
});