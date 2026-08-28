import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { basename, isAbsolute, relative, resolve } from 'path';
import { randomUUID } from 'crypto';
import { RoleName } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { ComplaintAttachment } from '../complaints/complaints.dto';
import { ComplaintsService } from '../complaints/complaints.service';

export const COMPLAINT_UPLOAD_DIRECTORY = resolve(process.cwd(), 'uploads', 'complaints');
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map<string, string>([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);

@Injectable()
export class AttachmentsService {
  constructor(private readonly complaints: ComplaintsService) { mkdirSync(COMPLAINT_UPLOAD_DIRECTORY, { recursive: true }); }
  upload(complaintId: string, file: any, actor: AuthenticatedUser) {
    const complaint = this.complaints.findById(complaintId);
    this.complaints.assertCanViewComplaint(actor, complaint);
    if (actor.role !== RoleName.Resident || complaint.residentId !== actor.id) {
      throw new ForbiddenException('Only the resident who submitted the complaint may upload attachments');
    }
    if (!file) throw new BadRequestException('No file was uploaded.');
    if (file.size > MAX_IMAGE_SIZE_BYTES) throw new BadRequestException('Image exceeds the maximum allowed size of 5 MB.');
    const extension = IMAGE_TYPES.get(file.mimetype);
    if (!extension || !matchesImageSignature(file.buffer, file.mimetype)) throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed.');
    const storedName = `${randomUUID()}.${extension}`;
    const target = this.safePath(storedName);
    writeFileSync(target, file.buffer, { flag: 'wx' });
    const attachmentId = randomUUID();
    const attachment: ComplaintAttachment = { id: attachmentId, originalName: basename(file.originalname), storedName, mimeType: file.mimetype, size: file.size, relativePath: `complaints/${storedName}`, uploadedAt: new Date().toISOString(), uploadedByRole: actor.role, retrievalUrl: `/complaints/${complaintId}/attachments/${attachmentId}` };
    try {
      this.complaints.addAttachment(complaintId, attachment);
    } catch (error) {
      unlinkSync(target);
      throw error;
    }
    return this.publicMetadata(attachment);
  }
  list(complaintId: string, actor: AuthenticatedUser) {
    const complaint = this.complaints.findById(complaintId);
    this.complaints.assertCanViewComplaint(actor, complaint);
    return complaint.attachments.map((attachment) => this.publicMetadata(attachment));
  }
  read(complaintId: string, attachmentId: string, actor: AuthenticatedUser) {
    const complaint = this.complaints.findById(complaintId);
    this.complaints.assertCanViewComplaint(actor, complaint);
    const attachment = complaint.attachments.find((item) => item.id === attachmentId);
    if (!attachment) throw new NotFoundException('Attachment was not found for this complaint.');
    const path = this.safePath(attachment.storedName);
    if (!existsSync(path)) throw new NotFoundException('Attachment file not found.');
    return { attachment, content: readFileSync(path) };
  }
  private safePath(storedName: string) {
    const path = resolve(COMPLAINT_UPLOAD_DIRECTORY, storedName);
    const relativePath = relative(COMPLAINT_UPLOAD_DIRECTORY, path);
    if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) throw new BadRequestException('Invalid attachment path.');
    return path;
  }
  private publicMetadata({ storedName: _storedName, relativePath: _relativePath, ...attachment }: ComplaintAttachment) { return attachment; }
}
function matchesImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
}
