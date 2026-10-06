# 1.0.3

- “我的”移除资料版本模块，新增 Android 手动检查更新入口，沿用完整 APK 下载、校验与安装流程。
- 修复食材标题被浮层遮挡时未定位食材行，导致木守宫 ABB 被默认填成 ABC 的问题；原图加入 ocrTest 并覆盖真实 OCR 与导入回归。
- 新增平级 wxapp（Taro + Vue3 微信小程序）和 core（共享计算、资料、类型、资源、界面及状态）。
- 微信端提供全部现有页面、设置、盒子编辑、备份导入导出和本地计算；不提供手动更新按钮。
- 微信 OCR 为体验版，首次需从本地模型包导入 det.onnx 与 rec.onnx，由用户验证真机表现。模型源文件位于 core/public/ocr。
- 小程序编译：在 wxapp 执行 npm ci、npm run build:weapp；开发监听 npm run dev:weapp。产物位于 wxapp/dist，可直接导入微信开发者工具。

验证：共享计算/导入/OCR/更新和微信表单回归，Android 正式签名 APK 本地构建，Taro 生产构建、类型检查及主包/分包体积检查。微信真机和 OCR 运行效果待用户验证。
