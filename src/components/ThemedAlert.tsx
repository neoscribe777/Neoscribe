import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { RainbowBackground } from './RainbowBackground';

interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface ThemedAlertProps {
    visible: boolean;
    title: string;
    message: string;
    buttons: AlertButton[];
    onClose: () => void;
}

export const ThemedAlert: React.FC<ThemedAlertProps> = ({ visible, title, message, buttons, onClose }) => {
    const { theme, themeId } = useAppTheme();
    const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 200,
                    easing: Easing.out(Easing.back(1.5)),
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            scaleAnim.setValue(0.9);
            opacityAnim.setValue(0);
        }
    }, [visible, opacityAnim, scaleAnim]);

    if (!visible) return null;

    const isRainbow = themeId === 'Rainbow';

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Animated.View 
                    style={[
                        styles.alertBox, 
                        { 
                            backgroundColor: theme.surface, 
                            borderColor: theme.divider,
                            transform: [{ scale: scaleAnim }],
                            opacity: opacityAnim
                        }
                    ]}
                >
                    <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                    <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
                    
                    <View style={styles.buttonContainer}>
                        {buttons.map((btn, idx) => {
                            const isPrimary = btn.style !== 'cancel';
                            return (
                                <TouchableOpacity 
                                    key={idx} 
                                    style={[
                                        styles.button, 
                                        isPrimary ? (isRainbow ? styles.rainbowBtn : { backgroundColor: theme.primary }) : { backgroundColor: 'transparent' },
                                        btn.style === 'destructive' ? { backgroundColor: '#FF5252' } : {}
                                    ]}
                                    onPress={() => {
                                        onClose();
                                        if (btn.onPress) btn.onPress();
                                    }}
                                >
                                    {isPrimary && isRainbow && <RainbowBackground style={StyleSheet.absoluteFill} />}
                                    <Text 
                                        style={[
                                            styles.buttonText, 
                                            { color: isPrimary ? '#fff' : theme.textSecondary },
                                            isRainbow && isPrimary ? styles.outlineEffect : {}
                                        ]}
                                    >
                                        {btn.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30
    },
    alertBox: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center'
    },
    message: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 24,
        textAlign: 'center'
    },
    buttonContainer: {
        flexDirection: 'column',
        gap: 8
    },
    button: {
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    rainbowBtn: {
        backgroundColor: 'transparent'
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600'
    },
    outlineEffect: {
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1.5,
    }
});
