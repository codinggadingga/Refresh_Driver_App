import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Dimensions,
    Animated,
    Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const CustomModal = ({
    visible,
    title,
    message,
    buttons = [],
    onClose,
    type = 'default' // 'default', 'success', 'warning', 'error'
}) => {
    const scaleValue = React.useRef(new Animated.Value(0)).current;
    const opacityValue = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(opacityValue, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleValue, {
                    toValue: 1,
                    tension: 100,
                    friction: 8,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacityValue, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleValue, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [visible]);

    const getIconName = () => {
        switch (type) {
            case 'success': return 'checkmark-circle';
            case 'warning': return 'warning';
            case 'error': return 'close-circle';
            default: return 'information-circle';
        }
    };

    const getIconColor = () => {
        switch (type) {
            case 'success': return '#10B981';
            case 'warning': return '#F59E0B';
            case 'error': return '#EF4444';
            default: return '#3B82F6';
        }
    };

    const handleButtonPress = (button) => {
        console.log('모달 버튼 클릭됨:', button.text);

        // onClose를 먼저 호출하여 모달을 닫음
        if (onClose) {
            onClose();
        }

        // 그 다음에 버튼의 onPress 실행 (약간의 지연을 두어 모달이 완전히 닫힌 후 실행)
        if (button.onPress) {
            setTimeout(() => {
                console.log('버튼 onPress 실행:', button.text);
                button.onPress();
            }, 200);
        }
      };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
            <Animated.View
                style={[
                    styles.overlay,
                    { opacity: opacityValue }
                ]}
            >
                <TouchableOpacity
                    style={styles.overlayTouchable}
                    activeOpacity={1}
                    onPress={onClose}
                >
                    <Animated.View
                        style={[
                            styles.modalContainer,
                            {
                                transform: [{ scale: scaleValue }],
                                opacity: opacityValue
                            }
                        ]}
                    >
                        <TouchableOpacity activeOpacity={1}>
                            {/* 아이콘 */}
                            <View style={styles.iconContainer}>
                                <Ionicons
                                    name={getIconName()}
                                    size={48}
                                    color={getIconColor()}
                                />
                            </View>

                            {/* 제목 */}
                            <Text style={styles.title}>{title}</Text>

                            {/* 메시지 */}
                            {message && (
                                <Text style={styles.message}>{message}</Text>
                            )}

                            {/* 버튼들 */}
                            <View style={styles.buttonContainer}>
                                {buttons.map((button, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.button,
                                            button.style === 'cancel' ? styles.cancelButton : styles.primaryButton,
                                            buttons.length === 1 ? styles.singleButton : {},
                                            index === 0 && buttons.length > 1 ? styles.firstButton : {},
                                            index === buttons.length - 1 && buttons.length > 1 ? styles.lastButton : {}
                                        ]}
                                        onPress={() => handleButtonPress(button)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[
                                            styles.buttonText,
                                            button.style === 'cancel' ? styles.cancelButtonText : styles.primaryButtonText
                                        ]}>
                                            {button.text}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                </TouchableOpacity>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlayTouchable: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    modalContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 24,
        marginHorizontal: 32,
        maxWidth: width - 64,
        minWidth: width * 0.7,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'center',
        marginBottom: 8,
        lineHeight: 28,
    },
    message: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    buttonContainer: {
        flexDirection: 'column',
        gap: 12,
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    primaryButton: {
        backgroundColor: '#3B82F6',
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    singleButton: {
        // 단일 버튼일 때 스타일
    },
    firstButton: {
        // 첫 번째 버튼 스타일
    },
    lastButton: {
        // 마지막 버튼 스타일
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    primaryButtonText: {
        color: '#ffffff',
    },
    cancelButtonText: {
        color: '#374151',
    },
});

export default CustomModal;
