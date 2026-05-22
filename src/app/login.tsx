import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth'; // aggiusta il path se necessario

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  
  // Stati per i campi di input
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Errore', 'Inserisci email e password per accedere.');
      return;
    }
    
    try {
      await login(email, password);
    } catch (error: any) {
      Alert.alert('Errore di accesso', error.message || 'Credenziali non valide.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0B132B" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.content}
      >
        
        {/* Logo e Titolo */}
        <View style={styles.logoContainer}>
          <View style={styles.iconWrapper}>
            <Ionicons name="storefront" size={40} color="#FFF" />
          </View>
          <Text style={styles.title}>StockAI</Text>
          <Text style={styles.subtitle}>Gestione magazzino intelligente</Text>
        </View>

        {/* Form di Login Reale */}
        <View style={styles.formContainer}>
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

          <TouchableOpacity style={styles.btnManager} onPress={handleLogin}>
            <Text style={styles.btnManagerText}>Accedi</Text>
            <Ionicons name="arrow-forward-outline" size={20} color="#FFF" style={{marginLeft: 8}} />
          </TouchableOpacity>
        </View>

        {/* Links Footer */}
        <View style={styles.footerLinks}>
          <TouchableOpacity>
            <Text style={styles.linkBlue}>Password dimenticata?</Text>
          </TouchableOpacity>
          <View style={{flexDirection: 'row', marginTop: 24}}>
            <Text style={styles.footerText}>Non hai un account? </Text>
            <TouchableOpacity>
              <Text style={styles.linkBlueBold}>Registrati</Text>
            </TouchableOpacity>
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  iconWrapper: { backgroundColor: '#1C2541', padding: 16, borderRadius: 16, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#000', marginBottom: 8 },
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
  
  btnManager: { flexDirection: 'row', backgroundColor: '#0B132B', paddingVertical: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnManagerText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  
  footerLinks: { alignItems: 'center' },
  linkBlue: { color: '#0052FF', fontSize: 13 },
  footerText: { color: '#666', fontSize: 13 },
  linkBlueBold: { color: '#0052FF', fontSize: 13, fontWeight: 'bold' }
});