import { useCallback, useSyncExternalStore } from "react";
import type { Mode, ModeSettings, ModeState } from "./types";

export const modeStorageKey = "nefantaris-mode";

const darkSchemeQuery = "(prefers-color-scheme: dark)";

const isAvailable = (
    settings: ModeSettings,
    value: string | null | undefined
): value is Mode => {
    const available: readonly (string | null | undefined)[] =
        settings.available;
    return available.includes(value);
};

const readStoredMode = (): string | null => {
    try {
        return localStorage.getItem(modeStorageKey);
    } catch {
        return null;
    }
};

const writeStoredMode = (mode: Mode): void => {
    try {
        localStorage.setItem(modeStorageKey, mode);
    } catch {
        return;
    }
};

const applyMode = (mode: Mode): void => {
    document.documentElement.dataset.mode = mode;
};

const lightOrFirstAvailable = (settings: ModeSettings): Mode =>
    isAvailable(settings, "light") ? "light" : settings.available[0];

const prerenderedMode = (settings: ModeSettings): Mode =>
    settings.default === "system"
        ? lightOrFirstAvailable(settings)
        : settings.default;

const systemMode = (settings: ModeSettings): Mode =>
    isAvailable(settings, "dark") &&
    globalThis.matchMedia(darkSchemeQuery).matches
        ? "dark"
        : lightOrFirstAvailable(settings);

const appliedMode = (settings: ModeSettings): Mode => {
    const applied = document.documentElement.dataset.mode;
    return isAvailable(settings, applied) ? applied : prerenderedMode(settings);
};

const subscribeToMode = (
    settings: ModeSettings,
    onChange: () => void
): (() => void) => {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-mode"],
    });
    const scheme = globalThis.matchMedia(darkSchemeQuery);
    const followSystem = (): void => {
        if (
            settings.default === "system" &&
            !isAvailable(settings, readStoredMode())
        ) {
            applyMode(systemMode(settings));
        }
    };
    const followOtherTabs = (event: StorageEvent): void => {
        if (
            event.key === modeStorageKey &&
            isAvailable(settings, event.newValue)
        ) {
            applyMode(event.newValue);
        }
    };
    scheme.addEventListener("change", followSystem);
    globalThis.addEventListener("storage", followOtherTabs);
    return () => {
        observer.disconnect();
        scheme.removeEventListener("change", followSystem);
        globalThis.removeEventListener("storage", followOtherTabs);
    };
};

export const useModeState = (settings: ModeSettings): ModeState => {
    const subscribe = useCallback(
        (onChange: () => void) => subscribeToMode(settings, onChange),
        [settings]
    );
    const current = useSyncExternalStore(
        subscribe,
        () => appliedMode(settings),
        () => prerenderedMode(settings)
    );
    const set = (mode: Mode): void => {
        if (!isAvailable(settings, mode)) {
            return;
        }
        writeStoredMode(mode);
        applyMode(mode);
    };
    return { available: settings.available, current, set };
};
