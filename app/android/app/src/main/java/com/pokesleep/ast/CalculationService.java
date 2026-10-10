package com.pokesleep.ast;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.javascriptengine.IsolateStartupParameters;
import androidx.javascriptengine.JavaScriptIsolate;
import androidx.javascriptengine.JavaScriptSandbox;
import com.getcapacitor.JSObject;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** User-initiated offline calculation, independent of the Activity and its WebView. */
public class CalculationService extends Service {
    private static final String CHANNEL = "offline-calculation";
    private static final int NOTIFICATION_ID = 1041;
    private static final long LIMIT_MS = TimeUnit.HOURS.toMillis(2);
    private static final ConcurrentHashMap<String, JSObject> snapshots = new ConcurrentHashMap<>();
    private static volatile CalculationService running;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile String activeId;
    private volatile JavaScriptSandbox sandbox;
    private PowerManager.WakeLock wakeLock;
    private long sequence;
    private Runnable timeout;

    static JSObject status(String id) { return id == null ? null : snapshots.get(id); }
    static void cancel(String id) {
        if (id == null) return;
        snapshots.remove(id);
        CalculationService service = running;
        if (service != null) service.main.post(() -> {
            if (id.equals(service.activeId)) {
                service.activeId = null;
                JavaScriptSandbox engine = service.sandbox;
                if (engine != null) engine.close();
                service.stopSelf();
            }
        });
    }
    @Override public void onCreate() {
        super.onCreate(); running = this;
        if (Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager.class).createNotificationChannel(
            new NotificationChannel(CHANNEL, "离线计算", NotificationManager.IMPORTANCE_LOW));
        wakeLock = ((PowerManager) getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PokeSleepAst:Calculation");
        wakeLock.setReferenceCounted(false);
    }
    private Notification notification(String id, String text) {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Intent cancel = new Intent(this, CalculationService.class).setAction("cancel").putExtra("id", id);
        return new NotificationCompat.Builder(this, CHANNEL).setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("宝睡助手正在计算").setContentText(text).setOngoing(true).setOnlyAlertOnce(true)
            .setContentIntent(PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
            .addAction(0, "取消计算", PendingIntent.getService(this, 1, cancel, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)).build();
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(startId); return START_NOT_STICKY; }
        String id = intent.getStringExtra("id");
        if ("cancel".equals(intent.getAction())) {
            if (id != null && id.equals(activeId)) send(id, new JSObject().put("type", "error").put("message", "已取消计算"));
            cancel(id); return START_NOT_STICKY;
        }
        String kind = intent.getStringExtra("kind"), request = intent.getStringExtra("request");
        if (id == null || request == null) { stopSelf(startId); return START_NOT_STICKY; }
        if (activeId != null) { send(id, new JSObject().put("type", "error").put("message", "另一个后台任务正在运行，请先取消")); return START_NOT_STICKY; }
        activeId = id; sequence = 0;
        Notification notification = notification(id, "息屏或切换应用后继续运行");
        if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(NOTIFICATION_ID, notification);
        wakeLock.acquire(LIMIT_MS);
        timeout = () -> {
            if (id.equals(activeId)) {
                send(id, new JSObject().put("type", "error").put("message", "计算已超过两小时，请降低精度或次数后重试"));
                activeId = null; JavaScriptSandbox engine = sandbox; if (engine != null) engine.close(); stopSelf();
            }
        };
        main.postDelayed(timeout, LIMIT_MS);
        executor.execute(() -> calculate(id, kind, request, startId));
        return START_NOT_STICKY;
    }
    private void send(String id, JSObject message) {
        JSObject event = new JSObject(); event.put("id", id); event.put("sequence", ++sequence); event.put("message", message);
        snapshots.put(id, event); BackgroundCalculationPlugin.publish(event);
    }
    private void calculate(String id, String kind, String request, int startId) {
        JSObject terminal = null;
        try (JavaScriptSandbox engine = JavaScriptSandbox.createConnectedInstanceAsync(this).get(30, TimeUnit.SECONDS)) {
            sandbox = engine;
            if (!id.equals(activeId)) return;
            if (!engine.isFeatureSupported(JavaScriptSandbox.JS_FEATURE_EVALUATE_FROM_FD)
                || !engine.isFeatureSupported(JavaScriptSandbox.JS_FEATURE_EVALUATE_WITHOUT_TRANSACTION_LIMIT)) {
                throw new IllegalStateException("请更新 Android System WebView 以使用后台计算");
            }
            IsolateStartupParameters parameters = new IsolateStartupParameters();
            parameters.setMaxEvaluationReturnSizeBytes(20 * 1024 * 1024);
            if (engine.isFeatureSupported(JavaScriptSandbox.JS_FEATURE_ISOLATE_MAX_HEAP_SIZE)) parameters.setMaxHeapSizeBytes(512L * 1024 * 1024);
            try (JavaScriptIsolate isolate = engine.createIsolate(parameters);
                 AssetFileDescriptor asset = getAssets().openFd("calculation.js")) {
                isolate.evaluateJavaScriptAsync(asset).get(30, TimeUnit.SECONDS);
                // Encode all user values as one JSON string literal before parsing in the isolate.
                isolate.evaluateJavaScriptAsync("Calculation.beginTask(" + JSONObject.quote(kind) + ", JSON.parse(" + JSONObject.quote(request) + ")); 'ready'").get(30, TimeUnit.SECONDS);
                while (id.equals(activeId)) {
                    JSObject message = new JSObject(isolate.evaluateJavaScriptAsync("Calculation.nextTask()").get(2, TimeUnit.HOURS));
                    if (!id.equals(activeId)) return;
                    if (!"progress".equals(message.getString("type"))) { terminal = message; break; }
                    send(id, message);
                    JSONObject progress = message.optJSONObject("progress");
                    if (progress != null) {
                        String text = progress.optString("island", "准备候选方案") + " · " + progress.optInt("percent", 0) + "%";
                        main.post(() -> { if (id.equals(activeId)) getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, notification(id, text)); });
                    }
                }
            }
        } catch (Exception error) {
            if (id.equals(activeId)) terminal = new JSObject().put("type", "error").put("message", "后台计算失败：" + error.getMessage());
        } finally {
            sandbox = null;
            JSObject completed = terminal;
            main.post(() -> {
                if (id.equals(activeId)) {
                    activeId = null;
                    if (timeout != null) main.removeCallbacks(timeout);
                    if (wakeLock.isHeld()) wakeLock.release();
                    stopForeground(STOP_FOREGROUND_REMOVE);
                    stopSelf(startId);
                    // Publish completion after releasing resources so the UI can start another task.
                    if (completed != null) send(id, completed);
                }
            });
        }
    }
    @Override public void onDestroy() {
        if (running == this) running = null;
        activeId = null; if (timeout != null) main.removeCallbacks(timeout);
        if (sandbox != null) sandbox.close(); executor.shutdownNow();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
