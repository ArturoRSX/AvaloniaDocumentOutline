# AXAML Document Outline

Esta extensión de VS Code proporciona funcionalidad de **Document Outline** para archivos AXAML de Avalonia, mostrando una vista jerárquica en árbol de los elementos de la interfaz de usuario.

## Características

- 📋 **Análisis automático de archivos AXAML** - Extrae la jerarquía de elementos de UI automáticamente
- 🌳 **Vista de árbol jerárquica** - Muestra la estructura anidada de controles de Avalonia
- 🎯 **Navegación por clics** - Haz clic en cualquier elemento del outline para navegar al código
- 🏷️ **Nombres y tipos de elementos** - Muestra nombres (`x:Name`), contenido de botones, texto, etc.
- 🎨 **Iconos apropiados** - Diferentes iconos para ventanas, contenedores, botones, texto, etc.
- ⚡ **Soporte completo de elementos Avalonia** - Reconoce Window, Grid, StackPanel, Button, TextBlock, etc.

## Cómo usar

1. **Abre un archivo AXAML** en VS Code
2. **Ve al panel Outline** (View → Open View → "Outline") o presiona `Ctrl+Shift+O`
3. **Navega por la estructura** haciendo clic en los elementos del outline

## Elementos soportados

La extensión reconoce y categoriza estos tipos de elementos AXAML:

- **Ventanas y UserControls** - Mostrados como clases
- **Contenedores de layout** (Grid, StackPanel, Canvas, DockPanel, Border) - Mostrados como paquetes
- **Controles interactivos** (Button, CheckBox, RadioButton, Slider) - Mostrados como funciones
- **Controles de texto** (TextBlock, TextBox, Label) - Mostrados como strings
- **Listas y colecciones** (ListBox, ComboBox, DataGrid, TreeView) - Mostrados como arrays
- **Imágenes y media** (Image, MediaElement) - Mostrados como archivos

## Información mostrada

Para cada elemento, la extensión muestra:

- **Nombre del elemento** (usando `x:Name` o `Name` cuando está disponible)
- **Contenido del control** (para Button con `Content`, TextBlock con `Text`, etc.)
- **Tipo de control** (Grid, Button, etc.)

Ejemplo de cómo se muestran los elementos:
- `Button (PlayButton)` - Button con x:Name="PlayButton"
- `Button "Click Me"` - Button con Content="Click Me"
- `TextBlock "Hello World"` - TextBlock con Text="Hello World"
- `Grid` - Grid sin nombre específico

## Instalación para desarrollo

1. Clona este repositorio
2. Ejecuta `npm install` para instalar dependencias
3. Ejecuta `npm run compile` para compilar la extensión
4. Presiona `F5` para ejecutar la extensión en modo debug

## Desarrollado para

Esta extensión está específicamente diseñada para trabajar con:
- ✅ Archivos `.axaml` de Avalonia UI
- ✅ VS Code 1.101.0 o superior
- ✅ Proyectos multiplataforma de Avalonia

## Contribuir

Si encuentras algún problema o tienes sugerencias de mejora, por favor crea un issue en el repositorio del proyecto.

---

**¡Disfruta de una mejor experiencia navegando por tus archivos AXAML!** 🚀
