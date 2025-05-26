import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Alert,
  Platform
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { NaviApi } from '@react-native-kakao/navi';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const MapView = ({ toggleViewMode, pickupCoordinates, selectedPickups, clearAllSelections, handleMarkerClick }) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 37.566826,  // 기본값: 서울 시청
    longitude: 126.9786567
  });
  const [locationError, setLocationError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState(null);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [webViewError, setWebViewError] = useState(false);
  const webViewRef = useRef(null);
  const navigation = useNavigation();

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
      // 현재 위치 업데이트
      webViewRef.current.postMessage(JSON.stringify({
        type: 'UPDATE_LOCATION',
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      }));
      
      // 수거지 마커 추가
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

  // 카카오 내비게이션 실행 함수
  const startKakaoNavigation = async () => {
    try {
      if (!selectedPickups || selectedPickups.length === 0) {
        Alert.alert('알림', '내비게이션을 시작하려면 최소 한 개의 수거지를 선택해주세요.');
        return;
      }
      
      // 목적지는 마지막 수거지
      const destination = {
        name: selectedPickups[selectedPickups.length - 1].name || "목적지",
        x: selectedPickups[selectedPickups.length - 1].longitude,
        y: selectedPickups[selectedPickups.length - 1].latitude
      };
      
      // 경유지는 중간 수거지들 (최대 3개)
      const viaList = selectedPickups.slice(0, -1).slice(0, 3).map((point, index) => ({
        name: point.name || `경유지 ${index+1}`,
        x: point.longitude,
        y: point.latitude
      }));
      
      console.log('카카오 내비 실행 - 목적지:', destination);
      console.log('카카오 내비 실행 - 경유지:', viaList);
      
      // 카카오 내비 실행 옵션
      const options = {
        routeInfo: true,
        vehicleType: 1 // 1: 자동차, 2: 오토바이, 3: 자전거
      };
      
      // SDK를 통한 내비게이션 실행
      await NaviApi.navigate({
        destination,
        viaList,
        options
      });
    } catch (error) {
      console.error('카카오 내비 실행 오류:', error);
      Alert.alert('오류', '카카오 내비게이션을 실행할 수 없습니다: ' + error.message);
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
            name: point.name
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

  // 네비게이션 선택 다이얼로그 표시
  const startNavigation = () => {
    Alert.alert(
      '내비게이션 선택',
      '사용할 내비게이션을 선택해주세요.',
      [
        {
          text: '카카오 내비',
          onPress: startKakaoNavigation
        },
        {
          text: '앱 내비게이션',
          onPress: startAppNavigation
        },
        {
          text: '취소',
          style: 'cancel'
        }
      ]
    );
  };

  // 지도 HTML 생성 - 플랫폼별 최적화
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
              top: 10px;
              left: 50%;
              transform: translateX(-50%);
              background-color: white;
              border-radius: 5px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.2);
              padding: 8px 12px;
              display: flex;
              align-items: center;
              z-index: 100;
            }
            .option-label {
              font-size: 12px;
              margin-right: 8px;
            }
            .option-buttons {
              display: flex;
            }
            .option-button {
              border: 1px solid #ddd;
              background-color: white;
              padding: 4px 8px;
              margin: 0 2px;
              font-size: 12px;
              cursor: pointer;
              border-radius: 3px;
            }
            .option-button.active {
              background-color: #4B89DC;
              color: white;
              border-color: #4B89DC;
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
            // 디버깅용 오류 핸들러
            window.onerror = function(message, source, lineno, colno, error) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'ERROR',
                message: message
              }));
              console.log('Error:', message);
              return true;
            };
            
            var map;
            var currentMarker;
            var pickupMarkers = [];
            var pickupOverlays = [];
            var polylines = [];
            
            // 현재 경로 옵션 및 경로 위치 저장
            window.currentRouteOption = 'RECOMMEND';
            window.currentRouteLocations = [];
            
            // 카카오맵 로드 - 안드로이드 호환성 개선
            ${isAndroid ? 'setTimeout(() => {' : ''}
            kakao.maps.load(function() {
              console.log('카카오맵 로드 완료');
              initMap();
            });
            ${isAndroid ? '}, 100);' : ''}
            
            // 지도 초기화
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
                console.log('지도 초기화 완료');
                
                // 현재 위치 마커 추가
                currentMarker = new kakao.maps.Marker({
                  position: new kakao.maps.LatLng(${currentLocation.latitude}, ${currentLocation.longitude}),
                  image: new kakao.maps.MarkerImage(
                    'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
                    new kakao.maps.Size(24, 35)
                  ),
                  zIndex: 10
                });
                currentMarker.setMap(map);
                
                // 현재 위치 오버레이
                var currentOverlay = new kakao.maps.CustomOverlay({
                  position: new kakao.maps.LatLng(${currentLocation.latitude}, ${currentLocation.longitude}),
                  content: '<div class="current-location-overlay">현재 위치</div>',
                  yAnchor: 1.5,
                  zIndex: 11
                });
                currentOverlay.setMap(map);
                
                // 경로 옵션 이벤트 설정
                setupRouteOptions();
                
                // 안드로이드에서 지도 강제 리사이즈
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
            
            // 경로 옵션 설정
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
            
            // 경로 옵션 변경
            function setRouteOption(option) {
              // 활성 버튼 스타일 변경
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
              
              // 현재 경로 옵션 저장
              window.currentRouteOption = option;
              
              // 현재 표시된 경로가 있으면 다시 계산
              if (window.currentRouteLocations && window.currentRouteLocations.length > 0) {
                showRoute(window.currentRouteLocations);
              }
            }
            
            // 수거지 마커 추가 - 안드로이드 호환성 개선
            function addPickupMarkers(locations) {
              try {
                // 기존 마커 제거
                clearPickupMarkers();
                
                if (!locations || locations.length === 0) return;
                
                var bounds = new kakao.maps.LatLngBounds();
                
                // 현재 위치 포함
                bounds.extend(currentMarker.getPosition());
                
                // 안드로이드에서 마커 생성 지연
                const delay = ${isAndroid ? '100' : '0'};
                
                setTimeout(() => {
                  locations.forEach(function(loc, index) {
                    // 좌표 유효성 검사 추가
                    if (!loc.latitude || !loc.longitude || 
                        isNaN(loc.latitude) || isNaN(loc.longitude)) {
                      console.log('유효하지 않은 좌표:', loc);
                      return;
                    }
                    
                    var position = new kakao.maps.LatLng(
                      parseFloat(loc.latitude), 
                      parseFloat(loc.longitude)
                    );
                    bounds.extend(position);
                    
                    // 마커 생성 시 명시적 옵션 설정
                    var marker = new kakao.maps.Marker({
                      position: position,
                      map: map,
                      clickable: true,
                      zIndex: 5
                    });
                    
                    pickupMarkers.push(marker);
                    
                    // 마커 클릭 이벤트
                    kakao.maps.event.addListener(marker, 'click', function() {
                      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'MARKER_CLICKED',
                        id: loc.id,
                        index: index
                      }));
                    });
                    
                    // 오버레이 생성 시 안드로이드 호환성 개선
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
                  
                  // 지도 범위 조정을 마커 생성 후로 지연
                  setTimeout(() => {
                    map.setBounds(bounds);
                  }, ${isAndroid ? '200' : '50'});
                  
                }, delay);
                
              } catch (error) {
                console.log('수거지 마커 추가 오류:', error);
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ERROR',
                  message: '수거지 마커 추가 오류: ' + error.message
                }));
              }
            }
            
            // 수거지 마커 제거
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
            
            // 카카오 모빌리티 API를 이용한 경로 탐색
            async function fetchRouteWithKakaoMobility(origin, waypoints, destination) {
              try {
                const REST_API_KEY = '90fc3c147a2997ec441fd2cd8e87e2a8';
                
                // 출발지 좌표 설정
                const originObj = {
                  x: origin.getLng().toString(),
                  y: origin.getLat().toString()
                };
                
                // 목적지 좌표 설정
                const destinationObj = {
                  x: destination.getLng().toString(),
                  y: destination.getLat().toString()
                };
                
                // 경유지 좌표 배열 생성
                const waypointsArr = waypoints.map(point => ({
                  x: point.getLng().toString(),
                  y: point.getLat().toString()
                }));
                
                // API 요청 데이터 구성
                const requestData = {
                  origin: originObj,
                  destination: destinationObj,
                  waypoints: waypointsArr,
                  priority: window.currentRouteOption, // 경로 우선순위
                  car_fuel: 'GASOLINE',
                  alternatives: false,
                  road_details: true
                };
                
                // API 호출
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
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ERROR',
                  message: '경로 탐색 오류: ' + error.message
                }));
                return null;
              }
            }
            
            // 카카오 모빌리티 API를 이용한 경로 표시
            async function showRoute(locations) {
              try {
                // 로딩 표시
                document.getElementById('loadingIndicator').style.display = 'block';
                
                // 현재 경로 저장
                window.currentRouteLocations = locations;
                
                // 기존 경로 제거
                clearPolylines();
                
                if (!locations || locations.length === 0) {
                  document.getElementById('routeInfo').style.display = 'none';
                  document.getElementById('loadingIndicator').style.display = 'none';
                  return;
                }
                
                // 좌표 배열 생성
                var points = [];
                const origin = currentMarker.getPosition(); // 현재 위치
                points.push(origin);
                
                // 경유지 좌표 배열
                var waypoints = [];
                
                // 각 수거지 위치 추가
                locations.forEach(function(loc, index) {
                  if (index < locations.length - 1) {
                    // 마지막이 아닌 지점은 경유지로 처리
                    waypoints.push(new kakao.maps.LatLng(loc.latitude, loc.longitude));
                  } else {
                    // 마지막 지점은 목적지로 처리
                    points.push(new kakao.maps.LatLng(loc.latitude, loc.longitude));
                  }
                });
                
                // 모든 지점을 points에 추가 (시각화용)
                waypoints.forEach(wp => points.push(wp));
                
                // 목적지 설정 (마지막 수거지 또는 현재 위치로 돌아오기)
                const destination = locations.length > 0 
                  ? new kakao.maps.LatLng(locations[locations.length - 1].latitude, locations[locations.length - 1].longitude)
                  : origin;
                
                // 카카오 모빌리티 API 호출
                const routeData = await fetchRouteWithKakaoMobility(origin, waypoints, destination);
                
                // 로딩 숨기기
                document.getElementById('loadingIndicator').style.display = 'none';
                
                if (!routeData || !routeData.routes || routeData.routes.length === 0) {
                  throw new Error('경로 데이터를 받아오지 못했습니다.');
                }
                
                // 첫 번째 경로 사용
                const route = routeData.routes[0];
                
                // 총 거리 및 시간
                const totalDistance = route.summary.distance;  // 미터 단위
                const totalDuration = route.summary.duration;  // 초 단위
                
                // 경로 좌표 추출
                const pathCoordinates = [];
                
                // 각 구간의 좌표 추출
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
                
                // 경로 선 그리기
                const polyline = new kakao.maps.Polyline({
                  path: pathCoordinates,
                  strokeWeight: 5,
                  strokeColor: '#4B89DC',
                  strokeOpacity: 0.8,
                  strokeStyle: 'solid'
                });
                
                polyline.setMap(map);
                polylines.push(polyline);
                
                // 경로 정보 표시
                var routeInfoElement = document.getElementById('routeInfo');
                routeInfoElement.textContent = \`총 거리: \${(totalDistance / 1000).toFixed(1)}km, 예상 시간: \${Math.round(totalDuration / 60)}분\`;
                routeInfoElement.style.display = 'block';
                
                // 경로 정보 전송
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ROUTE_INFO',
                  distance: totalDistance,
                  duration: totalDuration,
                  viaCount: waypoints.length,
                  isEstimated: false
                }));
                
                // 모든 지점이 보이도록 지도 범위 조정
                var bounds = new kakao.maps.LatLngBounds();
                points.forEach(function(point) {
                  bounds.extend(point);
                });
                map.setBounds(bounds);
              } catch (error) {
                console.log('경로 표시 오류:', error);
                document.getElementById('loadingIndicator').style.display = 'none';
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ERROR',
                  message: '경로 표시 오류: ' + error.message
                }));
                
                // 오류 발생 시 기존 방식으로 직선 경로 표시 (대체 방안)
                showSimpleRoute(locations);
              }
            }
            
            // 단순 직선 경로 표시 (API 호출 실패 시 대체 방안)
            function showSimpleRoute(locations) {
              try {
                // 기존 경로 제거
                clearPolylines();
                
                if (!locations || locations.length === 0) {
                  document.getElementById('routeInfo').style.display = 'none';
                  return;
                }
                
                // 좌표 배열 생성
                var points = [];
                points.push(currentMarker.getPosition()); // 현재 위치
                
                // 각 수거지 위치 추가
                locations.forEach(function(loc) {
                  points.push(new kakao.maps.LatLng(loc.latitude, loc.longitude));
                });
                
                // 각 구간을 다른 색상으로 표시
                var colors = ['#4B89DC', '#FF5E3A', '#FFCC00', '#5AD427', '#9B59B6'];
                
                // 총 거리 및 시간 계산용
                var totalDistance = 0;
                
                // 각 구간별로 선 그리기
                for (var i = 0; i < points.length - 1; i++) {
                  var color = colors[i % colors.length];
                  var start = points[i];
                  var end = points[i + 1];
                  
                  // 직선 거리 계산
                  var distance = calculateDistance(
                    start.getLat(), start.getLng(),
                    end.getLat(), end.getLng()
                  );
                  totalDistance += distance;
                  
                  // 선 그리기
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
                
                // 예상 시간 (km당 약 3분)
                var estimatedMinutes = Math.round(totalDistance * 3);
                
                // 경로 정보 표시
                var routeInfoElement = document.getElementById('routeInfo');
                routeInfoElement.textContent = '총 거리: ' + totalDistance.toFixed(1) + 'km, 예상 시간: ' + estimatedMinutes + '분 (추정)';
                routeInfoElement.style.display = 'block';
                
                // 경로 정보 전송
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ROUTE_INFO',
                  distance: totalDistance * 1000, // m 단위로 변환
                  duration: estimatedMinutes * 60, // 초 단위로 변환
                  viaCount: points.length - 2,
                  isEstimated: true
                }));
                
                // 모든 지점이 보이도록 지도 범위 조정
                var bounds = new kakao.maps.LatLngBounds();
                points.forEach(function(point) {
                  bounds.extend(point);
                });
                map.setBounds(bounds);
              } catch (error) {
                console.log('단순 경로 표시 오류:', error);
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ERROR',
                  message: '단순 경로 표시 오류: ' + error.message
                }));
              }
            }
            
            // 두 지점 간 거리 계산 (Haversine 공식)
            function calculateDistance(lat1, lon1, lat2, lon2) {
              var R = 6371; // 지구 반경 (km)
              var dLat = deg2rad(lat2 - lat1);
              var dLon = deg2rad(lon2 - lon1);
              var a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
                Math.sin(dLon/2) * Math.sin(dLon/2); 
              var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
              var distance = R * c; // 거리 (km)
              return distance;
            }
            
            // 각도를 라디안으로 변환
            function deg2rad(deg) {
              return deg * (Math.PI/180);
            }
            
            // 경로 제거
            function clearPolylines() {
              polylines.forEach(function(polyline) {
                polyline.setMap(null);
              });
              polylines = [];
              document.getElementById('routeInfo').style.display = 'none';
            }
            
            // 마커 강제 리렌더링 (안드로이드용)
            function forceRefreshMarkers() {
              pickupMarkers.forEach(function(marker, index) {
                marker.setMap(null);
                setTimeout(() => {
                  marker.setMap(map);
                }, index * 50);
              });
              
              pickupOverlays.forEach(function(overlay, index) {
                overlay.setMap(null);
                setTimeout(() => {
                  overlay.setMap(map);
                }, index * 50 + 25);
              });
            }
            
            // 메시지 수신 처리
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
                    // 현재 위치 업데이트
                    var newPosition = new kakao.maps.LatLng(message.latitude, message.longitude);
                    currentMarker.setPosition(newPosition);
                    break;
                    
                  case 'ADD_PICKUPS':
                    // 수거지 마커 추가
                    addPickupMarkers(message.locations);
                    break;
                    
                  case 'SHOW_ROUTE':
                    // 경로 표시
                    showRoute(message.locations);
                    break;
                    
                  case 'CLEAR_ROUTE':
                    // 경로 제거
                    clearPolylines();
                    window.currentRouteLocations = [];
                    break;
                    
                  case 'FORCE_REFRESH_MARKERS':
                    // 안드로이드에서 마커 강제 리렌더링
                    forceRefreshMarkers();
                    break;
                    
                  case 'FORCE_REFRESH':
                    // 안드로이드에서 강제 새로고침
                    map.relayout();
                    break;
                }
              } catch (error) {
                console.log('메시지 처리 오류:', error);
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ERROR',
                  message: '메시지 처리 오류: ' + error.message
                }));
              }
            }
          </script>
        </body>
      </html>
    `;
  };
  
  // 웹뷰 메시지 핸들러 - 개선된 에러 처리
  const handleWebViewMessage = (event) => {
    try {
      const message = event.nativeEvent.data;
      
      if (message === 'MAP_LOADED') {
        console.log('지도 로드 완료');
        setMapLoaded(true);
        setWebViewError(false);
      } else {
        // JSON 메시지 처리
        try {
          const data = JSON.parse(message);
          switch (data.type) {
            case 'MAP_READY':
              console.log('지도 준비 완료');
              setMapLoaded(true);
              setWebViewError(false);
              break;
              
            case 'MARKER_CLICKED':
              console.log('마커 클릭:', data.id, data.index);
              if (handleMarkerClick && pickupCoordinates) {
                const clickedPickup = pickupCoordinates.find(p => p.id === data.id);
                if (clickedPickup) {
                  handleMarkerClick(clickedPickup.pickup);
                }
              }
              break;
              
            case 'ROUTE_INFO':
              console.log('경로 정보:', data);
              setRouteInfo({
                distance: data.distance,
                duration: data.duration,
                viaCount: data.viaCount,
                isEstimated: data.isEstimated
              });
              break;
              
            case 'OPTIMAL_ROUTE':
              console.log('최적 경로:', data);
              setOptimizedRoute(data.route);
              break;
              
            case 'ERROR':
              console.error('웹뷰 오류:', data.message);
              setWebViewError(true);
              break;
          }
        } catch (jsonError) {
          // 단순 문자열 메시지
          console.log('웹뷰 메시지(문자열):', message);
        }
      }
    } catch (error) {
      console.error('메시지 처리 오류:', error);
      setWebViewError(true);
    }
  };

  // 헤더 컴포넌트
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

  // 로딩 컴포넌트
  const LoadingIndicator = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#5c8d62" />
      <Text style={styles.loadingText}>지도를 불러오는 중...</Text>
    </View>
  );

  // 경로 정보 컴포넌트
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
            
            // iOS 전용 설정
            {...(Platform.OS === 'ios' && {
              useWebKit: true,
              allowsInlineMediaPlayback: true,
              bounces: false,
              scrollEnabled: false,
              automaticallyAdjustContentInsets: false,
              contentInsetAdjustmentBehavior: 'never',
            })}
            
            // 안드로이드 전용 설정
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
            
            // 공통 설정
            startInLoadingState={true}
            scalesPageToFit={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            
            // 로딩 및 에러 처리
            renderLoading={() => <LoadingIndicator />}
            onError={(error) => {
              console.log('WebView 오류:', error);
              setWebViewError(true);
              // 에러 발생 시 재로딩 시도
              if (webViewRef.current) {
                setTimeout(() => {
                  webViewRef.current.reload();
                }, 1000);
              }
            }}
            
            // 로딩 완료 처리
            onLoadEnd={() => {
              console.log('WebView 로딩 완료');
              // 안드로이드에서는 추가 지연 후 초기화
              const delay = Platform.OS === 'android' ? 500 : 100;
              setTimeout(() => {
                if (!webViewError) {
                  setMapLoaded(true);
                }
              }, delay);
            }}
            
            // 로딩 시작 처리
            onLoadStart={() => {
              console.log('WebView 로딩 시작');
              setMapLoaded(false);
              setWebViewError(false);
            }}
            
            // 네비게이션 상태 변경 처리
            onNavigationStateChange={(navState) => {
              console.log('Navigation state:', navState);
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
