import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, AppState, Alert } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import main from './styles/main';

import MapView from './MapView';
import ListView from './ListView';

const styles = main;

const PickupDeliverPage = () => {
  // 기본 상태 관리
  const [activeTab, setActiveTab] = useState('미완료');
  const [location, setLocation] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pickupList, setPickupList] = useState([]);
  const [selectedPickup, setSelectedPickup] = useState(null);
  const [pickupDetails, setPickupDetails] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [showListModal, setShowListModal] = useState(true);
  const [pickupCoordinates, setPickupCoordinates] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'list' 또는 'map' 모드
  
  // 다중 선택 관련 상태
  const [selectedPickups, setSelectedPickups] = useState([]);
  const [routeOptimized, setRouteOptimized] = useState(true);
  
  // WebView 참조
  const mapWebViewRef = useRef(null);
  
  // 모드 전환 함수
  const toggleViewMode = () => {
    const newMode = viewMode === 'list' ? 'map' : 'list';
    setViewMode(newMode);
  };
  
  // 위치 권한 요청 및 현재 위치 가져오기
  useEffect(() => {
    const getLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            '위치 권한 필요',
            '이 앱은 사용자의 위치 권한을 필요로 합니다.'
          );
          setHasPermission(false);
          // 기본 위치 설정 (서울)
          setLocation({
            latitude: 37.566826,
            longitude: 126.9786567
          });
          setIsLoading(false);
        } else {
          setHasPermission(true);
          getCurrentLocation();
        }
      } catch (error) {
        console.error('위치 권한 요청 오류:', error);
        setHasPermission(false);
        setIsLoading(false);
      }
    };

    const getCurrentLocation = async () => {
      try {
        const { coords } = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });
        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setIsLoading(false);
      } catch (error) {
        console.error('위치 정보를 가져오는 데 실패했습니다:', error);
        // 기본 위치 설정 (서울)
        setLocation({
          latitude: 37.566826,
          longitude: 126.9786567
        });
        setIsLoading(false);
      }
    };

    getLocationPermission();
  }, []);

  // 오늘 날짜 가져오기 (YYYY-MM-DD 형식)
  const getToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 주소를 좌표로 변환하는 함수 (카카오맵 API 사용)
  const geocodeAddress = async (address) => {
    if (!address) {
      console.error('지오코딩 요청 실패: 주소가 비어 있습니다.');
      return null;
    }
    
    try {
      // 카카오맵 API 키
      const KAKAO_API_KEY = '90fc3c147a2997ec441fd2cd8e87e2a8';
      
      console.log('지오코딩 요청 주소:', address);

      // 주소 검색 API 호출
      const response = await fetch(
        `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `KakaoAK ${KAKAO_API_KEY}`,
            'Content-Type': 'application/json;charset=UTF-8'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('주소 검색에 실패했습니다');
      }
      
      const data = await response.json();
      
      // 검색 결과가 없는 경우
      if (data.documents.length === 0) {
        console.warn('주소에 대한 좌표 정보를 찾을 수 없습니다:', address);
        return null;
      }
      
      // 첫 번째 결과의 좌표 반환
      const { x, y } = data.documents[0];
      
      // 좌표 유효성 검사
      const longitude = parseFloat(x);
      const latitude = parseFloat(y);
      
      if (isNaN(longitude) || isNaN(latitude)) {
        console.error('지오코딩 결과가 유효한 숫자가 아닙니다:', x, y);
        return null;
      }
      
      console.log(`지오코딩 성공 - 주소: ${address}, 좌표: ${latitude}, ${longitude}`);
      
      return {
        longitude: longitude,
        latitude: latitude
      };
    } catch (error) {
      console.error('주소 지오코딩 오류:', error);
      return null;
    }
  };

  // 수거지 목록 가져오기
  useEffect(() => {
    fetchPickups();
  }, []);

  const fetchPickups = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        Alert.alert('로그인 필요', '로그인이 필요합니다.');
        setIsLoading(false);
        return;
      }
      
      // API 호출
      const response = await fetch(
        `https://refresh-f5-server.o-r.kr/api/pickup/get-today-pickup?today=${getToday()}`,
        { 
          method: 'GET', 
          headers: { 
            'Content-Type': 'application/json',
            // 'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('수거지 목록을 불러오는데 실패했습니다');
      }
      
      const data = await response.json();
      
      // 데이터 유효성 검사
      if (!Array.isArray(data)) {
        console.error('서버에서 받은 수거지 데이터가 배열이 아닙니다:', data);
        throw new Error('수거지 데이터 형식이 올바르지 않습니다');
      }
      
      console.log(`수거지 데이터 ${data.length}개 로드 완료`);
      setPickupList(data);
      
      // 수거지 주소를 좌표로 변환하고 마커 정보 생성
      console.log('수거지 좌표 변환 시작...');
      const coordinates = await Promise.all(
        data.map(async (pickup, index) => {
          // pickup 객체 유효성 검사
          if (!pickup || !pickup.address || !pickup.address.roadNameAddress) {
            console.error(`수거지 #${index} 주소 정보 누락:`, pickup);
            return null;
          }
          
          const addressStr = pickup.address.roadNameAddress;
          const coords = await geocodeAddress(addressStr);
          
          if (coords) {
            return {
              id: pickup.pickupId,
              latitude: coords.latitude,
              longitude: coords.longitude,
              name: pickup.address.name || '수거지',
              address: pickup.address.roadNameAddress,
              pickup: pickup // 원본 데이터도 함께 저장
            };
          }
          console.warn(`수거지 #${index}(${pickup.pickupId}) 좌표 변환 실패`);
          return null;
        })
      );
      
      // null 값 제거
      const validCoordinates = coordinates.filter(coord => coord !== null);
      console.log(`${validCoordinates.length}/${data.length} 수거지 좌표 변환 성공`);
      
      // 좌표 정보 유효성 검사
      const verifiedCoordinates = validCoordinates.filter(coord => {
        if (typeof coord.latitude !== 'number' || typeof coord.longitude !== 'number' ||
            isNaN(coord.latitude) || isNaN(coord.longitude)) {
          console.error('유효하지 않은 좌표 정보:', coord);
          return false;
        }
        return true;
      });
      
      if (verifiedCoordinates.length < validCoordinates.length) {
        console.warn(`${validCoordinates.length - verifiedCoordinates.length}개의 유효하지 않은 좌표 정보가 필터링되었습니다.`);
      }
      
      setPickupCoordinates(verifiedCoordinates);
      
    } catch (error) {
      console.error('수거지 목록 조회 오류:', error);
      Alert.alert('데이터 오류', '수거지 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 수거지 상세 정보 가져오기
  const fetchPickupDetails = async (pickupId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        Alert.alert('로그인 필요', '로그인이 필요합니다.');
        return;
      }
      
      // API 호출
      const response = await fetch(
        `https://refresh-f5-server.o-r.kr/api/pickup/get-details?pickupId=${pickupId}`,
        { 
          method: 'GET', 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('수거지 상세 정보를 불러오는데 실패했습니다');
      }
      
      const data = await response.json();
      setPickupDetails(data);
    } catch (error) {
      console.error('수거지 상세 조회 오류:', error);
      Alert.alert('데이터 오류', '수거지 상세 정보를 불러올 수 없습니다.');
    }
  };

  // 마커 클릭 시 수거지 상세 정보 표시
  const handleMarkerClick = (pickup) => {
    setSelectedPickup(pickup);
    fetchPickupDetails(pickup.pickupId);
  };

  // 수거지 다중 선택 처리
  const togglePickupSelection = (pickup) => {
    // 이미 선택된 경우 제거, 아니면 추가
    const isAlreadySelected = selectedPickups.some(p => p.id === pickup.pickupId);
    
    if (isAlreadySelected) {
      setSelectedPickups(selectedPickups.filter(p => p.id !== pickup.pickupId));
    } else {
      // 해당 수거지의 좌표 정보 찾기
      const pickupCoord = pickupCoordinates.find(c => c.id === pickup.pickupId);
      if (pickupCoord) {
        // 좌표 정보 유효성 검사
        if (typeof pickupCoord.latitude === 'number' && typeof pickupCoord.longitude === 'number') {
          setSelectedPickups([...selectedPickups, pickupCoord]);
          console.log(`수거지 추가 - ID: ${pickupCoord.id}, 좌표: ${pickupCoord.latitude}, ${pickupCoord.longitude}`);
        } else {
          console.error('유효하지 않은 좌표 정보:', pickupCoord);
          Alert.alert('오류', '이 수거지의 좌표 정보가 유효하지 않아 선택할 수 없습니다.');
        }
      } else {
        console.error('수거지 좌표 정보를 찾을 수 없음:', pickup.pickupId);
        Alert.alert('오류', '이 수거지의 좌표 정보를 찾을 수 없습니다.');
      }
    }
  };
  
  // 경로 최적화 토글
  const toggleRouteOptimization = () => {
    setRouteOptimized(!routeOptimized);
  };

  // 내장형 내비게이션 시작
  const startInAppNavigation = () => {
    if (selectedPickups.length === 0) {
      Alert.alert('선택 필요', '최소한 하나 이상의 수거지를 선택해주세요.');
      return;
    }
    
    // 지도 모드로 전환
    setViewMode('map');
    
    // MapView 컴포넌트에서 내비게이션 시작 처리
    // (MapView 컴포넌트 내부에서 구현)
  };

  // 기존 launchKakaoNavigation 함수를 대체
  const launchNavigation = () => {
    startInAppNavigation();
  };

  // 선택 모두 초기화
  const clearAllSelections = () => {
    setSelectedPickups([]);
  };

  // 위치 업데이트 타이머
  useEffect(() => {
    const locationUpdateInterval = setInterval(() => {
      if (hasPermission) {
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        }).then(({ coords }) => {
          setLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        }).catch(error => {
          console.error('위치 업데이트 오류:', error);
        });
      }
    }, 15000); // 15초마다 위치 업데이트
    
    return () => {
      clearInterval(locationUpdateInterval);
    };
  }, [hasPermission]);

  // 앱 상태 변경 감지 (포그라운드로 돌아왔을 때 데이터 새로고침)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchPickups();
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  // 메인 렌더링
  return (
    <SafeAreaView style={styles.container}>
      {viewMode === 'list' ? (
        <ListView 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pickupList={pickupList}
          selectedPickups={selectedPickups}
          togglePickupSelection={togglePickupSelection}
          routeOptimized={routeOptimized}
          toggleRouteOptimization={toggleRouteOptimization}
          startRouteWithSelectedPickups={startInAppNavigation}
          toggleViewMode={toggleViewMode}
          launchKakaoNavigation={launchNavigation}
        />
      ) : (
        <MapView 
          location={location}
          isLoading={isLoading}
          pickupCoordinates={pickupCoordinates}
          selectedPickups={selectedPickups}
          routeOptimized={routeOptimized}
          toggleViewMode={toggleViewMode}
          clearAllSelections={clearAllSelections}
          handleMarkerClick={handleMarkerClick}
          webViewRef={mapWebViewRef}
          launchKakaoNavigation={launchNavigation}
        />
      )}
    </SafeAreaView>
  );
};

export default PickupDeliverPage;
