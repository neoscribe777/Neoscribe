import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, NativeModules, ToastAndroid } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAppTheme } from '../hooks/useAppTheme';
import { RainbowBackground } from './RainbowBackground';
import { getTranslation } from '../translations';
import { ThemedAlert } from './ThemedAlert';

// Google-only native module handled directly in handleRunOCR
const { OCRModule } = NativeModules;

interface OCRTabProps {
    onResult: (text: string) => void;
    initialImageUri?: string;
}

export const OCRTab: React.FC<OCRTabProps> = ({ onResult, initialImageUri }) => {
    const { theme, themeId, language } = useAppTheme();
    const t = (key: string, params?: any) => getTranslation(language, key, params);
    const [imageUri, setImageUri] = useState<string | null>(initialImageUri || null);
    const [status, setStatus] = useState<'idle' | 'processing'>('idle');

    // Themed Alert State
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMsg, setAlertMsg] = useState('');

    const showThemedAlert = React.useCallback((title: string, message: string) => {
        setAlertTitle(title);
        setAlertMsg(message);
        setAlertVisible(true);
    }, []);

    // Auto-load shared image if provided
    useEffect(() => {
        if (initialImageUri) {
            console.log('OCRTab: initialImageUri provided:', initialImageUri);
            setImageUri(initialImageUri);
        }
    }, [initialImageUri]);

    const handlePickImage = () => {
        launchImageLibrary({ mediaType: 'photo', quality: 1 }, (response) => {
            if (response.assets && response.assets[0].uri) {
                setImageUri(response.assets[0].uri);
            }
        });
    };

    const handleRunOCR = async () => {
        if (!imageUri) {
            showThemedAlert(t('no_image'), t('please_select_image'));
            return;
        }

        try {
            setStatus('processing');
            
            // Just call recognizeText. The params are largely ignored by the new Google-only native module
            // but we pass them to match signature.
            const result = await OCRModule.recognizeText(imageUri, 'eng_google', 'standard');
            
            if (result.text && result.text.trim()) {
                onResult(result.text);
                ToastAndroid.show(t('text_recognized'), ToastAndroid.SHORT);
            } else {
                showThemedAlert(t('ocr_result_title'), t('ocr_no_text'));
            }
        } catch (err: any) {
            showThemedAlert(t('error'), err.message || t('ocr_error_msg'));
        } finally {
            setStatus('idle');
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.card}>
                <Text style={[styles.title, { color: theme.text }]}>{t('ocr_title')}</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}> </Text>

                <View style={{ marginTop: 20 }}>
                     <View style={[styles.langList, { justifyContent: 'center' }]}>
                            <View 
                                style={[
                                    styles.langBtn, 
                                    themeId === 'Rainbow' ? { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0, overflow: 'hidden' } : { backgroundColor: theme.primary, borderColor: theme.divider }
                                ]}
                            >
                                {themeId === 'Rainbow' && <RainbowBackground style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />}
                                <Text style={[{ color: 'white', fontSize: 12 }, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>{t('eng_latin')}</Text>
                            </View>
                    </View>
                </View>

                <Text style={[styles.label, { color: theme.text, marginTop: 20 }]}>{t('image_selection')}</Text>
                <TouchableOpacity 
                    style={[styles.imagePicker, { backgroundColor: theme.surface, borderColor: theme.divider }]} 
                    onPress={handlePickImage}
                >
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
                    ) : (
                        <View style={styles.placeholder}>
                            <MaterialCommunityIcons 
                                name="image-plus" 
                                size={40} 
                                color={themeId === 'Rainbow' ? 'white' : theme.textSecondary} 
                                style={themeId === 'Rainbow' ? styles.outlineEffect : {}}
                            />
                            <Text style={[{ color: theme.textSecondary, marginTop: 10 }, themeId === 'Rainbow' ? [styles.outlineEffect, { color: 'white' }] : {}]}>{t('tap_to_pick')}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {status === 'processing' ? (
                    <View style={styles.statusContainer}>
                        <ActivityIndicator size="large" color={themeId === 'Rainbow' ? 'white' : theme.primary} />
                        <Text style={[styles.statusText, { color: theme.text }]}>
                            {t('processing_image')}
                        </Text>
                    </View>
                ) : (
                    <TouchableOpacity 
                        style={[styles.runBtn, themeId === 'Rainbow' ? { backgroundColor: 'transparent' } : { backgroundColor: theme.primary }, { opacity: imageUri ? 1 : 0.6 }]}
                        onPress={handleRunOCR}
                        disabled={!imageUri}
                    >
                        {themeId === 'Rainbow' ? (
                            <RainbowBackground style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                        ) : null}
                        <MaterialCommunityIcons 
                            name="text-recognition" 
                            size={24} 
                            color="white" 
                            style={themeId === 'Rainbow' ? styles.outlineEffect : {}}
                        />
                        <Text style={[styles.runBtnText, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>{t('extract_text')}</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ThemedAlert 
                visible={alertVisible}
                title={alertTitle}
                message={alertMsg}
                buttons={[{ text: t('got_it'), onPress: () => {} }]}
                onClose={() => setAlertVisible(false)}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    card: { padding: 20 },
    title: { fontSize: 20, fontWeight: 'bold' },
    subtitle: { fontSize: 14, marginTop: 5 },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
    langList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    langBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    imagePicker: { height: 200, borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, overflow: 'hidden', marginTop: 10 },
    preview: { width: '100%', height: '100%' },
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    statusContainer: { marginTop: 30, alignItems: 'center' },
    statusText: { marginTop: 15, fontWeight: 'bold' },
    progressBarBg: { width: '80%', height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
    progressBarFill: { height: '100%' },
    runBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 12, marginTop: 30, elevation: 3, overflow: 'hidden' },
    runBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
    outlineEffect: {
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1.5,
    }
});
