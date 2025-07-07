# Avalonia Document Outline

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/LegendTheDeveloper.avalonia-document-outline?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=LegendTheDeveloper.avalonia-document-outline)

This VS Code extension provides **Document Outline** functionality for Avalonia AXAML files, displaying a hierarchical tree view of your user interface elements.

![image](https://github.com/user-attachments/assets/d52a67f8-e5bf-409a-bd57-70b4f9f3e897)

## Features

* 📋 **Automatic AXAML file parsing** – Extracts the UI element hierarchy automatically
* 🌳 **Hierarchical tree view** – Shows the nested structure of Avalonia controls
* 🎯 **Click-to-navigate** – Click any item in the outline to jump to its code
* 🏷️ **Element names and types** – Displays names (`x:Name`), button content, text, etc.
* 🎨 **Appropriate icons** – Different icons for windows, containers, buttons, text, and more
* ⚡ **Full Avalonia element support** – Recognizes Window, Grid, StackPanel, Button, TextBlock, and more

## How to Use

1. **Open an AXAML file** in VS Code
2. **Go to the Outline panel** (View → Open View → "Outline") or press `Ctrl+Shift+O`
3. **Browse the structure** by clicking elements in the outline

## Supported Elements

The extension recognizes and categorizes these AXAML element types:

* **Windows and UserControls** – Displayed as classes
* **Layout containers** (Grid, StackPanel, Canvas, DockPanel, Border) – Displayed as packages
* **Interactive controls** (Button, CheckBox, RadioButton, Slider) – Displayed as functions
* **Text controls** (TextBlock, TextBox, Label) – Displayed as strings
* **Lists and collections** (ListBox, ComboBox, DataGrid, TreeView) – Displayed as arrays
* **Images and media** (Image, MediaElement) – Displayed as files

## Displayed Information

For each element, the extension shows:

* **Element name** (using `x:Name` or `Name` if available)
* **Control content** (for Button with `Content`, TextBlock with `Text`, etc.)
* **Control type** (Grid, Button, etc.)

Example of how elements are displayed:

* `Button (PlayButton)` – Button with x\:Name="PlayButton"
* `Button "Click Me"` – Button with Content="Click Me"
* `TextBlock "Hello World"` – TextBlock with Text="Hello World"
* `Grid` – Grid without a specific name

## Development Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press `F5` to launch the extension in debug mode

## Designed For

This extension is specifically built to work with:

* ✅ Avalonia UI `.axaml` files
* ✅ VS Code 1.101.0 or higher
* ✅ Avalonia cross-platform projects

## Contributing

If you find any issues or have suggestions for improvements, please create an issue in the project repository.

---

**Enjoy a better way to navigate your Avalonia AXAML files!** 🚀
