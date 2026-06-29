import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 13 })
  ruc!: string;

  @Column({ name: 'legal_name' })
  legalName!: string;

  @Column({ name: 'certificate_base64', type: 'text', nullable: true })
  certificateBase64!: string | null;

  @Column({ name: 'certificate_password', type: 'varchar', nullable: true })
  certificatePassword!: string | null;

  @Column({ name: 'encryption_salt', type: 'varchar', nullable: true })
  encryptionSalt!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
