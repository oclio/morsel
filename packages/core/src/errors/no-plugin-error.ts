import { MorselError } from '@/errors/morsel-error';

/**
 * Thrown when no format plugin matches the file extension.
 */
export class MorselNoPluginError extends MorselError {
  /**
   * Unsupported extension, ex: ".yaml"
   */
  readonly extension: string;

  constructor(filePath: string, extension: string) {
    const message = extension
      ? `no format plugin found for ${extension}. Register a MorselFormatPlugin via options.formatPlugins.`
      : `file has no extension. Register a MorselFormatPlugin via options.formatPlugins.`;

    super(filePath, 'ENOPLUGIN', new Error(message));
    this.name = 'MorselNoPluginError';
    this.extension = extension;
  }
}
