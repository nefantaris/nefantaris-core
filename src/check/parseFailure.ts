import { sep } from "node:path";
import { NefantarisError } from "../NefantarisError.js";
import { finding, type Finding, type FindingLocation } from "./rules.js";
import { sitePath } from "./siteFiles.js";

const fileSeparator = ": ";

const keyPattern = /^(?:frontmatter )?"([^"]+)"/;

type LocatedMessage = {
    file?: string;
    message: string;
};

const locateMessage = (message: string, siteDir: string): LocatedMessage => {
    const sitePrefix = `${siteDir}${sep}`;
    const separatorIndex = message.indexOf(fileSeparator, sitePrefix.length);
    if (!message.startsWith(sitePrefix) || separatorIndex === -1) {
        return { message: message.replaceAll(sitePrefix, "") };
    }
    return {
        file: sitePath(siteDir, message.slice(0, separatorIndex)),
        message: message
            .slice(separatorIndex + fileSeparator.length)
            .replaceAll(sitePrefix, ""),
    };
};

export const parseFailureFinding = (
    error: unknown,
    siteDir: string,
    fallback: FindingLocation
): Finding => {
    if (!(error instanceof NefantarisError)) {
        throw error;
    }
    const located = locateMessage(error.message, siteDir);
    const key = keyPattern.exec(located.message)?.[1];
    const location: FindingLocation =
        located.file === undefined ? { ...fallback } : { file: located.file };
    if (key !== undefined) {
        location.key = key;
    }
    return finding("site/parse", location, located.message);
};
