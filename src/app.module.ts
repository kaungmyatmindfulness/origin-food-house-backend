import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    UserModule,
    AuthModule,
    EmailModule,
  ],
  controllers: [],
  providers: [AppService, PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
