# 部署到自有 EC2 + Caddy 设计

日期：2026-08-12
域名：`mathviz.primeforge.app`（A 记录已指向 EC2 `18.135.222.248`，eu-west-2 伦敦）
服务器：已在跑的 EC2，Caddy 处理 HTTP，由维护者自行操作

## 1. 目标与范围

把这个纯静态站点（107 个 HTML、22MB、零后端）从 GitHub Pages 扩展到自有服务器。

### 首要动因：境内可达

这套工具的 UI 默认中文，主要受众在中国大陆，而 **GitHub Pages 在境内基本不可
达**。这不是"控制响应头"之类的优化，而是决定站点对主要用户是否存在的前提。
自建的第一理由是它，其余（缓存控制、脱离 GitHub 依赖）都是附带收益。

这条约束也决定了下面几处设计取向，先在此点明：**GitHub 不能出现在用户请求的
路径上**，只能出现在部署时刻。

**GitHub 侧一行不改。** 现有的 `registry-sync.yml` 原样保留，它自然成为部署的
前置条件（§3）。仓库里不新增 workflow，不新增 secret。

GitHub Pages **保留**，不下线：零成本，服务境外用户，兼作后备与第二意见。

### 未采用：Caddy `reverse_proxy` 到 GitHub Pages

看起来能"不占服务器资源"，实测三处当场翻车，且并不省资源：

| 实测 | 结果 |
|---|---|
| `curl -H 'Host: mathviz.primeforge.app' …github.io/MathViz/` | **404**——Pages 按 Host 路由，`reverse_proxy` 默认透传原 Host |
| 站点实际位置 | `/MathViz/` 而非根，需 `rewrite`；且 `/MathViz` 返回 301，`Location` 指回 `github.io`，**把用户弹出自有域名** |
| 响应头 | `cache-control: max-age=600` 原样透传，另有一层无法清除的 Fastly（`via: 1.1 varnish`） |

决定性的一条：**stock Caddy 的 `reverse_proxy` 不缓存响应**（需 souin 等插件），
所以每个用户请求都真的去 GitHub 取一趟——GitHub 仍在热路径上，只是换了个位置
被依赖。在"境内可达"这个目标下，这等于什么都没解决，还多了一跳和一个单点。

反代也不省资源：从本地磁盘发文件比"再去一趟 GitHub 再回来"开销更小。

### 未采用：Pages 自定义域名

若不考虑境内可达，这是最优解——零服务器、GitHub 免费 TLS 与全球 CDN。
但它把站点完全放在境内不可达的服务上，与首要动因直接冲突。

### 待定：服务器区域

当前在 **eu-west-2（伦敦）**。若境内可达是主要目标，东京（ap-northeast-1）或
新加坡（ap-southeast-1）是数量级上更合适的落点，其影响大于本文讨论的所有细节。
本设计不依赖具体区域，换区不需要改动任何内容。

**这一项需要实测后决定，不要凭猜**：从境内网络对当前 IP 与一个东京节点各跑
`curl -w '%{time_total}'` 对比。（境内 CDN 需 ICP 备案，`primeforge.app` 走不通，
故不在选项内。）

## 2. 方向：服务器拉，不是 CI 推

服务器主动 `git fetch`。GitHub 侧不持有任何凭证。

### 2.1 被推翻的方案，以及为什么记下来

初版设计是反的：GitHub Actions 用 SSH 私钥 rsync 到服务器。它被否掉了，
理由值得留档，因为其中两条是**实测推翻的判断**，不是偏好之争：

| 初版的论据 | 实测 |
|---|---|
| "服务器上 `.git` 有 112MB，比站点本身大五倍" | `git clone --depth 1` 总计 **28MB**，其中 `.git` 仅 **6.4MB**。用全量 history 估算，错了 17 倍 |
| "服务器 pull 需要在机器上放仓库凭证" | 仓库是 **PUBLIC**，`git clone https://` **零凭证** |
| "服务器 pull 会让部署与 CI 闸门脱钩" | 成立，但在 pull 方向上免费可修，见 §3 |

**方向反过来之后，安全性不是变差而是变好。** 初版 spec 有一整节威胁模型
（私钥从 Secrets 泄漏、中间人冒充主机、第三方 `ssh-deploy` action 在 CI 内
可读私钥、有 push 权限者改 workflow 外泄凭证）——那六条威胁**全部是"选择了
push"这一个决定的衍生物**。服务器主动拉，它们一条都不存在，那一整节因此删除。

用一份永久 SSH 私钥，换一个维护者本来就在场的步骤的自动化，不划算。

## 3. 闸门耦合：拉之前先确认 CI 全绿

保留初版唯一真正有价值的性质：**部署不能发生在 CI 红的时候**。在 pull 方向上
它不需要任何凭证——以下两个接口均已验证可匿名访问：

