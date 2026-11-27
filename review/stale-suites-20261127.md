# 清掉三套存量红灯（2026-11-27）

`visual-style`、`interaction-components`、`product-iteration` 这三套在 80 轮 tricky 之前就是红的。
最后一次改它们是 `891737c`（换上 Bootcamp DS 2.0 皮肤那一版）。之后用户否掉了 Bootcamp 皮肤、
定稿「实验记录本」，工作台、共享课题、设计实验三块的渲染被后加载的文件整体接管：

| 页面 | 这三套测的是 | 现在真正在渲染的是 |
|---|---|---|
| 工作台 | `product-iteration.js` 的 `.wb-panel` 三面板 | `workbench-reference.js` / `workbench-todo.js` 的 `rh-*` |
| 共享课题 | `product-iteration.js` 的 `.rs-project-card` 列表 | `resource-space.js` 的 `ms-*` 收件箱 ＋ 课题项目页里的共享卡 |
| 设计实验 | `product-iteration.js` 的画布编排器 `.composer-*` | `autonomous-lab.js` 的五步向导 `al-*` |

老那几套渲染函数还留在 `product-iteration.js` 里，是死代码——这就是为什么
`grep data-composer-node index.html` 有 6 处，页面上却一个都渲染不出来。

本轮逐条判：**要求还成立就照当下的页面重写断言，要求本身被后来的改版取代就作废并记下原因。**
顺带查出三处真的产品问题。

---

## 一、查出来的产品问题（改的是产品，不是测试）

### 1. 主按钮在三页大一号

`.btn` 基准是 13px，但 `resource-space.css` 有一条通铺的
`.ms-shell button,.ms-shell input,.ms-shell select{font:inherit}`，把壳子里的按钮全拉去继承 14px，
`.btn-pri` 也跟着继承了。于是「与你共享」「资料空间」「文件」三页的主按钮比其他 16 页大一号。

修：补一条 `.ms-shell .btn{font-size:.8125rem}`。

> 顺手记一笔：第一版改法是把那条选择器改成 `.ms-shell button:not(.btn)`。
> `:not()` 把权重从 (0,1,1) 抬到 (0,2,1)，反过来盖掉了 `.ctl-dd.as-input` 的 13px，
> 把三页的下拉框压成 12px。改权重会连带动别的东西，宁可另加一条。

### 2.「设计实验」自带一套表单尺度

全站表单字段是 14px / 32px / 圆角 8（`review-polish.css` 里按 `.lv-field` `.rs-field` 定的）。
`autonomous-lab.css` 的 `.al-field` 自己写了 13px，下拉框还是 34px / 圆角 6。
发起训练页 14px、设计实验页 13px，同一个控件两个尺寸。

修：`.al-field .input` 14px，`.al-field>.ctl-dd` 32px / 圆角 8 / 14px，
并补上窄屏和触屏下放大到 40px 的那条（原来 `.al-field` 不在那条媒体查询里）。

### 3. 资源表单改对了还红着

`toolnew` / `databasenew` 提交后，缺的字段会拿到 `aria-invalid` ＋ `aria-describedby`，
顶上还有一条可点回字段的汇总。但 `[data-rs-resource-field]` 的 `input` 处理只更新了
`RS.form[k]`，不动 `RS.form.errors`——用户把名称补上，红框、字段下那行提示、
汇总里那一条都还挂着，要再点一次提交才消。

修：`review-polish.js` 的 `rsBind` 里补 `clearResourceError`，边改边清（还不对的话下次提交会再报）。
和实验编排器 `iterationRefreshComposer` 一个做法。

---

## 二、重写掉的失效断言（产品没问题，断言写的是上一代页面）

### visual-style（原 5 过 3 红 → 8 全过）

- **十八个页面的标题色**：断言写「工作台的 h1 是 `--ink-3`，其他页是 `--ink`」。
  现在全站 h1 都是 `--ink`。另外那串路由名里有四个根本不存在（`ds` / `train` / `eval` / `batch`），
  `go()` 碰上不存在的路由是空操作，于是这四轮在上一页上又断言了一遍，看着还是绿的。
  改：换成真路由，并加一条 `S.route === route` 的保险。
- **主按钮投影**：断言要求 `box-shadow: none`。现在的皮肤给所有按钮一道发丝投影
  （`theme-bootcamp.css` 的 `!important`）。改成按意思写：投影各项不超过 2px、颜色中性——
  不许发光、不许带色。
