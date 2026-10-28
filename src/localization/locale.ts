export type UiLocale = 'en' | 'zh-cn';

/** Match the locale resources actually shipped for the VS Code host. */
export function resolveUiLocale(language: unknown): UiLocale {
    return typeof language === 'string' && language.toLowerCase() === 'zh-cn'
        ? 'zh-cn'
        : 'en';
}
