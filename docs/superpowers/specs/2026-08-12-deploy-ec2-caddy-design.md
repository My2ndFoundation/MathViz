# 部署到自有 EC2 + Caddy 设计

日期：2026-08-12
域名：`mathviz.primeforge.app`（A 记录已指向 EC2）
服务器：已在跑的 EC2，Caddy 处理 HTTP

## 1. 目标与范围

把这个纯静态站点（107 个 HTML、22MB、零后端）从 GitHub Pages 扩展到自有服务器，
push 到 `main` 后自动上线。

**范围划分是这份 spec 的前提：**

| 侧 | 谁做 | 本文覆盖 |
|---|---|---|
| GitHub（workflow、secrets、分支保护） | 本文给出完整步骤 | ✅ 全部 |
| GitHub ↔ 服务器的通信通道与安全模型 | 本文给出完整设计 | ✅ 全部（本文重点） |
| 服务器上的用户、目录、Caddy、证书 | 由维护者自行操作 | 仅附录 A 的配置段与 `authorized_keys` 行 |

GitHub Pages **保留**，不下线：零成本，作为后备和第二意见。

## 2. 通信通道设计

### 2.1 方向：CI 推，而不是服务器拉

服务器不主动连 GitHub。CI 在闸门全绿之后，用 SSH 把文件推上去。

这个方向的选择不是习惯，是因为它让**部署受闸门约束**。反方向（服务器定时
`git pull`）会让部署和 CI 脱钩——CI 报红服务器照样拉。本仓记过同类的事：
`registry-sync.yml` 曾连续四次合并对着空气报红而无人察觉，那道门的存在意义
被架空了整整四次。把 `deploy` 挂成 `needs: check`，红了就没有产物落地，
不依赖任何人记得去看。

另外，服务器拉取还要在机器上放仓库凭证和一个 112MB 的 `.git`（比站点本身大五倍）。

### 2.2 密钥

一把**专用**的 ed25519 密钥对，只服务于这一条通道，不复用任何已有密钥。
无 passphrase——CI 无法交互输入，加了也只是把口令换个地方明文存。安全性
由 §4 的权限最小化承担，不由 passphrase 承担。

```bash
ssh-keygen -t ed25519 -N '' -C 'github-actions-deploy@mathviz' -f ./mathviz_deploy
```

私钥进 GitHub Secret，公钥进服务器 `authorized_keys`，然后**删掉本机两份副本**。
本机留着只是多一个泄漏点——需要的时候重新生成一对比保管一对便宜。

### 2.3 主机指纹固定（这是本方案最容易做错的一处）

CI 每次都在一台全新的 runner 上首次连接服务器。若用
`StrictHostKeyChecking=no` 或 `ssh-keyscan` 现场抓取，等于**每次部署都接受
任何自称是该主机的一方**——中间人可以拿到完整的站点内容写入权。绝大多数
"SSH 部署"教程都这么写，它是错的。

正确做法：把服务器的主机公钥**预先固定**在 GitHub Secret 里，来源是服务器
自己的文件，而不是网络。在服务器上执行：

