#!/bin/bash
# 全量回归。跑在**打包产物**上——测的是用户拿到的那一个文件，不是源文件。
# 用法：./run_all.sh          先 build 再全跑
#      ./run_all.sh --quick  只跑 review/ 评审脚本与 100 条测试
set -u
cd "$(dirname "$0")"
P="$PWD/index.html"
SRC="$PWD/src/index.html"

node build.mjs >/dev/null || { echo "打包失败"; exit 1; }

PASS=0; FAIL=0; FAILED=""
run(){ local n="$1"; shift
  out=$("$@" 2>&1); rc=$?
  if [ $rc -eq 0 ]; then PASS=$((PASS+1)); echo "✅ $n"
  else FAIL=$((FAIL+1)); FAILED="$FAILED $n"; echo "❌ $n"; echo "$out" | tail -7 | sed 's/^/      /'; fi }

# 评审脚本：渲染 / 空态 / 响应式 / 组件状态 / 数据闭环 / 全量点击 / 极端数据 / 端到端 / 模型接入 / 自由问答
for f in a_render b_empty c_resp d_state e_loop f_click g_extreme h_flows i_set j_ask k_comp; do
  [ -f "review/$f.js" ] && run "review/$f" node "review/$f.js" "$P"; done
# 100 条研究路线 / 数据上传 / 训练 / 部署调用 / 日常使用检查，详见 测试点清单.md
[ -f review/t100.js ] && run "review/t100（100 条）" node review/t100.js "$P"
[ "${1:-}" = "--quick" ] && { echo; echo "通过 $PASS　失败 $FAIL"; [ -z "$FAILED" ]; exit $?; }

for f in symbols deadbtn contrast nocaps ddtest scroll svgzero r3 pipe \
         a1_flow a2_doc a3_mgmt a4_dl m1_primer m2_sgrna m3_train m4_claims m5_routes m6_deg \
         sweep collide dupact dupfn deadcss back r1_data r8_edge r9_pipe r10_e2e r11_flow \
         r12_arch r13_num r14_task r15_flow r16_edge r17_claim \
         t1_consistency t2_effect t3_edge t4_claims t5_loop \
         v1_afford v3_hit v4_narrow v5_long v6_dark v7_state v8_feedback v9_rhythm \
         v10_states v10c_caonly v11_tabshift v12_archpid v13_3d \
         route1 route2 mdl1 ask1 nokey cot1 term1 flow1 dsnew1; do
  [ -f "qa/$f.js" ] && run "qa/$f" node "qa/$f.js" "$P"; done
run "qa/v10b_async" node qa/v10b_async.js "$SRC"
# v2_focus 放最后：552 跳 × 两次过渡等待，约 7 分钟
run "qa/v2_focus" node qa/v2_focus.js "$P"

echo; echo "通过 $PASS　失败 $FAIL"
[ -n "$FAILED" ] && echo "失败项：$FAILED"
[ -z "$FAILED" ]
