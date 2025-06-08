import { StyleSheet, Dimensions, Platform, StatusBar } from 'react-native';

const { width, height } = Dimensions.get('window');

// 안전 영역 계산 함수들
const getStatusBarHeight = () => {
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight || 24;
  }
  return 44; // iOS 기본값
};

const getBottomSafeArea = () => {
  if (Platform.OS === 'android') {
    // 갤럭시 하단 네비게이션 바 높이
    return 48; // 갤럭시 기본 네비게이션 바 높이
  }
  return 34; // iOS 홈 인디케이터
};

const main = StyleSheet.create({
  // 기본 컨테이너 - 안전 영역 적용
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: Platform.OS === 'android' ? getStatusBarHeight() : 0,
    paddingBottom: Platform.OS === 'android' ? getBottomSafeArea() : 0,
  },

  // 헤더 스타일 - 상단바 겹침 방지
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? getStatusBarHeight() + 8 : 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10,
    minHeight: Platform.OS === 'android' ? getStatusBarHeight() + 60 : 60,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#7c7c7c',
  },

  // 버튼 스타일 - 터치 영역 개선
  primaryButton: {
    backgroundColor: '#5c8d62',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  roundButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#5c8d62',
    borderRadius: 20,
    minHeight: 40,
  },
  roundButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },

  // 카드 스타일
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  cardContent: {
    fontSize: 14,
    color: '#666',
  },

  // 입력 필드 스타일
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 48,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 6,
  },
  inputError: {
    fontSize: 12,
    color: '#e74c3c',
    marginTop: 4,
  },

  // 로딩 스타일
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingBottom: getBottomSafeArea(),
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },

  // 탭 스타일 - 터치 영역 개선
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    minHeight: 40,
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: '#5c8d62',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  activeTabButtonText: {
    color: '#ffffff',
  },

  // 리스트 스타일 - 하단 여백 추가
  listContent: {
    padding: 12,
    paddingBottom: getBottomSafeArea() + 20,
  },
  listItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 12,
    marginHorizontal: 4,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#666',
  },

  // 지도 스타일 - 안전 영역 적용
  mapContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#e0e0e0',
    paddingBottom: Platform.OS === 'android' ? getBottomSafeArea() : 0,
  },
  mapView: {
    flex: 1,
    width: width,
    backgroundColor: '#ffffff',
  },

  // 내비게이션 스타일 - 하단 겹침 방지
  navigationContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? getBottomSafeArea() + 10 : 10,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderRadius: 12,
  },
  navigationButton: {
    backgroundColor: '#4B89DC',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
  },
  navigationButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  // 모달 스타일 - 안전 영역 고려
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingTop: getStatusBarHeight(),
    paddingBottom: getBottomSafeArea(),
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: width * 0.85,
    maxHeight: height * 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },

  // NavigationView 전용 스타일
  navigationViewContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // 상단 정보 패널 - 상단바 겹침 방지
  topInfoPanel: {
    position: 'absolute',
    top: Platform.OS === 'android' ? getStatusBarHeight() + 10 : 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 16,
    zIndex: 100,
  },

  // 하단 컨트롤 패널 - 하단 네비게이션 바 겹침 방지
  bottomControlPanel: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? getBottomSafeArea() + 10 : 34,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 16,
    zIndex: 100,
  },

  // 수거 완료 버튼 - 하단 안전 영역 고려
  completeButton: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? getBottomSafeArea() + 20 : 54,
    left: 20,
    right: 20,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 200,
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  // 플랫폼별 스타일 조정
  ...Platform.select({
    ios: {
      shadowContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    },
    android: {
      shadowContainer: {
        elevation: 4,
      },
      // Android 전용 추가 여백
      androidSafeContainer: {
        paddingTop: getStatusBarHeight(),
        paddingBottom: getBottomSafeArea(),
      },
    },
  }),
});

export default main;
