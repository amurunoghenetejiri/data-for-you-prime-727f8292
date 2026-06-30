// Payment Types and Interfaces

export type PaymentProvider = 'paystack' | 'monnify' | 'manual_bank_transfer';
export type PaymentMode = 'test' | 'live' | 'sandbox' | 'production';

export interface PaymentConfiguration {
  id: string;
  provider: PaymentProvider;
  mode: PaymentMode;
  enabled: boolean;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  provider: PaymentProvider;
  name: string;
  displayName: string;
  description?: string;
  enabled: boolean;
  order: number;
  details: PaymentMethodDetails;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethodDetails {
  [key: string]: any;
  // For Manual Bank Transfer
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  instructions?: string;
  // For Paystack
  publicKey?: string;
  // For Monnify
  apiKey?: string;
}

export interface PaystackConfig {
  publicKey: string;
  secretKey: string;
  mode: 'test' | 'live';
}

export interface MonnifyConfig {
  apiKey: string;
  secretKey: string;
  contractCode: string;
  mode: 'sandbox' | 'production';
}

export interface ManualBankTransferConfig {
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
}

export interface PaymentSettingsResponse {
  success: boolean;
  data?: PaymentMethod[] | PaymentConfiguration | any;
  error?: string;
  message?: string;
}
