import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { parseInventoryIntent, transcribeAudio } from '../../ai';
import { getProducts, updateProductStock } from '../../db';

export default function ChatScreen() {
  const [messages, setMessages] = useState([{ id: '0', text: 'Ciao! Cosa hai prelevato o aggiunto al magazzino? Puoi dirmi più cose insieme!', sender: 'ai' }]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [recording, setRecording] = useState<Audio.Recording | undefined>();
  const [isTranscribing, setIsTranscribing] = useState(false);

  // pendingAction contiene l'array di operazioni
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editOperations, setEditOperations] = useState<any[]>([]);

  const processUserIntent = async (text: string, isAudioMsg: boolean = false) => {
    const userMsg = { id: Date.now().toString(), text: text, sender: 'user', isAudio: isAudioMsg };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    const currentProducts = await getProducts();
    const aiResponse = await parseInventoryIntent(text, currentProducts);
    
    if (aiResponse?.operations && aiResponse.operations.length > 0) {
      const opsWithUnits = aiResponse.operations.map((op: any) => {
        const matched = currentProducts.find((p: any) => p.id === op.productId);
        return { ...op, unit: matched ? matched.unit : 'pz.' };
      });

      setPendingAction({ text: aiResponse.replyText, operations: opsWithUnits });
    } else {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: aiResponse?.replyText || 'Non ho compreso, puoi ripetere?', sender: 'ai' }]);
    }
    setIsLoading(false);
  };

  const handleSendText = () => { if (inputText.trim()) processUserIntent(inputText, false); };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
    } catch (err) {
      console.error("Errore avvio microfono", err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsTranscribing(true); 
    setRecording(undefined);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      
      const uri = recording.getURI();
      if (uri) {
        const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const mimeType = Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4';
        const transcribedText = await transcribeAudio(base64Audio, mimeType);
        
        if (transcribedText) {
          await processUserIntent(transcribedText, true);
        } else {
          setMessages(prev => [...prev, { id: Date.now().toString(), text: "Scusa, non ho compreso bene l'audio.", sender: 'ai' }]);
        }
      }
    } catch (e) {
      console.error("Errore stop audio", e);
    }
    setIsTranscribing(false);
  };

  // AGGIUNTA GUARDIA DI SICUREZZA
  const handleConfirm = async () => {
    if (!pendingAction || !pendingAction.operations) return;
    
    setIsLoading(true); // Blocca la UI durante l'aggiornamento multiplo
    for (const op of pendingAction.operations) {
      await updateProductStock(op.productId, op.quantityChange);
    }
    setMessages(prev => [...prev, { id: Date.now().toString(), text: `✅ Operazioni registrate correttamente!`, sender: 'ai' }]);
    setPendingAction(null);
    setIsLoading(false);
  };

  // AGGIUNTA GUARDIA DI SICUREZZA
  const openEditModal = () => {
    if (!pendingAction || !pendingAction.operations) return;
    
    setEditOperations([...pendingAction.operations]);
    setIsEditModalVisible(true);
  };

  const adjustEditQty = (index: number, delta: number) => {
    const updated = [...editOperations];
    updated[index].quantityChange += delta;
    setEditOperations(updated);
  };

  // AGGIUNTA GUARDIA DI SICUREZZA
  const saveCorrections = () => {
    if (!pendingAction) return;
    setPendingAction({ ...pendingAction, operations: editOperations });
    setIsEditModalVisible(false);
  };

  const renderMessage = ({ item }: { item: any }) => (
    <View style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
      {item.isAudio && <Ionicons name="mic-outline" size={16} color="#FFF" style={{marginBottom: 4}} />}
      <Text style={item.sender === 'user' ? styles.userText : styles.aiText}>{item.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}><Text style={styles.headerTitle}>Assistente StockAI</Text></View>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        <FlatList data={messages} keyExtractor={item => item.id} renderItem={renderMessage} contentContainerStyle={styles.chatContainer} />

        {/* CARTA DI CONFERMA MULTIPLA - AGGIUNTO CONTROLLO DI SICUREZZA EXTRA */}
        {pendingAction && pendingAction.operations && (
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmText}>{pendingAction.text}</Text>
            
            {pendingAction.operations.map((op: any, idx: number) => (
              <View key={idx} style={styles.confirmHighlightBox}>
                <Ionicons name="cube-outline" size={18} color="#0B132B" style={{marginRight: 6}} />
                <Text style={styles.confirmHighlightText}>{op.productName}</Text>
                <Text style={[styles.confirmHighlightQty, { color: op.quantityChange > 0 ? '#1E8E3E' : '#D93025'}]}>
                  {op.quantityChange > 0 ? '+' : ''}{op.quantityChange} {op.unit}
                </Text>
              </View>
            ))}

            <Text style={styles.confirmQuestion}>Confermi le operazioni?</Text>
            <View style={styles.confirmButtonsRow}>
              <TouchableOpacity style={styles.btnSecondary} onPress={openEditModal} disabled={isLoading}>
                <Text style={styles.btnSecondaryText}>Correggi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, isLoading && { backgroundColor: '#6C757D' }]} onPress={handleConfirm} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.btnPrimaryText}>Conferma Tutto</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* INPUT */}
        {!pendingAction && (
          <View style={styles.inputContainer}>
            <TextInput style={styles.input} placeholder="Es. ho preso 2 Gin e 1 Tonica..." value={inputText} onChangeText={setInputText} editable={!recording && !isTranscribing} />
            {inputText.trim().length > 0 ? (
              <TouchableOpacity style={[styles.sendButton, isLoading && styles.sendButtonDisabled]} onPress={handleSendText} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="send" size={18} color="#FFF" />}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.sendButton, recording ? styles.recordingBtn : null]} onPress={recording ? stopRecording : startRecording} disabled={isTranscribing}>
                {isTranscribing ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name={recording ? "stop" : "mic"} size={22} color="#FFF" />}
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* MODALE DI CORREZIONE MULTIPLA */}
      <Modal visible={isEditModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Correggi Quantità</Text>
            <ScrollView style={{maxHeight: 300}}>
              {editOperations.map((op, idx) => (
                <View key={idx} style={styles.editRow}>
                  <Text style={styles.editRowText}>{op.productName}</Text>
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustEditQty(idx, -1)}><Text style={styles.stepperBtnText}>-</Text></TouchableOpacity>
                    <Text style={styles.stepperValue}>{op.quantityChange}</Text>
                    <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustEditQty(idx, 1)}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.btnPrimary, { width: '100%', marginTop: 24, paddingVertical: 16 }]} onPress={saveCorrections}>
              <Text style={styles.btnPrimaryText}>Salva Modifiche</Text>
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
  bubble: { padding: 14, borderRadius: 20, marginBottom: 12, maxWidth: '85%' },
  userBubble: { backgroundColor: '#1C2541', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#FFFFFF', alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#EAEAEA' },
  userText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22 },
  aiText: { color: '#333333', fontSize: 15, lineHeight: 22 },
  
  inputContainer: { flexDirection: 'row', padding: 12, paddingBottom: Platform.OS === 'ios' ? 12 : 24, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#EAEAEA', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F0F2F5', borderRadius: 24, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, marginRight: 12, fontSize: 15 },
  sendButton: { backgroundColor: '#0B132B', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: '#6C757D' },
  recordingBtn: { backgroundColor: '#D93025' },

  confirmationCard: { backgroundColor: '#FFFFFF', margin: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#EAEAEA', elevation: 4 },
  confirmText: { fontSize: 15, color: '#333', marginBottom: 12 },
  confirmHighlightBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F2F5', padding: 10, borderRadius: 8, marginBottom: 8 },
  confirmHighlightText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0B132B' },
  confirmHighlightQty: { fontSize: 16, fontWeight: 'bold' },
  confirmQuestion: { fontSize: 14, color: '#6C757D', marginVertical: 12, textAlign: 'center' },
  confirmButtonsRow: { flexDirection: 'row', gap: 12 },
  btnSecondary: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#0B132B' },
  btnSecondaryText: { color: '#0B132B', fontWeight: '600' },
  btnPrimary: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B132B', padding: 12, borderRadius: 8 },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#0B132B' },
  editRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 12 },
  editRowText: { fontSize: 16, fontWeight: '500', flex: 1 },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F2F5', borderRadius: 8 },
  stepperBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  stepperBtnText: { fontSize: 20, fontWeight: 'bold', color: '#0B132B' },
  stepperValue: { fontSize: 16, fontWeight: 'bold', width: 30, textAlign: 'center' }
});