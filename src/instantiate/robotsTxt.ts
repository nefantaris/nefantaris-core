import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { absoluteSiteUrl } from "../siteUrl.js";

const sitemapPath = "/sitemap.xml";

const robotsTxt = (siteUrl: string | undefined): string => {
    const lines = ["User-agent: *", "Allow: /"];
    if (siteUrl !== undefined) {
        lines.push("", `Sitemap: ${absoluteSiteUrl(siteUrl, sitemapPath)}`);
    }
    return `${lines.join("\n")}\n`;
};

export const writeRobotsTxt = async (
    nefantarisDir: string,
    siteUrl: string | undefined
): Promise<void> => {
    const publicDir = join(nefantarisDir, "public");
    await mkdir(publicDir, { recursive: true });
    await writeFile(join(publicDir, "robots.txt"), robotsTxt(siteUrl));
};
