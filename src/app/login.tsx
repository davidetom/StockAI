import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth';
import { supabase } from '../supabase';

export default function LoginScreen() {
  const { login, register, isLoading } = useAuth();

  const [isLoginMode, setIsLoginMode] = useState(true);

  // Stati per i campi di input
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  // Stati per registrazione
  const [locali, setLocali] = useState<any[]>([]);
  const [isNewLocale, setIsNewLocale] = useState(false);
  const [selectedLocaleId, setSelectedLocaleId] = useState<string>('');
  const [newLocaleName, setNewLocaleName] = useState('');
  const [searchLocaleName, setSearchLocaleName] = useState('');

  useEffect(() => {
    if (!isLoginMode) {
      // Fetch existing locali
      supabase.from('locali').select('*').then(({ data, error }) => {
        if (data) setLocali(data);
      });
    }
  }, [isLoginMode]);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Errore', 'Inserisci email e password.');
      return;
    }

    try {
      if (isLoginMode) {
        await login(email, password);
      } else {
        if (isNewLocale && !newLocaleName) {
          Alert.alert('Errore', 'Inserisci il nome del nuovo locale.');
          return;
        }
        if (!isNewLocale && !selectedLocaleId) {
          Alert.alert('Errore', 'Seleziona un locale esistente o creane uno nuovo.');
          return;
        }
        if (!username.trim()) {
          Alert.alert('Errore', 'Inserisci un nome utente.');
          return;
        }
        await register(email, password, username, newLocaleName, isNewLocale, selectedLocaleId);
        Alert.alert('Successo', 'Registrazione completata!');
      }
    } catch (error: any) {
      Alert.alert('Errore', error.message || 'Errore durante l\'operazione.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DB7F18" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        automaticallyAdjustKeyboardInsets={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo e Titolo */}
        <View style={styles.headerContainer}>
          <Text style={styles.subtitleAcronym}>Pantry Nimble Notation</Text>
          <View style={styles.logoRow}>
            <Image source={require('../../assets/icon.png')} style={styles.iconImageSmall} />
            <Text style={styles.titleElegant}>PaNiNo</Text>
          </View>
          <Text style={styles.subtitle}>{isLoginMode ? 'Il tuo magazzino intelligente' : 'Crea il tuo account'}</Text>
        </View>

        {/* Form di Auth */}
        <View style={styles.formContainer}>

          {!isLoginMode && (
            <View style={styles.localeSection}>
              <Text style={styles.sectionLabel}>Locale</Text>

              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleBtn, !isNewLocale && styles.toggleBtnActive]}
                  onPress={() => setIsNewLocale(false)}
                >
                  <Text style={[styles.toggleText, !isNewLocale && styles.toggleTextActive]}>Unisciti a esistente</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, isNewLocale && styles.toggleBtnActive]}
                  onPress={() => setIsNewLocale(true)}
                >
                  <Text style={[styles.toggleText, isNewLocale && styles.toggleTextActive]}>Nuovo Locale</Text>
                </TouchableOpacity>
              </View>

              {isNewLocale ? (
                <View style={styles.inputContainer}>
                  <Ionicons name="business-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nome del Nuovo Locale"
                    placeholderTextColor="#999"
                    value={newLocaleName}
                    onChangeText={setNewLocaleName}
                  />
                </View>
              ) : (
                <View style={{ marginBottom: 16 }}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="search-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Cerca il nome del locale..."
                      placeholderTextColor="#999"
                      value={searchLocaleName}
                      onChangeText={(text) => {
                        setSearchLocaleName(text);
                        setSelectedLocaleId(''); // Deseleziona quando cambia la ricerca
                      }}
                    />
                  </View>
                  
                  {searchLocaleName.trim().length > 0 && (
                    locali.filter(l => l.name.toLowerCase().includes(searchLocaleName.toLowerCase())).length === 0 ? (
                      <Text style={{ color: '#666', fontSize: 13, marginTop: -8, marginBottom: 8, paddingHorizontal: 4 }}>Nessun locale trovato.</Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50, marginTop: -8, marginBottom: 8 }}>
                        {locali.filter(l => l.name.toLowerCase().includes(searchLocaleName.toLowerCase())).map(loc => (
                          <TouchableOpacity
                            key={loc.id}
                            style={[styles.localeChip, selectedLocaleId === loc.id && styles.localeChipActive]}
                            onPress={() => setSelectedLocaleId(loc.id)}
                          >
                            <Text style={{ color: selectedLocaleId === loc.id ? '#DB7F18' : '#333' }}>{loc.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )
                  )}
                </View>
              )}
            </View>
          )}

          {!isLoginMode && (
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nome Utente (es. Mario)"
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity style={styles.btnManager} onPress={handleAuth}>
            <Text style={styles.btnManagerText}>{isLoginMode ? 'Accedi' : 'Registrati'}</Text>
            <Ionicons name="arrow-forward-outline" size={20} color="#FFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>

        {/* Links Footer */}
        <View style={styles.footerLinks}>
          {isLoginMode && (
            <TouchableOpacity>
              <Text style={styles.linkBlue}>Password dimenticata?</Text>
            </TouchableOpacity>
          )}
          <View style={{ flexDirection: 'row', marginTop: 24 }}>
            <Text style={styles.footerText}>{isLoginMode ? 'Non hai un account? ' : 'Hai già un account? '}</Text>
            <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
              <Text style={styles.linkBlueBold}>{isLoginMode ? 'Registrati' : 'Accedi'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F5E6' },
  container: { flex: 1, backgroundColor: '#F8F5E6' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40 },
  headerContainer: { alignItems: 'center', marginBottom: 40, marginTop: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconImageSmall: { width: 50, height: 50, borderRadius: 12, marginRight: 12 },
  titleElegant: { fontSize: 36, fontWeight: '300', color: '#000', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontStyle: 'italic' },
  subtitleAcronym: { fontSize: 11, color: '#999', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#666' },

  formContainer: { marginBottom: 32 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 15,
    color: '#111',
  },

  btnManager: { flexDirection: 'row', backgroundColor: '#DB7F18', paddingVertical: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnManagerText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  footerLinks: { alignItems: 'center', marginBottom: 40 },
  linkBlue: { color: '#DB7F18', fontSize: 13 },
  footerText: { color: '#666', fontSize: 13 },
  linkBlueBold: { color: '#DB7F18', fontSize: 13, fontWeight: 'bold' },

  localeSection: { marginBottom: 16 },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#EAEAEA', borderRadius: 8, padding: 4, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  toggleBtnActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  toggleText: { fontSize: 13, color: '#666', fontWeight: 'bold' },
  toggleTextActive: { color: '#DB7F18' },

  localeChip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 20, marginRight: 8 },
  localeChipActive: { borderColor: '#DB7F18', backgroundColor: '#FFF4EB' },
});