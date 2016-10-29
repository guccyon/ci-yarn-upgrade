import hash from "sha.js";

import Yarnpkg from "./yarnpkg";
import Git from "./git";
import GitHub from "./github";

function findOutdatedDeps(LOG, out) {
    LOG("Find some outdated dependencies.");
    let raw = out.split(/[\r]?\n/);
    if (1 < raw.length) {
        LOG(`difference table ${raw[0]}`);
        let diff = JSON.parse(raw[0]).data.body;
        if (diff && diff.some(v => v[1] !== v[2])) {
            LOG("Found outdated dependencies.");
            let hex = new hash.sha1().update(raw[0], "utf8").digest("hex");
            return [diff, hex];
        }
    }
    LOG("Did not find outdated dependencies.");
    return Promise.reject("dependencies are not up to date.");
}

function findExistingBranch(LOG, options, names, diff, hex) {
    LOG("Find existing branch.");
    let newBranch = `${options.prefix}${options.now}/${hex}`;
    let found = names.find(n => n.endsWith(hex));
    if (found) {
        LOG(`Found existing branch ${found}`);
        return Promise.reject("Working Branch is already exists.");
    }
    return [newBranch, diff];
}

function selectPushPromise(LOG, options, git, remote, branch) {
    if (options.execute) {
        return git.push(remote, branch);
    }
    LOG("`git push` is skipped because --execute is not specified.");
    return Promise.resolve();
}

function selectDeletePromise(LOG, options, git, branch, report) {
    let p;
    if (options.keep) {
        LOG("Working branch is kept.");
        p = Promise.resolve();
    } else {
        LOG("Delete working branch because --keep is not specified.");
        p = git.deleteBranch(branch);
    }
    return p.then(() => report);
}

// for tesing purpose
export const __test__ = [findOutdatedDeps, findExistingBranch, selectPushPromise, selectDeletePromise];

export default function (options) {
    let LOG = options.logger;
    let yarnpkg = new Yarnpkg(options.workingdir, LOG);
    let git = new Git(options.workingdir, LOG);
    return yarnpkg.install()
        .then(() => yarnpkg.outdated())
        .then(out => findOutdatedDeps(LOG, out))
        .then(([diff, hex]) => git.fetch("origin").then(() => [diff, hex]))
        .then(([diff, hex]) => git.branchList().then(names => [names, diff, hex]))
        .then(([names, diff, hex]) => findExistingBranch(LOG, options, names, diff, hex))
        .then(([newBranch, diff]) => git.checkoutWith(newBranch).then(() => diff))
        .then(diff => yarnpkg.upgrade().then(() => diff))
        .then(diff => git.setup(options.username, options.useremail).then(() => diff))
        .then(diff => git.add("yarn.lock").then(() => diff))
        .then(diff => git.commit("update dependencies").then(() => diff))
        .then(diff => git.currentBranch().then(newBranch => [newBranch, diff]))
        .then(([newBranch, diff]) => git.checkout("-").then(() => ([newBranch, diff])))
        .then(([newBranch, diff]) => git.currentBranch().then(baseBranch => [baseBranch, newBranch, diff]))
        .then(([baseBranch, newBranch, diff]) =>
            selectPushPromise(LOG, options, git, "origin", newBranch)
                .then(() => [baseBranch, newBranch, diff]))
        .then(([baseBranch, newBranch, diff]) => git.remoteurl("origin")
            .then(remote => [new GitHub(options, remote), baseBranch, newBranch, diff]))
        .then(([github, baseBranch, newBranch, diff]) =>
            github.pullRequest(baseBranch, newBranch, diff)
                .then(report => [report, newBranch]))
        .then(([report, newBranch]) =>
            selectDeletePromise(LOG, options, git, newBranch, report));
}
