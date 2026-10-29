import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UserUpdateRequest {
  @IsOptional()
  @MaxLength(100, { message: 'Họ không được vượt quá 100 ký tự' })
  firstName?: string;

  @IsOptional()
  @MaxLength(100, { message: 'Tên không được vượt quá 100 ký tự' })
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @IsOptional()
  @MinLength(10, { message: 'Số điện thoại phải từ 10 đến 20 ký tự' })
  @MaxLength(20, { message: 'Số điện thoại phải từ 10 đến 20 ký tự' })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class AddressRequest {
  @IsNotEmpty({ message: 'Tên người nhận không được để trống' })
  @MaxLength(200, { message: 'Tên người nhận không được vượt quá 200 ký tự' })
  receiverName: string;

  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @MinLength(10, { message: 'Số điện thoại phải từ 10 đến 20 ký tự' })
  @MaxLength(20, { message: 'Số điện thoại phải từ 10 đến 20 ký tự' })
  phoneNumber: string;

  @IsNotEmpty({ message: 'Tỉnh/Thành phố không được để trống' })
  @MaxLength(100, { message: 'Tỉnh/Thành phố không được vượt quá 100 ký tự' })
  province: string;

  @IsNotEmpty({ message: 'Quận/Huyện không được để trống' })
  @MaxLength(100, { message: 'Quận/Huyện không được vượt quá 100 ký tự' })
  district: string;

  @IsNotEmpty({ message: 'Phường/Xã không được để trống' })
  @MaxLength(100, { message: 'Phường/Xã không được vượt quá 100 ký tự' })
  ward: string;

  @IsNotEmpty({ message: 'Địa chỉ cụ thể không được để trống' })
  streetAddress: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @MaxLength(50, { message: 'Loại địa chỉ không được vượt quá 50 ký tự' })
  addressType?: string;
}