```
git ls-remote https://github.com/My2ndFoundation/MathViz.git refs/heads/main   # tip 的 sha
https://api.github.com/repos/My2ndFoundation/MathViz/actions/workflows/registry-sync.yml/runs?branch=main
```

先取 tip 的 sha，再单独验那个 sha 的 `registry-sync.yml` 运行结论。

### 三个必须写下来的坑

**1. 不能查 `/commits/main/status`。** 该接口实测返回 `state = pending`、
`total_count = 0`——不是因为 CI 没跑，而是 **GitHub Actions 写的是 check-runs，
不写 commit status**。照直觉写的脚本会永远认为"还没绿"从而**永不部署**，
且表现得像一道谨慎的安全检查。本仓反复记录的那类失败：结构上就观测不到目标
的度量。

**2. 也不能查 `/commits/main/check-runs` 然后要求"全绿"。** 实测 `main` 上有
四个 check-run：

```
name=report-build-status  app=github-actions  suite=85481956342
name=deploy               app=github-actions  suite=85481956342
name=build                app=github-actions  suite=85481956342
name=check                app=github-actions  suite=85481959829
```

前三个属于 **GitHub Pages 自己的 `pages-build-deployment`**，与本仓的闸门无关。
"全绿才部署"会把自建服务器**绑死在 GitHub Pages 上**——恰恰是自建要摆脱的那个
依赖。两者 `app.slug` 相同（都是 `github-actions`），只有 `check_suite.id` 不同，
所以按 app 过滤无效。

正确做法是按 **workflow 文件名**取运行记录。附带好处：日后往
`registry-sync.yml` 里加 job 会自动纳入闸门（run 的 `conclusion` 是聚合值），
不像按 job 名过滤那样会漏。

**3. 闸门验的 sha 与 fetch 拿到的 sha 必须是同一个。** 若闸门查"此刻的 main"
而 fetch 拿"几秒后的 main"，中间合进一个 PR 就会部署一个没验过闸门的
commit——这个漏洞出现在防它的脚本自己身上。已验证 **GitHub 允许按 sha
fetch**（`git fetch --depth 1 origin <sha>`），所以这个竞态窗口是直接消掉的，
不是靠事后比对补救的。

### 负向对照（已执行）

闸门是本方案唯一有逻辑的部分，按本仓规矩，"通过"在负向对照失败之前不算证据：

| 场景 | 期望 | 实测 |
|---|---|---|
| 真实数据 + 真实 tip | 通过 | `registry-sync 全绿`，exit 0 |
| `conclusion` 改为 `failure` | 拒绝 | `结论为 failure —— 拒绝部署`，exit 1 |
| `status` 改为 `in_progress` | 拒绝 | `仍在 in_progress —— 拒绝部署`，exit 1 |
| tip 上无运行记录（刚推送） | 拒绝 | `没有运行记录（可能刚推送、仍在排队）`，exit 1 |

## 4. 两个目录：失败隔离

```
/data/primeforge.app/MathViz/src   ← git clone（浅克隆，28MB），不对外
/data/primeforge.app/MathViz/www   ← Caddy 的 root
```

脚本是 `set -euo pipefail`，两个目录之间因此隔着一道成功判定：

```
fetch / reset --hard / clean -fd   ← 失败就在这里退出
        ↓ 只有全部成功才继续
rsync --delete → web 根            ← 上线
```

fetch 中断、磁盘满、clone 损坏——脚本死在第 2 步，**线上仍在服务上一份完好的
副本**。单目录方案里这些操作直接作用在 Caddy 正在服务的目录上，一次中断的
`git clean -fd` 就是一个半空的站点。对一个纯静态站，这是 staging 唯一还值得
保留的部分。

次要收益：`.git/` 不出现在 web 根。Caddy 会老实服务 `/.git/config`、
`/.git/HEAD`；仓库当前公开所以无泄漏，但那是噪音，且仓库一旦转私有就是真问题。

**一个曾经写过头、现已更正的论据**：初版说"边界应该是'文件根本不在那儿'，
而不是'配置记得挡住它'"。这话对 `.git` 成立，对 `docs/` **不成立**——两种
做法都是"默认全发布、靠一份清单排除"，清单放在部署脚本里还是 Caddyfile 里
并无本质区别，新增一个内部目录两者一样漏。真正的差别只有失败隔离（主要）
和 `.git` 不上线（次要）。

**代价**：28MB 磁盘，每次一秒的增量 rsync。

### 单目录替代方案（未采用，但站得住）

让 Caddy 直接服务 clone，用 `file_server` 的 `hide` 挡掉 `.git`、`docs`、
`.claude`、`CLAUDE.md`、`.githooks`、`.github`。少一个移动部件。§9 的三条
部署后验证在两种做法下都照常工作，所以"docs 是否泄漏"无论哪种都有机械校验
兜着。选两目录是为失败隔离，不是为发布边界。

