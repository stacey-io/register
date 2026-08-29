// PR-level ownership checks. Runs only in CI on pull_request events, where the
// workflow exports PR_AUTHOR and CHANGED_FILES / DELETED_FILES.
// This is the rule that stops anyone from hijacking someone else's subdomain:
// the PR author's GitHub username must match owner.username in every domain
// file they touch. Inspired by is-a-dev/register (MIT).
import t from "ava";
import fs from "fs-extra";
import path from "path";

const prAuthor = (process.env.PR_AUTHOR || "").toLowerCase();
const changedFiles = JSON.parse(process.env.CHANGED_FILES || "[]");
const deletedFiles = JSON.parse(process.env.DELETED_FILES || "[]");

const trusted = fs.readJsonSync(path.resolve("util/trusted.json")).map((u) => u.toLowerCase());

const skip = !prAuthor; // local runs / push events

t("PR authors may only add or modify their own subdomains", (t) => {
    if (skip) return t.pass("Not a PR context — skipped");
    if (trusted.includes(prAuthor)) return t.pass("Trusted maintainer — skipped");

    changedFiles
        .filter((f) => f.startsWith("domains/") && f.endsWith(".json"))
        .forEach((f) => {
            const data = fs.readJsonSync(path.resolve(f));
            t.is(
                data.owner.username.toLowerCase(),
                prAuthor,
                `${f}: owner.username ("${data.owner.username}") must match the PR author ("${prAuthor}")`
            );
        });
    t.pass();
});

t("PR authors may only delete their own subdomains", (t) => {
    if (skip) return t.pass("Not a PR context — skipped");
    if (trusted.includes(prAuthor)) return t.pass("Trusted maintainer — skipped");

    deletedFiles
        .filter((f) => f.name.startsWith("domains/") && f.name.endsWith(".json"))
        .forEach((f) => {
            // The deleted file's content arrives as a diff patch; check the owner line.
            const ownedByAuthor = (f.data || "")
                .toLowerCase()
                .includes(`"username": "${prAuthor}"`);
            t.true(
                ownedByAuthor,
                `${f.name}: you can only delete subdomains you own`
            );
        });
    t.pass();
});

t("PRs must not touch infrastructure files", (t) => {
    if (skip) return t.pass("Not a PR context — skipped");
    if (trusted.includes(prAuthor)) return t.pass("Trusted maintainer — skipped");

    const protectedPaths = ["dnsconfig.js", "util/", ".github/", "tests/", "package.json"];
    changedFiles.forEach((f) => {
        protectedPaths.forEach((p) => {
            t.false(
                f === p || f.startsWith(p),
                `${f}: infrastructure files can only be changed by maintainers`
            );
        });
    });
    t.pass();
});
