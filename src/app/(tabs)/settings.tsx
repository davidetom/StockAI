import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../../auth';
import { getCustomApiKey, saveCustomApiKey } from '../../db';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  
  // Stati UI e Form
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [currentKeyDisplay, setCurrentKeyDisplay] = useState('Predefinita (.env)');
  const [inputApiKey, setInputApiKey] = useState('');

  // Ricarica la chiave salvata ogni volta che la schermata va in focus
  useFocusEffect(
    React.useCallback(() => {
      loadApiKey();
    }, [])
  );

  const loadApiKey = async () => {
    const key = await getCustomApiKey();
    if (key) {
      // Mostra una versione parzialmente oscurata per sicurezza, es: AIzaSy...4xml
      const masked = key.length > 12 ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : key;
      setCurrentKeyDisplay(masked);
      setInputApiKey(key);
    } else {
      setCurrentKeyDisplay('Predefinita (.env)');
      setInputApiKey('');
    }
  };

  const handleSaveKey = async () => {
    await saveCustomApiKey(inputApiKey);
    Alert.alert("Configurazione Salvata", "La chiave API Gemini è stata aggiornata correttamente.");
    loadApiKey();
  };

  const handleResetKey = async () => {
    Alert.alert(
      "Ripristina Chiave",
      "Vuoi tornare ad utilizzare la chiave API predefinita del sistema?",
      [
        { text: "Annulla", style: "cancel" },
        { text: "Ripristina", style: "destructive", onPress: async () => {
            await saveCustomApiKey('');
            setInputApiKey('');
            setCurrentKeyDisplay('Predefinita (.env)');
            Alert.alert("Ripristinato", "L'app è tornata alla chiave API predefinita.");
          }
        }
      ]
    );
  };

  // Mock dei dati account basati sul ruolo attuale dell'utente
  const accountEmail = user?.role === 'MANAGER' ? 'gestore@stockai.it' : 'staff.camerieri@stockai.it';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Impostazioni</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          
          {/* SEZIONE 1: INFO ACCOUNT */}
          <Text style={styles.sectionTitle}>IL TUO ACCOUNT</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="person-circle-outline" size={24} color="#0B132B" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.infoLabel}>Nome Utente</Text>
                <Text style={styles.infoValue}>{user?.name || 'Utente'}</Text>
              </View>
            </View>
            
            <View style={styles.separator} />

            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="mail-outline" size={22} color="#0B132B" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{accountEmail}</Text>
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="lock-closed-outline" size={22} color="#0B132B" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.infoLabel}>Password</Text>
                <Text style={styles.infoValue}>••••••••••••</Text>
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="shield-outline" size={22} color="#0B132B" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.infoLabel}>Ruolo Permessi</Text>
                <Text style={[styles.infoValue, { fontWeight: 'bold', color: user?.role === 'MANAGER' ? '#0052FF' : '#666' }]}>
                  {user?.role === 'MANAGER' ? 'GESTORE (Pieno Controllo)' : 'STAFF (Solo Operazioni)'}
                </Text>
              </View>
            </View>
          </View>

          {/* SEZIONE 2: SWITCH MODALITÀ AVANZATA */}
          <View style={[styles.card, styles.toggleCard]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.toggleTitle}>Opzioni Avanzate / Debug</Text>
              <Text style={styles.toggleSubtitle}>Gestisci manualmente i parametri dell'IA ed i token</Text>
            </View>
            <Switch
              trackColor={{ false: '#767577', true: '#0052FF' }}
              thumbColor={isDebugOpen ? '#FFFFFF' : '#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
              onValueChange={setIsDebugOpen}
              value={isDebugOpen}
            />
          </View>

          {/* CASSELLA FUNZIONALITÀ ADVANCED (APPARIZIONE DINAMICA) */}
          {isDebugOpen && (
            <View style={styles.advancedBox}>
              <View style={styles.advancedHeader}>
                <Ionicons name="code-working-outline" size={20} color="#0052FF" style={{ marginRight: 6 }} />
                <Text style={styles.advancedTitle}>Configurazione Gemini AI</Text>
              </View>

              <Text style={styles.apiKeyLabel}>
                Chiave API corrente: <Text style={styles.apiKeyHighlight}>{currentKeyDisplay}</Text>
              </Text>

              <Text style={styles.inputLabel}>Inserisci Nuova Gemini API Key:</Text>
              <TextInput
                style={styles.input}
                placeholder="Incolla qui la chiave (es. AIzaSy...)"
                placeholderTextColor="#999"
                value={inputApiKey}
                onChangeText={setInputApiKey}
                secureTextEntry={true}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.actionsRow}>
                {currentKeyDisplay !== 'Predefinita (.env)' && (
                  <TouchableOpacity style={styles.btnReset} onPress={handleResetKey}>
                    <Ionicons name="refresh-outline" size={16} color="#D93025" style={{ marginRight: 4 }} />
                    <Text style={styles.btnResetText}>Ripristina</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity style={styles.btnSave} onPress={handleSaveKey}>
                  <Ionicons name="save-outline" size={16} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={styles.btnSaveText}>Salva Chiave</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* PULSANTE LOGOUT IN FONDO */}
          <TouchableOpacity style={styles.btnLogout} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.btnLogoutText}>Disconnetti Account</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  container: { padding: 16, paddingBottom: 40 },
  
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#8E8E93', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 4, borderWidth: 1, borderColor: '#EAEAEA', marginBottom: 20 },
  
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  iconContainer: { width: 36, justifyContent: 'center', alignItems: 'flex-start' },
  textContainer: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#111' },
  separator: { height: 1, backgroundColor: '#F2F2F7' },

  toggleCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  toggleTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 2 },
  toggleSubtitle: { fontSize: 12, color: '#888' },

  /* Box Avanzate / Debug */
  advancedBox: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#0052FF', borderStyle: 'solid', marginBottom: 20 },
  advancedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  advancedTitle: { fontSize: 16, fontWeight: 'bold', color: '#0052FF' },
  apiKeyLabel: { fontSize: 13, color: '#333', marginBottom: 16 },
  apiKeyHighlight: { fontWeight: 'bold', color: '#0B132B', backgroundColor: '#F0F2F5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  input: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 8, padding: 12, fontSize: 14, color: '#111', marginBottom: 16 },
  
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btnSave: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0052FF', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  btnSaveText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  btnReset: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#D93025' },
  btnResetText: { color: '#D93025', fontWeight: '600', fontSize: 14 },

  btnLogout: { flexDirection: 'row', backgroundColor: '#D93025', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  btnLogoutText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});