import * as vscode from 'vscode';

// Global variable to track activation state
let isExtensionActivated = false;
let activationTimestamp: string | null = null;

// Global variables to track outline selection
let currentAxamlElements: AxamlElement[] = [];
let currentDocument: vscode.TextDocument | null = null;
let showLineNumbers = true; // Toggle for line numbers

/**
 * Interface representing an AXAML element
 */
interface AxamlElement {
    name: string;
    tagName: string;
    attributes: Map<string, string>;
    children: AxamlElement[];
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
}

/**
 * AXAML Document Symbol Provider
 * Provides document outline functionality for Avalonia AXAML files
 */
class AxamlDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    
    /**
     * Provide document symbols for AXAML files
     */
    public provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        
        const timestamp = new Date().toISOString();
        console.log(`🔍 [${timestamp}] Document symbol provider called for: ${document.fileName}`);
        console.log(`📄 Language ID: ${document.languageId}`);
        console.log(`📝 File extension: ${document.fileName.split('.').pop()}`);
        console.log(`📁 File URI: ${document.uri.toString()}`);
        console.log(`🔢 Document version: ${document.version}`);
        console.log(`📏 Document length: ${document.getText().length} characters`);
        
        if (token.isCancellationRequested) {
            console.log('❌ Token cancelled');
            return [];
        }

        // Check if this is actually an AXAML file
        const isAxamlFile = document.fileName.toLowerCase().endsWith('.axaml') || 
                           document.languageId === 'axaml' ||
                           document.getText().includes('xmlns="https://github.com/avaloniaui"');
        
        console.log(`🎯 Is AXAML file: ${isAxamlFile}`);
        
        if (!isAxamlFile) {
            console.log('⚠️ File does not appear to be AXAML, skipping...');
            return [];
        }

        try {
            const text = document.getText();
            console.log(`📊 Processing document with ${text.length} characters`);
            
            const elements = this.parseAxaml(text);
            console.log(`🌳 Parsed ${elements.length} root elements`);
            
            const symbols = this.convertToDocumentSymbols(elements, document);
            console.log(`✅ Generated ${symbols.length} document symbols`);
            
            // Log the symbols for debugging
            symbols.forEach((symbol, index) => {
                console.log(`  📋 Symbol ${index + 1}: ${symbol.name} (${symbol.kind}) - children: ${symbol.children.length}`);
            });
            
            return symbols;
        } catch (error) {
            console.error('❌ Error parsing AXAML:', error);
            console.error('Stack trace:', (error as Error).stack);
            vscode.window.showErrorMessage(`Error parsing AXAML: ${error}`);
            return [];
        }
    }

    /**
     * Parse AXAML content and extract UI elements
     */
    public parseAxaml(text: string): AxamlElement[] {
        const elements: AxamlElement[] = [];
        const lines = text.split('\n');
        const stack: AxamlElement[] = [];

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const trimmedLine = line.trim();

            // Skip comments, empty lines, and XML declarations
            if (trimmedLine.startsWith('<!--') || 
                trimmedLine.startsWith('<?xml') || 
                trimmedLine === '' ||
                trimmedLine.startsWith('</')
               ) {
                continue;
            }

            // Handle multi-line tags - check if line contains opening tag
            const tagMatch = trimmedLine.match(/<([a-zA-Z][a-zA-Z0-9.:_-]*)/);
            if (tagMatch) {
                const tagName = tagMatch[1];
                
                // Skip property definition tags like Grid.RowDefinitions, Grid.ColumnDefinitions, etc.
                if (tagName.includes('.')) {
                    continue;
                }
                
                // Skip definition containers that are not visual elements
                const definitionTags = [
                    'RowDefinitions', 
                    'ColumnDefinitions', 
                    'RowDefinition', 
                    'ColumnDefinition',
                    'Resources',
                    'Styles',
                    'Style',
                    'Setter',
                    'Triggers',
                    'DataTemplates',
                    'ControlThemes'
                ];
                
                if (definitionTags.includes(tagName)) {
                    console.log(`⏭️ Skipping definition tag: ${tagName}`);
                    continue;
                }

                // Collect all content for this tag (might span multiple lines)
                let fullTagContent = line;
                let currentLineIndex = lineIndex;
                
                // If tag doesn't end on same line, collect until it does
                while (!fullTagContent.includes('>') && currentLineIndex < lines.length - 1) {
                    currentLineIndex++;
                    fullTagContent += ' ' + lines[currentLineIndex].trim();
                }

                console.log(`🏗️ Processing tag: ${tagName}`);
                console.log(`📄 Full tag content: "${fullTagContent}"`);

                const isSelfClosing = fullTagContent.includes('/>');
                
                // Better regex to extract attributes - get everything between tag name and closing >
                const attributesMatch = fullTagContent.match(new RegExp(`<${tagName}\\s+([^>]*?)\\s*/?>`));
                const attributesStr = attributesMatch ? attributesMatch[1].trim() : '';
                
                console.log(`📝 Extracted attributes string: "${attributesStr}"`);

                const element: AxamlElement = {
                    name: this.getElementDisplayName(tagName, attributesStr),
                    tagName: tagName,
                    attributes: this.parseAttributes(attributesStr),
                    children: [],
                    startLine: lineIndex,
                    endLine: currentLineIndex,
                    startColumn: line.indexOf('<'),
                    endColumn: lines[currentLineIndex].length
                };

                if (stack.length === 0) {
                    elements.push(element);
                } else {
                    stack[stack.length - 1].children.push(element);
                }

                if (!isSelfClosing) {
                    stack.push(element);
                }

                // Update line index to account for multi-line parsing
                lineIndex = currentLineIndex;
                continue;
            }

            // Handle closing tags
            const closeTagMatch = trimmedLine.match(/^<\/([a-zA-Z][a-zA-Z0-9.:_-]*)\s*>$/);
            if (closeTagMatch && stack.length > 0) {
                const closedElement = stack.pop();
                if (closedElement) {
                    closedElement.endLine = lineIndex;
                    closedElement.endColumn = line.length;
                }
            }
        }

        return elements;
    }

    /**
     * Parse attributes from attribute string
     */
    private parseAttributes(attributeStr: string): Map<string, string> {
        const attributes = new Map<string, string>();
        
        console.log(`🔍 Parsing attributes from: "${attributeStr}"`);
        
        // Clean up the attribute string - remove extra whitespace and newlines
        const cleanedStr = attributeStr.replace(/\s+/g, ' ').trim();
        console.log(`🧹 Cleaned attribute string: "${cleanedStr}"`);
        
        // Match attribute="value" or attribute='value'
        const attrRegex = /([a-zA-Z][a-zA-Z0-9.:_-]*)\s*=\s*["']([^"']*)["']/g;
        let match;
        
        while ((match = attrRegex.exec(cleanedStr)) !== null) {
            const key = match[1];
            const value = match[2];
            attributes.set(key, value);
            console.log(`  📋 Found attribute: ${key} = "${value}"`);
        }
        
        console.log(`📊 Total attributes found: ${attributes.size}`);
        return attributes;
    }

    /**
     * Get display name for element based on tag name and attributes
     */
    private getElementDisplayName(tagName: string, attributesStr: string): string {
        console.log(`🏷️ Getting display name for: ${tagName}`);
        console.log(`📝 Attributes string: "${attributesStr}"`);
        
        const attributes = this.parseAttributes(attributesStr);
        console.log(`🗂️ Parsed attributes:`, Array.from(attributes.entries()));
        
        // Try to use x:Name or Name attribute
        const xName = attributes.get('x:Name');
        const name = attributes.get('Name');
        
        console.log(`🎯 x:Name: "${xName}", Name: "${name}"`);
        
        let displayName = '';
        
        // If we have x:Name or Name, just show the name (no brackets)
        if (xName) {
            console.log(`✅ Using x:Name only: ${xName}`);
            displayName = xName;
        } else if (name) {
            console.log(`✅ Using Name only: ${name}`);
            displayName = name;
        } else {
            // For controls without names, show [type] with additional info if available
            if (tagName === 'Button') {
                const content = attributes.get('Content');
                if (content) {
                    console.log(`✅ Using Button Content: [Button "${content}"]`);
                    displayName = `[Button "${content}"]`;
                } else {
                    displayName = `[${tagName}]`;
                }
            } else if (tagName === 'TextBlock') {
                const text = attributes.get('Text');
                if (text) {
                    console.log(`✅ Using TextBlock Text: [TextBlock "${text}"]`);
                    displayName = `[TextBlock "${text}"]`;
                } else {
                    displayName = `[${tagName}]`;
                }
            } else {
                // For elements without names, show [TagName]
                console.log(`⚪ Using bracketed name: [${tagName}]`);
                displayName = `[${tagName}]`;
            }
        }
        
        return displayName;
    }

    /**
     * Convert parsed elements to VS Code DocumentSymbols
     */
    private convertToDocumentSymbols(elements: AxamlElement[], document: vscode.TextDocument): vscode.DocumentSymbol[] {
        return elements.map(element => this.createDocumentSymbol(element, document));
    }

    /**
     * Create a DocumentSymbol from an AxamlElement
     */
    private createDocumentSymbol(element: AxamlElement, document: vscode.TextDocument): vscode.DocumentSymbol {
        const range = new vscode.Range(
            new vscode.Position(element.startLine, element.startColumn),
            new vscode.Position(element.endLine, element.endColumn)
        );
        
        const selectionRange = new vscode.Range(
            new vscode.Position(element.startLine, element.startColumn),
            new vscode.Position(element.startLine, element.startColumn + element.tagName.length + 1)
        );

        // Get the clean display name without line numbers
        const displayName = this.getElementDisplayName(element.tagName, '');
        const cleanName = this.getCleanElementDisplayName(element);
        
        // Create detail string with line number if enabled
        let detail = element.tagName;
        if (showLineNumbers) {
            detail = `${element.tagName} (Line ${element.startLine + 1})`;
        }

        const symbol = new vscode.DocumentSymbol(
            cleanName, // Clean name without line numbers
            detail, // Type and line number in gray italics
            this.getSymbolKind(element.tagName),
            range,
            selectionRange
        );

        // Add children recursively
        symbol.children = element.children.map(child => this.createDocumentSymbol(child, document));

        return symbol;
    }

    /**
     * Get clean display name without line numbers for use in DocumentSymbol
     */
    private getCleanElementDisplayName(element: AxamlElement): string {
        const attributes = element.attributes;
        const xName = attributes.get('x:Name');
        const name = attributes.get('Name');
        
        if (xName) {
            return xName;
        } else if (name) {
            return name;
        } else {
            // For controls without names, show [type] with additional info if available
            if (element.tagName === 'Button') {
                const content = attributes.get('Content');
                if (content) {
                    return `[Button "${content}"]`;
                } else {
                    return `[${element.tagName}]`;
                }
            } else if (element.tagName === 'TextBlock') {
                const text = attributes.get('Text');
                if (text) {
                    return `[TextBlock "${text}"]`;
                } else {
                    return `[${element.tagName}]`;
                }
            } else {
                return `[${element.tagName}]`;
            }
        }
    }

    /**
     * Map AXAML element types to VS Code SymbolKind
     */
    private getSymbolKind(tagName: string): vscode.SymbolKind {
        const lowerTagName = tagName.toLowerCase();
        
        // Window and UserControl
        if (lowerTagName.includes('window') || lowerTagName.includes('usercontrol')) {
            return vscode.SymbolKind.Class;
        }
        
        // Layout containers
        if (lowerTagName.includes('grid') || lowerTagName.includes('stackpanel') || 
            lowerTagName.includes('canvas') || lowerTagName.includes('dockpanel') ||
            lowerTagName.includes('wrappanel') || lowerTagName.includes('border')) {
            return vscode.SymbolKind.Package;
        }
        
        // Buttons and interactive controls
        if (lowerTagName.includes('button') || lowerTagName.includes('checkbox') ||
            lowerTagName.includes('radiobutton') || lowerTagName.includes('slider')) {
            return vscode.SymbolKind.Function;
        }
        
        // Text controls
        if (lowerTagName.includes('textblock') || lowerTagName.includes('textbox') ||
            lowerTagName.includes('label')) {
            return vscode.SymbolKind.String;
        }
        
        // List controls
        if (lowerTagName.includes('listbox') || lowerTagName.includes('combobox') ||
            lowerTagName.includes('datagrid') || lowerTagName.includes('treeview')) {
            return vscode.SymbolKind.Array;
        }
        
        // Images and media
        if (lowerTagName.includes('image') || lowerTagName.includes('mediaElement')) {
            return vscode.SymbolKind.File;
        }
        
        // Default for other elements
        return vscode.SymbolKind.Object;
    }
}

