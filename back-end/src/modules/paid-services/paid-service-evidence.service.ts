import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { PaidServicesService } from './paid-services.service';

export const PAID_SERVICE_UPLOAD_DIRECTORY = 'PAID_SERVICE_UPLOAD_DIRECTORY';
@Injectable()
export class PaidServiceEvidenceService {
  constructor(private readonly services: PaidServicesService, @Inject(PAID_SERVICE_UPLOAD_DIRECTORY) private readonly directory: string) {}
  upload(actor: AuthenticatedUser, id: string, file?: Express.Multer.File) {
    this.services.get(actor, id);
    if (!file?.buffer?.length || file.size > 5 * 1024 * 1024) throw new BadRequestException('Choose a nonempty image up to 5 MB');
    const types = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
    const extension = types[file.mimetype];
    const bytes = file.buffer;
    const valid = file.mimetype === 'image/png' ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : file.mimetype === 'image/jpeg' ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : file.mimetype === 'image/webp' && bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
    if (!extension || !valid) throw new BadRequestException('Only JPEG, PNG, and WebP evidence images are allowed');
    const evidenceId = randomUUID(), storedName = `${evidenceId}.${extension}`;
    mkdirSync(this.directory, { recursive: true });
    const path = resolve(this.directory, storedName);
    writeFileSync(path, bytes, { flag: 'wx' });
    try {
      return this.services.addEvidence(actor, id, { id: evidenceId, storedName, originalName: basename(file.originalname), mimeType: file.mimetype, uploadedAt: new Date().toISOString() });
    } catch (error) { unlinkSync(path); throw error; }
  }
  read(actor: AuthenticatedUser, id: string, evidenceId: string) {
    const evidence = this.services.evidence(actor, id, evidenceId);
    if (!/^[0-9a-f-]+\.(png|jpg|webp)$/.test(evidence.storedName)) throw new BadRequestException('Invalid evidence path');
    const path = resolve(this.directory, evidence.storedName);
    if (!existsSync(path)) throw new NotFoundException('Evidence image is unavailable');
    return { content: readFileSync(path), mimeType: evidence.mimeType };
  }
}
