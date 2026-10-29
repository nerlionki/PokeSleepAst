package com.pokesleep.ast;

import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import androidx.javascriptengine.JavaScriptSandbox;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "BackgroundCalculation")
public class BackgroundCalculationPlugin extends Plugin {
    private static WeakReference<BackgroundCalculationPlugin> current = new WeakReference<>(null);
    @Override public void load() { current = new WeakReference<>(this); }
    static void publish(JSObject event) {
        new Handler(Looper.getMainLooper()).post(() -> {
            BackgroundCalculationPlugin plugin = current.get();
            if (plugin != null) plugin.notifyListeners("calculationMessage", event);
        });
    }
    @PluginMethod public void start(PluginCall call) {
        String id = call.getString("id"), kind = call.getString("kind");
        JSObject request = call.getObject("request");
        if (id == null || request == null || !("baby".equals(kind) || "sleep".equals(kind) || "score".equals(kind))) {
            call.reject("计算参数无效"); return;
        }
        if (Build.VERSION.SDK_INT < 26 || !JavaScriptSandbox.isSupported()) {
            call.reject("当前系统不支持原生后台计算，请更新 Android System WebView 后重试"); return;
        }
        File requestFile = null;
        try {
            // Resource snapshots exceed Binder's transaction limit. Keep the
            // private payload on disk and send only its filename to the service.
            requestFile = File.createTempFile("calculation-", ".json", getContext().getCacheDir());
            try (FileOutputStream output = new FileOutputStream(requestFile)) {
                output.write(request.toString().getBytes(StandardCharsets.UTF_8));
            }
            Intent intent = new Intent(getContext(), CalculationService.class)
                .putExtra("id", id).putExtra("kind", kind).putExtra("requestFile", requestFile.getAbsolutePath());
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception error) {
            if (requestFile != null) requestFile.delete();
            call.reject("无法启动后台计算服务：" + error.getMessage());
        }
    }
    @PluginMethod public void cancel(PluginCall call) {
        CalculationService.cancel(call.getString("id")); call.resolve();
    }
    @PluginMethod public void status(PluginCall call) {
        String id = call.getString("id");
        JSObject event = CalculationService.status(id);
        if (event == null) { event = new JSObject(); event.put("id", id); }
        call.resolve(event);
    }
    @Override protected void handleOnDestroy() {
        if (current.get() == this) current.clear();
    }
}
