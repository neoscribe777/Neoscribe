import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemeColors } from '../theme/themePresets';

import { getTranslation } from '../translations';
import { useAppTheme } from '../hooks/useAppTheme';

const { height } = Dimensions.get('window');

interface Props {
    visible: boolean;
    onClose: () => void;
    theme: ThemeColors;
    themeId?: string;
}

export const AppGuide: React.FC<Props> = ({ visible, onClose, theme, themeId }) => {
    const [stepIndex, setStepIndex] = useState(0);
    const { language } = useAppTheme();
    const t = React.useCallback((key: string) => getTranslation(language, key), [language]);

    const GUIDE_STEPS = React.useMemo(() => [
        {
            title: t('nav_bar'),
            icon: "monitor-dashboard",
            content: [
                { icon: "refresh", label: t('refresh'), desc: t('desc_refresh') },
                { icon: "upload", label: t('import'), desc: t('desc_import') },
                { icon: "content-save", label: t('save'), desc: t('desc_save') },
                { icon: "content-save-all-outline", label: t('save_copy'), desc: t('desc_save_copy') },
                { icon: "format-line-spacing", label: t('jump_to_line'), desc: t('desc_jump') },
                { icon: "eye-settings", label: t('appearance'), desc: t('desc_appearance') },
                { icon: "magnify", label: t('search'), desc: t('desc_search') },
            ]
        },
        {
            title: t('tab_mgmt'),
            icon: "tab",
            content: [
                { icon: "plus", label: t('new_tab'), desc: t('desc_new_tab') },
                { icon: "text-recognition", label: t('ocr_mode'), desc: t('desc_ocr') },
                { icon: "close", label: t('close_tab'), desc: t('desc_close_tab') }
            ]
        },
        {
            title: t('edit_sel'),
            icon: "pencil",
            content: [
                { icon: "gesture-tap-hold", label: t('long_press'), desc: t('desc_long_press') },
                { icon: "selection-drag", label: t('select_line_range'), desc: t('desc_select_range') },
                { icon: "select-all", label: t('select_all'), desc: t('desc_select_all') },
                { icon: "pencil", label: t('edit'), desc: t('desc_edit') },
                { icon: "tab-plus", label: t('move_to_new_tab'), desc: t('desc_move_to_new_tab') },
                { icon: "share-variant", label: t('share_sel'), desc: t('desc_share') }
            ]
        }
    ], [t]);

    const nextStep = () => {
        if (stepIndex < GUIDE_STEPS.length - 1) {
            setStepIndex(stepIndex + 1);
        } else {
            onClose();
            setStepIndex(0);
        }
    };

    const prevStep = () => {
        if (stepIndex > 0) setStepIndex(stepIndex - 1);
    };

    const currentStep = GUIDE_STEPS[stepIndex];

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.surface }]}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.divider }]}>
                        <View style={styles.headerTitleRow}>
                            <MaterialCommunityIcons 
                                name={currentStep.icon} 
                                size={28} 
                                color={themeId === 'Rainbow' ? 'white' : theme.primary} 
                                style={themeId === 'Rainbow' ? styles.outlineEffect : {}}
                            />
                            <Text style={[styles.title, { color: theme.text }]}>{currentStep.title}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
                        <View style={styles.contentPadding}>
                            {currentStep.content.map((item, idx) => (
                                <View key={idx} style={styles.guideItem}>
                                    <View style={[styles.iconBox, { backgroundColor: themeId === 'Rainbow' ? 'rgba(255,255,255,0.1)' : theme.primary + '20' }]}>
                                        <MaterialCommunityIcons 
                                            name={item.icon} 
                                            size={24}   
                                            color={themeId === 'Rainbow' ? 'white' : theme.primary} 
                                            style={themeId === 'Rainbow' ? styles.outlineEffect : {}}
                                        />
                                    </View>
                                    <View style={styles.itemTextContainer}>
                                        <Text style={[styles.itemLabel, { color: theme.text }]}>{item.label}</Text>
                                        <Text style={[styles.itemDesc, { color: theme.textSecondary }]}>{item.desc}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Footer */}
                    <View style={[styles.footer, { borderTopColor: theme.divider }]}>
                        <View style={styles.dotsContainer}>
                            {GUIDE_STEPS.map((_, i) => (
                                <View 
                                    key={i} 
                                    style={[
                                        styles.dot, 
                                        { backgroundColor: i === stepIndex ? (themeId === 'Rainbow' ? 'white' : theme.primary) : theme.textSecondary + '40' },
                                        i === stepIndex && { width: 16 }
                                    ]} 
                                />
                            ))}
                        </View>
                        
                        <View style={styles.navButtons}>
                            {stepIndex > 0 && (
                                <TouchableOpacity onPress={prevStep} style={styles.navBtn}>
                                    <Text style={[styles.navBtnText, { color: theme.textSecondary }]}>{t('back')}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity 
                                onPress={nextStep} 
                                style={[styles.navBtnPrimary, themeId === 'Rainbow' ? { backgroundColor: 'transparent', overflow: 'hidden' } : { backgroundColor: theme.primary }]}
                            >
                                {themeId === 'Rainbow' && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />}
                                <Text style={[styles.navBtnTextPrimary, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>
                                    {stepIndex === GUIDE_STEPS.length - 1 ? t('got_it') : t('next')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    container: {
        width: '100%',
        maxHeight: height * 0.8,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 10
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold'
    },
    closeBtn: {
        padding: 4
    },
    contentScroll: {
        flexGrow: 0
    },
    contentPadding: {
        padding: 20
    },
    guideItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 15
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    itemTextContainer: {
        flex: 1
    },
    itemLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2
    },
    itemDesc: {
        fontSize: 14,
        lineHeight: 20
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 6
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    navButtons: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center'
    },
    navBtn: {
        paddingVertical: 8,
        paddingHorizontal: 15
    },
    navBtnPrimary: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12
    },
    navBtnText: {
        fontWeight: 'bold',
        fontSize: 14
    },
    navBtnTextPrimary: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    },
    outlineEffect: {
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1.5,
    }
});
