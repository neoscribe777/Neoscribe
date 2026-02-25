package com.neoscribe

enum class AssetsTheme(
    val themeId: String,
    val themeName: String,
    val themeUri: String,
) {
    THEME_DARCULA(
        themeId = "darcula",
        themeName = "Darcula",
        themeUri = "file:///android_asset/themes/darcula.json",
    ),
    THEME_ECLIPSE(
        themeId = "eclipse",
        themeName = "Eclipse",
        themeUri = "file:///android_asset/themes/eclipse.json",
    ),
    THEME_MONOKAI(
        themeId = "monokai",
        themeName = "Monokai",
        themeUri = "file:///android_asset/themes/monokai.json",
    ),
    THEME_OBSIDIAN(
        themeId = "obsidian",
        themeName = "Obsidian",
        themeUri = "file:///android_asset/themes/obsidian.json",
    ),
    THEME_INTELLIJ_LIGHT(
        themeId = "intellij_light",
        themeName = "IntelliJ Light",
        themeUri = "file:///android_asset/themes/intellij_light.json",
    ),
    THEME_LADIES_NIGHT(
        themeId = "ladies_night",
        themeName = "Ladies Night",
        themeUri = "file:///android_asset/themes/ladies_night.json",
    ),
    THEME_TOMORROW_NIGHT(
        themeId = "tomorrow_night",
        themeName = "Tomorrow Night",
        themeUri = "file:///android_asset/themes/tomorrow_night.json",
    ),
    THEME_SOLARIZED_LIGHT(
        themeId = "solarized_light",
        themeName = "Solarized Light",
        themeUri = "file:///android_asset/themes/solarized_light.json",
    ),
    THEME_VISUAL_STUDIO(
        themeId = "visual_studio",
        themeName = "Visual Studio",
        themeUri = "file:///android_asset/themes/visual_studio.json",
    ),
    THEME_TEAL_DARK(
        themeId = "teal_dark",
        themeName = "Teal Dark",
        themeUri = "file:///android_asset/themes/teal_dark.json",
    ),
    THEME_TEAL_LIGHT(
        themeId = "teal_light",
        themeName = "Teal Light",
        themeUri = "file:///android_asset/themes/teal_light.json",
    ),
    THEME_PAPER_TEAL(
        themeId = "paper_teal",
        themeName = "Paper Teal",
        themeUri = "file:///android_asset/themes/paper_teal.json",
    ),
    THEME_PURE_TEAL(
        themeId = "pure_teal",
        themeName = "Pure Teal",
        themeUri = "file:///android_asset/themes/pure_teal.json",
    ),
    THEME_IRIDESCENT(
        themeId = "iridescent",
        themeName = "Iridescent",
        themeUri = "file:///android_asset/themes/ladies_night.json", // Fallback to ladies night properties
    );

    companion object {

        fun find(id: String): AssetsTheme? {
            val normalizedId = id.lowercase().replace(" ", "_").replace("-", "_")
            return entries.find { it.themeId == normalizedId }
        }
    }
}