- **实验卡的进度条**：断言要求进度条填色中性。现在进行中是墨蓝、失败是红，
  而条高只有 3px。原断言想防的是「大块上色」，改成按尺寸判：
  凡是带非中性底色的元素，窄边不许超过 6px。顺带把早就渲染不出来的
  `.lv-current` / `.wb-status` 两个空循环换成实打实的断言。
- **焦点可见**：`[data-rh-notifications]` 这个控件没了，换成工作台的待办按钮 `.rh-todo-btn`。
  （`:focus-visible` 只认键盘来的焦点，所以聚焦前要先敲一下 Tab。）
- **选中可见**：`[data-composer-node=prep]` 换成「设计实验」流程图上的 `.al-flow-pick`。

### interaction-components（原 3 过 8 红 → 11 全过）

- 工作台没有 `.btn-pri`，那一页的主操作是「进入对话」`.rh-new`：比它和全站主按钮的底色、字号、高度。
  （量之前要先 `mouse.move(0,0)`——上一步在共享页 hover 过，鼠标正好落在这个按钮上，量到的是 hover 态。）
- 表单尺度那条把 `.al-field` 加进选择器，于是它变成了上面第 2 条产品问题的证据。
- **错误语义**那条原来测编排器的下拉框。编排器换掉之后，这套机制活在资源表单里，
  所以改测 `databasenew`：提交后落到具体控件上、有可点的汇总、焦点落在汇总上，改一个字就清掉那一条。
  （这条就是上面第 3 条产品问题的证据。写断言时还踩了一个坑：
  不能复用 `[aria-invalid=true]` 那个选择器去复查，清掉之后它会指到下一个还红着的字段。）
- 键盘翻下拉、单选卡片两条换到「设计实验」的 `select-0` 和 `[data-al-origin]`。
  单选卡这里原生单选点是可见的，焦点环落在它身上就够，不再需要整卡描边。
- **共享课题详情的顶层页签**整条去掉了（这一页只做一件事）。改成：确认没有顶层页签，
  按类型分的那三个页签跟课题详情用的是同一个 `.pjx-tab`，两处几何必须一样。
- 异常实验卡的悬停边框：原断言钉死 `--ink-4`，现在是 `--line`。改成按意思写——中性色里换一档就行，不许借状态色。
- 窄屏那条里的共享工作流画布（`.shared-flow-node`）在 `891737c` 就删了，换成在 390 下打开一条资产看预览。

### product-iteration（原 13 过 31 红 → 39 全过，5 条作废）

重写的：R03 R05 R69 R10 R11 R12 R16 R04 R30 R31 R21 R22 R27 R28 R32 R38 R38-layout R34 R39
R47 R47-navigation R48 R46 R50 R51 R54。

几条值得单说的：

- **R04**「一屏装完」不要了。v2 的工作台是会往下滚的研究首页（1440×900 下纵向 425px），
  这是改版带来的，不是回归。只保留「任何宽度都不许横向滚」。
- **R69**「灵感卡是首屏主角」不成立了：灵感挪进右下角的学术助手浮层，不再跟别的模块比分量。
  改成卡内的分量关系——问句比标签和脚注都大，一张卡只给一个主按钮。
- **R30** 原来靠文案判方向（「待我审批」「申请中」）。改成按收件箱里真有哪几类操作判：
  两条 `data-inbox-approve`、一条 `data-inbox-import`、一条 `data-inbox-withdraw`。
- **R38** 原来比两种课题卡自己的 `border-radius`：一个 0、一个 12px。查下来边框和圆角都画在
  `.project-card-wrap` 上，卡自己 `border:0`，里层那个圆角根本看不见。
  改成比外框的几何加卡内的间距与字号——比看不见的属性没意义。
- **R34** 原来要求「管理共享」用淡蓝底＋墨蓝字。那个入口没了，共享这件事现在有两处标记，
  两处的做法都是定下来的：课题详情标题旁边是墨蓝字、不带底色（挨着大标题，带底色会抢）；
  课题卡上的那一个跟卡上其他角标一样压成中性灰。改成断言这两处各自成立，并且都没借第三种色相。
- **R39** 设备管理不在侧栏单列入口了，从实验管理进。目录还是 12 台、卡片横排。

### 作废的 5 条（留在文件里，不是删掉）

套件里新增了 `retire(id, name, why)`，跑完会单独打印，也写进结果 JSON。

