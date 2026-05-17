import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth'; // path verso il tuo auth.tsx

export default function LoginScreen() {
  const { user, login, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0B132B" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        {/* Logo e Titolo */}
        <View style={styles.logoContainer}>
          <View style={styles.iconWrapper}>
            <Ionicons name="storefront" size={40} color="#FFF" />
          </View>
          <Text style={styles.title}>StockAI</Text>
          <Text style={styles.subtitle}>Gestione magazzino intelligente</Text>
        </View>

        {/* Form / Bottoni MVP */}
        <View style={styles.formContainer}>
          <TouchableOpacity style={styles.btnStaff} onPress={() => login('STAFF')}>
            <Ionicons name="person-outline" size={20} color="#FFF" style={{marginRight: 8}} />
            <Text style={styles.btnStaffText}>Accedi come Staff</Text>
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>oppure</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.btnManager} onPress={() => login('MANAGER')}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#0B132B" style={{marginRight: 8}} />
            <Text style={styles.btnManagerText}>Accedi come Gestore</Text>
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

      </View>
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
  btnStaff: { flexDirection: 'row', backgroundColor: '#1C2541', paddingVertical: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnStaffText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dividerText: { marginHorizontal: 12, color: '#888', fontSize: 12 },
  btnManager: { flexDirection: 'row', backgroundColor: '#FFF', paddingVertical: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1C2541' },
  btnManagerText: { color: '#1C2541', fontSize: 15, fontWeight: '600' },
  footerLinks: { alignItems: 'center' },
  linkBlue: { color: '#0052FF', fontSize: 13 },
  footerText: { color: '#666', fontSize: 13 },
  linkBlueBold: { color: '#0052FF', fontSize: 13, fontWeight: 'bold' }
});