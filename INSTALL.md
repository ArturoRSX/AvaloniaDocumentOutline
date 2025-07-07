# Instalación de AXAML Outline

## Instalación desde archivo VSIX

1. Descarga el archivo `axaml-document-outline-0.1.6.vsix` desde los releases
2. Abre VS Code
3. Abre la paleta de comandos (`Ctrl+Shift+P`)
4. Ejecuta el comando: `Extensions: Install from VSIX...`
5. Selecciona el archivo descargado
6. Reinicia VS Code si es necesario

## Instalación desde línea de comandos

```bash
code --install-extension axaml-document-outline-0.1.6.vsix
```

## Verificación de instalación

1. Abre un archivo `.axaml` en VS Code
2. Ve al panel "Outline" (Vista → Outline)
3. Deberías ver la estructura jerárquica de tu archivo AXAML

## Comandos disponibles

- `Ctrl+Shift+O`: Navegar a elemento AXAML
- `Ctrl+Shift+I`: Mostrar información del elemento
- `Ctrl+Shift+L`: Alternar números de línea en outline
