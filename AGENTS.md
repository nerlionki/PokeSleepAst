# PokeSleepAst 项目指令

适用于本仓库全部任务；开始工作时读取。当前任务中用户的明确要求优先。

## 工作范围与模拟口径

- 开始前检查 Git 状态及适用指令，保留用户和其他任务的未提交内容；不擅自回退、覆盖或清理。
- 默认同时覆盖 App 与微信小程序，先检查两端调用路径。仅端独有功能或用户明确限定时单端处理，并在交付说明原因。
- 功能、交互、计算含义或默认口径有疑问时，说明具体疑点并询问；收到答复前只推进不依赖答复的工作。已确认事项直接执行，不重复询问。
- 未指定的模拟沿用对应面板及共享默认配置，不自行增加理想条件、额外加成或统计范围。默认缺失或不同面板冲突时先询问。
- 技能型面板及沿用该口径的模拟，未指定主技能等级时，从当前资源快照读取对应技能等级上限。用户指定参数优先，其余参数仍按面板默认值。
- 共享算法在 `core/src/calc`，共享组件在 `core/src/components`；不要直接编辑微信生成目录或构建产物。

## Node.js 与校验

- 安装依赖、测试或构建前，核对 `.nvmrc`、`.node-version`、`package.json.engines` 与 `node --version`。版本不符时先 `nvm list`，再 `nvm use` 并复核；不得手改 nvm 软链接、目录联接或安装目录。要求冲突、nvm 不可用或切换失败时询问用户。
- 按任务目标选择校验：Bug、游戏设定及资料纠正默认不构建（包括独立构建类型检查），可做相关单元测试与静态差异检查；SleepAstCore 活动配置写入也不要求客户端双端构建。
- 新增功能必须构建受影响端；共享功能覆盖 App 与微信。混合任务含新增功能或 Release 时执行相应构建。普通 Git 提交本身不触发 Release 校验。
- Release 必须具备目标端有效正式构建。前一任务已通过且之后无影响代码、依赖或配置变更时直接复用，仅补遗漏或失败范围，并说明复用结果。
- 同项目多个任务都需构建时，等待全部实现完成后统一校验；等待时标明“实现完成，等待统一构建校验”。不在其他任务仍修改时提前或重复构建。
- 微信构建后保留 `wxapp/dist/` 及运行所需生成文件，只有用户明确要求才清理。用户要求跳过或必要构建无法完成时，如实说明。

根目录入口（使用前核对 package.json）：

- App：`npm --prefix app run build`
- 微信：`npm --prefix wxapp run build:weapp`
- Android 正式发布：`npm --prefix app run build:android:prod`
- iOS 正式发布：`npm --prefix app run build:ios:prod`，需对应环境

Release 正式流程参见本地 `app/RELEASE.md`；构建内已有检查不重复执行。

## 游戏资料与来源