/**
 * Extension activation function
 */
export function activate(context: vscode.ExtensionContext) {
    // Set activation state
    isExtensionActivated = true;
    activationTimestamp = new Date().toISOString();
    
    // Log muy visible para confirmar activación
    console.log('=' .repeat(80));
    console.log('🚀 AXAML DOCUMENT OUTLINE EXTENSION ACTIVATION STARTED 🚀');
    console.log('=' .repeat(80));
    
    console.log(`⏰ Activation time: ${activationTimestamp}`);
    console.log(`📁 Extension path: ${context.extensionPath}`);
    console.log(`🏠 Workspace folders: ${vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath).join(', ') || 'None'}`);
    console.log(`📄 Active editor: ${vscode.window.activeTextEditor?.document.fileName || 'None'}`);
    console.log(`🔤 Active language: ${vscode.window.activeTextEditor?.document.languageId || 'None'}`);
    
    // Show a notification to confirm activation
    vscode.window.showInformationMessage(`🎉 AXAML Extension ACTIVATED at ${new Date().toLocaleTimeString()}!`, 'Show Status', 'OK')
        .then((choice) => {
            if (choice === 'Show Status') {
                vscode.commands.executeCommand('axaml-outline.status');
            }
            console.log('✅ Activation notification shown and acknowledged');
        });

    // Log extension details
    console.log(`📦 Extension ID: ${context.extension.id}`);
    console.log(`📋 Extension version: ${context.extension.packageJSON.version}`);
    console.log(`🔧 Extension mode: ${context.extensionMode}`);

    // Register a test command that's always available
    const testCommand = vscode.commands.registerCommand('axaml-outline.test', () => {
        const testInfo = {
            activated: isExtensionActivated,
            activationTime: activationTimestamp,
            currentTime: new Date().toISOString(),
            activeFile: vscode.window.activeTextEditor?.document.fileName || 'None',
            languageId: vscode.window.activeTextEditor?.document.languageId || 'None'
        };
        
        console.log('🧪 TEST COMMAND EXECUTED:', testInfo);
        vscode.window.showInformationMessage(`Extension Test: Activated=${testInfo.activated}, File=${testInfo.activeFile.split('\\').pop()}`);
    });
    
    context.subscriptions.push(testCommand);

    // Create and register the document symbol provider
    const provider = new AxamlDocumentSymbolProvider();
    console.log('🏭 Document symbol provider created');
    
    // Register for AXAML files with multiple selectors
    const registrations = [
        // Primary registration for AXAML files
        vscode.languages.registerDocumentSymbolProvider(
            { language: 'axaml' },
            provider,
            { label: 'AXAML Outline' }
        ),
        // Fallback for XML files that might be AXAML
        vscode.languages.registerDocumentSymbolProvider(
            { pattern: '**/*.axaml' },
            provider,
            { label: 'AXAML Outline (Pattern)' }
        ),
        // Broad registration for XML files
        vscode.languages.registerDocumentSymbolProvider(
            { language: 'xml' },
            provider,
            { label: 'AXAML Outline (XML)' }
        )
    ];

    // Add all registrations to subscriptions
    registrations.forEach((registration, index) => {
        context.subscriptions.push(registration);
        console.log(`✅ Registration ${index + 1} added to subscriptions`);
    });
    
    // Listen for active editor changes to log when AXAML files are opened
    const onDidChangeActiveEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            console.log(`📝 Active editor changed to: ${editor.document.fileName}`);
            console.log(`🔤 Language ID: ${editor.document.languageId}`);
            console.log(`📄 File extension: ${editor.document.fileName.split('.').pop()}`);
            
            if (editor.document.fileName.endsWith('.axaml')) {
                console.log('🎯 AXAML file detected! Document symbols should be available.');
                // Force refresh of outline by calling provider directly
                setTimeout(() => {
                    const symbols = provider.provideDocumentSymbols(editor.document, new vscode.CancellationTokenSource().token);
                    console.log(`🔄 Forced outline refresh on editor change`);
                }, 100);
            }
        }
    });
    
    context.subscriptions.push(onDidChangeActiveEditor);
    
    // Listen for document open events
    const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(document => {
        console.log(`📂 Document opened: ${document.fileName}`);
        console.log(`🔤 Language ID: ${document.languageId}`);
        
        if (document.fileName.endsWith('.axaml')) {
            console.log('🎯 AXAML document opened! Symbols should be processed.');
        }
    });
    
    context.subscriptions.push(onDidOpenTextDocument);
    
    // Listen for cursor position changes to select elements in outline
    const onDidChangeTextEditorSelection = vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.textEditor && event.textEditor.document.fileName.endsWith('.axaml')) {
            // Debounce cursor position changes to avoid too many calls
            setTimeout(() => {
                onCursorPositionChanged(event.textEditor);
            }, 100);
        }
    });
    
    context.subscriptions.push(onDidChangeTextEditorSelection);
    
    // Check if there's already an AXAML file open when extension activates
    if (vscode.window.activeTextEditor) {
        const editor = vscode.window.activeTextEditor;
        console.log(`📄 Extension activated with active editor: ${editor.document.fileName}`);
        if (editor.document.fileName.endsWith('.axaml')) {
            console.log('🎯 AXAML file already open on activation!');
            // Force refresh of outline
            setTimeout(() => {
                const symbols = provider.provideDocumentSymbols(editor.document, new vscode.CancellationTokenSource().token);
                console.log(`🔄 Forced outline refresh on activation`);
            }, 100);
        }
    }
    
    // Register a command to manually trigger outline
    const manualActivateCommand = vscode.commands.registerCommand('axaml-outline.activate', () => {
        console.log('🔧 Manual activation command triggered');
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            console.log(`📄 Current file: ${editor.document.fileName}`);
            console.log(`🔤 Language: ${editor.document.languageId}`);
            console.log(`📝 File extension: ${editor.document.fileName.split('.').pop()}`);
            
            // Force call the provider directly
            if (editor.document.fileName.endsWith('.axaml')) {
                console.log('🎯 Calling provider directly for AXAML file...');
                const symbols = provider.provideDocumentSymbols(editor.document, new vscode.CancellationTokenSource().token);
                console.log(`📊 Provider returned: ${symbols}`);
            }
            
            vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
            vscode.window.showInformationMessage('AXAML Outline manually activated');
        } else {
            vscode.window.showWarningMessage('No active editor found');
        }
    });
    
    context.subscriptions.push(manualActivateCommand);
    
    // Register a command to show extension status
    const statusCommand = vscode.commands.registerCommand('axaml-outline.status', () => {
        const editor = vscode.window.activeTextEditor;
        const status = {
            extensionActive: isExtensionActivated,
            activationTime: activationTimestamp,
            activeFile: editor?.document.fileName || 'None',
            languageId: editor?.document.languageId || 'None',
            registrations: registrations.length,
            workspaceFolders: vscode.workspace.workspaceFolders?.length || 0,
            currentTime: new Date().toISOString()
        };
        
        console.log('📊 Extension Status:', status);
        vscode.window.showInformationMessage(
            `Extension Status: ${status.extensionActive ? '✅ Active' : '❌ Inactive'}\nFile: ${status.activeFile.split('\\').pop()}\nLanguage: ${status.languageId}`,
            'Show in Console'
        ).then((choice) => {
            if (choice === 'Show in Console') {
                console.table(status);
            }
        });
    });
    
    context.subscriptions.push(statusCommand);
    
    // Register a command to force reload the extension
    const reloadCommand = vscode.commands.registerCommand('axaml-outline.forceReload', async () => {
        console.log('🔄 Force reload command triggered');
        
        // Try to reactivate the provider manually
        const newProvider = new AxamlDocumentSymbolProvider();
        
        vscode.languages.registerDocumentSymbolProvider(
            { language: 'axaml' },
            newProvider,
            { label: 'AXAML Outline (Reloaded)' }
        );
        
        // Force refresh of outline by calling provider directly
        const newSymbols = newProvider.provideDocumentSymbols(
            vscode.window.activeTextEditor?.document!, 
            new vscode.CancellationTokenSource().token
        );
        
        vscode.window.showInformationMessage('AXAML Extension force reloaded!');
        console.log('✅ Extension force reloaded');
    });
    
    context.subscriptions.push(reloadCommand);
    
    // Register a command to navigate to element by name
    const navigateToElementCommand = vscode.commands.registerCommand('axaml-outline.navigateToElement', async (elementName?: string) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('.axaml')) {
            vscode.window.showWarningMessage('No active AXAML file found');
            return;
        }
        
        // Parse the current document if needed
        if (currentDocument !== editor.document) {
            const provider = new AxamlDocumentSymbolProvider();
            const text = editor.document.getText();
            try {
                currentAxamlElements = provider.parseAxaml(text);
                currentDocument = editor.document;
            } catch (error) {
                vscode.window.showErrorMessage('Error parsing AXAML file');
                return;
            }
        }
        
        // Get all elements in a flat list
        const flatElements: AxamlElement[] = [];
        function addElementsToList(elements: AxamlElement[]) {
            for (const element of elements) {
                flatElements.push(element);
                addElementsToList(element.children);
            }
        }
        addElementsToList(currentAxamlElements);
        
        // If no element name provided, show quick pick
        if (!elementName) {
            const items = flatElements.map(element => ({
                label: element.name,
                description: element.tagName,
                detail: `Line ${element.startLine + 1}`,
                element: element
            }));
            
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select an AXAML element to navigate to'
            });
            
            if (selected) {
                navigateToElement(editor, selected.element);
            }
        } else {
            // Find element by name
            const element = flatElements.find(e => e.name === elementName);
            if (element) {
                navigateToElement(editor, element);
            } else {
                vscode.window.showWarningMessage(`Element "${elementName}" not found`);
            }
        }
    });
    
    context.subscriptions.push(navigateToElementCommand);
    
    // Register a command to show element information
    const showElementInfoCommand = vscode.commands.registerCommand('axaml-outline.showElementInfo', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('.axaml')) {
            vscode.window.showWarningMessage('No active AXAML file found');
            return;
        }
        
        // Parse the current document if needed
        if (currentDocument !== editor.document) {
            const provider = new AxamlDocumentSymbolProvider();
            const text = editor.document.getText();
            try {
                currentAxamlElements = provider.parseAxaml(text);
                currentDocument = editor.document;
            } catch (error) {
                vscode.window.showErrorMessage('Error parsing AXAML file');
                return;
            }
        }
        
        const position = editor.selection.active;
        const element = findElementAtPosition(currentAxamlElements, position);
        
        if (element) {
            const attributes = Array.from(element.attributes.entries())
                .map(([key, value]) => `  ${key}="${value}"`)
                .join('\n');
                
            const info = `Element Information:
Name: ${element.name}
Tag: ${element.tagName}
Position: Line ${element.startLine + 1}
Children: ${element.children.length}
Attributes:
${attributes || '  (none)'}`;
            
            vscode.window.showInformationMessage(info, { modal: true });
        } else {
            vscode.window.showInformationMessage('No AXAML element found at cursor position');
        }
    });
    
    context.subscriptions.push(showElementInfoCommand);
    
    // Register a command to toggle line numbers in outline
    const toggleLineNumbersCommand = vscode.commands.registerCommand('axaml-outline.toggleLineNumbers', async () => {
        showLineNumbers = !showLineNumbers;
        
        const status = showLineNumbers ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`AXAML Outline line numbers ${status}`);
        
        console.log(`🔢 Line numbers in outline: ${status}`);
        
        // Refresh the outline by forcing document change detection
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.fileName.endsWith('.axaml')) {
            // Clear cached elements to force re-parsing with new line number setting
            currentDocument = null;
            currentAxamlElements = [];
            
            // Force a document symbol refresh by calling the provider directly
            const symbols = provider.provideDocumentSymbols(editor.document, new vscode.CancellationTokenSource().token);
            console.log(`🔄 Forced outline refresh, symbols: ${symbols ? 'generated' : 'none'}`);
            
            // Alternative: trigger a small edit and undo to force refresh
            try {
                const position = new vscode.Position(0, 0);
                await editor.edit(editBuilder => {
                    editBuilder.insert(position, ' ');
                });
                await editor.edit(editBuilder => {
                    editBuilder.delete(new vscode.Range(position, new vscode.Position(0, 1)));
                });
            } catch (error) {
                console.log('⚠️ Could not trigger edit refresh, but symbols should still update');
            }
        }
    });
    
    context.subscriptions.push(toggleLineNumbersCommand);
    
    console.log('✅ AXAML Document Symbol Providers registered successfully');
    console.log(`📊 Total registrations: ${registrations.length}`);
    console.log(`🎯 Extension fully activated and ready!`);
    
    // Final activation log
    console.log('=' .repeat(80));
    console.log('✅ AXAML DOCUMENT OUTLINE EXTENSION ACTIVATION COMPLETED ✅');
    console.log('=' .repeat(80));
    
    // Write to output channel as well
    const outputChannel = vscode.window.createOutputChannel('AXAML Outline');
    outputChannel.appendLine(`AXAML Extension activated at ${activationTimestamp}`);
    outputChannel.appendLine(`Active file: ${vscode.window.activeTextEditor?.document.fileName || 'None'}`);
    outputChannel.appendLine(`Total registrations: ${registrations.length}`);
    
    context.subscriptions.push(outputChannel);
}

