import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';
import { EmailModule } from 'src/email/email.module';
import { ShopModule } from 'src/shop/shop.module';
import { MenuModule } from 'src/menu/menu.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    UserModule,
    AuthModule,
    ShopModule,
    MenuModule,
    EmailModule,
  ],
  controllers: [],
  providers: [AppService, PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
