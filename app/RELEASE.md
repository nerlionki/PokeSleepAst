# 1.0.4 后台模拟优化（2026-10-09）

- App 睡姿模拟改用 Web Worker；微信小程序使用独立原生 Worker 分包。普通睡眠、整觉／拆觉、活动混合类型及图鉴加权共用后台计算与结果汇总。
- 主线程展示 loading 和真实完成进度，模拟期间锁定参数，可取消模拟；参数修改和组件卸载会终止任务，旧消息不能覆盖新结果。
- 宝宝效率的捕捉／糖果搜索继续使用原有 Worker，并同步小程序版本兼容检查。
- 最低小程序版本 1.0.4，最低基础库 2.27.3（Worker 分包预下载 API 要求）。开发工具仍使用 3.14.3。正式环境的最低基础库需在微信公众平台设置，见 wxapp/config/compatibility-notes.txt。

# 1.0.4（2026-10-08）

- App 与微信小程序共用 DPR 预算抽选：普通睡姿可重复、逐次扣减、耗尽后最低 DPR 保底、末位选择剩余预算内最高 DPR，限制一只大肚上睡。低于 90,000 时按游戏睡姿编号确定最低 DPR 保底。
- 宝宝效率同步采用该模型；能量结果只列实际采样点及预算饱和后的稳定区间，不再把解锁区间视为收益恒定区间。
- 数据引用明确标注 RaenonX 研究团队及 RP Model 原始出处，移除个人中心的计算说明。
- 更新检查使用独立连接、禁用压缩并对网络断流、截断 JSON、5xx 作最多三次尝试；API 不可用时回退到官方 Release 更新清单，提供中文错误提示和官方发布页入口。
- “新增宝可梦”“导入”统一双端文案；捕捉刷糖可手选推荐类型，每次只生成所选结果。

抽选规则参考：https://pks.raenonx.cc/zh/docs/view/help/sleep-styles
来源署名参考：https://pks.raenonx.cc/zh/docs/view/site/credits

模型边界：参考文档注明完整概率尚未验证，普通候选仍采用均匀权重（用户可选未发现加权）。本次没有将本地星级估算 DPR 替换为全量实测数据；已核验条目保留原来源标记。露营券额外遭遇仍仅计数量，不消耗普通 DPR，也不纳入普通研究奖励模拟。

# 1.0.3.2_hotfix（2026-10-06）

- 食谱最高等级调整为 70，设置、食谱及锅资料展示、料理计算同步使用统一上限。
- 个体产量、队伍时序和成员卡片按对应主技能表处理最大等级及有效数值；副技能加级后也按该技能上限封顶，支持 7／8 级主技能。
- 技能型与全能型最多储存 2 次主技能，其他专长最多 1 次，统一储存规则并补充睡眠及起床释放回归。
- App 与微信小程序共用以上修正。

版本号为 `1.0.3.2`，发布标签为 `1.0.3.2_hotfix`。安卓使用正式签名 APK 和匹配的 `update.json`；iOS 为需要自行签名的未签名 IPA。

# Android 正式发布

推送 `vMAJOR.MINOR.PATCH` 标签触发 `.github/workflows/android-release.yml`。工作流生成签名 APK 和 `update.json`，完成上传后才公开 GitHub Release。

GitHub Release 包含 APK、未签名 IPA 和 `update.json`，三份齐全后公开。微信编译包与 OCR 模型包保留在本地或 Actions artifacts，不追加到 Release。已经公开的 APK 与更新清单保持不变。微信编译命令与 OCR 体验说明见 `../wxapp/README.md`。

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
