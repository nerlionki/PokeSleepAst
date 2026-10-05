# Android 正式发布

推送 `vMAJOR.MINOR.PATCH` 标签触发 `.github/workflows/android-release.yml`。工作流生成签名 APK 和 `update.json`，完成上传后才公开 GitHub Release。

App 使用匿名请求检查更新，因此仓库及 Release 附件必须公开可访问。无需在 App 中配置 GitHub token。

## 首次签名配置

要求 Node.js 24、JDK 21（`keytool` 在 PATH）、GitHub CLI，以及仓库 Secrets 管理权限。

在 `app` 目录执行：

```powershell
npm run signing:init
gh auth login
npm run signing:upload
```

密钥及随机密码保存在 `app/.signing/`，已被 Git 忽略。备份整个目录到安全位置，后续发布必须使用同一份密钥。上传脚本通过标准输入配置四个 Secrets，不输出密钥或密码：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

CI 使用这些 Secrets；本地生产构建自动读取 `.signing/config.json`。也可以通过 `ANDROID_KEYSTORE_PATH`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD` 环境变量提供签名。缺少配置会失败，release 不再使用 debug 签名。

## 发布新版本

```powershell
# 从项目根目录，在实现代码已提交并推送后执行。
git tag v1.0.0
git push origin v1.0.0
```

标签是发布版本的来源，无需手动修改 Gradle 中的版本号。无标签的本地构建使用 `package.json` 版本；可以通过 `APP_VERSION` 覆盖。版本码为 `major * 1000000 + minor * 1000 + patch`；major 范围 0..2099，minor/patch 范围 0..999，不接受 0.0.0、前导零或预发布标签。按语义版本递增发布，不覆盖已经公开的版本。

```powershell
npm run build:android:prod
```

产物位于 `app/release/PokeSleepAst-<version>.apk` 和 `app/release/update.json`。目录已忽略，不提交 APK 到 Git。

## App 更新行为

- 仅 Android 原生 App 启用；设置里显示安装版本和“检查更新”。
- 启动后台查询仓库最新正式 Release，同一新版本按设备本地日期每天最多提醒一次。
- “稍后提醒”关闭本次提示；“跳过此版本”抑制此版本的自动提示，手动检查仍可更新。
- App 内下载，校验大小、SHA-256、应用 ID、版本和签名，然后打开系统安装界面。
- 首次安装更新可能需要允许“宝睡助手”安装未知来源应用；返回后点击“继续安装”。
- 取消安装可继续安装已下载文件；缓存丢失时重新下载。进程被终止不保证下载继续，重试重新下载，不支持断点续传。
- 自动检查失败不打断使用；手动检查与下载失败给出说明，允许重试。

旧 debug 签名安装包无法直接覆盖升级到新正式签名。正式分发从新密钥签名的首个 Release 开始；此后同签名升级保留应用数据。

## 验证

```powershell
npm run test:update
npm run build
npm run build:android:prod
```

首次发布后，用真机验证未知来源权限、取消安装后继续、下载失败重试，以及同签名覆盖升级保留数据。

参考：[GitHub Releases API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release)、[Capacitor Android 插件](https://capacitorjs.com/docs/plugins/android)、[Android 安装来源权限](https://developer.android.com/reference/android/content/pm/PackageManager#canRequestPackageInstalls())。
