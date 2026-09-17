# ETTON CRM · 公网版（静态站）

月度经营报表的**脱敏公网版**：客户名已脱敏成代号、利润已取整，首页有访问口令门（默认口令 `etton2026`，见 `site/js/gate.js`）。

> ⚠️ 本仓库**只含脱敏公网版**，不含内网真实数据（`monthly.html` / `customer.html` / 真实 seed 都不在这里）。内网数据请留在本机，勿 push。

## 目录

```
etton-crm/
├── site/                      # 静态站点（nginx 根目录）
│   ├── monthly-public.html    # 公网版首页（有口令门）
│   ├── customer-public.html   # 公网版客户详情
│   ├── crm-monthly-seed-public.js
│   ├── crm-monthly-seed-trad-public.js
│   └── js/                    # 共享前端模块（含 gate.js 口令门）
├── nginx.conf                 # 根路径 302 → monthly-public.html
├── Dockerfile
├── .github/workflows/docker-build.yml   # push main 自动构建推 GHCR
└── k8s/deploy-sealos.yaml     # Sealos 部署清单
```

## 发布流程

### 1. 推到 GitHub（触发自动构建）

```bash
git init
git add .
git commit -m "init: etton-crm public site"
git branch -M main
git remote add github git@github.com:etton-AI/etton-crm.git   # 换成你的仓库地址
git push -u github main
```

push 到 `main` 后，`.github/workflows/docker-build.yml` 会自动构建镜像并推到
`ghcr.io/etton-ai/etton-crm:latest`。（仓库若不在 `etton-AI` 组织，请同步改 workflow 里的镜像路径和下面 k8s 里的 image。）

### 2. 把 GHCR 镜像包设为公开（关键，否则 Sealos 拉不到）

- GitHub → 你的头像 → **Packages** → 找到 `etton-crm` → **Package settings → Danger Zone → Change visibility → Public**。
- 默认新建的包是私有，Sealos 集群没有拉取凭证，会 `ImagePullBackOff`。

### 3. 部署到 Sealos

```bash
kubectl apply -f k8s/deploy-sealos.yaml
kubectl rollout status deployment/etton-crm -n ns-22nz9gjz
```

访问地址：**https://xieyxu4j7q.sealosbja.site**（域名前缀 `xieyxu4j7q` 在 `k8s/deploy-sealos.yaml` 里，可改）。

### 4. 更新站点内容

改完后重新构建 + 滚动重启：

```bash
git add . && git commit -m "update" && git push github main     # 触发新镜像
kubectl rollout restart deployment/etton-crm -n ns-22nz9gjz    # 拉最新镜像
```

## 安全说明

- 口令门只是「挡住随手点开的人」，**数据仍在静态 JS 文件里**，懂技术的人抓包/看源码仍能拿到（但拿到的是脱敏数据）。
- 修改口令：改 `site/js/gate.js` 顶部的 `PASS_HASH`，用
  `python -c "import hashlib;print(hashlib.sha256('新口令'.encode()).hexdigest())"` 生成新哈希。
