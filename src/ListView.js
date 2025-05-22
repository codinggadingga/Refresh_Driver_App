import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator,
  Switch,
  Alert
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
  launchKakaoNavigation
}) => {
  const [filteredList, setFilteredList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 탭 변경 시 목록 필터링
  useEffect(() => {
    filterList();
  }, [activeTab, pickupList]);

  // 수거지 목록 필터링
  const filterList = () => {
    setIsLoading(true);
    try {
      if (!pickupList || !Array.isArray(pickupList)) {
        setFilteredList([]);
        return;
      }

      let filtered = [];
      switch (activeTab) {
        case '미완료':
          filtered = pickupList.filter(item => !item.isCompleted);
          break;
        case '완료':
          filtered = pickupList.filter(item => item.isCompleted);
          break;
        default:
          filtered = [...pickupList];
          break;
      }
      
      setFilteredList(filtered);
    } catch (error) {
      console.error('목록 필터링 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 수거지 아이템 렌더링
  const renderPickupItem = ({ item }) => {
    const isSelected = selectedPickups.some(p => p.id === item.pickupId);
    
    return (
      <TouchableOpacity 
        style={[
          styles.pickupItem, 
          isSelected && styles.selectedPickupItem
        ]}
        onPress={() => togglePickupSelection(item)}
      >
        <View style={styles.pickupItemContent}>
          <View style={styles.pickupItemHeader}>
            <Text style={styles.pickupItemName}>{item.address?.name || '이름 없음'}</Text>
            <View style={styles.pickupItemBadge}>
              <Text style={styles.pickupItemBadgeText}>
                {item.isCompleted ? '완료' : '미완료'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.pickupItemAddress}>{item.address?.roadNameAddress || '주소 없음'}</Text>
          
          <View style={styles.pickupItemFooter}>
            <Text style={styles.pickupItemTime}>
              {item.pickupTime || '시간 미정'}
            </Text>
            
            {!item.isCompleted && (
              <TouchableOpacity 
                style={styles.completeButton}
                onPress={() => completePickup(item.pickupId)}
              >
                <Text style={styles.completeButtonText}>수거 완료</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {isSelected && (
          <View style={styles.checkmarkContainer}>
            <Ionicons name="checkmark-circle" size={24} color="#5c8d62" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // 탭 버튼 렌더링
  const renderTabButton = (tabName) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tabName && styles.activeTabButton
      ]}
      onPress={() => setActiveTab(tabName)}
    >
      <Text style={[
        styles.tabButtonText,
        activeTab === tabName && styles.activeTabButtonText
      ]}>
        {tabName}
      </Text>
    </TouchableOpacity>
  );

  // 내비게이션 버튼 렌더링
  const renderNavigationButton = () => {
    if (selectedPickups.length === 0) return null;
    
    return (
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
        
        <TouchableOpacity
          style={styles.navigationButton}
          onPress={launchKakaoNavigation}
        >
          <Text style={styles.navigationButtonText}>내비게이션 시작</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // 헤더 컴포넌트
  const Header = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>수거지 목록</Text>
      <TouchableOpacity 
        style={styles.mapButton}
        onPress={toggleViewMode}
      >
        <Text style={styles.mapButtonText}>지도보기</Text>
      </TouchableOpacity>
    </View>
  );

  // 탭 컴포넌트
  const TabBar = () => (
    <View style={styles.tabBar}>
      {renderTabButton('전체')}
      {renderTabButton('미완료')}
      {renderTabButton('완료')}
    </View>
  );

  // 로딩 인디케이터
  const LoadingIndicator = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#5c8d62" />
      <Text style={styles.loadingText}>데이터를 불러오는 중...</Text>
    </View>
  );

  // 빈 목록 표시
  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>수거지가 없습니다</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header />
      <TabBar />
      
      {isLoading ? (
        <LoadingIndicator />
      ) : (
        <FlatList
          data={filteredList}
          renderItem={renderPickupItem}
          keyExtractor={item => item.pickupId.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={EmptyList}
        />
      )}
      
      {renderNavigationButton()}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
  listContent: {
    padding: 12,
    paddingBottom: 100, // 내비게이션 버튼 공간 확보
  },
  pickupItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedPickupItem: {
    borderWidth: 2,
    borderColor: '#5c8d62',
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
  pickupItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  pickupItemBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
  },
  pickupItemBadgeText: {
    fontSize: 12,
    color: '#666',
  },
  pickupItemAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  pickupItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickupItemTime: {
    fontSize: 12,
    color: '#888',
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
  checkmarkContainer: {
    justifyContent: 'center',
    paddingLeft: 12,
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
});

export default ListView;
