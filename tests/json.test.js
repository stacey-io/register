// Schema + hygiene tests for every file in domains/
import t from "ava";
import fs from "fs-extra";
import path from "path";

const domainsPath = path.resolve("domains");
const files = fs.readdirSync(domainsPath).filter((f) => f.endsWith(".json"));

const requiredKeys = ["owner", "records"];
const optionalKeys = ["proxied", "stacey", "description", "repo"];
const allowedKeys = [...requiredKeys, ...optionalKeys];

const hostnameRegex =
    /^(?=.{1,253}$)(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])\.)+[a-zA-Z]{2,63}$/;

function read(file) {
    return fs.readJsonSync(path.join(domainsPath, file));
}

t("All domain files must be valid JSON", (t) => {
    files.forEach((file) => {
        t.notThrows(() => read(file), `${file}: Invalid JSON`);
    });
    t.pass();
});

t("Filenames must be valid subdomain labels", (t) => {
    files.forEach((file) => {
        const sub = file.replace(/\.json$/, "");
        t.regex(
            sub,
            /^_?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/,
            `${file}: subdomain must be lowercase alphanumeric with hyphens`
        );
        t.true(sub.length <= 63 || sub.includes("."), `${file}: label too long (max 63 chars)`);
    });
    t.pass();
});

t("All files must have required keys and no unknown keys", (t) => {
    files.forEach((file) => {
        const data = read(file);
        requiredKeys.forEach((key) => t.true(key in data, `${file}: missing required key "${key}"`));
        Object.keys(data).forEach((key) =>
            t.true(allowedKeys.includes(key), `${file}: unknown key "${key}"`)
        );
    });
    t.pass();
});

t("Owner must have a GitHub username (email optional but must be valid if present)", (t) => {
    files.forEach((file) => {
        const data = read(file);
        t.truthy(data.owner?.username, `${file}: owner.username is required`);
        const email = data.owner?.email;
        if (email !== undefined && email !== "") {
            t.regex(
                String(email),
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                `${file}: owner.email, when present, must be a valid email`
            );
        }
        t.not(
            data.owner.username,
            "your-github-username",
            `${file}: replace the placeholder username from example.json`
        );
    });
    t.pass();
});

t("stacey block, when present, must be valid", (t) => {
    files.forEach((file) => {
        const data = read(file);
        if (!("stacey" in data)) return;
        t.is(typeof data.stacey, "object", `${file}: stacey must be an object`);
        t.is(typeof data.stacey.assistant, "boolean", `${file}: stacey.assistant must be true or false`);
        const allowed = ["assistant", "prompt"];
        Object.keys(data.stacey).forEach((k) =>
            t.true(allowed.includes(k), `${file}: unknown stacey key "${k}" — site_id and keys are provisioned server-side, never in this repo`)
        );
    });
    t.pass();
});

t("stacey.prompt, when present, must be a sane persona string", (t) => {
    const MAX_PROMPT_LENGTH = 500;
    files.forEach((file) => {
        const data = read(file);
        const prompt = data.stacey?.prompt;
        if (prompt === undefined) return;

        t.is(typeof prompt, "string", `${file}: stacey.prompt must be a string`);
        t.true(
            prompt.length > 0 && prompt.length <= MAX_PROMPT_LENGTH,
            `${file}: stacey.prompt must be 1-${MAX_PROMPT_LENGTH} characters (currently ${prompt.length})`
        );
        t.is(
            data.stacey.assistant,
            true,
            `${file}: stacey.prompt requires stacey.assistant to be true`
        );
        t.false(
            /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(prompt),
            `${file}: stacey.prompt contains control characters`
        );
        // The prompt is layered UNDER stacey's base rules at the proxy, so it can't
        // grant itself powers — but block the obvious impersonation vector anyway.
        t.false(
            /ignore (all )?(previous|prior|above)|you are (now )?stacey('s)? (admin|staff|system)/i.test(prompt),
            `${file}: stacey.prompt contains disallowed override/impersonation phrasing`
        );
    });
    t.pass();
});

// THE MOST IMPORTANT TEST IN THIS FILE.
// This is a public repo. People WILL paste secrets by accident. Catch them in CI
// before they're immortalized in git history.
t("No file may contain anything that looks like an API key or secret", (t) => {
    const secretPatterns = [
        /sk-[A-Za-z0-9_-]{16,}/,          // OpenAI / Anthropic style
        /AIza[0-9A-Za-z_-]{30,}/,         // Google API keys
        /gsk_[A-Za-z0-9]{20,}/,           // Groq
        /hf_[A-Za-z0-9]{20,}/,            // Hugging Face
        /ghp_[A-Za-z0-9]{20,}/,           // GitHub PAT
        /github_pat_[A-Za-z0-9_]{20,}/,   // GitHub fine-grained PAT
        /(api[_-]?key|apikey|secret|token|password)["']?\s*[:=]/i
    ];

    files.forEach((file) => {
        const raw = fs.readFileSync(path.join(domainsPath, file), "utf8");
        secretPatterns.forEach((pattern) => {
            t.false(
                pattern.test(raw),
                `${file}: contains what looks like a secret/API key (${pattern}). NEVER put keys in this repo — add them at stacey.io/dashboard instead. If a real key leaked, revoke it NOW: this repo is public and scraped constantly.`
            );
        });
    });
    t.pass();
});
