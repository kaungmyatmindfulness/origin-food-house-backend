import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as disposableDomains from 'disposable-email-domains';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User, UserStore } from '@prisma/client';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma.service';
import { AddUserToStoreDto } from './dto/add-user-to-store.dto';
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
      include: { userStores: true },
    });
  }

  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { userStores: true },
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
   * Add or update user’s role in a store (owner, admin, sale, chef).
   */
  async addUserToStore(dto: AddUserToStoreDto): Promise<UserStore> {
    const user = await this.findById(dto.userId);
    if (!user) throw new BadRequestException('User not found');

    const store = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
    });
    if (!store) throw new BadRequestException('Store not found');

    return this.prisma.userStore.upsert({
      where: {
        userId_storeId: { userId: dto.userId, storeId: dto.storeId },
      },
      update: { role: dto.role },
      create: {
        userId: dto.userId,
        storeId: dto.storeId,
        role: dto.role,
      },
    });
  }

  async getUserStores(userId: number) {
    return this.prisma.userStore.findMany({
      where: { userId },
      include: { store: true },
    });
  }

  /**
   * Fetch the user by ID, including stores/roles, and also
   * return the user's current store info and role if `currentStoreId` is provided.
   */
  async findUserProfile(userId: number, currentStoreId?: number) {
    // 1) Fetch user with all userStores (including the store object)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userStores: {
          include: {
            store: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User not found (id=${userId})`);
    }

    // 2) Omit password from the returned object
    //    (You can also do this at a serialization layer if needed)
    const { password: _, ...rest } = user;

    // 3) Find membership for the current logged-in store
    let currentStoreInfo = null;
    let currentRole = null;

    if (currentStoreId) {
      const membership = user.userStores.find(
        (us) => us.storeId === currentStoreId,
      );
      if (membership) {
        currentStoreInfo = membership.store; // The actual store record
        currentRole = membership.role; // The user's role in that store
      }
    }

    // 4) Return an object that includes:
    //    - userStores (for all stores)
    //    - currentStoreInfo, currentRole if the user is logged into a specific store
    return {
      ...rest,
      userStores: user.userStores,
      currentStore: currentStoreInfo,
      currentRole,
    };
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
