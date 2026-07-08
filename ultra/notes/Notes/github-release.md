# GitHub Release 是什么

## 一句话

Release 就是给代码打一个**版本快照**，附上更新说明，方便别人下载和了解变化。

## 类比理解

想象你写了一本书：
- 每次修改手稿 = git commit
- 每次出版发行 = GitHub Release
- 出版时贴的版本号（第一版、第二版）= tag（v1.0、v2.0）
- 书后面附的"本版更新说明" = Release notes

读者买书不会买你的草稿，而是买某个版本。Release 就是让用户拿到一个确定的版本，而不是随时在变的最新代码。

## 三个概念的关系

```
Tag（标签）     → 指向某个 commit 的书签，如 v1.0、v2.0
Release（发布） → 挂在 tag 上的版本说明 + 可下载的源码包
Branch（分支）  → 代码的开发线，合并/删除分支不影响 tag 和 Release
```

关键：**Tag 和 Release 是独立的，不依赖分支存在。** 删分支不删 tag，删 tag 才删 Release。

## 我们项目的例子

| Release | Tag | 对应代码 | 说明 |
|---------|-----|---------|------|
| v1.0 — Classic | v1.0 | v1.0-branch | 初始版本，data.js 内嵌题库 |
| ultra — Ultra | ultra | main | 重构版本，动态题型 + 多种导入 |

## Release 页面能做什么

- 下载该版本的源码包（.zip / .tar.gz）
- 看版本更新说明（新增了什么、修了什么）
- 标记为 "Latest"（最新版本），用户一眼知道该下哪个
- 附加编译好的文件（如 .exe、.apk），纯前端项目不需要

## 常见操作

| 操作 | 怎么做 |
|------|--------|
| 创建 Release | GitHub 仓库 → Releases → Draft a new release |
| 编辑 Release | 点进某个 Release → 右上角编辑按钮 |
| 删除 Release | 编辑页面底部 → Delete |
| 创建 tag | 创建 Release 时选 tag，或命令行 `git tag v1.0 && git push origin v1.0` |
| 删除分支 | 不影响 tag 和 Release，放心删 |
