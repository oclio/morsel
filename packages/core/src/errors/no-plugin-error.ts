import { MorselError } from '@/errors/error';

/**
 * Thrown when no format plugin matches the file extension.
 */
export class NoPluginError extends MorselError {
  /**
   * Unsupported extension, ex: ".yaml"
   */
  readonly extension: string;

  constructor(filePath: string, extension: string) {
    const message = extension
      ? `no format plugin found for ${extension}. Register a FormatPlugin via options.formatPlugins.`
      : `file has no extension. Register a FormatPlugin via options.formatPlugins.`;

    super(filePath, 'ENOPLUGIN', new Error(message));
    this.name = 'NoPluginError';
    this.extension = extension;
  }
}
