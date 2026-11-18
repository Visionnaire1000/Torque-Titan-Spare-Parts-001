import argostranslate.package


SUPPORTED_LANGUAGES = [
    "en",
    "fr",
    "zh",
    "hi",
    "es",
    "pt",
    "de",
    "it",
    "ja",
    "ko",
    "ru",
    "tr",
    "nl",
]


LANGUAGE_PAIRS = [
    (source, target)
    for language in SUPPORTED_LANGUAGES
    if language != "en"
    for source, target in [
        ("en", language),
        (language, "en"),
    ]
]


def install_language_models():
    print("Updating Argos Translate package index...")

    try:
        argostranslate.package.update_package_index()

        available_packages = (
            argostranslate.package.get_available_packages()
        )

    except Exception as exc:
        print(f"Failed to update Argos Translate package index: {exc}")
        return

    for source_language, target_language in LANGUAGE_PAIRS:
        package = next(
            (
                item
                for item in available_packages
                if item.from_code == source_language
                and item.to_code == target_language
            ),
            None,
        )

        if package is None:
            print(
                f"Model unavailable: "
                f"{source_language} -> {target_language}"
            )
            continue

        print(
            f"Downloading "
            f"{source_language} -> {target_language}..."
        )

        try:
            download_path = package.download()

            argostranslate.package.install_from_path(
                download_path
            )

            print(
                f"Successfully installed "
                f"{source_language} -> {target_language}"
            )

        except Exception as exc:
            print(
                f"Installation failed for "
                f"{source_language} -> {target_language}: {exc}"
            )


if __name__ == "__main__":
    install_language_models()
