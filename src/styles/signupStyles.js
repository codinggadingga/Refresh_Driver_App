import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  signupContainer: {
    position: 'absolute', // 화면 전체를 덮도록 설정
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E2A38', // 배경색 적용
    justifyContent: 'center', // 중앙 정렬
    alignItems: 'center', // 중앙 정렬
  },
  signupLogo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  signupSubtitle: {
    fontSize: 18,
    color: '#4CAF50',
    marginBottom: 20,
  },
  signupInput: {
    width: '80%',
    height: 50,
    backgroundColor: '#34495E',
    borderRadius: 8,
    paddingHorizontal: 15,
    color: '#ffffff',
    marginBottom: 15,
  },
  signupButton: {
    width: '80%',
    height: 50,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  signupButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signupFooter: {
    flexDirection: 'row',
    marginTop: 10,
  },
  signupLink: {
    color: '#4CAF50',
    marginHorizontal: 10,
  },
});
