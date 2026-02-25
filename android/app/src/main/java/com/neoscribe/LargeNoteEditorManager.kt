package com.neoscribe

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.common.MapBuilder
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap

class LargeNoteEditorManager : SimpleViewManager<LargeNoteEditorView>() {
    override fun getName() = "SoraEditorView"

    override fun createViewInstance(reactContext: ThemedReactContext): LargeNoteEditorView {
        return LargeNoteEditorView(reactContext)
    }

    @ReactProp(name = "text")
    fun setText(view: LargeNoteEditorView, text: String?) {
        view.setNoteText(text ?: "")
    }

    @ReactProp(name = "isDark")
    fun setIsDark(view: LargeNoteEditorView, isDark: Boolean) {
        view.setEditorTheme(isDark)
    }

    @ReactProp(name = "customColors")
    fun setCustomColors(view: LargeNoteEditorView, colors: ReadableMap?) {
        if (colors != null) {
            view.setCustomColors(colors)
        }
    }

    @ReactProp(name = "fontSize")
    fun setFontSize(view: LargeNoteEditorView, fontSize: Float) {
        view.setTextSize(fontSize)
    }

    @ReactProp(name = "wordWrap")
    fun setWordWrap(view: LargeNoteEditorView, wordWrap: Boolean) {
        view.isWordwrap = wordWrap
    }

    @ReactProp(name = "language")
    fun setLanguage(view: LargeNoteEditorView, language: String?) {
        view.setLanguage(language ?: "")
    }

    @ReactProp(name = "msgSoraLoading")
    fun setMsgSoraLoading(view: LargeNoteEditorView, msg: String?) {
        msg?.let { view.msgSoraLoading = it }
    }

    @ReactProp(name = "msgSoraPullSuccess")
    fun setMsgSoraPullSuccess(view: LargeNoteEditorView, msg: String?) {
        msg?.let { view.msgSoraPullSuccess = it }
    }

    @ReactProp(name = "msgSoraPullError")
    fun setMsgSoraPullError(view: LargeNoteEditorView, msg: String?) {
        msg?.let { view.msgSoraPullError = it }
    }

    @ReactProp(name = "msgSoraViewerError")
    fun setMsgSoraViewerError(view: LargeNoteEditorView, msg: String?) {
        msg?.let { view.msgSoraViewerError = it }
    }

    override fun receiveCommand(view: LargeNoteEditorView, commandId: String, args: ReadableArray?) {
        when (commandId) {
            "undo" -> view.undo()
            "redo" -> view.redo()
            "find" -> {
                val query = args?.getString(0) ?: ""
                val matchCase = args?.getBoolean(1) ?: false
                view.find(query, matchCase)
            }
            "findNext" -> view.findNext()
            "findPrev" -> view.findPrev()
            "replace" -> {
                val replacement = args?.getString(0) ?: ""
                view.replace(replacement)
            }
            "replaceAll" -> {
                val replacement = args?.getString(0) ?: ""
                val applyLimit = if (args != null && args.size() > 1) args.getBoolean(1) else false
                view.replaceAll(replacement, applyLimit)
            }
            "stopSearch" -> view.stopSearch()
            "insertText" -> {
                val text = args?.getString(0) ?: ""
                view.insertText(text)
            }
            "loadFromFile" -> {
                val path = args?.getString(0) ?: ""
                view.loadContentFromFile(path)
            }
            "saveToFile" -> {
                val path = args?.getString(0) ?: ""
                view.saveToFile(path)
            }
            "focus" -> view.requestFocus()
            "pullFromHugeText" -> {
                val hugeTextId = args?.getInt(0) ?: -1
                view.pullFromHugeText(hugeTextId)
            }
            "pushToHugeText" -> {
                val hugeTextId = args?.getInt(0) ?: -1
                view.pushToHugeText(hugeTextId)
            }
            "setTheme" -> {
                val themeName = args?.getString(0) ?: "darcula"
                view.applyTheme(themeName)
            }
            "setText" -> {
                val text = args?.getString(0) ?: ""
                view.setNoteText(text)
            }
        }
    }

    override fun getExportedCustomBubblingEventTypeConstants(): Map<String, Any>? {
        return MapBuilder.builder<String, Any>()
            .put("topSoraChange", MapBuilder.of(
                "phasedRegistrationNames",
                MapBuilder.of("bubbled", "onSoraChange")
            ))
            .put("topSoraSearchResult", MapBuilder.of(
                "phasedRegistrationNames",
                MapBuilder.of("bubbled", "onSoraSearchResult")
            ))
            .put("topSoraReplaceStart", MapBuilder.of(
                "phasedRegistrationNames",
                MapBuilder.of("bubbled", "onSoraReplaceStart")
            ))
            .put("topSoraReplaceEnd", MapBuilder.of(
                "phasedRegistrationNames",
                MapBuilder.of("bubbled", "onSoraReplaceEnd")
            ))
            .put("topSoraReplaceProgress", MapBuilder.of(
                "phasedRegistrationNames",
                MapBuilder.of("bubbled", "onSoraReplaceProgress")
            ))
            .put("topSoraReplaceLimit", MapBuilder.of(
                "phasedRegistrationNames",
                MapBuilder.of("bubbled", "onSoraReplaceLimit")
            ))
            .put("topSoraPullStart", MapBuilder.of(
                "phasedRegistrationNames",
                MapBuilder.of("bubbled", "onSoraPullStart")
            ))
            .put("topSoraPullEnd", MapBuilder.of(
                "phasedRegistrationNames",
                MapBuilder.of("bubbled", "onSoraPullEnd")
            ))
            .build()
    }
}
