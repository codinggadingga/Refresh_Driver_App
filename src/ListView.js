import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator,
  Switch,
  Alert,
  Modal,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ListView = ({ 
  activeTab, 
  setActiveTab, 
  pickupList, 
  selectedPickups, 
  togglePickupSelection, 
  routeOptimized,
  toggleRouteOptimization,
  startRouteWithSelectedPickups,
  toggleViewMode,
  completePickup,
  launchKakaoNavigation,
  autoSelectOptimalRoute,
  clearAutoSelection,
  location,
  pickupCoordinates,
  calculateDistance,
  currentDriverDistrict,
  setSelectedPickups // 새로 추가된 prop
}) => {
  const [filteredList, setFilteredList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItemForDetail, setSelectedItemForDetail] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cachedDetails, setCachedDetails] = useState({});
  const [sortType, setSortType] = useState('distance'); // 초기값을 distance로 변경
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('all');
  const [selectedDistrict, setSelectedDistrict] = useState('전체');
  const [currentLocationDistrict, setCurrentLocationDistrict] = useState(null);
  const [isLocationBasedFilter, setIsLocationBasedFilter] = useState(false);
  const [hasInitialAutoSelect, setHasInitialAutoSelect] = useState(false);

  // 폐기물 타입별 색상
  const getWasteColor = useMemo(() => {
    const colorMap = {
      'CN': '#10B981', 'DS_1': '#F59E0B', 'PL': '#3B82F6', 'PP': '#8B5CF6',
      'GL': '#EF4444', 'TX': '#F97316', 'EL': '#6B7280', 'OR': '#84CC16',
    };
    return (wasteId) => colorMap[wasteId] || '#6B7280';
  }, []);

  // 거리 계산
  const calculateDistanceBetweenPoints = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // 주소에서 구 추출
  const extractDistrict = useCallback((address) => {
    if (!address) return '기타';
    const districtMatch = address.match(/\s([가-힣]{1,3}구)(?:\s|$)/);
    return districtMatch ? districtMatch[1] : '기타';
  }, []);

  // 현재 위치에서 수거지까지의 거리
  const calculateDistanceFromCurrentLocation = useCallback((pickupId) => {
    if (!location || !pickupCoordinates) return null;
    
    let coords = null;
    if (Array.isArray(pickupCoordinates)) {
      const coordData = pickupCoordinates.find(item => item.id === pickupId);
      if (coordData) {
        coords = { latitude: coordData.latitude, longitude: coordData.longitude };
      }
    } else {
      coords = pickupCoordinates[pickupId];
    }
    
    if (!coords) return null;
    
    return calculateDistanceBetweenPoints(
      location.latitude, location.longitude,
      coords.latitude, coords.longitude
    );
  }, [location, pickupCoordinates, calculateDistanceBetweenPoints]);

  // 시간대별 우선순위
  const getTimePriority = useCallback((dateString) => {
    if (!dateString) return 5;
    try {
      const hour = new Date(dateString).getHours();
      if (hour >= 6 && hour < 11) return 1;
      if (hour >= 11 && hour < 16) return 2;
      if (hour >= 16 && hour < 21) return 3;
      return 4;
    } catch {
      return 5;
    }
  }, []);

  // 시간대별 라벨
  const getTimeLabel = useCallback((dateString) => {
    if (!dateString) return '시간 미정';
    try {
      const hour = new Date(dateString).getHours();
      if (hour >= 6 && hour < 11) return '오전';
      if (hour >= 11 && hour < 16) return '오후';
      if (hour >= 16 && hour < 21) return '저녁';
      return '야간';
    } catch {
      return '시간 미정';
    }
  }, []);

  // 시간대별 필터링
  const filterByTimeSlot = useCallback((item, timeSlot) => {
    if (timeSlot === 'all') return true;
    if (!item.pickupDate) return timeSlot === 'undefined';
    
    try {
      const hour = new Date(item.pickupDate).getHours();
      switch (timeSlot) {
        case 'morning': return hour >= 6 && hour < 11;
        case 'afternoon': return hour >= 11 && hour < 16;
        case 'evening': return hour >= 16 && hour < 21;
        case 'night': return hour >= 21 || hour < 6;
        default: return true;
      }
    } catch {
      return timeSlot === 'undefined';
    }
  }, []);

  // 이용 가능한 구 목록
  const availableDistricts = useMemo(() => {
    if (!pickupList || !Array.isArray(pickupList)) return ['전체'];
    
    const districts = new Set();
    pickupList.forEach(item => {
      const district = extractDistrict(item.address?.roadNameAddress);
      districts.add(district);
    });
    
    let districtList = ['전체', ...Array.from(districts).sort()];
    if (isLocationBasedFilter && currentLocationDistrict) {
      districtList = ['전체', currentLocationDistrict];
    }
    
    return districtList;
  }, [pickupList, extractDistrict, isLocationBasedFilter, currentLocationDistrict]);

  // 여러 수거지를 한 번에 선택하는 함수
  const selectMultiplePickups = useCallback((pickupsToSelect) => {
    if (!pickupsToSelect || pickupsToSelect.length === 0) return;
    
    // 새로 선택할 수거지들을 올바른 형태로 변환
    const newSelections = pickupsToSelect.map(pickup => ({
      id: pickup.pickupId,
      pickupId: pickup.pickupId,
      ...pickup
    }));
    
    console.log('한 번에 선택할 수거지들:', newSelections.map(p => ({
      id: p.pickupId,
      name: p.address?.name
    })));
    
    // setSelectedPickups가 prop으로 전달되었다면 사용
    if (typeof setSelectedPickups === 'function') {
      setSelectedPickups(newSelections);
    } else {
      // 대안: 기존 방식으로 각각 선택 (하지만 중복 선택 방지)
      newSelections.forEach((pickup, index) => {
        setTimeout(() => {
          const isAlreadySelected = selectedPickups.some(p => 
            p.id === pickup.pickupId || p.pickupId === pickup.pickupId
          );
          if (!isAlreadySelected) {
            togglePickupSelection(pickup);
          }
        }, index * 50);
      });
    }
  }, [selectedPickups, togglePickupSelection, setSelectedPickups]);

  // 필터링 및 정렬
  const filterList = useCallback(() => {
    if (!pickupList || !Array.isArray(pickupList)) {
      setFilteredList([]);
      return;
    }

    let filtered = [...pickupList];

    // 완료 상태별 필터링
    switch (activeTab) {
      case '미완료':
        filtered = filtered.filter(item => !item.isCompleted);
        break;
      case '완료':
        filtered = filtered.filter(item => item.isCompleted);
        break;
    }
    
    // 구별 필터링
    if (selectedDistrict !== '전체') {
      filtered = filtered.filter(item => {
        const itemDistrict = extractDistrict(item.address?.roadNameAddress);
        return itemDistrict === selectedDistrict;
      });
    }
    
    // 현재 위치 기반 필터링
    if (isLocationBasedFilter && currentLocationDistrict) {
      filtered = filtered.filter(item => {
        const itemDistrict = extractDistrict(item.address?.roadNameAddress);
        return itemDistrict === currentLocationDistrict;
      });
    }
    
    // 시간대별 필터링
    if (selectedTimeSlot !== 'all') {
      filtered = filtered.filter(item => filterByTimeSlot(item, selectedTimeSlot));
    }
    
    // 정렬
    if (sortType === 'time') {
      filtered.sort((a, b) => {
        const priorityA = getTimePriority(a.pickupDate);
        const priorityB = getTimePriority(b.pickupDate);
        
        if (priorityA !== priorityB) return priorityA - priorityB;
        
        if (!a.pickupDate && !b.pickupDate) return 0;
        if (!a.pickupDate) return 1;
        if (!b.pickupDate) return -1;
        
        return new Date(a.pickupDate) - new Date(b.pickupDate);
      });
    } else if (sortType === 'distance' && location) {
      filtered.sort((a, b) => {
        const distanceA = calculateDistanceFromCurrentLocation(a.pickupId);
        const distanceB = calculateDistanceFromCurrentLocation(b.pickupId);
        
        if (distanceA === null && distanceB === null) return 0;
        if (distanceA === null) return 1;
        if (distanceB === null) return -1;
        
        return distanceA - distanceB;
      });
    }
    
    setFilteredList(filtered);
  }, [activeTab, pickupList, selectedDistrict, selectedTimeSlot, sortType, location, 
      calculateDistanceFromCurrentLocation, getTimePriority, extractDistrict, 
      filterByTimeSlot, isLocationBasedFilter, currentLocationDistrict]);

  // 처음 로드될 때 자동으로 최적 경로 생성 (수정된 버전)
  useEffect(() => {
    if (pickupList && Array.isArray(pickupList) && location && pickupCoordinates && !hasInitialAutoSelect) {
      const incompletePickups = pickupList.filter(item => !item.isCompleted);
      
      if (incompletePickups.length > 0) {
        // 거리순으로 정렬된 상위 5개
        const pickupsWithDistance = incompletePickups
          .filter(pickup => {
            const distance = calculateDistanceFromCurrentLocation(pickup.pickupId);
            return distance !== null;
          })
          .sort((a, b) => {
            const distanceA = calculateDistanceFromCurrentLocation(a.pickupId);
            const distanceB = calculateDistanceFromCurrentLocation(b.pickupId);
            return distanceA - distanceB;
          })
          .slice(0, 5);

        if (pickupsWithDistance.length > 0) {
          console.log('초기 자동선택 - 선택할 수거지들:', pickupsWithDistance.map(p => ({
            id: p.pickupId,
            name: p.address?.name,
            distance: calculateDistanceFromCurrentLocation(p.pickupId)?.toFixed(1) + 'km'
          })));
          
          // 기존 선택 초기화
          if (typeof clearAutoSelection === 'function') {
            clearAutoSelection();
          }
          
          // 한 번에 여러 수거지 선택
          setTimeout(() => {
            selectMultiplePickups(pickupsWithDistance);
            
            // 경로 최적화 활성화
            if (!routeOptimized && typeof toggleRouteOptimization === 'function') {
              setTimeout(() => {
                toggleRouteOptimization();
              }, 100);
            }
          }, 200);
          
          setHasInitialAutoSelect(true);
        }
      }
    }
  }, [pickupList, location, pickupCoordinates, hasInitialAutoSelect, calculateDistanceFromCurrentLocation, 
      selectMultiplePickups, clearAutoSelection, routeOptimized, toggleRouteOptimization]);

  // 필터링 및 정렬 변경 시 리스트 업데이트
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      filterList();
      setIsLoading(false);
    }, 50);
    return () => clearTimeout(timer);
  }, [filterList]);

  // 날짜 포맷팅
  const formatPickupDate = useCallback((dateString) => {
    if (!dateString) return '시간 미정';
    
    try {
      const date = new Date(dateString);
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = date.toDateString() === tomorrow.toDateString();
      
      const timeString = date.toLocaleTimeString('ko-KR', {
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      
      const timeLabel = getTimeLabel(dateString);
      
      if (isToday) {
        return `오늘 ${timeString} (${timeLabel})`;
      } else if (isTomorrow) {
        return `내일 ${timeString} (${timeLabel})`;
      } else {
        const dateString = date.toLocaleDateString('ko-KR', {
          month: 'numeric', day: 'numeric', weekday: 'short'
        });
        return `${dateString} ${timeString} (${timeLabel})`;
      }
    } catch {
      return '시간 미정';
    }
  }, [getTimeLabel]);

  // 현재 위치의 구 정보 가져오기
  const getCurrentLocationDistrict = useCallback(async () => {
    if (!location) return null;
    
    try {
      // 실제 구현에서는 역지오코딩 API 사용
      // 임시로 달서구 반환
      const district = '달서구';
      setCurrentLocationDistrict(district);
      return district;
    } catch (error) {
      console.error('현재 위치 구 정보 가져오기 실패:', error);
      return null;
    }
  }, [location]);

  // 현재 위치 기반 필터링 토글
  const toggleLocationBasedFilter = useCallback(() => {
    if (!location) {
      Alert.alert('위치 정보 필요', '현재 위치 정보가 필요합니다.');
      return;
    }
    
    const newFilterState = !isLocationBasedFilter;
    setIsLocationBasedFilter(newFilterState);
    
    if (newFilterState) {
      getCurrentLocationDistrict().then(district => {
        if (district) {
          setSelectedDistrict(district);
          Alert.alert('위치 기반 필터링 활성화', `현재 위치: ${district}\n${district} 수거지만 표시됩니다.`);
        } else {
          setIsLocationBasedFilter(false);
          Alert.alert('알림', '현재 위치의 구 정보를 가져올 수 없습니다.');
        }
      });
    } else {
      setSelectedDistrict('전체');
      setCurrentLocationDistrict(null);
      Alert.alert('위치 기반 필터링 비활성화', '모든 구의 수거지가 표시됩니다.');
    }
  }, [location, isLocationBasedFilter, getCurrentLocationDistrict]);

  useEffect(() => {
    if (location && isLocationBasedFilter) {
      getCurrentLocationDistrict();
    }
  }, [location, isLocationBasedFilter, getCurrentLocationDistrict]);

  // 자동선택 (수정된 버전)
  const handleAutoSelectOptimalRoute = useCallback(() => {
    if (!pickupList || !Array.isArray(pickupList)) {
      Alert.alert('알림', '수거지 정보를 가져올 수 없습니다.');
      return;
    }

    const incompletePickups = pickupList.filter(item => !item.isCompleted);
    if (incompletePickups.length === 0) {
      Alert.alert('알림', '수거할 수 있는 미완료 수거지가 없습니다.');
      return;
    }

    // 현재 위치 기반 필터링이 활성화된 경우
    let filteredPickups = incompletePickups;
    if (isLocationBasedFilter && currentLocationDistrict) {
      filteredPickups = incompletePickups.filter(item => {
        const itemDistrict = extractDistrict(item.address?.roadNameAddress);
        return itemDistrict === currentLocationDistrict;
      });
    }

    if (filteredPickups.length === 0) {
      Alert.alert('알림', '해당 구역에 수거할 수 있는 수거지가 없습니다.');
      return;
    }

    // 거리순으로 정렬해서 최대 5개 선택
    const pickupsWithDistance = filteredPickups
      .map(pickup => ({
        ...pickup,
        distance: calculateDistanceFromCurrentLocation(pickup.pickupId)
      }))
      .filter(pickup => pickup.distance !== null)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    console.log('수동 자동선택 - 선택할 수거지들:', pickupsWithDistance.map(p => ({ 
      id: p.pickupId,
      name: p.address?.name,
      distance: p.distance?.toFixed(1) + 'km'
    })));

    // 기존 선택 초기화
    if (typeof clearAutoSelection === 'function') {
      clearAutoSelection();
    }

    // 잠시 후에 새로운 선택 적용 (clearAutoSelection 완료 대기)
    setTimeout(() => {
      selectMultiplePickups(pickupsWithDistance);

      // 경로 최적화 활성화
      setTimeout(() => {
        if (!routeOptimized && typeof toggleRouteOptimization === 'function') {
          toggleRouteOptimization();
        }
      }, 100);

      Alert.alert('자동선택 완료', `가장 가까운 ${pickupsWithDistance.length}개 수거지를 선택했습니다.\n최적 경로로 설정되었습니다.`);
    }, 200);

  }, [pickupList, isLocationBasedFilter, currentLocationDistrict, extractDistrict, 
      clearAutoSelection, selectMultiplePickups, routeOptimized, toggleRouteOptimization, 
      calculateDistanceFromCurrentLocation]);

  // 카드 클릭 처리
  const handleCardPress = useCallback(async (item) => {
    setSelectedItemForDetail(item);
    setShowDetailModal(true);
    
    if (cachedDetails[item.pickupId]) {
      setSelectedItemForDetail(prev => ({ ...prev, details: cachedDetails[item.pickupId] }));
      return;
    }

    setDetailLoading(true);
    try {
      const response = await fetch(
        `https://refresh-f5-server.o-r.kr/api/pickup/get-details?pickupId=${item.pickupId}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setCachedDetails(prev => ({ ...prev, [item.pickupId]: data }));
        setSelectedItemForDetail(prev => ({ ...prev, details: data }));
      }
    } catch (error) {
      console.error('상세 정보 조회 오류:', error);
    } finally {
      setDetailLoading(false);
    }
  }, [cachedDetails]);

  const closeModal = useCallback(() => {
    setShowDetailModal(false);
    setDetailLoading(false);
    setSelectedItemForDetail(null);
  }, []);

  // 수거지 아이템 컴포넌트
  const PickupItem = React.memo(({ item }) => {
    const isSelected = selectedPickups.some(p => p.id === item.pickupId || p.pickupId === item.pickupId);
    const distance = calculateDistanceFromCurrentLocation(item.pickupId);
    const district = extractDistrict(item.address?.roadNameAddress);
    
    return (
      <TouchableOpacity 
        style={[styles.pickupItem, isSelected && styles.selectedPickupItem]}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.pickupItemContent}>
          <View style={styles.pickupItemHeader}>
            <Text style={styles.pickupItemName} numberOfLines={1}>
              {item.address?.name || '이름 없음'}
            </Text>
            <View style={styles.headerActions}>
              <View style={styles.districtBadge}>
                <Text style={styles.districtBadgeText}>{district}</Text>
              </View>
              <View style={styles.pickupItemBadge}>
                <Text style={styles.pickupItemBadgeText}>
                  {item.isCompleted ? '완료' : '미완료'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.selectionArea}
                onPress={(e) => {
                  e.stopPropagation();
                  togglePickupSelection(item);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons 
                  name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                  size={24} 
                  color={isSelected ? "#5c8d62" : "#ccc"} 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.pickupItemAddress} numberOfLines={2}>
            {item.address?.roadNameAddress || '주소 없음'}
          </Text>
          
          <View style={styles.wastePreview}>
            <Ionicons name="trash-outline" size={16} color="#666" />
            <Text style={styles.wastePreviewText}>폐기물 정보 확인</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </View>
          
          <View style={styles.pickupItemFooter}>
            <View style={styles.timeContainer}>
              <Ionicons name="time-outline" size={14} color="#666" />
              <Text style={styles.pickupItemTime}>
                {formatPickupDate(item.pickupDate)}
              </Text>
              {distance !== null && (
                <>
                  <Ionicons name="location-outline" size={14} color="#666" style={{marginLeft: 8}} />
                  <Text style={styles.pickupItemDistance}>{distance.toFixed(1)}km</Text>
                </>
              )}
            </View>
            
            {!item.isCompleted && (
              <TouchableOpacity 
                style={styles.completeButton}
                onPress={(e) => {
                  e.stopPropagation();
                  completePickup(item.pickupId);
                }}
              >
                <Text style={styles.completeButtonText}>수거 완료</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>수거지 목록</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[
              styles.locationFilterButton,
              isLocationBasedFilter && styles.activeLocationFilterButton
            ]}
            onPress={toggleLocationBasedFilter}
          >
            <Ionicons 
              name={isLocationBasedFilter ? "location" : "location-outline"} 
              size={16} 
              color={isLocationBasedFilter ? "#ffffff" : "#666"} 
            />
            <Text style={[
              styles.locationFilterButtonText,
              isLocationBasedFilter && styles.activeLocationFilterButtonText
            ]}>
              내 위치
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.autoRouteButton}
            onPress={handleAutoSelectOptimalRoute}
          >
            <Ionicons name="flash" size={16} color="#ffffff" />
            <Text style={styles.autoRouteButtonText}>자동선택</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.mapButton} onPress={toggleViewMode}>
            <Text style={styles.mapButtonText}>지도보기</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 탭바 */}
      <View style={styles.tabContainer}>
        <View style={styles.tabBar}>
          {['전체', '미완료', '완료'].map(tabName => (
            <TouchableOpacity
              key={tabName}
              style={[styles.tabButton, activeTab === tabName && styles.activeTabButton]}
              onPress={() => setActiveTab(tabName)}
            >
              <Text style={[
                styles.tabButtonText,
                activeTab === tabName && styles.activeTabButtonText
              ]}>
                {tabName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* 구별 필터 */}
        <View style={styles.filterBar}>
          <Text style={styles.filterLabel}>구별:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
            {availableDistricts.map(district => {
              const isDisabled = isLocationBasedFilter && 
                                currentLocationDistrict && 
                                district !== '전체' && 
                                district !== currentLocationDistrict;
              
              return (
                <TouchableOpacity
                  key={district}
                  style={[
                    styles.filterButton,
                    selectedDistrict === district && styles.activeFilterButton,
                    isDisabled && styles.disabledFilterButton
                  ]}
                  onPress={() => {
                    if (isDisabled) {
                      Alert.alert('선택 불가', `현재 위치 기반 필터링이 활성화되어 있습니다.\n${currentLocationDistrict}만 선택 가능합니다.`);
                      return;
                    }
                    setSelectedDistrict(district);
                  }}
                  disabled={isDisabled}
                >
                  <Text style={[
                    styles.filterButtonText,
                    selectedDistrict === district && styles.activeFilterButtonText,
                    isDisabled && styles.disabledFilterButtonText
                  ]}>
                    {district}{isDisabled && ' 🔒'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 시간대별 필터 */}
        <View style={styles.filterBar}>
          <Text style={styles.filterLabel}>시간대:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
            {[
              ['all', '전체'],
              ['morning', '오전(06-11)'],
              ['afternoon', '오후(11-16)'],
              ['evening', '저녁(16-21)'],
              ['night', '야간(21-06)']
            ].map(([slot, label]) => (
              <TouchableOpacity
                key={slot}
                style={[
                  styles.filterButton,
                  selectedTimeSlot === slot && styles.activeFilterButton
                ]}
                onPress={() => setSelectedTimeSlot(slot)}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedTimeSlot === slot && styles.activeFilterButtonText
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        {/* 정렬 방식 */}
        <View style={styles.sortBar}>
          <Text style={styles.sortLabel}>정렬:</Text>
          <TouchableOpacity
            style={[styles.sortButton, sortType === 'distance' && styles.activeSortButton]}
            onPress={() => setSortType('distance')}
          >
            <Ionicons name="location-outline" size={16} color={sortType === 'distance' ? '#ffffff' : '#666'} />
            <Text style={[styles.sortButtonText, sortType === 'distance' && styles.activeSortButtonText]}>
              거리순 (기본)
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.sortButton, sortType === 'time' && styles.activeSortButton]}
            onPress={() => setSortType('time')}
          >
            <Ionicons name="time-outline" size={16} color={sortType === 'time' ? '#ffffff' : '#666'} />
            <Text style={[styles.sortButtonText, sortType === 'time' && styles.activeSortButtonText]}>
              시간대별
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* 필터 정보 표시 */}
      <View style={styles.filterInfo}>
        <Text style={styles.filterInfoText}>
          {isLocationBasedFilter && currentLocationDistrict && `📍 현재 위치: ${currentLocationDistrict} • `}
          {selectedDistrict !== '전체' && `${selectedDistrict} • `}
          {selectedTimeSlot !== 'all' && `${
            selectedTimeSlot === 'morning' ? '오전' :
            selectedTimeSlot === 'afternoon' ? '오후' :
            selectedTimeSlot === 'evening' ? '저녁' :
            selectedTimeSlot === 'night' ? '야간' : '전체시간대'
          } • `}
          총 {filteredList.length}개 수거지
        </Text>
      </View>
      
      {/* 컨텐츠 */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5c8d62" />
          <Text style={styles.loadingText}>데이터를 불러오는 중...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          renderItem={({ item }) => <PickupItem item={item} />}
          keyExtractor={(item) => item.pickupId.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                {selectedDistrict !== '전체' || selectedTimeSlot !== 'all' || isLocationBasedFilter
                  ? '해당 조건에 맞는 수거지가 없습니다' 
                  : '수거지가 없습니다'
                }
              </Text>
              {(selectedDistrict !== '전체' || selectedTimeSlot !== 'all' || isLocationBasedFilter) && (
                <TouchableOpacity 
                  style={styles.resetFilterButton}
                  onPress={() => {
                    setSelectedDistrict('전체');
                    setSelectedTimeSlot('all');
                    setIsLocationBasedFilter(false);
                    setCurrentLocationDistrict(null);
                  }}
                >
                  <Text style={styles.resetFilterButtonText}>모든 필터 초기화</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
      
      {/* 내비게이션 버튼 */}
      {selectedPickups.length > 0 && (
        <View style={styles.navigationContainer}>
          <View style={styles.navigationInfo}>
            <Text style={styles.navigationInfoText}>
              {selectedPickups.length}개 수거지 선택됨
            </Text>
            <View style={styles.optimizeContainer}>
              <Text style={styles.optimizeText}>경로 최적화</Text>
              <Switch
                value={routeOptimized}
                onValueChange={toggleRouteOptimization}
                trackColor={{ false: '#d1d1d1', true: '#a7c9ad' }}
                thumbColor={routeOptimized ? '#5c8d62' : '#f4f3f4'}
              />
            </View>
          </View>
          
          <View style={styles.autoSelectionButtons}>
            <TouchableOpacity style={styles.clearSelectionButton} onPress={clearAutoSelection}>
              <Text style={styles.clearSelectionButtonText}>선택 초기화</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.navigationButton} onPress={launchKakaoNavigation}>
            <Text style={styles.navigationButtonText}>내비게이션 시작</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 상세 정보 모달 */}
      <Modal
        visible={showDetailModal}
        animationType="none"
        transparent={false}
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
              <Ionicons name="close" size={24} color="#666"/>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>수거지 상세 정보</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {selectedItemForDetail && (
              <>
                <View style={styles.infoSection}>
                  <Text style={styles.sectionTitle}>📍 기본 정보</Text>
                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>수거지명</Text>
                      <Text style={styles.infoValue}>{selectedItemForDetail.address?.name || '이름 없음'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>주소</Text>
                      <Text style={styles.infoValue}>{selectedItemForDetail.address?.roadNameAddress || '주소 없음'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>구역</Text>
                      <Text style={styles.infoValue}>{extractDistrict(selectedItemForDetail.address?.roadNameAddress)}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>수거 예정 시간</Text>
                      <Text style={styles.infoValue}>{formatPickupDate(selectedItemForDetail.pickupDate)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.sectionTitle}>🗑️ 폐기물 정보</Text>
                  {detailLoading ? (
                    <View style={styles.loadingCard}>
                      <ActivityIndicator size="small" color="#5c8d62" />
                      <Text style={styles.loadingText}>정보를 불러오는 중...</Text>
                    </View>
                  ) : selectedItemForDetail.details?.details ? (
                    <>
                      <View style={styles.priceCard}>
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>예상 금액</Text>
                          <Text style={styles.priceValue}>
                            {selectedItemForDetail.details.pricePreview 
                              ? `${selectedItemForDetail.details.pricePreview.toLocaleString()}원` 
                              : '가격 미정'}
                          </Text>
                        </View>
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>결제 상태</Text>
                          <Text style={[styles.priceValue, {color: selectedItemForDetail.details.payment ? '#10B981' : '#F59E0B'}]}>
                            {selectedItemForDetail.details.payment ? '결제 완료' : '결제 대기'}
                          </Text>
                        </View>
                      </View>
                      
                      {selectedItemForDetail.details.details.map((waste, index) => (
                        <View key={`${waste.wasteId}-${index}`} style={styles.wasteCard}>
                          <View style={[styles.wasteTypeIndicator, { backgroundColor: getWasteColor(waste.wasteId) }]} />
                          <View style={styles.wasteInfo}>
                            <Text style={styles.wasteType}>{waste.wasteName}</Text>
                            <Text style={styles.wasteAmount}>{waste.weight}개</Text>
                          </View>
                          <View style={styles.wastePriceContainer}>
                            <Text style={styles.wastePrice}>
                              {waste.pricePreview ? `${waste.pricePreview.toLocaleString()}원` : '가격 미정'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </>
                  ) : (
                    <View style={styles.noDataCard}>
                      <Ionicons name="information-circle-outline" size={24} color="#999" />
                      <Text style={styles.noDataText}>상세 정보를 불러올 수 없습니다</Text>
                    </View>
                  )}
                </View>

                {selectedItemForDetail.details && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>📞 연락처 정보</Text>
                    <View style={styles.infoCard}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>연락처</Text>
                        <Text style={[styles.infoValue, styles.phoneNumber]}>
                          {selectedItemForDetail.details.phone || '연락처 없음'}
                        </Text>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>이메일</Text>
                        <Text style={styles.infoValue}>
                          {selectedItemForDetail.details.email || '이메일 없음'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {selectedItemForDetail && (
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.selectButton}
                onPress={() => {
                  togglePickupSelection(selectedItemForDetail);
                  closeModal();
                }}
              >
                <Text style={styles.selectButtonText}>
                  {selectedPickups.some(p => p.id === selectedItemForDetail.pickupId) ? '선택 해제' : '경로에 추가'}
                </Text>
              </TouchableOpacity>
              
              {!selectedItemForDetail.isCompleted && (
                <TouchableOpacity 
                  style={styles.completeModalButton}
                  onPress={() => {
                    completePickup(selectedItemForDetail.pickupId);
                    closeModal();
                  }}
                >
                  <Text style={styles.completeModalButtonText}>수거 완료</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Modal>
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 8,
  },
  activeLocationFilterButton: {
    backgroundColor: '#4B89DC',
  },
  locationFilterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginLeft: 4,
  },
  activeLocationFilterButtonText: {
    color: '#ffffff',
  },
  autoRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    marginRight: 8,
  },
  autoRouteButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 4,
  },
  mapButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#5c8d62',
    borderRadius: 20,
  },
  mapButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  tabContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabBar: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeTabButton: {
    backgroundColor: '#5c8d62',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: '#ffffff',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  filterLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
    fontWeight: '500',
    minWidth: 50,
  },
  filterScrollView: {
    flex: 1,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    minWidth: 60,
    alignItems: 'center',
  },
  activeFilterButton: {
    backgroundColor: '#5c8d62',
  },
  disabledFilterButton: {
    backgroundColor: '#e5e5e5',
    opacity: 0.5,
  },
  filterButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#ffffff',
  },
  disabledFilterButtonText: {
    color: '#999',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sortLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
    fontWeight: '500',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  activeSortButton: {
    backgroundColor: '#5c8d62',
  },
  disabledSortButton: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
  sortButtonText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  activeSortButtonText: {
    color: '#ffffff',
  },
  disabledSortButtonText: {
    color: '#ccc',
  },
  filterInfo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterInfoText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  pickupItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedPickupItem: {
    borderWidth: 2,
    borderColor: '#5c8d62',
    backgroundColor: '#f0f8f0',
    shadowColor: '#5c8d62',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  pickupItemContent: {
    flex: 1,
  },
  pickupItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  districtBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#4B89DC',
    marginRight: 6,
  },
  districtBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
  pickupItemBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    marginRight: 8,
  },
  pickupItemBadgeText: {
    fontSize: 12,
    color: '#666',
  },
  selectionArea: {
    padding: 4,
  },
  pickupItemAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  wastePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  wastePreviewText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
  pickupItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupItemTime: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  pickupItemDistance: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  completeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#5c8d62',
    borderRadius: 16,
  },
  completeButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  resetFilterButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#5c8d62',
    borderRadius: 20,
  },
  resetFilterButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  navigationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  navigationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navigationInfoText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  optimizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optimizeText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  autoSelectionButtons: {
    marginBottom: 12,
  },
  clearSelectionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    alignItems: 'center',
  },
  clearSelectionButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  navigationButton: {
    backgroundColor: '#4B89DC',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  navigationButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  phoneNumber: {
    color: '#007AFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 4,
  },
  priceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  wasteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  wasteTypeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  wasteInfo: {
    flex: 1,
  },
  wasteType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  wasteAmount: {
    fontSize: 14,
    color: '#666',
  },
  wastePriceContainer: {
    alignItems: 'flex-end',
  },
  wastePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  loadingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noDataCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noDataText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  selectButton: {
    flex: 1,
    backgroundColor: '#5c8d62',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  completeModalButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeModalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});

export default ListView;