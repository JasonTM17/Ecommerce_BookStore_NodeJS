import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceNotFoundException } from '../../common/exceptions';
import { Address } from '../../entities/address.entity';
import { User } from '../../entities/user.entity';
import { AddressRequest } from './dto/user.dto';

@Injectable()
export class AddressService {
  constructor(
    @InjectRepository(Address) private readonly addresses: Repository<Address>,
  ) {}

  async getUserAddresses(user: User) {
    const list = await this.addresses.find({
      where: { user: { id: user.id } },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
    return list.map((a) => this.toResponse(a));
  }

  async createAddress(user: User, request: AddressRequest) {
    if (request.isDefault) {
      await this.clearDefault(user.id);
    }
    const address = this.addresses.create({
      user,
      receiverName: request.receiverName,
      phoneNumber: request.phoneNumber,
      province: request.province,
      district: request.district,
      ward: request.ward,
      streetAddress: request.streetAddress,
      postalCode: request.postalCode ?? null,
      isDefault: request.isDefault ?? false,
      addressType: request.addressType ?? 'HOME',
    });
    return this.toResponse(await this.addresses.save(address));
  }

  async updateAddress(user: User, addressId: number, request: AddressRequest) {
    const address = await this.addresses.findOne({
      where: { id: addressId, user: { id: user.id } },
    });
    if (!address) throw new ResourceNotFoundException('Address', 'id', addressId);

    if (request.isDefault && !address.isDefault) {
      await this.clearDefault(user.id);
    }

    if (request.receiverName != null) address.receiverName = request.receiverName;
    if (request.phoneNumber != null) address.phoneNumber = request.phoneNumber;
    if (request.province != null) address.province = request.province;
    if (request.district != null) address.district = request.district;
    if (request.ward != null) address.ward = request.ward;
    if (request.streetAddress != null) address.streetAddress = request.streetAddress;
    if (request.postalCode != null) address.postalCode = request.postalCode;
    if (request.isDefault != null) address.isDefault = request.isDefault;
    if (request.addressType != null) address.addressType = request.addressType;

    return this.toResponse(await this.addresses.save(address));
  }

  async deleteAddress(user: User, addressId: number): Promise<void> {
    const address = await this.addresses.findOne({
      where: { id: addressId, user: { id: user.id } },
    });
    if (!address) throw new ResourceNotFoundException('Address', 'id', addressId);
    await this.addresses.remove(address);
  }

  private async clearDefault(userId: number): Promise<void> {
    await this.addresses.update(
      { user: { id: userId }, isDefault: true },
      { isDefault: false },
    );
  }

  private toResponse(address: Address) {
    return {
      id: address.id,
      receiverName: address.receiverName,
      phoneNumber: address.phoneNumber,
      province: address.province,
      district: address.district,
      ward: address.ward,
      streetAddress: address.streetAddress,
      fullAddress: address.fullAddress,
      postalCode: address.postalCode,
      isDefault: address.isDefault,
      addressType: address.addressType,
    };
  }
}
