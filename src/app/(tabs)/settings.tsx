import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../../auth';
import { getCustomApiKey, saveCustomApiKey, getCustomModel, saveCustomModel } from '../../db';
import { supabase } from '../../supabase';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  // Stati UI e Form
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [currentKeyDisplay, setCurrentKeyDisplay] = useState('Predefinita (.env)');
  const [inputApiKey, setInputApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-lite');

  const AVAILABLE_MODELS = [
    { id: 'gemini-2.5-flash-lite', label: 'Flash Lite (Veloce, Limiti Alti)' },
    { id: 'gemini-flash-latest', label: 'Flash Latest (Stabile)' },
    { id: 'gemini-2.5-flash', label: 'Flash 2.5 (Sperimentale)' },
    { id: 'gemini-1.5-pro', label: 'Pro 1.5 (Qualità, Lento)' }
  ];

  // Stati Multi-Tenant
  const [localeName, setLocaleName] = useState<string>('Caricamento...');
  const [staff, setStaff] = useState<any[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // Ricarica la chiave salvata ogni volta che la schermata va in focus
  useFocusEffect(
    React.useCallback(() => {
      loadApiKey();
      if (user?.locale_id) {
        fetchLocaleInfo();
        if (user?.role === 'PROPRIETARIO') {
          fetchStaff();
        }
      }
    }, [user?.locale_id, user?.role])
  );

  const fetchLocaleInfo = async () => {
    if (!user?.locale_id) return;
    const { data } = await supabase.from('locali').select('name').eq('id', user.locale_id).single();
    if (data) setLocaleName(data.name);
  };

  const fetchStaff = async (forceRefresh = false) => {
    if (!user?.locale_id) return;

    const STAFF_CACHE_KEY = `@panino_staff_${user.locale_id}`;

    if (!forceRefresh) {
      try {
        const cached = await AsyncStorage.getItem(STAFF_CACHE_KEY);
        if (cached) {
          setStaff(JSON.parse(cached));
          return;
        }
      } catch (e) {}
    }

    setIsLoadingStaff(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('locale_id', user.locale_id);
    if (data) {
      setStaff(data);
      try {
        await AsyncStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(data));
      } catch (e) {}
    }
    setIsLoadingStaff(false);
  };

  const loadApiKey = async () => {
    const key = await getCustomApiKey();
    if (key) {
      const masked = key.length > 12 ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : key;
      setCurrentKeyDisplay(masked);
      setInputApiKey(key);
    } else {
      setCurrentKeyDisplay('Predefinita (.env)');
      setInputApiKey('');
    }

    const model = await getCustomModel();
    if (model) {
      setSelectedModel(model);
    }
  };

  const handleSaveConfig = async () => {
    await saveCustomApiKey(inputApiKey);
    await saveCustomModel(selectedModel);
    Alert.alert("Configurazione Salvata", "Le impostazioni AI sono state aggiornate correttamente.");
    loadApiKey();
  };

  const handleResetConfig = async () => {
    Alert.alert(
      "Ripristina Impostazioni",
      "Vuoi tornare alle impostazioni predefinite del sistema?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Ripristina", style: "destructive", onPress: async () => {
            await saveCustomApiKey('');
            await saveCustomModel('');
            setInputApiKey('');
            setSelectedModel('gemini-2.5-flash-lite');
            setCurrentKeyDisplay('Predefinita (.env)');
            Alert.alert("Ripristinato", "L'app è tornata alle impostazioni predefinite.");
          }
        }
      ]
    );
  };

  // Azioni PROPRIETARIO
  const handleApprove = async (id: string) => {
    await supabase.from('profiles').update({ status: 'approved' }).eq('id', id);
    fetchStaff(true);
  };

  const handleReject = async (id: string) => {
    Alert.alert("Rifiuta Utente", "Sei sicuro di voler rifiutare questo utente? Verrà rimosso dal locale.", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Rifiuta", style: "destructive", onPress: async () => {
          await supabase.from('profiles').delete().eq('id', id);
          fetchStaff(true);
        }
      }
    ]);
  };

  const handleChangeRole = (member: any) => {
    if (member.id === user.id) {
      Alert.alert("Attenzione!", "Non puoi modificare il tuo stesso ruolo.");
      return;
    }
    const newRole = member.role === 'STAFF' ? 'MANAGER' : 'STAFF';
    const actionText = newRole === 'MANAGER' ? 'promuovere' : 'declassare';
    Alert.alert("Modifica Ruolo", `Vuoi ${actionText} a ${newRole}?`, [
      { text: "Annulla", style: "cancel" },
      {
        text: "Conferma", onPress: async () => {
          await supabase.from('profiles').update({ role: newRole }).eq('id', member.id);
          fetchStaff(true);
        }
      }
    ]);
  };

  const roleWeight: Record<string, number> = { 'PROPRIETARIO': 3, 'MANAGER': 2, 'STAFF': 1 };
  
  const activeStaff = staff
    .filter(s => s.status === 'approved')
    .sort((a, b) => {
      const weightA = roleWeight[a.role] || 0;
      const weightB = roleWeight[b.role] || 0;
      if (weightA !== weightB) {
        return weightB - weightA; // Ruoli più alti prima
      }
      const nameA = (a.username || a.email || '').toLowerCase();
      const nameB = (b.username || b.email || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

  const pendingStaff = staff.filter(s => s.status === 'pending');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Impostazioni</Text>
        {user?.locale_id && (
          <Text style={styles.headerSubtitle}>Locale: {localeName}</Text>
        )}
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        automaticallyAdjustKeyboardInsets={true}
        keyboardShouldPersistTaps="handled"
      >

          {/* SEZIONE 1: INFO ACCOUNT CON DATI REALI SUPABASE */}
          <Text style={styles.sectionTitle}>IL TUO ACCOUNT</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="person-circle-outline" size={24} color="#DB7F18" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.infoLabel}>Account</Text>
                <Text style={styles.infoValue}>{user?.username || 'Nome Utente Non Impostato'}</Text>
                <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{user?.email || 'Nessuna email'}</Text>
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="shield-outline" size={22} color="#DB7F18" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.infoLabel}>Ruolo Permessi</Text>
                <Text style={[styles.infoValue, { fontWeight: 'bold', color: user?.role === 'PROPRIETARIO' ? '#D93025' : user?.role === 'MANAGER' ? '#DB7F18' : '#666' }]}>
                  {user?.role === 'PROPRIETARIO' ? 'PROPRIETARIO (Admin)' : user?.role === 'MANAGER' ? 'GESTORE (Pieno Controllo)' : 'STAFF (Solo Operazioni)'}
                </Text>
              </View>
            </View>
          </View>

          {/* SEZIONE STAFF (SOLO PROPRIETARIO) */}
          {user?.role === 'PROPRIETARIO' && (
            <>
              {pendingStaff.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>RICHIESTE IN SOSPESO</Text>
                  <View style={styles.card}>
                    {pendingStaff.map((member, index) => (
                      <View key={member.id}>
                        <View style={styles.staffRow}>
                          <View style={styles.textContainer}>
                            <Text style={styles.infoValue}>{member.username ? member.username : (member.email || member.id)}</Text>
                            {member.username && <Text style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>{member.email}</Text>}
                            <Text style={styles.infoLabel}>Vuole unirsi al locale</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity style={styles.btnApprove} onPress={() => handleApprove(member.id)}>
                              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>Approva</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnReject} onPress={() => handleReject(member.id)}>
                              <Text style={{ color: '#D93025', fontSize: 12, fontWeight: 'bold' }}>Rifiuta</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        {index < pendingStaff.length - 1 && <View style={styles.separator} />}
                      </View>
                    ))}
                  </View>
                </>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 8, marginLeft: 4, marginRight: 8 }}>
                <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0, marginLeft: 0 }]}>STAFF ATTIVO</Text>
                <TouchableOpacity onPress={() => fetchStaff(true)} style={{ padding: 4, backgroundColor: '#FFF', borderRadius: 6, borderWidth: 1, borderColor: '#CCC', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                  <Ionicons name="refresh-outline" size={16} color="#333" />
                </TouchableOpacity>
              </View>
              <View style={styles.card}>
                {isLoadingStaff ? (
                  <ActivityIndicator style={{ padding: 20 }} />
                ) : activeStaff.length === 0 ? (
                  <Text style={{ padding: 20, color: '#666', textAlign: 'center' }}>Nessun membro attivo.</Text>
                ) : (
                  activeStaff.map((member, index) => (
                    <View key={member.id}>
                      <TouchableOpacity style={styles.staffRow} onPress={() => handleChangeRole(member)}>
                        <View style={styles.textContainer}>
                          <Text style={styles.infoValue}>{member.username ? member.username : (member.email || member.id)} {member.id === user.id && '(Tu)'}</Text>
                          {member.username && <Text style={{ fontSize: 13, color: '#666', marginBottom: 2 }}>{member.email}</Text>}
                          <Text style={[styles.infoLabel, { color: member.role === 'PROPRIETARIO' ? '#D93025' : member.role === 'MANAGER' ? '#DB7F18' : '#888' }]}>
                            {member.role}
                          </Text>
                        </View>
                        {member.id !== user.id && (
                          <Ionicons name="create-outline" size={20} color="#DB7F18" />
                        )}
                      </TouchableOpacity>
                      {index < activeStaff.length - 1 && <View style={styles.separator} />}
                    </View>
                  ))
                )}
              </View>
            </>
          )}

          {/* SEZIONE 2: SWITCH MODALITÀ AVANZATA */}
          <View style={[styles.card, styles.toggleCard]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.toggleTitle}>Opzioni Avanzate / Debug</Text>
              <Text style={styles.toggleSubtitle}>Gestisci manualmente i parametri dell'IA ed i token</Text>
            </View>
            <Switch
              trackColor={{ false: '#767577', true: '#DB7F18' }}
              thumbColor={isDebugOpen ? '#FFFFFF' : '#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
              onValueChange={setIsDebugOpen}
              value={isDebugOpen}
            />
          </View>

          {/* CASSELLA FUNZIONALITÀ ADVANCED */}
          {isDebugOpen && (
            <View style={styles.advancedBox}>
              <View style={styles.advancedHeader}>
                <Ionicons name="code-working-outline" size={20} color="#DB7F18" style={{ marginRight: 6 }} />
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

              <Text style={styles.inputLabel}>Seleziona Modello IA:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
                {AVAILABLE_MODELS.map(model => (
                  <TouchableOpacity 
                    key={model.id} 
                    style={[styles.chip, selectedModel === model.id && styles.chipActive]}
                    onPress={() => setSelectedModel(model.id)}
                  >
                    <Text style={[styles.chipText, selectedModel === model.id && styles.chipTextActive]}>
                      {model.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.btnReset} onPress={handleResetConfig}>
                  <Ionicons name="refresh-outline" size={16} color="#D93025" style={{ marginRight: 4 }} />
                  <Text style={styles.btnResetText}>Ripristina</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnSave} onPress={handleSaveConfig}>
                  <Ionicons name="save-outline" size={16} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={styles.btnSaveText}>Salva Impostazioni</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F5E6' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  headerSubtitle: { fontSize: 14, color: '#DB7F18', marginTop: 4, fontWeight: '600' },
  container: { padding: 16, paddingBottom: 40 },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#8E8E93', letterSpacing: 1, marginBottom: 8, marginLeft: 4, marginTop: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 4, borderWidth: 1, borderColor: '#EAEAEA', marginBottom: 20 },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  staffRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, justifyContent: 'space-between' },
  iconContainer: { width: 36, justifyContent: 'center', alignItems: 'flex-start' },
  textContainer: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#111', fontWeight: '500' },
  separator: { height: 1, backgroundColor: '#F2F2F7' },

  btnApprove: { backgroundColor: '#DB7F18', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnReject: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D93025', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },

  toggleCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  toggleTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 2 },
  toggleSubtitle: { fontSize: 12, color: '#888' },

  /* Box Avanzate / Debug */
  advancedBox: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#DB7F18', borderStyle: 'solid', marginBottom: 20 },
  advancedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  advancedTitle: { fontSize: 16, fontWeight: 'bold', color: '#DB7F18' },
  apiKeyLabel: { fontSize: 13, color: '#333', marginBottom: 16 },
  apiKeyHighlight: { fontWeight: 'bold', color: '#DB7F18', backgroundColor: '#F0F2F5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  input: { backgroundColor: '#F8F5E6', borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 8, padding: 12, fontSize: 14, color: '#111', marginBottom: 16 },
  
  chipsContainer: { paddingBottom: 8, gap: 8, marginBottom: 16 },
  chip: { backgroundColor: '#F0F2F5', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#EAEAEA' },
  chipActive: { backgroundColor: '#DB7F18', borderColor: '#DB7F18' },
  chipText: { fontSize: 13, color: '#333', fontWeight: '500' },
  chipTextActive: { color: '#FFF' },

  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btnSave: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DB7F18', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  btnSaveText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  btnReset: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#D93025' },
  btnResetText: { color: '#D93025', fontWeight: '600', fontSize: 14 },

  btnLogout: { flexDirection: 'row', backgroundColor: '#D93025', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  btnLogoutText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});