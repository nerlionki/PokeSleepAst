# 两端共享内容

`src/calc` 为计算与 OCR 解析，`src/data` 为唯一资料源，`src/types.ts` 为领域类型，`src/assets` 与 `public` 为共用资源。`components`、`views`、`stores` 和 `composables` 为共享 Vue 功能界面与状态。

浏览器、Capacitor 和微信能力通过 `#platform/*` 适配：Android 的 Vite 指向 `app/src/platform`，Taro 指向 `wxapp/src/platform`。微信表单适配在编译准备阶段生成，源文件仍只维护这一份。不要编辑 wxapp 的生成目录。
