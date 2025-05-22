import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar
} from 'react-native';
import styles from './styles/signupStyles'; // 스타일 파일 import

const SignupScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignup = async (email, password) => {
    if (password !== confirmPassword) {
      Alert.alert('비밀번호 불일치', '비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      const url = `https://refresh-f5-server.o-r.kr/api/auth/register/deliver?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const result = await response.json();

      if (response.status === 200) {
        Alert.alert('회원가입 성공', '계정이 생성되었습니다.');
      } else {
        Alert.alert('회원가입 실패', result.message || '다시 시도해 주세요.');
      }
    } catch (error) {
      Alert.alert('오류 발생', '회원가입 중 오류가 발생했습니다.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[styles.signupContainer, { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }]}>
            <Text style={styles.signupLogo}>REFRESH</Text>
            <Text style={styles.signupSubtitle}>SIGN UP</Text>
            <TextInput
              placeholder="E-mail"
              style={styles.signupInput}
              placeholderTextColor="#FFFFFF"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              placeholder="비밀번호"
              style={styles.signupInput}
              secureTextEntry
              placeholderTextColor="#FFFFFF"
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              placeholder="비밀번호 확인"
              style={styles.signupInput}
              secureTextEntry
              placeholderTextColor="#FFFFFF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity style={styles.signupButton} onPress={() => handleSignup(email, password)}>
              <Text style={styles.signupButtonText}>회원가입</Text>
            </TouchableOpacity>
            <View style={styles.signupFooter}>
              <Text style={styles.signupLink}>이미 계정이 있나요? 로그인</Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignupScreen;
