import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, StatusBar, ToastAndroid, Modal, TextInput, ScrollView, Share, Animated, Easing } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppGuide } from '../components/AppGuide';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../App';
import { FileViewerInstance, FileViewerInstanceRef } from '../components/FileViewerInstance';
import { OCRTab } from '../components/OCRTab';
import { useAppTheme } from '../hooks/useAppTheme';
import { ThemedAlert } from '../components/ThemedAlert';
import { RainbowBackground } from '../components/RainbowBackground';
import { THEME_PRESETS } from '../theme/themePresets';
import { getTranslation, languages as supportedLanguages } from '../translations';
import { pickAndGetFile, createTempFile } from '../services/scoped-storage-service';

type MassiveFileViewerScreenRouteProp = RouteProp<RootStackParamList, 'MassiveFileViewer'>;

interface EditorTab {
    id: string;
    path: string;
    name: string;
    extension: string;
    isDirty: boolean;
    uri?: string;
    isReadOnly?: boolean;
    scrollLine?: number;
    selectedCount?: number;
    selectedIndices?: number[];
    selectionRange?: { start: number, count: number };
    selectionMode?: boolean;
    isOCR?: boolean;
    showStartEditing?: boolean;
}

export default function MassiveFileViewerScreen() {
    const navigation = useNavigation();
    const route = useRoute<MassiveFileViewerScreenRouteProp>();
    const { path: initialPath, fileName: initialName, originalUri, isReadOnly, isOCR } = route.params;

    const { setThemeId, themeId, theme, language, setLanguage } = useAppTheme();
    const insets = useSafeAreaInsets();
    
    const t = React.useCallback((key: string, params?: any) => getTranslation(language, key, params), [language]);
    
    const [layoutNonce, setLayoutNonce] = useState(0);
    const triggerTabShuffle = React.useCallback(() => {
        setLayoutNonce(prev => prev + 1); // Increment nonce to force a clean layout pass without hiding the view
    }, []);

    const initialTabId = useRef('tab-' + Date.now()).current;

    // Rainbow Animation
    const RAINBOW_CYCLE = 600;
    const RAINBOW_REPEAT = 5;
    const RAINBOW_TOTAL_WIDTH = RAINBOW_CYCLE * RAINBOW_REPEAT;
    const baseColors = ['#E63946', '#F77F00', '#FCBF49', '#06D6A0', '#118AB2', '#073B4C', '#9D4EDD'];
    const rainbowColors: string[] = [];
    for (let i = 0; i < RAINBOW_REPEAT; i++) {
        rainbowColors.push(...baseColors);
    }
    rainbowColors.push(baseColors[0]);

    const isRainbowTheme = themeId === 'Rainbow';

    const rainbowAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const startAnim = () => {
            rainbowAnim.setValue(0);
            Animated.loop(
                Animated.timing(rainbowAnim, {
                    toValue: 1,
                    duration: 4000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
        };

        const timeout = setTimeout(startAnim, 100);
        return () => clearTimeout(timeout);
    }, [rainbowAnim, themeId]); // Added themeId to restart on theme switch

    const rainbowTranslateX = rainbowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -RAINBOW_CYCLE], 
    });

    // Unified outlineStyle is already defined at line 54 (approx)
    // Removed duplicate definitions from lower scopes.

    // Unified Tab State
    const [tabState, setTabState] = useState<{
        activeTabId: string, 
        index: number,
        tabs: EditorTab[]
    }>({
        activeTabId: initialTabId,
        index: 0,
        tabs: [
            { 
                id: initialTabId,
                path: initialPath, 
                name: initialName || 'Untitled', 
                extension: getExt(initialName || 'file.txt'),
                isDirty: false,
                isReadOnly: !!isReadOnly,
                uri: originalUri,
                isOCR: !!isOCR,
                showStartEditing: !!route.params.showStartEditing
            }
        ]
    });
    
    // Track last processed path and shareId to avoid double-adding or missing same-file shares
    const lastProcessedPathRef = useRef<string>(initialPath);
    const lastProcessedShareIdRef = useRef<any>(route.params?.shareId);
    
    // Themed Alert State
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMsg, setAlertMsg] = useState('');
    const [alertButtons, setAlertButtons] = useState<any[]>([]);

    const showThemedAlert = React.useCallback((title: string, message: string, buttons?: any[]) => {
        setAlertTitle(title);
        setAlertMsg(message);
        setAlertButtons(buttons || [{ text: t('got_it'), onPress: () => {} }]);
        setAlertVisible(true);
    }, [t]);

    useEffect(() => {
        const newPath = route.params?.path;
        const shareId = route.params?.shareId;
        
        console.log('🟢 VIEWER: useEffect triggered, newPath:', newPath, 'shareId:', shareId);
        console.log('🟢 VIEWER: lastProcessedPath:', lastProcessedPathRef.current);
        console.log('🟢 VIEWER: lastProcessedShareId:', lastProcessedShareIdRef.current);
        
        const isNewPath = newPath && newPath !== lastProcessedPathRef.current;
        const isNewShare = shareId && shareId !== lastProcessedShareIdRef.current;

        console.log('🟢 VIEWER: isNewPath:', isNewPath, 'isNewShare:', isNewShare);

        if (isNewPath || isNewShare) {
            console.log('🟢 VIEWER: Processing new tab/share');
            if (newPath) lastProcessedPathRef.current = newPath;
            if (shareId) lastProcessedShareIdRef.current = shareId;
            setTabState(prev => {
                const existingTabIndex = prev.tabs.findIndex(t_check => t_check.path === newPath);
                console.log('🟢 VIEWER: Existing tab index:', existingTabIndex);
                
                if (existingTabIndex !== -1) {
                    console.log('🟢 VIEWER: Switching to existing tab:', prev.tabs[existingTabIndex].name);
                    return { ...prev, index: existingTabIndex, activeTabId: prev.tabs[existingTabIndex].id };
                }
                
                if (prev.tabs.length >= 10) {
                    console.log('🟢 VIEWER: Tab limit reached');
                    showThemedAlert(t('limit_reached'), t('max_tabs_msg'));
                    return prev;
                }
                
                const newId = 'tab-' + Date.now();
                console.log('🟢 VIEWER: Creating new tab with id:', newId, 'path:', newPath);
                const newTab: EditorTab = {
                    id: newId,
                    path: newPath!,
                    name: route.params.fileName || 'Untitled',
                    extension: getExt(route.params.fileName || 'file.txt'),
                    isDirty: false,
                    isReadOnly: !!route.params.isReadOnly,
                    uri: route.params.originalUri,
                    isOCR: !!route.params.isOCR,
                    showStartEditing: !!route.params.showStartEditing
                };
                
                console.log('🟢 VIEWER: New tab created:', newTab.name);
                const newState = {
                    ...prev,
                    tabs: [...prev.tabs, newTab],
                    activeTabId: newId,
                    index: prev.tabs.length
                };
                // --- THE HAMMER OF TRUTH ---
                // Force a full layout refresh to clear native artifacts without the 'Grey Flash'
                triggerTabShuffle();
                return newState;
            });
        } else {
            console.log('🟢 VIEWER: No new path or shareId, skipping tab creation');
        }
    }, [route.params, language, showThemedAlert, t, triggerTabShuffle]);

    const { tabs, activeTabId, index } = tabState;

    const setIndex = (newIndex: number) => {
        if (tabs[newIndex]) {
            setTabState(prev => ({ ...prev, index: newIndex, activeTabId: tabs[newIndex].id }));
        }
    };

    const [showSettings, setShowSettings] = useState(false);
    const [fontSize, setFontSize] = useState(14);
    
    // Scroll tracking for custom indicator
    const [scrollX, setScrollX] = useState(0);
    const [toolbarContainerWidth, setToolbarContainerWidth] = useState(0);
    const [toolbarContentWidth, setToolbarContentWidth] = useState(0);
    // New Tab Creation State
    const [createFileModalVisible, setCreateFileModalVisible] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [newFileExtension, setNewFileExtension] = useState('txt');
    const [showGuide, setShowGuide] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState(false);
    const [showSaveCopyModal, setShowSaveCopyModal] = useState(false);
    const [saveCopyFileName, setSaveCopyFileName] = useState('');
    const [saveCopyExtension, setSaveCopyExtension] = useState('txt');
    const [saveCopyCustomExt, setSaveCopyCustomExt] = useState('');
    const [saveCopyAsPlainText, _setSaveCopyAsPlainText] = useState(true);



    const getT = (key: string) => getTranslation(language, key);

    const isSharingRef = useRef(false);
    const isExportingLargeSelectionRef = useRef(false);
    const pendingLargeSelectionPathRef = useRef('');

    // Refs for each instance
    const instanceRefs = useRef<{ [key: string]: FileViewerInstanceRef | null }>({});

    function getExt(name: string) {
        const parts = name.split('.');
        const ext = parts.length > 1 ? parts[parts.length - 1] : 'txt';
        return ext.toLowerCase();
    }

    const activeTab = tabs[index] || tabs[0];
    const activeRef = instanceRefs.current[activeTab.id];
    const selectedCount = activeTab.selectedCount || 0;

    const closeTab = React.useCallback((id: string) => {
        if (tabs.length === 1) {
            navigation.goBack();
            return;
        }
        
        const tabIndexToRemove = tabs.findIndex(tab => tab.id === id);
        if (tabIndexToRemove === -1) return;

        const newTabs = tabs.filter(tab => tab.id !== id);
        
        let nextActiveTabId = activeTabId;
        let nextIdx = index;
        if (id === activeTabId) {
            const potentialNextIdx = tabIndexToRemove > 0 ? tabIndexToRemove - 1 : 0;
            nextIdx = Math.min(potentialNextIdx, newTabs.length - 1);
            nextActiveTabId = newTabs[nextIdx].id;
        } else {
            nextIdx = newTabs.findIndex(tab => tab.id === activeTabId);
        }

        setTabState(prev => ({
            ...prev,
            tabs: newTabs,
            activeTabId: nextActiveTabId,
            index: nextIdx
        }));
    }, [tabs, activeTabId, index, navigation]);

    const handleSelectionChanged = React.useCallback((id: string, count: number, indices: number[], range: any, mode: boolean) => {
        // --- SELECTION SEAL ---
        // Verify this event is actually meant for the current active tab
        // Prevents 'echo' events from background tabs during rapid switching
        setTabState(prev => {
            if (id !== prev.activeTabId) return prev;
            return {
                ...prev,
                tabs: prev.tabs.map(tab => tab.id === id ? { ...tab, selectedCount: count, selectedIndices: indices, selectionRange: range, selectionMode: mode } : tab)
            };
        });
    }, []);

    const handleSaveComplete = React.useCallback(async (event: any) => {
        const { status, path } = event.nativeEvent;
        if (isExportingLargeSelectionRef.current && status === 'success') {
            isExportingLargeSelectionRef.current = false;
            const tempPath = pendingLargeSelectionPathRef.current || path;
            const fileName = `HugeSelection_${Date.now()}.txt`;
            
            if (tabs.length < 10) {
                const newId = 'tab-' + Date.now();
                setTabState(prev => ({ 
                    ...prev, 
                    tabs: [...prev.tabs, { id: newId, path: tempPath, name: fileName, extension: 'txt', isDirty: false, isReadOnly: false }], 
                    activeTabId: newId, 
                    index: prev.tabs.length 
                }));
                showThemedAlert(t('massive_selection_title'), t('massive_selection_msg'));
            } else {
                 showThemedAlert(t('error'), t('max_tabs_msg'));
            }
            
            activeRef?.clearSelection();
            setTabState(prev => ({
                ...prev,
                tabs: prev.tabs.map(tab => tab.id === activeTabId ? { ...tab, selectionMode: false, selectedCount: 0, selectedIndices: [] } : tab)
            }));
        }
    }, [tabs, activeTabId, activeRef, showThemedAlert, t]);

    const handleLinesTextReceived = React.useCallback(async (text: string) => {
        if (!text) return;

        if (text === '[MASSIVE_SELECTION]') {
            isSharingRef.current = false;
            showThemedAlert(t('large_selection_title'), t('massive_selection_msg'));
            return;
        }

        // Estimate byte size (UTF-8 worst-case: 3 bytes per char — fast, no TextEncoder needed)
        const byteSize = text.length * 3;
        const CLIPBOARD_LIMIT = 800 * 1024;   // 800 KB — safe Android clipboard cap
        const SHARE_FILE_LIMIT = 4 * 1024 * 1024; // 4 MB — above this, share as file

        if (isSharingRef.current) {
            isSharingRef.current = false;

            if (byteSize > SHARE_FILE_LIMIT) {
                // Too large to share or even warn safely as a string — automate the 'Save as New Tab' fallback
                try {
                    const fileName = `HugeSelection_${Date.now()}.txt`;
                    const fileInfo = await createTempFile(fileName, text);
                    if (fileInfo && tabs.length < 10) {
                        const newId = 'tab-' + Date.now();
                        setTabState(prev => ({ 
                            ...prev, 
                            tabs: [...prev.tabs, { id: newId, path: fileInfo.path, name: fileName, extension: 'txt', isDirty: false, isReadOnly: false, uri: fileInfo.uri }], 
                            activeTabId: newId, 
                            index: prev.tabs.length 
                        }));
                        showThemedAlert(t('large_selection_title'), t('massive_selection_msg'));
                    } else if (tabs.length >= 10) {
                         showThemedAlert(t('error'), t('max_tabs_msg'));
                    }
                    activeRef?.clearSelection();
                    setTabState(prev => ({
                        ...prev,
                        tabs: prev.tabs.map(tab => tab.id === activeTabId ? { ...tab, selectionMode: false, selectedCount: 0, selectedIndices: [] } : tab)
                    }));
                } catch (err) {
                    console.error(err);
                }
                return;
            }

            if (byteSize > CLIPBOARD_LIMIT) {
                // Warn user — Share.share may hang with this, offer save-as-file fallback
                showThemedAlert(
                    t('large_selection_title'),
                    t('large_selection_msg', { size: Math.round(byteSize / 1024) }),
                    [
                        { text: t('share_anyway'), onPress: async () => {
                            try { await Share.share({ message: text }); } catch (e) { console.error(e); }
                            activeRef?.clearSelection();
                            setTabState(prev => ({ ...prev, tabs: prev.tabs.map(tab => tab.id === activeTabId ? { ...tab, selectionMode: false, selectedCount: 0, selectedIndices: [] } : tab) }));
                        }},
                        { text: t('save_as_file'), onPress: async () => {
                            const fileName = `Selection_${Date.now()}.txt`;
                            const fileInfo = await createTempFile(fileName, text);
                            if (fileInfo && tabs.length < 10) {
                                const newId = 'tab-' + Date.now();
                                setTabState(prev => ({ ...prev, tabs: [...prev.tabs, { id: newId, path: fileInfo.path, name: fileName, extension: 'txt', isDirty: false, isReadOnly: false, uri: fileInfo.uri }], activeTabId: newId, index: prev.tabs.length }));
                                ToastAndroid.show(t('selection_tab_msg'), ToastAndroid.LONG);
                            }
                            activeRef?.clearSelection();
                            setTabState(prev => ({ ...prev, tabs: prev.tabs.map(tab => tab.id === activeTabId ? { ...tab, selectionMode: false, selectedCount: 0, selectedIndices: [] } : tab) }));
                        }},
                        { text: t('cancel'), style: 'cancel' },
                    ]
                );
                return;
            }

            try {
                await Share.share({ message: text });
                activeRef?.clearSelection();
                setTabState(prev => ({
                    ...prev,
                    tabs: prev.tabs.map(tab => tab.id === activeTabId ? { ...tab, selectionMode: false, selectedCount: 0, selectedIndices: [] } : tab)
                }));
            } catch (err) {
                console.error(err);
            }
            return;
        }

        if (tabs.length >= 10) {
            showThemedAlert(t('limit_reached'), t('max_tabs_msg'));
            return;
        }

        // Clear selection in source tab after export
        activeRef?.clearSelection();
        setTabState(prev => ({
            ...prev,
            tabs: prev.tabs.map(tab => tab.id === activeTabId ? { ...tab, selectionMode: false, selectedCount: 0, selectedIndices: [] } : tab)
        }));
        try {
            const fileName = `Export_${Date.now()}.txt`;
            const fileInfo = await createTempFile(fileName, text);
            if (!fileInfo) return;
            const newId = 'tab-' + Date.now();
            const newTab: EditorTab = {
                id: newId, path: fileInfo.path, name: fileName, extension: fileInfo.extension,
                isDirty: false, isReadOnly: false, uri: fileInfo.uri
            };
            setTabState(prev => ({
                ...prev, tabs: [...prev.tabs, newTab], activeTabId: newId, index: prev.tabs.length
            }));
            ToastAndroid.show(t('exported_tab'), ToastAndroid.SHORT);
        } catch (e) {
            console.error(e);
            showThemedAlert(t('error'), t('failed_apply'));
        }
    }, [tabs, activeTabId, activeRef, t, showThemedAlert]);

    const handleImportFile = async () => {
        if (tabs.length >= 10) {
            showThemedAlert(t('limit_reached'), t('max_tabs_msg'));
            return;
        }
        try {
            const file = await pickAndGetFile();
            if (!file) return;
            const newId = 'tab-' + Date.now();
            const newTab: EditorTab = {
                id: newId, path: file.path, name: file.name, extension: file.extension || 'txt',
                isDirty: false, isReadOnly: false, uri: file.uri
            };
            setTabState(prev => ({
                ...prev, tabs: [...prev.tabs, newTab], activeTabId: newId, index: prev.tabs.length
            }));
            ToastAndroid.show(t('file_imported'), ToastAndroid.SHORT);
        } catch {
            showThemedAlert(t('error'), t('failed_pick'));
        }
    };

    const handleNewTab = () => {
        setNewFileName('');
        setCreateFileModalVisible(true);
    };

    const handleNewOCR = () => {
        if (tabs.length >= 10) {
            showThemedAlert(t('limit_reached'), t('max_tabs_msg'));
            return;
        }
        const newId = 'ocr-' + Date.now();
        const newTab: EditorTab = {
            id: newId, path: '', name: 'Scan Image', extension: 'ocr',
            isDirty: false, isOCR: true
        };
        setTabState(prev => ({
            ...prev, tabs: [...prev.tabs, newTab], activeTabId: newId, index: prev.tabs.length
        }));
    };

    const confirmCreateTab = async () => {
        if (tabs.length >= 10) {
            showThemedAlert(t('limit_reached'), t('max_tabs_msg'));
            setCreateFileModalVisible(false);
            return;
        }
        setCreateFileModalVisible(false);
        try {
            const finalName = (newFileName || 'Untitled') + '.' + newFileExtension;
            const fileInfo = await createTempFile(finalName);
            if (!fileInfo) return;
            const newId = 'tab-' + Date.now();
            const newTab: EditorTab = {
                id: newId, path: fileInfo.path, name: finalName, extension: fileInfo.extension,
                isDirty: false, isReadOnly: false, uri: fileInfo.uri,
                showStartEditing: true
            };
            setTimeout(() => {
                setTabState(prev => ({
                    ...prev, tabs: [...prev.tabs, newTab], activeTabId: newId, index: prev.tabs.length
                }));
            }, 100);
            ToastAndroid.show(t('new_tab_created'), ToastAndroid.SHORT);
        } catch (err) {
            console.error(err);
            showThemedAlert(t('error'), t('could_not_create'));
        }
    };


    const renderSelectionHeader = () => {
        
        return (
            <View style={[styles.selectionHeaderContainer, { overflow: 'hidden' }]}>
                {isRainbowTheme ? (
                    <Animated.View style={[StyleSheet.absoluteFill, { width: RAINBOW_TOTAL_WIDTH, transform: [{ translateX: rainbowTranslateX }] }]}>
                        <LinearGradient 
                            colors={rainbowColors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.primary }]} />
                )}
                
                <TouchableOpacity onPress={() => {
                    activeRef?.clearSelection();
                    setTabState(prev => ({
                        ...prev,
                        tabs: prev.tabs.map(tab => tab.id === activeTab.id ? { ...tab, selectionMode: false, selectedCount: 0, selectedIndices: [] } : tab)
                    }));
                }} style={styles.headerIcon}>
                    <MaterialCommunityIcons name="close" size={24} color="white" style={isRainbowTheme ? styles.outlineEffect : {}} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: 'white', flex: 1 }, isRainbowTheme ? styles.outlineEffect : {}]}>
                    {selectedCount} {getT('selected')}
                </Text>
                <TouchableOpacity onPress={() => activeRef?.selectAll()} style={styles.headerIconSmall}>
                    <MaterialCommunityIcons name="select-all" size={24} color="white" style={isRainbowTheme ? styles.outlineEffect : {}} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => activeRef?.showRangeSelectionModal()} style={styles.headerIconSmall}>
                    <MaterialCommunityIcons name="arrow-expand-vertical" size={24} color="white" style={isRainbowTheme ? styles.outlineEffect : {}} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                    // Estimate size before hitting native clipboard (avg 600 bytes/line)
                    const CLIPBOARD_LIMIT = 800 * 1024;
                    const estimatedBytes = selectedCount * 600;
                    if (estimatedBytes > CLIPBOARD_LIMIT) {
                        showThemedAlert(
                            t('large_copy_title'),
                            t('large_copy_msg', { count: selectedCount.toLocaleString(), size: Math.round(estimatedBytes / 1024) }),
                            [
                                { text: t('copy_anyway'), onPress: () => activeRef?.copySelectionToClipboard() },
                                { text: t('cancel'), style: 'cancel' },
                            ]
                        );
                    } else {
                        activeRef?.copySelectionToClipboard();
                    }
                }} style={styles.headerIconSmall}>
                    <MaterialCommunityIcons name="content-copy" size={24} color="white" style={isRainbowTheme ? styles.outlineEffect : {}} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => activeRef?.editSelectedInSora()} style={styles.headerIconSmall}>
                    <MaterialCommunityIcons name="pencil" size={24} color="white" style={isRainbowTheme ? styles.outlineEffect : {}} />
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => {
                    if (selectedCount > 2000) {
                         // Native Export Path for Huge Selections
                         const fileName = `HugeExport_${Date.now()}.txt`;
                         const fileInfo = await createTempFile(fileName, ""); 
                         if (fileInfo) {
                             isExportingLargeSelectionRef.current = true;
                             pendingLargeSelectionPathRef.current = fileInfo.path;
                             activeRef?.exportSelectionToFile(fileInfo.path);
                         }
                    } else {
                        isSharingRef.current = true;
                        activeRef?.getSelectedTextForBridge();
                    }
                }} style={styles.headerIconSmall}>
                    <MaterialCommunityIcons name="share-variant" size={24} color="white" style={isRainbowTheme ? styles.outlineEffect : {}} />
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => {
                    if (selectedCount > 2000) {
                         const fileName = `HugeExport_${Date.now()}.txt`;
                         const fileInfo = await createTempFile(fileName, ""); 
                         if (fileInfo) {
                             isExportingLargeSelectionRef.current = true;
                             pendingLargeSelectionPathRef.current = fileInfo.path;
                             activeRef?.exportSelectionToFile(fileInfo.path);
                         }
                    } else {
                        isSharingRef.current = false;
                        activeRef?.getSelectedTextForBridge();
                    }
                }} style={styles.headerIcon}>
                    <MaterialCommunityIcons name="plus-box-outline" size={26} color="white" style={isRainbowTheme ? styles.outlineEffect : {}} />
                </TouchableOpacity>
            </View>
        );
    };

    const renderHeader = () => {
        if (activeTab.selectionMode) return renderSelectionHeader();
        return (
            <View style={[styles.header, { backgroundColor: theme.surface }]}>
                <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={[styles.titleContainer, { flex: 0, minWidth: 20 }]} />
                <View style={{ flex: 1 }}>
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
                        onLayout={(e) => setToolbarContainerWidth(e.nativeEvent.layout.width)}
                        onContentSizeChange={(w) => setToolbarContentWidth(w)}
                        scrollEventThrottle={16}
                        contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingRight: 10 }}
                    >
                        <TouchableOpacity style={styles.headerIcon} onPress={() => setShowLanguageModal(true)}>
                            <MaterialCommunityIcons name="translate" size={24} color={themeId === 'Rainbow' ? 'white' : theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerIcon} onPress={() => setShowGuide(true)}>
                            <MaterialCommunityIcons name="help-circle-outline" size={24} color={themeId === 'Rainbow' ? 'white' : theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerIcon} onPress={handleImportFile}>
                            <MaterialCommunityIcons name="upload" size={26} color={themeId === 'Rainbow' ? 'white' : theme.text} style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerIcon} onPress={() => activeRef?.save()}>
                            <MaterialCommunityIcons name="content-save-outline" size={26} color={activeTab.isDirty ? theme.primary : (themeId === 'Rainbow' ? 'white' : theme.text)} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerIconSmall} onPress={() => {
                            const currentName = activeTab.name.replace(/\.[^/.]+$/, ''); // Remove extension
                            setSaveCopyFileName(currentName + '_copy');
                            setSaveCopyExtension(activeTab.extension || 'txt');
                            setShowSaveCopyModal(true);
                        }}>
                            <MaterialCommunityIcons name="content-save-all-outline" size={24} color={themeId === 'Rainbow' ? 'white' : theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerIconSmall} onPress={() => activeRef?.reload()}>
                            <MaterialCommunityIcons name="refresh" size={24} color={themeId === 'Rainbow' ? 'white' : theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerIconSmall} onPress={() => setShowSettings(!showSettings)}>
                            <MaterialCommunityIcons name="eye-settings" size={24} color={themeId === 'Rainbow' ? 'white' : theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerIconSmall} onPress={() => activeRef?.showJumpModal()}>
                            <MaterialCommunityIcons name="format-line-spacing" size={24} color={themeId === 'Rainbow' ? 'white' : theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerIcon} onPress={() => activeRef?.toggleSearch()}>
                            <MaterialCommunityIcons name="magnify" size={24} color={themeId === 'Rainbow' ? 'white' : theme.text} />
                        </TouchableOpacity>
                    </ScrollView>
                    
                    {/* Custom Colorful Scroll Indicator */}
                    {toolbarContentWidth > toolbarContainerWidth && (
                        <View style={{ height: 2, backgroundColor: theme.divider, marginHorizontal: 12, borderRadius: 1, marginBottom: 4, overflow: 'hidden' }}>
                            {themeId === 'Rainbow' ? (
                                <View style={{ 
                                    position: 'absolute', 
                                    height: 2, 
                                    width: (toolbarContainerWidth / toolbarContentWidth) * (toolbarContainerWidth - 24),
                                    left: (scrollX / toolbarContentWidth) * (toolbarContainerWidth - 24),
                                    overflow: 'hidden'
                                }}>
                                    <Animated.View style={{ 
                                        width: RAINBOW_TOTAL_WIDTH, 
                                        height: 2,
                                        transform: [{ translateX: rainbowTranslateX }]
                                    }}>
                                        <LinearGradient
                                            colors={rainbowColors}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={StyleSheet.absoluteFill}
                                        />
                                    </Animated.View>
                                </View>
                            ) : (
                                <View style={{
                                    position: 'absolute',
                                    height: 2,
                                    backgroundColor: theme.primary,
                                    borderRadius: 1,
                                    width: (toolbarContainerWidth / toolbarContentWidth) * (toolbarContainerWidth - 24),
                                    left: (scrollX / toolbarContentWidth) * (toolbarContainerWidth - 24)
                                }} />
                            )}
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const renderCustomTabBar = () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, elevation: 4, zIndex: 100, borderBottomWidth: 1, borderBottomColor: theme.divider }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', paddingHorizontal: 5 }}>
                    {tabs.map((tab, i) => {
                        const isActive = activeTabId === tab.id;
                        
                        return (
                            <View key={tab.id} style={{ position: 'relative' }}>
                                <TouchableOpacity 
                                    onPress={() => setIndex(i)}
                                    style={[
                                        styles.horizontalTab, 
                                        { 
                                            backgroundColor: isActive ? theme.background : 'transparent',
                                            borderBottomWidth: 0 // Remove default border
                                        }
                                    ]}
                                >
                                    <Text numberOfLines={1} style={[styles.tabLabel, { color: isActive ? (isRainbowTheme ? '#FFFFFF' : theme.primary) : theme.textSecondary, fontWeight: isActive ? 'bold' : 'normal' }]}>
                                        {tab.name}
                                    </Text>
                                    <TouchableOpacity onPress={() => closeTab(tab.id)} style={{ padding: 4, marginLeft: 5 }}>
                                        <MaterialCommunityIcons name="close" size={14} color={isActive ? (isRainbowTheme ? '#FFFFFF' : theme.primary) : theme.textSecondary} />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                                {isActive && isRainbowTheme && (
                                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, overflow: 'hidden' }}>
                                        <Animated.View style={{ width: RAINBOW_TOTAL_WIDTH, height: 2, transform: [{ translateX: rainbowTranslateX }] }}>
                                            <LinearGradient
                                                colors={rainbowColors}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={StyleSheet.absoluteFill}
                                            />
                                        </Animated.View>
                                    </View>
                                )}
                                {isActive && !isRainbowTheme && (
                                    <View style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        height: 2,
                                        backgroundColor: theme.primary
                                    }} />
                                )}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
            <TouchableOpacity 
                style={[styles.plusButton, { borderLeftColor: theme.divider, backgroundColor: theme.surface }]} 
                onPress={handleNewOCR}
            >
                <MaterialCommunityIcons name="text-recognition" size={22} color={themeId === 'Rainbow' ? '#FFFFFF' : theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.plusButton, { borderLeftColor: theme.divider, backgroundColor: theme.surface }]} 
                onPress={handleNewTab}
            >
                <MaterialCommunityIcons name="plus" size={24} color={themeId === 'Rainbow' ? '#FFFFFF' : theme.primary} />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[
            styles.container, 
            { 
                backgroundColor: theme.background, 
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
                paddingLeft: insets.left,
                paddingRight: insets.right
            }
        ]}>
            <StatusBar backgroundColor={theme.surface} barStyle={theme.isDark ? "light-content" : "dark-content"} />
            
            {renderHeader()}
            {renderCustomTabBar()}

            {showSettings && (
                <View style={[styles.settingsPanel, { backgroundColor: theme.surface, borderBottomColor: theme.divider, borderBottomWidth: 1, maxHeight: 400 }]}>
                    <ScrollView>
                        <View style={styles.settingsRow}>
                            <Text style={[styles.settingsText, { color: theme.text }]}>{getT('font_size')}: {fontSize}px</Text>
                            <TouchableOpacity onPress={() => setFontSize(14)}>
                                <Text style={[styles.settingsActionText, { color: themeId === 'Rainbow' ? 'white' : theme.primary }]}>{getT('reset')}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.settingsControls}>
                            <TouchableOpacity onPress={() => setFontSize(Math.max(8, fontSize - 1))} style={[styles.settingsBtn, { borderWidth: 1, borderColor: theme.divider }]}>
                                <MaterialCommunityIcons name="minus" size={20} color={theme.text} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setFontSize(Math.min(32, fontSize + 1))} style={[styles.settingsBtn, { borderWidth: 1, borderColor: theme.divider, marginLeft: 10 }]}>
                                <MaterialCommunityIcons name="plus" size={20} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.settingsText, { color: theme.textSecondary, fontSize: 11, marginTop: 20, marginBottom: 10, fontWeight: 'bold' }]}>{getT('app_theme')}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 5 }}>
                            {(() => {
                                const order = ['Pure Teal', 'Paper Teal', 'Teal', 'Rainbow', 'Paper', 'Forest', 'Charcoal Ember'];
                                return Object.keys(THEME_PRESETS)
                                    .filter(tId => tId !== 'Iridescent')
                                    .sort((a, b) => {
                                        const indexA = order.indexOf(a);
                                        const indexB = order.indexOf(b);
                                        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                        if (indexA !== -1) return -1;
                                        if (indexB !== -1) return 1;
                                        return a.localeCompare(b);
                                    });
                            })().map((tId) => {
                                const isSelected = themeId === tId;
                                
                                return (
                                    <TouchableOpacity 
                                        key={tId} 
                                        onPress={() => setThemeId(tId)} 
                                        style={[
                                            styles.themeButton, 
                                            { 
                                                backgroundColor: isSelected ? (tId === 'Rainbow' ? 'rgba(255,255,255,0.2)' : theme.primary + '33') : theme.background,
                                                borderWidth: 1, 
                                                borderColor: isSelected ? (tId === 'Rainbow' ? 'white' : theme.primary) : theme.divider,
                                                borderLeftWidth: isSelected ? 5 : 1,
                                                borderLeftColor: isSelected ? (tId === 'Rainbow' ? 'white' : theme.primary) : theme.divider,
                                                marginRight: 10,
                                                paddingHorizontal: 15,
                                                paddingVertical: 8,
                                                borderRadius: 20,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                overflow: 'hidden'
                                            }
                                        ]}
                                    >
                                        {isSelected && tId === 'Rainbow' && (
                                            <RainbowBackground style={StyleSheet.absoluteFill} />
                                        )}
                                        {tId === 'Rainbow' ? (
                                            <View style={{ width: 12, height: 12, borderRadius: 6, overflow: 'hidden', marginRight: 8 }}>
                                                <RainbowBackground style={StyleSheet.absoluteFill} />
                                                {!isSelected && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />}
                                            </View>
                                        ) : (
                                            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: THEME_PRESETS[tId].primary, marginRight: 8 }} />
                                        )}
                                        <Text style={[styles.themeButtonText, { color: isSelected ? '#fff' : theme.text, fontWeight: isSelected ? 'bold' : 'normal' }, isSelected && tId === 'Rainbow' ? styles.outlineEffect : {}]}>{tId}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </ScrollView>
                </View>
            )}

            <View style={{ flex: 1 }}>
                {tabs.map((tab) => (
                    <View key={tab.id + '-' + layoutNonce} style={{ display: activeTabId === tab.id ? 'flex' : 'none', flex: 1 }}>
                        {tab.isOCR ? (
                            <OCRTab 
                                initialImageUri={tab.path} 
                                onResult={(text) => handleLinesTextReceived(text)} 
                            />
                        ) : (
                            <FileViewerInstance 
                                ref={r => { instanceRefs.current[tab.id] = r; }}
                                tabId={tab.id}
                                triggerTabShuffle={triggerTabShuffle}
                                path={tab.path}
                                name={tab.name}
                                extension={tab.extension}
                                initialUri={tab.uri}
                                isReadOnly={tab.isReadOnly}
                                initialScrollLine={tab.scrollLine}
                                initialSelectedCount={tab.selectedCount}
                                initialSelectedIndices={tab.selectedIndices}
                                initialSelectionRange={tab.selectionRange}
                                initialSelectionMode={tab.selectionMode}
                                theme={theme}
                                themeId={themeId}
                                insets={insets}
                                fontSize={fontSize}
                                showStartEditing={tab.showStartEditing}
                                onDirtyChange={(id, dirty) => {
                                    setTabState(prev => ({
                                        ...prev,
                                        tabs: prev.tabs.map(t_inner => t_inner.id === id ? { ...t_inner, isDirty: dirty } : t_inner)
                                    }));
                                }}
                                onUriChange={(id, uri) => {
                                    setTabState(prev => ({
                                        ...prev,
                                        tabs: prev.tabs.map(t_inner => t_inner.id === id ? { ...t_inner, uri } : t_inner)
                                    }));
                                }}
                                onSelectionChanged={handleSelectionChanged}
                                onLinesText={({ nativeEvent }: any) => handleLinesTextReceived(nativeEvent.text)}
                                onSaveComplete={handleSaveComplete}
                                onScroll={() => {}}
                                onClose={() => closeTab(tab.id)}
                                onHardReset={() => {
                                    setShowSettings(false);
                                    setFontSize(14);
                                }}
                            />
                        )}
                    </View>
                ))}
            </View>

            <Modal visible={createFileModalVisible} transparent animationType="fade" onRequestClose={() => setCreateFileModalVisible(false)}>
                <View style={styles.createFileModal}>
                    <View style={[styles.createFileContainer, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.createFileTitle, { color: theme.text }]}>{getT('create_new')}</Text>
                        <TextInput style={[styles.createFileInput, { color: theme.text, borderColor: theme.divider }]} placeholder={getT('enter_filename')} placeholderTextColor={theme.textSecondary} value={newFileName} onChangeText={setNewFileName} autoFocus />
                        <View style={styles.extToggleContainer}>
                              <Text style={{color: theme.text}}>{getT('extension')}:</Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{maxHeight: 44}}>
                                  {['txt', 'md', 'json', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'rs', 'go', 'sh', 'sql', 'yaml', 'xml', 'lua', 'dart', 'kt', 'cs', 'swift'].map(ext => (
                                      <TouchableOpacity key={ext} onPress={() => setNewFileExtension(ext)} style={[styles.extToggle, { backgroundColor: newFileExtension === ext ? (themeId === 'Rainbow' ? 'transparent' : theme.primary) : 'transparent', overflow: 'hidden' }]}>
                                          {newFileExtension === ext && themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
                                          <Text style={[styles.extText, { color: newFileExtension === ext ? 'white' : theme.text }, newFileExtension === ext && themeId === 'Rainbow' ? (isRainbowTheme ? styles.outlineEffect : {}) : {}]}>{ext.toUpperCase()}</Text>
                                      </TouchableOpacity>
                                  ))}
                              </ScrollView>
                        </View>
                        <View style={styles.createFileButtons}>
                            <TouchableOpacity onPress={() => setCreateFileModalVisible(false)} style={styles.modalActionBtn}><Text style={{color: theme.textSecondary}}>{getT('cancel')}</Text></TouchableOpacity>
                            <TouchableOpacity  
                              onPress={confirmCreateTab} 
                              style={[styles.modalActionBtn, themeId === 'Rainbow' ? { backgroundColor: 'transparent', overflow: 'hidden' } : { backgroundColor: theme.primary }, { borderRadius: 5 }]}
                            >
                                {themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
                                <Text style={[styles.modalActionPrimaryText, themeId === 'Rainbow' ? (isRainbowTheme ? styles.outlineEffect : {}) : {}]}>{getT('create')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showLanguageModal} transparent animationType="slide" onRequestClose={() => setShowLanguageModal(false)}>
                <View style={styles.createFileModal}>
                    <View style={[styles.createFileContainer, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.createFileTitle, { color: theme.text }]}>{getT('select_lang')}</Text>
                        <ScrollView style={{maxHeight: 300}}>
                            {supportedLanguages.map(lang => (
                                <TouchableOpacity 
                                    key={lang.code} 
                                    onPress={() => {
                                        setLanguage(lang.name);
                                        setShowLanguageModal(false);
                                        ToastAndroid.show(t('lang_changed_to', { language: lang.name }), ToastAndroid.SHORT);
                                    }} 
                                    style={[styles.modalActionBtn, { borderBottomWidth: 1, borderBottomColor: theme.divider, overflow: 'hidden' }, language === lang.name && themeId === 'Rainbow' ? { backgroundColor: 'transparent' } : {}]}
                                >
                                    {language === lang.name && themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
                                    <Text style={{color: language === lang.name ? (themeId === 'Rainbow' ? 'white' : theme.primary) : theme.text, fontWeight: language === lang.name ? 'bold' : 'normal', ...(language === lang.name && themeId === 'Rainbow' ? styles.outlineEffect : {})}}>
                                        {lang.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity onPress={() => setShowLanguageModal(false)} style={[styles.modalActionBtn, { alignSelf: 'flex-end', marginTop: 10 }]}>
                            <Text style={{color: theme.textSecondary}}>{getT('close')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Save Copy Modal */}
            <Modal visible={showSaveCopyModal} transparent animationType="fade" onRequestClose={() => setShowSaveCopyModal(false)}>
                <View style={styles.createFileModal}>
                    <View style={[styles.createFileContainer, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.createFileTitle, { color: theme.text }]}>{getT('save_copy_as')}</Text>
                        
                        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{getT('file_name')}</Text>
                        <TextInput 
                            style={[styles.createFileInput, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.background }]}
                            value={saveCopyFileName}
                            onChangeText={setSaveCopyFileName}
                            placeholder={getT('enter_filename')}
                            placeholderTextColor={theme.textSecondary}
                        />
                        
                        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{getT('extension')}</Text>
                        <View style={[styles.extToggleContainer, { flexWrap: 'wrap' }]}>
                            {['txt', 'md', 'json', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'rs', 'go', 'sh', 'sql', 'yaml', 'xml', 'lua', 'dart', 'kt', 'cs', 'log'].map(ext => {
                                const isSelected = saveCopyExtension === ext && !saveCopyCustomExt;
                                return (
                                    <TouchableOpacity 
                                        key={ext}
                                        onPress={() => { setSaveCopyExtension(ext); setSaveCopyCustomExt(''); }}
                                        style={[
                                            styles.extToggle, 
                                            { borderWidth: 1, borderColor: theme.divider },
                                            isSelected && themeId !== 'Rainbow' && { backgroundColor: theme.primary },
                                            isSelected && themeId === 'Rainbow' && { backgroundColor: 'transparent', overflow: 'hidden' }
                                        ]}
                                    >
                                        {isSelected && themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
                                        <Text style={[
                                            styles.extText, 
                                            { color: isSelected ? (themeId === 'Rainbow' ? 'white' : '#fff') : theme.text },
                                            isSelected && themeId === 'Rainbow' && styles.outlineEffect
                                        ]}>
                                            {ext}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 8 }]}>
                            {getT('custom_extension') || 'Custom Extension'}
                        </Text>
                        <TextInput
                            style={[styles.createFileInput, { borderColor: saveCopyCustomExt ? theme.primary : theme.divider, color: theme.text, backgroundColor: theme.background, marginBottom: 10 }]}
                            value={saveCopyCustomExt}
                            onChangeText={text => setSaveCopyCustomExt(text.replace(/[^a-zA-Z0-9]/g, ''))}
                            placeholder="e.g. csv, xml, py, ts..."
                            placeholderTextColor={theme.textSecondary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            maxLength={10}
                        />
                        
                        <View style={styles.createFileButtons}>
                            <TouchableOpacity onPress={() => setShowSaveCopyModal(false)} style={[styles.buttonSecondary, { borderColor: theme.divider }]}>
                                <Text style={[styles.buttonSecondaryText, { color: theme.textSecondary }]}>{getT('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => {
                                    // Custom typed extension takes priority over preset buttons
                                    const finalExt = saveCopyCustomExt.trim() 
                                        ? saveCopyCustomExt.trim() 
                                        : saveCopyExtension;
                                    setShowSaveCopyModal(false);
                                    activeRef?.saveCopy(saveCopyAsPlainText, `.${finalExt}`, saveCopyFileName);
                                }} 
                                style={[
                                    styles.buttonPrimary, 
                                    themeId === 'Rainbow' ? { backgroundColor: 'transparent', overflow: 'hidden' } : { backgroundColor: theme.primary }
                                ]}
                            >
                                {themeId === 'Rainbow' && <RainbowBackground style={[StyleSheet.absoluteFill, { borderRadius: 5 }]} />}
                                <Text style={[styles.buttonPrimaryText, themeId === 'Rainbow' && styles.outlineEffect]}>{getT('save_copy')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <AppGuide visible={showGuide} onClose={() => setShowGuide(false)} theme={theme} themeId={themeId} />

            {/* Themed Alert */}
            <ThemedAlert 
                visible={alertVisible}
                title={alertTitle}
                message={alertMsg}
                buttons={alertButtons}
                onClose={() => setAlertVisible(false)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        height: 56, 
        paddingHorizontal: 8, 
        elevation: 20, 
        zIndex: 50 
    },
    headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerIconSmall: { width: 40, height: 44, justifyContent: 'center', alignItems: 'center' },
    titleContainer: { flex: 1, paddingLeft: 8 },
    title: { fontSize: 15, fontWeight: 'bold' },
    subtitle: { fontSize: 10, fontWeight: 'bold' },
    settingsPanel: { padding: 15 },
    settingsBtn: { backgroundColor: 'rgba(0,0,0,0.05)', padding: 10, borderRadius: 8, flex: 1, alignItems: 'center' },
    horizontalTab: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 15, 
        paddingVertical: 10,
        height: 44,
        marginRight: 2,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8
    },
    tabLabel: { fontSize: 12 },
    selectionHeaderContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        height: 56, 
        paddingHorizontal: 8, 
        elevation: 50, // 🚀 NUCLEAR ELEVATION: Stay above native text
        zIndex: 9999 
    },
    plusButton: { padding: 8, width: 48, height: 44, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1 },
    themeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    themeButton: { padding: 8, borderRadius: 4 },
    themeButtonText: { fontSize: 10 },
    settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    settingsText: { fontSize: 12 },
    settingsActionText: { fontSize: 12 },
    settingsControls: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    createFileModal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    createFileContainer: { width: '80%', borderRadius: 10, padding: 20, elevation: 5 },
    createFileTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    createFileInput: { borderWidth: 1, borderRadius: 5, padding: 10, marginBottom: 15 },
    createFileButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    extToggle: { padding: 5, borderRadius: 4, marginHorizontal: 2 },
    modalActionBtn: { padding: 10 },
    modalActionPrimaryText: { color: 'white', fontWeight: 'bold' },
    extToggleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 5 },
    extText: { fontSize: 11 },
    inputLabel: { fontSize: 12, marginBottom: 5, fontWeight: '600' },
    buttonPrimary: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    buttonPrimaryText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    buttonSecondary: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    buttonSecondaryText: { fontWeight: '600', fontSize: 14 },
    outlineEffect: {
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1.5,
    }
});