/**
 * Extension deactivation function
 */
export function deactivate() {
    console.log('AXAML Document Outline extension deactivated');
}

/**
 * Find the AXAML element that contains the given position
 */
function findElementAtPosition(elements: AxamlElement[], position: vscode.Position): AxamlElement | null {
    for (const element of elements) {
        // Check if position is within this element's range
        const startPos = new vscode.Position(element.startLine, element.startColumn);
        const endPos = new vscode.Position(element.endLine, element.endColumn);
        const range = new vscode.Range(startPos, endPos);
        
        if (range.contains(position)) {
            // First check children to find the most specific element
            const childElement = findElementAtPosition(element.children, position);
            return childElement || element;
        }
    }
    return null;
}

/**
 * Select the corresponding element in the outline view
 */
async function selectElementInOutline(element: AxamlElement) {
    if (!currentDocument) {
        return;
    }
    
    try {
        // Create a range for the element's opening tag
        const tagStart = new vscode.Position(element.startLine, element.startColumn);
        const tagEnd = new vscode.Position(element.startLine, element.startColumn + element.tagName.length + 1);
        const tagRange = new vscode.Range(tagStart, tagEnd);
        
        // Get the current editor
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== currentDocument) {
            return;
        }
        
        // Set the cursor to the beginning of the element tag (this will update the outline selection)
        editor.selection = new vscode.Selection(tagStart, tagStart);
        
        // Optionally, also reveal the range in the editor to ensure it's visible
        editor.revealRange(tagRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        
        console.log(`🎯 Moved cursor to element: ${element.name} (${element.tagName}) at line ${element.startLine + 1}`);
        
    } catch (error) {
        console.error('❌ Error selecting element in outline:', error);
    }
}

