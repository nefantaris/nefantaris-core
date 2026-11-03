export type Severity = "error" | "advice";

export const ruleSeverities = {
    "site/parse": "error",
    "meta/no-url": "advice",
    "meta/no-og-image": "advice",
    "meta/description-missing": "advice",
    "meta/description-short": "advice",
    "meta/description-long": "advice",
    "links/broken-link": "error",
    "images/missing-file": "error",
    "images/not-webp": "advice",
    "images/large-file": "advice",
    "images/large-dimensions": "advice",
    "images/unreferenced-asset": "advice",
    "a11y/empty-alt": "advice",
    "a11y/heading-skip": "advice",
    "a11y/vague-link-text": "advice",
} as const satisfies Record<string, Severity>;

export type RuleId = keyof typeof ruleSeverities;

export type FindingLocation = {
    file: string;
    key?: string;
};

export type Finding = {
    severity: Severity;
    rule: RuleId;
    message: string;
    file: string;
    key?: string;
};

export const finding = (
    rule: RuleId,
    { file, key }: FindingLocation,
    message: string
): Finding => {
    const result: Finding = {
        severity: ruleSeverities[rule],
        rule,
        message,
        file,
    };
    if (key !== undefined) result.key = key;
    return result;
};
