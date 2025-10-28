import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

export class InitiateOwnershipTransferDto {
  @ApiProperty({
    description: "Store ID for ownership transfer",
    example: "abc1234",
  })
  @IsString()
  storeId: string;

  @ApiProperty({
    description: "Email of the new owner",
    example: "newowner@example.com",
  })
  @IsEmail()
  newOwnerEmail: string;
}
