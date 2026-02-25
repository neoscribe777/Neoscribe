package com.neoscribe;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.neoscribe.SharedIntentModule;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class HandleColorPackage implements ReactPackage {

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        List<ViewManager> managers = new ArrayList<>();
        managers.add(new LargeNoteEditorManager());
        managers.add(new HugeTextViewManager());
        return managers;
    }

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new HandleColorModule(reactContext));
        modules.add(new ThemeModule(reactContext));
        modules.add(new SharedIntentModule(reactContext));
        return modules;
    }
}
