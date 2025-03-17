import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2CommandInput,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    const region = configService.get<string>('AWS_S3_REGION');
    const accessKeyId = configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const bucket = configService.get<string>('AWS_S3_BUCKET');

    if (!region || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        'Missing one or more required S3 configuration values. ' +
          'Please set AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET.',
      );
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    this.bucket = bucket;
  }

  async uploadFile(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
    return key; // or return a full public URL if desired
  }

  async deleteFile(key: string) {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async listAllObjects(prefix?: string): Promise<string[]> {
    const results: string[] = [];
    let continuationToken: string | undefined = undefined;

    do {
      const input: ListObjectsV2CommandInput = {
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      };
      const command = new ListObjectsV2Command(input);
      const response = await this.s3Client.send(command);

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            results.push(obj.Key);
          }
        }
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return results;
  }
}
