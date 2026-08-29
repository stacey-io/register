// stacey.io zone-as-code (see LICENSE for third-party attributions)
//
// Every JSON file in ./domains becomes DNS records for <filename>.stacey.io.
// Deliberately supports a SMALLER record surface for v1:
// A, AAAA, CAA, CNAME, MX, TXT. (NS/DS delegation is a big abuse surface —
// add later only if genuinely needed.)

var domainName = "stacey.io";
var registrar = NewRegistrar("none");
var dnsProvider = DnsProvider(NewDnsProvider("cloudflare"));

function getDomainsList(filesPath) {
    var result = [];
    var files = glob.apply(null, [filesPath, true, ".json"]);

    for (var i = 0; i < files.length; i++) {
        var name = files[i]
            .split("/")
            .pop()
            .replace(/\.json$/, "");

        result.push({ name: name, data: require(files[i]) });
    }

    return result;
}

var domains = getDomainsList("./domains");
var records = [];

for (var subdomain in domains) {
    var subdomainName = domains[subdomain].name;
    var data = domains[subdomain].data;
    var proxyState = data.proxied ? CF_PROXY_ON : CF_PROXY_OFF;

    if (data.records.A) {
        for (var a in data.records.A) {
            records.push(A(subdomainName, IP(data.records.A[a]), proxyState));
        }
    }

    if (data.records.AAAA) {
        for (var aaaa in data.records.AAAA) {
            records.push(AAAA(subdomainName, data.records.AAAA[aaaa], proxyState));
        }
    }

    if (data.records.CAA) {
        for (var caa in data.records.CAA) {
            var caaRecord = data.records.CAA[caa];
            records.push(CAA(subdomainName, caaRecord.tag, caaRecord.value));
        }
    }

    if (data.records.CNAME) {
        records.push(ALIAS(subdomainName, data.records.CNAME + ".", proxyState));
    }

    if (data.records.MX) {
        for (var mx in data.records.MX) {
            var mxRecord = data.records.MX[mx];

            if (typeof mxRecord === "string") {
                records.push(MX(subdomainName, 10 + parseInt(mx), mxRecord + "."));
            } else {
                records.push(MX(subdomainName, parseInt(mxRecord.priority), mxRecord.target + "."));
            }
        }
    }

    if (data.records.TXT) {
        if (Array.isArray(data.records.TXT)) {
            for (var txt in data.records.TXT) {
                records.push(TXT(subdomainName, data.records.TXT[txt].length <= 255 ? "\"" + data.records.TXT[txt] + "\"" : data.records.TXT[txt]));
            }
        } else {
            records.push(TXT(subdomainName, data.records.TXT.length <= 255 ? "\"" + data.records.TXT + "\"" : data.records.TXT));
        }
    }
}

// Reserved names are actively black-holed (192.0.2.1 = TEST-NET-1) with the
// Cloudflare proxy ON, so nobody can squat or spoof them.
var reserved = require("./util/reserved.json");

for (var i = 0; i < reserved.length; i++) {
    records.push(A(reserved[i], IP("192.0.2.1"), CF_PROXY_ON));
}

// Zone last updated marker
records.push(TXT("_zone-updated", "\"" + Date.now().toString() + "\""));

// Records managed OUTSIDE this repo — user JSON can never clobber these.
var ignored = [
    IGNORE("@", "*"),                     // apex: stacey.io homepage + dashboard
    IGNORE("api", "*"),                   // widget proxy endpoint
    IGNORE("cdn", "*"),                   // widget JS delivery
    IGNORE("\\*", "A"),
    IGNORE("_acme-challenge", "TXT"),
    IGNORE("_dmarc", "TXT"),
    IGNORE("*._domainkey", "TXT"),
    IGNORE("_psl", "TXT")                 // Public Suffix List verification record
];

var internal = require("./util/internal.json");

internal.forEach(function (subdomain) {
    ignored.push(IGNORE(subdomain, "*"));
});

D(domainName, registrar, dnsProvider, records, ignored);
