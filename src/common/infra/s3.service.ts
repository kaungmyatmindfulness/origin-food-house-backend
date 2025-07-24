import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  PutObjectCommandOutput,
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  ListObjectsV2CommandInput,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  S3ServiceException,
  DeleteObjectsCommand,
  DeleteObjectsCommandInput,
  ObjectIdentifier,
  DeleteObjectsCommandOutput,
  _Error as S3Error,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string | undefined;
  private readonly region: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.region = configService.get<string>('AWS_S3_REGION');
    const accessKeyId = configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = configService.get<string>('AWS_SECRET_ACCESS_KEY');
    this.bucket = configService.get<string>('AWS_S3_BUCKET');

    if (!this.region || !accessKeyId || !secretAccessKey || !this.bucket) {
      const errorMsg =
        'Missing one or more required S3 configuration values (AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET).';
      this.logger.error(errorMsg);

      throw new InternalServerErrorException(errorMsg);
    }

    try {
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log(
        `S3 Client initialized for region ${this.region} and bucket ${this.bucket}`,
      );
    } catch (error) {
      this.logger.error(`Failed to initialize S3 Client.`, error);
      throw new InternalServerErrorException(
        'S3 Client initialization failed.',
      );
    }
  }

  /**
   * Constructs the public URL for an object in the S3 bucket.
   * Assumes public read access or uses pre-signed URLs if objects are private.
   * Adjust format based on your bucket/CDN setup.
   * @param key The object key.
   * @returns The full URL to the object.
   */
  getObjectUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Uploads a file (Buffer) to the configured S3 bucket.
   * @param key The desired object key (path within the bucket).
   * @param data The file content as a Buffer.
   * @param contentType The MIME type of the file.
   * @returns The public URL of the uploaded object.
   * @throws {InternalServerErrorException} On S3 API errors.
   */
  async uploadFile(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<string> {
    this.logger.log(
      `Uploading file to S3. Key: ${key}, Bucket: ${this.bucket}`,
    );
    const commandInput: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    };
    const command = new PutObjectCommand(commandInput);

    try {
      const output: PutObjectCommandOutput = await this.s3Client.send(command);
      this.logger.log(
        `Successfully uploaded file to key: ${key}. ETag: ${output.ETag}`,
      );
      return this.getObjectUrl(key);
    } catch (error) {
      this.handleS3Error(error, 'upload', key);
    }
  }

  /**
   * Deletes a file from the configured S3 bucket.
   * @param key The object key to delete.
   * @returns The output from the DeleteObjectCommand.
   * @throws {NotFoundException | InternalServerErrorException} On S3 API errors.
   */
  async deleteFile(key: string): Promise<DeleteObjectCommandOutput> {
    this.logger.log(
      `Deleting file from S3. Key: ${key}, Bucket: ${this.bucket}`,
    );
    const commandInput: DeleteObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
    };
    const command = new DeleteObjectCommand(commandInput);

    try {
      const output = await this.s3Client.send(command);
      this.logger.log(`Successfully deleted file with key: ${key}.`);
      return output;
    } catch (error) {
      this.handleS3Error(error, 'delete', key);
    }
  }

  /**
   * Lists all object keys within the bucket, optionally filtered by a prefix.
   * Handles pagination automatically.
   * @param prefix Optional prefix to filter objects.
   * @returns An array of object keys (strings).
   * @throws {InternalServerErrorException} On S3 API errors.
   */
  async listAllObjectKeys(prefix?: string): Promise<string[]> {
    this.logger.verbose(
      `Listing all object keys with prefix "${prefix ?? 'none'}" from bucket ${this.bucket}`,
    );
    const keys: string[] = [];
    let continuationToken: string | undefined = undefined;

    try {
      do {
        const input: ListObjectsV2CommandInput = {
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        };
        const command = new ListObjectsV2Command(input);
        const response: ListObjectsV2CommandOutput =
          await this.s3Client.send(command);

        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key) {
              keys.push(obj.Key);
            }
          }
        }
        continuationToken = response.NextContinuationToken;
        this.logger.verbose(
          `Listed ${response.Contents?.length ?? 0} keys, NextContinuationToken: ${!!continuationToken}`,
        );
      } while (continuationToken);

      this.logger.log(
        `Finished listing objects. Found ${keys.length} keys with prefix "${prefix ?? 'none'}".`,
      );
      return keys;
    } catch (error) {
      this.handleS3Error(error, 'list', prefix);
    }
  }

  /**
   * Deletes multiple files from the configured S3 bucket using bulk operation.
   * Handles batching requests if more than 1000 keys are provided.
   * @param keys An array of object keys to delete.
   * @returns An object containing arrays of successfully deleted keys and errors for failed keys.
   * @throws {InternalServerErrorException} On fundamental S3 API errors during the calls.
   */
  async deleteFiles(keys: string[]): Promise<{
    deletedKeys: string[];
    errors: { key: string; message: string }[];
  }> {
    if (!keys || keys.length === 0) {
      this.logger.log('[deleteFiles] No keys provided for deletion.');
      return { deletedKeys: [], errors: [] };
    }

    this.logger.log(
      `[deleteFiles] Attempting to delete ${keys.length} keys from bucket ${this.bucket}.`,
    );
    const batchSize = 1000;
    const allDeletedKeys: string[] = [];
    const allErrors: { key: string; message: string }[] = [];

    try {
      for (let i = 0; i < keys.length; i += batchSize) {
        const batchKeys = keys.slice(i, i + batchSize);
        const objectsToDelete: ObjectIdentifier[] = batchKeys.map((key) => ({
          Key: key,
        }));

        const commandInput: DeleteObjectsCommandInput = {
          Bucket: this.bucket,
          Delete: {
            Objects: objectsToDelete,
            Quiet: false,
          },
        };
        const command = new DeleteObjectsCommand(commandInput);

        this.logger.verbose(
          `[deleteFiles] Sending delete command for batch of ${batchKeys.length} keys (index ${i}).`,
        );
        const output: DeleteObjectsCommandOutput =
          await this.s3Client.send(command);

        if (output.Deleted) {
          const successfullyDeletedInBatch = output.Deleted.map(
            (d) => d.Key,
          ).filter((k): k is string => !!k);
          allDeletedKeys.push(...successfullyDeletedInBatch);
          this.logger.verbose(
            `[deleteFiles] Successfully deleted ${successfullyDeletedInBatch.length} keys in this batch.`,
          );
        }

        if (output.Errors) {
          output.Errors.forEach((err: S3Error) => {
            if (err.Key) {
              const errorDetail = {
                key: err.Key,
                message: err.Message ?? 'Unknown S3 delete error',
              };
              allErrors.push(errorDetail);
              this.logger.error(
                `[deleteFiles] Failed to delete key ${err.Key}: ${errorDetail.message}`,
              );
            } else {
              this.logger.error(
                `[deleteFiles] An error occurred during batch delete without a specific key: ${err.Message}`,
              );
            }
          });
        }
      }

      this.logger.log(
        `[deleteFiles] Finished bulk delete. Total successful: ${allDeletedKeys.length}, Total errors: ${allErrors.length}.`,
      );
      return { deletedKeys: allDeletedKeys, errors: allErrors };
    } catch (error) {
      this.handleS3Error(
        error,
        'deleteMultiple',
        `Batch starting near index ${Math.floor(keys.length / batchSize) * batchSize}`,
      );
    }
  }

  /**
   * Centralized S3 error handler.
   */
  private handleS3Error(
    error: unknown,
    operation: string,
    context?: string,
  ): never {
    const message = `S3 operation '${operation}' failed${context ? ` for context: ${context}` : ''}. Error: ${error instanceof Error ? error.message : 'Unknown S3 error'}`;
    this.logger.error(
      message,
      error instanceof Error ? error.stack : undefined,
    );

    if (error instanceof S3ServiceException) {
      if (
        error.name === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        throw new NotFoundException(
          `S3 object not found${context ? ` for key: ${context}` : ''}.`,
        );
      }
    }

    throw new InternalServerErrorException(
      `S3 operation '${operation}' failed.`,
    );
  }
}