```bash
awk '{print "mathviz.primeforge.app " $1 " " $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

（只取前两个字段——`.pub` 的第三段是注释，不属于 known_hosts 格式。）

输出的那一行存为 Secret `DEPLOY_KNOWN_HOSTS`。workflow 里显式
`StrictHostKeyChecking=yes`。此后主机指纹一旦对不上，部署立即失败而不是
静默连过去。

**注意**：重建 EC2 实例或重装 sshd 会更换主机密钥，届时必须同步更新这个
Secret——这不是故障，是这道防护在正常工作。

### 2.4 GitHub 侧存放

| 名称 | 类型 | 值 | 为什么 |
|---|---|---|---|
| `DEPLOY_SSH_KEY` | Secret | 私钥全文（含首尾 BEGIN/END 行） | 真正的凭证 |
| `DEPLOY_KNOWN_HOSTS` | Secret | §2.3 那一行 | 非机密，但放 Secret 便于统一管理 |
| `DEPLOY_HOST` | Variable | 服务器地址 | 放 Variable 而非 Secret：Secret 会在日志里被打码，调试时看不到自己连了哪 |
| `DEPLOY_USER` | Variable | 专用部署账号名 | 同上 |
| `DEPLOY_PATH` | Variable | 见 §4 的路径说明 | 同上 |

三个 Variable 与两个 Secret **都挂在名为 `production` 的 Environment 下**，
不是仓库级。Environment 的作用是把 Secret 的可读范围收窄到显式声明
`environment: production` 的 job；顺带得到一份部署历史，以及日后想加人工
审批时的挂载点。

## 3. 威胁模型

| # | 威胁 | 缓解 | 残余风险 |
|---|---|---|---|
| T1 | 私钥从 GitHub Secrets 泄漏 | §4 权限最小化：持有该密钥只能往一个目录写文件 | 攻击者可篡改站点内容。靠 §7 的部署后校验与 §8 的即时吊销收敛 |
| T2 | 中间人冒充服务器 | §2.3 固定主机指纹，`StrictHostKeyChecking=yes` | 服务器主机密钥本身被窃取（此时已失守更多东西） |
| T3 | 恶意 PR 触发部署以窃取 Secret | GitHub 默认不向 fork PR 提供 Secret；外加显式 `if` 只在 `push` 到 `main` 时运行；Environment 再收一层 | 无实质残余 |
| T4 | 部署账号权限过大 | 专用账号、无 sudo、`restrict` 关闭端口/agent 转发与 pty | 见 T1 |
| T5 | 第三方 Action 供应链（如各类 `ssh-deploy` action 在 CI 内可读到私钥） | **deploy job 不使用任何第三方 action**，直接用 `ssh`/`rsync` shell 命令（约 8 行） | 仅剩 `actions/checkout`（GitHub 官方） |
| T6 | 有 push 权限者改 workflow 外泄 Secret | 这是**真正的边界**：能改 `main` 上 workflow 的人等价于能读该 Secret。靠 `main` 的分支保护 + 必需评审收敛 | 与仓库写权限同级，无法在 CI 层面消除 |
| T7 | 内部工程文档随站点公开 | §5 发布边界，外加 §7 的 404 断言 | 无（有机械校验） |

**T6 值得单独讲明白**：任何"把部署密钥交给 CI"的方案，其安全上限都是
`main` 分支的写权限管控。不要以为配了 Environment 就比这更强。

**显式拒绝的一项缓解**：用 `from="..."` 把 `authorized_keys` 限制到 GitHub
Actions 的出口 IP。这些网段来自 `https://api.github.com/meta`，有数千条且
持续变动，维护成本远超收益，且一旦漏更新就是部署全挂。不做。

## 4. 权限最小化（服务器侧，由维护者执行）

一个专用账号，无 sudo，仅拥有站点目录。`authorized_keys` 中该公钥前置限制项：

```
restrict,command="/usr/bin/rrsync -wo /srv/mathviz" ssh-ed25519 AAAA...省略... github-actions-deploy@mathviz
```

- `restrict` —— 关闭 port/agent/X11 转发、pty、user-rc（OpenSSH 7.2+）。
- `command="rrsync -wo <dir>"` —— 强制这把密钥**只能**执行 rsync，且只能
  写入 `/srv/mathviz` 之下。即使私钥完全泄漏，攻击者拿不到 shell、拿不到
  跳板、读不出服务器上任何其他文件。`-wo` 是 write-only（只许上传，不许
  从服务器拉取）；`--delete` 在 rrsync 默认允许（用 `-no-del` 才是禁止）。

**两个需要维护者在服务器上确认的点：**

1. `rrsync` 的实际路径随发行版而异（Debian/Ubuntu 的 rsync ≥3.2 通常在
   `/usr/bin/rrsync`，也可能在 `/usr/share/rsync/scripts/rrsync`；Amazon
   Linux 可能不带）。`command=` 里必须写**绝对路径**。
2. 若该机没有 `rrsync`，退化方案是只保留 `restrict`（去掉 `command=`），
   爆炸半径从"一个目录"放宽到"该账号可读的一切"。这仍然可接受（账号无
   sudo、无其他数据），但明显更弱——能装 `rrsync` 就装。

