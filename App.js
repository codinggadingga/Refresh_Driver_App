import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { NavigationContainer } from '@react-navigation/native'; // 네비게이션 컨테이너 import
import { createStackNavigator } from '@react-navigation/stack'; // 스택 네비게이션 import
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/LoginScreen'; // 로그인 화면
import PickupDeliverPage from './src/PickupDeliverPage'; // 수거 및 배달 화면
import SignupScreen from './src/SignupScreen'; // 회원가입 화면
import NavigationView from './src/NavigationView'; // 네비게이션 화면

const Stack = createStackNavigator();

const App = () => {
  const [showSplash, setShowSplash] = useState(true); // 스플래시 화면 상태
  const [showLogin, setShowLogin] = useState(false); // 로그인 화면 상태 주석 처리
  const [showPickup, setShowPickup] = useState(false); // 픽업 화면 상태 추가

  useEffect(() => {
    // 2초 후 스플래시 화면을 FadeOut 시키고, 픽업 화면을 나타내게 함
    setTimeout(() => {
      setShowSplash(false); // 스플래시 화면 숨기기
      setShowLogin(true); // 로그인 화면 보이기 주석 처리
      setShowPickup(true); // 픽업 화면 보이기
    }, 2000);
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Splash">
          {/* 스플래시 화면 */}
          {showSplash && (
            <Stack.Screen
              name="Splash"
              options={{ headerShown: false }} // 스플래시 화면 헤더 숨기기
            >
              {() => (
                <Animated.View
                  entering={FadeIn.duration(1000)} // 스플래시 화면 FadeIn
                  exiting={FadeOut.duration(1000)} // 스플래시 화면 FadeOut
                  style={styles.splashContainer}
                >
                  <Text style={styles.splashText}>REFRESH</Text>
                </Animated.View>
              )}
            </Stack.Screen>
          )}


          {/* {showLogin && (
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
          )} */}


          {/* 픽업 화면 - 바로 표시 */}
          {showPickup && (
            <Stack.Screen
              name="pickupMain"
              component={PickupDeliverPage}
              options={{ headerShown: false }}
            />
          )}

          {/* 회원가입 화면 */}
          <Stack.Screen
            name="Signup"
            component={SignupScreen}
            options={{ headerShown: false }} // 회원가입 화면 헤더 숨기기
          />

          <Stack.Screen
            name="Navigation"
            component={NavigationView}
            options={{ headerShown: false }} // 회원가입 화면 헤더 숨기기
          />


        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // 흰색 배경
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContainer: {
    position: 'absolute', // 풀스크린을 덮도록 설정
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff', // 흰색 배경
  },
  splashText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#4CAF50' // 초록색 글자
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%', // 로그인 화면을 꽉 채우도록 설정
  },
});
