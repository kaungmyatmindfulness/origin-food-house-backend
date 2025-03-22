import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as disposableDomains from 'disposable-email-domains';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User, UserShop } from '@prisma/client';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma.service';
import { AddUserToShopDto } from './dto/add-user-to-shop.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Create a new user account + send verification email.
   */
  async createUser(dto: CreateUserDto): Promise<User> {
    const domain = dto.email.split('@')[1];
    if (process.env.NODE_ENV !== 'dev' && disposableDomains.includes(domain)) {
      throw new BadRequestException('Disposable domain not allowed');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Email already in use.');
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashed,
        name: dto.name,
        verified: false,
        verificationToken,
        verificationExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h
      },
    });

    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken,
    );

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { userShops: true },
    });
  }

  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { userShops: true },
    });
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { verificationToken: token } });
  }

  async markUserVerified(userId: number): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        verified: true,
        verificationToken: null,
        verificationExpiry: null,
      },
    });
  }

  /**
   * Add or update user’s role in a shop (owner, admin, sale, chef).
   */
  async addUserToShop(dto: AddUserToShopDto): Promise<UserShop> {
    const user = await this.findById(dto.userId);
    if (!user) throw new BadRequestException('User not found');

    const shop = await this.prisma.shop.findUnique({
      where: { id: dto.shopId },
    });
    if (!shop) throw new BadRequestException('Shop not found');

    return this.prisma.userShop.upsert({
      where: {
        userId_shopId: { userId: dto.userId, shopId: dto.shopId },
      },
      update: { role: dto.role },
      create: {
        userId: dto.userId,
        shopId: dto.shopId,
        role: dto.role,
      },
    });
  }

  async getUserShops(userId: number) {
    return this.prisma.userShop.findMany({
      where: { userId },
      include: { shop: true },
    });
  }

  /**
   * Fetch the user by ID, including shops/roles if desired.
   */
  async findUserProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userShops: {
          include: { shop: true },
        },
      },
      omit: { password: true },
    });
    if (!user) {
      throw new NotFoundException(`User not found (id=${userId})`);
    }
    return user;
  }

  async setResetToken(userId: number, token: string, expiry: Date) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });
  }

  async findByResetToken(token: string) {
    return this.prisma.user.findFirst({
      where: {
        resetToken: token,
      },
    });
  }

  async updatePasswordAndClearResetToken(userId: number, hashedPass: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPass,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  }

  async updatePassword(userId: number, hashedPass: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPass,
      },
    });
  }
}
