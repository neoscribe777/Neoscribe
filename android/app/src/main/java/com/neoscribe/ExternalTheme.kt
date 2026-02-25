package com.neoscribe

// Simplified version of ExternalTheme for internal use in LargeNoteEditorView
// Squircle uses kotlinx.serialization, but we'll use org.json in LargeNoteEditorView
// This file is mostly for reference to satisfy the user's request for "exactly like squircle"
data class ExternalTheme(
    val type: String? = null,
    val colors: ExternalColors? = null,
)

data class ExternalColors(
    val colorPrimary: String? = null,
    val colorOutline: String? = null,
    val colorBackgroundPrimary: String? = null,
    val colorBackgroundSecondary: String? = null,
    val colorBackgroundTertiary: String? = null,
    val colorTextAndIconPrimary: String? = null,
    val colorTextAndIconPrimaryInverse: String? = null,
    val colorTextAndIconSecondary: String? = null,
    val colorTextAndIconDisabled: String? = null,
    val colorTextAndIconAdditional: String? = null,
    val colorTextAndIconSuccess: String? = null,
    val colorTextAndIconError: String? = null,
)
