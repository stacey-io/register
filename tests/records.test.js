// DNS record validation for every file in domains/
import t from "ava";
import fs from "fs-extra";
import path from "path";

const domainsPath = path.resolve("domains");
const files = fs.readdirSync(domainsPath).filter((f) => f.endsWith(".json"));

const validRecordTypes = new Set(["A", "AAAA", "CAA", "CNAME", "TXT"]); // MX forbidden: mail-as-*.stacey.io = spam/reputation abuse

const reserved = fs.readJsonSync(path.resolve("util/reserved.json"));
const internal = fs.readJsonSync(path.resolve("util/internal.json"));
const disallowedCnames = fs.readJsonSync(path.resolve("util/disallowed-cnames.json"));

const ipv4Regex =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/;
const hostnameRegex =
    /^(?=.{1,253}$)(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])\.)+[a-zA-Z]{2,63}$/;

function read(file) {
    return fs.readJsonSync(path.join(domainsPath, file));
}

t("Only supported record types may be used", (t) => {
    files.forEach((file) => {
        const data = read(file);
        Object.keys(data.records || {}).forEach((type) => {
            t.true(validRecordTypes.has(type), `${file}: unsupported record type "${type}"`);
        });
    });
    t.pass();
});

t("Every domain must have at least one record", (t) => {
    files.forEach((file) => {
        const data = read(file);
        t.true(
            Object.keys(data.records || {}).length > 0,
            `${file}: no records — parked/empty subdomains are not allowed`
        );
    });
    t.pass();
});

t("A records must be valid public IPv4 addresses", (t) => {
    const privateRanges = [/^10\./, /^127\./, /^192\.168\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^0\./, /^169\.254\./];
    files.forEach((file) => {
        const data = read(file);
        (data.records.A || []).forEach((ip, idx) => {
            t.regex(ip, ipv4Regex, `${file}: invalid IPv4 at A[${idx}]`);
            privateRanges.forEach((range) => {
                t.false(range.test(ip), `${file}: A[${idx}] is a private/loopback IP`);
            });
        });
    });
    t.pass();
});

t("CNAME must be a single valid hostname", (t) => {
    files.forEach((file) => {
        const data = read(file);
        if (!data.records.CNAME) return;
        t.is(typeof data.records.CNAME, "string", `${file}: CNAME must be a string`);
        t.regex(data.records.CNAME, hostnameRegex, `${file}: CNAME is not a valid hostname`);
        t.false(
            Object.keys(data.records).some((k) => k !== "CNAME"),
            `${file}: CNAME cannot coexist with other record types`
        );
    });
    t.pass();
});

// Tunnels + throwaway TLDs are the bait-and-switch vector: content behind them can
// change AFTER review.
t("CNAME targets must not point at disallowed hosts (tunnels, throwaway TLDs, adult TLDs)", (t) => {
    files.forEach((file) => {
        const data = read(file);
        if (!data.records.CNAME) return;
        const target = data.records.CNAME.toLowerCase();
        disallowedCnames.forEach((suffix) => {
            t.false(
                target.endsWith(suffix) || target === suffix.slice(1),
                `${file}: CNAME target "${target}" matches disallowed suffix "${suffix}"`
            );
        });
    });
    t.pass();
});

t("Brand-impersonation and phishing-pattern names are rejected", (t) => {
    const BRANDS = ["paypal","google","microsoft","apple","amazon","facebook","instagram","whatsapp",
        "netflix","github","cloudflare","stripe","coinbase","binance","visa","mastercard","steam",
        "discord","telegram","roblox","minecraft","openai","chatgpt","anthropic","gemini","tesla"];
    const PHISH = ["login","signin","signup","verify","secure","wallet","billing","banking","payment",
        "password","recovery","unlock","confirm","helpdesk","invoice","refund"];
    const LEET = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s" };
    const normalize = (s) => s.toLowerCase().replace(/[013457 8@$]/g, (c) => LEET[c] || c);
    files.forEach((file) => {
        const sub = file.replace(/\.json$/, "");
        const tokens = normalize(sub).split(/[-_.]+/).filter(Boolean);
        tokens.forEach((tok) => {
            t.false(BRANDS.includes(tok), `${file}: "${sub}" contains protected brand token "${tok}"`);
        });
        const phishy = tokens.some((x) => PHISH.includes(x));
        t.false(phishy && tokens.length >= 2,
            `${file}: "${sub}" matches a phishing naming pattern — needs maintainer override`);
    });
    t.pass();
});

t("Reserved subdomains cannot be registered", (t) => {
    files.forEach((file) => {
        const sub = file.replace(/\.json$/, "");
        const root = sub.split(".").pop();
        t.false(reserved.includes(sub), `${file}: "${sub}" is a reserved name`);
        t.false(reserved.includes(root), `${file}: root "${root}" is a reserved name`);
        t.false(internal.includes(sub), `${file}: "${sub}" is managed by stacey.io`);
        t.false(internal.includes(root), `${file}: root "${root}" is managed by stacey.io`);
    });
    t.pass();
});

t("Nested subdomains require an existing parent owned by the same user", (t) => {
    files.forEach((file) => {
        const sub = file.replace(/\.json$/, "");
        if (!sub.includes(".")) return;
        const parent = sub.split(".").slice(1).join(".");
        const parentFile = `${parent}.json`;
        t.true(files.includes(parentFile), `${file}: parent "${parent}" is not registered`);
        if (files.includes(parentFile)) {
            const childOwner = read(file).owner.username.toLowerCase();
            const parentOwner = read(parentFile).owner.username.toLowerCase();
            t.is(childOwner, parentOwner, `${file}: owner must match parent's owner`);
        }
    });
    t.pass();
});

t("Users are limited to 4 subdomains", (t) => {
    const byOwner = {};
    files.forEach((file) => {
        const owner = read(file).owner.username.toLowerCase();
        byOwner[owner] = (byOwner[owner] || 0) + 1;
    });
    Object.entries(byOwner).forEach(([owner, count]) => {
        t.true(count <= 4, `${owner} has ${count} subdomains (max 4)`);
    });
    t.pass();
});

t("Users are limited to one single-character subdomain", (t) => {
    const byOwner = {};
    files.forEach((file) => {
        const sub = file.replace(/\.json$/, "");
        if (sub.length !== 1) return;
        const owner = read(file).owner.username.toLowerCase();
        byOwner[owner] = (byOwner[owner] || 0) + 1;
    });
    Object.entries(byOwner).forEach(([owner, count]) => {
        t.true(count <= 1, `${owner} has ${count} single-character subdomains (max 1)`);
    });
    t.pass();
});