## 5. 为什么是 `fetch + reset --hard` 而不是 `git pull`

- **`pull` 会失败，`reset --hard` 不会。** `pull` = fetch + merge；服务器上
  一旦有任何本地改动，它停在合并冲突上。部署脚本卡在冲突里比部署失败更难
  发现。`reset --hard` 的语义是"目标 commit 是什么，磁盘上就是什么"，幂等，
  没有能卡住它的状态。
- **取的是 sha，不是分支名。** `pull origin main` 只能表达"现在的 main"，
  而闸门验的是一个具体 commit（§3 坑 3）。`fetch --depth 1 origin <sha>` +
  `reset --hard <sha>` 让"验过的"和"部署的"在语法上就是同一个东西。
- **显式 `--depth 1`** 让浅克隆不随反复拉取而长胖。
- **补 `git clean -fd`**：`reset --hard` 只管追踪文件；服务器上残留的未追踪
  文件会被 rsync 一起推到 web 根。

## 6. 发布边界：哪些文件不上线

原则上"追踪的文件全推"，因为这仓库全靠相对路径互链，排除清单是"忘了某个
链接"的温床。`design-system/`、`archive/`、`chess/games/`、`core/**` 因此保留。

两个例外，依据是实测而非偏好：

```
grep -oE '(href|src|url\()[^)"]*docs/[^)")]*' $(git ls-files '*.html')   # 无输出
```

- **`docs/`**：运行时**零引用**（品牌资产是内联 data URI，不读 `docs/logo.png`），
  而其下有 45+ 份内部工程文档（`plans/`、`specs/`、`handoffs/`、`prompts/`），
  推上去即公开可读。
- **`.claude/`**：两份 SKILL.md 与 `launch.json`，是作者工具，不是站点内容。

**排除清单**：`.git`、`.github`、`.githooks`、`.claude`、`.gitignore`、
`tmp/`、`CLAUDE.md`、`docs/`。

（`.nojekyll` 保留：在 Caddy 下无作用，但 GitHub Pages 仍在用，删了会破坏那一侧。）

这条边界不靠记性维持——§9 第 2 条在每次部署后断言 `docs/` 返回 404。

## 7. 缓存策略

本仓的 `?v=<version>` 缓存键机制，是为了绕开 GitHub Pages 强加的
`max-age=600` 才存在的——升级藏在陈旧副本后面这件事真实发生过。自有 Caddy
上响应头由自己控制：HTML 与三份注册表 JSON 发 `no-cache`，派生的 PNG 发长缓存。

**`no-cache` 不是"不缓存"，是"用之前先校验"。** 浏览器保留副本并发
`If-None-Match`，命中就是一个 304 空响应。对 1.1MB 的
`chess-board-algorithms.html`，这省下的是整次传输，只付一个往返——在高延迟
链路上这恰恰是想要的行为。

**曾考虑并否决的分层缓存**：让带 `?v=` 的工具页走长缓存，只对无版本键的入口
文档回源校验，可再省掉那一个往返。否决理由有二：直接书签了不带 `?v=` 的工具页
会被钉在旧副本上；而所需的 matcher 组合（`path` 与 `not query` 的交并）在
Caddyfile 里既易写错又难验证。境内延迟的大头是传输量而非往返数，压缩
（`encode zstd gzip`，文本压 4–5 倍）与 HTTP/2 的收益远大于此，两者已默认启用。
不为一个往返换一类陈旧风险。

`?v=` **保留**。它不只是缓存产物：`app.html` 用它作为 iframe 的刷新触发器，
去掉会改变导航行为。它现在是双保险。

## 8. 部署脚本

**规范副本：[`scripts/deploy-server.sh`](../../../scripts/deploy-server.sh)。**
这份 spec 里**不再抄一遍脚本正文**——本仓刚因为"镜像的字段没人校验就会漂移"
吃过亏（`tools.json` 与 `index.html` 之间 62 条里 48 条版本号静默走偏）。
一份文档里的脚本副本是同一个失败模式，没有任何闸门会发现它和真脚本对不上。

结构（四步，`set -euo pipefail`）：

| 步 | 做什么 | 关键点 |
|---|---|---|
| 1 | `git ls-remote` 取 tip sha → 验该 sha 的 `registry-sync.yml` 运行结论 | §3 的三个坑 |
| 2 | `fetch --depth 1 origin <sha>` → `reset --hard <sha>` → `clean -fd` | §4 失败隔离、§5 为什么不用 `pull` |
| 3 | `rsync -a --delete` 带排除清单 → web 根 | §6 发布边界 |
| 4 | 三条线上断言 | §9 |