- 来源优先级：[官方公告](https://www.pokemonsleep.net/zh/news/) > [RAE](https://pks.raenonx.cc/zh) > [验证 Wiki](https://wikiwiki.jp/poke_sleep/)。先核对版本、生效日期、活动期限及对象；同源新规则优先。官方未公布的数值可参考社区，但必须标明推定。
- 项目与来源不一致时，说明现状、结论、影响及建议，询问后修改；用户已确认的修正直接执行。保留用户指定模拟假设，不用资料核对擅自覆盖。
- 来源、冲突和假设记入本地文档、维护源元数据或必要代码注释；除非用户要求，不在产品界面增加本次核对说明。

## SleepAstCore 与客户端边界

- 维护源为 [nerlionki/SleepAstCore](https://github.com/nerlionki/SleepAstCore)，按 Git remote 定位本地检出，不依赖固定机器路径；修改前检查该仓库状态及指令。
- 游戏资料、可配置参数、共享默认值在维护源维护。客户端 `core/src/data` 是适配入口与随包兜底；已接入资料必须通过 `*.resource.ts` 和 `core/src/resources/runtime.ts` 消费，不直接导入 JSON 绕过快照。本地算法、OCR 模型及模板保留客户端。
- 主技能目录、等级表与效果模型在 `skill-tables.json.modules.mainSkills`；客户端执行通用算子。统一道具目录与角色映射在 `calc-tables.json.modules.items`，发放道具按 ID，不能新增本地技能 ID 分支或独立道具表。
- 先核对实际打包链路：榜单由 `src/rankings/prod.json`、`test.json` 注入 `calc-tables.json`；礼包由 `src/catalogs/event-bundles.json` 注入 `meta.json`。不要直接改 dist、manifest 或假定产物均为 src/data 原样复制。
- 共享加载器 `core/src/resources/loader.ts`；传输缓存适配为两端 `src/platform/resources.ts`。完整校验并安装快照后再加载依赖模块；资源模块及派生数据不自动热刷新。Worker、原生与前台计算共用启动快照，保留快照传递、延迟加载及断点版本检查。
- 冷启动按网络 → 当前源有效缓存 → 随包兜底回退。必须校验文件集合、契约、字节数、SHA-256、活动与技能结构；无效资料整包拒绝，不混用版本或做字段级本地补齐。远程专有内容沿用无资料处理。
- 当前客户端协议为 `sleepast-data-v2`，`clientMajor: 2`，43 个 JSON；入口为 `https://pokepokeshock.cn/prod/resources/v2/manifest.json` 和对应 `/test/`。以 `files.ts`、`runtime.ts`、`loader.ts` 和服务端脚本为准；保留旧协议客户端兼容。
- prod/test 缓存隔离。正式端用 prod，开发体验按已有开关选择；切源后重启加载。排查时记录实际源、版本及网络／缓存／本地状态。
- 普通资料先改维护源；离线也需修正、新逻辑依赖字段或更新随包资料时同步兜底。不得从部分修改的兜底反向覆盖维护源，或覆盖其他任务资料。
- 新文件或字段语义变化需检查消费者、兜底、Worker、服务端及旧客户端兼容；必要时升级协议与客户端。算法、界面和不兼容结构不能仅靠资料发布交付。
- 需要验证资源产物时，核对维护源 Node 要求，以相同 `RESOURCE_CONTEXT` 执行当前协议入口 `npm run build:v2`、`npm run verify:v2`；旧协议另按其入口验证。资源构建不自动要求客户端构建。

## 图片与资料 ID

- 游戏图片以 SleepAstCore 为维护源，身份绑定稳定资料 ID／公告 `imageId`，不依赖名称、数组位置或临时 slug。改名排序不改变 ID；副技能沿用存档字符串 ID（如 `berryS`）。构建读取资料字段，不从 TypeScript 正则提取编号。
- 路径：宝可梦 `pokemon/icons/{id}.webp`、`pokemon/portrait/{id}.webp`，异色在各目录 `shiny/{id}.webp`，备用图 `sprites/{id}.png`；形态用完整 ID（如 71002）。树果 `berry/{id}.webp`、食材 `ingredient/{id}.webp`、食谱 `meal/{id}.webp`、主技能 `mainSkill/{id}.webp`、副技能 `subSkill/{id}.webp`、道具 `items/{id}.webp`、彩庆花 `flower/{id}.webp`、睡饱饱勋章 `ribbon/{hours}.webp`（当前 2000 小时为 `ribbon/2000.webp`）。
- 维护源：道具在 `public/items`，备用图在 `public/sprites`，其余在 `src/assets/imgs`。manifest 前者分别为 `items/`、`sprites/`，其余用 `images/` 前缀；客户端由已校验 manifest 解析版本化 URL，并保留本地回退。
- 随包图片范围以 `core/src/resources/imagePolicy.ts` 及两端图片适配为准：当前普通宝可梦、树果、食材、食谱、主／副技能图标及睡饱饱勋章有本地回退；异色与道具等从远程读取，不因源目录中存在文件就认定已打包。
- 迁移新增 ID 路径并保留已发布客户端使用的旧别名。不覆盖另一 ID 的不同图片；缺图明确标记并沿用缺图处理，不冒用其他资料图片。彩庆花独立命名空间；`berry/0.webp`、`ingredient/0.webp` 是通用占位图。应用图标、界面 SVG 与装饰不在游戏图片约定范围。
- 完整食材、食谱用目录 `id`；未公布数值的公告用 `imageId` 并沿用编号路径，`runtimeId` 只表示已公布官方运行编号。新食材取下一未占用正整数，食谱在咖喱 1xxx／沙拉 2xxx／点心 3xxx 各段取下一未占用编号。
- 路径解析在 `core/src/calc/raeImage.ts`；旧资料无食谱 ID 时才用 `MEAL_ID` 名称回退，有 ID 时二者必须一致。只替换图片或修改已被旧端读取的 imageFile 可不改客户端，新增 ID 字段消费需联动代码。

## OCR 验收

- OCR Bug 修复后，最终代码必须递归识别 `ocrTest/` 全部图片，包括新增及未提交图片；逐张核对结果和退化，不以无异常代替识别正确。
- 交付报告总数、核对结论与未解决问题。目录缺失、读取失败、未跑完或未核对时不得称验收完成。OCR 回归不等于构建，是否构建按前述规则。

## 提交、发布与交付

- 未经明确授权，不提交、推送、打标签或发布。交付区分维护源／兜底修改、校验、资源构建、部署上线与实际加载，说明覆盖端、已完成验证及限制；线上发布使用新资源版本，不覆盖已发布版本。
- 准备 Release 时先给完整更新说明草稿供用户复核；明确通过后才能提交相关说明、推送或创建／发布 Release。旧授权不能替代本次复核；实质增删重写须再次复核。等待时标明“更新说明待用户复核”，可先完成整理与必要构建。
- GitHub 所有分支、标签与可达历史不发布 AGENTS.md 以外的 Markdown 和测试源码（含单元／回归／示例测试与测试专用脚本）；文档测试留本地，测试图片、夹具、数据及正式构建／打包／校验／范围检查脚本保留。不得强制添加或合并旧历史带回排除文件。
- 新克隆执行 `git config core.hooksPath .githooks`；CI 检查文件与历史。清理后的历史不与未清理旧克隆直接合并。经复核 Release 说明通过附注版本标签传递，app/RELEASE.md 不作为远程发布依赖。
