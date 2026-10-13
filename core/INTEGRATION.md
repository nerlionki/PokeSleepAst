# 计算与 UI 对接指南

本次结构调整沿用现有游戏资料、公式、面板默认值和收益统计范围，不新增模拟假设。黄金样本由修改前的代码生成，记录在 `app/src/calc/refactor.golden.json`；测试会将函数式实现与这些输出比较。

## 模块边界

- `core/src/data/`：唯一共享资料源。公式模块读取资料，组件不维护重复数值表。
- `core/src/types.ts`：领域输入和结果类型。
- `core/src/calc/`：计算、转换和解析。料理、培养、捕捉推荐、糖果规划可以直接传入数据调用，不依赖 Vue 状态。
- `core/src/calc/planning.ts`：此次整理的函数式规划入口，供后续工具、服务、Worker 或测试对接。
- `core/src/composables/`：响应式生命周期、任务进度、取消、导航锁。耗时任务的执行过程与公式分开。
- `core/src/stores/`：用户设置、Box、队伍、规划和持久化状态。
- `core/src/components/shared/`：通用 UI 和领域展示组件。
- `core/src/components/{plan,team,pokemon,data}/`：业务面板，将领域输入连接到计算函数，展示结果。
- `app/src/platform/`、`wxapp/src/platform/`：通过 `#platform/*` 接入存储、图片、OCR、Worker 等平台能力。

App 中已有的同名转发文件继续兼容原有导入。小程序使用准备脚本转换共享 Vue 源码和原生表单，所有改动都维护在共享源，不维护生成目录。

## 计算模块索引

- 产量与时序：`produce`、`timeline`、`team`、`helpSpeed`、`energy`、`berry`、`ingredients`。
- 技能：`mainSkills`、`skills`、`skillEffects`、`scoreSkills`、`mew`、`cookingSkillState`。
- 料理与冲分：`cook`、`recipes`、`scorePlan`、`scoreSimulation`、`scoreSearch`。
- 成长与个体：`xp`、`train`、`candyPlan`、`member`、`evolution`、`ribbon`。
- 睡眠与捕捉：`sleep`、`sleepRules`、`sleepSelection`、`sleepRewards`、`sleepCandy`、`sleepSimulation`、`catch`、`babyEfficiency`、`whistle`。
- Box 与导入：`boxFilter`、`boxOverview`、`boxio`、`iqdoohBox`、`ocr*`。
- 默认口径：`defaults` 及各功能默认工厂。技能默认上限继续从 `mainSkills` 读取。

大型时序、搜索和 OCR 引擎仍保留各自现有实现及适配入口；此次没有将它们机械改写成递归或移除性能所需的局部迭代。函数式接口的要求是显式输入输出、避免修改调用者的数据、隔离平台与随机身份生成，而非禁止函数内部局部变量。

## 函数式规划接口

```ts
import {
  feedTrainingState, advanceTrainingState, cookMeal, cookMeals,
  createCandyRowFromBox, trainPlan,
} from './core/src/calc/planning'

const fed = feedTrainingState(progress, 50, 30, nature, group)
const afterSleep = advanceTrainingState(fed.progress, sleepExp, 30, group)
// progress 不被修改；fed 包含 progress、candies、shards、exp。

const first = cookMeal(inventory, settings)
const second = cookMeal(first.remain, settings)
const plan = cookMeals(inventory, settings, 3)
// 每餐返回 meal 和 remain，多餐返回 meals 和 remain；库存不被修改。

const row = createCandyRowFromBox(boxPokemon, callerGeneratedId)
const training = trainPlan(input)
```

`CookSettings` 只要求料理使用的六个配置字段，不要求完整的全局设置对象。

`allocateIngredients(bag, capacity, unknownEnergy)` 可单独对接库存填充；保留食材能量排序及原有未知食材的分支回退。多餐规划只准备一次料理候选池。

`advanceTraining` 和 `feedTraining` 是旧的可变接口，继续保持兼容，但标为 deprecated；新代码使用返回状态的 `*State` 版本。`xpCandy` 和 `trainPlan` 已迁移。`candyRowFromBox` 保留 UI 自动生成身份的入口，纯转换使用 `createCandyRowFromBox`。

异常范围仍通过现有 error 字段报告；不可达天数仍为 Infinity。序列化层自行处理 Infinity/NaN，不能把它们当成真实的零收益。空产量结果每次创建独立的食材和曲线容器。

## 通用 UI 接口

`FormField.vue` 保持现有 `.field` 布局。`label` 为标题，`id` 可由调用方传入；缺省通过 Vue `useId` 生成。默认插槽返回 `{ id }`，控件绑定该 ID；标题也可使用 `label` 插槽。已用于个体参数、培养、糖果和全局设置面板。

```vue
<FormField v-slot="{ id }" label="等级">
  <input :id="id" v-model.number="level" type="number">
</FormField>
```

`FallbackImage.vue` 接收 `src`、`alt`、可选 `resetKey`，将 class/style 等属性传给图片。失败后显示 `fallback` 插槽并触发 error；地址或 resetKey 改变时重试。没有回退插槽时隐藏失败图片。树果、食材和料理图标负责解析领域地址及回退外观，共用图片状态处理。宝可梦头像保留现有两级回退逻辑。

```vue
<FallbackImage :src="avatarUrl" alt="头像" class="sprite">
  <template #fallback><span>暂无头像</span></template>
</FallbackImage>
```

`SegmentedControl.vue` 是独立受控选择组件，使用字符串类型 v-model、只读 options、整体 disabled 和选项 disabled，提供 aria-pressed。没有全局导航状态依赖。原 `Segmented.vue` 为兼容业务层，组合通用控件及任务导航锁；项目内既有用法保持行为。

`PanelFields.vue` 仍是领域参数组件，但所有字段更新通过新对象触发 v-model 事件，避免修改调用方传入的个体对象。`EnvironmentFields` 保留 value/change patch 接口；`MemberEditor` 保留 v-model 与确认事件。直接对接通用 UI 时不必实例化业务 store。

现有 `DrawerSheet`、`ProgressDialog`、`DataRow`、`Sparkline` 继续用于抽屉、任务反馈、列表和趋势；`PokePicker`、`PokeSprite`、各类 Icon 属于领域 UI。新增业务面板应组合这些组件，不将平台调用写进通用 UI。

## 验证

- `npm --prefix app test`：包含旧行为黄金样本、输入不可变性、状态组合及 UI 交互回归。
- `npm --prefix app run build`：App 类型检查、Web 构建和原生计算脚本。
- `npm --prefix wxapp run build:weapp`：共享源转换、小程序编译及产物检查。需要项目规定的 Node 版本。

本次 Git 提交不包含推送、标签、正式原生打包或 Release 发布。
