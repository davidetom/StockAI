import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, Text, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator } from 'react-native';
import { parseInventoryIntent } from '../ai';
import { getProducts, updateProductStock } from '../db';

export default function ChatScreen() {
  const [messages, setMessages] = useState([{ id: '0', text: 'Ciao! Cosa hai prelevato o aggiunto al magazzino?', sender: 'ai' }]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg = { id: Date.now().toString(), text: inputText, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    const currentProducts = await getProducts();
    const aiResponse = await parseInventoryIntent(userMsg.text, currentProducts);
    
    if (aiResponse.productId) {
      await updateProductStock(aiResponse.productId, aiResponse.quantityChange);
    }

    const aiMsg = { id: (Date.now() + 1).toString(), text: aiResponse.replyText, sender: 'ai' };
    setMessages(prev => [...prev, aiMsg]);
    setIsLoading(false);
  };

  const renderMessage = ({ item }: { item: any }) => (
    <View style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
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
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Es. ho preso 2 Gin Mare..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity 
            style={[styles.sendButton, isLoading && styles.sendButtonDisabled]} 
            onPress={sendMessage} 
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.sendButtonText}>Invia</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  sendButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }
});