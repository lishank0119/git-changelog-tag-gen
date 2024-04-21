# 自動生成TAG Changelog.md
每個分支都有獨立版本

commit 是用 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

## 使用方式

```shell
npm install -g git-changelog-tag-gen
```

version = major.minor.patch

```shell
git-changelog-tag-gen {branch} patch
git-changelog-tag-gen {branch} minor
git-changelog-tag-gen {branch} major
```