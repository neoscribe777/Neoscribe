package com.neoscribe;

import android.graphics.PorterDuff;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.text.Layout;
import android.view.View;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.TextView;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.NativeViewHierarchyManager;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.UIBlock;
import com.facebook.react.uimanager.UIManagerModule;
import com.facebook.react.uimanager.common.UIManagerType;
import java.lang.reflect.Field;

public class HandleColorModule extends ReactContextBaseJavaModule {
    HandleColorModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "HandleColor";
    }

    @ReactMethod
    public void setHandleColor(final int viewTag, final int color) {
        final ReactApplicationContext context = getReactApplicationContext();
        UIManagerModule uiManager = context.getNativeModule(UIManagerModule.class);
        if (uiManager == null) {
            android.util.Log.e("HandleColor", "UIManagerModule is null");
            return;
        }
        uiManager.addUIBlock(new UIBlock() {
            @Override
            public void execute(NativeViewHierarchyManager nativeViewHierarchyManager) {
                try {
                    View view = nativeViewHierarchyManager.resolveView(viewTag);
                    WebView targetWebView = findWebViewRecursive(view);

                    if (targetWebView != null) {
                        tintHandles(targetWebView, color);
                    } else if (view instanceof EditText) {
                        tintEditTextHandles((EditText) view, color);
                    } else {
                        android.util.Log.d("HandleColor",
                                "WebView or EditText not found in " + view.getClass().getName());
                    }
                } catch (Exception e) {
                    // Ignore specific resolution errors or toast them
                }
            }
        });
    }

    @ReactMethod
    public void hideNativeHandles(final int viewTag) {
        UIManagerModule uiManager = getReactApplicationContext().getNativeModule(UIManagerModule.class);
        if (uiManager == null)
            return;

        uiManager.addUIBlock(new UIBlock() {
            @Override
            public void execute(NativeViewHierarchyManager nativeViewHierarchyManager) {
                try {
                    View view = nativeViewHierarchyManager.resolveView(viewTag);
                    if (view instanceof EditText) {
                        EditText editText = (EditText) view;
                        // Hiding handles by setting them to a transparent 1x1 drawable
                        Drawable transparentDrawable = new ColorDrawable(android.graphics.Color.TRANSPARENT);
                        transparentDrawable.setBounds(0, 0, 1, 1);

                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                            editText.setTextSelectHandleLeft(transparentDrawable);
                            editText.setTextSelectHandleRight(transparentDrawable);
                            editText.setTextSelectHandle(transparentDrawable);
                        } else {
                            // Reflection for older versions
                            setTransparentHandlesReflection(editText, transparentDrawable);
                        }
                    }
                } catch (Exception e) {
                    android.util.Log.e("HandleColor", "hideNativeHandles failed", e);
                }
            }
        });
    }

    private void setTransparentHandlesReflection(EditText editText, Drawable transparent) {
        try {
            Field editorField = TextView.class.getDeclaredField("mEditor");
            editorField.setAccessible(true);
            Object editor = editorField.get(editText);

            String[] handleNames = { "mSelectHandleLeft", "mSelectHandleRight", "mSelectHandleCenter" };
            for (String fieldName : handleNames) {
                Field field = editor.getClass().getDeclaredField(fieldName);
                field.setAccessible(true);
                field.set(editor, transparent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void getSelectionCoordinates(final int viewTag, final Promise promise) {
        final ReactApplicationContext context = getReactApplicationContext();

        // Execute on the UI thread to ensure we can access the view
        context.runOnUiQueueThread(new Runnable() {
            @Override
            public void run() {
                try {
                    View view = null;

                    // Try getting UIManagerModule first (Old Arch)
                    UIManagerModule uiManager = context.getNativeModule(UIManagerModule.class);
                    if (uiManager != null) {
                        try {
                            view = uiManager.resolveView(viewTag);
                        } catch (Exception e) {
                            /* Fallback */ }
                    }

                    // If null, try looking it up directly via UIManagerHelper (New Arch / Fabric)
                    if (view == null) {
                        try {
                            // This is a common way to resolve views in recent RN versions without UIBlock
                            view = com.facebook.react.uimanager.UIManagerHelper
                                    .getUIManager(context, com.facebook.react.uimanager.common.UIManagerType.FABRIC)
                                    .resolveView(viewTag);
                        } catch (Exception e) {
                            // Try generic lookup
                            // view = context.getCurrentActivity().findViewById(viewTag); // Unlikely to
                            // work with React Tag
                        }
                    }

                    if (view == null) {
                        // Final attempt: simple findViewById on the Activity's root view if possible,
                        // but React tags aren't resource IDs.
                        // Let's manually traverse if we can't resolve it.
                        // For now, reject.
                        promise.reject("E_VIEW_NOT_FOUND", "Could not resolve view for tag: " + viewTag);
                        return;
                    }

                    if (!(view instanceof EditText)) {
                        promise.reject("E_NOT_EDIT_TEXT",
                                "View is not an EditText (Found: " + view.getClass().getName() + ")");
                        return;
                    }

                    EditText editText = (EditText) view;
                    int start = editText.getSelectionStart();
                    int end = editText.getSelectionEnd();

                    // ... rest of logic ...
                    Layout layout = editText.getLayout();
                    if (layout == null) {
                        promise.resolve(null);
                        return;
                    }

                    float startX = layout.getPrimaryHorizontal(start);
                    int startLine = layout.getLineForOffset(start);
                    int startTop = layout.getLineTop(startLine);
                    int startBottom = layout.getLineBottom(startLine);

                    float endX = layout.getPrimaryHorizontal(end);
                    int endLine = layout.getLineForOffset(end);
                    int endTop = layout.getLineTop(endLine);
                    int endBottom = layout.getLineBottom(endLine);

                    int paddingLeft = editText.getCompoundPaddingLeft();
                    int paddingTop = editText.getCompoundPaddingTop();
                    int scrollX = editText.getScrollX();
                    int scrollY = editText.getScrollY();

                    WritableMap map = Arguments.createMap();
                    map.putDouble("startX", PixelUtil.toDIPFromPixel(startX + paddingLeft - scrollX));
                    map.putDouble("startY", PixelUtil.toDIPFromPixel(startTop + paddingTop - scrollY));
                    map.putDouble("startBottom", PixelUtil.toDIPFromPixel(startBottom + paddingTop - scrollY));
                    map.putDouble("endX", PixelUtil.toDIPFromPixel(endX + paddingLeft - scrollX));
                    map.putDouble("endY", PixelUtil.toDIPFromPixel(endTop + paddingTop - scrollY));
                    map.putDouble("endBottom", PixelUtil.toDIPFromPixel(endBottom + paddingTop - scrollY));
                    map.putBoolean("isCollapsed", start == end);

                    promise.resolve(map);

                } catch (Exception e) {
                    promise.reject("E_COORD_FAIL", e.getMessage());
                }
            }
        });
    }

    private WebView findWebViewRecursive(View view) {
        if (view instanceof WebView) {
            return (WebView) view;
        }
        if (view instanceof android.view.ViewGroup) {
            android.view.ViewGroup group = (android.view.ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView found = findWebViewRecursive(group.getChildAt(i));
                if (found != null)
                    return found;
            }
        }
        return null;
    }

    private void tintEditTextHandles(EditText editText, int color) {
        try {
            Field editorField = TextView.class.getDeclaredField("mEditor");
            editorField.setAccessible(true);
            Object editor = editorField.get(editText);

            String[] handleNames = { "mSelectHandleLeft", "mSelectHandleRight", "mSelectHandleCenter" };
            for (String fieldName : handleNames) {
                Field field = editor.getClass().getDeclaredField(fieldName);
                field.setAccessible(true);
                Drawable drawable = (Drawable) field.get(editor);
                if (drawable != null) {
                    drawable.setColorFilter(color, PorterDuff.Mode.SRC_IN);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void tintHandles(WebView webView, int color) {
        try {
            Field editorField = TextView.class.getDeclaredField("mEditor");
            editorField.setAccessible(true);
            Object editor = editorField.get(webView);

            String[] handleNames = { "mSelectHandleLeft", "mSelectHandleRight", "mSelectHandleCenter" };
            for (String fieldName : handleNames) {
                Field field = editor.getClass().getDeclaredField(fieldName);
                field.setAccessible(true);
                Drawable drawable = (Drawable) field.get(editor);
                if (drawable != null) {
                    drawable.setColorFilter(color, PorterDuff.Mode.SRC_IN);
                }
            }
        } catch (Exception e) {
            // Silently fail as WebView might not have mEditor
        }
    }
}
