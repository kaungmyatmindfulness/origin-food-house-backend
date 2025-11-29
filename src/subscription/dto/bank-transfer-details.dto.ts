import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString } from "class-validator";

/**
 * DTO for bank transfer details in payment requests
 */
export class BankTransferDetailsDto {
  @ApiPropertyOptional({
    description: "Name of the bank",
    example: "Bank of America",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  bankName?: string;

  @ApiPropertyOptional({
    description: "Bank account number (may be masked)",
    example: "****1234",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  accountNumber?: string;

  @ApiPropertyOptional({
    description: "Account holder name",
    example: "John Doe",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  accountHolderName?: string;

  @ApiPropertyOptional({
    description: "Date of the transfer (ISO date string)",
    example: "2025-01-15",
  })
  @IsOptional()
  @IsString()
  transferDate?: string;

  @ApiPropertyOptional({
    description: "Bank reference or transaction number",
    example: "TXN123456",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: "Bank branch name or code",
    example: "Downtown Branch",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  branchName?: string;

  @ApiPropertyOptional({
    description: "Bank routing number (if applicable)",
    example: "021000021",
  })
  @IsOptional()
  @IsString()
  routingNumber?: string;

  @ApiPropertyOptional({
    description: "SWIFT/BIC code for international transfers",
    example: "BOFAUS3N",
  })
  @IsOptional()
  @IsString()
  swiftCode?: string;

  @ApiPropertyOptional({
    description: "Additional notes about the transfer",
    example: "Payment for Premium subscription",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  notes?: string;
}
