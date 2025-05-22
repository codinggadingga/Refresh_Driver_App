import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Alert,
  Platform,
  SafeAreaView
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
  const [speed, setSpeed] = useState(0);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
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
        
        // 위치 추적 시작
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 5, // 5미터마다 업데이트
            timeInterval: 1000 // 1초마다 업데이트
          },
          (location) => {
            const { latitude, longitude, speed } = location.coords;
            setCurrentLocation({
              latitude,
              longitude
            });
            setSpeed(speed * 3.6); // m/s를 km/h로 변환
            
            // WebView에 현재 위치 전송
            if (webViewRef.current && isNavigating) {
              webViewRef.current.postMessage(JSON.stringify({
                type: 'UPDATE_LOCATION',
                latitude,
                longitude,
                speed: speed * 3.6
              }));
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
  }, [isNavigating]);
  
  // 수거 완료 처리 함수
  const handleCollectionComplete = () => {
    if (currentWaypointIndex < waypoints.length - 1) {
      const nextIndex = currentWaypointIndex + 1;
      setCurrentWaypointIndex(nextIndex);
      
      // WebView에 다음 경유지 업데이트 메시지 전송
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'UPDATE_ACTIVE_WAYPOINT',
          waypointIndex: nextIndex
        }));
      }
    } else {
      // 모든 경유지 완료 - 목적지로 안내
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'NAVIGATE_TO_DESTINATION'
        }));
      }
      Alert.alert('안내 완료', '모든 수거지를 방문했습니다. 목적지로 안내합니다.');
    }
  };
  
  // 내비게이션 HTML 생성
  const generateNavigationHTML = () => {
    // 목적지와 경유지 좌표 변환
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
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            body, html { 
              margin: 0; 
              padding: 0; 
              width: 100%; 
              height: 100%; 
              overflow: hidden;
              background-color: #000;
            }
            #map-container {
              width: 100%;
              height: 100%;
              position: relative;
              perspective: 1000px;
              transform-style: preserve-3d;
              overflow: hidden;
            }
            #map { 
              width: 100%; 
              height: 100%; 
              background-color: #f5f5f5;
              transform: rotateX(30deg);
              transform-origin: center bottom;
              transition: transform 0.5s ease;
            }
            .instruction-box {
              position: absolute;
              top: 20px;
              left: 50%;
              transform: translateX(-50%);
              background-color: white;
              padding: 10px 15px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.2);
              z-index: 1000;
              min-width: 200px;
              text-align: center;
            }
            .distance-time {
              position: absolute;
              bottom: 30px;
              left: 50%;
              transform: translateX(-50%);
              background-color: rgba(0,0,0,0.7);
              color: white;
              padding: 10px 15px;
              border-radius: 20px;
              z-index: 1000;
              min-width: 200px;
              text-align: center;
            }
            .arrow-container {
              margin-bottom: 10px;
            }
            .arrow {
              width: 40px;
              height: 40px;
            }
            .current-location-indicator {
              position: absolute;
              bottom: 50%;
              left: 50%;
              width: 20px;
              height: 20px;
              margin-left: -10px;
              margin-bottom: -10px;
              background-color: #0077ff;
              border-radius: 50%;
              border: 2px solid white;
              z-index: 1001;
              box-shadow: 0 0 10px rgba(0,0,0,0.5);
              display: none;
            }
            .road-name {
              position: absolute;
              bottom: 100px;
              left: 50%;
              transform: translateX(-50%);
              background-color: rgba(0,0,0,0.7);
              color: white;
              padding: 8px 12px;
              border-radius: 15px;
              z-index: 1000;
              min-width: 150px;
              text-align: center;
              font-weight: bold;
            }
          </style>
          <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=30a7f8ffd1d5af779f063d9fa779b8b4&libraries=services&autoload=false"></script>
        </head>
        <body>
          <div id="map-container">
            <div id="map"></div>
            <div id="instruction" class="instruction-box" style="display: none;">
              <div class="arrow-container">
                <img id="arrow" class="arrow" src="https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/arrow_straight.png" alt="방향">
              </div>
              <div id="instruction-text">직진 중</div>
            </div>
            <div id="road-name" class="road-name" style="display: none;">도로명</div>
            <div id="distance-time" class="distance-time" style="display: none;">
              <div id="remaining-distance">남은 거리: 계산 중...</div>
              <div id="remaining-time">남은 시간: 계산 중...</div>
            </div>
          </div>
          
          <script>
            // 카카오맵 로드
            kakao.maps.load(function() {
              initNavigation();
            });
            
            var map;
            var currentMarker;
            var destinationMarker;
            var waypointMarkers = [];
            var routePolyline;
            var isNavigating = false;
            var currentRoute = null;
            var previousPosition = null;
            
            // 목적지 좌표
            var destination = ${JSON.stringify(destCoord)};
            
            // 경유지 좌표
            var waypoints = ${JSON.stringify(waypointsCoords)};
            var activeWaypointIndex = 0;
            
            // 내비게이션 초기화
            function initNavigation() {
              try {
                // 지도 생성
                var mapContainer = document.getElementById('map');
                var mapOptions = {
                  center: new kakao.maps.LatLng(${currentLocation.latitude}, ${currentLocation.longitude}),
                  level: 3
                };
                
                map = new kakao.maps.Map(mapContainer, mapOptions);
                
                // 현재 위치 마커 생성
                currentMarker = new kakao.maps.Marker({
                  position: new kakao.maps.LatLng(${currentLocation.latitude}, ${currentLocation.longitude}),
                  map: map,
                  image: new kakao.maps.MarkerImage(
                    'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/red_b.png',
                    new kakao.maps.Size(26, 26),
                    {
                      offset: new kakao.maps.Point(13, 13)
                    }
                  )
                });
                
                // 목적지 마커 생성 (초기에는 숨김)
                destinationMarker = new kakao.maps.Marker({
                  position: new kakao.maps.LatLng(destination.lat, destination.lng),
                  map: map,
                  visible: false
                });
                
                // 첫 번째 경유지만 표시
                if (waypoints.length > 0) {
                  var marker = new kakao.maps.Marker({
                    position: new kakao.maps.LatLng(waypoints[0].lat, waypoints[0].lng),
                    map: map
                  });
                  waypointMarkers.push(marker);
                }
                
                // 경로 계산 및 표시
                calculateRouteToActiveWaypoint();
                
                // 내비게이션 시작
                startNavigation();
                
                // 지도 로드 완료 메시지
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'NAVIGATION_READY'
                }));
              } catch (error) {
                console.error('내비게이션 초기화 오류:', error);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ERROR',
                  message: '내비게이션 초기화 오류: ' + error.message
                }));
              }
            }
            
            // 활성 경유지까지의 경로 계산
            function calculateRouteToActiveWaypoint() {
              try {
                // 현재 위치
                var origin = {
                  x: currentMarker.getPosition().getLng(),
                  y: currentMarker.getPosition().getLat()
                };
                
                var dest;
                
                if (waypoints.length > 0 && activeWaypointIndex < waypoints.length) {
                  // 활성 경유지로 안내
                  dest = {
                    x: waypoints[activeWaypointIndex].lng,
                    y: waypoints[activeWaypointIndex].lat
                  };
                } else {
                  // 목적지로 안내
                  dest = {
                    x: destination.lng,
                    y: destination.lat
                  };
                  
                  // 목적지 마커 표시
                  destinationMarker.setVisible(true);
                }
                
                // API 요청 데이터 구성
                var requestData = {
                  origin: origin,
                  destination: dest,
                  priority: "RECOMMEND",
                  road_details: true
                };
                
                // 카카오모빌리티 API 직접 호출
                fetch('https://apis-navi.kakaomobility.com/v1/directions', {
                  method: 'POST',
                  headers: {
                    'Authorization': 'KakaoAK 90fc3c147a2997ec441fd2cd8e87e2a8',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(requestData)
                })
                .then(response => response.json())
                .then(data => {
                  if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    
                    // 기존 경로 제거
                    if (routePolyline) {
                      routePolyline.setMap(null);
                    }
                    
                    // 경로 그리기
                    drawRoute(route);
                    
                    // 내비게이션 정보 업데이트
                    const summary = route.summary;
                    updateNavigationInfo(
                      summary.distance / 1000, // 미터를 킬로미터로 변환
                      Math.round(summary.duration / 60) // 초를 분으로 변환
                    );
                    
                    // 턴바이턴 안내 정보 업데이트
                    if (route.sections && route.sections.length > 0) {
                      updateTurnByTurnGuidance(route.sections[0]);
                    }
                    
                    // 경로 정보 전송
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'ROUTE_CALCULATED',
                      distance: summary.distance,
                      duration: summary.duration,
                      isDestination: activeWaypointIndex >= waypoints.length
                    }));
                    
                    // 현재 경로 저장
                    currentRoute = route;
                  } else {
                    console.error('경로를 찾을 수 없습니다.');
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'ERROR',
                      message: '경로를 찾을 수 없습니다.'
                    }));
                  }
                })
                .catch(error => {
                  console.error('경로 계산 오류:', error);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'ERROR',
                    message: '경로 계산 오류: ' + error.message
                  }));
                });
              } catch (error) {
                console.error('경로 계산 오류:', error);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ERROR',
                  message: '경로 계산 오류: ' + error.message
                }));
              }
            }
            
            // 경로 그리기 함수
            function drawRoute(route) {
              try {
                // 모든 경로 좌표 수집
                const path = [];
                
                // 섹션별로 경로 좌표 추출
                route.sections.forEach(section => {
                  section.roads.forEach(road => {
                    // vertexes는 [x1, y1, x2, y2, ...] 형태로 제공됨
                    for (let i = 0; i < road.vertexes.length; i += 2) {
                      if (i + 1 < road.vertexes.length) {
                        path.push(new kakao.maps.LatLng(
                          road.vertexes[i + 1], // 위도(y)
                          road.vertexes[i]      // 경도(x)
                        ));
                      }
                    }
                  });
                });
                
                // 경로 폴리라인 생성 - 3D 효과를 위해 두껍게 설정
                routePolyline = new kakao.maps.Polyline({
                  path: path,
                  strokeWeight: 8, // 더 두꺼운 선
                  strokeColor: '#0077ff',
                  strokeOpacity: 0.8,
                  strokeStyle: 'solid'
                });
                
                // 지도에 경로 표시
                routePolyline.setMap(map);
                
                // 모든 경로가 보이도록 지도 범위 조정
                const bounds = new kakao.maps.LatLngBounds();
                path.forEach(point => {
                  bounds.extend(point);
                });
                map.setBounds(bounds);
                
                // 도로명 표시
                if (route.sections[0] && route.sections[0].roads[0]) {
                  const roadName = route.sections[0].roads[0].name || '이름 없는 도로';
                  document.getElementById('road-name').textContent = roadName;
                  document.getElementById('road-name').style.display = 'block';
                }
              } catch (error) {
                console.error('경로 그리기 오류:', error);
              }
            }
            
            // 턴바이턴 안내 정보 업데이트 함수
            function updateTurnByTurnGuidance(section) {
              if (!section || !section.guides || section.guides.length === 0) return;
              
              // 다음 안내 지점 정보 가져오기
              const nextGuide = section.guides.find(guide => guide.type !== 100 && guide.type !== 1000 && guide.type !== 101);
              
              if (nextGuide) {
                // 안내 메시지 업데이트
                const instructionText = nextGuide.guidance || '직진 중';
                document.getElementById('instruction-text').textContent = instructionText;
                
                // 방향 화살표 업데이트
                const arrowType = getTurnTypeImage(nextGuide.type);
                document.getElementById('arrow').src = arrowType;
                
                // 안내 표시
                document.getElementById('instruction').style.display = 'block';
                
                // 안내 정보 전송
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'NEXT_INSTRUCTION',
                  instruction: instructionText,
                  distance: nextGuide.distance,
                  duration: nextGuide.duration
                }));
              }
            }
            
            // 턴 타입에 따른 이미지 URL 반환
            function getTurnTypeImage(turnType) {
              // 카카오모빌리티 API의 턴 타입에 따른 이미지 매핑
              switch (turnType) {
                case 1: // 좌회전
                  return 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/arrow_turn_left.png';
                case 2: // 우회전
                  return 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/arrow_turn_right.png';
                case 3: // 직진
                  return 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/arrow_straight.png';
                case 4: // 유턴
                  return 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/arrow_uturn.png';
                default:
                  return 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/arrow_straight.png';
              }
            }
            
            // 내비게이션 시작
            function startNavigation() {
              isNavigating = true;
              document.getElementById('instruction').style.display = 'block';
              document.getElementById('distance-time').style.display = 'block';
              document.getElementById('road-name').style.display = 'block';
              
              // 현재 위치 중심으로 지도 설정
              map.setCenter(currentMarker.getPosition());
              map.setLevel(3);
              
              // 내비게이션 시작 메시지
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'NAVIGATION_STARTED'
              }));
            }
            
            // 내비게이션 정보 업데이트
            function updateNavigationInfo(distance, timeInMinutes) {
              var distanceText = distance < 1 
                ? Math.round(distance * 1000) + 'm' 
                : distance.toFixed(1) + 'km';
              
              var timeText = timeInMinutes < 60 
                ? timeInMinutes + '분' 
                : Math.floor(timeInMinutes / 60) + '시간 ' + (timeInMinutes % 60) + '분';
              
              document.getElementById('remaining-distance').textContent = '남은 거리: ' + distanceText;
              document.getElementById('remaining-time').textContent = '남은 시간: ' + timeText;
            }
            
            // 위치 업데이트 처리
            function updateCurrentLocation(lat, lng, speed) {
              var newPosition = new kakao.maps.LatLng(lat, lng);
              
              // 마커 위치 업데이트
              currentMarker.setPosition(newPosition);
              
              // 내비게이션 중이면 지도 중심 업데이트 및 3D 효과 적용
              if (isNavigating) {
                // 지도 중심 업데이트
                map.setCenter(newPosition);
                
                // 속도에 따라 CSS 변환 조정 (3D 효과)
                var tilt = Math.min(45, 30 + (speed / 10)); // 속도가 빠를수록 더 기울임 (최대 45도)
                document.getElementById('map').style.transform = 'rotateX(' + tilt + 'deg)';
                
                // 현재 목적지 좌표 (활성 경유지 또는 최종 목적지)
                var nextDestination;
                if (waypoints.length > 0 && activeWaypointIndex < waypoints.length) {
                  nextDestination = new kakao.maps.LatLng(
                    waypoints[activeWaypointIndex].lat, 
                    waypoints[activeWaypointIndex].lng
                  );
                } else {
                  nextDestination = new kakao.maps.LatLng(destination.lat, destination.lng);
                }
                
                // 거리 계산
                var distance = calculateDistance(
                  lat, lng,
                  nextDestination.getLat(), nextDestination.getLng()
                );
                
                // 예상 시간 (현재 속도 기반)
                var timeInMinutes = speed > 5 
                  ? Math.round((distance / speed) * 60) // 시속 -> 분
                  : Math.round(distance * 2); // 기본 예상 (km당 2분)
                
                // 내비게이션 정보 업데이트
                updateNavigationInfo(distance, timeInMinutes);
                
                // 도착 확인 (50m 이내)
                if (distance < 0.05) {
                  if (waypoints.length > 0 && activeWaypointIndex < waypoints.length) {
                    // 경유지 도착
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'WAYPOINT_REACHED',
                      waypointIndex: activeWaypointIndex
                    }));
                  } else {
                    // 최종 목적지 도착
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'DESTINATION_REACHED'
                    }));
                    
                    // 내비게이션 종료
                    isNavigating = false;
                    document.getElementById('instruction').style.display = 'none';
                    document.getElementById('distance-time').style.display = 'none';
                    document.getElementById('road-name').style.display = 'none';
                  }
                }
              }
              
              // 현재 위치 저장 (다음 업데이트에서 방향 계산에 사용)
              previousPosition = newPosition;
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
            
            // 메시지 수신 처리
            window.addEventListener('message', function(e) {
              try {
                var data = JSON.parse(e.data);
                
                switch(data.type) {
                  case 'UPDATE_LOCATION':
                    // 현재 위치 업데이트
                    updateCurrentLocation(data.latitude, data.longitude, data.speed);
                    break;
                    
                  case 'UPDATE_ACTIVE_WAYPOINT':
                    // 활성 경유지 업데이트
                    activeWaypointIndex = data.waypointIndex;
                    
                    // 기존 경유지 마커 제거
                    waypointMarkers.forEach(marker => marker.setMap(null));
                    waypointMarkers = [];
                    
                    // 새 경유지 마커 생성
                    if (waypoints.length > 0 && activeWaypointIndex < waypoints.length) {
                      var marker = new kakao.maps.Marker({
                        position: new kakao.maps.LatLng(
                          waypoints[activeWaypointIndex].lat, 
                          waypoints[activeWaypointIndex].lng
                        ),
                        map: map
                      });
                      waypointMarkers.push(marker);
                    }
                    
                    // 경로 재계산
                    calculateRouteToActiveWaypoint();
                    break;
                    
                  case 'NAVIGATE_TO_DESTINATION':
                    // 목적지로 안내
                    activeWaypointIndex = waypoints.length; // 모든 경유지 완료
                    
                    // 경유지 마커 제거
                    waypointMarkers.forEach(marker => marker.setMap(null));
                    waypointMarkers = [];
                    
                    // 목적지 마커 표시
                    destinationMarker.setVisible(true);
                    
                    // 경로 재계산
                    calculateRouteToActiveWaypoint();
                    break;
                    
                  case 'RECALCULATE_ROUTE':
                    // 경로 재계산
                    calculateRouteToActiveWaypoint();
                    break;
                    
                  case 'STOP_NAVIGATION':
                    // 내비게이션 종료
                    isNavigating = false;
                    document.getElementById('instruction').style.display = 'none';
                    document.getElementById('distance-time').style.display = 'none';
                    document.getElementById('road-name').style.display = 'none';
                    break;
                }
              } catch (error) {
                console.error('메시지 처리 오류:', error);
              }
            });
          </script>
        </body>
      </html>
    `;
  };
  
  // WebView 메시지 핸들러
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'NAVIGATION_READY':
          console.log('내비게이션 준비 완료');
          setIsNavigating(true);
          break;
          
        case 'ROUTE_CALCULATED':
          console.log('경로 계산 완료:', data);
          setRemainingDistance(data.distance);
          setRemainingTime(data.duration);
          break;
          
        case 'NEXT_INSTRUCTION':
          console.log('다음 안내:', data);
          setNextInstruction(data.instruction);
          break;
          
        case 'WAYPOINT_REACHED':
          console.log('경유지 도착:', data.waypointIndex);
          Alert.alert('수거지 도착', '수거 완료 후 다음 버튼을 눌러주세요.');
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
          Alert.alert('오류', data.message);
          break;
      }
    } catch (error) {
      console.error('메시지 처리 오류:', error);
    }
  };
  
  // 내비게이션 종료
  const stopNavigation = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'STOP_NAVIGATION'
      }));
    }
    navigation.goBack();
  };
  
  // 경로 재계산
  const recalculateRoute = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'RECALCULATE_ROUTE'
      }));
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
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
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerTitle}>
          <Text style={styles.titleText}>내비게이션</Text>
          <Text style={styles.subtitleText}>
            {waypoints.length > 0 ? `경유지 ${currentWaypointIndex + 1}/${waypoints.length}` : '목적지로 이동 중'}
          </Text>
        </View>
        
        <View style={styles.speedContainer}>
          <Text style={styles.speedText}>{Math.round(speed)} km/h</Text>
        </View>
      </View>
      
      <View style={styles.navigationContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: generateNavigationHTML() }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          mixedContentMode="compatibility"
          allowsInlineMediaPlayback={true}
          useWebKit={Platform.OS === 'ios'}
          style={styles.webView}
        />
        
        {waypoints.length > 0 && currentWaypointIndex < waypoints.length && (
          <TouchableOpacity 
            style={styles.completeButton}
            onPress={handleCollectionComplete}
          >
            <Text style={styles.completeButtonText}>수거 완료</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.recalculateButton}
          onPress={recalculateRoute}
        >
          <Ionicons name="refresh" size={24} color="#fff" />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#222',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitleText: {
    fontSize: 12,
    color: '#ccc',
  },
  speedContainer: {
    backgroundColor: '#0077ff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  speedText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  navigationContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  completeButton: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 24,
    alignItems: 'center',
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
  },
  recalculateButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#0077ff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  }
});

export default NavigationView;