部署时执行的是 `/usr/local/bin/mathviz-deploy`，**不从 `$SRC` 直接跑**——
部署过程中脚本自我覆盖是自找的麻烦。改动后手动同步：

```bash
sudo cp /data/primeforge.app/MathViz/src/scripts/deploy-server.sh /usr/local/bin/mathviz-deploy
```

## 9. 验证与负向对照

`set -e` 之下三条断言全部会中断脚本。它们抓的是 rsync 自己报绿也发现不了的事：

| # | 断言 | 抓什么 | 负向对照（必须使其变红） |
|---|---|---|---|
| 1 | 线上 `/tools.json` 的 sha256 == `$SRC` 中该文件 | Caddy root 指错、服务的是旧副本、rsync 静默漏传 | 临时把 `root *` 指向空目录，reload，重跑 |
| 2 | `/docs/superpowers/specs/` 返回 404 | §6 的发布边界被破坏 | 临时去掉 `--exclude='docs/'`，重跑 |
| 3 | `/index.html` 的 `Cache-Control` 含 `no-cache` | Caddy 的 header 段没生效、被覆盖，**或 matcher 写成了永不命中的形式**（附录 A 的 ⚠） | 临时注释掉 `header @revalidate`，reload，重跑 |

按本仓规矩，"全绿"在负向对照失败之前不算证据。**第 2 条尤其要跑**——它守的
是 45 份内部工程文档不上公网，而这是三条里唯一**在浏览器里看不出来**的。

第 1 条用 `curl --retry 5 --retry-delay 2`：Caddy 首次签发证书时会有几秒不可用，
那不是失败。

## 10. 明确不做

- **不做 `releases/` + 符号链接的原子发布**。回滚机制已经存在：`git revert`
  后重跑脚本，一分钟内生效。再造一套是重复。
- **不加 CloudFront**。22MB 静态、单区域、机器已经在跑。多一层缓存就是多一层
  要调试的缓存，而缓存正是本项目历史上出过事的地方。
- **不下线 GitHub Pages**。
- **GitHub 侧不新增任何 workflow 或 secret**。

---

## 附录 A：Caddy 配置段

追加到 `/etc/caddy/Caddyfile`：

```caddyfile
mathviz.primeforge.app {
	root * /data/primeforge.app/MathViz/www
	encode zstd gzip
	file_server

	# 只有这几类会"内容变了而路径不变"，必须每次回源校验。见 §7。
	#
	# ⚠ 多个路径必须写在**同一行**。Caddy 文档：同一 named matcher 块内的多个
	# 条件是 AND，而同一 path 行内的多个路径才是 OR。写成
	#     @nocache {
	#         path *.html
	#         path /
	#     }
	# 是"既是 *.html 又是 /"——不可能同时成立，这条规则**永不命中且不报错**，
	# 缓存策略静默失效。本文初稿就是这么写的。
	@revalidate path *.html / /tools.json /chess/chess-tools.json /cryptography/cryptography-tools.json
	header @revalidate Cache-Control "no-cache"

	@static path *.png *.ico
	header @static Cache-Control "public, max-age=31536000, immutable"

	header {
		-Server
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
	}
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

DNS 已就位，证书由 Caddy 自动签发，reload 后数秒生效。

**不设 `Content-Security-Policy`**：所有工具都靠内联 `<script>` 与内联样式运行
（单文件、零依赖是本项目的第一原则），CSP 要么得开 `unsafe-inline` 从而形同
虚设，要么得给 107 个页面逐一算 hash。不做。

## 附录 B：服务器一次性设置

```bash
sudo mkdir -p /data/primeforge.app/MathViz/src /data/primeforge.app/MathViz/www
sudo chown -R "$USER":"$USER" /data/primeforge.app/MathViz/src /data/primeforge.app/MathViz/www
chmod 755 /data/primeforge.app/MathViz/www

git clone --depth 1 --branch main \
  https://github.com/My2ndFoundation/MathViz.git /data/primeforge.app/MathViz/src

sudo cp /data/primeforge.app/MathViz/src/scripts/deploy-server.sh /usr/local/bin/mathviz-deploy
sudo chmod +x /usr/local/bin/mathviz-deploy
```

公开仓库，`https` 克隆不需要凭证——服务器上不存在需要保管的东西。

Caddyfile 路径在 Debian/Ubuntu 与 Amazon Linux 的官方包下都是
`/etc/caddy/Caddyfile`；若为手工安装则以实际为准。

## 附录 C：日常使用

```bash
ssh <server> mathviz-deploy
```

一条命令，不必先登录进去。想无人值守则加 cron：

```
*/15 * * * * /usr/local/bin/mathviz-deploy >> /var/log/mathviz-deploy.log 2>&1
```

闸门检查在脚本内部，cron 绕不过它。
