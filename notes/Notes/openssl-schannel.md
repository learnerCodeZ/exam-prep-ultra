# 什么是 OpenSSL / SSL 加密后端

## 一句话解释

OpenSSL 是一个开源的加密工具库，程序（git、浏览器、curl 等）用它来实现 HTTPS 加密通信。它是 git 加密通信的"引擎"之一；Windows 上 git 默认用的是微软自带的另一个引擎叫 **schannel**。

## 类比理解

想象你要给 GitHub 寄一封机密信件：

- **明文传输（不加密）** = 寄明信片，邮递员、邮局谁都能看到内容 ❌
- **HTTPS 加密** = 把信装进密码箱寄过去，只有收件人能打开 ✅

这个"密码箱"需要有人来制造和操作：

- **OpenSSL** = 开源社区做的密码箱（免费、跨平台、稳定）
- **schannel** = 微软 Windows 自带的密码箱（Windows 专属）

git 需要一个"密码箱"才能安全地和 GitHub 通信。Windows 上 git 默认用微软的 schannel，但可以切换成 OpenSSL。

## SSL / TLS 是什么

- **SSL**（Secure Sockets Layer）和 **TLS**（Transport Layer Security）是加密协议的名字
- TLS 是 SSL 的升级版，现在大家口语说的"SSL"通常就是指 TLS
- 作用：让网络传输的数据变成密文，防止窃听和篡改
- **HTTPS = HTTP + TLS**，即加密版的 HTTP
- 你访问带 🔒 锁标志的网站，就是在用 TLS

## OpenSSL vs schannel

| | OpenSSL | schannel |
|---|---|---|
| 来源 | 开源社区 | 微软 Windows 自带 |
| 跨平台 | ✅ Windows/Mac/Linux 都能用 | ❌ 只有 Windows |
| 跨平台一致性 | ✅ 三个平台加密行为一致 | ❌ 仅 Windows |
| 跟本地代理配合 | ✅ 稳定 | ❌ Windows 上经常和本地代理冲突 |
| Git for Windows 默认 | 否（可选） | 是（默认） |

## 为什么 Windows 上 git 要换成 OpenSSL

**踩坑场景**：用 Clash 等本地代理（`127.0.0.1:7890`）访问 GitHub 时，`git push` / `git pull` 反复报错：

```
schannel: failed to receive handshake, SSL/TLS connection failed
```

**原因**：schannel 和本地代理的 TLS 握手不兼容。代理转发流量时需要重新建立加密通道，schannel 在这一步经常失败。

**解决**：换用 OpenSSL 后端，握手更稳定，一劳永逸。

## 怎么查看和设置

```bash
# 查看当前用的哪个后端
git config --global http.sslBackend
# 输出 openssl 或 schannel；空就是没设置（用默认 schannel）

# 切换到 OpenSSL（推荐，解决代理冲突）
git config --global http.sslBackend openssl

# 切换回 schannel（恢复默认）
git config --global http.sslBackend schannel

# 或者：单次命令临时用 openssl（不改全局配置）
git -c http.sslBackend=openssl push origin master
```

## 实际踩坑记录

本项目部署时遇到的真实案例：

| 项 | 说明 |
|---|---|
| 环境 | Windows + Clash 代理（7890）+ Git for Windows |
| 症状 | `git push` 反复报 `schannel: failed to receive handshake`；但 `gh` CLI 能正常访问 GitHub |
| 诊断 | `gh` 用独立网络栈不受影响 → 说明网络是通的 → 问题出在 git 的加密后端 |
| 解决 | `git config --global http.sslBackend openssl` |

切到 openssl 后偶尔还会因网络抖动报 `unexpected eof while reading`（这是网络本身不稳定，不是后端问题），重试几次即可。

## 知识链接

- OpenSSL 官网：https://www.openssl.org
- Git 文档（http.sslBackend）：https://git-scm.com/docs/git-config#Documentation/git-config.txt-httpsslBackend
- TLS 协议科普：https://zh.wikipedia.org/wiki/传输层安全协议