**路径的坑**：启用 `command="rrsync ... /srv/mathviz"` 后，rsync 的目标路径
是**相对于该受限根目录**的，因此 Variable `DEPLOY_PATH` 应设为 `/`，
而不是 `/srv/mathviz`。若走退化方案（无 rrsync），才填绝对路径
`/srv/mathviz`。填错的症状是路径被拼成 `/srv/mathviz/srv/mathviz`。

## 5. 发布边界：哪些文件不上线

原始设计是"追踪的文件全推"，理由是这仓库全靠相对路径互链，排除清单是
"忘了某个链接"的温床。这个理由对 `design-system/`、`archive/`、
`chess/games/` 仍然成立——它们保留。

但 `docs/` 例外，依据是实测而非偏好：

```
grep -oE '(href|src|url\()[^)"]*docs/[^)")]*' $(git ls-files '*.html')   # 无输出
```

运行时对 `docs/` **零引用**（品牌资产是内联 data URI，不读 `docs/logo.png`），
而其下有 45+ 份内部工程文档（`plans/`、`specs/`、`handoffs/`、`prompts/`），
包含未发布的计划与交接笔记。推上去就是公开可读。

`.claude/`（两份 SKILL.md 与 `launch.json`）同理排除——是作者工具，不是站点内容。

**排除清单**：`.git`、`.github`、`.githooks`、`.claude`、`.gitignore`、
`tmp/`、`CLAUDE.md`、`docs/`。

（`.nojekyll` 保留：在 Caddy 下无作用，但 GitHub Pages 仍在用，删了会破坏那一侧。）

这条边界不靠记性维持——§7 的第 2 项会在每次部署后断言 `docs/` 返回 404。

## 6. GitHub Actions workflow

追加到现有的 `.github/workflows/registry-sync.yml`（**同一个文件**，使
`needs: check` 成立；拆成两个 workflow 就无法表达这个依赖）：

```yaml
  deploy:
    needs: check
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: read          # GITHUB_TOKEN 最小权限：本 job 只需读代码
    concurrency:
      group: deploy-production
      cancel-in-progress: false   # 不取消：rsync 到一半被杀会留下半套文件
    steps:
      - uses: actions/checkout@v4

      # 不用任何第三方 ssh-deploy action：那类 action 在运行时可读到私钥，
      # 而这几行自己写只要 8 行。见威胁模型 T5。
      - name: 准备 SSH（固定主机指纹）
        run: |
          mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
          printf '%s\n' "${{ secrets.DEPLOY_SSH_KEY }}"     > "$HOME/.ssh/deploy_key"
          printf '%s\n' "${{ secrets.DEPLOY_KNOWN_HOSTS }}" > "$HOME/.ssh/known_hosts"
          chmod 600 "$HOME/.ssh/deploy_key" "$HOME/.ssh/known_hosts"

      - name: rsync 到服务器
        run: |
          rsync -az --delete \
            --exclude='.git' --exclude='.github' --exclude='.githooks' \
            --exclude='.claude' --exclude='.gitignore' --exclude='tmp/' \
            --exclude='CLAUDE.md' --exclude='docs/' \
            -e "ssh -i $HOME/.ssh/deploy_key \
                    -o StrictHostKeyChecking=yes \
                    -o UserKnownHostsFile=$HOME/.ssh/known_hosts" \
            ./ "${{ vars.DEPLOY_USER }}@${{ vars.DEPLOY_HOST }}:${{ vars.DEPLOY_PATH }}"

      - name: 部署后验证
        run: bash .github/scripts/verify-deploy.sh https://mathviz.primeforge.app
```

`cancel-in-progress: false` 不是保守：`--delete` 的 rsync 被中途取消会在目标
目录留下删了一半、传了一半的状态。让后一次排队等待，代价是几十秒。

## 7. 部署后验证

新增 `.github/scripts/verify-deploy.sh`。它检查的是 **rsync 自己报绿也发现
不了的事**——传成功了但 Caddy 的 root 指错目录、服务的是旧副本、响应头没
生效、该挡的路径没挡住。

三条断言，每条都给出使其变红的负向对照（按本仓规矩，"零"与"全绿"在负向
对照失败之前不算证据）：

