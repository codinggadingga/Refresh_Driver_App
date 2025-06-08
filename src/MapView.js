import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Alert,
  Platform,
  AppState
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import CustomModal from './CustomModal';

const { width, height } = Dimensions.get('window');

const MapView = ({ toggleViewMode, pickupCoordinates, selectedPickups, clearAllSelections, handleMarkerClick }) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 37.566826,
    longitude: 126.9786567
  });
  const [locationError, setLocationError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState(null);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [webViewError, setWebViewError] = useState(false);
  const webViewRef = useRef(null);
  const navigation = useNavigation();
  // 현재 경유지 인덱스 상태 추가 (MapView 컴포넌트 상단에 추가)
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
  // 앱 포커스 감지를 위한 상태 추가
  const [appState, setAppState] = useState(AppState.currentState);
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: [],
    type: 'default'
  });

  // 모달 표시 헬퍼 함수
  const showModal = (config) => {
    setModalConfig({
      visible: true,
      ...config
    });
  };

  // 모달 닫기 함수
  const hideModal = () => {
    setModalConfig(prev => ({
      ...prev,
      visible: false
    }));
  };

  // 위치 권한 요청 및 현재 위치 가져오기
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('위치 접근 권한이 필요합니다');
          Alert.alert('위치 권한 필요', '이 앱은 사용자의 위치 권한을 필요로 합니다.');
          setIsLoading(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });
        
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        
      } catch (error) {
        console.error('위치 정보를 가져오는 데 실패했습니다:', error);
        setLocationError('위치 정보를 가져오는 데 실패했습니다');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 지도가 로드된 후 현재 위치와 수거지 마커 업데이트
  useEffect(() => {
    if (mapLoaded && webViewRef.current && !webViewError) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'UPDATE_LOCATION',
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      }));
      
      if (pickupCoordinates && pickupCoordinates.length > 0) {
        const delay = Platform.OS === 'android' ? 300 : 100;
        setTimeout(() => {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'ADD_PICKUPS',
            locations: pickupCoordinates
          }));
        }, delay);
      }
    }
  }, [mapLoaded, currentLocation, pickupCoordinates, webViewError]);

  // 선택된 수거지가 변경되면 경로 업데이트
  useEffect(() => {
    if (mapLoaded && webViewRef.current && !webViewError) {
      if (selectedPickups && selectedPickups.length > 0) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'SHOW_ROUTE',
          locations: selectedPickups
        }));
      } else {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'CLEAR_ROUTE'
        }));
        setOptimizedRoute(null);
      }
    }
  }, [mapLoaded, selectedPickups, webViewError]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log('앱 상태 변화:', {
        from: appState,
        to: nextAppState,
        currentIndex: currentWaypointIndex,
        totalPickups: selectedPickups.length
      });

      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // 앱이 다시 활성화되었을 때
        if (currentWaypointIndex < selectedPickups.length) {
          console.log('수거 완료 확인 다이얼로그 표시 예정');
          // 약간의 지연 후 다이얼로그 표시 (앱 전환 완료 대기)
          setTimeout(() => {
            showCollectionConfirmDialog();
          }, 500);
        }
      }
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [appState, currentWaypointIndex, selectedPickups]);

  // 수거 완료 확인 다이얼로그
  const showCollectionConfirmDialog = () => {
    console.log('수거 완료 확인 다이얼로그 표시:', {
      currentIndex: currentWaypointIndex,
      totalPickups: selectedPickups.length
    });

    if (currentWaypointIndex >= selectedPickups.length) {
      console.log('모든 수거지 완료됨, 다이얼로그 표시하지 않음');
      return;
    }

    const currentDestination = selectedPickups[currentWaypointIndex];

    showModal({
      title: '수거 완료 확인',
      message: `${currentDestination?.name || `경유지 ${currentWaypointIndex + 1}`}에서 수거가 완료되었나요?`,
      type: 'default',
      buttons: [
        {
          text: '아니오',
          style: 'cancel',
          onPress: () => navigateToCurrentWaypoint()
        },
        {
          text: '완료',
          onPress: () => handleCollectionComplete()
        }
      ]
    });
  };

  // 수거 완료 처리 함수
  const handleCollectionComplete = () => {
    const nextIndex = currentWaypointIndex + 1;

    console.log('수거 완료 처리:', {
      currentIndex: currentWaypointIndex,
      nextIndex: nextIndex,
      totalPickups: selectedPickups.length
    });

    if (nextIndex < selectedPickups.length) {
      // 다음 경유지 정보 가져오기
      const nextDestination = selectedPickups[nextIndex];
      const distance = calculateDistanceToDestination(nextDestination);
      const estimatedTime = Math.round(distance * 2);

      showModal({
        title: '수거 완료',
        message: `${currentWaypointIndex + 1}번째 수거지 수거가 완료되었습니다.\n\n다음 수거지 정보:\n${nextDestination.name || `수거지 ${nextIndex + 1}`}\n${nextDestination.address || '주소 정보 없음'}\n거리: ${distance.toFixed(1)}km\n예상 소요시간: ${estimatedTime}분\n\n다음 목적지를 안내받으시겠습니까?`,
        type: 'success',
        buttons: [
          { text: '나중에', style: 'cancel', onPress: () => setCurrentWaypointIndex(nextIndex) },
          {
            text: '안내 시작',
            onPress: () => {
              setCurrentWaypointIndex(nextIndex);
              setTimeout(() => {
                startKakaoMapToDestination(nextDestination);
              }, 100);
            }
          }
        ]
      });
    } else {
      // 모든 경유지 완료
      showModal({
        title: '모든 수거 완료',
        message: '모든 경유지의 수거가 완료되었습니다!',
        type: 'success',
        buttons: [
          {
            text: '확인',
            onPress: () => {
              setCurrentWaypointIndex(0);
              if (typeof clearAllSelections === 'function') {
                clearAllSelections();
              }
            }
          }
        ]
      });
    }
  };

  // 카카오맵으로 직접 안내하는 함수 추가
  const startKakaoMapToDestination = async (destination) => {
    try {
      const startLat = currentLocation.latitude;
      const startLng = currentLocation.longitude;

      let kakaoMapUrl = `kakaomap://route?sp=${startLat},${startLng}`;
      kakaoMapUrl += `&ep=${destination.latitude},${destination.longitude}`;
      kakaoMapUrl += `&by=CAR&rpoption=RECOMMEND`;

      const supported = await Linking.canOpenURL(kakaoMapUrl);
      if (supported) {
        await Linking.openURL(kakaoMapUrl);
      } else {
        const storeUrl = Platform.OS === 'ios'
          ? 'https://apps.apple.com/kr/app/kakaomap/id304608425'
          : 'https://play.google.com/store/apps/details?id=net.daum.android.map';

        Alert.alert(
          '카카오맵 설치 필요',
          '카카오맵이 설치되어 있지 않습니다. 설치하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            { text: '설치', onPress: () => Linking.openURL(storeUrl) }
          ]
        );
      }
    } catch (error) {
      console.error('카카오맵 실행 오류:', error);
      Alert.alert('오류', '카카오맵을 실행할 수 없습니다: ' + error.message);
    }
  };

  // 현재 경유지로 내비게이션 시작
  const navigateToCurrentWaypoint = () => {
    console.log('navigateToCurrentWaypoint 호출됨');
    console.log('현재 경유지 인덱스:', currentWaypointIndex);
    console.log('전체 선택된 수거지:', selectedPickups?.length || 0);
    console.log('selectedPickups:', selectedPickups);

    if (!selectedPickups || selectedPickups.length === 0) {
      showModal({
        title: '오류',
        message: '선택된 수거지가 없습니다.',
        type: 'error',
        buttons: [
          { text: '확인', style: 'cancel' }
        ]
      });
      return;
    }

    if (currentWaypointIndex >= selectedPickups.length) {
      showModal({
        title: '알림',
        message: '모든 경유지를 완료했습니다.',
        type: 'success',
        buttons: [
          { text: '확인', style: 'cancel' }
        ]
      });
      return;
    }

    const currentDestination = selectedPickups[currentWaypointIndex];
    console.log('현재 목적지:', currentDestination);

    if (!currentDestination) {
      showModal({
        title: '오류',
        message: '유효한 경유지 정보를 찾을 수 없습니다.',
        type: 'error',
        buttons: [
          { text: '확인', style: 'cancel' }
        ]
      });
      return;
    }

    // 거리와 예상 시간 계산
    const distance = calculateDistanceToDestination(currentDestination);
    const estimatedTime = Math.round(distance * 2);

    console.log('계산된 거리:', distance, 'km');
    console.log('예상 시간:', estimatedTime, '분');

    showModal({
      title: '내비게이션 선택',
      message: `${currentWaypointIndex + 1}번째 수거지로 안내합니다.\n\n수거지 정보:\n${currentDestination.name || `수거지 ${currentWaypointIndex + 1}`}\n${currentDestination.address || '주소 정보 없음'}\n거리: ${distance.toFixed(1)}km\n예상 소요시간: ${estimatedTime}분`,
      type: 'default',
      buttons: [
        { text: '취소', style: 'cancel' },
        {
          text: '카카오맵으로 안내',
          onPress: () => {
            console.log('카카오맵으로 안내 버튼 클릭됨');
            startSingleDestinationNavi('kakaomap');
          }
        }
      ]
    });
  };

  // 단일 목적지용 다른 앱 선택
  const showOtherNavOptionsForSingle = () => {
    Alert.alert(
      '다른 내비게이션 앱',
      '사용할 앱을 선택해주세요.',
      [
        {
          text: '카카오맵',
          onPress: () => startSingleDestinationNavi('kakaomap')
        },
        {
          text: '네이버지도',
          onPress: () => startSingleDestinationNavi('naver')
        },
        {
          text: '티맵',
          onPress: () => startSingleDestinationNavi('tmap')
        },
        {
          text: '앱 내비게이션',
          onPress: () => startSingleDestinationNavi('app')
        },
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '뒤로',
          onPress: navigateToCurrentWaypoint
        }
      ]
    );
  };

  // 단일 목적지 내비게이션 실행
  const startSingleDestinationNavi = async (naviType) => {
    console.log('startSingleDestinationNavi 호출됨:', {
      naviType,
      currentIndex: currentWaypointIndex,
      totalPickups: selectedPickups?.length || 0
    });

    if (!selectedPickups || selectedPickups.length === 0) {
      console.log('오류: 선택된 수거지가 없음');
      showModal({
        title: '오류',
        message: '선택된 수거지가 없습니다.',
        type: 'error',
        buttons: [
          { text: '확인', style: 'cancel' }
        ]
      });
      return;
    }

    if (currentWaypointIndex >= selectedPickups.length) {
      console.log('오류: 유효한 경유지가 없음');
      showModal({
        title: '알림',
        message: '유효한 경유지가 없습니다.',
        type: 'warning',
        buttons: [
          { text: '확인', style: 'cancel' }
        ]
      });
      return;
    }

    const destination = selectedPickups[currentWaypointIndex];
    console.log('실제 안내할 목적지:', {
      index: currentWaypointIndex,
      destination: destination
    });

    if (!destination || !destination.latitude || !destination.longitude) {
      console.log('오류: 목적지 좌표 정보가 올바르지 않음');
      showModal({
        title: '오류',
        message: '목적지 좌표 정보가 올바르지 않습니다.',
        type: 'error',
        buttons: [
          { text: '확인', style: 'cancel' }
        ]
      });
      return;
    }

    const startLat = currentLocation.latitude;
    const startLng = currentLocation.longitude;

    console.log('내비게이션 시작 좌표:', {
      start: { lat: startLat, lng: startLng },
      destination: { lat: destination.latitude, lng: destination.longitude }
    });

    try {
      // 카카오맵만 지원
      if (naviType === 'kakaomap') {
        console.log('카카오맵 실행 시도');
        await executeSingleKakaoMap(destination, startLat, startLng);
      } else {
        throw new Error('지원하지 않는 내비게이션 타입입니다: ' + naviType);
      }
    } catch (error) {
      console.error('단일 목적지 내비게이션 오류:', error);
      showModal({
        title: '오류',
        message: '내비게이션을 실행할 수 없습니다: ' + error.message,
        type: 'error',
        buttons: [
          { text: '확인', style: 'cancel' }
        ]
      });
    }
  };

  // 단일 목적지용 카카오내비 URL 스키마
  const executeSingleKakaoNaviUrlScheme = async (destination, startLat, startLng) => {
    let naviUrl = `kakaonavi://navigate`;
    naviUrl += `?sp=${startLat},${startLng}`;
    naviUrl += `&ep=${destination.latitude},${destination.longitude}`;
    naviUrl += `&ename=${encodeURIComponent(destination.name || '목적지')}`;
    naviUrl += '&rpoption=0'; // 추천 경로
    naviUrl += '&coord_type=wgs84';
    naviUrl += '&vehicle_type=1';

    const supported = await Linking.canOpenURL(naviUrl);
    if (supported) {
      await Linking.openURL(naviUrl);
    } else {
      const storeUrl = Platform.OS === 'ios'
        ? 'https://apps.apple.com/kr/app/kakaonavi/id417698849'
        : 'https://play.google.com/store/apps/details?id=com.locnall.KimGiSa';

      Alert.alert(
        '카카오내비 설치 필요',
        '카카오내비가 설치되어 있지 않습니다. 설치하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '설치', onPress: () => Linking.openURL(storeUrl) }
        ]
      );
    }
  };

  // 단일 목적지용 카카오맵
  const executeSingleKakaoMap = async (destination, startLat, startLng) => {
    console.log('executeSingleKakaoMap 호출됨:', {
      destination: destination.name,
      startLat,
      startLng,
      destLat: destination.latitude,
      destLng: destination.longitude
    });

    try {
      let kakaoMapUrl = `kakaomap://route?sp=${startLat},${startLng}`;
      kakaoMapUrl += `&ep=${destination.latitude},${destination.longitude}`;
      kakaoMapUrl += `&by=CAR&rpoption=RECOMMEND`;

      console.log('생성된 카카오맵 URL:', kakaoMapUrl);

      const supported = await Linking.canOpenURL(kakaoMapUrl);
      console.log('카카오맵 URL 지원 여부:', supported);

      if (supported) {
        console.log('카카오맵 실행 시도');
        await Linking.openURL(kakaoMapUrl);
        console.log('카카오맵 실행 완료');
      } else {
        console.log('카카오맵이 설치되지 않음, 스토어로 이동');
        const storeUrl = Platform.OS === 'ios'
          ? 'https://apps.apple.com/kr/app/kakaomap/id304608425'
          : 'https://play.google.com/store/apps/details?id=net.daum.android.map';

        showModal({
          title: '카카오맵 설치 필요',
          message: '카카오맵이 설치되어 있지 않습니다. 설치하시겠습니까?',
          type: 'warning',
          buttons: [
            { text: '취소', style: 'cancel' },
            {
              text: '설치',
              onPress: () => {
                console.log('앱스토어로 이동');
                Linking.openURL(storeUrl);
              }
            }
          ]
        });
      }
    } catch (error) {
      console.error('카카오맵 실행 중 오류:', error);
      showModal({
        title: '오류',
        message: '카카오맵을 실행할 수 없습니다: ' + error.message,
        type: 'error',
        buttons: [
          { text: '확인', style: 'cancel' }
        ]
      });
    }
  };

  // 단일 목적지용 네이버지도
  const executeSingleNaverMap = async (destination, startLat, startLng) => {
    const appName = Platform.OS === 'ios' ? 'driver' : 'driver';
    const destName = encodeURIComponent(destination.name || '목적지');

    let naverMapUrl = `nmap://route/car`;
    naverMapUrl += `?slat=${startLat}&slng=${startLng}&sname=현재위치`;
    naverMapUrl += `&dlat=${destination.latitude}&dlng=${destination.longitude}&dname=${destName}`;
    naverMapUrl += `&appname=${appName}`;

    const supported = await Linking.canOpenURL(naverMapUrl);
    if (supported) {
      await Linking.openURL(naverMapUrl);
    } else {
      const storeUrl = Platform.OS === 'ios'
        ? 'https://apps.apple.com/kr/app/naver-map-navigation/id311867728'
        : 'https://play.google.com/store/apps/details?id=com.nhn.android.nmap';

      Alert.alert(
        '네이버지도 설치 필요',
        '네이버지도가 설치되어 있지 않습니다. 설치하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '설치', onPress: () => Linking.openURL(storeUrl) }
        ]
      );
    }
  };

  // 단일 목적지용 티맵
  const executeSingleTMap = async (destination, startLat, startLng) => {
    const destName = encodeURIComponent(destination.name || '목적지');

    let tmapUrl = `tmap://route`;
    tmapUrl += `?rGoName=${destName}`;
    tmapUrl += `&rGoX=${destination.longitude}`;
    tmapUrl += `&rGoY=${destination.latitude}`;

    const supported = await Linking.canOpenURL(tmapUrl);
    if (supported) {
      await Linking.openURL(tmapUrl);
    } else {
      const storeUrl = Platform.OS === 'ios'
        ? 'https://apps.apple.com/kr/app/tmap/id431589174'
        : 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku';

      Alert.alert(
        '티맵 설치 필요',
        '티맵이 설치되어 있지 않습니다. 설치하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '설치', onPress: () => Linking.openURL(storeUrl) }
        ]
      );
    }
  };

  // 단일 목적지용 앱 내비게이션
  const startSingleAppNavigation = (destination) => {
    if (navigation) {
      navigation.navigate('Navigation', {
        origin: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        },
        destination: {
          latitude: destination.latitude,
          longitude: destination.longitude,
          name: destination.name || "목적지"
        },
        waypoints: [] // 단일 목적지이므로 경유지 없음
      });
    } else {
      throw new Error('네비게이션 객체를 찾을 수 없습니다.');
    }
  };

  // 카카오내비 URL 스키마 실행 함수 (경유지 지원)
  const startKakaoNaviApp = async () => {
    try {
      if (!selectedPickups || selectedPickups.length === 0) {
        Alert.alert('알림', '내비게이션을 시작하려면 최소 한 개의 수거지를 선택해주세요.');
        return;
      }
      
      // 경로 옵션 선택 다이얼로그
      Alert.alert(
        '경로 옵션 선택',
        '어떤 경로로 안내받으시겠습니까?',
        [
          {
            text: '추천 경로',
            onPress: () => executeKakaoNaviUrlScheme('RECOMMEND')
          },
          {
            text: '최단시간',
            onPress: () => executeKakaoNaviUrlScheme('TIME')
          },
          {
            text: '최단거리',
            onPress: () => executeKakaoNaviUrlScheme('DISTANCE')
          },
          {
            text: '취소',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('카카오내비 옵션 선택 오류:', error);
      Alert.alert('오류', '카카오내비 옵션을 선택할 수 없습니다.');
    }
  };

  // 카카오내비 URL 스키마 실행 (경유지 지원)
  const executeKakaoNaviUrlScheme = async (routeOption) => {
    try {
      const destination = selectedPickups[selectedPickups.length - 1];
      const waypoints = selectedPickups.slice(0, -1);
      
      const startLat = currentLocation.latitude;
      const startLng = currentLocation.longitude;
      
      let naviUrl = `kakaonavi://navigate`;
      naviUrl += `?sp=${startLat},${startLng}`;
      naviUrl += `&ep=${destination.latitude},${destination.longitude}`;
      naviUrl += `&ename=${encodeURIComponent(destination.name || '목적지')}`;
      
      if (waypoints.length > 0) {
        const viaParams = waypoints.slice(0, 5).map((point, index) => {
          const name = encodeURIComponent(point.name || `경유지${index + 1}`);
          return `${point.latitude},${point.longitude},${name}`;
        }).join('|');
        naviUrl += `&via=${viaParams}`;
      }
      
      switch(routeOption) {
        case 'RECOMMEND':
          naviUrl += '&rpoption=0';
          break;
        case 'TIME':
          naviUrl += '&rpoption=1';
          break;
        case 'DISTANCE':
          naviUrl += '&rpoption=2';
          break;
        default:
          naviUrl += '&rpoption=0';
      }
      
      naviUrl += '&coord_type=wgs84';
      naviUrl += '&vehicle_type=1';
      
      console.log('카카오내비 URL 스키마:', naviUrl);
      
      const supported = await Linking.canOpenURL(naviUrl);
      if (supported) {
        await Linking.openURL(naviUrl);
      } else {
        const storeUrl = Platform.OS === 'ios' 
          ? 'https://apps.apple.com/kr/app/kakaonavi/id417698849'
          : 'https://play.google.com/store/apps/details?id=com.locnall.KimGiSa';
        
        Alert.alert(
          '카카오내비 설치 필요',
          '카카오내비가 설치되어 있지 않습니다. 설치하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            { text: '설치', onPress: () => Linking.openURL(storeUrl) }
          ]
        );
      }
    } catch (error) {
      console.error('URL 스키마 실행 오류:', error);
      Alert.alert('오류', '카카오내비를 실행할 수 없습니다: ' + error.message);
    }
  };

  // 카카오내비 JavaScript SDK 실행 함수 (목적지만 지원 - 웹 길안내 종료에 따른 제한)
  const startKakaoNaviJS = async () => {
    try {
      if (!selectedPickups || selectedPickups.length === 0) {
        Alert.alert('알림', '내비게이션을 시작하려면 최소 한 개의 수거지를 선택해주세요.');
        return;
      }
      
      // 웹 길안내 서비스 종료 안내
      Alert.alert(
        '카카오내비 JavaScript SDK 안내',
        '카카오내비 웹 길안내 서비스가 종료되어 JavaScript SDK는 앱 설치 페이지로만 이동합니다.\n\n경유지 안내가 필요하시면 URL 스키마 방식을 사용하시겠습니까?',
        [
          {
            text: 'URL 스키마 사용 (경유지 지원)',
            onPress: startKakaoNaviApp
          },
          {
            text: '그래도 계속 (설치 페이지로 이동)',
            onPress: () => executeKakaoNaviJS()
          },
          {
            text: '취소',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('카카오내비 JS SDK 옵션 선택 오류:', error);
      Alert.alert('오류', '카카오내비 옵션을 선택할 수 없습니다.');
    }
  };

  // 카카오내비 JavaScript SDK 실행 (웹 길안내 종료에 따라 설치 페이지로만 이동)
  const executeKakaoNaviJS = async () => {
    try {
      const destination = selectedPickups[selectedPickups.length - 1];
      
      // WebView에서 Kakao.Navi.start() 실행 (공지사항에 따라 수정)
      const kakaoNaviScript = `
        (function() {
          try {
            // Kakao SDK 초기화 확인
            if (typeof Kakao === 'undefined') {
              console.error('Kakao SDK가 로드되지 않았습니다');
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'KAKAONAVI_ERROR',
                message: 'Kakao SDK가 로드되지 않았습니다'
              }));
              return;
            }
            
            if (!Kakao.isInitialized()) {
              Kakao.init('30a7f8ffd1d5af779f063d9fa779b8b4');
            }
            
            // 카카오내비 실행 파라미터 (공지사항에 따라 단순화)
            const naviParams = {
              name: '${destination.name || '목적지'}',
              x: ${destination.longitude},
              y: ${destination.latitude},
              coordType: 'wgs84'
            };
            
            console.log('카카오내비 실행 파라미터 (JS SDK):', naviParams);
            
            // 카카오내비 실행 (웹 길안내 종료로 인해 설치 페이지로 이동)
            Kakao.Navi.start(naviParams);
            
            console.log('카카오내비 실행 성공 (설치 페이지로 이동)');
            
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'KAKAONAVI_SUCCESS',
              message: '카카오내비 설치 페이지로 이동'
            }));
            
          } catch (error) {
            console.error('카카오내비 실행 오류:', error);
            // React Native로 오류 전송
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'KAKAONAVI_ERROR',
              message: error.message
            }));
          }
        })();
        true;
      `;
      
      // WebView에서 스크립트 실행
      if (webViewRef.current && mapLoaded) {
        webViewRef.current.injectJavaScript(kakaoNaviScript);
      } else {
        throw new Error('지도가 로드되지 않았습니다');
      }
      
    } catch (error) {
      console.error('카카오내비 JS SDK 실행 오류:', error);
      // 대체 방안으로 URL 스키마 사용
      await executeKakaoNaviUrlScheme('RECOMMEND');
    }
  };

  // 카카오맵 실행 함수
  const startKakaoMap = async (routeOption = null) => {
    try {
      if (!selectedPickups || selectedPickups.length === 0) {
        Alert.alert('알림', '내비게이션을 시작하려면 최소 한 개의 수거지를 선택해주세요.');
        return;
      }
      
      // 경유지가 있는 경우 사용자에게 안내
      if (selectedPickups.length > 1) {
        Alert.alert(
          '카카오맵 제한사항',
          '카카오맵은 경유지를 지원하지 않습니다.\n마지막 수거지로만 안내됩니다.\n\n경유지 안내가 필요하시면 카카오내비를 사용해주세요.',
          [
            {
              text: '카카오내비 사용',
              onPress: startKakaoNaviApp
            },
            {
              text: '그래도 계속',
              onPress: () => proceedWithKakaoMap(routeOption || 'RECOMMEND')
            },
            {
              text: '취소',
              style: 'cancel'
            }
          ]
        );
        return;
      }
      
      proceedWithKakaoMap(routeOption || 'RECOMMEND');
    } catch (error) {
      console.error('카카오맵 옵션 선택 오류:', error);
      Alert.alert('오류', '카카오맵 옵션을 선택할 수 없습니다.');
    }
  };

  // 카카오맵 실행 함수 (목적지만)
  const proceedWithKakaoMap = async (routeOption) => {
    try {
      const startLat = currentLocation.latitude;
      const startLng = currentLocation.longitude;
      const destination = selectedPickups[selectedPickups.length - 1];
      
      let kakaoMapUrl = `kakaomap://route?sp=${startLat},${startLng}`;
      kakaoMapUrl += `&ep=${destination.latitude},${destination.longitude}`;
      kakaoMapUrl += `&by=CAR`;
      
      switch(routeOption) {
        case 'RECOMMEND':
          kakaoMapUrl += '&rpoption=RECOMMEND';
          break;
        case 'TIME':
          kakaoMapUrl += '&rpoption=TIME';
          break;
        case 'DISTANCE':
          kakaoMapUrl += '&rpoption=DISTANCE';
          break;
        default:
          kakaoMapUrl += '&rpoption=RECOMMEND';
      }
      
      console.log('카카오맵 URL (목적지만):', kakaoMapUrl);
      
      const supported = await Linking.canOpenURL(kakaoMapUrl);
      if (supported) {
        await Linking.openURL(kakaoMapUrl);
      } else {
        const storeUrl = Platform.OS === 'ios' 
          ? 'https://apps.apple.com/kr/app/kakaomap/id304608425'
          : 'https://play.google.com/store/apps/details?id=net.daum.android.map';
        
        Alert.alert(
          '카카오맵 설치 필요',
          '카카오맵이 설치되어 있지 않습니다. 설치하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            { text: '설치', onPress: () => Linking.openURL(storeUrl) }
          ]
        );
      }
    } catch (error) {
      console.error('카카오맵 실행 오류:', error);
      Alert.alert('오류', '카카오맵을 실행할 수 없습니다: ' + error.message);
    }
  };

  // 앱 내 네비게이션 실행 함수
  const startAppNavigation = () => {
    try {
      if (!selectedPickups || selectedPickups.length === 0) {
        Alert.alert('알림', '내비게이션을 시작하려면 최소 한 개의 수거지를 선택해주세요.');
        return;
      }
      
      if (navigation) {
        navigation.navigate('Navigation', { 
          origin: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude
          },
          destination: {
            latitude: selectedPickups[selectedPickups.length - 1].latitude,
            longitude: selectedPickups[selectedPickups.length - 1].longitude,
            name: selectedPickups[selectedPickups.length - 1].name || "목적지"
          },
          waypoints: selectedPickups.slice(0, -1).map(point => ({
            latitude: point.latitude,
            longitude: point.longitude,
            name: point.name,
            id: point.id
          }))
        });
      } else {
        throw new Error('네비게이션 객체를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('앱 내비게이션 실행 오류:', error);
      Alert.alert('오류', '앱 내비게이션을 실행할 수 없습니다: ' + error.message);
    }
  };

  // 네이버지도 URL 스키마 실행 함수 (실제 앱 연결)
// 네이버지도 URL 스키마 실행 함수 수정
// 네이버지도 URL 스키마 실행 함수 수정 (appname 추가)
const executeNaverMap = async () => {
  try {
    const startLat = currentLocation.latitude;
    const startLng = currentLocation.longitude;
    const destination = selectedPickups[selectedPickups.length - 1];
    const destName = encodeURIComponent(destination.name || '목적지');
    
    // 앱 이름 설정 (expo 설정에 맞게)
    const appName = Platform.OS === 'ios' 
      ? 'driver' // iOS 번들 ID (expo.name 사용)
      : 'driver'; // Android 패키지명 (expo.name 사용)
    
    // 네이버지도 URL 스키마 (appname 필수 추가)
    let naverMapUrl = `nmap://route/car`;
    naverMapUrl += `?slat=${startLat}&slng=${startLng}&sname=현재위치`;
    naverMapUrl += `&dlat=${destination.latitude}&dlng=${destination.longitude}&dname=${destName}`;
    
    // 경유지 추가 (최대 5개)
    const waypoints = selectedPickups.slice(0, -1);
    if (waypoints.length > 0) {
      waypoints.slice(0, 5).forEach((point, index) => {
        const name = encodeURIComponent(point.name || `경유지${index + 1}`);
        naverMapUrl += `&v${index + 1}lat=${point.latitude}&v${index + 1}lng=${point.longitude}&v${index + 1}name=${name}`;
      });
    }
    
    // 필수 appname 파라미터 추가
    naverMapUrl += `&appname=${appName}`;
    
    console.log('네이버지도 URL (appname 포함):', naverMapUrl);
    
    // 실제 앱 실행 시도
    const supported = await Linking.canOpenURL(naverMapUrl);
    if (supported) {
      await Linking.openURL(naverMapUrl);
    } else {
      // 대체 스키마들도 appname 포함하여 시도
      await tryAlternativeNaverSchemes(appName);
    }
  } catch (error) {
    console.error('네이버지도 실행 오류:', error);
    await tryAlternativeNaverSchemes(appName);
  }
};

// 대체 네이버지도 URL 스키마 시도 (appname 포함)
const tryAlternativeNaverSchemes = async (appName) => {
  try {
    const destination = selectedPickups[selectedPickups.length - 1];
    const destName = encodeURIComponent(destination.name || '목적지');
    
    // 대체 URL 스키마들 (모두 appname 포함)
    const alternativeSchemes = [
      // 네이버지도 기본 스키마
      `navermap://route?dlat=${destination.latitude}&dlng=${destination.longitude}&dname=${destName}&appname=${appName}`,
      
      // 네이버지도 검색 스키마
      `navermap://search?query=${destName}&appname=${appName}`,
      
      // 네이버지도 장소 스키마
      `navermap://place?lat=${destination.latitude}&lng=${destination.longitude}&name=${destName}&appname=${appName}`,
      
      // 구 버전 스키마
      `nmap://map?lat=${destination.latitude}&lng=${destination.longitude}&name=${destName}&appname=${appName}`
    ];
    
    // 각 스키마를 순차적으로 시도
    for (const scheme of alternativeSchemes) {
      console.log('시도하는 URL (appname 포함):', scheme);
      const supported = await Linking.canOpenURL(scheme);
      if (supported) {
        await Linking.openURL(scheme);
        return; // 성공하면 종료
      }
    }
    
    // 모든 스키마 실패 시 스토어로 이동
    throw new Error('모든 네이버지도 URL 스키마 실행 실패');
    
  } catch (error) {
    console.error('대체 스키마 실행 오류:', error);
    
    // 정확한 패키지명으로 스토어 이동
    const storeUrl = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/kr/app/naver-map-navigation/id311867728'
      : 'https://play.google.com/store/apps/details?id=com.nhn.android.nmap';
    
    Alert.alert(
      '네이버지도 실행 실패',
      '네이버지도를 실행할 수 없습니다.\n앱이 최신 버전인지 확인하거나 재설치해주세요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '스토어로 이동', onPress: () => Linking.openURL(storeUrl) }
      ]
    );
  }
};



  // 티맵 URL 스키마 실행 함수 (실제 앱 연결)
const executeTMap = async () => {
  try {
    const destination = selectedPickups[selectedPickups.length - 1];
    const destName = encodeURIComponent(destination.name || '목적지');
    
    // 티맵 URL 스키마 (실제 앱 실행)
    let tmapUrl = `tmap://route`;
    tmapUrl += `?rGoName=${destName}`;
    tmapUrl += `&rGoX=${destination.longitude}`;
    tmapUrl += `&rGoY=${destination.latitude}`;
    
    console.log('티맵 URL:', tmapUrl);
    
    // 실제 앱 실행
    const supported = await Linking.canOpenURL(tmapUrl);
    if (supported) {
      await Linking.openURL(tmapUrl);
    } else {
      // 앱이 설치되지 않은 경우 스토어로 이동
      const storeUrl = Platform.OS === 'ios' 
        ? 'https://apps.apple.com/kr/app/tmap/id431589174'
        : 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku';
      
      Alert.alert(
        '티맵 설치 필요',
        '티맵이 설치되어 있지 않습니다. 설치하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '설치', onPress: () => Linking.openURL(storeUrl) }
        ]
      );
    }
  } catch (error) {
    console.error('티맵 실행 오류:', error);
    Alert.alert('오류', '티맵을 실행할 수 없습니다: ' + error.message);
  }
};


  // 네비게이션 선택 다이얼로그 표시 (공지사항에 따라 수정)
// 최종 권장 방안
  const startNavigation = () => {
    console.log('startNavigation 호출됨');
    console.log('selectedPickups:', selectedPickups);
    console.log('selectedPickups 길이:', selectedPickups?.length || 0);

    if (!selectedPickups || selectedPickups.length === 0) {
      console.log('선택된 수거지가 없음');
      showModal({
        title: '알림',
        message: '내비게이션을 시작하려면 최소 한 개의 수거지를 선택해주세요.',
        type: 'warning',
        buttons: [
          { text: '확인', style: 'cancel' }
        ]
      });
      return;
    }

    // 현재 경유지 인덱스 초기화
    console.log('경유지 인덱스 초기화: 0');
    setCurrentWaypointIndex(0);

    // 첫 번째 수거지 정보 가져오기
    const firstDestination = selectedPickups[0];
    console.log('첫 번째 수거지:', firstDestination);

    if (!firstDestination) {
      console.log('첫 번째 수거지 정보가 없음');
      showModal({
        title: '오류',
        message: '첫 번째 수거지 정보를 찾을 수 없습니다.',
        type: 'error',
        buttons: [
          { text: '확인', style: 'cancel' }
        ]
      });
      return;
    }

    const distance = calculateDistanceToDestination(firstDestination);
    const estimatedTime = Math.round(distance * 2);

    console.log('첫 번째 수거지 거리:', distance, 'km');
    console.log('예상 시간:', estimatedTime, '분');

    showModal({
      title: '내비게이션 시작',
      message: `${selectedPickups.length}개의 수거지를 순서대로 안내합니다.\n\n첫 번째 수거지:\n${firstDestination.name || '수거지 1'}\n${firstDestination.address || '주소 정보 없음'}\n거리: ${distance.toFixed(1)}km\n예상 소요시간: ${estimatedTime}분\n\n첫 번째 목적지부터 시작하시겠습니까?`,
      type: 'default',
      buttons: [
        { text: '취소', style: 'cancel' },
        {
          text: '단계별 안내 시작',
          onPress: () => {
            console.log('단계별 안내 시작 버튼 클릭됨');
            // 상태 업데이트 후 약간의 지연을 두고 실행
            setTimeout(() => {
              navigateToCurrentWaypoint();
            }, 100);
          }
        }
      ]
    });
  };

  // 거리 계산 함수 추가
  const calculateDistanceToDestination = (destination) => {
    try {
      if (!destination || !destination.latitude || !destination.longitude) {
        console.warn('목적지 정보가 올바르지 않음:', destination);
        return 0;
      }

      if (!currentLocation || !currentLocation.latitude || !currentLocation.longitude) {
        console.warn('현재 위치 정보가 올바르지 않음:', currentLocation);
        return 0;
      }

      const R = 6371; // 지구 반지름 (km)
      const dLat = (destination.latitude - currentLocation.latitude) * Math.PI / 180;
      const dLng = (destination.longitude - currentLocation.longitude) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(currentLocation.latitude * Math.PI / 180) * Math.cos(destination.latitude * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      console.log('거리 계산 결과:', distance, 'km');
      return distance;
    } catch (error) {
      console.error('거리 계산 오류:', error);
      return 0;
    }
  };

  const startMultipleNavigation = () => {
    Alert.alert(
      '내비게이션 선택',
      `${selectedPickups.length}개의 수거지로 전체 경로 안내합니다.`,
      [
        {
          text: '카카오내비 (추천)',
          onPress: startKakaoNaviApp
        },
        {
          text: '다른 앱 선택',
          onPress: showOtherNavOptions
        },
        {
          text: '취소',
          style: 'cancel'
        }
      ]
    );
  };

  const showOtherNavOptions = () => {
    Alert.alert(
      '다른 내비게이션 앱',
      '사용할 앱을 선택해주세요.',
      [
        {
          text: '카카오맵',
          onPress: startKakaoMap
        },
        {
          text: '네이버지도',
          onPress: executeNaverMap
        },
        {
          text: '티맵',
          onPress: executeTMap
        },
        {
          text: '앱 내비게이션',
          onPress: startAppNavigation
        },
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '뒤로',
          onPress: startNavigation
        }
      ]
    );
  };


  // 지도 HTML 생성 (최신 JavaScript SDK 사용)
  const generateMapHTML = () => {
    const isAndroid = Platform.OS === 'android';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            html, body { 
              width: 100%; 
              height: 100%; 
              overflow: hidden;
              ${isAndroid ? 'touch-action: manipulation;' : ''}
            }
            #map { 
              width: 100%; 
              height: 100vh; 
              background-color: #f5f5f5;
              ${isAndroid ? 'position: fixed; top: 0; left: 0;' : ''}
            }
            .custom-overlay {
              position: relative;
              background: #fff;
              border: 2px solid #007AFF;
              border-radius: 8px;
              padding: 6px 12px;
              font-size: 12px;
              font-weight: bold;
              color: #007AFF;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              white-space: nowrap;
              ${isAndroid ? 'transform: translateZ(0);' : ''}
            }
            .custom-overlay:after {
              content: '';
              position: absolute;
              bottom: -8px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 8px solid transparent;
              border-right: 8px solid transparent;
              border-top: 8px solid #007AFF;
            }
            .current-location-overlay {
              position: relative;
              background: #3B88C3;
              color: white;
              border-radius: 8px;
              padding: 6px 12px;
              font-size: 12px;
              font-weight: bold;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              ${isAndroid ? 'transform: translateZ(0);' : ''}
            }
            .route-info {
              position: absolute;
              bottom: 20px;
              left: 50%;
              transform: translateX(-50%);
              background-color: #5c8d62;
              color: white;
              padding: 10px 15px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: bold;
              box-shadow: 0 2px 5px rgba(0,0,0,0.2);
              z-index: 100;
              display: none;
            }
            .route-options {
              position: absolute;
              top: 15px;
              left: 50%;
              transform: translateX(-50%);
              background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
              backdrop-filter: blur(10px);
              -webkit-backdrop-filter: blur(10px);
              border-radius: 16px;
              box-shadow: 0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.05);
              padding: 12px 16px;
              display: flex;
              align-items: center;
              z-index: 100;
              border: 1px solid rgba(255,255,255,0.2);
              min-width: 300px;
              justify-content: center;
            }
            .option-label {
              font-size: 13px;
              font-weight: 600;
              color: #374151;
              margin-right: 12px;
              letter-spacing: -0.2px;
            }
            .option-buttons {
              display: flex;
              background: rgba(243, 244, 246, 0.8);
              border-radius: 12px;
              padding: 3px;
              gap: 2px;
            }
            .option-button {
              border: none;
              background: transparent;
              padding: 8px 14px;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
              border-radius: 9px;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              color: #6B7280;
              position: relative;
              overflow: hidden;
              min-width: 60px;
              text-align: center;
            }
            .option-button:hover {
              color: #374151;
              transform: translateY(-1px);
            }
            .option-button.active {
              background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
              color: white;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3), 0 2px 4px rgba(59, 130, 246, 0.2);
              transform: translateY(-1px);
            }
            #optRecommend.active {
              background: linear-gradient(135deg, #10B981 0%, #059669 100%);
              box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3), 0 2px 4px rgba(16, 185, 129, 0.2);
            }
            #optTime.active {
              background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
              box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3), 0 2px 4px rgba(245, 158, 11, 0.2);
            }
            #optDistance.active {
              background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
              box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3), 0 2px 4px rgba(239, 68, 68, 0.2);
            }
            @media (max-width: 480px) {
              .route-options {
                min-width: 280px;
                padding: 10px 14px;
              }
              .option-label {
                font-size: 12px;
                margin-right: 10px;
              }
              .option-button {
                padding: 7px 12px;
                font-size: 11px;
                min-width: 55px;
              }
            }
            .loading-indicator {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background-color: rgba(0, 0, 0, 0.7);
              color: white;
              padding: 15px 20px;
              border-radius: 10px;
              font-size: 14px;
              display: none;
              z-index: 1000;
            }
          </style>
          <!-- 최신 카카오 JavaScript SDK 사용 (공지사항에 따라) -->
          <script src="https://developers.kakao.com/sdk/js/kakao.js"></script>
          <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=30a7f8ffd1d5af779f063d9fa779b8b4&libraries=services&autoload=false"></script>
        </head>
        <body>
          <div id="map"></div>
          <div id="routeInfo" class="route-info">경로 정보 로딩 중...</div>
          <div id="routeOptions" class="route-options">
            <div class="option-label">경로 옵션:</div>
            <div class="option-buttons">
              <button id="optRecommend" class="option-button active">추천</button>
              <button id="optTime" class="option-button">최단시간</button>
              <button id="optDistance" class="option-button">최단거리</button>
            </div>
          </div>
          <div id="loadingIndicator" class="loading-indicator">경로 계산 중...</div>
          
          <script>
            window.onerror = function(message, source, lineno, colno, error) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'ERROR',
                message: message
              }));
              return true;
            };
            
            var map;
            var currentMarker;
            var pickupMarkers = [];
            var pickupOverlays = [];
            var polylines = [];
            
            window.currentRouteOption = 'RECOMMEND';
            window.currentRouteLocations = [];
            
            // Kakao SDK 초기화 (공지사항에 따라 최신 버전 사용)
            if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
              Kakao.init('30a7f8ffd1d5af779f063d9fa779b8b4');
              console.log('Kakao SDK 초기화 완료 (최신 버전)');
            }
            
            ${isAndroid ? 'setTimeout(() => {' : ''}
            kakao.maps.load(function() {
              console.log('카카오맵 로드 완료');
              initMap();
            });
            ${isAndroid ? '}, 100);' : ''}
            
            function initMap() {
              try {
                var mapContainer = document.getElementById('map');
                var mapOptions = {
                  center: new kakao.maps.LatLng(${currentLocation.latitude}, ${currentLocation.longitude}),
                  level: 5,
                  draggable: true,
                  scrollwheel: true,
                  disableDoubleClick: false,
                  disableDoubleClickZoom: false,
                  keyboardShortcuts: false
                };
                
                map = new kakao.maps.Map(mapContainer, mapOptions);
                
                currentMarker = new kakao.maps.Marker({
                  position: new kakao.maps.LatLng(${currentLocation.latitude}, ${currentLocation.longitude}),
                  image: new kakao.maps.MarkerImage(
                    'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
                    new kakao.maps.Size(24, 35)
                  ),
                  zIndex: 10
                });
                currentMarker.setMap(map);
                
                var currentOverlay = new kakao.maps.CustomOverlay({
                  position: new kakao.maps.LatLng(${currentLocation.latitude}, ${currentLocation.longitude}),
                  content: '<div class="current-location-overlay">현재 위치</div>',
                  yAnchor: 1.5,
                  zIndex: 11
                });
                currentOverlay.setMap(map);
                
                setupRouteOptions();
                
                ${isAndroid ? `
                setTimeout(() => {
                  map.relayout();
                  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'MAP_READY'
                  }));
                }, 300);
                ` : `
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'MAP_READY'
                }));
                `}
                
              } catch (error) {
                console.log('지도 초기화 오류:', error);
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ERROR',
                  message: '지도 초기화 오류: ' + error.message
                }));
              }
            }
            
            function setupRouteOptions() {
              document.getElementById('optRecommend').addEventListener('click', function() {
                setRouteOption('RECOMMEND');
              });
              
              document.getElementById('optTime').addEventListener('click', function() {
                setRouteOption('TIME');
              });
              
              document.getElementById('optDistance').addEventListener('click', function() {
                setRouteOption('DISTANCE');
              });
            }
            
            function setRouteOption(option) {
              document.querySelectorAll('.option-button').forEach(btn => {
                btn.classList.remove('active');
              });
              
              let activeBtn;
              switch(option) {
                case 'RECOMMEND':
                  activeBtn = document.getElementById('optRecommend');
                  break;
                case 'TIME':
                  activeBtn = document.getElementById('optTime');
                  break;
                case 'DISTANCE':
                  activeBtn = document.getElementById('optDistance');
                  break;
              }
              
              if (activeBtn) activeBtn.classList.add('active');
              
              window.currentRouteOption = option;
              
              if (window.currentRouteLocations && window.currentRouteLocations.length > 0) {
                showRoute(window.currentRouteLocations);
              }
            }
            
            function addPickupMarkers(locations) {
              try {
                clearPickupMarkers();
                
                if (!locations || locations.length === 0) return;
                
                var bounds = new kakao.maps.LatLngBounds();
                bounds.extend(currentMarker.getPosition());
                
                const delay = ${isAndroid ? '100' : '0'};
                
                setTimeout(() => {
                  locations.forEach(function(loc, index) {
                    if (!loc.latitude || !loc.longitude || 
                        isNaN(loc.latitude) || isNaN(loc.longitude)) {
                      return;
                    }
                    
                    var position = new kakao.maps.LatLng(
                      parseFloat(loc.latitude), 
                      parseFloat(loc.longitude)
                    );
                    bounds.extend(position);
                    
                    var marker = new kakao.maps.Marker({
                      position: position,
                      map: map,
                      clickable: true,
                      zIndex: 5
                    });
                    
                    pickupMarkers.push(marker);
                    
                    kakao.maps.event.addListener(marker, 'click', function() {
                      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'MARKER_CLICKED',
                        id: loc.id,
                        index: index
                      }));
                    });
                    
                    var overlayContent = '<div class="custom-overlay">수거지 ' + (index + 1) + '</div>';
                    
                    var overlay = new kakao.maps.CustomOverlay({
                      position: position,
                      content: overlayContent,
                      yAnchor: 1.5,
                      zIndex: 6
                    });
                    
                    overlay.setMap(map);
                    pickupOverlays.push(overlay);
                  });
                  
                  setTimeout(() => {
                    map.setBounds(bounds);
                  }, ${isAndroid ? '200' : '50'});
                  
                }, delay);
                
              } catch (error) {
                console.log('수거지 마커 추가 오류:', error);
              }
            }
            
            function clearPickupMarkers() {
              pickupMarkers.forEach(function(marker) {
                marker.setMap(null);
              });
              pickupMarkers = [];
              
              pickupOverlays.forEach(function(overlay) {
                overlay.setMap(null);
              });
              pickupOverlays = [];
            }
            
            async function fetchRouteWithKakaoMobility(origin, waypoints, destination) {
              try {
                const REST_API_KEY = '90fc3c147a2997ec441fd2cd8e87e2a8';
                
                const originObj = {
                  x: origin.getLng().toString(),
                  y: origin.getLat().toString()
                };
                
                const destinationObj = {
                  x: destination.getLng().toString(),
                  y: destination.getLat().toString()
                };
                
                const waypointsArr = waypoints.map(point => ({
                  x: point.getLng().toString(),
                  y: point.getLat().toString()
                }));
                
                const requestData = {
                  origin: originObj,
                  destination: destinationObj,
                  waypoints: waypointsArr,
                  priority: window.currentRouteOption,
                  car_fuel: 'GASOLINE',
                  alternatives: false,
                  road_details: true
                };
                
                const response = await fetch('https://apis-navi.kakaomobility.com/v1/waypoints/directions', {
                  method: 'POST',
                  headers: {
                    'Authorization': \`KakaoAK \${REST_API_KEY}\`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(requestData)
                });
                
                if (!response.ok) {
                  throw new Error(\`API 호출 실패: \${response.status}\`);
                }
                
                const data = await response.json();
                return data;
              } catch (error) {
                console.error('카카오 모빌리티 API 호출 오류:', error);
                return null;
              }
            }
            
            async function showRoute(locations) {
              try {
                document.getElementById('loadingIndicator').style.display = 'block';
                
                window.currentRouteLocations = locations;
                
                clearPolylines();
                
                if (!locations || locations.length === 0) {
                  document.getElementById('routeInfo').style.display = 'none';
                  document.getElementById('loadingIndicator').style.display = 'none';
                  return;
                }
                
                var points = [];
                const origin = currentMarker.getPosition();
                points.push(origin);
                
                var waypoints = [];
                
                locations.forEach(function(loc, index) {
                  if (index < locations.length - 1) {
                    waypoints.push(new kakao.maps.LatLng(loc.latitude, loc.longitude));
                  } else {
                    points.push(new kakao.maps.LatLng(loc.latitude, loc.longitude));
                  }
                });
                
                waypoints.forEach(wp => points.push(wp));
                
                const destination = locations.length > 0 
                  ? new kakao.maps.LatLng(locations[locations.length - 1].latitude, locations[locations.length - 1].longitude)
                  : origin;
                
                const routeData = await fetchRouteWithKakaoMobility(origin, waypoints, destination);
                
                document.getElementById('loadingIndicator').style.display = 'none';
                
                if (!routeData || !routeData.routes || routeData.routes.length === 0) {
                  throw new Error('경로 데이터를 받아오지 못했습니다.');
                }
                
                const route = routeData.routes[0];
                
                const totalDistance = route.summary.distance;
                const totalDuration = route.summary.duration;
                
                const pathCoordinates = [];
                
                route.sections.forEach(section => {
                  section.roads.forEach(road => {
                    road.vertexes.forEach((vertex, i) => {
                      if (i % 2 === 0 && i + 1 < road.vertexes.length) {
                        const lat = road.vertexes[i + 1];
                        const lng = road.vertexes[i];
                        pathCoordinates.push(new kakao.maps.LatLng(lat, lng));
                      }
                    });
                  });
                });
                
                const polyline = new kakao.maps.Polyline({
                  path: pathCoordinates,
                  strokeWeight: 5,
                  strokeColor: '#4B89DC',
                  strokeOpacity: 0.8,
                  strokeStyle: 'solid'
                });
                
                polyline.setMap(map);
                polylines.push(polyline);
                
                var routeInfoElement = document.getElementById('routeInfo');
                routeInfoElement.textContent = \`총 거리: \${(totalDistance / 1000).toFixed(1)}km, 예상 시간: \${Math.round(totalDuration / 60)}분\`;
                routeInfoElement.style.display = 'block';
                
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ROUTE_INFO',
                  distance: totalDistance,
                  duration: totalDuration,
                  viaCount: waypoints.length,
                  isEstimated: false
                }));
                
                var bounds = new kakao.maps.LatLngBounds();
                points.forEach(function(point) {
                  bounds.extend(point);
                });
                map.setBounds(bounds);
              } catch (error) {
                console.log('경로 표시 오류:', error);
                document.getElementById('loadingIndicator').style.display = 'none';
                showSimpleRoute(locations);
              }
            }
            
            function showSimpleRoute(locations) {
              try {
                clearPolylines();
                
                if (!locations || locations.length === 0) {
                  document.getElementById('routeInfo').style.display = 'none';
                  return;
                }
                
                var points = [];
                points.push(currentMarker.getPosition());
                
                locations.forEach(function(loc) {
                  points.push(new kakao.maps.LatLng(loc.latitude, loc.longitude));
                });
                
                var colors = ['#4B89DC', '#FF5E3A', '#FFCC00', '#5AD427', '#9B59B6'];
                var totalDistance = 0;
                
                for (var i = 0; i < points.length - 1; i++) {
                  var color = colors[i % colors.length];
                  var start = points[i];
                  var end = points[i + 1];
                  
                  var distance = calculateDistance(
                    start.getLat(), start.getLng(),
                    end.getLat(), end.getLng()
                  );
                  totalDistance += distance;
                  
                  var line = new kakao.maps.Polyline({
                    path: [start, end],
                    strokeWeight: 5,
                    strokeColor: color,
                    strokeOpacity: 0.9,
                    strokeStyle: 'solid'
                  });
                  
                  line.setMap(map);
                  polylines.push(line);
                }
                
                var estimatedMinutes = Math.round(totalDistance * 3);
                
                var routeInfoElement = document.getElementById('routeInfo');
                routeInfoElement.textContent = '총 거리: ' + totalDistance.toFixed(1) + 'km, 예상 시간: ' + estimatedMinutes + '분 (추정)';
                routeInfoElement.style.display = 'block';
                
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ROUTE_INFO',
                  distance: totalDistance * 1000,
                  duration: estimatedMinutes * 60,
                  viaCount: points.length - 2,
                  isEstimated: true
                }));
                
                var bounds = new kakao.maps.LatLngBounds();
                points.forEach(function(point) {
                  bounds.extend(point);
                });
                map.setBounds(bounds);
              } catch (error) {
                console.log('단순 경로 표시 오류:', error);
              }
            }
            
            function calculateDistance(lat1, lon1, lat2, lon2) {
              var R = 6371;
              var dLat = deg2rad(lat2 - lat1);
              var dLon = deg2rad(lon2 - lon1);
              var a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
                Math.sin(dLon/2) * Math.sin(dLon/2); 
              var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
              var distance = R * c;
              return distance;
            }
            
            function deg2rad(deg) {
              return deg * (Math.PI/180);
            }
            
            function clearPolylines() {
              polylines.forEach(function(polyline) {
                polyline.setMap(null);
              });
              polylines = [];
              document.getElementById('routeInfo').style.display = 'none';
            }
            
            document.addEventListener('message', function(event) {
              handleMessage(event.data);
            });
            
            window.addEventListener('message', function(event) {
              handleMessage(event.data);
            });
            
            function handleMessage(data) {
              try {
                var message = JSON.parse(data);
                
                switch(message.type) {
                  case 'UPDATE_LOCATION':
                    var newPosition = new kakao.maps.LatLng(message.latitude, message.longitude);
                    currentMarker.setPosition(newPosition);
                    break;
                    
                  case 'ADD_PICKUPS':
                    addPickupMarkers(message.locations);
                    break;
                    
                  case 'SHOW_ROUTE':
                    showRoute(message.locations);
                    break;
                    
                  case 'CLEAR_ROUTE':
                    clearPolylines();
                    window.currentRouteLocations = [];
                    break;
                    
                  case 'FORCE_REFRESH':
                    map.relayout();
                    break;
                }
              } catch (error) {
                console.log('메시지 처리 오류:', error);
              }
            }
          </script>
        </body>
      </html>
    `;
  };
  
  // 웹뷰 메시지 핸들러 수정
  const handleWebViewMessage = (event) => {
    try {
      const message = event.nativeEvent.data;
      
      if (message === 'MAP_LOADED') {
        setMapLoaded(true);
        setWebViewError(false);
      } else {
        try {
          const data = JSON.parse(message);
          switch (data.type) {
            case 'MAP_READY':
              setMapLoaded(true);
              setWebViewError(false);
              break;
              
            case 'MARKER_CLICKED':
              if (handleMarkerClick && pickupCoordinates) {
                const clickedPickup = pickupCoordinates.find(p => p.id === data.id);
                if (clickedPickup) {
                  handleMarkerClick(clickedPickup.pickup);
                }
              }
              break;
              
            case 'ROUTE_INFO':
              setRouteInfo({
                distance: data.distance,
                duration: data.duration,
                viaCount: data.viaCount,
                isEstimated: data.isEstimated
              });
              break;
              
            case 'KAKAONAVI_SUCCESS':
              console.log('카카오내비 실행 성공:', data.message);
              break;
              
            case 'KAKAONAVI_ERROR':
              console.error('카카오내비 오류:', data.message);
              Alert.alert(
                '카카오내비 오류',
                '카카오내비 실행에 실패했습니다. URL 스키마로 재시도하시겠습니까?',
                [
                  { text: '취소', style: 'cancel' },
                  { text: '재시도', onPress: () => executeKakaoNaviUrlScheme('RECOMMEND') }
                ]
              );
              break;
              
            case 'ERROR':
              console.error('웹뷰 오류:', data.message);
              setWebViewError(true);
              break;
          }
        } catch (jsonError) {
          console.log('웹뷰 메시지:', message);
        }
      }
    } catch (error) {
      console.error('메시지 처리 오류:', error);
    }
  };

  const Header = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={toggleViewMode}
      >
        <Text style={styles.menuButtonText}>≡ 목록보기</Text>
      </TouchableOpacity>
      
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>수거 지도</Text>
        <Text style={styles.logoSubtext}>경로 안내</Text>
      </View>
      
      <TouchableOpacity 
        style={styles.optimizeButton}
        onPress={startNavigation}
      >
        <Text style={styles.optimizeButtonText}>내비게이션</Text>
      </TouchableOpacity>
    </View>
  );

  const LoadingIndicator = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#5c8d62" />
      <Text style={styles.loadingText}>지도를 불러오는 중...</Text>
    </View>
  );

  const RouteInfoPanel = () => (
    <View style={styles.routeInfoContainer}>
      <Text style={styles.routeInfoText}>
        {selectedPickups.length}개 수거지 - {routeInfo?.distance ? (routeInfo.distance / 1000).toFixed(1) + 'km' : '계산 중...'}
      </Text>
      <Text style={styles.routeInfoSubtext}>
        예상 소요시간: {routeInfo?.duration ? Math.round(routeInfo.duration / 60) + '분' : '계산 중...'}
        {routeInfo?.isEstimated && ' (추정)'}
      </Text>
      <View style={styles.buttonContainer}>
        {clearAllSelections && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={clearAllSelections}
          >
            <Text style={styles.clearButtonText}>선택 초기화</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.naviButton}
          onPress={startNavigation}
        >
          <Text style={styles.naviButtonText}>내비게이션 시작</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header />
      
      <View style={styles.mapContainer}>
        {isLoading ? (
          <LoadingIndicator />
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html: generateMapHTML() }}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={['*']}
            
            {...(Platform.OS === 'ios' && {
              useWebKit: true,
              allowsInlineMediaPlayback: true,
              bounces: false,
              scrollEnabled: false,
              automaticallyAdjustContentInsets: false,
              contentInsetAdjustmentBehavior: 'never',
            })}
            
            {...(Platform.OS === 'android' && {
              mixedContentMode: 'compatibility',
              androidLayerType: 'hardware',
              androidHardwareAccelerationDisabled: false,
              cacheEnabled: false,
              thirdPartyCookiesEnabled: false,
              allowFileAccess: true,
              allowUniversalAccessFromFileURLs: true,
              javaScriptCanOpenWindowsAutomatically: true,
              mediaPlaybackRequiresUserAction: false,
              overScrollMode: 'never',
              nestedScrollEnabled: true,
            })}
            
            startInLoadingState={true}
            scalesPageToFit={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            
            renderLoading={() => <LoadingIndicator />}
            onError={(error) => {
              console.log('WebView 오류:', error);
              setWebViewError(true);
            }}
            
            onLoadEnd={() => {
              const delay = Platform.OS === 'android' ? 500 : 100;
              setTimeout(() => {
                if (!webViewError) {
                  setMapLoaded(true);
                }
              }, delay);
            }}
            
            onLoadStart={() => {
              setMapLoaded(false);
              setWebViewError(false);
            }}
            
            style={styles.mapView}
          />
        )}
        
        {locationError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{locationError}</Text>
          </View>
        )}
        
        {webViewError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>지도 로딩 중 오류가 발생했습니다</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setWebViewError(false);
                webViewRef.current?.reload();
              }}
            >
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {routeInfo && selectedPickups && selectedPickups.length > 0 && (
          <RouteInfoPanel />
        )}
      </View>

      {/* 커스텀 모달 추가 */}
      <CustomModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        buttons={modalConfig.buttons}
        type={modalConfig.type}
        onClose={hideModal}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10,
  },
  menuButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  menuButtonText: {
    fontSize: 16,
    color: '#5c8d62',
    fontWeight: '600',
  },
  logoContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#5c8d62',
  },
  logoSubtext: {
    fontSize: 12,
    color: '#7c7c7c',
  },
  optimizeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#5c8d62',
    borderRadius: 20,
  },
  optimizeButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#e0e0e0',
  },
  mapView: {
    flex: 1,
    width: width,
    height: height - 60,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  errorText: {
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#ff0000',
    fontWeight: 'bold',
  },
  routeInfoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  routeInfoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  routeInfoSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#666',
    fontSize: 14,
  },
  naviButton: {
    backgroundColor: '#4B89DC',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  naviButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  }
});

export default MapView;
