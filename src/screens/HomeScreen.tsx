import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ToastAndroid,
  NativeModules,
  Platform,
  AppState,
  Modal,
  TextInput
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { pickAndGetFile } from '../services/scoped-storage-service';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAppTheme } from '../hooks/useAppTheme';
import { ThemeColors } from '../theme/themePresets';
import FallingEmojis from '../components/FallingEmojis';
import { RainbowBackground } from '../components/RainbowBackground';
import { getTranslation } from '../translations';

const HomeScreen = () => {
  const { theme, themeId, emojiTheme, emojiSettings, language } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const t = React.useCallback((key: string) => getTranslation(language, key), [language]);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newFileName, setNewFileName] = useState('Untitled');
  const [newFileExt, setNewFileExt] = useState('txt');
  const processedIntentRef = React.useRef<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
    
    if (Platform.OS === 'android' && NativeModules.ThemeModule) {
      NativeModules.ThemeModule.setNavigationBarColor(theme.background, !theme.isDark);
    }
    
    const lastProcessTimeRef = { current: 0 };
    
    const checkSharedIntent = async () => {
      try {
        const sharedData = await NativeModules.SharedIntentModule.getSharedData();
        console.log('SharedIntentModule returned:', JSON.stringify(sharedData));
        
        if (sharedData) {
          const { action, type, value } = sharedData;
          console.log('Shared data details:', { action, type, value });
          
          if (!sharedData || !sharedData.value) {
            // Reset to allow same intent later
            console.log('🔵 SHARE: No shared data found, resetting processedIntentRef');
            processedIntentRef.current = null;
            return;
          }
          
          console.log('🔵 SHARE: Found shared data, value length:', sharedData.value?.length);
          
          // Debounce: Skip if we processed something less than 1 second ago
          const now = Date.now();
          if (now - lastProcessTimeRef.current < 1000) {
            console.log('🔵 SHARE: Debouncing - processed too recently, skipping');
            return;
          }
          lastProcessTimeRef.current = now;
          
          console.log('🔵 SHARE: New intent detected, processing...');

          if (action === 'SEND' || action === 'VIEW') {
            const isImage = type && type.startsWith('image/');
            
            if (isImage) {
              console.log('Processing shared image for OCR:', value);
              ToastAndroid.show(t('ocr_title'), ToastAndroid.SHORT);
              
              let finalPath = value;
              // If it's a content URI, it's safer to copy it to cache for the viewer
              if (value.startsWith('content://')) {
                try {
                  const extension = type.split('/')[1] || 'jpg';
                  const tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/shared_img_${Date.now()}.${extension}`;
                  await ReactNativeBlobUtil.fs.cp(value, tempPath);
                  finalPath = tempPath;
                } catch (cpErr) {
                  console.warn('Failed to copy shared image, using direct URI', cpErr);
                }
              }

              processedIntentRef.current = value;
              navigation.navigate('MassiveFileViewer', {
                path: finalPath,
                fileName: `Shared_Image_${Date.now()}`,
                isOCR: true,
                shareId: Date.now(),
                showStartEditing: false
              });
              NativeModules.SharedIntentModule.clearIntent();

            } else if (value.startsWith('content://') || value.startsWith('file://')) {
              // It's a file URI (not an image)
              console.log('Processing File URI:', value);
              let finalPath = value;
              let name = `Shared_File_${Date.now()}`; // Made more unique

              if (value.startsWith('content://')) {
                try {
                  // Use a fixed name or try to guess. stat(value) failed for user, so we use cp first.
                  const tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/shared_file_${Date.now()}.txt`;
                  await ReactNativeBlobUtil.fs.cp(value, tempPath);
                  finalPath = tempPath;
                  
                  // Now that it's local, we can safely stat it if we wanted, but let's just use a generic name
                  // to avoid any further failures. Or get name from the URI string.
                  const parts = value.split('/');
                  name = decodeURIComponent(parts[parts.length - 1]) || 'shared_file';
                } catch (e) {
                  console.error('Failed to resolve content URI:', e);
                  throw new Error('Could not read shared file content');
                }
              } else if (value.startsWith('file://')) {
                finalPath = value.replace('file://', '');
                name = finalPath.split('/').pop() || 'file';
              }

              processedIntentRef.current = value;
              navigation.navigate('MassiveFileViewer', {
                path: finalPath,
                fileName: name,
                shareId: Date.now(),
                showStartEditing: false
              });
              NativeModules.SharedIntentModule.clearIntent();
            } else {
              // It's direct text (like a ChatGPT link or message)
              const timestamp = Date.now();
              console.log('🔵 SHARE: Creating shared text file with value length:', value.length);
              ToastAndroid.show(t('analyzing'), ToastAndroid.SHORT);
              
              const shareId = timestamp;
              const tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/shared_${timestamp}.txt`;
              console.log('🔵 SHARE: Writing to path:', tempPath);
              // Ensure there's a trailing newline to help the viewer's indexer recognize it as a line immediately
              const finalValue = value.endsWith('\n') ? value : value + '\n';
              await ReactNativeBlobUtil.fs.writeFile(tempPath, finalValue, 'utf8');
              console.log('🔵 SHARE: File written successfully');
              
              // Verify file was written
              const fileExists = await ReactNativeBlobUtil.fs.exists(tempPath);
              const fileSize = fileExists ? await ReactNativeBlobUtil.fs.stat(tempPath) : null;
              console.log('🔵 SHARE: File exists:', fileExists, 'Size:', fileSize?.size);
              
              processedIntentRef.current = value;
              console.log('🔵 SHARE: Navigating with shareId:', shareId, 'path:', tempPath);
              navigation.navigate('MassiveFileViewer', {
                path: tempPath,
                fileName: `Export_Shared_${timestamp}.txt`,
                shareId: shareId,
                showStartEditing: false 
              });
              NativeModules.SharedIntentModule.clearIntent();
            }
          }
        }
      } catch (e: any) {
        console.log('Shared intent error:', e);
        Alert.alert('Share Error', `Failed to process shared content: ${e.message}`);
      }
    };

    // Initial check with a delay to ensure navigation is ready
    const timer = setTimeout(() => {
      checkSharedIntent();
    }, 1000);

    // 🚀 NEW: Check every 2 seconds to handle split-screen sharing or active shares
    const interval = setInterval(() => {
        checkSharedIntent();
    }, 2000);

    // Re-check when app resumes
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        console.log('App became active, checking for shared intent...');
        checkSharedIntent();
      } else if (nextAppState === 'background') {
        processedIntentRef.current = null;
      }
    });

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      subscription.remove();
    };
  }, [navigation, theme, t]);

  const handleUploadFile = async () => {
    try {
        const result = await pickAndGetFile();
        if (result) {
            const MAX_SIZE = 100 * 1024 * 1024 * 1024; // 100 GB
            if (result.size > MAX_SIZE) {
                await ReactNativeBlobUtil.fs.unlink(result.path).catch(() => {});
                Alert.alert(t('file_too_large_title'), t('file_too_large_msg'));
                return;
            }

            if (result.size > 5 * 1024 * 1024 * 1024) {
                 Alert.alert(t('massive_file_title'), t('massive_file_msg'));
            }

            navigation.navigate('MassiveFileViewer', { 
                path: result.path, 
                fileName: result.name,
                originalUri: result.uri
            });
        }
    } catch {
        Alert.alert(t('error'), t('failed_pick'));
    }
  };

  const executeCreateFile = async () => {
      const ext = newFileExt.trim().replace('.', '') || 'txt';
      const name = newFileName.trim() || 'Untitled';
      const fullName = `${name}.${ext}`;
      const tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/new_${Date.now()}.${ext}`;
      
      try {
          // Initialize with some content to ensure the indexer sees at least 1 line
          await ReactNativeBlobUtil.fs.createFile(tempPath, 'New Note', 'utf8');
          setShowNewModal(false);
          navigation.navigate('MassiveFileViewer', {
              path: tempPath,
              fileName: fullName,
              showStartEditing: true
          });
          ToastAndroid.show(`${t('created')} ${fullName}`, ToastAndroid.SHORT);
      } catch {
          Alert.alert(t('error'), t('could_not_create'));
      }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={theme.background} barStyle={theme.isDark ? "light-content" : "dark-content"} />
      <View style={styles.container}>
        <FallingEmojis emojis={emojiTheme} settings={emojiSettings} />

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.appTitle}>NEOSCRIBE</Text>
            <Text style={styles.appSubtitle}>High Performance Text & Code</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.mainButton, themeId === 'Rainbow' ? { backgroundColor: 'transparent' } : { backgroundColor: theme.primary }]} 
              onPress={() => setShowNewModal(true)}
            >
              {themeId === 'Rainbow' ? (
                <RainbowBackground style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
              ) : null}
              <MaterialCommunityIcons 
                name="plus" 
                size={32} 
                color="#FFF" 
                style={themeId === 'Rainbow' ? styles.outlineEffect : {}}
              />
              <Text style={[styles.buttonText, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>{t('new_file')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.mainButton, { backgroundColor: theme.surface }]} 
              onPress={handleUploadFile}
            >
              <MaterialCommunityIcons 
                name="file-upload-outline" 
                size={30} 
                color={themeId === 'Rainbow' ? '#FFFFFF' : theme.primary} 
                style={themeId === 'Rainbow' ? styles.outlineEffect : {}}
              />
              <Text style={[styles.buttonText, { color: theme.text }, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>{t('upload_file')}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>

      {/* New File Modal */}
      <Modal visible={showNewModal} transparent animationType="fade" onRequestClose={() => setShowNewModal(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('new_workspace')}</Text>
                
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('file_name')}</Text>
                    <TextInput 
                        style={styles.textInput}
                        value={newFileName}
                        onChangeText={setNewFileName}
                        placeholder={t('untitled')}
                        placeholderTextColor={theme.textSecondary}
                        autoFocus
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('extension')}</Text>
                    <TextInput 
                        style={styles.textInput}
                        value={newFileExt}
                        onChangeText={setNewFileExt}
                        placeholder="txt"
                        placeholderTextColor={theme.textSecondary}
                    />
                    <View style={styles.extContainer}>
                        {['txt', 'md', 'json', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'rs', 'go', 'sh', 'sql', 'yaml', 'xml', 'lua', 'dart', 'kt', 'cs', 'swift'].map(ext => {
                            const isSelected = newFileExt === ext;
                            return (
                                <TouchableOpacity 
                                    key={ext}
                                    onPress={() => setNewFileExt(ext)}
                                    style={[
                                        styles.extChip, 
                                        isSelected && themeId !== 'Rainbow' && { backgroundColor: theme.primary },
                                        isSelected && themeId === 'Rainbow' && { backgroundColor: 'transparent', borderColor: 'transparent', overflow: 'hidden' }
                                    ]}
                                >
                                    {isSelected && themeId === 'Rainbow' ? (
                                        <RainbowBackground style={StyleSheet.absoluteFill} />
                                    ) : null}
                                    <Text style={[
                                        styles.extChipText, 
                                        isSelected && themeId !== 'Rainbow' && { color: '#fff' },
                                        isSelected && themeId === 'Rainbow' && [styles.outlineEffect, { color: 'white' }]
                                    ]}>
                                        {ext}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.modalButtons}>
                    <TouchableOpacity onPress={() => setShowNewModal(false)} style={styles.buttonSecondary}>
                        <Text style={styles.buttonSecondaryText}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={executeCreateFile} 
                      style={[styles.buttonPrimary, themeId === 'Rainbow' ? { backgroundColor: 'transparent' } : { backgroundColor: theme.primary }]}
                    >
                        {themeId === 'Rainbow' ? (
                          <RainbowBackground style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                        ) : null}
                        <Text style={[styles.buttonPrimaryText, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>{t('start_editing')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
  },
  outlineEffect: {
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1.5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  appTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: -2,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 8,
    opacity: 0.8,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  mainButton: {
    height: 70,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
  },
  footerText: {
    color: theme.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 24,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 24,
    textAlign: 'center'
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  textInput: {
    backgroundColor: theme.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: theme.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.divider
  },
  extContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8
  },
  extChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.background
  },
  extChipText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '600'
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10
  },
  buttonSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonSecondaryText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '600'
  },
  buttonPrimary: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 4
  },
  buttonPrimaryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default HomeScreen;