/**
 * Handle cursor position changes - sync outline selection
 */
function onCursorPositionChanged(editor: vscode.TextEditor) {
    if (!editor || !editor.document.fileName.endsWith('.axaml')) {
        return;
    }
    
    if (currentDocument !== editor.document) {
        // Document changed, need to re-parse
        console.log('📄 Document changed, re-parsing AXAML...');
        const provider = new AxamlDocumentSymbolProvider();
        const text = editor.document.getText();
        try {
            currentAxamlElements = provider.parseAxaml(text);
            currentDocument = editor.document;
            console.log(`🌳 Parsed ${currentAxamlElements.length} elements for selection tracking`);
        } catch (error) {
            console.error('❌ Error parsing AXAML for selection:', error);
            return;
        }
    }
    
    const position = editor.selection.active;
    const element = findElementAtPosition(currentAxamlElements, position);
    
    if (element) {
        console.log(`📍 Cursor at line ${position.line + 1}, found element: ${element.name} (${element.tagName})`);
        // The outline view will automatically update based on the cursor position
        // We can add additional functionality here if needed
        
        // Show information about the current element
        vscode.window.setStatusBarMessage(
            `AXAML: ${element.name} (${element.tagName})`, 
            2000
        );
    }
}

/**
 * Navigate to a specific AXAML element in the editor
 */
function navigateToElement(editor: vscode.TextEditor, element: AxamlElement) {
    // Create a range for the element's opening tag
    const tagStart = new vscode.Position(element.startLine, element.startColumn);
    const tagEnd = new vscode.Position(element.startLine, element.startColumn + element.tagName.length + 1);
    const tagRange = new vscode.Range(tagStart, tagEnd);
    
    // Set the cursor to the beginning of the element tag
    editor.selection = new vscode.Selection(tagStart, tagStart);
    
    // Reveal the range in the editor to ensure it's visible
    editor.revealRange(tagRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    
    // Show status message
    vscode.window.setStatusBarMessage(
        `Navigated to: ${element.name} (${element.tagName}) at line ${element.startLine + 1}`, 
        3000
    );
    
    console.log(`🧭 Navigated to element: ${element.name} (${element.tagName}) at line ${element.startLine + 1}`);
}
