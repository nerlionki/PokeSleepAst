package com.pokesleep.ast;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private static final String RELEASE_ROOT = "https://github.com/nerlionki/PokeSleepAst/releases/download/";

    private static class Target {
        String version, name, hash, url;
        long size, code;
    }

    private Target target(PluginCall call) throws Exception {
        Target t = new Target();
        t.version = call.getString("version", "");
        t.name = call.getString("fileName", "");
        t.hash = call.getString("sha256", "");
        t.url = call.getString("url", "");
        t.size = call.getData().optLong("size", 0);
        t.code = call.getData().optLong("versionCode", 0);
        if (!t.version.matches("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)")) {
            throw new Exception("更新版本号无效");
        }
        String[] p = t.version.split("\\.");
        long major = Long.parseLong(p[0]), minor = Long.parseLong(p[1]), patch = Long.parseLong(p[2]);
        long code = major * 1000000 + minor * 1000 + patch;
        if (major > 2099 || minor > 999 || patch > 999 || code < 1 || code != t.code
            || !t.name.equals("PokeSleepAst-" + t.version + ".apk")
            || !t.hash.matches("[a-f0-9]{64}") || t.size <= 0 || t.size > 1000000000L
            || !t.url.equals(RELEASE_ROOT + "v" + t.version + "/" + t.name)) {
            throw new Exception("更新安装包信息无效");
        }
        return t;
    }

    private File folder() throws Exception {
        File directory = new File(getContext().getCacheDir(), "updates");
        if (!directory.exists() && !directory.mkdirs()) throw new Exception("无法创建更新目录");
        return directory;
    }

    @SuppressWarnings("deprecation")
    private PackageInfo installed() throws Exception {
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), flags);
    }

    @SuppressWarnings("deprecation")
    private long code(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }

    @SuppressWarnings("deprecation")
    private Signature[] signatures(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 && info.signingInfo != null
            ? info.signingInfo.getApkContentsSigners() : info.signatures;
    }

    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            PackageInfo info = installed();
            JSObject result = new JSObject();
            result.put("version", info.versionName);
            result.put("versionCode", code(info));
            call.resolve(result);
        } catch (Exception e) { call.reject("无法读取当前应用版本", e); }
    }

    private void progress(long downloaded, long total, String phase) {
        JSObject result = new JSObject();
        result.put("downloaded", downloaded);
        result.put("total", total);
        result.put("phase", phase);
        notifyListeners("downloadProgress", result);
    }

    private HttpURLConnection connection(String source) throws Exception {
        URL url = new URL(source);
        for (int redirects = 0; redirects <= 5; redirects++) {
            String host = url.getHost();
            if (!url.getProtocol().equals("https") || url.getUserInfo() != null
                || !(url.getPort() == -1 || url.getPort() == 443)
                || !(host.equals("github.com") || host.equals("release-assets.githubusercontent.com")
                || host.equals("objects.githubusercontent.com"))) throw new Exception("安装包下载地址无效");
            HttpURLConnection c = (HttpURLConnection) url.openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", "PokeSleepAst-Updater");
            c.setRequestProperty("Accept-Encoding", "identity");
            int status = c.getResponseCode();
            if (status == 200) return c;
            String location = c.getHeaderField("Location");
            c.disconnect();
            if (status >= 300 && status < 400 && location != null) { url = new URL(url, location); continue; }
            throw new Exception("下载安装包失败（HTTP " + status + "），请稍后重试");
        }
        throw new Exception("安装包下载重定向过多");
    }

    @SuppressWarnings("deprecation")
    private void verify(File file, Target t) throws Exception {
        if (!file.isFile() || file.length() != t.size) throw new Exception("安装包不完整，请重新下载");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(file)) {
            byte[] buffer = new byte[65536];
            int count;
            while ((count = in.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        StringBuilder hex = new StringBuilder();
        for (byte b : digest.digest()) hex.append(String.format("%02x", b & 0xff));
        if (!hex.toString().equals(t.hash)) throw new Exception("安装包校验失败，请重新下载");
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo current = installed();
        if (archive == null || !current.packageName.equals(archive.packageName)
            || !t.version.equals(archive.versionName) || code(archive) != t.code || t.code <= code(current)) {
            throw new Exception("安装包与当前应用或版本不匹配");
        }
        Signature[] actual = signatures(archive), expected = signatures(current);
        if (actual == null || expected == null || actual.length == 0 || actual.length != expected.length
            || !Arrays.asList(actual).containsAll(Arrays.asList(expected))) {
            throw new Exception("安装包签名与当前应用不一致，请使用正式发布的应用");
        }
    }

    @PluginMethod
    public void download(PluginCall call) {
        if (!busy.compareAndSet(false, true)) { call.reject("已有更新操作正在进行"); return; }
        worker.execute(() -> {
            File partial = null;
            HttpURLConnection c = null;
            try {
                Target t = target(call);
                File directory = folder();
                File complete = new File(directory, t.name);
                if (complete.exists()) {
                    try { verify(complete, t); call.resolve(); return; }
                    catch (Exception invalid) { if (!complete.delete()) throw new Exception("无法清理旧安装包"); }
                }
                File[] old = directory.listFiles();
                if (old != null) for (File f : old) if (!f.delete()) throw new Exception("无法清理旧更新文件");
                if (directory.getUsableSpace() < t.size + 10485760L) throw new Exception("存储空间不足，请清理空间后重试");
                partial = new File(directory, t.name + ".part");
                c = connection(t.url);
                long length = c.getContentLengthLong();
                if (length > 0 && length != t.size) throw new Exception("下载文件大小与发布信息不一致");
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(partial)) {
                    byte[] buffer = new byte[65536];
                    long downloaded = 0, last = 0;
                    int count;
                    while ((count = in.read(buffer)) != -1) {
                        if (Thread.currentThread().isInterrupted()) throw new Exception("下载已中断，请重试");
                        downloaded += count;
                        if (downloaded > t.size) throw new Exception("下载文件超出预期大小");
                        out.write(buffer, 0, count);
                        long now = System.currentTimeMillis();
                        if (now - last >= 250) { progress(downloaded, t.size, "downloading"); last = now; }
                    }
                }
                progress(t.size, t.size, "verifying");
                verify(partial, t);
                if (!partial.renameTo(complete)) throw new Exception("无法保存安装包");
                call.resolve();
            } catch (Exception e) {
                if (partial != null) partial.delete();
                call.reject(e.getMessage() == null ? "下载失败，请重试" : e.getMessage(), e);
            } finally {
                if (c != null) c.disconnect();
                busy.set(false);
            }
        });
    }

    @PluginMethod
    public void install(PluginCall call) {
        if (!busy.compareAndSet(false, true)) { call.reject("已有更新操作正在进行"); return; }
        worker.execute(() -> {
            try {
                Target t = target(call);
                File file = new File(folder(), t.name);
                try { verify(file, t); }
                catch (Exception e) { busy.set(false); call.reject(e.getMessage(), "FILE_INVALID", e); return; }
                getActivity().runOnUiThread(() -> {
                    try {
                        boolean needsPermission = Build.VERSION.SDK_INT >= 26
                            && !getContext().getPackageManager().canRequestPackageInstalls();
                        if (needsPermission) {
                            getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + getContext().getPackageName())));
                        } else {
                            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            getActivity().startActivity(intent);
                        }
                        JSObject result = new JSObject();
                        result.put("permissionRequired", needsPermission);
                        call.resolve(result);
                    } catch (Exception e) { call.reject("无法打开安装界面，请检查系统安装权限", e); }
                    finally { busy.set(false); }
                });
            } catch (Exception e) { busy.set(false); call.reject(e.getMessage(), e); }
        });
    }

    @Override
    protected void handleOnDestroy() { worker.shutdownNow(); }
}
