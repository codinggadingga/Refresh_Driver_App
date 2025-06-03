import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const NavigationView = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  // route.params에서 필요한 데이터 추출
  const params = route?.params || {};
  const origin = params.origin || { latitude: 37.566826, longitude: 126.9786567 };
  const destination = params.destination || { latitude: 37.566826, longitude: 126.9786567 };
  const waypoints = params.waypoints || [];
  
  const [currentLocation, setCurrentLocation] = useState(origin);
  const [isNavigating, setIsNavigating] = useState(false);
  const [remainingDistance, setRemainingDistance] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null);
  const [nextInstruction, setNextInstruction] = useState(null);
  const [nextInstructionDistance, setNextInstructionDistance] = useState(null);
  const [currentRoad, setCurrentRoad] = useState(null);
  const [speedLimit, setSpeedLimit] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [nextTurnType, setNextTurnType] = useState(null);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
  const [showCompleteButton, setShowCompleteButton] = useState(false);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const [webViewError, setWebViewError] = useState(false);
  const webViewRef = useRef(null);

  // 위치 추적 시작
  useEffect(() => {
    let locationSubscription;
    
    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('위치 권한 필요', '내비게이션을 위해 위치 권한이 필요합니다.');
          return;
        }
        
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 5,
            timeInterval: 1000
          },
          (location) => {
            const { latitude, longitude, speed } = location.coords;
            setCurrentLocation({
              latitude,
              longitude
            });
            
            setCurrentSpeed((speed || 0) * 3.6);
            
            if (webViewRef.current && isNavigating && webViewLoaded) {
              // 안전한 메시지 전송을 위해 try-catch 추가
              try {
                webViewRef.current.postMessage(JSON.stringify({
                  type: 'UPDATE_LOCATION',
                  latitude,
                  longitude,
                  speed: (speed || 0) * 3.6
                }));
              } catch (error) {
                console.log('위치 업데이트 메시지 전송 오류:', error);
              }
            }
          }
        );
      } catch (error) {
        console.error('위치 추적 오류:', error);
        Alert.alert('오류', '위치 추적을 시작할 수 없습니다.');
      }
    };
    
    startLocationTracking();
    
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [isNavigating, webViewLoaded]);
  
  // 수거 완료 처리 함수
  const handleCollectionComplete = async () => {
    try {
      // API 호출하여 pickupProgress를 true로 업데이트
      const response = await fetch('https://refresh-f5-server.o-r.kr/api/pickup/update-pickup', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupId: pickupId,
          pickupProgress: true
        })
      });
  
      if (!response.ok) {
        throw new Error('수거 완료 업데이트 실패');
      }
  
      const result = await response.json();
      console.log('수거 완료 업데이트 성공:', result);
  
      // 기존 로직 실행
      if (currentWaypointIndex < waypoints.length - 1) {
        const nextIndex = currentWaypointIndex + 1;
        setCurrentWaypointIndex(nextIndex);
               
        Alert.alert(
          '수거 완료', 
          `${currentWaypointIndex + 1}번째 경유지 수거가 완료되었습니다.\n다음 경유지로 안내합니다.`,
          [{ text: '확인' }]
        );
               
        if (webViewRef.current && webViewLoaded) {
          try {
            webViewRef.current.postMessage(JSON.stringify({
              type: 'UPDATE_ACTIVE_WAYPOINT',
              waypointIndex: nextIndex
            }));
          } catch (error) {
            console.log('경유지 업데이트 메시지 전송 오류:', error);
          }
        }
               
        setShowCompleteButton(false);
      } else {
        Alert.alert(
          '모든 수거 완료', 
          '모든 경유지 수거가 완료되었습니다.\n목적지로 안내합니다.',
          [{ text: '확인' }]
        );
               
        if (webViewRef.current && webViewLoaded) {
          try {
            webViewRef.current.postMessage(JSON.stringify({
              type: 'NAVIGATE_TO_DESTINATION'
            }));
          } catch (error) {
            console.log('목적지 안내 메시지 전송 오류:', error);
          }
        }
               
        setShowCompleteButton(false);
      }
  
    } catch (error) {
      console.error('수거 완료 처리 오류:', error);
      Alert.alert(
        '오류',
        '수거 완료 처리 중 오류가 발생했습니다.',
        [{ text: '확인' }]
      );
    }
  };

  // 내비게이션 HTML 생성 - 수정된 버전
  const generateNavigationHTML = () => {
    const isAndroid = Platform.OS === 'android';
    
    const destCoord = {
      lat: destination.latitude,
      lng: destination.longitude
    };
    
    const waypointsCoords = waypoints.map(wp => ({
      lat: wp.latitude,
      lng: wp.longitude
    }));
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, minimum-scale=0.5, user-scalable=yes">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body, html { 
              margin: 0; 
              padding: 0; 
              width: 100%; 
              height: 100%; 
              overflow: hidden;
              background-color: #f5f5f5;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              ${isAndroid ? 'touch-action: manipulation;' : ''}
            }
            #map-container {
              width: 100%;
              height: 100%;
              position: relative;
              overflow: hidden;
            }
            #map { 
              width: 100%; 
              height: 100%; 
              background-color: #f5f5f5;
              ${isAndroid ? 'position: fixed; top: 0; left: 0;' : ''}
            }
          </style>
          <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=30a7f8ffd1d5af779f063d9fa779b8b4&libraries=services&autoload=false"></script>
        </head>
        <body>
          <div id="map-container">
            <div id="map"></div>
          </div>
          
          <script>
            // 전역 오류 핸들러 개선
            window.onerror = function(message, source, lineno, colno, error) {
              var errorMsg = 'JS Error: ' + message;
              if (source) errorMsg += ' at ' + source + ':' + lineno;
              console.error(errorMsg);
              
              try {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'ERROR',
                    message: errorMsg
                  }));
                }
              } catch (e) {
                console.error('Failed to send error message:', e);
              }
              return true;
            };
            
            // Promise rejection 핸들러 추가
            window.addEventListener('unhandledrejection', function(event) {
              console.error('Unhandled promise rejection:', event.reason);
              try {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'ERROR',
                    message: 'Promise rejection: ' + (event.reason || 'Unknown error')
                  }));
                }
              } catch (e) {
                console.error('Failed to send promise rejection message:', e);
              }
            });
            
            var map;
            var currentMarker;
            var destinationMarker;
            var waypointMarkers = [];
            var routePolyline;
            var isNavigating = false;
            var currentRoute = null;
            var previousPosition = null;
            var initializationAttempts = 0;
            var maxInitializationAttempts = 3;
            var geocoder = null; // 지오코더 변수를 전역으로 선언
            var currentRoadName = '도로 정보 확인 중...'; // 전역 변수로 선언
            
            // 목적지 좌표
            var destination = ${JSON.stringify(destCoord)};
            
            // 경유지 좌표
            var waypoints = ${JSON.stringify(waypointsCoords)};
            var activeWaypointIndex = 0;
            
            // 안전한 메시지 전송 함수
            function safePostMessage(data) {
              try {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify(data));
                }
              } catch (error) {
                console.error('메시지 전송 실패:', error);
              }
            }
            
            // 지오코더 초기화 함수 정의
            function initGeocoder() {
              try {
                if (typeof kakao !== 'undefined' && kakao.maps && kakao.maps.services) {
                  geocoder = new kakao.maps.services.Geocoder();
                  console.log('지오코더 초기화 완료');
                } else {
                  console.warn('카카오맵 서비스가 아직 로드되지 않았습니다');
                }
              } catch (error) {
                console.error('지오코더 초기화 실패:', error);
              }
            }
            
            // 현재 위치의 도로명 가져오기 함수
            function getCurrentRoadName(lat, lng) {
              if (!geocoder) {
                console.warn('지오코더가 초기화되지 않았습니다');
                return;
              }
              
              var coord = new kakao.maps.LatLng(lat, lng);
              
              geocoder.coord2Address(coord.getLng(), coord.getLat(), function(result, status) {
                if (status === kakao.maps.services.Status.OK) {
                  try {
                    var roadName = '위치 확인 중';
                    
                    // 도로명 주소 우선 사용
                    if (result && result.length > 0 && result[0].road_address) {
                      roadName = result[0].road_address.road_name || 
                                result[0].road_address.address_name;
                    } 
                    // 지번 주소 사용
                    else if (result && result.length > 0 && result[0].address) {
                      // 동/읍/면 정보 추출
                      var addressParts = result[0].address.address_name.split(' ');
                      if (addressParts.length >= 3) {
                        roadName = addressParts[2]; // 동/읍/면
                      } else {
                        roadName = result[0].address.address_name;
                      }
                    }
                    
                    // 너무 긴 도로명은 줄임
                    if (roadName && roadName.length > 15) {
                      roadName = roadName.substring(0, 15) + '...';
                    }
                    
                    currentRoadName = roadName || '현재 위치';
                    console.log('현재 도로명 업데이트:', currentRoadName);
                    
                  } catch (parseError) {
                    console.error('주소 파싱 오류:', parseError);
                    currentRoadName = '주소 확인 중';
                  }
                } else {
                  console.warn('주소 검색 실패:', status);
                  currentRoadName = '위치 확인 중';
                }
              });
            }
            
            // 경로 상의 실제 도로명 가져오기 함수
            function getRoadNameFromRoute(lat, lng) {
              if (!currentRoute || !currentRoute.sections) {
                getCurrentRoadName(lat, lng);
                return;
              }
              
              try {
                // 현재 위치와 가장 가까운 경로상의 도로 찾기
                var minDistance = Infinity;
                var closestRoad = null;
                
                currentRoute.sections.forEach(function(section) {
                  if (section.roads) {
                      section.roads.forEach(function(road) {
                      if (road.vertexes && road.vertexes.length >= 2) {
                        // 도로의 각 점과 현재 위치의 거리 계산
                        for (var i = 0; i < road.vertexes.length; i += 2) {
                          if (i + 1 < road.vertexes.length) {
                            var roadLat = road.vertexes[i + 1];
                            var roadLng = road.vertexes[i];
                            var distance = calculateDistance(lat, lng, roadLat, roadLng);
                            
                            if (distance < minDistance) {
                              minDistance = distance;
                              closestRoad = road;
                            }
                          }
                        }
                      }
                    });
                  }
                });
                
                // 가장 가까운 도로의 이름 사용
                if (closestRoad && closestRoad.name && minDistance < 0.1) { // 100m 이내
                  var roadName = closestRoad.name;
                  
                  // 도로명 정제
                  if (roadName.includes('(') && roadName.includes(')')) {
                    roadName = roadName.split('(')[0].trim();
                  }
                  
                  // 너무 긴 도로명은 줄임
                  if (roadName.length > 15) {
                    roadName = roadName.substring(0, 15) + '...';
                  }
                  
                  currentRoadName = roadName;
                  console.log('경로상 도로명 업데이트:', currentRoadName);
                } else {
                  // 경로상에서 찾지 못하면 지오코더 사용
                  getCurrentRoadName(lat, lng);
                }
                
              } catch (routeError) {
                console.error('경로 도로명 검색 오류:', routeError);
                getCurrentRoadName(lat, lng);
              }
            }
            
            // 네트워크 연결 상태 확인
            function checkNetworkConnection() {
              return navigator.onLine;
            }
            
            // 카카오맵 SDK 로딩 상태 확인 및 로드
            var sdkLoadAttempts = 0;
            var maxSdkLoadAttempts = 10;
            var sdkCheckInterval = 200;
            
            function checkKakaoSDK() {
              return new Promise((resolve, reject) => {
                function checkSDK() {
                  sdkLoadAttempts++;
                  console.log('카카오 SDK 확인 시도:', sdkLoadAttempts + '/' + maxSdkLoadAttempts);
                  
                  // 카카오 객체 존재 확인
                  if (typeof kakao !== 'undefined' && kakao.maps) {
                    console.log('카카오 SDK 로드 확인됨');
                    resolve();
                    return;
                  }
                  
                  if (sdkLoadAttempts >= maxSdkLoadAttempts) {
                    console.error('카카오 SDK 로드 실패 - 최대 시도 횟수 초과');
                    reject(new Error('카카오 SDK 로드 시간 초과'));
                    return;
                  }
                  
                  // 다시 시도
                  setTimeout(checkSDK, sdkCheckInterval);
                }
                
                checkSDK();
              });
            }
            
            // 카카오맵 로드 - 개선된 로직
            function loadKakaoMap() {
              // 네트워크 연결 확인
              if (!checkNetworkConnection()) {
                console.error('네트워크 연결 없음');
                safePostMessage({
                  type: 'ERROR',
                  message: '네트워크 연결을 확인해주세요. 인터넷에 연결되어 있지 않습니다.'
                });
                return;
              }
              
              console.log('네트워크 연결 확인됨, 카카오 SDK 로드 시작');
              
              checkKakaoSDK()
                .then(() => {
                  console.log('카카오 SDK 준비 완료, 지도 로드 시작');
                  kakao.maps.load(function() {
                    console.log('카카오맵 로드 완료');
                    initNavigation();
                  });
                })
                .catch((error) => {
                  console.error('카카오 SDK 로드 실패:', error);
                  safePostMessage({
                    type: 'ERROR',
                    message: '카카오맵 SDK 로드 실패: ' + error.message + '. 네트워크 연결을 확인해주세요.'
                  });
                });
            }
            
            // 초기화 시작 - 플랫폼별 지연 시간 적용
            ${isAndroid ? 'setTimeout(loadKakaoMap, 1000);' : 'setTimeout(loadKakaoMap, 300);'}
            
            // 내비게이션 초기화 - 수정된 버전
            function initNavigation() {
              try {
                var mapContainer = document.getElementById('map');
                if (!mapContainer) {
                  throw new Error('지도 컨테이너를 찾을 수 없습니다.');
                }
                
                var mapOptions = {
                  center: new kakao.maps.LatLng(${currentLocation.latitude}, ${currentLocation.longitude}),
                  level: 1,
                  draggable: true,
                  scrollwheel: true,
                  disableDoubleClick: false,
                  disableDoubleClickZoom: false,
                  keyboardShortcuts: false
                };
                
                map = new kakao.maps.Map(mapContainer, mapOptions);
                map.setMapTypeId(kakao.maps.MapTypeId.ROADMAP);
                
                var zoomControl = new kakao.maps.ZoomControl();
                map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
                
                // 현재 위치 마커 생성
                var markerImageSrc = 'data:image/svg+xml;base64,' + btoa(\`
                  <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="12" fill="#007AFF" stroke="white" stroke-width="3"/>
                    <circle cx="16" cy="16" r="6" fill="white"/>
                    <polygon points="16,8 20,16 16,14 12,16" fill="#007AFF"/>
                  </svg>
                \`);
                
                var markerImage = new kakao.maps.MarkerImage(
                  markerImageSrc,
                  new kakao.maps.Size(32, 32),
                  {
                    offset: new kakao.maps.Point(16, 16)
                  }
                );
                
                currentMarker = new kakao.maps.Marker({
                  position: new kakao.maps.LatLng(${currentLocation.latitude}, ${currentLocation.longitude}),
                  map: map,
                  image: markerImage
                });
                
                // 경유지 및 목적지 마커 설정
                if (waypoints.length > 0) {
                  waypoints.forEach((waypoint, index) => {
                    var marker = new kakao.maps.Marker({
                      position: new kakao.maps.LatLng(waypoint.lat, waypoint.lng),
                      map: map
                    });
                    waypointMarkers.push(marker);
                  });
                } else {
                  destinationMarker = new kakao.maps.Marker({
                    position: new kakao.maps.LatLng(destination.lat, destination.lng),
                    map: map
                  });
                }
                
                // 지오코더 초기화 - 지도 초기화 후에 실행
                initGeocoder();
                
                // 경로 계산 및 내비게이션 시작
                calculateRouteToActiveWaypoint();
                startNavigation();
                
                // 초기화 완료 알림
                ${isAndroid ? `
                setTimeout(() => {
                  try {
                    map.relayout();
                    safePostMessage({
                      type: 'NAVIGATION_READY'
                    });
                  } catch (error) {
                    console.error('지도 리사이즈 오류:', error);
                  }
                }, 300);
                ` : `
                safePostMessage({
                  type: 'NAVIGATION_READY'
                });
                `}
                
              } catch (error) {
                console.error('내비게이션 초기화 오류:', error);
                safePostMessage({
                  type: 'ERROR',
                  message: '내비게이션 초기화 오류: ' + error.message
                });
              }
            }
            
            // 경로 계산 함수 - 오류 처리 개선
            async function calculateRouteToActiveWaypoint() {
              try {
                if (!currentMarker) {
                  throw new Error('현재 위치 마커가 없습니다.');
                }
                
                var origin = currentMarker.getPosition();
                var dest;
                var waypointsArr = [];

                // 경로 설정
                if (waypoints.length > 0) {
                  if (activeWaypointIndex >= waypoints.length) {
                    dest = {
                      x: destination.lng.toString(),
                      y: destination.lat.toString()
                    };
                  } else {
                    dest = {
                      x: waypoints[waypoints.length - 1].lng.toString(),
                      y: waypoints[waypoints.length - 1].lat.toString()
                    };
                    
                    for (let i = activeWaypointIndex; i < waypoints.length - 1; i++) {
                      waypointsArr.push({
                        x: waypoints[i].lng.toString(),
                        y: waypoints[i].lat.toString()
                      });
                    }
                  }
                } else {
                  dest = {
                    x: destination.lng.toString(),
                    y: destination.lat.toString()
                  };
                  
                  if (destinationMarker) {
                    destinationMarker.setVisible(true);
                  }
                }

                const requestData = {
                  origin: { 
                    x: origin.getLng().toString(), 
                    y: origin.getLat().toString() 
                  },
                  destination: dest,
                  waypoints: waypointsArr,
                  priority: 'RECOMMEND',
                  car_fuel: 'GASOLINE',
                  alternatives: false,
                  road_details: true
                };

                console.log('경로 API 요청:', JSON.stringify(requestData, null, 2));

                const response = await fetch('https://apis-navi.kakaomobility.com/v1/waypoints/directions', {
                  method: 'POST',
                  headers: {
                    'Authorization': 'KakaoAK 90fc3c147a2997ec441fd2cd8e87e2a8',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(requestData)
                });

                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('API 오류 응답:', response.status, errorText);
                  throw new Error('API 호출 실패: ' + response.status);
                }

                const data = await response.json();
                console.log('API 응답:', data);

                if (data.routes && data.routes.length > 0) {
                  const route = data.routes[0];
                  
                  if (routePolyline) {
                    routePolyline.setMap(null);
                  }
                  
                  drawRoute(route);
                  
                  const summary = route.summary;
                  safePostMessage({
                    type: 'ROUTE_CALCULATED',
                    distance: summary.distance,
                    duration: summary.duration,
                    isDestination: activeWaypointIndex >= waypoints.length
                  });
                  
                  currentRoute = route;
                  console.log('경로 계산 완료');
                  
                } else {
                  throw new Error('경로 데이터 없음');
                }
                
              } catch (error) {
                console.error('경로 계산 오류:', error);
                
                // 대체 직선 경로
                try {
                  var origin = currentMarker.getPosition();
                  drawFallbackRoute({
                    x: origin.getLng(),
                    y: origin.getLat()
                  }, dest);
                  
                  var distance = calculateDistance(
                    origin.getLat(), origin.getLng(),
                    parseFloat(dest.y), parseFloat(dest.x)
                  );
                  
                  safePostMessage({
                    type: 'ROUTE_CALCULATED',
                    distance: distance * 1000,
                    duration: Math.round(distance * 2) * 60,
                    isDestination: activeWaypointIndex >= waypoints.length,
                    fallback: true
                  });
                } catch (fallbackError) {
                  console.error('대체 경로 생성 실패:', fallbackError);
                  safePostMessage({
                    type: 'ERROR',
                    message: '경로 계산 실패: ' + error.message
                  });
                }
              }
            }
            
            // 경로 그리기 함수 - 안전성 개선
            function drawRoute(route) {
              try {
                const path = [];
                
                if (!route.sections) {
                  throw new Error('경로 섹션 데이터가 없습니다.');
                }
                
                route.sections.forEach(section => {
                  if (section.roads) {
                    section.roads.forEach(road => {
                      if (road.vertexes && road.vertexes.length >= 2) {
                        for (let i = 0; i < road.vertexes.length; i += 2) {
                          if (i + 1 < road.vertexes.length) {
                            path.push(new kakao.maps.LatLng(
                              road.vertexes[i + 1],
                              road.vertexes[i]
                            ));
                          }
                        }
                      }
                    });
                  }
                });
                
                if (path.length > 0) {
                  routePolyline = new kakao.maps.Polyline({
                    path: path,
                    strokeWeight: 8,
                    strokeColor: '#4A90E2',
                    strokeOpacity: 0.9,
                    strokeStyle: 'solid'
                  });
                  
                  routePolyline.setMap(map);
                  console.log('경로 그리기 완료, 포인트 수:', path.length);
                } else {
                  throw new Error('경로 포인트가 없습니다.');
                }
                
              } catch (error) {
                console.error('경로 그리기 오류:', error);
                safePostMessage({
                  type: 'ERROR',
                  message: '경로 그리기 오류: ' + error.message
                });
              }
            }
            
            // 대체 직선 경로 그리기
            function drawFallbackRoute(origin, dest) {
              try {
                if (routePolyline) {
                  routePolyline.setMap(null);
                }
                
                var path = [
                  new kakao.maps.LatLng(origin.y, origin.x),
                  new kakao.maps.LatLng(parseFloat(dest.y), parseFloat(dest.x))
                ];
                
                routePolyline = new kakao.maps.Polyline({
                  path: path,
                  strokeWeight: 6,
                  strokeColor: '#FF6B6B',
                  strokeOpacity: 0.8,
                  strokeStyle: 'shortdash'
                });
                
                routePolyline.setMap(map);
                console.log('대체 직선 경로 그리기 완료');
                
              } catch (error) {
                console.error('대체 경로 그리기 오류:', error);
              }
            }
            
            // 내비게이션 시작
            function startNavigation() {
              try {
                isNavigating = true;
                if (map && currentMarker) {
                  map.setCenter(currentMarker.getPosition());
                  map.setLevel(1);
                }
                
                safePostMessage({
                  type: 'NAVIGATION_STARTED'
                });
              } catch (error) {
                console.error('내비게이션 시작 오류:', error);
              }
            }
            
            // 위치 업데이트 처리 - 안전성 개선
            var userInteracted = false;
            var lastInteractionTime = 0;
            
            try {
              kakao.maps.event.addListener(map, 'dragstart', function() {
                userInteracted = true;
                lastInteractionTime = Date.now();
              });
              
              kakao.maps.event.addListener(map, 'zoom_start', function() {
                userInteracted = true;  
                lastInteractionTime = Date.now();
              });
            } catch (error) {
              console.error('이벤트 리스너 등록 오류:', error);
            }
            
            function updateCurrentLocation(lat, lng, speed) {
              try {
                if (!currentMarker || !map) {
                  console.warn('지도 또는 마커가 초기화되지 않았습니다.');
                  return;
                }
                
                var newPosition = new kakao.maps.LatLng(lat, lng);
                currentMarker.setPosition(newPosition);
                
                if (isNavigating) {
                  var timeSinceInteraction = Date.now() - lastInteractionTime;
                  
                  if (!userInteracted || timeSinceInteraction > 5000) {
                    userInteracted = false;
                    map.panTo(newPosition);
                  }
                  
                  // 실제 도로명 가져오기 (경로 기반 + 지오코딩)
                  getRoadNameFromRoute(lat, lng);
                  
                  // 다음 목적지 계산
                  var nextDestination;
                  if (waypoints.length > 0 && activeWaypointIndex < waypoints.length) {
                    nextDestination = new kakao.maps.LatLng(
                      waypoints[activeWaypointIndex].lat, 
                      waypoints[activeWaypointIndex].lng
                    );
                  } else {
                    nextDestination = new kakao.maps.LatLng(destination.lat, destination.lng);
                  }
                  
                  var distance = calculateDistance(
                    lat, lng,
                    nextDestination.getLat(), nextDestination.getLng()
                  );
                  
                  var timeInMinutes = speed > 5 
                    ? Math.round((distance / speed) * 60)
                    : Math.round(distance * 2);
                  
                  // 안내 정보 업데이트 - 카카오 네비 API 데이터 정확히 파싱
                  var nextTurnInstruction = '직진';
                  var nextTurnDistance = 0;
                  var nextTurnType = 'straight';
                  var foundGuide = false;
                  
                  if (currentRoute && currentRoute.sections && currentRoute.sections.length > 0) {
                    try {
                      console.log('전체 경로 정보:', JSON.stringify(currentRoute, null, 2));
                      
                      // 현재 위치에서 가장 가까운 다음 안내점 찾기
                      var bestGuide = null;
                      var minRouteDistance = Infinity;
                      
                      currentRoute.sections.forEach(function(section, sectionIndex) {
                        console.log('섹션 ' + sectionIndex + ':', section);
                        
                        if (section.guides && section.guides.length > 0) {
                          section.guides.forEach(function(guide, guideIndex) {
                            console.log('안내점 ' + guideIndex + ':', guide);
                            
                            if (guide.distance !== undefined && guide.distance > 0) {
                              // 경로상 거리가 가장 가까운 안내점 선택
                              if (guide.distance < minRouteDistance) {
                                minRouteDistance = guide.distance;
                                bestGuide = guide;
                                console.log('새로운 최적 안내점 발견:', {
                                  distance: guide.distance,
                                  type: guide.type,
                                  guidance: guide.guidance
                                });
                              }
                            }
                          });
                        }
                      });
                      
                      if (bestGuide && bestGuide.distance > 10) {
                        nextTurnDistance = bestGuide.distance;
                        nextTurnInstruction = bestGuide.guidance || getDefaultInstruction(bestGuide.type);
                        nextTurnType = getTurnTypeFromGuide(bestGuide.type);
                        foundGuide = true;
                        
                        console.log('최종 선택된 안내점:', {
                          distance: nextTurnDistance + 'm',
                          instruction: nextTurnInstruction,
                          type: bestGuide.type,
                          turnType: nextTurnType
                        });
                      } else {
                        console.log('유효한 안내점을 찾지 못함, 경로 분석 시도');
                        
                        // 안내점이 없으면 경로 형태 직접 분석
                        var routeAnalysis = analyzeRouteDirection(lat, lng, currentRoute);
                        if (routeAnalysis) {
                          nextTurnType = routeAnalysis.turnType;
                          nextTurnInstruction = routeAnalysis.instruction;
                          nextTurnDistance = routeAnalysis.distance;
                          foundGuide = true;
                          
                          console.log('경로 분석 결과:', routeAnalysis);
                        }
                      }
                      
                      // 거리 포맷팅
                      var distanceText;
                      if (foundGuide && nextTurnDistance > 0) {
                        if (nextTurnDistance < 100) {
                          distanceText = Math.round(nextTurnDistance) + 'm';
                        } else if (nextTurnDistance < 1000) {
                          distanceText = Math.round(nextTurnDistance / 10) * 10 + 'm';
                        } else {
                          distanceText = (nextTurnDistance / 1000).toFixed(1) + 'km';
                        }
                      } else {
                        // 목적지까지의 거리 사용
                        if (distance < 1) {
                          distanceText = Math.round(distance * 1000) + 'm';
                        } else {
                          distanceText = distance.toFixed(1) + 'km';
                        }
                        nextTurnInstruction = '목적지 방향으로 계속 이동';
                        nextTurnType = 'straight';
                      }
                      
                      console.log('전송할 턴 정보:', {
                        distance: distanceText,
                        instruction: nextTurnInstruction,
                        turnType: nextTurnType
                      });
                      
                      safePostMessage({
                        type: 'TURN_INSTRUCTION_UPDATE',
                        distance: distanceText,
                        instruction: nextTurnInstruction,
                        turnType: nextTurnType,
                        hasGuide: foundGuide
                      });
                      
                    } catch (guideError) {
                      console.error('안내 정보 처리 오류:', guideError);
                      safePostMessage({
                        type: 'TURN_INSTRUCTION_UPDATE',
                        distance: distance < 1 ? Math.round(distance * 1000) + 'm' : distance.toFixed(1) + 'km',
                        instruction: '목적지 방향으로 이동',
                        turnType: 'straight',
                        hasGuide: false
                      });
                    }
                  } else {
                    console.log('경로 정보 없음');
                    safePostMessage({
                      type: 'TURN_INSTRUCTION_UPDATE',
                      distance: distance < 1 ? Math.round(distance * 1000) + 'm' : distance.toFixed(1) + 'km',
                      instruction: '목적지 방향으로 이동',
                      turnType: 'straight',
                      hasGuide: false
                    });
                  }
                  
                  safePostMessage({
                    type: 'NAVIGATION_UPDATE',
                    distance: distance,
                    timeInMinutes: timeInMinutes,
                    currentSpeed: speed,
                    currentRoad: currentRoadName
                  });
                  
                  // 경유지 도착 확인
                  if (waypoints.length > 0 && activeWaypointIndex < waypoints.length) {
                    if (distance < 0.2) {
                      safePostMessage({
                        type: 'WAYPOINT_NEARBY',
                        waypointIndex: activeWaypointIndex,
                        distance: Math.round(distance * 1000)
                      });
                    }
                  }
                  
                  // 목적지 도착 확인
                  if (distance < 1.0) {
                    if (waypoints.length > 0 && activeWaypointIndex < waypoints.length) {
                      safePostMessage({
                        type: 'WAYPOINT_REACHED',
                        waypointIndex: activeWaypointIndex
                      });
                    } else {
                      safePostMessage({
                        type: 'DESTINATION_REACHED'
                      });
                      isNavigating = false;
                    }
                  }
                }
                
                previousPosition = newPosition;
              } catch (error) {
                console.error('위치 업데이트 오류:', error);
              }
            }
            
            // 턴 타입 변환 함수 - 개선된 버전
            function findNextRoutePoint(currentPos, roads) {
              try {
                var minDistance = Infinity;
                var nextPoint = null;
                var currentIndex = -1;
                
                // 현재 위치에서 가장 가까운 경로 점 찾기
                for (var roadIndex = 0; roadIndex < roads.length; roadIndex++) {
                  var road = roads[roadIndex];
                  if (road.vertexes && road.vertexes.length >= 2) {
                    for (var i = 0; i < road.vertexes.length; i += 2) {
                      if (i + 1 < road.vertexes.length) {
                        var routeLng = road.vertexes[i];
                        var routeLat = road.vertexes[i + 1];
                        var distance = calculateDistance(currentPos.lat, currentPos.lng, routeLat, routeLng);
                        
                        if (distance < minDistance) {
                          minDistance = distance;
                          currentIndex = i;
                          
                          // 다음 지점 찾기 (100m 정도 앞)
                          var lookAheadDistance = 0;
                          for (var j = i + 2; j < road.vertexes.length; j += 2) {
                            if (j + 1 < road.vertexes.length) {
                              var nextLng = road.vertexes[j];
                              var nextLat = road.vertexes[j + 1];
                              var segmentDistance = calculateDistance(routeLat, routeLng, nextLat, nextLng);
                              lookAheadDistance += segmentDistance;
                              
                              if (lookAheadDistance > 0.1) { // 100m 이상
                                nextPoint = { lat: nextLat, lng: nextLng };
                                break;
                              }
                              routeLat = nextLat;
                              routeLng = nextLng;
                            }
                          }
                        }
                      }
                    }
                  }
                }
                
                return nextPoint;
              } catch (error) {
                console.error('다음 경로 지점 찾기 오류:', error);
                return null;
              }
            }
            
            // 방향각 계산 함수
            function calculateBearing(from, to) {
              try {
                var lat1 = deg2rad(from.lat);
                var lat2 = deg2rad(to.lat);
                var deltaLng = deg2rad(to.lng - from.lng);
                
                var x = Math.sin(deltaLng) * Math.cos(lat2);
                var y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
                
                var bearing = Math.atan2(x, y);
                bearing = (bearing * 180 / Math.PI + 360) % 360; // 0-360도로 정규화
                
                return bearing;
              } catch (error) {
                console.error('방향각 계산 오류:', error);
                return 0;
              }
            }
            
            // 턴 방향 결정 함수
            function determineTurnDirection(bearing) {
              // 방향각을 기준으로 턴 방향 결정
              if (bearing >= 315 || bearing < 45) {
                return { type: 'straight', instruction: '직진하세요' };
              } else if (bearing >= 45 && bearing < 135) {
                return { type: 'right', instruction: '우회전하세요' };
              } else if (bearing >= 135 && bearing < 225) {
                return { type: 'uturn', instruction: '유턴하세요' };
              } else if (bearing >= 225 && bearing < 315) {
                return { type: 'left', instruction: '좌회전하세요' };
              } else {
                return { type: 'straight', instruction: '직진하세요' };
              }
            }
            function getTurnTypeFromGuide(guideType) {
              // guideType이 숫자가 아닌 경우 처리
              if (typeof guideType !== 'number') {
                console.warn('잘못된 가이드 타입:', guideType);
                return 'straight';
              }
              
              switch(guideType) {
                case 1: return 'straight';      // 직진
                case 2: return 'left';          // 좌회전
                case 3: return 'right';         // 우회전  
                case 4: return 'uturn';         // 유턴
                case 5: return 'slight_left';   // 좌측 방향
                case 6: return 'slight_right';  // 우측 방향
                case 7: return 'left';          // 좌측 도로
                case 8: return 'right';         // 우측 도로
                case 10: return 'straight';     // 고속도로 진입
                case 11: return 'straight';     // 고속도로 진출
                case 12: return 'left';         // 고속도로 좌측
                case 13: return 'right';        // 고속도로 우측
                case 14: return 'straight';     // 터널 진입
                case 15: return 'straight';     // 다리
                case 16: return 'straight';     // 지하차도
                case 17: return 'straight';     // 고가도로
                case 125: return 'straight';    // 직진 (명시적)
                case 126: return 'left';        // 좌회전 (명시적)
                case 127: return 'right';       // 우회전 (명시적)
                default: 
                  console.log('알 수 없는 가이드 타입:', guideType);
                  return 'straight';
              }
            }
            
            // 두 지점 간 거리 계산
            function calculateDistance(lat1, lon1, lat2, lon2) {
              try {
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
              } catch (error) {
                console.error('거리 계산 오류:', error);
                return 0;
              }
            }
            
            function deg2rad(deg) {
              return deg * (Math.PI/180);
            }
            
            // 메시지 수신 처리 - 안전성 개선
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
                    updateCurrentLocation(message.latitude, message.longitude, message.speed);
                    break;
                    
                  case 'UPDATE_ACTIVE_WAYPOINT':
                    activeWaypointIndex = message.waypointIndex;
                    
                    // 마커 업데이트
                    try {
                      waypointMarkers.forEach(function(marker, index) {
                        if (index === activeWaypointIndex) {
                          marker.setZIndex(10);
                        } else if (index < activeWaypointIndex) {
                          marker.setOpacity(0.5);
                        }
                      });
                    } catch (markerError) {
                      console.warn('마커 업데이트 오류:', markerError);
                    }
                    
                    calculateRouteToActiveWaypoint();
                    break;
                    
                  case 'NAVIGATE_TO_DESTINATION':
                    activeWaypointIndex = waypoints.length;
                    
                    if (destinationMarker) {
                      destinationMarker.setVisible(true);
                    }
                    
                    calculateRouteToActiveWaypoint();
                    break;
                    
                  case 'RECALCULATE_ROUTE':
                    calculateRouteToActiveWaypoint();
                    break;
                    
                  case 'STOP_NAVIGATION':
                    isNavigating = false;
                    break;
                    
                  case 'FORCE_REFRESH':
                    if (map) {
                      try {
                        map.relayout();
                      } catch (refreshError) {
                        console.warn('지도 새로고침 오류:', refreshError);
                      }
                    }
                    break;
                }
              } catch (error) {
                console.error('메시지 처리 오류:', error);
                safePostMessage({
                  type: 'ERROR',
                  message: '메시지 처리 오류: ' + error.message
                });
              }
            }
          </script>
        </body>
      </html>
    `;
  };

  // WebView 메시지 핸들러 - 오류 처리 개선
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'NAVIGATION_READY':
          console.log('내비게이션 준비 완료');
          setIsNavigating(true);
          setWebViewLoaded(true);
          setWebViewError(false);
          break;
          
        case 'ROUTE_CALCULATED':
          console.log('경로 계산 완료:', data);
          
          const distanceInKm = data.distance / 1000;
          setRemainingDistance(formatDistance(distanceInKm));
          
          const now = new Date();
          const arrivalTime = new Date(now.getTime() + data.duration * 1000);
          const hours = arrivalTime.getHours();
          const minutes = arrivalTime.getMinutes();
          const ampm = hours >= 12 ? '오후' : '오전';
          const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
          
          setRemainingTime(`${ampm} ${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
          
          if (data.fallback) {
            console.log('대체 직선 경로 사용 중');
          } else {
            console.log('정상 전체 경로 사용 중');
          }
          break;
          
        case 'NAVIGATION_UPDATE':
          const distance = data.distance;
          const timeInMinutes = data.timeInMinutes;
          
          setRemainingDistance(formatDistance(distance));
          
          const currentTime = new Date();
          const estimatedArrival = new Date(currentTime.getTime() + timeInMinutes * 60000);
          const arrHours = estimatedArrival.getHours();
          const arrMinutes = estimatedArrival.getMinutes();
          const arrAmpm = arrHours >= 12 ? '오후' : '오전';
          const arrDisplayHours = arrHours > 12 ? arrHours - 12 : arrHours === 0 ? 12 : arrHours;
          
          setRemainingTime(`${arrAmpm} ${String(arrDisplayHours).padStart(2, '0')}:${String(arrMinutes).padStart(2, '0')}`);
          
          setCurrentSpeed(Math.round(data.currentSpeed));
          setCurrentRoad(data.currentRoad);
          
          if (waypoints.length > 0 && currentWaypointIndex < waypoints.length && distance < 0.2) {
            setShowCompleteButton(true);
          }
          break;
          
        case 'SPEED_LIMIT_UPDATE':
          setSpeedLimit(data.speedLimit);
          break;
          
        case 'TURN_INSTRUCTION_UPDATE':
          console.log('턴 안내 정보 업데이트:', data);
          setNextInstructionDistance(data.distance);
          setNextInstruction(data.instruction);
          setNextTurnType(data.turnType);
          break;
          
        case 'WAYPOINT_NEARBY':
          console.log('경유지 200m 반경 내 진입:', data.waypointIndex + 1, '거리:', data.distance + 'm');
          setShowCompleteButton(true);
          break;
          
        case 'WAYPOINT_REACHED':
          console.log('경유지 1km 내 도착:', data.waypointIndex + 1);
          setShowCompleteButton(true);
          break;
          
        case 'DESTINATION_REACHED':
          console.log('목적지 도착');
          setIsNavigating(false);
          Alert.alert('목적지 도착', '내비게이션을 종료합니다.', [
            { text: '확인', onPress: () => navigation.goBack() }
          ]);
          break;
          
        case 'ERROR':
          console.error('내비게이션 오류:', data.message);
          // Script error가 아닌 경우에만 에러로 처리
          if (!data.message.includes('Script error')) {
            setWebViewError(true);
          }
          break;
      }
    } catch (error) {
      console.error('메시지 처리 오류:', error);
      // JSON 파싱 오류는 무시 (정상적인 상황에서도 발생할 수 있음)
      if (!error.message.includes('JSON')) {
        setWebViewError(true);
      }
    }
  };
  
  // 내비게이션 종료
  const stopNavigation = () => {
    try {
      if (webViewRef.current && webViewLoaded) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'STOP_NAVIGATION'
        }));
      }
    } catch (error) {
      console.log('내비게이션 종료 메시지 전송 오류:', error);
    }
    navigation.goBack();
  };
  
  // 경로 재계산
  const recalculateRoute = () => {
    try {
      if (webViewRef.current && webViewLoaded) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'RECALCULATE_ROUTE'
        }));
      }
    } catch (error) {
      console.log('경로 재계산 메시지 전송 오류:', error);
    }
  };
  
  // 거리 포맷팅 함수
  const formatDistance = (distance) => {
    if (typeof distance === 'string') return distance;
    if (distance < 1) {
      return Math.round(distance * 1000) + 'm';
    } else {
      return distance.toFixed(1) + 'km';
    }
  };
  
  // 턴 아이콘 반환 함수
  const getTurnIcon = () => {
    if (!nextTurnType) return 'arrow-up';
    
    switch (nextTurnType) {
      case 'left':
        return 'arrow-back';
      case 'right':
        return 'arrow-forward';
      case 'uturn':
        return 'return-up-back';
      case 'straight':
      default:
        return 'arrow-up';
    }
  };

  // 속도 색상 결정 함수
  const getSpeedColor = () => {
    if (!speedLimit) return '#fff';
    
    const speedRatio = currentSpeed / speedLimit;
    if (speedRatio > 1.1) return '#ff4757'; // 제한속도 초과 (빨간색)
    if (speedRatio > 0.9) return '#ffa502'; // 제한속도 근접 (주황색)
    return '#fff'; // 정상 (흰색)
  };

  // 로딩 컴포넌트
  const LoadingIndicator = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#1a73e8" />
      <Text style={styles.loadingText}>내비게이션을 준비하는 중...</Text>
    </View>
  );

  // WebView 재로드 함수
  const reloadWebView = () => {
    try {
      setWebViewError(false);
      setWebViewLoaded(false);
      if (webViewRef.current) {
        webViewRef.current.reload();
      }
    } catch (error) {
      console.log('WebView 재로드 오류:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />
      
      {/* 상단 네비게이션 바 */}
      <View style={styles.topNavBar}>
        <View style={styles.topNavLeft}>
          <View style={styles.turnIndicator}>
            <Ionicons name={getTurnIcon()} size={32} color="#fff" />
          </View>
          <View style={styles.instructionContainer}>
            <Text style={styles.nextInstructionDistance}>
              {nextInstructionDistance || '계산 중...'}
            </Text>
            <Text style={styles.nextInstructionText}>
              {nextInstruction || '경로 계산 중...'}
            </Text>
          </View>
        </View>
        
        {/* 속도 표시 영역 */}
        <View style={styles.speedContainer}>
          <View style={[styles.speedIndicator, { borderColor: getSpeedColor() }]}>
            <Text style={[styles.currentSpeed, { color: getSpeedColor() }]}>
              {currentSpeed}
            </Text>
            <Text style={[styles.speedUnit, { color: getSpeedColor() }]}>
              km/h
            </Text>
          </View>
          {speedLimit && (
            <View style={styles.speedLimitContainer}>
              <Text style={styles.speedLimitText}>{speedLimit}</Text>
            </View>
          )}
        </View>
      </View>

      {/* 지도 영역 */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: generateNavigationHTML() }}
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
            allowsBackForwardNavigationGestures: false,
            dataDetectorTypes: 'none',
            hideKeyboardAccessoryView: true,
            keyboardDisplayRequiresUserAction: false,
            injectedJavaScript: 'true;',
          })}
          
          // 안드로이드 전용 설정
          {...(Platform.OS === 'android' && {
            mixedContentMode: 'compatibility',
            androidLayerType: 'hardware',
            androidHardwareAccelerationDisabled: false,
            cacheEnabled: true,
            thirdPartyCookiesEnabled: true,
            allowFileAccess: true,
            allowUniversalAccessFromFileURLs: true,
            javaScriptCanOpenWindowsAutomatically: true,
            mediaPlaybackRequiresUserAction: false,
            overScrollMode: 'never',
            nestedScrollEnabled: true,
            domStorageEnabled: true,
            startInLoadingState: true,
            allowsFullscreenVideo: false,
            userAgent: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36'
          })}
          
          // 공통 설정
          startInLoadingState={true}
          scalesPageToFit={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          
          // 로딩 및 에러 처리 개선
          renderLoading={() => <LoadingIndicator />}
          onError={(error) => {
            console.log('WebView 오류:', error);
            if (error.nativeEvent.description && 
                !error.nativeEvent.description.includes('Script error') &&
                !error.nativeEvent.description.includes('net::')) {
              setWebViewError(true);
            }
          }}
          
          onLoadEnd={() => {
            console.log('WebView 로딩 완료');
            const delay = Platform.OS === 'android' ? 1500 : 500;
            setTimeout(() => {
              if (!webViewError) {
                console.log('WebView 로딩 상태를 활성화합니다');
                setWebViewLoaded(true);
              }
            }, delay);
          }}
          
          onLoadStart={() => {
            console.log('WebView 로딩 시작');
            setWebViewLoaded(false);
            setWebViewError(false);
          }}
          
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.log('HTTP 오류:', nativeEvent.statusCode, nativeEvent.url);
            if (nativeEvent.url && nativeEvent.url.includes('kakao')) {
              setWebViewError(true);
            }
          }}
          
          style={styles.webView}
        />
        
        {/* 도로명 표시 */}
        {currentRoad && (
          <View style={styles.roadNameContainer}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.roadNameText}>{currentRoad}</Text>
          </View>
        )}
        
        {/* 수거 완료 버튼 */}
        {waypoints.length > 0 && currentWaypointIndex < waypoints.length && showCompleteButton && (
          <View style={styles.completeButtonContainer}>
            <View style={styles.waypointDistanceInfo}>
              <Text style={styles.waypointDistanceText}>
                수거지 {currentWaypointIndex + 1}/{waypoints.length} - {remainingDistance || '거리 계산 중'}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.completeButton}
              onPress={handleCollectionComplete}
            >
              <Ionicons name="checkmark" size={24} color="#fff" />
              <Text style={styles.completeButtonText}>수거 완료</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* 에러 표시 */}
        {webViewError && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={32} color="#ff6b6b" />
            <Text style={styles.errorText}>내비게이션 로딩 중 문제가 발생했습니다</Text>
            <Text style={styles.errorSubText}>네트워크 연결을 확인하고 다시 시도해주세요</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={reloadWebView}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 하단 정보 바 */}
      <View style={styles.bottomInfoBar}>
        <View style={styles.bottomLeft}>
          <TouchableOpacity style={styles.recalculateButton} onPress={recalculateRoute}>
            <Ionicons name="refresh" size={20} color="#666" />
          </TouchableOpacity>
          <View style={styles.timeDistanceContainer}>
            <Text style={styles.arrivalTime}>
              {remainingTime || '계산 중...'}
            </Text>
            <Text style={styles.remainingDistance}>
              {remainingDistance || '계산 중...'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => {
            Alert.alert(
              '내비게이션 종료',
              '내비게이션을 종료하시겠습니까?',
              [
                { text: '취소', style: 'cancel' },
                { text: '종료', onPress: stopNavigation }
              ]
            );
          }}
        >
          <Ionicons name="menu" size={24} color="#666" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a73e8',
    height: 80,
  },
  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  turnIndicator: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionContainer: {
    flex: 1,
  },
  nextInstructionDistance: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  nextInstructionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  // 속도 표시 관련 스타일 추가
  speedContainer: {
    alignItems: 'center',
    marginLeft: 12,
  },
  speedIndicator: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  currentSpeed: {
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  speedUnit: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
  },
  speedLimitContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ff4757',
  },
  speedLimitText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ff4757',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // 도로명 표시 관련 스타일 추가
  roadNameContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roadNameText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
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
  completeButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  waypointDistanceInfo: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  waypointDistanceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 6,
  },
  errorContainer: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    transform: [{ translateY: -50 }],
  },
  errorText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  errorSubText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a73e8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  bottomInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    height: 70,
  },
  bottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recalculateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  timeDistanceContainer: {
    flex: 1,
  },
  arrivalTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  remainingDistance: {
    fontSize: 14,
    color: '#666',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NavigationView;