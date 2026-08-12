#!/usr/bin/env bash
#
# 把 main 部署到自有 EC2 的 Caddy 站点根。设计与理由见
# docs/superpowers/specs/2026-08-12-deploy-ec2-caddy-design.md
#
# 这是**规范副本**，不从 $SRC 直接执行——部署过程中脚本自我覆盖是自找的麻烦。
# 改动后手动同步：
#   sudo cp /data/primeforge.app/MathViz/src/scripts/deploy-server.sh /usr/local/bin/mathviz-deploy
#
set -euo pipefail

REPO=My2ndFoundation/MathViz
REPO_URL=https://github.com/My2ndFoundation/MathViz.git
BRANCH=main
GATE_WORKFLOW=registry-sync.yml
SRC=/data/primeforge.app/MathViz/src   # git clone，不对外
WEB=/data/primeforge.app/MathViz/www   # Caddy 的 root
SITE=https://mathviz.primeforge.app

echo "== 1/4 CI 闸门 =="
# 先拿到 tip 的 sha，再单独验它——不查 /commits/main/check-runs。
# 两个理由：
#   1. main 上有四个 check-run，其中三个（build / deploy / report-build-status）
#      是 GitHub Pages 自己的 pages-build-deployment，与本仓的闸门无关。
#      "全绿才部署"会把自建服务器绑死在 Pages 上——正是自建要摆脱的依赖。
#      两者 app.slug 都是 github-actions，只有 check_suite.id 不同，按 app 过滤没用。
#   2. 按 workflow **文件名**取，日后往 registry-sync.yml 里加 job 会自动纳入
#      闸门（run 的 conclusion 是聚合值），不像按 job 名过滤那样会漏。
# 另：不查 /commits/main/status——GitHub Actions 不写 commit status，那个接口
# 实测恒为 pending，照它写的脚本会永不部署，且看起来像一道谨慎的安全检查。
sha=$(git ls-remote "$REPO_URL" "refs/heads/${BRANCH}" | cut -f1)
[ -n "$sha" ] || { echo "取不到 ${BRANCH} 的 tip"; exit 1; }

curl -fsS -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/${REPO}/actions/workflows/${GATE_WORKFLOW}/runs?branch=${BRANCH}&per_page=20" \
| SHA="$sha" python3 -c '
import json, os, sys
sha = os.environ["SHA"]
runs = [r for r in json.load(sys.stdin).get("workflow_runs", []) if r["head_sha"] == sha]
if not runs:
    sys.exit(sha[:12] + " 上没有 registry-sync 运行记录（可能刚推送、仍在排队）—— 拒绝部署")
r = runs[0]
if r["status"] != "completed":
    sys.exit("registry-sync 仍在 " + r["status"] + " —— 拒绝部署")
if r["conclusion"] != "success":
    sys.exit("registry-sync 结论为 " + str(r["conclusion"]) + " —— 拒绝部署")
print("   registry-sync 全绿，目标 " + sha[:12])
'

echo "== 2/4 同步源码 =="
# 取**那个被验过的 sha**，而不是"现在的 main"：否则闸门验的是此刻的 tip、
# fetch 拿的是几秒后的 tip，中间合进一个 PR 就会部署一个没验过闸门的 commit。
# GitHub 允许按 sha fetch（已验证），所以这个竞态窗口可以直接消掉而不是事后比对。
#
# fetch + reset --hard 而不是 pull：pull 会停在合并冲突上，卡住的部署脚本
# 比失败的部署脚本更难发现。reset --hard 是幂等的，没有能卡住它的状态。
# clean -fd 收掉未追踪的残留，否则它们会被 rsync 推上线。
git -C "$SRC" fetch --depth 1 origin "$sha"
git -C "$SRC" reset --hard "$sha"
git -C "$SRC" clean -fd

echo "== 3/4 发布 =="
# docs/ 与 .claude/ 是内部工程文档与作者工具，运行时零引用（品牌资产是内联
# data URI，不读 docs/logo.png）。发布边界见 spec §6；§9 第 2 条会断言它 404。
rsync -a --delete \
  --exclude='.git' --exclude='.github' --exclude='.githooks' \
  --exclude='.claude' --exclude='.gitignore' --exclude='tmp/' \
  --exclude='CLAUDE.md' --exclude='docs/' \
  "$SRC/" "$WEB/"

echo "== 4/4 验证 =="
# 三条都抓 rsync 自己报绿也发现不了的事。负向对照见 spec §9——
# "全绿"在负向对照失败之前不算证据。
# --retry：Caddy 首次签发证书时会有几秒不可用，那不是失败。
live=$(curl -fsS --retry 5 --retry-delay 2 "$SITE/tools.json" | sha256sum | cut -d' ' -f1)
repo=$(sha256sum "$SRC/tools.json" | cut -d' ' -f1)
[ "$live" = "$repo" ] || { echo "  BAD 线上 tools.json 与仓库不一致"; exit 1; }
echo "  OK  tools.json 一致"

code=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/docs/superpowers/specs/")
[ "$code" = 404 ] || { echo "  BAD docs/ 返回 $code，内部文档已公开"; exit 1; }
echo "  OK  docs/ 未公开"

curl -sI "$SITE/index.html" | tr -d '\r' | grep -qi '^cache-control:.*no-cache' \
  || { echo "  BAD index.html 缺 no-cache"; exit 1; }
echo "  OK  index.html no-cache"

echo "部署完成 ${sha:0:12}"