| 条目 | 作废原因 | 现在谁管这块 |
|---|---|---|
| R09 每天固定一条灵感、第二天自动换 | 灵感挪进学术助手，改成随时按「换一个」，不按日期锁定，也不存本地 | R10（一句话＋换一个＋拿去问端砚） |
| R14 文献拉取失败态 | 文献改成本地种子数据，没有外部请求，也就没有失败态 | `offline-network` 那一套 |
| R37「创建项目副本」文案一致 | 这个入口在列表、详情、弹窗三处都整条去掉了 | — |
| R45 串行／并行依赖与样品谱系分开 | 模式开关随画布编排器一起换掉，依赖改成固定工序图上的边 | R47（只编辑选中的那一步） |
| R53 一路填满建出完整方案 | 完整方案改成 35 项必填，逐项填满不适合当界面断言 | R46（预检拦截并逐条列出缺的）、R47-navigation（翻页字段留存） |

---

## 三、本轮回归（跑构建产物）

绿：`v2-tricky` 53/53、`v2-dataflow` 40/40、`findable` 47/47、`workbench-reference` 13 组、
`navigation` PASS、`project-team` PASS、`lab-workflow` 10 组、`c_resp` 98 组、
`visual-style` 8/8、`interaction-components` 11/11、`product-iteration` 39 过 0 红（5 条作废）。

> 跑的时候踩了两个套件约定：`v2-tricky` 的第二个参数是**轮次过滤**不是文件路径
> （传 `index.html` 会一轮都不跑，然后打印「0 条全部通过」）；`c_resp.js` 要**绝对路径**
> （`file://`+相对路径打不开）。

### 另外三套本来也是红的（这次查出来，不是这轮改坏的）

都拿 `git show HEAD:index.html` 的改动前产物跑过，过/红完全一样：

| 套件 | 红在哪 | 看着像什么 |
|---|---|---|
| `workbench.cjs:23` | 期望 3，实得 0 | 又是老工作台那套 `.wb-panel` 选择器 |
| `autonomous-lab.cjs:155` | 创建任务后期望标题含「查看实验」，实得「结合与稳定性测试」 | 标题改成显示实验名了，是文案改动 |
| `t100.js` #50 | 「数据集能接到训练」→「已发布数据集缺少训练入口」 | **这条可能是真的产品缺口**，值得单独看 |

---

# 第二轮：清掉上面查出来的那三处（同日）

## 1. t100 #50 是真的产品缺口，补了入口

数据集列表那一行的操作是「详情 / 发布 / 共享 / 删除」，**没有「训练」**。
而「发布」的悬停提示写着「发布后内容锁定，可用于训练」——话说了，路没给：
发布完还得自己绕到模型训练页，再从下拉框里把这份数据找回来。
`data-dataset-train` 这个钩子在源码里一处都没有。

补了一个「训练」操作，点了直达新建训练任务，数据集已经选好：

```js
const h=dsFind(b.dataset.datasetTrain);if(!h)return;
S.pid=h.pid;trReset();                     /* 训练表单的数据集下拉按当前课题筛，先切课题 */
Object.assign(NEWTR,{ds:h.d.id,target:h.d.target||'',
  name:'打分器 · '+(tgtName(h.d.target)||h.d.name||h.d.id)});
go('trainnew');
```

只是打开表单，不建模型——t100 #50 的后半条就是查这个。

**第一版改法把表挤坏了，自己截图才看出来。** 一开始是在「发布」后面另加一格「训练」，
操作列从四格变五格，宽度 162 → 206px，数据集表在 1440 下的横向溢出从 5px 变成 49px，
钉住的操作列正好盖住「更新时间」——上一轮刚修完模型库表的同一个毛病，这就又犯一次。

改成**同一格按状态换**：草稿是「发布」，发布完了是「训练」。这一格的意思是
「这份数据下一步该干什么」，四格不变，宽度回到 162px，溢出回到 5px。
发布时间在「状态」和「更新时间」两列里都看得到，原来挂在禁用的「发布」上的
那句「已于 X 发布锁定」不必重复。

## 2. autonomous-lab.cjs：一条文案断言过期

建完任务后落在这个实验自己的页面上，`.al-page-head h1` 写的是**实验名**，
断言还在等通用词「查看实验」。标题用对象自己的名字是对的，改断言：
标题等于刚填的实验名，副标题是「<批次号> · 方案快照」。改完 12 条全过。

## 3. workbench.cjs：整套都在测改版前的工作台，重写成 5 条

原来的十二条全是三面板工作台的东西（`.wb-panel`、今日灵感轮播、文献订阅、
订阅编辑覆盖在途结果……），v2 换掉之后一条都落不下来，而且第一条就抛错、
后面十一条根本没跑到。

