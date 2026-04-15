import * as path from 'path';
import { ExtensionContext, window } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext): void {
  // Resolve the compiled language server relative to this extension's root.
  // In the monorepo the layout is:
  //   packages/vscode-extension/   ← extension root (context.extensionPath)
  //   packages/language-server/dist/server.js
  const serverModule = context.asAbsolutePath(
    path.join('..', 'language-server', 'dist', 'server.js'),
  );

  const serverOptions: ServerOptions = {
    run: {
      command: process.execPath,
      args: [serverModule, '--stdio'],
      transport: TransportKind.stdio,
    },
    debug: {
      command: process.execPath,
      args: ['--inspect=6009', serverModule, '--stdio'],
      transport: TransportKind.stdio,
    },
  };

  const clientOptions: LanguageClientOptions = {
    // Activate for .vorra files only.
    documentSelector: [{ scheme: 'file', language: 'vorra' }],
    synchronize: {
      // Re-validate when .vorra files change on disk.
      fileEvents: undefined,
    },
    outputChannelName: 'Vorra Language Server',
  };

  client = new LanguageClient(
    'vorra',
    'Vorra Language Server',
    serverOptions,
    clientOptions,
  );

  client.start().catch((err: unknown) => {
    void window.showErrorMessage(
      `[Vorra] Failed to start language server: ${String(err)}`,
    );
  });

  context.subscriptions.push({ dispose: () => { void client?.stop(); } });
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
