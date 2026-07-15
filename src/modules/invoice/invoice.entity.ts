import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { InvoiceStatus } from './invoice-status.enum';
import { IvaRateCode } from '@common/enums/sri.enum';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  ivaRateCode: IvaRateCode;
  ivaTariff: number;
  ivaValue: number;
  subtotal: number;
  total: number;
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'clave_acceso', length: 49, unique: true })
  claveAcceso!: string;

  @Column({ length: 1 })
  environment!: string;

  @Column({ length: 3 })
  establishment!: string;

  @Column({ name: 'emission_point', length: 3 })
  emissionPoint!: string;

  @Column({ length: 9 })
  sequential!: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate!: string;

  @Column({ name: 'buyer_identification' })
  buyerIdentification!: string;

  @Column({ name: 'buyer_name' })
  buyerName!: string;

  @Column({ type: 'jsonb' })
  items!: InvoiceItem[];

  @Column({ type: 'numeric', precision: 12, scale: 2, default: '0.00' })
  subtotal!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: '0.00' })
  iva!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total!: string;

  @Column({ type: 'varchar', length: 30, default: InvoiceStatus.PENDIENTE })
  estado!: InvoiceStatus;

  @Column({ name: 'xml_filename', type: 'varchar', nullable: true })
  xmlFilename!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