| # | 断言 | 抓什么 | 负向对照 |
|---|---|---|---|
| 1 | 线上 `/tools.json` 的 sha256 == 仓库中该文件 | Caddy root 指错、传到了旧目录、rsync 静默漏传 | 服务器上临时把 `root *` 指向空目录 → 应变红 |
| 2 | `/docs/superpowers/specs/` 返回 404 | §5 的发布边界被破坏 | 临时从排除清单去掉 `docs/` 重跑 → 应变红 |
| 3 | `/index.html` 的 `Cache-Control` 含 `no-cache` | Caddy 的 header 段没生效或被覆盖 | 临时注释掉 Caddyfile 的 `header @html` → 应变红 |

第 1 条用 `curl --retry 5 --retry-delay 3`：Caddy 首次签发证书时会有几秒
不可用，那不是失败。

第 3 条存在的理由见 §9。

## 8. 密钥轮换与吊销

**轮换（零停机）**：生成新密钥对 → 把新公钥**追加**到 `authorized_keys`
（此时两把都有效）→ 更新 Secret `DEPLOY_SSH_KEY` → 手动触发一次部署确认
成功 → 删除旧公钥那一行。

**疑似泄漏时的吊销**：删掉 `authorized_keys` 里那一行。即时、彻底、不需要
GitHub 侧配合。这是把凭证的最终控制权留在自己机器上的好处。

## 9. 缓存策略

本仓的 `?v=<version>` 缓存键机制，是为了绕开 GitHub Pages 强加的
`max-age=600` 才存在的——升级藏在陈旧副本后面这件事真实发生过。自有 Caddy
上响应头由自己控制：HTML 与三份注册表 JSON 发 `no-cache`（每次回源校验，
304 很便宜），派生的 PNG 发长缓存。

`?v=` **保留**。它不只是缓存产物：`app.html` 用它作为 iframe 的刷新触发器，
去掉会改变导航行为。它现在是双保险。

## 10. 明确不做

- **不做 `releases/` + 符号链接的原子发布**。回滚机制已经存在，叫
  `git revert`，CI 一分钟内重新部署。再造一套是重复。
- **不加 CloudFront**。22MB 静态、单区域、机器已经在跑。多一层缓存就是多
  一层要调试的缓存，而缓存正是本项目历史上出过事的地方。
- **不下线 GitHub Pages**。
- **不做 IP 白名单**。理由见 §3 末。

---

## 附录 A：Caddy 配置段

```caddyfile
mathviz.primeforge.app {
	root * /srv/mathviz
	encode zstd gzip
	file_server

	# HTML 与注册表每次回源校验：304 很便宜，陈旧副本很贵。
	# 这两类是本项目唯一会"内容变了而路径不变"的资源。
	@nocache {
		path *.html
		path /
		path /tools.json
		path /chess/chess-tools.json
		path /cryptography/cryptography-tools.json
	}
	header @nocache Cache-Control "no-cache"

	# 派生资产内容稳定，放心长缓存
	@static path *.png *.ico
	header @static Cache-Control "public, max-age=31536000, immutable"

	header {
		-Server
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
	}
}
```

不设 `Content-Security-Policy`：所有工具都靠内联 `<script>` 与内联样式运行
（单文件、零依赖是本项目的第一原则），CSP 要么得开 `unsafe-inline` 从而
形同虚设，要么得给 107 个页面逐一算 hash。不做。

证书由 Caddy 自动签发，DNS 已就位，reload 后数秒生效。

## 附录 B：GitHub 侧操作清单

1. 本机生成密钥对：`ssh-keygen -t ed25519 -N '' -C 'github-actions-deploy@mathviz' -f ./mathviz_deploy`
2. 服务器上取 known_hosts 行（§2.3 的 `awk` 命令）
3. GitHub → Settings → Environments → 新建 `production`
4. 在该 Environment 下添加两个 Secret（`DEPLOY_SSH_KEY`、`DEPLOY_KNOWN_HOSTS`）
   与三个 Variable（`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_PATH`）
5. 删除本机的 `mathviz_deploy` 与 `mathviz_deploy.pub`
6. GitHub → Settings → Branches → 给 `main` 加分支保护 + 必需评审（§3 T6：
   这是本方案真正的安全边界，不是可选项）
7. 合并本设计对应的 PR（workflow 的 `deploy` job + 验证脚本）
8. 观察首次部署，并按 §7 的表格逐条跑一遍负向对照
