const fallbackPackageName = "nefantaris-site";

const trimPackageNameEdges = (value: string): string =>
    value.replace(/^[._-]+/, "").replace(/[._-]+$/, "");

export const packageNameFrom = (name: string): string => {
    const slug = trimPackageNameEdges(
        name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")
    );
    return slug === "" ? fallbackPackageName : slug;
};
