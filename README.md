# Neoscribe ✍️

Neoscribe is a high-performance, feature-rich Native application designed for handling and viewing text files and code with ease. Built with a focus on stability and speed, it leverages a custom-integrated native Editor to provide a smooth editing experience even for multi-megabyte files.

## 🚀 Key Features

- **Tabbed Interface**: Efficiently manage multiple documents simultaneously with a robust tab system that persists selection and scroll states flawlessly across switches.
- **File Viewer**: View and navigate through medium-large text files (MBs) without crashing or lag using a custom native text rendering engine.
- **Editor Integration**: A powerful, native-backed code editor for Android with support for themes, syntax highlighting, and advanced text manipulation.
- **Search, Replace & Jump**: Find specific text instantly within files. Includes a robust 'Replace' tool and a 'Jump to Line' feature for rapid navigation through many lines.
- **Advanced Selection Tools**: Precise text selection features tailored for large documents, including range-based selection.
- **Smart Loading States**: Intelligent loading guards that prevent UI instability during heavy document synchronization.
- **Advanced Export System**: Export your notes and files to various formats including:
  - **HTML**
  - **Plain Text**
  - and more
- **Copy, Share & Duplicate**: Quickly copy content to the clipboard, share text with other applications instantly, and use the 'Save as Copy' feature to create file variants effortlessly.
- **OCR Integration**: Built-in Text Recognition to extract text from images and documents.
- **Dynamic Theming**: Multiple gorgeous theme presets including dark, light, teal, and a special "Rainbow" effect.
- **Multi-Language Support**: Fully localized interface with support for multiple languages.

## 🛠️ Build & Installation

### Prerequisites

- Node.js & npm/yarn
- Android Studio & JDK 17+
- React Native Environment Setup

### Build

```bash
cd android
./gradlew assembleRelease
```

### Using Fastlane

Automate your build process using the included Fastlane configuration:

```bash
fastlane build
```

The generated APKs will be located at:
`android/app/build/outputs/apk/release/`

## 📁 Project Structure

- `src/components`: UI components including the Editor bridge.
- `src/services`: Core logic for file handling, export, and storage.
- `src/screens`: Main application screens (Home and Viewer).
- `android/`: Native Android modules for Editor, ML Kit OCR, and PDF generation.

## ⚖️ License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by the Neoscribe Team.
