import * as vscode from 'vscode';

// Global variable to track activation state
let isExtensionActivated = false;
let activationTimestamp: string | null = null;

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
    private parseAxaml(text: string): AxamlElement[] {
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
                
                // Skip property definition tags like Grid.RowDefinitions
                if (tagName.includes('.')) {
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
        
        // If we have x:Name or Name, just show the name (no brackets)
        if (xName) {
            console.log(`✅ Using x:Name only: ${xName}`);
            return xName;
        }
        
        if (name) {
            console.log(`✅ Using Name only: ${name}`);
            return name;
        }
        
        // For controls without names, show [type] with additional info if available
        if (tagName === 'Button') {
            const content = attributes.get('Content');
            if (content) {
                console.log(`✅ Using Button Content: [Button "${content}"]`);
                return `[Button "${content}"]`;
            }
        }
        
        if (tagName === 'TextBlock') {
            const text = attributes.get('Text');
            if (text) {
                console.log(`✅ Using TextBlock Text: [TextBlock "${text}"]`);
                return `[TextBlock "${text}"]`;
            }
        }
        
        // For elements without names, show [TagName]
        console.log(`⚪ Using bracketed name: [${tagName}]`);
        return `[${tagName}]`;
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

        const symbol = new vscode.DocumentSymbol(
            element.name,
            element.tagName,
            this.getSymbolKind(element.tagName),
            range,
            selectionRange
        );

        // Add children recursively
        symbol.children = element.children.map(child => this.createDocumentSymbol(child, document));

        return symbol;
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
                // Force refresh of outline
                vscode.commands.executeCommand('outline.refresh');
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
    
    // Check if there's already an AXAML file open when extension activates
    if (vscode.window.activeTextEditor) {
        const editor = vscode.window.activeTextEditor;
        console.log(`📄 Extension activated with active editor: ${editor.document.fileName}`);
        if (editor.document.fileName.endsWith('.axaml')) {
            console.log('🎯 AXAML file already open on activation!');
            // Force refresh of outline
            setTimeout(() => {
                vscode.commands.executeCommand('outline.refresh');
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
            
            vscode.commands.executeCommand('outline.refresh');
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
        
        // Force refresh of outline
        await vscode.commands.executeCommand('outline.refresh');
        
        vscode.window.showInformationMessage('AXAML Extension force reloaded!');
        console.log('✅ Extension force reloaded');
    });
    
    context.subscriptions.push(reloadCommand);
    
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
