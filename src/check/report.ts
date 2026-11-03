import type { Finding, Severity } from "./rules.js";

export type DoctorReport = {
    contract: number;
    errors: number;
    advice: number;
    findings: Finding[];
};

const reportContract = 1;

const groups = [
    { namespace: "site", title: "Site" },
    { namespace: "meta", title: "Meta" },
    { namespace: "links", title: "Links" },
    { namespace: "images", title: "Images" },
    { namespace: "a11y", title: "Accessibility" },
];

const severityOrder: Severity[] = ["error", "advice"];

const namespaceOf = (finding: Finding): string =>
    finding.rule.slice(0, finding.rule.indexOf("/"));

const groupIndex = (finding: Finding): number =>
    groups.findIndex((group) => group.namespace === namespaceOf(finding));

const compareFindings = (first: Finding, second: Finding): number =>
    severityOrder.indexOf(first.severity) -
        severityOrder.indexOf(second.severity) ||
    groupIndex(first) - groupIndex(second) ||
    first.file.localeCompare(second.file) ||
    first.rule.localeCompare(second.rule);

const findingIdentity = (finding: Finding): string =>
    JSON.stringify([finding.rule, finding.file, finding.key, finding.message]);

const distinct = (findings: Finding[]): Finding[] => {
    const seen = new Set<string>();
    return findings.filter((finding) => {
        const identity = findingIdentity(finding);
        if (seen.has(identity)) {
            return false;
        }
        seen.add(identity);
        return true;
    });
};

export const doctorReport = (findings: Finding[]): DoctorReport => {
    const ordered = distinct(findings).sort(compareFindings);
    return {
        contract: reportContract,
        errors: ordered.filter((finding) => finding.severity === "error")
            .length,
        advice: ordered.filter((finding) => finding.severity === "advice")
            .length,
        findings: ordered,
    };
};

const plural = (count: number, singular: string, pluralForm: string): string =>
    `${String(count)} ${count === 1 ? singular : pluralForm}`;

export const reportSummary = ({ errors, advice }: DoctorReport): string =>
    `${plural(errors, "error", "errors")}, ${String(advice)} advice`;

const findingLine = (finding: Finding): string => {
    const location =
        finding.key === undefined
            ? finding.file
            : `${finding.file} (${finding.key})`;
    return `  ${finding.severity.padEnd(6)}  ${location}: ${finding.message} [${finding.rule}]`;
};

export const formatReport = (report: DoctorReport): string => {
    if (report.findings.length === 0) {
        return "No problems found.";
    }
    const sections = groups.flatMap((group) => {
        const lines = report.findings
            .filter((finding) => namespaceOf(finding) === group.namespace)
            .map(findingLine);
        return lines.length === 0 ? [] : [[group.title, ...lines].join("\n")];
    });
    return [...sections, reportSummary(report)].join("\n\n");
};
