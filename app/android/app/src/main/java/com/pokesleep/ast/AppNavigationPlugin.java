package com.pokesleep.ast;

import android.app.AlertDialog;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppNavigation")
public class AppNavigationPlugin extends Plugin {
    private AlertDialog exitDialog;

    @PluginMethod
    public void confirmExit(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (getActivity().isFinishing() || getActivity().isDestroyed()) {
                call.resolve();
                return;
            }
            if (exitDialog != null) {
                call.resolve();
                return;
            }
            exitDialog = new AlertDialog.Builder(getActivity())
                .setTitle("退出宝睡助手？")
                .setMessage("是否退出 App？")
                .setNegativeButton("取消", (dialog, which) -> {})
                .setPositiveButton("退出", (dialog, which) -> getActivity().finish())
                .create();
            exitDialog.setOnDismissListener(dialog -> {
                exitDialog = null;
                call.resolve();
            });
            exitDialog.show();
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (exitDialog != null) exitDialog.dismiss();
        super.handleOnDestroy();
    }
}
