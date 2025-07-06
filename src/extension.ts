import * as vscode from 'vscode';

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
        
        console.log(`🔍 Document symbol provider called for: ${document.fileName}`);
        console.log(`📄 Language ID: ${document.languageId}`);
        console.log(`📝 File extension: ${document.fileName.split('.').pop()}`);
        
        if (token.isCancellationRequested) {
            console.log('❌ Token cancelled');
            return [];
        }

        try {
            const text = document.getText();
            console.log(`📊 Document length: ${text.length} characters`);
            
            const elements = this.parseAxaml(text);
            console.log(`🌳 Parsed ${elements.length} root elements`);
            
            const symbols = this.convertToDocumentSymbols(elements, document);
            console.log(`✅ Generated ${symbols.length} document symbols`);
            
            return symbols;
        } catch (error) {
            console.error('❌ Error parsing AXAML:', error);
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

                const isSelfClosing = fullTagContent.includes('/>');
                const attributesMatch = fullTagContent.match(/<[^>]*?([^<]*?)(\s*\/?)>$/);
                const attributesStr = attributesMatch ? attributesMatch[1] : '';

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
        
        // Match attribute="value" or attribute='value'
        const attrRegex = /([a-zA-Z][a-zA-Z0-9.:_-]*)\s*=\s*["']([^"']*)["']/g;
        let match;
        
        while ((match = attrRegex.exec(attributeStr)) !== null) {
            attributes.set(match[1], match[2]);
        }
        
        return attributes;
    }

    /**
     * Get display name for element based on tag name and attributes
     */
    private getElementDisplayName(tagName: string, attributesStr: string): string {
        const attributes = this.parseAttributes(attributesStr);
        
        // Try to use x:Name or Name attribute
        const name = attributes.get('x:Name') || attributes.get('Name');
        if (name) {
            return `${tagName} (${name})`;
        }
        
        // For some common controls, show additional info
        if (tagName === 'Button') {
            const content = attributes.get('Content');
            if (content) {
                return `${tagName} "${content}"`;
            }
        }
        
        if (tagName === 'TextBlock') {
            const text = attributes.get('Text');
            if (text) {
                return `${tagName} "${text}"`;
            }
        }
        
        return tagName;
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
    console.log('🚀 AXAML Document Outline extension STARTING...');
    
    // Show a notification to confirm activation
    vscode.window.showInformationMessage('AXAML Document Outline activated! 🎉');

    // Create and register the document symbol provider
    const provider = new AxamlDocumentSymbolProvider();
    
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
            { label: 'AXAML Outline' }
        ),
        // Broad registration for XML files
        vscode.languages.registerDocumentSymbolProvider(
            { language: 'xml' },
            provider,
            { label: 'AXAML Outline (XML)' }
        )
    ];

    // Add all registrations to subscriptions
    registrations.forEach(registration => {
        context.subscriptions.push(registration);
    });
    
    console.log('✅ AXAML Document Symbol Providers registered successfully');
    console.log(`📊 Total registrations: ${registrations.length}`);
}

/**
 * Extension deactivation function
 */
export function deactivate() {
    console.log('AXAML Document Outline extension deactivated');
}
