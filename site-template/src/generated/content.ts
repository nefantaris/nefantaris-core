import type {
    ModeSettings,
    NavItem,
    PostSummary,
    RouteEntry,
    SiteMeta,
} from "../nefantaris/types";

export const site: SiteMeta = { name: "Nefantaris" };

export const nav: NavItem[] = [];

export const routes: RouteEntry[] = [];

export const posts: PostSummary[] = [];

export const modeSettings: ModeSettings = {
    available: ["light"],
    default: "light",
};
