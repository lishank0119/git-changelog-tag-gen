#!/usr/bin/env node

const fs = require('fs');
const {execSync} = require('child_process');

function getVersion(branch, increment) {
    let major = 1, minor = 0, patch = 0;
    let latestTag;
    try {
        latestTag = execSync(`git describe --tags --abbrev=0 --match "${branch}-v*"`)
        latestTag = latestTag.toString().trim();
    } catch (error) {
        latestTag = null;
    }

    if (latestTag) {
        const latestTagParts = latestTag.split('-v')[1].split('.');
        if (latestTagParts.length === 3) {
            major = parseInt(latestTagParts[0]);
            minor = parseInt(latestTagParts[1]);
            patch = parseInt(latestTagParts[2]);
        }
    }

    if (increment.toLowerCase() === 'major') {
        major += 1;
    } else if (increment.toLowerCase() === 'minor') {
        minor += 1;
    } else if (increment.toLowerCase() === 'patch') {
        patch += 1;
    } else {
        console.error('無效的命令，請指定 major、minor 或 patch。');
        process.exit(1);
    }

    return `${branch}-v${major}.${minor}.${patch}`;
}


function getChangelogEntries(branch, latestTag) {
    let changelogDiff;
    if (latestTag) {
        changelogDiff = execSync(`git log --pretty=format:"%h %H %s" ${latestTag}..${branch}`).toString().trim();
    } else {
        changelogDiff = execSync(`git log --pretty=format:"%h %H %s" ${branch}`).toString().trim();
    }

    const categorizedChangelog = {
        'feat': [],
        'fix': [],
        'chore': [],
        'docs': [],
        'style': [],
        'refactor': [],
        'test': [],
        'perf': [],
    };

    changelogDiff.split('\n').forEach(line => {
        const parts = line.split(' ');
        const hash = parts[0];
        const fullHash = parts[1];
        const message = parts.slice(2).join(' ');
        const match = message.match(/^\s*(feat|fix|docs|style|refactor|test|perf)(\(.+\))?:\s*(.*)/);
        if (match) {
            const category = match[1];
            const subGroup = match[2] ? match[2].slice(1, -1) : 'none';
            if (!categorizedChangelog[category][subGroup]) {
                categorizedChangelog[category][subGroup] = [];
            }
            categorizedChangelog[category][subGroup].push({message: match[3], hash, url: getCommitUrl(fullHash)});
        }
    });

    return categorizedChangelog;
}


function getCommitUrl(commitHash) {
    const repoUrl = getRepoUrl();
    return `${repoUrl}/commit/${commitHash}`;
}

function getRepoUrl() {
    try {
        return execSync('git remote get-url origin').toString().trim().replace(".git", "");
    } catch (error) {
        console.error('取得 Git URL 失敗');
        process.exit(1);
    }
}

function generateChangelogEntry(newVersion, categorizedChangelog) {
    let changelogEntry = `## [${newVersion}](${getCompareUrl(newVersion)})\n\n`;

    let subGroupList = {}

    Object.keys(categorizedChangelog).forEach(category => {
        const subGroup = categorizedChangelog[category];
        Object.keys(subGroup).forEach(key => {
            const list = subGroup[key];
            if (list.length > 0) {
                if (!subGroupList[key]) {
                    subGroupList[key] = {};
                }

                subGroupList[key][category] = list
                //
                // if (key === "none") {
                //     changelogEntry += `### ${category}\n\n`;
                // } else {
                //     changelogEntry += `### ${category}(${key})\n\n`;
                //
                // }
                // changelogEntry += list.map(item => `- ${item.message} [${item.hash}](${item.url})`).join('\n') + '\n\n';
            }
        });
    });

    if(subGroupList["none"]){
        Object.keys(subGroupList["none"]).forEach(category => {
            changelogEntry += `### ${category}\n\n`;
            changelogEntry += subGroupList["none"][category].map(item => `  - ${item.message}([${item.hash}](${item.url}))`).join('\n') + '\n\n';
        })
    }

    Object.keys(subGroupList).forEach(key => {
        if (key !== "none") {
            changelogEntry += `### ${key}\n`;
            Object.keys(subGroupList[key]).forEach(category => {
                changelogEntry += `- ${category}\n\n`;
                changelogEntry += subGroupList[key][category].map(item => `  - ${item.message}([${item.hash}](${item.url}))`).join('\n') + '\n\n';
            })
        }
    })

    return changelogEntry;
}

function prependToFile(filePath, contentToPrepend) {
    try {
        let existingContent = '';
        if (fs.existsSync(filePath)) {
            existingContent = fs.readFileSync(filePath, 'utf8');
        }

        const newContent = contentToPrepend + existingContent;

        fs.writeFileSync(filePath, newContent, 'utf8');

    } catch (error) {
        console.error('填寫文件失敗：', error);
    }
}


function updateChangelog(branch, increment) {
    const newVersion = getVersion(branch, increment);
    let latestTag;
    try {
        latestTag = execSync(`git describe --tags --abbrev=0 --match "${branch}-v*"`).toString().trim();
    } catch (error) {
        latestTag = null;
    }
    const categorizedChangelog = getChangelogEntries(branch, latestTag);
    const changelogEntry = generateChangelogEntry(newVersion, categorizedChangelog);

    prependToFile('CHANGELOG.md', changelogEntry);
}

function commitAndTag(newVersion) {
    execSync('git add CHANGELOG.md');
    execSync(`git commit -m "chore: changelog for version ${newVersion}"`);
    execSync(`git tag -a ${newVersion} -m "Version ${newVersion}"`);
}

function getCompareUrl(newVersion) {
    let latestTag;
    try {
        latestTag = execSync(`git describe --tags --abbrev=0`).toString().trim();
    } catch (error) {
        latestTag = null;
    }

    if (latestTag) {
        return `${getRepoUrl()}/compare/${latestTag}...${newVersion}`;
    } else {
        return `${getRepoUrl()}/releases/tag/${newVersion}`;
    }
}

// 取得傳入的參數
const branch = process.argv[2];
const increment = process.argv[3];

if (!branch) {
    console.error('請指定分支名稱。');
    process.exit(1);
}

if (!increment) {
    console.error('請指定要遞增的版本號部分（major、minor、patch）。');
    process.exit(1);
}

updateChangelog(branch, increment);
const newVersion = getVersion(branch, increment);
commitAndTag(newVersion);

console.log(`已更新 CHANGELOG.md 檔案、提交更改並建立標籤：${newVersion}`);
