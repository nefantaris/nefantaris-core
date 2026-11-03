import { a11yFindings } from "./a11y.js";
import { checkContext, type LoadedSite } from "./context.js";
import { imageFindings } from "./images.js";
import { linkFindings } from "./links.js";
import { metaFindings } from "./meta.js";
import { doctorReport, type DoctorReport } from "./report.js";

export { configFileName, type LoadedSite } from "./context.js";
export { parseFailureFinding } from "./parseFailure.js";
export { doctorReport, formatReport, type DoctorReport } from "./report.js";

export const checkSite = async (site: LoadedSite): Promise<DoctorReport> => {
    const context = await checkContext(site);
    return doctorReport([
        ...metaFindings(context),
        ...linkFindings(context),
        ...(await imageFindings(context)),
        ...a11yFindings(context),
    ]);
};