工作台现在已经有人管：`workbench-reference.cjs` 13 组（区块排布、翻页、卡片上的数、
文献外链、空状态、不随定时器自己变、各宽度不横滚、明暗对比度），
`product-iteration.cjs` 的 R02–R16（落地、模块、卡片分档、灵感、文献、注意力任务）。

所以这套只留那两套都没管、又确实还成立的几条，文件头上写清楚其余的去哪了：

1. 默认落地在工作台，侧栏跟着高亮，进来不调模型
2. 旧的 hash 深链还能用（`#chat` / `#dsets` / `#infer` / `#home`），且落地页不是空的
3. 工作台卡片上的任务点进去就落在那一条上（route / labPick / pid 三个都对）
4. 模型库五个页签都在，切过去都能生效
5. 全程没有运行时报错，也没有真的调模型

> 写的时候自己踩了一个：`catch` 里忘了 `browser.close()`，断言一失败 node 就退不出去，
> 看着像卡死。另外页签那条一开始按 `S.mtab` 判，数据集那一格点下去会换路由，
> 内部字段不跟着叫同一个名字——改成按「这一格是不是选中的」判。

## 4. 顺带修掉一处偶发红：interaction-components 的悬停对比

主按钮的悬停有 `.14s` 过渡，断言是「等 180ms 再量」。机器一忙就量到过渡中间的一帧，
于是同一个按钮在两页上差出几个色阶，时绿时红（深色那一轮尤其明显，
`--ink` 在深色下是浅色，中间帧看着像换了个控件）。
改成**等它不再变了再量**（连续两次读数一致就收），连跑三遍 11/11。

## 把所有套件跑了一遍：40 套里有多少红

顺手把 `review/` 下所有套件跑了一轮，发现**还有一批红的**，和这两轮改的东西无关。
另外有两类「假红」要先排掉：

- `a_render.js` `b_empty.js` `d_state.js` `e_loop.js` `f_click.js` `g_extreme.js` `h_flows.js`
  `c_resp.js` 的第二个参数是**绝对路径**，传相对路径会 `file://index.html` 直接崩。
  按绝对路径跑，这七套里六套是绿的。
- `v2-tricky.cjs` 的第二个参数是**轮次过滤**，传文件名会一轮都不跑还打印「全部通过」。

排掉之后，真正还红着的（这次没动）：

| 套件 | 备注 |
|---|---|
| `a_render.js` | 「32 个状态有问题」，量大，值得单独一轮 |
| `i_set.js` | |
| `experiment-exceptions.cjs` | |
| `new-pages-walkthrough.cjs` | 跑到 N12 之后红 |
| `project-progress.cjs` | |
| `requirements-audit.cjs` | |
| `research-workspace.cjs` | |
| `tricky10.cjs` `tricky10-edge-states.cjs` `tricky15.cjs` | 更早几轮的审查套件 |
| `tricky20.cjs` | `UNCOVERED shareddetail/dialog|ok:邀请成员` |
| `workbench-attention.cjs` `workbench-tricky.cjs` `workbench-upgrade.cjs` | 多半和 workbench.cjs 同一个病：测的是改版前的工作台 |

## 第二轮回归

`v2-tricky` 53/53、数据流 40/40、找得到 47/47、导航 PASS、课题成员 PASS、
实验流程 10 组、`autonomous-lab` 12 条、`workbench` 5 组、`workbench-reference` 13 组、
`visual-style` 8/8、`interaction-components` 11/11（连跑三遍）、
`product-iteration` 39/0、`c_resp` 98 组、**`t100` 100/100**、
`j_ask` / `k_comp` / `b_empty` / `d_state` / `e_loop` / `f_click` / `g_extreme` / `h_flows` 全过。

## 还留着的事

- `product-iteration.js` 里被 `autonomous-lab.js` / `resource-space.js` / `workbench-*.js`
  接管掉的那几个渲染函数是死代码（`.composer-*`、老 `.rs-project-card` 列表、`data-rs-tab`），
  连同 `index.html` 里老工作台的 `.wb-panel` / `.wb-inspiration` 一起，加起来是一笔不小的体积。
  这次没动：删死代码要逐个确认没有别的入口还在调，是单独一轮的事。
- `.ctl-dd` 全站还有三种尺度（表单 32px、密集工具栏 28px、定时任务 34px）。
  前两种是「表单 / 密集」两档，讲得通；定时任务那条 `!important` 的 34px 是单独一例，值得再看一眼。
